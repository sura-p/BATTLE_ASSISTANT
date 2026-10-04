import fs from "node:fs";

import net from "node:net";

import mongoose from "mongoose";

import {
    BATTLE_HOME,
    CONFIG_PATH,
    config,
    paths,
    pythonFor
} from "./config.js";

import {
    listSystemVoices,
    detectWhisperModel
} from "./voice/voices.js";


// ============================================================
// DOCTOR
// ============================================================
//
// Verifies every component of the installed system: binaries,
// compiled artifacts, models, the user config, and each remote
// endpoint. Exits non-zero if any required check fails so both
// install.sh and `battle doctor` can gate on it.

interface Check {

    name: string;

    ok: boolean;

    detail: string;

    required:
        boolean;
}


const checks: Check[] = [];


function record(
    name: string,
    ok: boolean,
    detail: string,
    required = true
): void {

    checks.push({
        name,
        ok,
        detail,
        required
    });
}


// ============================================================
// FILE ARTIFACTS
// ============================================================

// The model lives either at an explicit WHISPER_MODEL_PATH or
// wherever the installer left a ggml file — same resolution the
// runtime uses. Reused by both checks below.

function resolvedModelPath():
    string | null {

    return paths.whisperModel || detectWhisperModel();
}


function isModelPresent():
    boolean {

    return !!resolvedModelPath();
}


function modelPathToReport():
    string {

    return resolvedModelPath() || "";
}


function checkFiles() {

    record(
        "config",
        fs.existsSync(CONFIG_PATH),
        fs.existsSync(CONFIG_PATH)
            ? CONFIG_PATH
            : `missing — run \`battle setup\``,

        true
    );

    record(
        "python venv",
        fs.existsSync(paths.venvPython),
        paths.venvPython,

        true
    );

    record(
        "wake word script",
        fs.existsSync(paths.wakeScript),
        paths.wakeScript,

        true
    );

    record(
        "vad script",
        fs.existsSync(paths.vadScript),
        paths.vadScript,

        true
    );

    record(
        "whisper worker",
        !!paths.whisperWorker &&
            fs.existsSync(paths.whisperWorker),
        paths.whisperWorker || "not found",

        true
    );

    record(
        "whisper model",
        isModelPresent(),
        isModelPresent()
            ? modelPathToReport()
            : "not found — run install.sh or set WHISPER_MODEL_PATH",

        true
    );
}


// ============================================================
// REMOTE ENDPOINTS
// ============================================================

async function checkMongo(): Promise<void> {

    if (
        !config.mongodbUri
    ) {

        record(
            "MongoDB",
            false,
            "MONGODB_URI not configured",
            true
        );

        return;
    }

    try {

        await mongoose.createConnection(
            config.mongodbUri,
            {
                serverSelectionTimeoutMS: 8000
            }
        )

            .asPromise();

        record(
            "MongoDB",
            true,
            "connected"
        );

    } catch (error) {

        record(
            "MongoDB",
            false,
            `unreachable: ${(error as Error).message} ${(error as Error).name ?? ""}`,
            true
        );

    } finally {

        await mongoose.disconnect().catch(

            () => undefined
        );
    }
}


function probeHttp(
    url: string,

    timeoutMs = 5000
): Promise<boolean> {

    return new Promise(
        resolve => {

            try {

                const parsed =
                    new URL(url);

                const port =
                    Number(parsed.port) ||
                    (parsed.protocol === "https:" ? 443 : 80);

                const socket =
                    net.createConnection(
                        {
                            host: parsed.hostname,
                            port
                        },

                        () => {
                            socket.destroy();
                            resolve(true);
                        }
                    );


                socket.setTimeout(
                    timeoutMs
                );

                socket.on(
                    "timeout",

                    () => {
                        socket.destroy();
                        resolve(false);
                    }
                );

                socket.on(
                    "error",

                    () => {
                        resolve(false);
                    }
                );

            } catch {

                resolve(false);
            }
        }
    );
}


async function checkNer(): Promise<void> {

    if (
        !config.nerApi
    ) {

        record(
            "NER service",
            false,
            "NER_API not configured",
            true
        );

        return;
    }

    const reachable =
        await probeHttp(config.nerApi);

    record(
        "NER service",
        reachable,
        reachable
            ? `${config.nerApi} reachable`
            : `${config.nerApi} unreachable`,
        true
    );
}


// ============================================================
// TTS
// ============================================================

async function checkTts(): Promise<void> {

    const voices =
        await listSystemVoices().catch(() => []);

    record(
        "TTS voices",
        voices.length > 0,
        `${voices.length} system voices; using "${config.ttsVoice}" at ${config.ttsRate} wpm`,
        true
    );

    record(
        "TTS voice installed",
        voices.some(
            v => v.name === config.ttsVoice
        ),
        voices.some(
            v => v.name === config.ttsVoice
        )
            ? `"${config.ttsVoice}" is installed`
            : `"${config.ttsVoice}" is NOT installed — run \`battle voice\` to pick another`,
        false
    );
}


// ============================================================
// RUN
// ============================================================

async function main() {

    console.log(
        `battle platform doctor — home: ${BATTLE_HOME}`
    );

    console.log("");

    checkFiles();

    await checkMongo();

    await checkNer();

    await checkTts();

    console.log("");

    let failures = 0;

    for (
        const check of checks
    ) {

        const mark =
            check.ok ? "✓" : "✗";

        if (
            !check.ok &&
            check.required
        ) {
            failures++;
        }

        const optional =
            check.required ? "" : "  (optional)";

        console.log(
            `${mark} ${check.name.padEnd(20)} ${check.detail}${optional}`
        );
    }

    console.log("");

    if (
        failures > 0
    ) {

        console.log(
            `${failures} required check(s) failed.`
        );

        process.exit(1);
    }

    console.log(
        "All required checks passed."
    );
}


main();