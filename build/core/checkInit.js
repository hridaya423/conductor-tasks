/**
 * Checks if the TaskManager is initialized (TASKS.md exists or tasks are loaded).
 * Reloads tasks from file if it exists.
 * Returns null if initialized, otherwise returns an MCP error message object.
 */
export function checkTaskManagerInitialized(taskManager) {
    if (taskManager.isInitialized() || taskManager.getTaskCount() > 0) {
        // Ensure tasks are loaded if file exists
        taskManager.reloadTasks();
        return null;
    }
    // Check again after attempting reload
    if (taskManager.isInitialized()) {
        return null;
    }
    return {
        content: [
            {
                type: "text",
                text: "Task system is not initialized. Please run 'initialize-tasks' command first."
            }
        ]
    };
}
//# sourceMappingURL=checkInit.js.map