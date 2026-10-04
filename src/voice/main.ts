import {
    config
} from "../config.js";
import {
    Microphone
} from "./microphone.js";

import {
    WakeWordDetector
} from "./wake-word.js";

import {
    VadDetector
} from "./vad.js";

import type {
    VoiceState
} from "./types.js";

// import {
//     UtteranceRecorder
// } from "./utterance-recorder.js";
import {
    StreamingSTT
} from "./stt.js";
let voiceState: VoiceState =
    "SLEEPING";

let conversationId:
    string = "";
import {
    TTS
} from "./tts.js";
import {
    ChatClient
} from "./chat-client.js";
// const utterance =
//     new UtteranceRecorder();
function createConversationId():
    string {

    return `voice-${Date.now()}`;
}
const chatApiUrl =
    process.env.CHAT_API_URL;


if (
    !chatApiUrl
) {

    throw new Error(
        "CHAT_API_URL is missing"
    );
}


const chat =
    new ChatClient(
        chatApiUrl
    );



const microphone =
    new Microphone();

const wake =
    new WakeWordDetector();

const vad =
    new VadDetector();

// const stt =
//     new StreamingSTT(
//         (
//             text: string
//         ) => {

//             console.log(
//                 "\n================================"
//             );

//             console.log(
//                 "📝 USER:",
//                 text
//             );

//             console.log(
//                 "================================\n"
//             );


//             if (
//                 !text
//             ) {

//                 voiceState =
//                     "LISTENING";

//                 return;
//             }


//             // ================================================
//             // LATER:
//             //
//             // processBattleMessage(text)
//             // ================================================


//             voiceState =
//                 "LISTENING";
//         }
// );



const stt =
    new StreamingSTT(
        async (
            text: string
        ) => {

            console.log(
                "\n================================"
            );

            console.log(
                "📝 USER:",
                text
            );

            console.log(
                "================================\n"
            );


            const clean =
                text
                    .trim()
                    .toLowerCase()
                    .replace(
                        /[.!?,]/g,
                        ""
                    );


            // Whisper commonly hallucinates
            // these placeholders on silence
            // and background noise.

            const noiseTexts =
                new Set(
                    [
                        "blank_audio",
                        "[blank_audio]",
                        "you",
                        "thank you",
                        "thank you.",
                        "thanks for watching!",
                        "subtitles by amara.org community"
                    ]
                );


            if (
                !clean ||
                noiseTexts.has(clean)
            ) {

                console.log(
                    "🤫 (noise, not speech)"
                );

                voiceState =
                    "LISTENING";

                console.log(
                    "🎧 Listening..."
                );

                return;
            }


            voiceState =
                "PROCESSING";


            console.log(
                "🧠 Processing..."
            );
            let responseText =
                "";

            try {

                const result =
                    await chat.send(
                        conversationId,
                        text.trim()
                    );


                console.log(
                    "[voice] chat result:",
                    result
                );

                 responseText =
                    result.message?.trim();


                if (
                    !responseText
                ) {

                    console.error(
                        "[voice] Chat API returned an empty message"
                    );


                    voiceState =
                        "LISTENING";


                    return;
                }

            } catch (
            error
            ) {

                console.error(
                    "[voice] chat request failed:",
                    error
                );



            }

            speak(
                responseText
            );



        }
    );



const tts = new TTS();
stt.start();

console.log(
    "\nStarting Jarvis...\n"
);


// ============================================================
// PRE-ROLL BUFFER
// ============================================================
//
// VAD needs several speech frames before it declares
// SPEECH_START, so the first ~100-150 ms of an utterance
// would otherwise never reach Whisper. While LISTENING we
// keep a rolling buffer, and flush it into STT the moment
// speech starts.
// ============================================================

const PREROLL_LIMIT_BYTES =
    // 2 seconds of 16 kHz / int16 mono
    16000 * 2 * 2;

const prerollChunks: Buffer[] = [];

let prerollBytes = 0;


function pushPreroll(
    chunk: Buffer
) {

    prerollChunks.push(chunk);

    prerollBytes += chunk.length;


    while (
        prerollBytes > PREROLL_LIMIT_BYTES
    ) {

        const oldest =
            prerollChunks.shift();

        prerollBytes -= oldest!.length;
    }
}


