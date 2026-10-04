import mongoose from "mongoose";

const Schema = new mongoose.Schema(
    {},
    {
        strict: false,
        collection: "game_mechanics"
    }
);

export const GameMechanicsSchema =
    mongoose.models.GameMechanicsSchema ||
    mongoose.model(
        "GameMechanicsSchema",
        Schema
    );