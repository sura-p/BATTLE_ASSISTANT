import {
    spawn,
    ChildProcessWithoutNullStreams
} from "node:child_process";


import {
    pythonFor,
    paths
} from "../config.js";


export class VadDetector {

    private process:
        ChildProcessWithoutNullStreams | null = null;

    private stdoutBuffer = "";


    start(
        onSpeechStart: () => void,
        onSpeechEnd: () => void
    ) {

        if (this.process) {
            return;
        }


        console.log(
            "[vad] starting Python service"
        );


        this.process = spawn(
            pythonFor("vad"),
            [paths.vadScript],
            {
                stdio: [
                    "pipe",
                    "pipe",
                    "pipe"
                ]
            }
        );


        // =============================================
        // PYTHON PROTOCOL
        // =============================================

        this.process.stdout.on(
            "data",
            (data: Buffer) => {

                this.stdoutBuffer +=
                    data.toString();


                const lines =
                    this.stdoutBuffer.split("\n");


                this.stdoutBuffer =
                    lines.pop() ?? "";


                for (const rawLine of lines) {

                    const line =
                        rawLine.trim();


                    if (
                        line ===
                        "SPEECH_START"
                    ) {

                        onSpeechStart();
                    }


                    if (
                        line ===
                        "SPEECH_END"
                    ) {

                        onSpeechEnd();
                    }
                }
            }
        );


        // =============================================
        // PYTHON DEBUG LOGS
        // =============================================

        this.process.stderr.on(
            "data",
            (data: Buffer) => {

                const message =
                    data.toString().trim();


                if (message) {

                    console.log(
                        message
                    );
                }
            }
        );


        // =============================================
        // ERROR
        // =============================================

        this.process.on(
            "error",
            (error: Error) => {

                console.error(
                    "[vad] failed:",
                    error
                );

                this.process = null;
            }
        );


        // =============================================
        // EXIT
        // =============================================

        this.process.on(
            "exit",
            (
                code: number | null,
                signal: NodeJS.Signals | null
            ) => {

                console.log(
                    "[vad] stopped:",
                    {
                        code,
                        signal
                    }
                );

                this.process = null;
            }
        );
    }


    sendAudio(
        chunk: Buffer
    ) {

        if (!this.process) {
            return;
        }


        if (
            !this.process.stdin.writable
        ) {
            return;
        }


        this.process.stdin.write(
            chunk
        );
    }


    stop() {

        if (!this.process) {
            return;
        }


        this.process.stdin.end();

        this.process.kill(
            "SIGTERM"
        );

        this.process = null;
    }
}