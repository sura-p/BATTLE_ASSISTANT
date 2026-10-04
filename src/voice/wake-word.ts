import {
    spawn,
    ChildProcessWithoutNullStreams
} from "node:child_process";

import readline from "node:readline";

import {
    pythonFor,
    paths
} from "../config.js";


export class WakeWordDetector {

    private process:
        ChildProcessWithoutNullStreams | null | any =
        null;

    private onWake:
        (() => void) | null =
        null;


    start(
        onWake: () => void
    ) {

        if (this.process) {
            return;
        }


        this.onWake = onWake;


        console.log(
            "[wake] starting Python service"
        );


        this.process = spawn(
            pythonFor("wake"),
            [paths.wakeScript],
            {
                stdio: [
                    "pipe",
                    "pipe",
                    "pipe"
                ]
            }
        );


        // Python stdout is our protocol.

        const rl =
            readline.createInterface({
                input:
                    this.process.stdout
            });


        rl.on(
            "line",
            line => {

                const message =
                    line.trim();


                if (message === "WAKE") {

                    console.log(
                        "🔥 Wake word detected"
                    );

                    this.onWake?.();
                }
            }
        );


        // Python stderr is debugging/logging.

        this.process.stderr.on(
            "data",
            (data: Buffer) => {

                console.log(
                    data
                        .toString()
                        .trim()
                );
            }
        );


        this.process.on(
            "exit",
            (code: number | null) => {

                console.log(
                    "[wake] Python exited:",
                    code
                );

                this.process =
                    null;
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

        this.process =
            null;
    }
}