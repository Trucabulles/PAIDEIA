import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createObservation,
  deleteObservationMessage,
  listObservations,
  purgeObservations,
  replyObservation,
  setObservationResolved
} from "./observationApi";
import type { ObservationState, ObservationTarget } from "./observationTypes";
import type { AppLanguage, TranslationParams } from "../../i18n";

const EMPTY_STATE: ObservationState = {
  threads: [], currentUserId: "", currentUserDisplayName: "", collaborative: false, canResolve: false, canPurge: false, revision: ""
};

export function useObservations(
  projectPath: string,
  active: boolean,
  scopeKey: string,
  language: AppLanguage,
  t: (key: string, params?: TranslationParams, fallback?: string) => string
) {
  const [state, setState] = useState<ObservationState>(EMPTY_STATE);
  const [enabled, setEnabled] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [target, setTarget] = useState<ObservationTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const localizedError = useCallback((reason: unknown) => {
    const message = String(reason);
    if (message.includes("Bibliothèque collaborative indisponible")) return t("collaboration.libraryUnavailable");
    return language === "fr" ? message : t("collaboration.operationFailed");
  }, [language, t]);
  const refresh = useCallback(async () => {
    if (!active || !projectPath) return;
    const request = ++requestRef.current;
    try {
      const next = await listObservations(projectPath);
      if (request === requestRef.current) {
        setState(next);
        setError("");
      }
    } catch (reason) {
      if (request === requestRef.current) setError(String(reason));
    }
  }, [active, projectPath]);

  useEffect(() => {
    setState(EMPTY_STATE);
    setEnabled(false);
    setPanelOpen(false);
    setTarget(null);
    setError("");
    if (active && projectPath) void refresh();
  }, [active, projectPath, refresh, scopeKey]);

  useEffect(() => {
    if (!active || !projectPath || (!enabled && !panelOpen)) return;
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => window.clearInterval(timer);
  }, [active, enabled, panelOpen, projectPath, refresh]);

  const run = useCallback(async (operation: () => Promise<ObservationState>) => {
    if (pending) return false;
    setPending(true);
    setError("");
    try {
      setState(await operation());
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    } finally {
      setPending(false);
    }
  }, [pending]);

  const openTarget = useCallback((next: ObservationTarget) => {
    setTarget(next);
    setEnabled(true);
    setPanelOpen(true);
  }, []);

  const openReview = useCallback(() => {
    setTarget(null);
    setEnabled(true);
    setPanelOpen(true);
  }, []);

  const threadsByBlock = useMemo(() => {
    const result = new Map<string, ObservationState["threads"]>();
    for (const thread of state.threads) {
      const current = result.get(thread.blockId) ?? [];
      current.push(thread);
      result.set(thread.blockId, current);
    }
    return result;
  }, [state.threads]);

  return {
    state, enabled, panelOpen, target, pending, error: error ? localizedError(error) : "", threadsByBlock,
    activeCount: state.threads.filter((thread) => !thread.resolved).length,
    setEnabled,
    setPanelOpen,
    setTarget,
    openTarget,
    openReview,
    refresh,
    create: (nextTarget: ObservationTarget, text: string) => run(() => createObservation(projectPath, nextTarget, text)),
    reply: (threadId: string, text: string) => run(() => replyObservation(projectPath, threadId, text)),
    resolve: (threadId: string, resolved: boolean) => run(() => setObservationResolved(projectPath, threadId, resolved)),
    deleteMessage: (messageId: string) => run(() => deleteObservationMessage(projectPath, messageId)),
    purge: () => run(() => purgeObservations(projectPath))
  };
}

export type ObservationsController = ReturnType<typeof useObservations>;
