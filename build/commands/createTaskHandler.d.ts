import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const CreateTaskSchema: {
    title: z.ZodString;
    description: z.ZodString;
    additionalContext: z.ZodOptional<z.ZodString>;
};
declare const createTaskSchemaObject: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    additionalContext: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    title: string;
    additionalContext?: string | undefined;
}, {
    description: string;
    title: string;
    additionalContext?: string | undefined;
}>;
export type CreateTaskParams = z.infer<typeof createTaskSchemaObject>;
export declare function createTaskHandler(taskManager: TaskManager, params: CreateTaskParams): Promise<ToolResultWithNextSteps>;
export {};
