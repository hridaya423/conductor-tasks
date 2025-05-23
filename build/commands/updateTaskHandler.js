import { z } from "zod";
import { TaskPriority, TaskStatus } from "../core/types.js";
import logger from "../core/logger.js";
export const UpdateTaskSchema = {
    id: z.string().describe("ID of the task to update"),
    title: z.string().optional().describe("New title of the task"),
    description: z.string().optional().describe("New description of the task"),
    priority: z.enum(["critical", "high", "medium", "low", "backlog"]).optional().describe("New priority level"),
    status: z.enum(["backlog", "todo", "in_progress", "review", "done", "blocked"]).optional().describe("New status"),
    tags: z.array(z.string()).optional().describe("New tags for the task"),
    complexity: z.number().min(1).max(10).optional().describe("New complexity rating (1-10)")
};
function checkTaskManagerInitialized(taskManager) {
    if (taskManager.isInitialized() || taskManager.getTaskCount() > 0) {
        taskManager.reloadTasks();
        return null;
    }
    return {
        content: [
            {
                type: "text",
                text: "Task system is not initialized. Please run 'initialize-tasks' command first."
            }
        ],
        suggested_actions: [{
                tool_name: "initialize-tasks",
                parameters: { projectName: "New Project", projectDescription: "Default project description", filePath: "./TASKS.md" },
                reason: "The task system needs to be initialized before tasks can be updated.",
                user_facing_suggestion: "Initialize the task system now?"
            }]
    };
}
export async function updateTaskHandler(taskManager, params) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        const { id, title, description, priority, status, tags, complexity } = params;
        const updates = {};
        if (title)
            updates.title = title;
        if (description)
            updates.description = description;
        if (tags)
            updates.tags = tags;
        if (complexity !== undefined)
            updates.complexity = complexity;
        if (priority) {
            switch (priority) {
                case "critical":
                    updates.priority = TaskPriority.CRITICAL;
                    break;
                case "high":
                    updates.priority = TaskPriority.HIGH;
                    break;
                case "medium":
                    updates.priority = TaskPriority.MEDIUM;
                    break;
                case "low":
                    updates.priority = TaskPriority.LOW;
                    break;
                case "backlog":
                    updates.priority = TaskPriority.BACKLOG;
                    break;
            }
        }
        if (status) {
            switch (status) {
                case "backlog":
                    updates.status = TaskStatus.BACKLOG;
                    break;
                case "todo":
                    updates.status = TaskStatus.TODO;
                    break;
                case "in_progress":
                    updates.status = TaskStatus.IN_PROGRESS;
                    break;
                case "review":
                    updates.status = TaskStatus.REVIEW;
                    break;
                case "done":
                    updates.status = TaskStatus.DONE;
                    break;
                case "blocked":
                    updates.status = TaskStatus.BLOCKED;
                    break;
            }
        }
        logger.info(`Updating task ${id}`, { updates });
        const updatedTask = taskManager.updateTask(id, updates);
        if (!updatedTask) {
            logger.warn(`Task not found for update: ${id}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: Task with ID ${id} not found`
                    }
                ],
                isError: true
            };
        }
        taskManager.saveTasks();
        logger.info(`Task ${id} updated successfully.`);
        const suggested_actions = [
            {
                tool_name: "get-task",
                parameters: { id: id },
                reason: "View the updated details of the task.",
                user_facing_suggestion: `View updated task '${updatedTask.title}' (ID: ${id})?`
            }
        ];
        if (updatedTask.status === TaskStatus.TODO || updatedTask.status === TaskStatus.IN_PROGRESS) {
            suggested_actions.push({
                tool_name: "generate-steps",
                parameters: { taskId: id },
                reason: "Generate or update implementation steps for this task.",
                user_facing_suggestion: `Generate implementation steps for '${updatedTask.title}'?`
            });
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Task ${id} ("${updatedTask.title}") updated successfully. TASKS.md has been automatically updated.`
                }
            ],
            suggested_actions
        };
    }
    catch (error) {
        logger.error('Error updating task:', { error, taskId: params.id });
        return {
            content: [
                {
                    type: "text",
                    text: `Error updating task ${params.id}: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=updateTaskHandler.js.map