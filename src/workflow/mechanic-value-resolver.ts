export interface MechanicOption {

    value: unknown;

    label?: string;

    aliases?: string[];
}


export interface ResolveResult {

    resolved: boolean;

    value?: unknown;

    confidence: number;

    matchedBy?:
        | "exact-value"
        | "exact-label"
        | "alias"
        | "normalized";
}

function normalizeText(
    input: unknown
): string {

    return String(
        input ?? ""
    )
        .toLowerCase()

        // Whisper punctuation should not matter.
        .replace(
            /[.,!?;:'"]/g,
            " "
        )

        // Different separators should behave alike.
        .replace(
            /[_-]/g,
            " "
        )

        // Common STT variation.
        .replace(
            /\bverses\b/g,
            "versus"
        )

        .replace(
            /\bverse\b/g,
            "versus"
        )

        .replace(
            /\bvs\.?\b/g,
            "versus"
        )

        .replace(
            /\bv\b/g,
            "versus"
        )

        // Number words.
        .replace(
            /\bone\b/g,
            "1"
        )

        .replace(
            /\btwo\b/g,
            "2"
        )

        .replace(
            /\bthree\b/g,
            "3"
        )

        .replace(
            /\bfour\b/g,
            "4"
        )

        .replace(
            /\bfive\b/g,
            "5"
        )

        .replace(
            /\bsix\b/g,
            "6"
        )

        .replace(
            /\bseven\b/g,
            "7"
        )

        .replace(
            /\beight\b/g,
            "8"
        )

        .replace(
            /\bnine\b/g,
            "9"
        )

        .replace(
            /\bten\b/g,
            "10"
        )

        // Collapse whitespace.
        .replace(
            /\s+/g,
            " "
        )

        .trim();
}

function comparisonKey(
    input: unknown
): string {

    return normalizeText(
        input
    )
        .replace(
            /\s+/g,
            ""
        );
}


export function resolveMechanicValue(
    message: string,
    options: MechanicOption[]
): ResolveResult {

    const inputKey =
        comparisonKey(
            message
        );


    if (!inputKey) {

        return {
            resolved: false,
            confidence: 0
        };
    }


    for (const option of options) {

        // ==========================================
        // CANONICAL VALUE
        // ==========================================

        if (
            inputKey ===
            comparisonKey(
                option.value
            )
        ) {

            return {
                resolved: true,
                value: option.value,
                confidence: 1,
                matchedBy:
                    "exact-value"
            };
        }


        // ==========================================
        // HUMAN LABEL
        // ==========================================

        if (
            option.label
            &&
            inputKey ===
            comparisonKey(
                option.label
            )
        ) {

            return {
                resolved: true,
                value: option.value,
                confidence: 1,
                matchedBy:
                    "exact-label"
            };
        }


        // ==========================================
        // ALIASES
        // ==========================================

        for (
            const alias of
            option.aliases ?? []
        ) {

            if (
                inputKey ===
                comparisonKey(
                    alias
                )
            ) {

                return {
                    resolved: true,
                    value: option.value,
                    confidence: 1,
                    matchedBy:
                        "alias"
                };
            }
        }
    }


    return {
        resolved: false,
        confidence: 0
    };
}

export function getMechanicOptions(
    field: any
): MechanicOption[] {

    if (
        Array.isArray(
            field.options
        )
    ) {

        return field.options.map(
            (option: any) => {

                // Object option:
                //
                // {
                //   value: "1vs1",
                //   label: "1 vs 1"
                // }

                if (
                    option !== null
                    &&
                    typeof option ===
                        "object"
                ) {

                    return {
                        value:
                            option.value,

                        label:
                            option.label,

                        aliases:
                            Array.isArray(
                                option.aliases
                            )
                                ? option.aliases
                                : []
                    };
                }


                // Primitive option:
                //
                // "1vs1"
                //
                // 6
                //
                // true

                return {
                    value: option,
                    label:
                        String(option),
                    aliases: []
                };
            }
        );
    }


    return [];
}