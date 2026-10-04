import mongoose from "mongoose";

import {
    config
} from "../config.js";

// Lifecycle logging (stderr is safe for an MCP stdio server; stdout carries the protocol)
mongoose.connection.on("connected", () =>
    console.error("[db] MongoDB connected")
);

mongoose.connection.on("error", (error) =>
    console.error("[db] MongoDB error:", error)
);

mongoose.connection.on("disconnected", () =>
    console.error("[db] MongoDB disconnected")
);

export async function connectMongo() {
    if (!config.mongodbUri) {
        throw new Error(
            "MONGODB_URI is missing"
        );
    }

    // Already connected (or connecting) — mongoose caches the connection, so
    // calling this from both a startup hook and the server factory is safe.
    if (
        mongoose.connection.readyState === 1 ||
        mongoose.connection.readyState === 2
    ) {
        return mongoose.connection;
    }

    console.error(
        "[db] connecting to db"
    );

    await mongoose.connect(
        config.mongodbUri
    );

    return mongoose.connection;
}