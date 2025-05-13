import { z } from "zod";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
export const AddTaskNoteSchema = {
    taskId: z.string().describe("ID of the task"),
    content: z.string().describe("Content of the note"),
    author: z.string().describe("Name of the person adding the note"),
    type: z.enum(["progress", "comment", "blocker", "solution"]).describe("Type of note")
};
export async function addTaskNoteHandler(taskManager, params) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        const { taskId, content, author, type } = params;
        logger.info(`Adding ${type} note to task ${taskId}`, { author });
        const note = taskManager.addTaskNote(taskId, content, author, type);
        if (!note) {
            logger.warn(`Task not found for adding note: ${taskId}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: Task with ID ${taskId} not found.`
                    }
                ],
                isError: true
            };
        }
        const suggested_actions = [
            {
                tool_name: "get-task",
                parameters: { id: taskId },
                reason: "View the task to see the newly added note.",
                user_facing_suggestion: `View task ${taskId} to see the new note?`
            }
        ];
        return {
            content: [
                {
                    type: "text",
                    text: `Note added to task ${taskId}:\n\n${content}`
                }
            ],
            suggested_actions
        };
    }
    catch (error) {
        logger.error('Error adding note to task:', { error, taskId: params.taskId });
        return {
            content: [
                {
                    type: "text",
                    text: `Error adding note to task ${params.taskId}: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=addTaskNoteHandler.js.map