import {
    EntryFee
} from "./state.js";


export function parseEntryFee(
    text: string
): EntryFee | null {
console.log("Parsing entry fee:", text);
    const normalized =
        text.trim().toLowerCase();


    let currency:
        string | null = null;


    if (
        normalized.includes("$") ||
        normalized.includes("dollar") ||
        normalized.includes("buck")
    ) {
        currency = "USD";
    }


    if (
        normalized.includes("₹") ||
        normalized.includes("inr") ||
        normalized.includes("rupee")
    ) {
        currency = "INR";
    }


    const match =
        normalized.match(
            /(\d+(?:\.\d+)?)/
        );


    if (!match) {
        return null;
    }


    const value =
        Number(match[1]);


    if (
        Number.isNaN(value) ||
        value < 0
    ) {
        return null;
    }


    return {
        value,
        currency:
            currency ?? "USD"
    };
}