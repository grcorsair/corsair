/**
 * EVENT Engine - Multi-Layer Event System
 *
 * Extracted from corsair-mvp.ts.
 * Provides event querying and aggregation (OpenClaw Pattern 2).
 */

import { EventEmitter } from "events";
import type {
  CorsairEvent,
  EventFilter,
  EventAggregator,
  EventAggregatorSummary,
} from "../types";

export class EventEngine {
  private emitter: EventEmitter;
  private events: CorsairEvent[];

  constructor(emitter: EventEmitter, events: CorsairEvent[]) {
    this.emitter = emitter;
    this.events = events;
  }

  async queryEvents(filter: EventFilter): Promise<CorsairEvent[]> {
    let filtered = [...this.events];

    if (filter.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }

    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    if (filter.timeRange) {
      const startTime = new Date(filter.timeRange.start).getTime();
      const endTime = new Date(filter.timeRange.end).getTime();

      filtered = filtered.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        return eventTime >= startTime && eventTime <= endTime;
      });
    }

    return filtered;
  }

  createEventAggregator(): EventAggregator {
    const startTime = new Date().toISOString();
    const capturedEvents: CorsairEvent[] = [];

    const listener = (event: CorsairEvent) => {
      capturedEvents.push(event);
    };

    this.emitter.on("raid:complete", listener);
    this.emitter.on("drift:detected", listener);
    this.emitter.on("plunder:recorded", listener);
    this.emitter.on("escape:executed", listener);

    return {
      getSummary: (): EventAggregatorSummary => {
        const byType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};

        for (const event of capturedEvents) {
          byType[event.type] = (byType[event.type] || 0) + 1;

          if (event.severity) {
            bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
          }
        }

        return {
          totalEvents: capturedEvents.length,
          byType,
          bySeverity,
          timeRange: {
            start: startTime,
            end: new Date().toISOString(),
          },
        };
      },
    };
  }
}
