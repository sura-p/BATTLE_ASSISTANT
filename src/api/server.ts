import express from "express";
import cors from "cors";

import {
    config
} from "../config.js";

import {
    processMessage
} from "../workflow/message.service.js";


const app = express();

app.use(cors());
app.use(express.json());


app.get(
    "/health",
    (_req, res) => {
        res.json({
            ok: true
        });
    }
);


app.post(
    "/chat",
    async (req, res) => {

        try {

            const {
                conversationId,
                message
            } = req.body;


            if (
                !conversationId ||
                !message
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "conversationId and message are required"
                    });
            }


            const result =
                await processMessage(
                    conversationId,
                    message
                );


            return res.json(
                result
            );

        } catch (error) {

            console.log(error);


            return res
                .status(500)
                .json({
                    error:
                        "Internal server error"
                });
        }
    }
);


const PORT =
    Number(
        config.chatApiPort
    );


app.listen(
    PORT,
    () => {

        console.log(
            `Chat API running on port ${PORT}`
        );
    }
);