export declare class SDKError extends Error {
    readonly rawResponse: Response;
    readonly body: string;
    readonly statusCode: number;
    readonly contentType: string;
    constructor(message: string, rawResponse: Response, body?: string);
}
//# sourceMappingURL=sdkerror.d.ts.map