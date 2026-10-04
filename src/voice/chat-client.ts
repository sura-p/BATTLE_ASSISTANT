export interface ChatRequest {

    conversationId:
        string;

    message:
        string;
}

export class ChatClient {

    constructor(
        private readonly baseUrl:
            string
    ) {}

    async send(
    conversationId: string,
    message: string
): Promise<any> {

    const payload:
        ChatRequest = {

            conversationId,
            message
        };


    console.log(
        "[chat] sending:",
        payload
    );

console.log(`[chat] API URL: ${this.baseUrl}`);

    const response =
        await fetch(
            `${this.baseUrl}/chat`,
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        payload
                    )
            }
        );


    if (
        !response.ok
    ) {

        const body =
            await response.text();


        throw new Error(
            `Chat API returned ${response.status}: ${body}`
        );
    }


    const result =
        await response.json() as any;


    console.log(
        "[chat] received:",
        result
    );


    return result;
}
}