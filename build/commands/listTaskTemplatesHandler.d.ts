import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const ListTaskTemplatesSchema: {};
export declare function listTaskTemplatesHandler(taskManager: TaskManager): Promise<ToolResultWithNextSteps>;
