import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const ParsePrdSchema: {
    prdContent: z.ZodString;
    createTasksFile: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
};
export declare function parsePrdHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof ParsePrdSchema>>): Promise<ToolResultWithNextSteps>;
