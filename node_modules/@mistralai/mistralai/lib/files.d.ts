/**
 * Consumes a stream and returns a concatenated array buffer. Useful in
 * situations where we need to read the whole file because it forms part of a
 * larger payload containing other fields, and we can't modify the underlying
 * request structure.
 */
export declare function readableStreamToArrayBuffer(readable: ReadableStream<Uint8Array>): Promise<ArrayBuffer>;
//# sourceMappingURL=files.d.ts.map