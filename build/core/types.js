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
export var IDEType;
(function (IDEType) {
    IDEType["CURSOR"] = "cursor";
    IDEType["WINDSURF"] = "windsurf";
    IDEType["ROO_CODE"] = "roo-code";
    IDEType["CLINE"] = "cline";
    IDEType["AUTO"] = "auto";
    IDEType["GENERIC"] = "generic";
})(IDEType || (IDEType = {}));
export var CodeSymbolType;
(function (CodeSymbolType) {
    CodeSymbolType["FUNCTION"] = "function";
    CodeSymbolType["CLASS"] = "class";
    CodeSymbolType["INTERFACE"] = "interface";
    CodeSymbolType["VARIABLE"] = "variable";
    CodeSymbolType["CONSTANT"] = "constant";
    CodeSymbolType["TYPE_ALIAS"] = "type_alias";
    CodeSymbolType["ENUM"] = "enum";
    CodeSymbolType["MODULE"] = "module";
    CodeSymbolType["IMPORT"] = "import_statement";
    CodeSymbolType["EXPORT"] = "export_statement";
    CodeSymbolType["UNKNOWN"] = "unknown";
})(CodeSymbolType || (CodeSymbolType = {}));
//# sourceMappingURL=types.js.map