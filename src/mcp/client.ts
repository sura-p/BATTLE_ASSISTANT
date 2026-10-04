import path from "node:path";

import {
    Client
} from "@modelcontextprotocol/client";

import {
    StdioClientTransport
} from "@modelcontextprotocol/client/stdio";

import {
    APP_DIR
} from "../config.js";


let client: Client | null = null;


export async function getMcpClient() {

    if (client) {
        return client;
    }

    const created =
        new Client({
            name: "battle-chat",
            version: "1.0.0"
        });


    // Never spawn through "npx": the chat API may run from a
    // LaunchAgent, whose PATH has no node on it (spawn npx
    // ENOENT). process.execPath is this server's own absolute
    // node binary, which always exists and can always run tsx.

    const transport =
        new StdioClientTransport({
            command:
                process.execPath,

            args: [
                path.join(
                    APP_DIR,
                    "node_modules",
                    "tsx",
                    "dist",
                    "cli.mjs"
                ),

                path.join(
                    APP_DIR,
                    "src",
                    "mcp",
                    "server.ts"
                )
            ],

            cwd:
                APP_DIR
        });


    // If the child dies later, drop the singleton so the next
    // request spawns a fresh server instead of failing forever.

    created.onclose = () => {
        client = null;
    };


    try {

        await created.connect(
            transport
        );

    } catch (error) {

        // Do not cache a client that never connected — otherwise
        // every later callTool fails with "Not connected" and
        // the original spawn error is lost.

        client = null;

        throw error;
    }


    client = created;

    return client;
}

export async function callTool(
    name: string,
    args: Record<string, unknown>
) {

    const client =
        await getMcpClient();

    const response =
        await client.callTool({
            name,
            arguments: args
        });

    if (response.isError) {
        throw new Error(
            `MCP tool ${name} failed`
        );
    }

    if (response.structuredContent) {
        return response.structuredContent;
    }

    const text =
        response.content.find(
            (item: any) =>
                item.type === "text"
        );

    if (!text) {
        throw new Error(
            `No result from ${name}`
        );
    }

    return JSON.parse(
        (text as any).text
    );
}