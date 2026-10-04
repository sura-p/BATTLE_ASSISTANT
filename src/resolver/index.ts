import {
    buildOptions
} from "./value-resolver.js";

import {
    resolveEnum
} from "./enum-resolver.js";

import type {
    ResolutionResult
} from "./types.js";


export function resolveSchemaValue(
    input: string,
    allowedValues: unknown[]
): ResolutionResult {

    const options =
        buildOptions(
            allowedValues
        );


    return resolveEnum(
        input,
        options
    );
}