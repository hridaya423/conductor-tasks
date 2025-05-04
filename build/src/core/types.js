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
export var ContextPriority;
(function (ContextPriority) {
    ContextPriority["CRITICAL"] = "critical";
    ContextPriority["ESSENTIAL"] = "essential";
    ContextPriority["BACKGROUND"] = "background";
})(ContextPriority || (ContextPriority = {}));
//# sourceMappingURL=types.js.map