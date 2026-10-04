import mongoose from "mongoose";

const GameSchema = new mongoose.Schema(
    {},
    {
        strict: false,
        collection: "games_catalog"
    }
);

export const Game =
    mongoose.models.Game ||
    mongoose.model(
        "Game",
        GameSchema
    );