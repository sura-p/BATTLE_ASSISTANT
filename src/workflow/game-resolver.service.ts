import {
    BattleState
} from "./state.js";

import {
    callTool
} from "../mcp/client.js";


export async function resolveGame(
    state: BattleState
): Promise<boolean> {

    console.log(
        "[resolveGame] START"
    );


    // Already resolved

    if (
        state.game.gameId &&
        state.game.schemaId
    ) {

        console.log(
            "[resolveGame] already resolved:",
            state.game
        );

        return true;
    }


    // No game title

    if (!state.common.gameTitle) {

        console.log(
            "[resolveGame] no gameTitle"
        );

        return false;
    }


    console.log(
        "[resolveGame] calling find_game:",
        state.common.gameTitle
    );


    const result: any =
        await callTool(
            "find_game",
            {
                gameTitle:
                    state.common.gameTitle
            }
        );


    console.log(
        "[resolveGame] MCP RESPONSE:"
    );

    console.dir(
        result,
        {
            depth: null
        }
    );


    if (
        !result ||
        result.found !== true ||
        !result.game
    ) {

        console.log(
            "[resolveGame] game NOT found"
        );

        return false;
    }


    if (
        !result.game.gameId ||
        !result.game.schemaId
    ) {

        console.log(
            "[resolveGame] game missing gameId/schemaId"
        );

        return false;
    }


    state.game.gameId =
        result.game.gameId;

    state.game.schemaId =
        result.game.schemaId;


    console.log(
        "[resolveGame] SUCCESS:",
        state.game
    );


    return true;
}