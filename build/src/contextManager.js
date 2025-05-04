export var ContextPriority;
(function (ContextPriority) {
    ContextPriority["CRITICAL"] = "critical";
    ContextPriority["ESSENTIAL"] = "essential";
    ContextPriority["BACKGROUND"] = "background";
})(ContextPriority || (ContextPriority = {}));
export class ContextManager {
    constructor() {
        this.contextItems = new Map();
        this.anchorPoints = new Set();
        this.summaries = new Map();
        this.lastSummarizationTime = Date.now();
        this.summarizationInterval = 1000 * 60 * 10;
    }
    addContext(item) {
        this.contextItems.set(item.id, item);
        return item.id;
    }
    setAnchorPoint(id, isAnchor = true) {
        if (isAnchor) {
            this.anchorPoints.add(id);
        }
        else {
            this.anchorPoints.delete(id);
        }
    }
    getActiveContext(options = {}) {
        const now = Date.now();
        const { maxItems = 50, recencyThreshold = 1000 * 60 * 60 * 24, minConfidence = 0.3 } = options;
        if (now - this.lastSummarizationTime > this.summarizationInterval) {
            this.createSummaries();
            this.lastSummarizationTime = now;
        }
        let items = Array.from(this.contextItems.values())
            .filter(item => {
            if (this.anchorPoints.has(item.id))
                return true;
            return item.confidence >= minConfidence &&
                (now - item.timestamp <= recencyThreshold);
        })
            .sort((a, b) => {
            const priorityOrder = {
                [ContextPriority.CRITICAL]: 0,
                [ContextPriority.ESSENTIAL]: 1,
                [ContextPriority.BACKGROUND]: 2
            };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0)
                return priorityDiff;
            return b.timestamp - a.timestamp;
        });
        items = this.applyTimeDecay(items);
        return items.slice(0, maxItems);
    }
    applyTimeDecay(items) {
        const now = Date.now();
        const ONE_HOUR = 1000 * 60 * 60;
        return items.map(item => {
            if (this.anchorPoints.has(item.id))
                return item;
            const hoursSinceCreation = (now - item.timestamp) / ONE_HOUR;
            const decayRates = {
                [ContextPriority.CRITICAL]: 0.005,
                [ContextPriority.ESSENTIAL]: 0.01,
                [ContextPriority.BACKGROUND]: 0.05
            };
            const decayRate = decayRates[item.priority];
            const decayFactor = Math.max(0, 1 - (hoursSinceCreation * decayRate));
            return {
                ...item,
                confidence: item.confidence * decayFactor
            };
        });
    }
    createSummaries() {
        const topicGroups = new Map();
        for (const item of this.contextItems.values()) {
            for (const tag of item.tags) {
                if (!topicGroups.has(tag)) {
                    topicGroups.set(tag, []);
                }
                topicGroups.get(tag)?.push(item);
            }
        }
        for (const [topic, items] of topicGroups.entries()) {
            if (items.length > 3) {
                const summary = `Summary of ${items.length} items about "${topic}": ` +
                    items.map(i => i.content.substring(0, 50)).join(" ... ");
                this.summaries.set(topic, summary);
            }
        }
    }
    getSummaries() {
        return this.summaries;
    }
    integrateMultiModalContent(content, options) {
        const { modality, priority = ContextPriority.ESSENTIAL, confidence = 0.8, tags = [] } = options;
        const id = `${modality}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let processedContent;
        switch (modality) {
            case "text":
                processedContent = content;
                break;
            case "image":
                processedContent = `[Image data with ${content.length} bytes]`;
                break;
            case "audio":
                processedContent = `[Audio data with ${content.length} bytes]`;
                break;
            case "structured":
                processedContent = JSON.stringify(content);
                break;
        }
        const item = {
            id,
            content: processedContent,
            priority,
            timestamp: Date.now(),
            confidence,
            source: `${modality}-integration`,
            modality,
            tags
        };
        return this.addContext(item);
    }
    clearNonAnchorContext() {
        for (const [id, item] of this.contextItems.entries()) {
            if (!this.anchorPoints.has(id)) {
                this.contextItems.delete(id);
            }
        }
    }
    getContextItem(id) {
        return this.contextItems.get(id);
    }
}
//# sourceMappingURL=contextManager.js.map