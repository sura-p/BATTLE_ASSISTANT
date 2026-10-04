import {
    McpServer
} from "@modelcontextprotocol/server";

import {
    serveStdio
} from "@modelcontextprotocol/server/stdio";

import {
    connectMongo
} from "../db/mongo.js";

import {
    findGame,
    findGameInput
} from "../tools/find-game.tool.js";

import {
    getGameSchema,
    getGameSchemaInput
} from "../tools/get-game-schema.tool.js";

import {
    validateMechanic,
    validateMechanicInput
} from "../tools/validate-mechanic.tool.js";


function result(data: unknown) {
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(data)
            }
        ],

        structuredContent:
            data as Record<string, unknown>
    };
}


async function createServer() {

    await connectMongo();

    console.error(
        "[mcp] register tools: find_game, get_game_schema, validate_mechanic"
    );

    const server =
        new McpServer({
            name: "battle-platform",
            version: "1.0.0"
        });


    // ---------------------------
    // FIND GAME
    // ---------------------------

    server.registerTool(
        "find_game",
        {
            description:
                "Find a supported game by its user-provided title.",

            inputSchema:
                findGameInput
        },

        async input => {
            const data =
                await findGame(input);

            return result(data);
        }
    );


    // ---------------------------
    // GET GAME SCHEMA
    // ---------------------------

    server.registerTool(
        "get_game_schema",
        {
            description:
                "Get the mechanics schema for a game.",

            inputSchema:
                getGameSchemaInput
        },

        async input => {
            const data =
                await getGameSchema(input);

            return result(data);
        }
    );


    // ---------------------------
    // VALIDATE MECHANIC
    // ---------------------------

    server.registerTool(
        "validate_mechanic",
        {
            description:
                "Validate a battle mechanic value against the game's MongoDB schema.",

            inputSchema:
                validateMechanicInput
        },

        async input => {
            const data =
                await validateMechanic(
                    input
                );

            return result(data);
        }
    );


    return server;
}


// Connect to the DB eagerly so the connection status is visible in the
// terminal even before a client attaches — serveStdio runs the factory
// lazily, only on the first client `initialize` request.
connectMongo().catch((error) => {
    console.error(
        "[db] MongoDB connection failed:",
        error.message
    );
});

void serveStdio(
    createServer,
    {
        onerror: (error) =>
            console.error(
                "[mcp] stdio error:",
                error
            )
    }
);

console.error(
    "Battle MCP server running"
);