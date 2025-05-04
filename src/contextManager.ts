import { z } from "zod";

export enum ContextPriority {
  CRITICAL = "critical",
  ESSENTIAL = "essential",
  BACKGROUND = "background"
}

export interface ContextItem {
  id: string;
  content: string;
  priority: ContextPriority;
  timestamp: number;
  confidence: number;
  source: string;
  modality: "text" | "image" | "audio" | "structured";
  tags: string[];
}

export class ContextManager {
  private contextItems: Map<string, ContextItem> = new Map();
  private anchorPoints: Set<string> = new Set();
  private summaries: Map<string, string> = new Map();
  private lastSummarizationTime: number = Date.now();
  private summarizationInterval: number = 1000 * 60 * 10;

  addContext(item: ContextItem): string {
    this.contextItems.set(item.id, item);
    return item.id;
  }

  setAnchorPoint(id: string, isAnchor: boolean = true): void {
    if (isAnchor) {
      this.anchorPoints.add(id);
    } else {
      this.anchorPoints.delete(id);
    }
  }

  getActiveContext(options: {
    maxItems?: number,
    recencyThreshold?: number,
    minConfidence?: number
  } = {}): ContextItem[] {
    const now = Date.now();
    const {
      maxItems = 50,
      recencyThreshold = 1000 * 60 * 60 * 24,
      minConfidence = 0.3
    } = options;

    if (now - this.lastSummarizationTime > this.summarizationInterval) {
      this.createSummaries();
      this.lastSummarizationTime = now;
    }

    let items = Array.from(this.contextItems.values())
      .filter(item => {
        if (this.anchorPoints.has(item.id)) return true;
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
        if (priorityDiff !== 0) return priorityDiff;

        return b.timestamp - a.timestamp;
      });

    items = this.applyTimeDecay(items);

    return items.slice(0, maxItems);
  }

  private applyTimeDecay(items: ContextItem[]): ContextItem[] {
    const now = Date.now();
    const ONE_HOUR = 1000 * 60 * 60;

    return items.map(item => {
      if (this.anchorPoints.has(item.id)) return item;

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

  private createSummaries(): void {
    const topicGroups = new Map<string, ContextItem[]>();

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

  getSummaries(): Map<string, string> {
    return this.summaries;
  }

  integrateMultiModalContent(
    content: string | object | Buffer,
    options: {
      modality: "text" | "image" | "audio" | "structured",
      priority?: ContextPriority,
      confidence?: number,
      tags?: string[]
    }
  ): string {
    const {
      modality,
      priority = ContextPriority.ESSENTIAL,
      confidence = 0.8,
      tags = []
    } = options;

    const id = `${modality}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    let processedContent: string;

    switch (modality) {
      case "text":
        processedContent = content as string;
        break;
      case "image":
        processedContent = `[Image data with ${(content as Buffer).length} bytes]`;
        break;
      case "audio":
        processedContent = `[Audio data with ${(content as Buffer).length} bytes]`;
        break;
      case "structured":

        processedContent = JSON.stringify(content);
        break;
    }

    const item: ContextItem = {
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

  clearNonAnchorContext(): void {
    for (const [id, item] of this.contextItems.entries()) {
      if (!this.anchorPoints.has(id)) {
        this.contextItems.delete(id);
      }
    }
  }

  getContextItem(id: string): ContextItem | undefined {
    return this.contextItems.get(id);
  }
}
