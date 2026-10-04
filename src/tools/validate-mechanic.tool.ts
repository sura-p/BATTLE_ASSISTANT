import * as z from "zod/v4";

import {
    GameMechanicsSchema
} from "../db/game-schema.model.js";

export const validateMechanicInput =
    z.object({
        schemaId: z.string(),
        fieldKey: z.string(),
        value: z.union([
            z.string(),
            z.boolean(),
            z.array(z.string())
        ])
    });

export async function validateMechanic(
    input: z.infer<
        typeof validateMechanicInput
    >
) {
    const schema =
        await GameMechanicsSchema
            .findOne({
                schemaId: input.schemaId
            })
            .lean();

    if (!schema) {
        return {
            valid: false,
            reason: "schema_not_found"
        };
    }

    const field = schema.fields.find(
        (f: any) =>
            f.key === input.fieldKey
    );

    if (!field) {
        return {
            valid: false,
            reason: "field_not_found"
        };
    }

    // Boolean
    if (field.type === "boolean") {
        return {
            valid:
                typeof input.value ===
                "boolean",

            canonicalValue:
                input.value
        };
    }

    // Select
    if (
        field.type === "select" ||
        field.type === "select-card"
    ) {
        const inputValue =
            String(input.value)
                .trim()
                .toLowerCase();

        const option =
            field.options.find(
                (option: any) => {

                    const value =
                        String(
                            option.value
                        ).toLowerCase();

                    const label =
                        String(
                            option.label
                        ).toLowerCase();

                    return (
                        inputValue === value ||
                        inputValue === label
                    );
                }
            );

        if (!option) {
            return {
                valid: false,
                reason:
                    "invalid_option",

                allowed:
                    field.options.map(
                        (o: any) => ({
                            value: o.value,
                            label: o.label
                        })
                    )
            };
        }

        return {
            valid: true,

            canonicalValue:
                option.value
        };
    }

    return {
        valid: true,
        canonicalValue: input.value
    };
}