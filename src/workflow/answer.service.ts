import {
    BattleState
} from "./state.js";

import {
    parseEntryFee
} from "./money.parser.js";

import {
    callTool
} from "../mcp/client.js";

import {
    getGameFields
} from "./mechanics.service.js";

import {
    getMechanicOptions,
    resolveMechanicValue
} from "./mechanic-value-resolver.js";

async function processCommonAnswer(
    state: BattleState,
    key: string,
    message: string
) {

    switch (key) {

        case "gameTitle":

            state.common.gameTitle =
                message.trim()
                .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]/gu, "");

            // Game changed, therefore
            // old resolved game must disappear.

            state.game.gameId = null;
            state.game.schemaId = null;

            return {
                valid: true
            };


        case "battleTitle":

            if (!message.trim()) {
                return {
                    valid: false,
                    message:
                        "Please provide a battle title."
                };
            }

            state.common.battleTitle =
                message.trim();

            return {
                valid: true
            };


        case "entryFee": {

            const fee =
                parseEntryFee(message);


            if (!fee) {

                return {
                    valid: false,
                    message:
                        "Please provide a valid entry fee, for example $10 or 500 INR."
                };
            }


            state.common.entryFee =
                fee;


            return {
                valid: true
            };
        }

        case "visibility": {

            const normalized =
                message
                    .trim()
                    .toLowerCase()
                    .replace(/[.,!?;:]+$/g, "")
                    .trim();


            if (normalized === "public") {
                state.common.visibility = 0;
            } else if (normalized === "private") {
                state.common.visibility = 1;
            } else {
                return {
                    valid: false,
                    message:
                        "Please specify either 'Public' or 'Private'."
                };
            }

            return {
                valid: true
            };
        }

          
        

        default:

            return {
                valid: false,
                message:
                    "Unknown field."
            };
    }
}

async function processMechanicAnswer(
    state: BattleState,
    fieldKey: string,
    message: string
) {

    if (!state.game.schemaId) {

        return {
            valid: false,
            message:
                "Game schema is not available."
        };
    }


    const fields =
        await getGameFields(state);


    const field =
        fields.find(
            field =>
                field.key === fieldKey
        );


    if (!field) {

        return {
            valid: false,
            message:
                `Unknown mechanic: ${fieldKey}`
        };
    }

console.log(
    "\n========== CURRENT MECHANIC FIELD =========="
);

console.dir(
    field,
    {
        depth: null
    }
);
    // Boolean needs local conversion first.

    let value:
         unknown = message;


    if (field.type === "boolean") {

        const normalized =
            message
                .trim()
            .toLowerCase()
            .replace(
                /[.,!?;:]+$/g,
                ""
            )
            .trim();


        if (
            [
                "yes",
                "y",
                "true",
                "on"
            ].includes(normalized)
        ) {
            value = true;
        }

        else if (
            [
                "no",
                "n",
                "false",
                "off"
            ].includes(normalized)
        ) {
            value = false;
        }

        else {

            return {
                valid: false,
                message:
                    `${field.label} requires a yes or no answer.`
            };
        }
    }else {

    const options =
        getMechanicOptions(
            field
        );


    if (
        options.length > 0
    ) {

        const resolution =
            resolveMechanicValue(
                message,
                options
            );


        console.log(
            "[mechanic-resolver]",
            {
                fieldKey,
                message,
                resolution
            }
        );


        if (
            resolution.resolved
        ) {

            value =
                resolution.value;
        }
    }
}


    const validation: any =
        await callTool(
            "validate_mechanic",
            {
                schemaId:
                    state.game.schemaId,

                fieldKey,

                value
            }
        );


    if (!validation.valid) {

        const allowed =
            validation.allowed
                ?.map(
                    (option: any) =>
                        option.label
                )
                .join(", ");


        return {
            valid: false,

            message:
                allowed
                    ? `Please choose: ${allowed}.`
                    : `Please provide a valid ${field.label}.`
        };
    }


    state.mechanics[fieldKey] =
        validation.canonicalValue;


    return {
        valid: true
    };
}

export async function processAnswer(
    state: BattleState,
    message: string
) {

    const waiting =
        state.waitingFor;


    if (!waiting) {

        return {
            valid: false,
            message:
                "The workflow is not waiting for an answer."
        };
    }


    if (
        waiting.source === "common"
    ) {

        return processCommonAnswer(
            state,
            waiting.key,
            message
        );
    }


    if (
        waiting.source === "mechanic"
    ) {

        return processMechanicAnswer(
            state,
            waiting.key,
            message
        );
    }


    return {
        valid: false,
        message:
            "Unknown workflow state."
    };
}