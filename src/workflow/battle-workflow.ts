import {
    BattleState
} from "./state.js";

import {
    getNextCommonField
} from "./common-fields.service.js";

import {
    resolveGame
} from "./game-resolver.service.js";

import {
    getNextMechanic
} from "./mechanics.service.js";

import {
    buildMechanicQuestion
} from "./questions.service.js";


export async function nextStep(
    state: BattleState
) {

    console.log(
        "\n========== NEXT STEP START =========="
    );


    // ==================================================
    // STEP 1: CHECK COMMON FIELDS
    // ==================================================

    console.log(
        "[workflow] checking common fields"
    );

    const commonField =
        getNextCommonField(state);


    console.log(
        "[workflow] next common:",
        commonField?.key ?? "NONE"
    );


    if (commonField) {

        state.waitingFor = {
            source: "common",
            key: commonField.key
        };


        console.log(
            "[workflow] asking common:",
            commonField.key
        );


        return {
            type: "question",
            complete: false,
            field: commonField.key,
            message:
                commonField.question
        };
    }


    console.log(
        "[workflow] all common fields complete"
    );


    // ==================================================
    // STEP 2: RESOLVE GAME
    // ==================================================

    console.log(
        "[workflow] resolving game:",
        state.common.gameTitle
    );


    const gameResolved =
        await resolveGame(state);


    console.log(
        "[workflow] game resolved:",
        gameResolved
    );


    console.log(
        "[workflow] game state:",
        state.game
    );


    if (!gameResolved) {

        console.log(
            "[workflow] game could not be resolved"
        );


        state.common.gameTitle = null;

        state.game.gameId = null;
        state.game.schemaId = null;


        state.waitingFor = {
            source: "common",
            key: "gameTitle"
        };


        return {
            type: "question",
            complete: false,
            field: "gameTitle",

            message:
                "I couldn't find that game. Which game would you like to play?"
        };
    }


    // ==================================================
    // STEP 3: FIND NEXT REQUIRED GAME MECHANIC
    // ==================================================

    console.log(
        "[workflow] looking for next mechanic"
    );


    const mechanic =
        await getNextMechanic(state);


    console.log(
        "[workflow] next mechanic:",
        mechanic?.key ?? "NONE"
    );


    if (mechanic) {

        state.waitingFor = {
            source: "mechanic",
            key: mechanic.key
        };


        const question =
            buildMechanicQuestion(
                mechanic
            );


        console.log(
            "[workflow] asking mechanic:",
            mechanic.key
        );


        console.log(
            "[workflow] question:",
            question
        );


        return {
            type: "question",
            complete: false,
            field: mechanic.key,
            message: question
        };
    }


    // ==================================================
    // STEP 4: EVERYTHING REALLY IS COMPLETE
    // ==================================================

    console.log(
        "[workflow] no required mechanics missing"
    );


    state.status = "ready";
    state.waitingFor = null;


    console.log(
        "========== WORKFLOW READY =========="
    );


    return {
        type: "ready",
        complete: true,

        message:
            "All required battle information has been collected."
    };
}