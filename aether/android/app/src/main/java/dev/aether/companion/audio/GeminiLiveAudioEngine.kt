package dev.aether.companion.audio

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.sqrt

/**
 * Speaker-Conscious Native Android Gemini Live Audio Engine:
 * 1. Configures AudioManager.MODE_IN_COMMUNICATION + shared audioSessionId between AudioRecord & AudioTrack.
 * 2. Binds Hardware AcousticEchoCanceler (AEC) and NoiseSuppressor (NS) to the shared session.
 * 3. Uses AudioAttributes.USAGE_VOICE_COMMUNICATION on AudioTrack so the Android HAL recognizes the downlink reference.
 * 4. Tracks exact physical speaker playback completion time (speakerPlaybackEndEpochMs) + 420ms acoustic room-reverb tail.
 * 5. Enforces a Speaker-Conscious Echo Gate: while the speaker is physically emitting Aria's voice (or in its 420ms reverb tail),
 *    microphone frames are gated and NEVER sent to Gemini Live, completely preventing Aria from hearing or talking to herself.
 * 6. Supports sustained high-energy double-talk barge-in (4 consecutive frames > 2.7x speaker RMS) and instant 0ms tap barge-in.
 */
class GeminiLiveAudioEngine(
    private val context: Context,
    private val scope: CoroutineScope,
    private val onPcm16kCaptured: (ByteArray) -> Unit,
    private val onBargeInDetected: () -> Unit
) {
    companion object {
        private const val INPUT_SAMPLE_RATE = 16000
        private const val OUTPUT_SAMPLE_RATE = 24000
        private const val BYTES_PER_MS_24K_PCM16 = (OUTPUT_SAMPLE_RATE * 2) / 1000 // 48 bytes/ms
        private const val SPEAKER_REVERB_TAIL_MS = 420L
        private const val BARGE_IN_SPEAKER_RMS_FLOOR = 5200.0
        private const val BARGE_IN_HEADSET_RMS_FLOOR = 1800.0
        private const val CONSECUTIVE_FRAMES_FOR_BARGE_IN = 4
    }

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    private var captureJob: Job? = null
    private var speakerWatchdogJob: Job? = null

    // Wall-clock timestamp (ms) when the physical speaker will finish playing all queued PCM bytes
    private val speakerPlaybackEndEpochMs = AtomicLong(0L)

    @Volatile
    private var lastSpeakerOutputRms: Double = 0.0

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _isEchoGateActive = MutableStateFlow(false)
    val isEchoGateActive: StateFlow<Boolean> = _isEchoGateActive.asStateFlow()

    private val _aecHardwareStatus = MutableStateFlow("Standby")
    val aecHardwareStatus: StateFlow<String> = _aecHardwareStatus.asStateFlow()

    private val _voiceAmplitude = MutableStateFlow(0f)
    val voiceAmplitude: StateFlow<Float> = _voiceAmplitude.asStateFlow()

    @SuppressLint("MissingPermission")
    fun startBidirectionalAudio() {
        if (_isListening.value) return

        // 1. Put Android audio subsystem into VoIP Communication mode so hardware AEC activates
        runCatching {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.isSpeakerphoneOn = !isExternalHeadsetConnected()
        }

        val minInBuf = AudioRecord.getMinBufferSize(
            INPUT_SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(3200)

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            INPUT_SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            minInBuf * 2
        )

        val sharedSessionId = audioRecord?.audioSessionId ?: AudioManager.AUDIO_SESSION_ID_GENERATE

        // 2. Attach Hardware AcousticEchoCanceler and NoiseSuppressor to the shared session ID
        var aecEnabled = false
        var nsEnabled = false
        if (AcousticEchoCanceler.isAvailable() && sharedSessionId != AudioManager.AUDIO_SESSION_ID_GENERATE) {
            runCatching {
                echoCanceler = AcousticEchoCanceler.create(sharedSessionId)?.apply {
                    enabled = true
                    aecEnabled = enabled
                }
            }
        }
        if (NoiseSuppressor.isAvailable() && sharedSessionId != AudioManager.AUDIO_SESSION_ID_GENERATE) {
            runCatching {
                noiseSuppressor = NoiseSuppressor.create(sharedSessionId)?.apply {
                    enabled = true
                    nsEnabled = enabled
                }
            }
        }
        _aecHardwareStatus.value = buildString {
            append(if (aecEnabled) "HW-AEC Active" else "SW Echo-Gate Active")
            if (nsEnabled) append(" + NS")
            append(" (Session #$sharedSessionId)")
        }

        val minOutBuf = AudioTrack.getMinBufferSize(
            OUTPUT_SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(4800)

        // 3. Critical: Use USAGE_VOICE_COMMUNICATION and bind to sharedSessionId
        val outAttributesBuilder = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)

        val outFormat = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(OUTPUT_SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build()

        val trackBuilder = AudioTrack.Builder()
            .setAudioAttributes(outAttributesBuilder.build())
            .setAudioFormat(outFormat)
            .setBufferSizeInBytes(minOutBuf * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)

        if (sharedSessionId != AudioManager.AUDIO_SESSION_ID_GENERATE) {
            trackBuilder.setSessionId(sharedSessionId)
        }

        audioTrack = trackBuilder.build().apply { play() }

        audioRecord?.startRecording()
        _isListening.value = true

        // 4. Watchdog coroutine that updates _isSpeaking, _isEchoGateActive, and animates speaker lip-sync
        speakerWatchdogJob = scope.launch(Dispatchers.Default) {
            while (isActive && _isListening.value) {
                val now = System.currentTimeMillis()
                val endMs = speakerPlaybackEndEpochMs.get()
                val physicallyPlaying = now < endMs
                val inReverbTail = now < (endMs + SPEAKER_REVERB_TAIL_MS)
                val headset = isExternalHeadsetConnected()

                _isSpeaking.value = physicallyPlaying
                _isEchoGateActive.value = (physicallyPlaying || inReverbTail) && !headset

                if (!physicallyPlaying && lastSpeakerOutputRms > 0.0) {
                    lastSpeakerOutputRms = 0.0
                    if (!_isListening.value) {
                        _voiceAmplitude.value = 0f
                    }
                }
                delay(35)
            }
        }

        // 5. Capture coroutine with Speaker-Conscious Echo Gate
        captureJob = scope.launch(Dispatchers.IO) {
            val buffer = ByteArray(1600) // 50ms frame at 16kHz 16-bit mono
            var consecutiveBargeInFrames = 0

            while (isActive && _isListening.value) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                if (read > 0) {
                    val frame = buffer.copyOf(read)
                    val micRms = computeRms16Bit(frame)
                    val now = System.currentTimeMillis()
                    val endMs = speakerPlaybackEndEpochMs.get()
                    val speakerActive = now < endMs
                    val inTail = now < (endMs + SPEAKER_REVERB_TAIL_MS)
                    val headset = isExternalHeadsetConnected()

                    if (speakerActive || inTail) {
                        // SPEAKER IS PHYSICALLY PLAYING OR IN REVERB TAIL:
                        // Check if the user is intentionally shouting/speaking much louder than the speaker to barge in
                        val dynamicThreshold = if (headset) {
                            BARGE_IN_HEADSET_RMS_FLOOR
                        } else {
                            maxOf(BARGE_IN_SPEAKER_RMS_FLOOR, lastSpeakerOutputRms * 2.75)
                        }

                        if (micRms > dynamicThreshold) {
                            consecutiveBargeInFrames++
                            if (consecutiveBargeInFrames >= CONSECUTIVE_FRAMES_FOR_BARGE_IN) {
                                consecutiveBargeInFrames = 0
                                interruptPlaybackImmediately()
                                onBargeInDetected()
                            }
                        } else {
                            consecutiveBargeInFrames = 0
                        }

                        // CRITICAL ECHO GATE:
                        // Unless headphones are worn, NEVER transmit microphone frames to Gemini Live
                        // while the phone's own speaker is emitting Aria's voice or decaying in the room!
                        if (headset) {
                            onPcm16kCaptured(frame)
                        }
                    } else {
                        // SPEAKER IS SILENT: Microphone is 100% open for user speech
                        consecutiveBargeInFrames = 0
                        _voiceAmplitude.value = (micRms / 6500.0).toFloat().coerceIn(0f, 1f)
                        onPcm16kCaptured(frame)
                    }
                }
            }
        }
    }

    fun enqueueOutputPcm24k(pcm24kBytes: ByteArray) {
        val track = audioTrack ?: return
        if (pcm24kBytes.isEmpty()) return

        // Calculate exact physical playback duration of this 24kHz 16-bit mono chunk
        val durationMs = (pcm24kBytes.size / BYTES_PER_MS_24K_PCM16).toLong().coerceAtLeast(15L)
        val now = System.currentTimeMillis()
        val currentEnd = speakerPlaybackEndEpochMs.get()
        val newEnd = maxOf(now, currentEnd) + durationMs
        speakerPlaybackEndEpochMs.set(newEnd)

        _isSpeaking.value = true
        _isEchoGateActive.value = !isExternalHeadsetConnected()

        val rms = computeRms16Bit(pcm24kBytes)
        lastSpeakerOutputRms = rms
        _voiceAmplitude.value = (rms / 6000.0).toFloat().coerceIn(0.22f, 1f)

        track.write(pcm24kBytes, 0, pcm24kBytes.size)
    }

    fun interruptPlaybackImmediately() {
        speakerPlaybackEndEpochMs.set(0L)
        lastSpeakerOutputRms = 0.0
        _isSpeaking.value = false
        _isEchoGateActive.value = false
        _voiceAmplitude.value = 0f
        audioTrack?.let { track ->
            runCatching {
                track.pause()
                track.flush()
                track.play()
            }
        }
    }

    fun stopAll() {
        speakerPlaybackEndEpochMs.set(0L)
        lastSpeakerOutputRms = 0.0
        _isListening.value = false
        _isSpeaking.value = false
        _isEchoGateActive.value = false
        _voiceAmplitude.value = 0f
        captureJob?.cancel()
        speakerWatchdogJob?.cancel()
        runCatching {
            echoCanceler?.release()
            noiseSuppressor?.release()
        }
        echoCanceler = null
        noiseSuppressor = null
        runCatching {
            audioRecord?.stop()
            audioRecord?.release()
        }
        runCatching {
            audioTrack?.stop()
            audioTrack?.release()
        }
        runCatching {
            audioManager.mode = AudioManager.MODE_NORMAL
        }
        audioRecord = null
        audioTrack = null
    }

    private fun isExternalHeadsetConnected(): Boolean {
        val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        return devices.any { dev ->
            dev.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                dev.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                dev.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                dev.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                dev.type == AudioDeviceInfo.TYPE_USB_HEADSET
        }
    }

    private fun computeRms16Bit(pcmBytes: ByteArray): Double {
        var sumSq = 0.0
        val sampleCount = pcmBytes.size / 2
        if (sampleCount == 0) return 0.0
        for (i in 0 until sampleCount) {
            val lo = pcmBytes[i * 2].toInt() and 0xFF
            val hi = pcmBytes[i * 2 + 1].toInt()
            val sample = (hi shl 8) or lo
            sumSq += sample.toDouble() * sample.toDouble()
        }
        return sqrt(sumSq / sampleCount)
    }
}
