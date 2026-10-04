import {
    BattleState,
    createBattleState
} from "./state.js";

const conversations =
    new Map<string, BattleState>();

export function getOrCreateState(
    conversationId: string
): BattleState {

    let state =
        conversations.get(
            conversationId
        );

    if (!state) {

        state =
            createBattleState(
                conversationId
            );

        conversations.set(
            conversationId,
            state
        );
    }

    return state;
}

export function saveState(
    state: BattleState
) {
    conversations.set(
        state.conversationId,
        state
    );
}

export function deleteState(
    conversationId: string
) {
    conversations.delete(
        conversationId
    );
}