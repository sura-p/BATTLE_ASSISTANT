export type WaitingSource =
    | "common"
    | "mechanic";

export interface WaitingFor {
    source: WaitingSource;
    key: string;
}

export interface EntryFee {
    value: number;
    currency: string;
}

export interface BattleState {
    conversationId: string;

    intent: "create_battle";

    status:
        | "collecting"
        | "ready"
        | "created";

    common: {
        gameTitle: string | null;
        battleTitle: string | null;
        entryFee: EntryFee | null;
        visibility: 0 | 1 | null;
    };

    game: {
        gameId: string | null;
        schemaId: string | null;
    };

    mechanics: Record<string, unknown>;

    waitingFor: WaitingFor | null;
}

export function createBattleState(
    conversationId: string
): BattleState {
    return {
        conversationId,

        intent: "create_battle",

        status: "collecting",

        common: {
            gameTitle: null,
            battleTitle: null,
            entryFee: null,
            visibility: null
        },

        game: {
            gameId: null,
            schemaId: null
        },

        mechanics: {},

        waitingFor: null
    };
}