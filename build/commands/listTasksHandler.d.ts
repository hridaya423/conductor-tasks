import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const ListTasksSchema: {
    status: z.ZodOptional<z.ZodEnum<["backlog", "todo", "in_progress", "review", "done", "blocked"]>>;
    priority: z.ZodOptional<z.ZodEnum<["critical", "high", "medium", "low", "backlog"]>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sortBy: z.ZodOptional<z.ZodEnum<["priority", "dueDate", "createdAt", "updatedAt", "complexity"]>>;
    sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
};
export declare function listTasksHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof ListTasksSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
