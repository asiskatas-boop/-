plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val build = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "app.filaki.widget"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.filaki.widget"
        minSdk = 26
        targetSdk = 34
        versionCode = build
        versionName = "1.$build"
    }

    // A fixed key so each new APK installs over the last one.
    // Only used for sideloading between the two of you, not the Play Store.
    signingConfigs {
        create("release") {
            storeFile = file("../filaki.keystore")
            storePassword = "filaki-widget"
            keyAlias = "filaki"
            keyPassword = "filaki-widget"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.work:work-runtime:2.9.1")
}