function flushPreroll() {

    const flushedBytes =
        prerollBytes;

    for (
        const chunk of prerollChunks
    ) {

        stt.sendAudio(chunk);
    }

    prerollChunks.length = 0;

    prerollBytes = 0;

    console.log(
        `[voice] flushed ${flushedBytes} pre-roll bytes into STT`
    );
}


// ============================================================
// VAD
// ============================================================

// ============================================================
// VAD
// ============================================================
// ============================================================
// SPEAK
// ============================================================

// macOS keeps playing audio for a short moment after the
// `say` child process exits. If we resume listening
// immediately, the mic hears the tail of our own reply,
// VAD fires on it, and Jarvis starts answering itself.

const SELF_HEARING_COOLDOWN_MS =
    600;


function speak(
    text: string
) {

    voiceState =
        "SPEAKING";


    tts.speak(
        text,
        () => {

            setTimeout(
                () => {

                    voiceState =
                        "LISTENING";

                    console.log(
                        "🎧 Listening..."
                    );
                },
                SELF_HEARING_COOLDOWN_MS
            );
        }
    );
}


vad.start(

    // --------------------------------------------------------
    // SPEECH START
    // --------------------------------------------------------

    () => {

        if (
            voiceState !== "LISTENING"
        ) {
            return;
        }


        console.log(
            "\n🎤 SPEECH START"
        );

        voiceState =
            "USER_SPEAKING";


        // Audio buffered while LISTENING
        // contains the start of this
        // utterance. Send it to Whisper
        // BEFORE the live chunks.

        flushPreroll();
    },


    // --------------------------------------------------------
    // SPEECH END
    // --------------------------------------------------------

    () => {

        if (
            voiceState !== "USER_SPEAKING"
        ) {
            return;
        }


        console.log(
            "🛑 SPEECH END"
        );


        voiceState =
            "PROCESSING";


        console.log(
            "[voice] requesting STT finalization"
        );


        stt.finalize();
    }
);


// ============================================================
// WAKE WORD
// ============================================================

wake.start(
    () => {

        if (
            voiceState !== "SLEEPING"
        ) {
            return;
        }


        console.log(
            "\n🔥 Hey Jarvis detected"
        );

        conversationId =
            createConversationId();

        console.log(
            `[voice] conversation started: ${conversationId}`
        );


        voiceState =
            "LISTENING";

        speak(
            "Yeah?"
        );
        console.log(
            "🎧 Listening..."
        );
    }
);


// ============================================================
// MICROPHONE ROUTER
// ============================================================

microphone.start(
    (chunk: Buffer) => {

        switch (
        voiceState
        ) {

            // -----------------------------------------
            // WAITING FOR "HEY JARVIS"
            // -----------------------------------------

            case "SLEEPING":

                wake.sendAudio(
                    chunk
                );

                break;


            // -----------------------------------------
            // JARVIS IS AWAKE
            // -----------------------------------------

            case "LISTENING":

                // Determine speech boundaries.
                vad.sendAudio(
                    chunk
                );


                // Stash audio so the VAD warm-up
                // delay doesn't clip the start
                // of the utterance.

                pushPreroll(chunk);


                // Stream exactly the same 16 kHz
                // PCM into our persistent Whisper
                // worker.
                // stt.sendAudio(
                //     chunk
                // );


                break;




            case "PROCESSING":

                break;


            case "SPEAKING":

                break;

            case "USER_SPEAKING":

                // Continue feeding VAD so it can detect
                // the end of speech.

                vad.sendAudio(
                    chunk
                );


                // Now that VAD confirmed speech,
                // send audio to Whisper.

                stt.sendAudio(
                    chunk
                );

                break;
        }
    }
);


// ============================================================
// SHUTDOWN
// ============================================================

process.on(
    "SIGINT",
    () => {

        console.log(
            "\nStopping Jarvis..."
        );


        microphone.stop();

        wake.stop();

        vad.stop();


        setTimeout(
            () => process.exit(0),
            300
        );
    }
);