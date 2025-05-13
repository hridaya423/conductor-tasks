import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from '../core/types.js';
export declare const InitializeProjectSchema: {
    projectName: z.ZodString;
    projectDescription: z.ZodString;
    filePath: z.ZodString;
};
export declare function initializeProjectHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof InitializeProjectSchema>>): Promise<ToolResultWithNextSteps>;
