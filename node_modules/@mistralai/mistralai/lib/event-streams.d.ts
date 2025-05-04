export type ServerEvent<T> = {
    data?: T | undefined;
    event?: string | undefined;
    retry?: number | undefined;
    id?: string | undefined;
};
export declare class EventStream<Event extends ServerEvent<unknown>> {
    private readonly stream;
    private readonly decoder;
    constructor(init: {
        stream: ReadableStream<Uint8Array>;
        decoder: (rawEvent: ServerEvent<string>) => Event;
    });
    [Symbol.asyncIterator](): AsyncGenerator<Event, void, unknown>;
}
export declare function discardSentinel(stream: ReadableStream<Uint8Array>, sentinel: string): ReadableStream<Uint8Array>;
//# sourceMappingURL=event-streams.d.ts.map