import {
    config
} from "../config.js";


export interface NerEntity {
    type:
        | "GAME_TITLE"
        | "BATTLE_TITLE"
        | "ENTRY_FEE";

    value: string;
    confidence: number;
}

export interface NerResponse {
    entities: NerEntity[];
}


export async function extractEntities(
    text: string
): Promise<NerResponse> {

    const url =
        config.nerApi;

    if (!url) {
        throw new Error(
            "NER_API is missing"
        );
    }


    const response =
        await fetch(
            `${url}/predict`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        text
                    })
            }
        );



    if (!response.ok) {

        throw new Error(
            `NER service failed: ${response.status}`
        );
    }


    return response.json() as Promise<NerResponse>;
}