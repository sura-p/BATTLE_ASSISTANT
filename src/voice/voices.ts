import {
    spawn
} from "node:child_process";


import fs from "node:fs";

import path from "node:path";


import {
    paths
} from "../config.js";


// ============================================================
// VOICE MODEL
// ============================================================
//
// macOS ships every installed speech voice through `say -v '?'`.
// Each line looks like:
//
//   Samantha          en_US    # Hello, my name is Samantha.
//
// name and sample may contain spaces, the language tag never
// does, so the double-space run before the tag is the anchor.

export interface SystemVoice {

    name: string;

    language: string;

    sample: string;
}


const SAMPLE_TEXT =
    "Battle platform is ready.";


// ============================================================
// LIST INSTALLED VOICES
// ============================================================

export function listSystemVoices():
    Promise<SystemVoice[]> {

    return new Promise(
        (resolve, reject) => {

            const child =
                spawn(
                    "say",
                    ["-v", "?"],
                    {
                        stdio: [
                            "ignore",
                            "pipe",
                            "pipe"
                        ]
                    }
                );


            let output = "";

            let errors = "";

            child.stdout.on(
                "data",

                (data: Buffer) => {
                    output += data.toString();
                }
            );

            child.stderr.on(
                "data",

                (data: Buffer) => {
                    errors += data.toString();
                }
            );

            child.on(
                "error",

                error => {
                    reject(error);
                }
            );

            child.on(
                "close",

                code => {

                    if (
                        code !== 0
                    ) {

                        reject(
                            new Error(
                                `say -v '?' failed (exit ${code}): ${errors.trim()}`
                            )
                        );

                        return;
                    }

                    resolve(
                        parseVoiceListing(output)
                    );
                }
            );
        }
    );
}


export function parseVoiceListing(
    output: string
): SystemVoice[] {

    const voices:

        SystemVoice[] = [];


    for (
        const rawLine of
        output.split("\n")
    ) {

        const line =
            rawLine.trimEnd();


        if (
            !line
        ) {
            continue;
        }


        const match =

            line.match(
                /^(.+?)\s{2,}(\S+)\s+#?\s*(.*)$/
            );


        if (
            !match
        ) {
            continue;
        }


        voices.push({

            name:
                match[1].trim(),

            language:
                match[2],

            sample:
                match[3].trim() || SAMPLE_TEXT
        });
    }


    return voices;
}


// ============================================================
// PREVIEW A VOICE
// ============================================================
//
// Speaks a short line with the given voice and resolves once
// playback finishes.

export function previewVoice(
    voiceName: string,
    text: string
): Promise<void> {

    return new Promise(
        (resolve, reject) => {

            const child =
                spawn(
                    "say",
                    [
                        "-v",
                        voiceName,

                        text || SAMPLE_TEXT
                    ],
                    {
                        stdio: "ignore"
                    }
                );


            child.on(
                "error",

                error => {
                    reject(error);
                }
            );

            child.on(
                "close",

                code => {

                    if (
                        code === 0
                    ) {
                        resolve();
                    }

                    else {

                        reject(
                            new Error(
                                `say exited with ${code}`
                            )
                        );
                    }
                }
            );
        }
    );
}


// ============================================================
// DETECT DOWNLOADED WHISPER MODEL
// ============================================================

export function detectWhisperModel():
    string | null {

    const models =
        paths.modelsDir;


    if (
        !fs.existsSync(models)
    ) {
        return null;
    }


    const files =

        fs.readdirSync(models)

            .filter(name =>
                /^ggml-.*\.bin$/.test(name)
            )

            .sort();


    return files[0]

        ? path.join(models, files[0])
        : null;
}