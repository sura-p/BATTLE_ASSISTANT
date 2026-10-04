import {
    comparisonKey
} from "./normalize.js";

import {
    similarity
} from "./similarity.js";

import type {
    ResolutionResult,
    ResolverOption
} from "./types.js";


export function resolveEnum(
    input: string,
    options: ResolverOption[]
): ResolutionResult {

    const inputKey =
        comparisonKey(
            input
        );


    const candidates =
        options
            .map(
                option => {

                    const valueKey =
                        comparisonKey(
                            String(
                                option.value
                            )
                        );


                    const labelKey =
                        comparisonKey(
                            option.label
                        );


                    const score =
                        Math.max(
                            similarity(
                                inputKey,
                                valueKey
                            ),

                            similarity(
                                inputKey,
                                labelKey
                            )
                        );


                    return {
                        value:
                            option.value,

                        label:
                            option.label,

                        confidence:
                            score
                    };
                }
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    b.confidence -
                    a.confidence
            );


    const best =
        candidates[0];


    const second =
        candidates[1];


    if (
        !best
    ) {

        return {
            status: "unknown",
            confidence: 0
        };
    }


    // Very strong match
    if (
        best.confidence >= 0.90
    ) {

        return {
            status: "resolved",

            value:
                best.value,

            confidence:
                best.confidence,

            interpretedAs:
                best.label,

            candidates
        };
    }


    // Decent score but two choices are
    // too close together.
    if (
        second
        &&
        best.confidence >= 0.65
        &&
        (
            best.confidence -
            second.confidence
        ) < 0.15
    ) {

        return {
            status: "ambiguous",
            confidence:
                best.confidence,
            candidates
        };
    }


    return {
        status: "unknown",
        confidence:
            best.confidence,
        candidates
    };
}