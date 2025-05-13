import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const GenerateDiffSchema: {
    filePath: z.ZodString;
    changeDescription: z.ZodString;
    startLine: z.ZodOptional<z.ZodNumber>;
    endLine: z.ZodOptional<z.ZodNumber>;
};
declare const generateDiffSchemaObject: z.ZodObject<{
    filePath: z.ZodString;
    changeDescription: z.ZodString;
    startLine: z.ZodOptional<z.ZodNumber>;
    endLine: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    filePath: string;
    changeDescription: string;
    startLine?: number | undefined;
    endLine?: number | undefined;
}, {
    filePath: string;
    changeDescription: string;
    startLine?: number | undefined;
    endLine?: number | undefined;
}>;
export type GenerateDiffParams = z.infer<typeof generateDiffSchemaObject>;
export declare function generateDiffHandler(taskManager: TaskManager, params: GenerateDiffParams): Promise<ToolResultWithNextSteps>;
export {};
