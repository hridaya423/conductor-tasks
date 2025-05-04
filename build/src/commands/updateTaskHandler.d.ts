import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const UpdateTaskSchema: {
    id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<["critical", "high", "medium", "low", "backlog"]>>;
    status: z.ZodOptional<z.ZodEnum<["backlog", "todo", "in_progress", "review", "done", "blocked"]>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    complexity: z.ZodOptional<z.ZodNumber>;
};
export declare function updateTaskHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof UpdateTaskSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
