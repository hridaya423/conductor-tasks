import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const ProposeDiffSchema: {
    filePath: z.ZodString;
    diffContent: z.ZodString;
    originalHash: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
};
declare const proposeDiffSchemaObject: z.ZodObject<{
    filePath: z.ZodString;
    diffContent: z.ZodString;
    originalHash: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    filePath: string;
    diffContent: string;
    description?: string | undefined;
    originalHash?: string | undefined;
}, {
    filePath: string;
    diffContent: string;
    description?: string | undefined;
    originalHash?: string | undefined;
}>;
export type ProposeDiffParams = z.infer<typeof proposeDiffSchemaObject>;
export declare function proposeDiffHandler(taskManager: TaskManager, params: ProposeDiffParams): Promise<ToolResultWithNextSteps>;
export {};
