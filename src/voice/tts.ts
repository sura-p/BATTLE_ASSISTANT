import {
    spawn,
    ChildProcess
} from "node:child_process";

import {
    config
} from "../config.js";


type SpeakFinishedCallback =
    () => void;


export class TTS {

    private process:
        ChildProcess | null = null;


    private speaking =
        false;


    isSpeaking() {

        return this.speaking;
    }


    // ========================================================
    // SPEAK
    // ========================================================

    speak(
        text: string,
        onFinished?: SpeakFinishedCallback
    ) {

        const cleaned =
            text.trim();


        if (
            !cleaned
        ) {

            onFinished?.();

            return;
        }


        // Stop previous speech before starting
        // another response.
        this.stop();


        console.log(
            `🔊 JARVIS: ${cleaned}`
        );


        this.speaking =
            true;


        this.process =
            spawn(
                "say",
                [
                    "-v",
                    config.ttsVoice,

                    "-r",
                    String(config.ttsRate),

                    cleaned
                ],
                {
                    stdio: [
                        "ignore",
                        "ignore",
                        "pipe"
                    ]
                }
            );


        this.process.stderr?.on(
            "data",
            data => {

                const message =
                    data
                        .toString()
                        .trim();


                if (
                    message
                ) {

                    console.error(
                        "[tts]",
                        message
                    );
                }
            }
        );


        this.process.on(
            "error",
            error => {

                console.error(
                    "[tts] failed:",
                    error
                );


                this.speaking =
                    false;

                this.process =
                    null;


                onFinished?.();
            }
        );


        this.process.on(
            "exit",
            () => {

                this.speaking =
                    false;

                this.process =
                    null;


                console.log(
                    "🔇 Jarvis finished speaking"
                );


                onFinished?.();
            }
        );
    }


    // ========================================================
    // INTERRUPT SPEECH
    // ========================================================

    stop() {

        if (
            !this.process
        ) {
            return;
        }


        console.log(
            "[tts] stopping speech"
        );


        this.process.kill(
            "SIGTERM"
        );


        this.process =
            null;

        this.speaking =
            false;
    }
}