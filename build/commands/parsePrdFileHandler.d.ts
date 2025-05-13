import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const ParsePrdFileSchema: {
    filePath: z.ZodString;
    createTasksFile: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
};
export declare function parsePrdFileHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof ParsePrdFileSchema>>): Promise<ToolResultWithNextSteps>;
