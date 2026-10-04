import {
    spawn,
    ChildProcessByStdio
} from "node:child_process";

import {
    Readable
} from "node:stream";


export class Microphone {

    private process:
        ChildProcessByStdio<null, Readable, Readable> | null = null;


    start(
        onAudio: (chunk: Buffer) => void
    ) {

        if (this.process) {
            return;
        }

        console.log(
            "[mic] starting proven bash pipeline"
        );


        const command = `
            rec -q \
                -t raw \
                -r 48000 \
                -c 1 \
                -b 16 \
                -e signed-integer \
                -L \
                - \
            | \
            sox \
                -t raw \
                -r 48000 \
                -c 1 \
                -b 16 \
                -e signed-integer \
                -L \
                - \
                -t raw \
                -r 16000 \
                -c 1 \
                -b 16 \
                -e signed-integer \
                -L \
                -
        `;


        this.process = spawn(
            "/bin/bash",
            [
                "-c",
                command
            ],
            {
                stdio: [
                    "ignore",
                    "pipe",
                    "pipe"
                ]
            }
        );


        // 16 kHz / mono / int16 PCM
        this.process.stdout.on(
            "data",
            (chunk: Buffer) => {

                onAudio(chunk);
            }
        );


        this.process.stderr.on(
            "data",
            (data: Buffer) => {

                const message =
                    data.toString().trim();

                if (message) {
                    console.log(
                        "[mic]",
                        message
                    );
                }
            }
        );


        this.process.on(
            "error",
            (error: Error) => {

                console.error(
                    "[mic] process error:",
                    error
                );
            }
        );


        this.process.on(
            "exit",
            (
                code: number | null,
                signal: NodeJS.Signals | null
            ) => {

                console.log(
                    "[mic] stopped:",
                    {
                        code,
                        signal
                    }
                );

                this.process = null;
            }
        );
    }


    stop() {

        if (!this.process) {
            return;
        }

        console.log(
            "[mic] stopping"
        );

        this.process.kill(
            "SIGTERM"
        );
    }
}