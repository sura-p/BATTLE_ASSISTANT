import readline from "node:readline/promises";

import {
    spawn,
    ChildProcess
} from "node:child_process";

import fs from "node:fs";

import mongoose from "mongoose";


import {
    BATTLE_HOME,
    CONFIG_PATH,
    config
} from "../config.js";

import {
    SystemVoice,
    listSystemVoices
} from "../voice/voices.js";


// ============================================================
// WIZARD
// ============================================================
//
// Interactive first-run setup. Collects the external endpoints
// the app cannot guess (MongoDB, NER, ports) and lets the user
// pick a TTS voice profile from the voices actually installed
// on this Mac, with a live preview before confirming.
//
//   npx tsx src/setup/wizard.ts               full setup
//   npx tsx src/setup/wizard.ts --voice-only  just the voice

const DEFAULT_NER_API =
    "http://localhost:8000";

const TEST_SENTENCE =
    "Battle platform installed. This is how I will sound.";

const voiceOnly =
    process.argv.includes("--voice-only");


// All prompts go through this wrapper: if stdin has closed
// (EOF, piped input, non-interactive install), the question
// resolves to the fallback instead of throwing, and the
// wizard continues with saved/default values.

let stdinClosed =
    false;

async function ask(

    rl: readline.Interface,

    prompt: string,

    fallback = ""

): Promise<string> {

    try {

        return await rl.question(prompt);

    } catch {

        stdinClosed =
            true;

        return fallback;
    }
}


// ============================================================
// EXISTING CONFIG — preserved across re-runs
// ============================================================

type ConfigPairs =

    Record<string, string>;


function readExistingConfig():

    ConfigPairs {

    const pairs: ConfigPairs = {};


    if (
        !fs.existsSync(CONFIG_PATH)
    ) {
        return pairs;
    }


    for (
        const rawLine of
        fs.readFileSync(CONFIG_PATH, "utf8").split("\n")
    ) {

        const line =
            rawLine.trim();


        if (
            !line ||
            line.startsWith("#")
        ) {
            continue;
        }


        const equals =
            line.indexOf("=");


        if (
            equals === -1
        ) {
            continue;
        }


        pairs[line.slice(0, equals).trim()] =

            line.slice(equals + 1).trim();
    }

    return pairs;
}


function writeConfig(
    pairs: ConfigPairs
): void {

    fs.mkdirSync(
        BATTLE_HOME,
        { recursive: true }
    );


    const heading = [
        "# Written by battle platform setup wizard — contains credentials",
        "# Perms are 600; do not commit this file anywhere."
    ];

    const lines = [
        ...heading,
        "",
        ...Object.entries(pairs)
            .map(([key, value]) => `${key}=${value}`)
    ];


    fs.writeFileSync(
        CONFIG_PATH,
        lines.join("\n") + "\n",
        { mode: 0o600 }
    );
}


// ============================================================
// MONGODB — validate by connecting
// ============================================================

async function isValidMongo(
    uri: string
): Promise<boolean> {

    try {

        await mongoose.createConnection(
            uri,
            {
                serverSelectionTimeoutMS: 8000
            }
        )

            .asPromise();

        return true;

    } catch {

        return false;

    } finally {

        await mongoose.disconnect().catch(

            () => undefined
        );
    }
}


// ============================================================
// TTS VOICE PROFILE PICKER
// ============================================================
//
// Lists every voice installed on this Mac (via `say -v '?'`).
// English voices show by default; other languages load on
// request so 185 voices do not flood the terminal.
//
//     <n>     select voice n
//     p <n>   preview voice n's own sample line
//     s <n>   preview voice n speaking a real sentence
//     l xx    show only languages containing "xx" (e.g. l ta)
//     a       show all languages again
//     q       keep the current/default voice

let previewProcess:
    ChildProcess | null = null;


function stopPreview() {

    if (
        !previewProcess
    ) {
        return;
    }

    previewProcess.kill("SIGTERM");

    previewProcess = null;
}


function playPreview(
    voiceName: string,
    text: string
): Promise<void> {

    stopPreview();

    return new Promise(
        resolve => {

            previewProcess =
                spawn(
                    "say",
                    ["-v", voiceName, text],
                    { stdio: "ignore" }
                );


            previewProcess.on(
                "close",

                () => {

                    previewProcess = null;

                    resolve();
                }
            );
        }
    );
}


interface NumberedVoice {

    index: number;

    voice: SystemVoice;
}


