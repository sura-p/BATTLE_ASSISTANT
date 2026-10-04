import * as z from "zod/v4";
import { Game } from "../db/game.model.js";

function escapeRegex(value: string) {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

export const findGameInput = z.object({
    gameTitle: z.string().min(1)
});

export async function findGame(
    {
        gameTitle
    }: z.infer<typeof findGameInput>
) {
    const normalized =
        gameTitle.trim();

   const game= await Game.findOne({
  $or: [{ gameName: { $regex: `^${escapeRegex(normalized)}`, $options: "i" } }, { gameId: { $regex: `^${escapeRegex(normalized)}`, $options: "i" } }]
})
        .select(
            "gameId gameName schemaId platforms category"
        )
        .lean();

    if (!game) {
        return {
            found: false,
            game: null
        };
    }

    return {
        found: true,

        game:game
    };
}
