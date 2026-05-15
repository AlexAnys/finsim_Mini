"use client";

import { useCallback, useEffect, useState } from "react";

export type AiToolKey =
  | "lessonPolish"
  | "ideologyMining"
  | "questionAnalysis"
  | "examCheck";

export interface PersistedAiResult {
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    diagnosis: string;
    suggestions: string[];
    examples: string[];
  }>;
  actionItems: string[];
  cautions: string[];
  gradingTable: Array<{
    student: string;
    question: string;
    score: string;
    feedback: string;
    uncertainty: string;
  }>;
  fallback?: boolean;
  fileReports?: Array<{
    fileName: string;
    status: string;
    error?: string;
    textLength: number;
  }>;
  searchStatus?: string;
}

export interface PersistedAsyncJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress: number;
  error?: string | null;
  result?: PersistedAiResult | null;
}

export interface PersistedJobInputs {
  text: string;
  teacherRequest: string;
  outputStyle: string;
  strictness: string;
  enableSearch: boolean;
}

export type ViewMode = "read" | "edit";

export interface PersistedJobState extends PersistedJobInputs {
  job: PersistedAsyncJob | null;
  result: PersistedAiResult | null;
  originalResult: PersistedAiResult | null;
  viewMode: ViewMode;
}

interface StoredEntry extends PersistedJobState {
  schemaVersion: 1;
  savedAt: number;
}

const SCHEMA_VERSION = 1 as const;
const TTL_MS = 24 * 60 * 60 * 1000;
export const PERSIST_KEY_PREFIX = "aiAssistant.lastJob.";
export const ACTIVE_TOOL_KEY = "aiAssistant.activeTool";

export function buildPersistKey(toolKey: AiToolKey): string {
  return `${PERSIST_KEY_PREFIX}${toolKey}`;
}

const DEFAULT_STATE: PersistedJobState = {
  text: "",
  teacherRequest: "",
  outputStyle: "structured",
  strictness: "balanced",
  enableSearch: false,
  job: null,
  result: null,
  originalResult: null,
  viewMode: "read",
};

function safeParse(raw: string | null): StoredEntry | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<StoredEntry>;
    if (!obj || obj.schemaVersion !== SCHEMA_VERSION) return null;
    if (typeof obj.savedAt !== "number") return null;
    if (Date.now() - obj.savedAt > TTL_MS) return null;
    return obj as StoredEntry;
  } catch {
    return null;
  }
}

function readEntry(toolKey: AiToolKey): PersistedJobState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(buildPersistKey(toolKey));
  const parsed = safeParse(raw);
  if (!parsed) {
    if (raw !== null) window.localStorage.removeItem(buildPersistKey(toolKey));
    return null;
  }
  return {
    text: parsed.text,
    teacherRequest: parsed.teacherRequest,
    outputStyle: parsed.outputStyle,
    strictness: parsed.strictness,
    enableSearch: parsed.enableSearch,
    job: parsed.job,
    result: parsed.result,
    originalResult: parsed.originalResult,
    viewMode: parsed.viewMode === "edit" ? "edit" : "read",
  };
}

function writeEntry(toolKey: AiToolKey, state: PersistedJobState): void {
  if (typeof window === "undefined") return;
  const entry: StoredEntry = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    ...state,
  };
  try {
    window.localStorage.setItem(buildPersistKey(toolKey), JSON.stringify(entry));
  } catch {
    // 配额满或私密浏览模式，忽略
  }
}

export function clearPersistedJob(toolKey: AiToolKey): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(buildPersistKey(toolKey));
}

interface HookSlice {
  state: PersistedJobState;
  forToolKey: AiToolKey | null;
}

export function usePersistedJob(toolKey: AiToolKey) {
  const [slice, setSlice] = useState<HookSlice>({
    state: DEFAULT_STATE,
    forToolKey: null,
  });

  // Initial hydration & toolKey switch: read localStorage and apply.
  // This is a legitimate one-time SSR-safe hydration (Server returns DEFAULT_STATE,
  // client mounts and reads localStorage). Cascading renders here are intentional
  // and bounded by `forToolKey` guard.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlice({ state: readEntry(toolKey) ?? DEFAULT_STATE, forToolKey: toolKey });
  }, [toolKey]);

  // Cross-tab sync: respond to other tabs' writes by re-reading.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: StorageEvent) => {
      if (event.key !== buildPersistKey(toolKey)) return;
      setSlice({ state: readEntry(toolKey) ?? DEFAULT_STATE, forToolKey: toolKey });
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [toolKey]);

  const update = useCallback(
    (patch: Partial<PersistedJobState>) => {
      setSlice((prev) => {
        const nextState = { ...prev.state, ...patch };
        writeEntry(toolKey, nextState);
        return { state: nextState, forToolKey: toolKey };
      });
    },
    [toolKey],
  );

  const reset = useCallback(() => {
    clearPersistedJob(toolKey);
    setSlice({ state: DEFAULT_STATE, forToolKey: toolKey });
  }, [toolKey]);

  const hydrated = slice.forToolKey === toolKey;
  return { state: slice.state, hydrated, update, reset };
}

export function readActiveTool(): AiToolKey | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_TOOL_KEY);
  if (raw === "lessonPolish" || raw === "ideologyMining" || raw === "questionAnalysis" || raw === "examCheck") {
    return raw;
  }
  return null;
}

export function writeActiveTool(toolKey: AiToolKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_TOOL_KEY, toolKey);
  } catch {
    // ignore
  }
}
