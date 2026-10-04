import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import dotenv from "dotenv";


// ============================================================
// APP DIRECTORIES
// ============================================================

// Where the application code lives. In development this is the
// repo; when installed by install.sh it is ~/.battle-mcp/app.

export const APP_DIR =
    path.resolve(
        import.meta.dirname,
        ".."
    );


// Where user state lives: config, models, venv, logs.

export const BATTLE_HOME =
    process.env.BATTLE_HOME ||
    path.join(
        os.homedir(),
        ".battle-mcp"
    );


export const CONFIG_PATH =
    path.join(
        BATTLE_HOME,
        "config.env"
    );


// ============================================================
// CONFIG LOADING
// ============================================================
//
// Two-file model:
//   - <app>/.env            developer defaults, checked in only
//                           for local dev (no secrets expected)
//   - ~/.battle-mcp/config.env
//                           written by the setup wizard, wins.
//
// The local file is loaded first, and the user config loads
// with override, so the user's install choices always win
// without the dev repo needing a .env at all.

dotenv.config({
    path: path.join(APP_DIR, ".env")
});

dotenv.config({
    path: CONFIG_PATH,
    override: true
});


function env(
    key: string
): string {

    return process.env[key] ?? "";
}


export const config = {

    mongodbUri:
        env("MONGODB_URI"),

    nerApi:
        env("NER_API"),

    chatApiUrl:
        env("CHAT_API_URL"),

    chatApiPort:
        env("PORT") || "3000",

    wakeWordModel:
        env("WAKE_WORD_MODEL") || "hey_jarvis",


    // --------------------------------------------------------
    // TTS — selected from installed system voices at setup
    // --------------------------------------------------------

    ttsVoice:
        env("TTS_VOICE") || "Samantha",

    ttsRate:
        Number(env("TTS_RATE") || "165"),
};


// ============================================================
// RUNTIME PATHS
// ============================================================
//
// Everything heavy (python, whisper build, models) lives under
// BATTLE_HOME once installed. In development only, the repo's
// own venvs and build output are used as fallbacks so the dev
// workflow keeps working unchanged.

const HOME_VENV =
    path.join(BATTLE_HOME, "venv");

const HOME_BIN =
    path.join(BATTLE_HOME, "bin");

const HOME_MODELS =
    path.join(BATTLE_HOME, "models");


function firstExisting(
    paths: string[]
): string | null {

    for (
        const candidate of paths
    ) {

        if (
            fs.existsSync(candidate)
        ) {
            return candidate;
        }
    }

    return null;
}


// The installed venv (kept in BATTLE_HOME) serves wake word and
// VAD alike once it exists. Until the installer has run, a dev
// machine falls back to the repo's own per-service venvs.

export function pythonFor(
    service: "wake" | "vad"
): string {

    const installed =
        firstExisting([
            path.join(HOME_VENV, "bin", "python")
        ]);


    if (installed) {
        return installed;
    }


    const devPython =
        service === "wake"
            ? paths_dev.wake
            : paths_dev.vad;


    if (!devPython) {

        throw new Error(
            `Python venv for ${service} not found — run install.sh (or create ~/.battle-mcp/venv)`
        );
    }

    return devPython;
}


const paths_dev = {

    wake:
        path.join(APP_DIR, ".venv-wake", "bin", "python"),

    vad:
        path.join(APP_DIR, ".venv-vad", "bin", "python"),
};


export const paths = {

    venvPython:
        firstExisting([
            path.join(HOME_VENV, "bin", "python")
        ])
        ?? path.join(APP_DIR, ".venv", "bin", "python"),

    devWakePython:
        firstExisting([
            path.join(APP_DIR, ".venv-wake", "bin", "python")
        ]),

    devVadPython:
        firstExisting([
            path.join(APP_DIR, ".venv-vad", "bin", "python")
        ]),


    wakeScript:
        path.join(APP_DIR, "wake", "wake_service.py"),

    vadScript:
        path.join(APP_DIR, "vad", "vad_service.py"),


    // The whisper worker path is WHISPER_WORKER_PATH relative
    // to the app dir (dev), or the installed copy under
    // BATTLE_HOME/bin — whichever exists.

    whisperWorker:
        env("WHISPER_WORKER_PATH")
            ? firstExisting([
                path.resolve(APP_DIR, env("WHISPER_WORKER_PATH").replace(/^\//, "")),
                path.join(HOME_BIN, "battle-whisper-worker")
            ])
            : path.join(HOME_BIN, "battle-whisper-worker"),


    // WHISPER_MODEL_PATH wins in development; the installed
    // layout ships exactly one ggml model under models/.

    whisperModel:
        env("WHISPER_MODEL_PATH") || null,

    modelsDir:
        HOME_MODELS,
};