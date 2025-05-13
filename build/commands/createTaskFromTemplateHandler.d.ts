import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const CreateTaskFromTemplateSchema: {
    templateName: z.ZodString;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    parentId: z.ZodOptional<z.ZodString>;
};
declare const createTaskFromTemplateSchemaObject: z.ZodObject<{
    templateName: z.ZodString;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    parentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    templateName: string;
    variables?: Record<string, string> | undefined;
    parentId?: string | undefined;
}, {
    templateName: string;
    variables?: Record<string, string> | undefined;
    parentId?: string | undefined;
}>;
export type CreateTaskFromTemplateParams = z.infer<typeof createTaskFromTemplateSchemaObject>;
export declare function createTaskFromTemplateHandler(taskManager: TaskManager, params: CreateTaskFromTemplateParams): Promise<ToolResultWithNextSteps>;
export {};
