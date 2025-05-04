import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const VisualizeTasksDashboardSchema: {};
export declare function visualizeTasksDashboardHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof VisualizeTasksDashboardSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
