import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const GetTaskTemplateSchema: {
    templateName: z.ZodString;
};
declare const getTaskTemplateSchemaObject: z.ZodObject<{
    templateName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    templateName: string;
}, {
    templateName: string;
}>;
export type GetTaskTemplateParams = z.infer<typeof getTaskTemplateSchemaObject>;
export declare function getTaskTemplateHandler(taskManager: TaskManager, params: GetTaskTemplateParams): Promise<ToolResultWithNextSteps>;
export {};
