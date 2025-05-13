import { z } from "zod";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { TaskPriority, TaskStatus } from "../core/types.js";
export const VisualizeTasksKanbanSchema = {
    priority: z.enum(["critical", "high", "medium", "low", "backlog"]).optional().describe("Filter by priority level"),
    tag: z.string().optional().describe("Filter by tag"),
    compact: z.boolean().optional().default(false).describe("Use compact display mode"),
    showPriority: z.boolean().optional().default(true).describe("Show priority indicators"),
    showComplexity: z.boolean().optional().default(true).describe("Show complexity indicators")
};
export async function visualizeTasksKanbanHandler(taskManager, params) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        const { priority, tag, compact, showPriority, showComplexity } = params;
        logger.info('Visualizing tasks kanban', { priority, tag, compact, showPriority, showComplexity });
        let priorityFilter;
        if (priority) {
            switch (priority) {
                case "critical":
                    priorityFilter = TaskPriority.CRITICAL;
                    break;
                case "high":
                    priorityFilter = TaskPriority.HIGH;
                    break;
                case "medium":
                    priorityFilter = TaskPriority.MEDIUM;
                    break;
                case "low":
                    priorityFilter = TaskPriority.LOW;
                    break;
                case "backlog":
                    priorityFilter = TaskPriority.BACKLOG;
                    break;
            }
        }
        const tasks = taskManager.getTasks({
            priority: priorityFilter,
            tags: tag ? [tag] : undefined
        });
        const statusColumns = {
            [TaskStatus.BACKLOG]: [],
            [TaskStatus.TODO]: [],
            [TaskStatus.IN_PROGRESS]: [],
            [TaskStatus.REVIEW]: [],
            [TaskStatus.DONE]: [],
            [TaskStatus.BLOCKED]: []
        };
        tasks.forEach(task => {
            if (statusColumns[task.status]) {
                statusColumns[task.status].push(task);
            }
            else {
                logger.warn(`Task ${task.id} has unknown status: ${task.status}`);
            }
        });
        let kanbanBoard = '# Task Kanban Board\n\n';
        const columnWidth = compact ? 25 : 40;
        kanbanBoard += '|';
        Object.keys(statusColumns).forEach(status => {
            const count = statusColumns[status].length;
            kanbanBoard += ` ${status.toUpperCase()} (${count}) `.padEnd(columnWidth + 2) + '|';
        });
        kanbanBoard += '\n';
        kanbanBoard += '|';
        Object.keys(statusColumns).forEach(() => {
            kanbanBoard += `${'- '.repeat(columnWidth / 2)} `.padEnd(columnWidth + 2) + '|';
        });
        kanbanBoard += '\n';
        const maxTasks = Math.max(0, ...Object.values(statusColumns).map(column => column.length));
        for (let i = 0; i < maxTasks; i++) {
            kanbanBoard += '|';
            Object.values(statusColumns).forEach(column => {
                const task = column[i];
                let cellContent = '';
                if (task) {
                    const priorityIndicator = showPriority ? `[${task.priority.charAt(0).toUpperCase()}] ` : '';
                    const complexityIndicator = showComplexity ? ` (${task.complexity}/10)` : '';
                    const baseTitle = task.title;
                    const availableLength = columnWidth - priorityIndicator.length - complexityIndicator.length - 1;
                    const taskTitle = baseTitle.length > availableLength
                        ? baseTitle.substring(0, availableLength) + '…'
                        : baseTitle;
                    cellContent = `${priorityIndicator}${taskTitle}${complexityIndicator}`;
                }
                kanbanBoard += ` ${cellContent} `.padEnd(columnWidth + 2) + '|';
            });
            kanbanBoard += '\n';
        }
        logger.info(`Generated Kanban board with ${tasks.length} tasks.`);
        const suggested_actions = [
            {
                tool_name: "list-tasks",
                reason: "View tasks in a list format.",
                user_facing_suggestion: "Show tasks as a list?"
            },
            {
                tool_name: "visualize-tasks-dashboard",
                reason: "View the project dashboard.",
                user_facing_suggestion: "Show project dashboard?"
            }
        ];
        if (tasks.length === 0) {
            suggested_actions.unshift({
                tool_name: "create-task",
                parameters: { title: "New Task", description: "Details for the new task." },
                reason: "No tasks exist to visualize.",
                user_facing_suggestion: "Create your first task?"
            });
        }
        return {
            content: [
                {
                    type: "text",
                    text: kanbanBoard
                }
            ],
            suggested_actions
        };
    }
    catch (error) {
        logger.error('Error displaying Kanban board:', { error });
        return {
            content: [
                {
                    type: "text",
                    text: `Error displaying Kanban board: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=visualizeTasksKanbanHandler.js.map