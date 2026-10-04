import {
    spawn,
    ChildProcessWithoutNullStreams
} from "node:child_process";

import fs from "node:fs";

import {
    paths
} from "../config.js";

import {
    detectWhisperModel
} from "./voices.js";


type FinalCallback =
    (
        text: string
    ) => void;


export class StreamingSTT {
    private totalAudioBytes =
        0;


    private lastPartialAt = 0;

    private readonly partialIntervalMs =
        700;

    private partialPending =
        false;
    private process:
        ChildProcessWithoutNullStreams | null = null;


    private stdoutBuffer =
        "";


    constructor(
        private readonly onFinal:
            FinalCallback
    ) { }


    // ========================================================
    // START WORKER
    // ========================================================

    start() {

        if (
            this.process
        ) {
            return;
        }


        const workerPath =
            paths.whisperWorker;


        const modelPath =
            paths.whisperModel ||
            detectWhisperModel();


        if (
            !workerPath ||
            !fs.existsSync(workerPath)
        ) {

            throw new Error(
                "Whisper worker not found — run install.sh or set WHISPER_WORKER_PATH"
            );
        }


        if (
            !modelPath
        ) {

            throw new Error(
                "Whisper model not found — run install.sh or set WHISPER_MODEL_PATH"
            );
        }


        console.log(
            "[stt] starting Whisper worker"
        );


        this.process =
            spawn(
                workerPath,
                [
                    modelPath
                ],
                {
                    stdio: [
                        "pipe",
                        "pipe",
                        "pipe"
                    ]
                }
            );


        // ====================================================
        // STDOUT PROTOCOL
        // ====================================================

        this.process.stdout.on(
            "data",
            (
                data: Buffer
            ) => {

                this.handleStdout(
                    data
                );
            }
        );


        // ====================================================
        // STDERR DEBUGGING
        // ====================================================

        this.process.stderr.on(
            "data",
            (
                data: Buffer
            ) => {

                const message =
                    data
                        .toString()
                        .trim();


                if (
                    message
                ) {

                    console.log(
                        "[stt-worker]",
                        message
                    );
                }
            }
        );


        // ====================================================
        // PROCESS ERROR
        // ====================================================

        this.process.on(
            "error",
            error => {

                console.error(
                    "[stt] worker error:",
                    error
                );
            }
        );


        // ====================================================
        // PROCESS EXIT
        // ====================================================

        this.process.on(
            "exit",
            code => {

                console.log(
                    "[stt] worker stopped:",
                    code
                );


                this.process = null;
            }
        );
    }


    // ========================================================
    // RECEIVE STDOUT
    // ========================================================

    private handleStdout(
        data: Buffer
    ) {

        this.stdoutBuffer +=
            data.toString();


        while (true) {

            const newlineIndex =
                this.stdoutBuffer.indexOf(
                    "\n"
                );


            if (
                newlineIndex === -1
            ) {
                break;
            }


            const line =
                this.stdoutBuffer
                    .slice(
                        0,
                        newlineIndex
                    )
                    .trim();


            this.stdoutBuffer =
                this.stdoutBuffer.slice(
                    newlineIndex + 1
                );


            if (
                !line
            ) {
                continue;
            }


            this.handleLine(
                line
            );
        }
    }


    private handleLine(
        line: string
    ) {

        if (
            line === "READY"
        ) {

            console.log(
                "[stt] Whisper ready"
            );

            return;
        }

 if (
        line.startsWith(
            "PARTIAL|"
        )
    ) {

        this.partialPending =
            false;


        const text =
            line
                .slice(
                    "PARTIAL|".length
                )
                .trim();


        if (
            text
        ) {

            console.log(
                `🟡 ${text}`
            );
        }


        return;
    }


    // ================================================
    // FINAL
    // ================================================

    if (
        line.startsWith(
            "FINAL|"
        )
    ) {

        this.partialPending =
            false;


        const text =
            line
                .slice(
                    "FINAL|".length
                )
                .trim();


        console.log(
            `[stt] final: ${text}`
        );


        this.onFinal(
            text
        );


        return;
    }
    }


    // ========================================================
    // SEND PCM
    // ========================================================

    sendAudio(
        chunk: Buffer
    ) {

        if (
            !this.process
        ) {
            return;
        }


        if (
            !this.process.stdin.writable
        ) {
            return;
        }


        this.totalAudioBytes +=
            chunk.length;


        const header =
            Buffer.allocUnsafe(
                4
            );


        header.writeUInt32LE(
            chunk.length,
            0
        );


        this.process.stdin.write(
            header
        );


        this.process.stdin.write(
            chunk
        );
        const now =
        Date.now();


    if (
        this.totalAudioBytes >= 16000 &&
        !this.partialPending &&
        now - this.lastPartialAt >=
            this.partialIntervalMs
    ) {

        this.requestPartial();

        this.lastPartialAt =
            now;
    }
    }


    // ========================================================
    // FINALIZE CURRENT TURN
    // ========================================================

  finalize() {

    if (
        !this.process
    ) {

        console.error(
            "[stt] cannot finalize: worker not running"
        );

        return;
    }


    if (
        !this.process.stdin.writable
    ) {

        console.error(
            "[stt] cannot finalize: stdin not writable"
        );

        return;
    }


    console.log(
        `[stt] finalizing ${this.totalAudioBytes} audio bytes`
    );


    this.partialPending =
        false;

    this.lastPartialAt =
        0;


    const header =
        Buffer.alloc(
            4
        );


    header.writeUInt32LE(
        0,
        0
    );


    this.process.stdin.write(
        header
    );


    this.totalAudioBytes =
        0;
}


    // ========================================================
    // STOP
    // ========================================================

    stop() {

        if (
            !this.process
        ) {
            return;
        }


        this.process.kill(
            "SIGTERM"
        );


        this.process = null;
    }

    private requestPartial() {

    if (
        !this.process ||
        !this.process.stdin.writable
    ) {
        return;
    }


    this.partialPending =
        true;


    const command =
        Buffer.allocUnsafe(
            4
        );


    command.writeUInt32LE(
        0xffffffff,
        0
    );


    this.process.stdin.write(
        command
    );
}
}