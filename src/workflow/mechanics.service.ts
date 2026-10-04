import {
    BattleState
} from "./state.js";

import {
    callTool
} from "../mcp/client.js";


export interface MechanicOption {
    value: string;
    label: string;
    image?: string;
}


export interface MechanicField {
    key: string;
    label: string;
    type: string;
    required: boolean;
    options?: MechanicOption[];
}


export async function getGameFields(
    state: BattleState
): Promise<MechanicField[]> {

    console.log(
        "[mechanics] getGameFields START"
    );


    console.log(
        "[mechanics] schemaId:",
        state.game.schemaId
    );


    if (!state.game.schemaId) {

        throw new Error(
            "Cannot load mechanics: schemaId is missing"
        );
    }


    console.log(
        "[mechanics] calling get_game_schema"
    );


    const result: any =
        await callTool(
            "get_game_schema",
            {
                schemaId:
                    state.game.schemaId
            }
        );


    console.log(
        "[mechanics] MCP RESPONSE:"
    );

    console.dir(
        result,
        {
            depth: null
        }
    );


    if (
        !result ||
        result.found !== true
    ) {

        throw new Error(
            `Game schema not found: ${state.game.schemaId}`
        );
    }


    if (
        !result.schema ||
        !Array.isArray(
            result.schema.fields
        )
    ) {

        throw new Error(
            "Invalid game schema response: fields[] missing"
        );
    }


    console.log(
        "[mechanics] fields loaded:",
        result.schema.fields.length
    );


    return result.schema.fields;
}


export async function getNextMechanic(
    state: BattleState
): Promise<MechanicField | null> {

    console.log(
        "[mechanics] getNextMechanic START"
    );


    const fields =
        await getGameFields(state);


    console.log(
        "[mechanics] checking fields..."
    );


    for (const field of fields) {

        const current =
            state.mechanics[
                field.key
            ];


        console.log(
            `[mechanics] ${field.key}`,
            "| required:",
            field.required,
            "| current:",
            current
        );


        if (field.required !== true) {
            continue;
        }


        if (
            current === undefined ||
            current === null
        ) {

            console.log(
                "[mechanics] FOUND missing:",
                field.key
            );


            return field;
        }
    }


    console.log(
        "[mechanics] no required mechanics missing"
    );


    return null;
}