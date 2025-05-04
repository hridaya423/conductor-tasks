import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const VisualizeTasksDependencyTreeSchema: {
    taskId: z.ZodOptional<z.ZodString>;
};
export declare function visualizeTasksDependencyTreeHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof VisualizeTasksDependencyTreeSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
