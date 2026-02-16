import diffData from "@/content/samples/diff.json";
import timelineData from "@/content/samples/timeline.json";
import logData from "@/content/samples/log.json";

export type DemoDiff = {
  controls: Array<{
    id: string;
    name: string;
    before: "PASS" | "FAIL";
    after: "PASS" | "FAIL";
    change: "unchanged" | "regression" | "fixed";
  }>;
  summary: {
    regressions: number;
    improvements: number;
    unchanged: number;
    scoreBefore: number;
    scoreAfter: number;
  };
};

export type DemoTimelineEntry = {
  hash: string;
  date: string;
  tool: string;
  scope: string;
  score: number;
  controls: {
    passed: number;
    failed: number;
    total: number;
  };
  provenance: "tool" | "self" | "auditor";
  diff: {
    regressions: number;
    improvements: number;
    note: string;
  } | null;
  signal: {
    type: string;
    note: string;
  } | null;
};

export type DemoLogEntry = {
  id: number;
  hash: string;
  date: string;
  cpoe: string;
  issuer: string;
  type: "demo";
};

export const DEMO_DIFF = diffData as DemoDiff;
export const DEMO_TIMELINE = timelineData as DemoTimelineEntry[];
export const DEMO_LOG_ENTRIES = logData as DemoLogEntry[];
