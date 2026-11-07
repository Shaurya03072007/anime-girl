package dev.aether.companion.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dev.aether.companion.BuildConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.aetherDataStore by preferencesDataStore(name = "aether_backend_prefs")

data class BackendConnectionConfig(
    val httpUrl: String,
    val wsUrl: String,
    val apiToken: String,
    val userId: String
)

class BackendPreferencesRepository(private val context: Context) {

    companion object {
        private val KEY_HTTP_URL = stringPreferencesKey("backend_http_url")
        private val KEY_WS_URL = stringPreferencesKey("backend_ws_url")
        private val KEY_API_TOKEN = stringPreferencesKey("backend_api_token")
        private val KEY_USER_ID = stringPreferencesKey("user_id")
    }

    val configFlow: Flow<BackendConnectionConfig> = context.aetherDataStore.data.map { prefs ->
        val rawHttp = prefs[KEY_HTTP_URL]?.takeIf { it.isNotBlank() }
            ?: BuildConfig.DEFAULT_BACKEND_HTTP_URL
        val rawWs = prefs[KEY_WS_URL]?.takeIf { it.isNotBlank() }
            ?: BuildConfig.DEFAULT_BACKEND_WS_URL
        BackendConnectionConfig(
            httpUrl = rawHttp.trimEnd('/'),
            wsUrl = rawWs.trimEnd('/'),
            apiToken = prefs[KEY_API_TOKEN] ?: BuildConfig.DEFAULT_API_TOKEN,
            userId = prefs[KEY_USER_ID] ?: "shaurya"
        )
    }

    suspend fun updateBackendUrls(httpUrl: String, wsUrl: String, apiToken: String) {
        context.aetherDataStore.edit { prefs ->
            prefs[KEY_HTTP_URL] = httpUrl.trim().trimEnd('/')
            prefs[KEY_WS_URL] = wsUrl.trim().trimEnd('/')
            prefs[KEY_API_TOKEN] = apiToken.trim()
        }
    }
}
