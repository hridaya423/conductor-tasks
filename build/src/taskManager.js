import path from 'path';
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority["CRITICAL"] = "critical";
    TaskPriority["HIGH"] = "high";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["LOW"] = "low";
    TaskPriority["BACKLOG"] = "backlog";
})(TaskPriority || (TaskPriority = {}));
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["BACKLOG"] = "backlog";
    TaskStatus["TODO"] = "todo";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["REVIEW"] = "review";
    TaskStatus["DONE"] = "done";
    TaskStatus["BLOCKED"] = "blocked";
})(TaskStatus || (TaskStatus = {}));
export class TaskManager {
    constructor() {
        this.tasks = new Map();
        this.tasksByStatus = new Map();
        this.lastAiAnalysis = 0;
        this.aiAnalysisInterval = 1000 * 60 * 60;
        this.tasks = new Map();
        this.tasksByStatus = new Map();
        this.tasksFilePath = path.join(process.cwd(), 'TASKS.md');
    }
    addTask(taskData) {
        const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const now = Date.now();
        const task = {
            id,
            ...taskData,
            createdAt: now,
            updatedAt: now,
            notes: [],
            aiSummary: undefined
        };
        this.tasks.set(id, task);
        this.checkForBlocking(task);
        return id;
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    updateTask(id, updates) {
        const task = this.tasks.get(id);
        if (!task)
            return undefined;
        const updatedTask = {
            ...task,
            ...updates,
            updatedAt: Date.now()
        };
        this.tasks.set(id, updatedTask);
        if (updates.dependencies) {
            this.checkForBlocking(updatedTask);
        }
        return updatedTask;
    }
    addTaskNote(taskId, content, author, type) {
        const task = this.tasks.get(taskId);
        if (!task)
            return undefined;
        const note = {
            id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            content,
            timestamp: Date.now(),
            author,
            type
        };
        task.notes.push(note);
        task.updatedAt = Date.now();
        return note;
    }
    deleteTask(id) {
        if (!this.tasks.has(id))
            return false;
        this.tasks.delete(id);
        for (const task of this.tasks.values()) {
            if (task.dependencies.includes(id)) {
                task.dependencies = task.dependencies.filter(depId => depId !== id);
                if (task.status === TaskStatus.BLOCKED) {
                    this.checkForBlocking(task);
                }
            }
        }
        return true;
    }
    getTasks(options = {}) {
        const { status, priority, assignee, tags, sortBy = "priority", sortDirection = "desc" } = options;
        let filteredTasks = Array.from(this.tasks.values());
        if (status) {
            const statusArray = Array.isArray(status) ? status : [status];
            filteredTasks = filteredTasks.filter(task => statusArray.includes(task.status));
        }
        if (priority) {
            const priorityArray = Array.isArray(priority) ? priority : [priority];
            filteredTasks = filteredTasks.filter(task => priorityArray.includes(task.priority));
        }
        if (assignee) {
            filteredTasks = filteredTasks.filter(task => task.assignee === assignee);
        }
        if (tags && tags.length > 0) {
            filteredTasks = filteredTasks.filter(task => tags.some(tag => task.tags.includes(tag)));
        }
        filteredTasks.sort((a, b) => {
            let valueA, valueB;
            switch (sortBy) {
                case "priority":
                    const priorityOrder = {
                        [TaskPriority.CRITICAL]: 0,
                        [TaskPriority.HIGH]: 1,
                        [TaskPriority.MEDIUM]: 2,
                        [TaskPriority.LOW]: 3,
                        [TaskPriority.BACKLOG]: 4
                    };
                    valueA = priorityOrder[a.priority];
                    valueB = priorityOrder[b.priority];
                    break;
                case "dueDate":
                    valueA = a.dueDate || Number.MAX_SAFE_INTEGER;
                    valueB = b.dueDate || Number.MAX_SAFE_INTEGER;
                    break;
                case "createdAt":
                    valueA = a.createdAt;
                    valueB = b.createdAt;
                    break;
                case "updatedAt":
                    valueA = a.updatedAt;
                    valueB = b.updatedAt;
                    break;
                default:
                    valueA = a.updatedAt;
                    valueB = b.updatedAt;
            }
            return sortDirection === "asc"
                ? valueA - valueB
                : valueB - valueA;
        });
        return filteredTasks;
    }
    checkForBlocking(task) {
        if (task.dependencies.length === 0) {
            if (task.status === TaskStatus.BLOCKED) {
                task.status = TaskStatus.TODO;
            }
            return;
        }
        const hasUnfinishedDependencies = task.dependencies.some(depId => {
            const depTask = this.tasks.get(depId);
            return !depTask || depTask.status !== TaskStatus.DONE;
        });
        if (hasUnfinishedDependencies) {
            task.status = TaskStatus.BLOCKED;
        }
        else if (task.status === TaskStatus.BLOCKED) {
            task.status = TaskStatus.TODO;
        }
    }
    generateAiSummaries() {
        const now = Date.now();
        if (now - this.lastAiAnalysis < this.aiAnalysisInterval) {
            return;
        }
        for (const task of this.tasks.values()) {
            if (!task.aiSummary || task.notes.length > 0 || task.updatedAt > this.lastAiAnalysis) {
                const summary = this.mockAiSummary(task);
                task.aiSummary = summary;
            }
        }
        this.lastAiAnalysis = now;
    }
    mockAiSummary(task) {
        const progressNotes = task.notes.filter(n => n.type === "progress").length;
        const blockerNotes = task.notes.filter(n => n.type === "blocker").length;
        let complexity = "";
        if (task.complexity <= 3)
            complexity = "simple";
        else if (task.complexity <= 7)
            complexity = "moderate";
        else
            complexity = "complex";
        return `This is a ${complexity} task with ${progressNotes} progress updates and ${blockerNotes} reported blockers. ` +
            `Priority is ${task.priority} and current status is ${task.status}.`;
    }
    getTasksNeedingAttention() {
        const now = Date.now();
        return Array.from(this.tasks.values()).filter(task => {
            if (task.dueDate && task.dueDate < now && task.status !== TaskStatus.DONE) {
                return true;
            }
            if (task.status === TaskStatus.BLOCKED) {
                return true;
            }
            if (task.priority === TaskPriority.CRITICAL && task.status !== TaskStatus.DONE) {
                return true;
            }
            return false;
        });
    }
    getTaskDependencyTree(taskId) {
        const task = this.tasks.get(taskId);
        if (!task)
            return undefined;
        const dependencies = [];
        for (const depId of task.dependencies) {
            const depTask = this.tasks.get(depId);
            if (depTask) {
                dependencies.push(depTask);
            }
        }
        return { task, dependencies };
    }
    getTasksFilePath() {
        return this.tasksFilePath;
    }
}
//# sourceMappingURL=taskManager.js.map