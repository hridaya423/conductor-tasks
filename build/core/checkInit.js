export function checkTaskManagerInitialized(taskManager) {
    if (taskManager.isInitialized() || taskManager.getTaskCount() > 0) {
        taskManager.reloadTasks();
        return null;
    }
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