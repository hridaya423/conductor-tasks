import { TaskManager } from "../task/taskManager.js";

export function checkTaskManagerInitialized(taskManager: TaskManager): { content: { type: "text"; text: string }[] } | null {
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
