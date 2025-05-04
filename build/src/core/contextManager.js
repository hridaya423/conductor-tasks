import { ContextPriority } from './types.js';
export class ContextManager {
    constructor() {
        this.contextItems = new Map();
        this.projectContext = '';
        this.anchorPoints = new Set();
    }
    setProjectContext(context) {
        this.projectContext = context;
    }
    getProjectContext() {
        return this.projectContext;
    }
    addContext(content, priority, source, tags = []) {
        const id = `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const contextItem = {
            id,
            content,
            priority,
            timestamp: Date.now(),
            source,
            tags
        };
        this.contextItems.set(id, contextItem);
        return id;
    }
    setAnchorPoint(id, isAnchor) {
        if (!this.contextItems.has(id)) {
            return false;
        }
        if (isAnchor) {
            this.anchorPoints.add(id);
        }
        else {
            this.anchorPoints.delete(id);
        }
        return true;
    }
    getContextItem(id) {
        return this.contextItems.get(id);
    }
    getActiveContext(maxItems = 10) {
        const anchorItems = Array.from(this.anchorPoints)
            .map(id => this.contextItems.get(id))
            .filter((item) => !!item);
        const nonAnchorItems = Array.from(this.contextItems.values())
            .filter(item => !this.anchorPoints.has(item.id));
        const sortedNonAnchorItems = this.sortContextItems(nonAnchorItems);
        const remainingSlots = Math.max(0, maxItems - anchorItems.length);
        const result = [
            ...anchorItems,
            ...sortedNonAnchorItems.slice(0, remainingSlots)
        ];
        return result;
    }
    sortContextItems(items) {
        return [...items].sort((a, b) => {
            const priorityOrder = {
                [ContextPriority.CRITICAL]: 0,
                [ContextPriority.ESSENTIAL]: 1,
                [ContextPriority.BACKGROUND]: 2
            };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) {
                return priorityDiff;
            }
            return b.timestamp - a.timestamp;
        });
    }
    clearNonAnchorContext() {
        const contextToKeep = new Map();
        for (const id of this.anchorPoints) {
            const item = this.contextItems.get(id);
            if (item) {
                contextToKeep.set(id, item);
            }
        }
        this.contextItems = contextToKeep;
    }
}
//# sourceMappingURL=contextManager.js.map