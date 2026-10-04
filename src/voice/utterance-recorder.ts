import {
    writeFileSync
} from "node:fs";

import {
    spawn
} from "node:child_process";


export class UtteranceRecorder {

    private chunks: Buffer[] = [];

    private preRollChunks: Buffer[] = [];

    private preRollBytes = 0;

    private recording = false;


    // 500 ms @ 16 kHz mono int16
    private readonly maxPreRollBytes =
        16000;


    pushPreRoll(
        chunk: Buffer
    ) {

        if (this.recording) {
            return;
        }


        const copy =
            Buffer.from(chunk);


        this.preRollChunks.push(
            copy
        );

        this.preRollBytes +=
            copy.length;


        while (
            this.preRollBytes >
            this.maxPreRollBytes
        ) {

            const removed =
                this.preRollChunks.shift();


            if (!removed) {
                break;
            }


            this.preRollBytes -=
                removed.length;
        }
    }


    start() {

        console.log(
            "[utterance] recording started"
        );


        // Start with audio immediately BEFORE
        // Silero reported SPEECH_START.

        this.chunks = [
            ...this.preRollChunks
        ];


        this.preRollChunks = [];

        this.preRollBytes = 0;

        this.recording = true;
    }


    addAudio(
        chunk: Buffer
    ) {

        if (!this.recording) {
            return;
        }


        this.chunks.push(
            Buffer.from(chunk)
        );
    }


    stop(): Buffer {

        this.recording = false;


        const audio =
            Buffer.concat(
                this.chunks
            );


        this.chunks = [];

        console.log(
            `[utterance] captured ${audio.length} bytes`
        );


        return audio;
    }


    isRecording() {

        return this.recording;
    }


    saveRaw(
    audio: Buffer,
    path: string
): void {

    writeFileSync(
        path,
        audio
    );

    console.log(
        `[utterance] saved ${path}`
    );
}


convertToWav(
    rawPath: string,
    wavPath: string
): Promise<void> {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const sox =
                spawn(
                    "sox",
                    [
                        // Tell SoX what the RAW
                        // input format is.
                        "-t", "raw",

                        // 16 kHz
                        "-r", "16000",

                        // Mono
                        "-c", "1",

                        // 16-bit PCM
                        "-b", "16",

                        // Signed integer
                        "-e", "signed-integer",

                        // Little endian
                        "-L",

                        // Input
                        rawPath,

                        // Output WAV
                        wavPath
                    ]
                );


            sox.stderr.on(
                "data",
                (
                    data: Buffer
                ) => {

                    const message =
                        data
                            .toString()
                            .trim();


                    if (message) {

                        console.log(
                            "[utterance/sox]",
                            message
                        );
                    }
                }
            );


            sox.on(
                "error",
                (
                    error: Error
                ) => {

                    reject(
                        error
                    );
                }
            );


            sox.on(
                "exit",
                (
                    code: number | null
                ) => {

                    if (
                        code === 0
                    ) {

                        resolve();

                    } else {

                        reject(
                            new Error(
                                `SoX exited with code ${code}`
                            )
                        );
                    }
                }
            );
        }
    );
}
}