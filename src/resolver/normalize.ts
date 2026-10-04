export function normalizeText(
    input: string
): string {

    return input
        .toLowerCase()
        .trim()

        // Remove punctuation
        .replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
        )

        // Collapse whitespace
        .replace(
            /\s+/g,
            " "
        )

        .trim();
}

export function compactText(
    input: string
): string {

    return normalizeText(
        input
    )
        .replace(
            /\s+/g,
            ""
        );
}

const NUMBER_WORDS:
    Record<string, string> = {

        zero: "0",
        one: "1",
        two: "2",
        three: "3",
        four: "4",
        five: "5",
        six: "6",
        seven: "7",
        eight: "8",
        nine: "9",
        ten: "10"
    };


export function normalizeSpeech(
    input: string
): string {

    let text =
        normalizeText(
            input
        );


    // ----------------------------------------
    // spoken numbers
    // ----------------------------------------

    const words =
        text.split(" ");


    text =
        words
            .map(
                word =>
                    NUMBER_WORDS[word]
                    ?? word
            )
            .join(" ");


    // ----------------------------------------
    // versus variations
    // ----------------------------------------

    text =
        text.replace(
            /\bversus\b/g,
            "vs"
        );


    text =
        text.replace(
            /\bverses\b/g,
            "vs"
        );


    text =
        text.replace(
            /\bverse\b/g,
            "vs"
        );


    text =
        text.replace(
            /\bv\b/g,
            "vs"
        );


    return text
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

export function comparisonKey(
    input: string
): string {

    return normalizeSpeech(
        input
    )
        .replace(
            /\s+/g,
            ""
        );
}