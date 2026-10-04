import * as z from "zod/v4";

import {
    GameMechanicsSchema
} from "../db/game-schema.model.js";

export const getGameSchemaInput =
    z.object({
        schemaId: z.string().min(1)
    });

export async function getGameSchema(
    {
        schemaId
    }: z.infer<typeof getGameSchemaInput>
) {
    const schema =
        await GameMechanicsSchema
            .findOne({
                schemaId: schemaId
            })
            .lean();

    if (!schema) {
        return {
            found: false,
            schema: null
        };
    }

    return {
        found: true,

        schema: schema
    };
}