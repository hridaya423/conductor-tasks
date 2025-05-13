export function checkTaskManagerInitialized(taskManager) {
    if (taskManager.isInitialized() || taskManager.getTaskCount() > 0) {
        taskManager.reloadTasks();
        return null;
    }
    const suggested_actions = [{
            tool_name: "initialize-tasks",
            parameters: {
                projectName: "New Project",
                projectDescription: "Default project description. Please update.",
                filePath: "./TASKS.md"
            },
            reason: "The task system needs to be initialized before other task operations can be performed.",
            user_facing_suggestion: "The task system is not initialized. Would you like to initialize it now?"
        }];
    return {
        content: [
            {
                type: "text",
                text: "Task system is not initialized. Please run the 'initialize-tasks' command first, or use the suggested action."
            }
        ],
        suggested_actions,
        isError: true
    };
}
//# sourceMappingURL=checkInit.js.map