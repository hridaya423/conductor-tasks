import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const VisualizeTasksKanbanSchema: {
    priority: z.ZodOptional<z.ZodEnum<["critical", "high", "medium", "low", "backlog"]>>;
    tag: z.ZodOptional<z.ZodString>;
    compact: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    showPriority: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    showComplexity: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
};
export declare function visualizeTasksKanbanHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof VisualizeTasksKanbanSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
