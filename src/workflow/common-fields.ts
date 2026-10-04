export interface CommonField {
    key:
        | "gameTitle"
        | "battleTitle"
        | "entryFee"
        | "visibility"
        ;

    question: string;
}

export const COMMON_FIELDS:
    CommonField[] = [

    {
        key: "gameTitle",
        question:
            "Which game would you like to play?"
    },

    {
        key: "battleTitle",
        question:
            "What would you like to name your battle?"
    },

    {
        key: "entryFee",
        question:
            "What should the entry fee be?"
    },
    {
        key: "visibility",
        question: "what should the visibility of the battle be: Public or Private?"
    }

];