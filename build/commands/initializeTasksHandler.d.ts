import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from '../core/types.js';
export declare const InitializeTasksSchema: {
    projectName: z.ZodString;
    projectDescription: z.ZodString;
    filePath: z.ZodString;
};
export declare function initializeTasksHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof InitializeTasksSchema>>): Promise<ToolResultWithNextSteps>;
