import {
    distance
} from "fastest-levenshtein";


export function similarity(
    a: string,
    b: string
): number {

    if (
        a === b
    ) {
        return 1;
    }


    const maxLength =
        Math.max(
            a.length,
            b.length
        );


    if (
        maxLength === 0
    ) {
        return 1;
    }


    const d =
        distance(
            a,
            b
        );


    return (
        1 -
        d / maxLength
    );
}