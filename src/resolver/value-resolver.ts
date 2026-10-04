import type {
    ResolverOption
} from "./types.js";


export function buildOptions(
    values: unknown[]
): ResolverOption[] {

    return values.map(
        value => ({
            value,
            label:
                valueToLabel(
                    value
                )
        })
    );
}




export function valueToLabel(
    value: unknown
): string {

    if (
        typeof value === "string"
    ) {

        return value
            .replace(
                /_/g,
                " "
            )
            .replace(
                /-/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }


    if (
        typeof value === "number"
    ) {

        return String(
            value
        );
    }


    if (
        typeof value === "boolean"
    ) {

        return value
            ? "yes"
            : "no";
    }


    return String(
        value
    );
}

