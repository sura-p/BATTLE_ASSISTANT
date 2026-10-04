import {
    getOrCreateState,
    saveState
} from "./session.store.js";

import {
    extractEntities
} from "../services/ner.service.js";

import {
    applyEntities
} from "./entity.service.js";

import {
    processAnswer
} from "./answer.service.js";

import {
    nextStep
} from "./battle-workflow.js";

export async function processMessage(
    conversationId: string,
    message: string
) {

    const state =
        getOrCreateState(
            conversationId
        );


    // ====================================
    // CASE 1
    // Already waiting for something
    // ====================================

    if (state.waitingFor) {

        const result =
            await processAnswer(
                state,
                message
            );


        if (!result.valid) {

            saveState(state);

            return {
                message:
                    result.message,

                state
            };
        }


        // Valid answer.
        state.waitingFor = null;


        const next =
            await nextStep(state);


        saveState(state);


        return {
            ...next,
            state
        };
    }


    // ====================================
    // CASE 2
    // Initial free-form message
    // ====================================

    const ner =
        await extractEntities(
            message
        );

console.log(
    "========== NER RESULT =========="
);

console.dir(
    ner,
    { depth: null }
);

    applyEntities(
        state,
        ner.entities
    );

console.log(
    "========== STATE AFTER NER =========="
);

console.dir(
    state,
    { depth: null }
);
    const next =
        await nextStep(state);
console.log(
    "========== NEXT STEP =========="
);

console.dir(
    next,
    { depth: null }
);


    saveState(state);


    return {
        ...next,
        state
    };
}