import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

val localProps = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

val defaultHttpUrl = localProps.getProperty("AETHER_BACKEND_HTTP_URL", "http://10.0.2.2:8000")
val defaultWsUrl = localProps.getProperty("AETHER_BACKEND_WS_URL", "ws://10.0.2.2:8000")
val defaultApiToken = localProps.getProperty("AETHER_API_TOKEN", "aether-dev-local-token-2026")

android {
    namespace = "dev.aether.companion"
    compileSdk = 35

    defaultConfig {
        applicationId = "ai.aether.companion"
        minSdk = 29
        targetSdk = 35
        versionCode = 2
        versionName = "2.0.0"

        buildConfigField("String", "DEFAULT_BACKEND_HTTP_URL", "\"$defaultHttpUrl\"")
        buildConfigField("String", "DEFAULT_BACKEND_WS_URL", "\"$defaultWsUrl\"")
        buildConfigField("String", "DEFAULT_API_TOKEN", "\"$defaultApiToken\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // Coroutines & Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // OkHttp WebSockets & REST
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Jetpack DataStore Preferences (Runtime Backend URL & Companion Settings)
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Room Local Cache Database
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // WorkManager (Proactive Checks & Reminders)
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Coil Image Loading for Studio Anime Assets
    implementation("io.coil-kt:coil-compose:2.7.0")

    // WebKit WebViewAssetLoader for 60fps Three.js + three-vrm 3D Anime Ghost Engine
    implementation("androidx.webkit:webkit:1.12.1")

    // Unit Testing
    testImplementation("junit:junit:4.13.2")
}
