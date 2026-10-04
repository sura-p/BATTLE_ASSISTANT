import {
    callTool
} from "./mcp/client.js";


const game =
    await callTool(
        "find_game",
        {
            gameTitle: "FIFA26"
        }
    );


console.log(game);