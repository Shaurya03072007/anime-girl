package dev.aether.companion.audio

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.sqrt

/**
 * Native Android Gemini Live Audio Engine:
 * - Captures 16kHz 16-bit mono PCM via AudioRecord (VOICE_COMMUNICATION echo cancellation).
 * - Streams 24kHz 16-bit mono PCM via AudioTrack.
 * - Computes real-time normalized RMS amplitude for Aria's 2.5D lip-sync and voice equalizer.
 * - Supports instant barge-in interruption (flushes AudioTrack buffer when user speaks).
 */
class GeminiLiveAudioEngine(
    private val scope: CoroutineScope,
    private val onPcm16kCaptured: (ByteArray) -> Unit,
    private val onBargeInDetected: () -> Unit
) {
    companion object {
        private const val INPUT_SAMPLE_RATE = 16000
        private const val OUTPUT_SAMPLE_RATE = 24000
        private const val BARGE_IN_RMS_THRESHOLD = 1900.0
    }

    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var captureJob: Job? = null

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _voiceAmplitude = MutableStateFlow(0f)
    val voiceAmplitude: StateFlow<Float> = _voiceAmplitude.asStateFlow()

    @SuppressLint("MissingPermission")
    fun startBidirectionalAudio() {
        if (_isListening.value) return

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

        val minOutBuf = AudioTrack.getMinBufferSize(
            OUTPUT_SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(4800)

        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(OUTPUT_SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(minOutBuf * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
            .apply { play() }

        audioRecord?.startRecording()
        _isListening.value = true

        captureJob = scope.launch(Dispatchers.IO) {
            val buffer = ByteArray(1600) // 50ms frame at 16kHz 16-bit mono
            while (isActive && _isListening.value) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                if (read > 0) {
                    val frame = buffer.copyOf(read)
                    val rms = computeRms16Bit(frame)
                    if (_isSpeaking.value && rms > BARGE_IN_RMS_THRESHOLD) {
                        interruptPlaybackImmediately()
                        onBargeInDetected()
                    }
                    if (!_isSpeaking.value) {
                        _voiceAmplitude.value = (rms / 7500.0).toFloat().coerceIn(0f, 1f)
                    }
                    onPcm16kCaptured(frame)
                }
            }
        }
    }

    fun enqueueOutputPcm24k(pcm24kBytes: ByteArray) {
        val track = audioTrack ?: return
        _isSpeaking.value = true
        val rms = computeRms16Bit(pcm24kBytes)
        _voiceAmplitude.value = (rms / 6500.0).toFloat().coerceIn(0.2f, 1f)
        track.write(pcm24kBytes, 0, pcm24kBytes.size)
    }

    fun interruptPlaybackImmediately() {
        _isSpeaking.value = false
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
        _isListening.value = false
        _isSpeaking.value = false
        _voiceAmplitude.value = 0f
        captureJob?.cancel()
        runCatching {
            audioRecord?.stop()
            audioRecord?.release()
        }
        runCatching {
            audioTrack?.stop()
            audioTrack?.release()
        }
        audioRecord = null
        audioTrack = null
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
