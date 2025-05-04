import * as z from "zod";
export declare function bytesToBase64(u8arr: Uint8Array): string;
export declare function bytesFromBase64(encoded: string): Uint8Array;
export declare function stringToBytes(str: string): Uint8Array;
export declare function stringFromBytes(u8arr: Uint8Array): string;
export declare function stringToBase64(str: string): string;
export declare function stringFromBase64(b64str: string): string;
export declare const zodOutbound: z.ZodUnion<[z.ZodType<Uint8Array, z.ZodTypeDef, Uint8Array>, z.ZodEffects<z.ZodString, Uint8Array, string>]>;
export declare const zodInbound: z.ZodUnion<[z.ZodType<Uint8Array, z.ZodTypeDef, Uint8Array>, z.ZodEffects<z.ZodString, Uint8Array, string>]>;
//# sourceMappingURL=base64.d.ts.map