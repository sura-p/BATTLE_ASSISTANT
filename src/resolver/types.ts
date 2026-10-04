export type ResolutionStatus =
    | "resolved"
    | "ambiguous"
    | "unknown";


export interface ResolverOption {

    /**
     * Exact canonical value from the game schema.
     *
     * NEVER modify this.
     */
    value: unknown;


    /**
     * Human-readable representation.
     */
    label: string;
}


export interface ResolutionResult {

    status: ResolutionStatus;

    value?: unknown;

    confidence: number;

    interpretedAs?: string;

    candidates?: Array<{
        value: unknown;
        label: string;
        confidence: number;
    }>;
}