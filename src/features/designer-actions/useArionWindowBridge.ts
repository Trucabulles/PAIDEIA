import { useCallback, useEffect, useMemo, useRef } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import type { AppLanguage } from "../../i18n";
import { invokeCommand, isTauriRuntimeAvailable } from "../../lib/tauri";
import type { ArionConversationSession, ArionConversationSnapshot } from "./arionConversationSession";
import type { DesignerActionsPanelViewModel } from "./DesignerActionsPanel";
import {
  ARION_ACTION_EVENT,
  ARION_CLOSED_EVENT,
  ARION_COMMAND_EVENT,
  ARION_CONVERSATION_EVENT,
  ARION_READY_EVENT,
  ARION_STATE_EVENT,
  ARION_WINDOW_LABEL,
  serializeArionPanelModel,
  type ArionActionPayload,
  type ArionCommandPayload,
  type ArionConversationPayload,
  type ArionDetachedViewState
} from "./arionWindowBridge";

type Handlers = {
  analyze: (command: string) => void;
  apply: () => void;
  cancel: () => void;
  undo: () => void;
  destructiveExamine: () => void;
  destructiveConfirm: () => void;
  destructiveCancel: () => void;
  destructiveUndo: () => void;
  reset: () => void;
  usageClear: () => void;
  usageToggle: () => void;
  usageRemove: (id: string) => void;
  onDocked: () => void;
  onError: (message: string) => void;
};

type Options = {
  sessionId: string;
  language: AppLanguage;
  surface: "anchored" | "detached";
  setSurface: (value: "anchored" | "detached") => void;
  conversation: ArionConversationSession;
  panel: DesignerActionsPanelViewModel;
  handlers: Handlers;
};

export function useArionWindowBridge(options: Options) {
  const handlersRef = useRef(options.handlers);
  const pendingDetachRef = useRef<{ resolve: (value: boolean) => void; timer: number } | null>(null);
  handlersRef.current = options.handlers;
  const state = useMemo<ArionDetachedViewState>(() => ({
    sessionId: options.sessionId,
    language: options.language,
    panel: serializeArionPanelModel(options.panel),
    conversation: options.conversation.getSnapshot()
  }), [options.sessionId, options.language, options.panel, options.conversation]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const publish = useCallback(async () => {
    if (!isTauriRuntimeAvailable()) return;
    await emitTo(ARION_WINDOW_LABEL, ARION_STATE_EVENT, stateRef.current);
  }, []);

  const detach = useCallback(async () => {
    if (!isTauriRuntimeAvailable()) {
      handlersRef.current.onError("La fenêtre détachable Arion est disponible uniquement dans l’application de bureau.");
      return false;
    }
    if (options.surface === "detached") {
      await invokeCommand<void>("open_arion_window").catch((error) => {
        handlersRef.current.onError(error instanceof Error ? error.message : String(error));
      });
      return true;
    }
    try {
      if (pendingDetachRef.current) return false;
      const acknowledged = new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => {
          pendingDetachRef.current = null;
          resolve(false);
        }, 5000);
        pendingDetachRef.current = { resolve, timer };
      });
      const panel = document.querySelector<HTMLElement>(".designer-actions-panel");
      const bounds = panel?.getBoundingClientRect();
      await invokeCommand<void>("open_arion_window", {
        width: bounds?.width ?? 650,
        height: bounds?.height ?? 680,
        compact: window.matchMedia("(max-width: 720px)").matches
      });
      await publish();
      const ready = await acknowledged;
      if (!ready) {
        await invokeCommand<void>("close_arion_window").catch(() => undefined);
        handlersRef.current.onError("La fenêtre Arion ne s’est pas initialisée. Arion reste ancré dans PAIDEIA.");
      }
      return ready;
    } catch (error) {
      if (pendingDetachRef.current) {
        window.clearTimeout(pendingDetachRef.current.timer);
        pendingDetachRef.current.resolve(false);
        pendingDetachRef.current = null;
      }
      handlersRef.current.onError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }, [options.surface, publish]);

  const dock = useCallback(async () => {
    options.setSurface("anchored");
    handlersRef.current.onDocked();
    if (isTauriRuntimeAvailable()) await invokeCommand<void>("close_arion_window").catch(() => undefined);
  }, [options.setSurface]);

  useEffect(() => {
    if (options.surface === "detached") void publish();
  }, [options.surface, state, publish]);

  useEffect(() => {
    if (!isTauriRuntimeAvailable()) return;
    const unlisteners = Promise.all([
      listen<{ sessionId?: string }>(ARION_READY_EVENT, ({ payload }) => {
        if (payload.sessionId !== options.sessionId) {
          void publish();
          return;
        }
        const pending = pendingDetachRef.current;
        if (pending) {
          window.clearTimeout(pending.timer);
          pendingDetachRef.current = null;
          options.setSurface("detached");
          pending.resolve(true);
        }
      }),
      listen<ArionConversationPayload>(ARION_CONVERSATION_EVENT, ({ payload }) => {
        if (payload.sessionId === options.sessionId) options.conversation.replaceSnapshot(payload.conversation);
      }),
      listen<ArionCommandPayload>(ARION_COMMAND_EVENT, ({ payload }) => {
        if (payload.sessionId !== options.sessionId) return;
        options.conversation.replaceSnapshot(payload.conversation);
        handlersRef.current.analyze(payload.command);
      }),
      listen<ArionActionPayload>(ARION_ACTION_EVENT, ({ payload }) => {
        if (payload.sessionId !== options.sessionId) return;
        if (payload.action === "apply") handlersRef.current.apply();
        else if (payload.action === "cancel") handlersRef.current.cancel();
        else if (payload.action === "undo") handlersRef.current.undo();
        else if (payload.action === "destructive-examine") handlersRef.current.destructiveExamine();
        else if (payload.action === "destructive-confirm") handlersRef.current.destructiveConfirm();
        else if (payload.action === "destructive-cancel") handlersRef.current.destructiveCancel();
        else if (payload.action === "destructive-undo") handlersRef.current.destructiveUndo();
        else if (payload.action === "reset") handlersRef.current.reset();
        else if (payload.action === "usage-clear") handlersRef.current.usageClear();
        else if (payload.action === "usage-toggle") handlersRef.current.usageToggle();
        else if (payload.action === "usage-remove" && payload.value) handlersRef.current.usageRemove(payload.value);
        else if (payload.action === "dock" || payload.action === "dock-for-image") void dock();
      }),
      listen(ARION_CLOSED_EVENT, () => {
        void dock();
      })
    ]);
    return () => { void unlisteners.then((values) => values.forEach((unlisten) => unlisten())); };
  }, [dock, options.conversation, options.sessionId, options.setSurface, publish]);

  useEffect(() => {
    if (options.surface === "detached" && options.panel.questionControl === "image") {
      handlersRef.current.onError("La sélection du fichier continue dans PAIDEIA : Arion a été réancré.");
      void dock();
    }
  }, [dock, options.panel.questionControl, options.surface]);

  return { detach, dock };
}
