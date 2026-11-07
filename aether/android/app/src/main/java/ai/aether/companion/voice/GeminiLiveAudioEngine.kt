package ai.aether.companion.voice

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Base64
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Bidirectional 16kHz PCM AudioRecord capture & 24kHz PCM AudioTrack playback engine
 * with instant barge-in interruption support for Gemini 3.8 Live WebSocket sessions.
 */
class GeminiLiveAudioEngine(
    private val scope: CoroutineScope,
    private val onSendPcmBase64: (String) -> Unit,
    private val onUserBargeInDetected: () -> Unit
) {
    private var recordJob: Job? = null
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    @Volatile
    private var isModelSpeaking = false

    @SuppressLint("MissingPermission")
    fun startCapture() {
        if (recordJob?.isActive == true) return
        val sampleRate = 16000
        val minBuf = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            minBuf * 2
        )
        initAudioTrack()
        audioRecord?.startRecording()

        recordJob = scope.launch(Dispatchers.IO) {
            val buffer = ByteArray(2048)
            while (isActive) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                if (read > 0) {
                    val rms = computeRms(buffer, read)
                    if (isModelSpeaking && rms > 1800) {
                        stopPlaybackImmediately()
                        onUserBargeInDetected()
                    }
                    val b64 = Base64.encodeToString(buffer.copyOf(read), Base64.NO_WRAP)
                    onSendPcmBase64(b64)
                }
            }
        }
    }

    private fun initAudioTrack() {
        val outSampleRate = 24000
        val minOutBuf = AudioTrack.getMinBufferSize(
            outSampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
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
                    .setSampleRate(outSampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(minOutBuf * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
            .apply { play() }
    }

    fun playPcm24kChunk(base64Pcm: String) {
        val bytes = Base64.decode(base64Pcm, Base64.DEFAULT)
        isModelSpeaking = true
        audioTrack?.write(bytes, 0, bytes.size)
    }

    fun stopPlaybackImmediately() {
        isModelSpeaking = false
        audioTrack?.pause()
        audioTrack?.flush()
        audioTrack?.play()
    }

    fun release() {
        recordJob?.cancel()
        audioRecord?.stop()
        audioRecord?.release()
        audioTrack?.stop()
        audioTrack?.release()
    }

    private fun computeRms(buf: ByteArray, length: Int): Double {
        var sum = 0.0
        var count = 0
        var i = 0
        while (i + 1 < length) {
            val sample = (buf[i + 1].toInt() shl 8) or (buf[i].toInt() and 0xFF)
            sum += sample * sample
            count++
            i += 2
        }
        return if (count > 0) Math.sqrt(sum / count) else 0.0
    }
}
