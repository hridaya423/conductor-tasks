import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const GetNextTaskSchema: {};
export declare function getNextTaskHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof GetNextTaskSchema>>): Promise<ToolResultWithNextSteps>;
