import { z } from "zod";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { TaskStatus } from "../core/types.js";
export const VisualizeTasksDependencyTreeSchema = {
    taskId: z.string().optional().describe("ID of the task to show dependencies for (optional)")
};
export async function visualizeTasksDependencyTreeHandler(taskManager, params) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        const { taskId } = params;
        logger.info('Visualizing task dependency tree', { taskId });
        const allTasks = taskManager.getTasks({});
        if (!taskId) {
            const rootTasks = allTasks.filter(task => !task.parent);
            if (rootTasks.length === 0) {
                logger.info('No root tasks found for dependency tree visualization');
                return {
                    content: [
                        {
                            type: "text",
                            text: "No root tasks found. All tasks may be subtasks of other tasks. Consider creating a top-level task."
                        }
                    ],
                    suggested_actions: [{
                            tool_name: "create-task",
                            parameters: { title: "New Top-Level Task", description: "Details for the new top-level task." },
                            reason: "No root tasks exist to visualize in a tree.",
                            user_facing_suggestion: "Create a new top-level task?"
                        }]
                };
            }
            let dependencyTree = "# Task Dependency Tree\n\n";
            function buildTree(task, depth = 0) {
                const indent = '  '.repeat(depth);
                const statusSymbol = task.status === TaskStatus.DONE ? '✓' : ' ';
                let result = `${indent}- [${statusSymbol}] ${task.title} (${task.id})\n`;
                const subtasks = allTasks.filter(t => t.parent === task.id);
                for (const subtask of subtasks) {
                    result += buildTree(subtask, depth + 1);
                }
                return result;
            }
            for (const rootTask of rootTasks) {
                dependencyTree += buildTree(rootTask);
                dependencyTree += '\n';
            }
            logger.info(`Generated dependency tree for all ${rootTasks.length} root tasks.`);
            const suggested_actions_all = [
                {
                    tool_name: "list-tasks",
                    reason: "View all tasks in a flat list.",
                    user_facing_suggestion: "List all tasks?"
                }
            ];
            if (rootTasks.length > 0) {
                suggested_actions_all.push({
                    tool_name: "visualize-tasks-dependency-tree",
                    parameters: { taskId: rootTasks[0].id },
                    reason: "View the dependency tree for the first root task.",
                    user_facing_suggestion: `View tree for task '${rootTasks[0].title}'?`
                });
            }
            return {
                content: [
                    {
                        type: "text",
                        text: dependencyTree
                    }
                ],
                suggested_actions: suggested_actions_all
            };
        }
        else {
            const task = taskManager.getTask(taskId);
            if (!task) {
                logger.warn(`Task not found for dependency tree visualization: ${taskId}`);
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
            let dependencyTree = `# Dependency Tree for "${task.title}"\n\n`;
            let rootTask = task;
            let currentParentId = task.parent;
            const parentChain = [];
            while (currentParentId) {
                const parent = taskManager.getTask(currentParentId);
                if (!parent)
                    break;
                parentChain.unshift(parent);
                rootTask = parent;
                currentParentId = parent.parent;
            }
            if (parentChain.length > 0) {
                dependencyTree += "## Parent Chain\n\n";
                parentChain.forEach((parent, index) => {
                    dependencyTree += `${'  '.repeat(index)}- ${parent.title} (${parent.id})\n`;
                });
                dependencyTree += `${'  '.repeat(parentChain.length)}- ${task.title} (${task.id}) <- Current Task\n\n`;
            }
            function buildSubtasksTree(currentTaskId, depth = 0) {
                const subtasks = allTasks.filter(t => t.parent === currentTaskId);
                if (subtasks.length === 0)
                    return '';
                let result = '';
                for (const subtask of subtasks) {
                    const statusSymbol = subtask.status === TaskStatus.DONE ? '✓' : ' ';
                    const relativeDepth = parentChain.length + depth + (parentChain.length > 0 ? 1 : 0);
                    result += `${'  '.repeat(relativeDepth)}- [${statusSymbol}] ${subtask.title} (${subtask.id})\n`;
                    result += buildSubtasksTree(subtask.id, depth + 1);
                }
                return result;
            }
            dependencyTree += "## Subtasks\n\n";
            const subtasksTree = buildSubtasksTree(taskId, 0);
            dependencyTree += subtasksTree || "No subtasks found for this task.\n";
            logger.info(`Generated dependency tree for specific task: ${taskId}`);
            const suggested_actions_single = [
                {
                    tool_name: "get-task",
                    parameters: { id: taskId },
                    reason: "View the details of this task.",
                    user_facing_suggestion: `View details for task '${task.title}'?`
                },
                {
                    tool_name: "visualize-tasks-dependency-tree",
                    reason: "View the dependency tree for all root tasks.",
                    user_facing_suggestion: "Show full project dependency tree?"
                }
            ];
            return {
                content: [
                    {
                        type: "text",
                        text: dependencyTree
                    }
                ],
                suggested_actions: suggested_actions_single
            };
        }
    }
    catch (error) {
        logger.error('Error displaying dependency tree:', { error, taskId: params.taskId });
        return {
            content: [
                {
                    type: "text",
                    text: `Error displaying dependency tree: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=visualizeTasksDependencyTreeHandler.js.map