function renumber(
    grouped: Map<string, SystemVoice[]>
): {

    groups: string[];

    flat: NumberedVoice[];

    offset:
        Record<string, number>;
} {

    const flat: NumberedVoice[] = [];

    const offset: Record<string, number> =
        {};


    let next = 1;

    const ordered =
        [...grouped.entries()]


            // English variants first, then everything else
            // alphabetically.

            .sort(
                (a, b) => {

                    const aEn =
                        a[0].startsWith("en") ? 0 : 1;

                    const bEn =
                        b[0].startsWith("en") ? 0 : 1;

                    return aEn !== bEn
                        ? aEn - bEn
                        : a[0].localeCompare(b[0]);
                }
            );


    for (
        const [language, voices] of ordered
    ) {

        offset[language] =
            next;

        for (
            const voice of voices
        ) {

            flat.push({
                index: next,
                voice
            });

            next++;
        }
    }


    return {
        groups: ordered.map(([language]) => language),
        flat,
        offset
    };
}


async function pickVoice(

    rl: readline.Interface

): Promise<{ voice: string; rate: number }> {

    console.log(
        "\n=== TTS VOICE PROFILE ==="
    );

    console.log(
        "Loading voices installed on this Mac..."
    );


    const all =
        await listSystemVoices();

    const byLanguage =
        new Map<string, SystemVoice[]>();


    for (
        const voice of all
    ) {

        const list =
            byLanguage.get(voice.language) ?? [];

        list.push(voice);

        byLanguage.set(
            voice.language,
            list
        );
    }


    // What is currently on screen — a subset of languages.

    let shown =
        new Map<string, SystemVoice[]>();


    let view =
        renumber(byLanguage);


    // Default view: English variants only.

    for (
        const [language, voices] of byLanguage
    ) {

        if (language.startsWith("en")) {

            shown.set(
                language,
                voices
            );
        }
    }


    view =
        renumber(shown);

    let selected:
        string | null = null;


    while (
        !selected
    ) {

        // ---- render ----

        console.log("");

        for (
            const language of view.groups
        ) {

            const start =
                view.offset[language];

            const count =
                shown.get(language)!.length;


            console.log(
                `  ${language}  —  voices ${start}–${start + count - 1}`
            );

            for (
                const voice of shown.get(language)!
            ) {

                const entry =
                    `  ${String(view.offset[language] + shown.get(language)!.indexOf(voice)).padStart(3)} )  ${voice.name}`;

                console.log(entry);
            }
        }


        console.log(
            "\n  <n> select | p <n> preview | s <n> preview sentence | l <xx> language filter | a all languages | q keep current"
        );

        const answer =
            await ask(
                rl,
                `\n  Choose [current: ${config.ttsVoice}]: `
            );


        stopPreview();

        const words =
            answer.trim().split(/\s+/);

        const command =
            (words[0] ?? "").toLowerCase();


        // ---- q / enter — keep current ----

        if (
            command === "q" ||
            answer.trim() === ""
        ) {

            selected =
                config.ttsVoice;

            break;
        }


        // ---- language filter ----

        if (
            command === "l"
        ) {

            const filter =
                (words[1] ?? "")

                    .toLowerCase();

            const matches =
                [...byLanguage.entries()]

                    .filter(([language]) =>
                        language.toLowerCase().includes(filter)
                    );


            if (
                !matches.length
            ) {

                console.log(
                    `  No languages match "${filter}". Try e.g. l en, l ta, l de`
                );

                continue;
            }


            shown =
                new Map(matches);

            view =
                renumber(shown);

            continue;
        }


        // ---- all languages ----

        if (
            command === "a"
        ) {

            shown =
                new Map(byLanguage);

            view =
                renumber(shown);

            continue;
        }


        // ---- preview ----

        if (
            command === "p" ||
            command === "s"
        ) {

            const target =
                Number(words[1]);

            const voice =
                view.flat.find(
                    e => e.index === target
                )?.voice;


            if (
                !voice
            ) {

                console.log(
                    "  Give a voice number too, e.g. `p 12`."
                );

                continue;
            }


            console.log(
                `  ▶ ${voice.name} (${voice.language})...`
            );

            await playPreview(

                voice.name,

                command === "p"
                    ? voice.sample
                    : TEST_SENTENCE
            );

            continue;
        }


        // ---- plain number = select ----

        const target =
            Number(words[0]);


        const voice =
            view.flat.find(
                e => e.index === target
            )?.voice;


        if (
            voice
        ) {

            selected =
                voice.name;

            break;
        }


        console.log(
            "  Didn't understand — number, p <n>, s <n>, l <xx>, a or q."
        );
    }


    stopPreview();


    // ---- speaking rate ----

    let rate =
        config.ttsRate;


    while (true) {

        const answer =
            await ask(
                rl,
                `\n  Speaking rate, words per minute [${rate}]: `
            );


        if (
            !answer.trim()
        ) {
            break;
        }


        const parsed =
            Number(answer);

        if (
            parsed >= 80 &&
            parsed <= 300
        ) {

            rate =
                parsed;

            break;
        }

        console.log(
            "  Enter 80–300."
        );
    }


    // ---- confirm by speaking ----

    console.log(
        `\n  ▶ This is "${selected}" at ${rate} wpm:`
    );

    await playPreview(
        selected,
        TEST_SENTENCE
    );


    return {
        voice: selected,
        rate
    };
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    console.log(
        "\n=== BATTLE PLATFORM SETUP ==="
    );

    console.log(
        `Config file: ${CONFIG_PATH}`
    );

    const saved =
        readExistingConfig();


    let pairs:
        ConfigPairs = { ...saved };

    const rl =
        readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });


    // --------------------------------------------------------
    // VOICE-ONLY MODE (`battle voice`)
    // --------------------------------------------------------

    if (voiceOnly) {

        const { voice, rate } =
            await pickVoice(rl);

        rl.close();

        pairs["TTS_VOICE"] =
            voice;

        pairs["TTS_RATE"] =
            String(rate);

        writeConfig(pairs);

        console.log(
            `\n✅ Voice set to "${voice}" at ${rate} wpm → ${CONFIG_PATH}`
        );

        return;
    }


    // --------------------------------------------------------
    // 1. MONGODB
    // --------------------------------------------------------

    console.log(
        "\n=== MONGODB CONNECTION ==="
    );

    while (true) {

        const answer =
            await ask(
                rl,
                `\nMongoDB URI (mongodb:// or mongodb+srv://) ${saved["MONGODB_URI"] ? "[enter = keep saved]" : ": "}`
            );

        const uri =
            answer.trim() || saved["MONGODB_URI"];


        if (
            !uri
        ) {

            if (stdinClosed) {

                throw new Error(
                    "input ended before setup finished — run `battle setup` in an interactive terminal"
                );
            }

            console.log(
                "A MongoDB URI is required."
            );

            continue;
        }


        if (
            !/^mongodb(\+srv)?:\/\//.test(uri)
        ) {

            console.log(
                "That doesn't look like a MongoDB URI."
            );

            continue;
        }


        console.log(
            "  Testing connection (8s max)..."
        );

        if (
            await isValidMongo(uri)
        ) {

            console.log(
                "  ✓ connected"
            );
        } else {

            const retry =
                await ask(
                    rl,
                    "  Could not connect — save anyway? (y/n): ",
                    "y"
                );

            if (
                retry.trim().toLowerCase() !== "y"
            ) {
                continue;
            }

            console.log(
                "  URI saved without verification."
            );
        }


        pairs["MONGODB_URI"] =
            uri;

        break;
    }


    // --------------------------------------------------------
    // 2. NER API
    // --------------------------------------------------------

    console.log(
        "\n=== NER SERVICE ==="
    );

    while (true) {

        const answer =
            await ask(
                rl,
                `\nNER API URL [${saved["NER_API"] || DEFAULT_NER_API}]: `
            );

        const url =
            answer.trim() || saved["NER_API"] || DEFAULT_NER_API;


        if (
            /^https?:\/\//.test(url)
        ) {

            pairs["NER_API"] =
                url;

            break;
        }

        console.log(
            "Enter an http:// or https:// URL."
        );
    }


    // --------------------------------------------------------
    // 3. CHAT API PORT (+ derived URL)
    // --------------------------------------------------------

    console.log(
        "\n=== CHAT API ==="
    );

    while (true) {

        const answer =
            await ask(
                rl,
                `\nLocal API port [${saved["PORT"] || "3000"}]: `
            );

        const chosen =
            answer.trim() || saved["PORT"] || "3000";


        if (
            /^\d+$/.test(chosen) &&
            Number(chosen) > 1024 &&
            Number(chosen) < 65536
        ) {

            pairs["PORT"] =
                chosen;

            pairs["CHAT_API_URL"] =
                `http://127.0.0.1:${chosen}`;

            break;
        }

        console.log(
            "Enter a port between 1025 and 65535."
        );
    }


    // --------------------------------------------------------
    // 4. TTS VOICE PROFILE
    // --------------------------------------------------------

    const { voice, rate } =
        await pickVoice(rl);

    rl.close();

    pairs["TTS_VOICE"] =
        voice;

    pairs["TTS_RATE"] =
        String(rate);


    // --------------------------------------------------------
    // WRITE
    // --------------------------------------------------------

    writeConfig(pairs);

    console.log(
        `\n✅ Setup complete → ${CONFIG_PATH}`
    );

    console.log(
        "\nNext steps:"
    );

    console.log(
        "  • battle doctor   verify every component"
    );

    console.log(
        "  • battle start    run the chat API in the background"
    );

    console.log(
        "  • battle mcp      register the MCP server with Claude"
    );
}


main().catch(error => {

    console.error(
        "setup failed:",
        error
    );

    process.exit(1);
});