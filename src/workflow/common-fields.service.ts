import {
    BattleState
} from "./state.js";

import {
    COMMON_FIELDS,
    CommonField
} from "./common-fields.js";


export function getNextCommonField(
    state: BattleState
): CommonField | null {

    for (
        const field of COMMON_FIELDS
    ) {

        const value =
            state.common[field.key];

        if (value == null) {
            return field;
        }
    }

    return null;
}