import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const VisualizeTasksDashboardSchema: {};
export declare function visualizeTasksDashboardHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof VisualizeTasksDashboardSchema>>): Promise<ToolResultWithNextSteps>;
