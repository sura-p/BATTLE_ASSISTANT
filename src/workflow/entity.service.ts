import {
    BattleState
} from "./state.js";

import {
    NerEntity
} from "../services/ner.service.js";

import {
    parseEntryFee
} from "./money.parser.js";


export function applyEntities(
    state: BattleState,
    entities: any
) {

    console.log(
        "Applying entities:",
        entities
    );
    for (const entity of entities) {

        // Ignore weak predictions
        if (
            entity.confidence < 0.67
        ) {
            continue;
        }


        switch (entity.entity_group) {

            case "GAME_TITLE":

                state.common.gameTitle =
                    entity.word;

                break;


            case "BATTLE_TITLE":

                state.common.battleTitle =
                    entity.word;

                break;


            case "ENTRY_FEE": {

                const fee =
                    parseEntryFee(
                        entity.word
                    );

                if (fee) {
                    state.common.entryFee =
                        fee;
                }

                break;
            }
        }
    }
}