import { useEffect, useMemo, useRef, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createTranslator } from "../../i18n";
import { I18nProvider } from "../../i18n/react";
import { createArionConversationSession } from "./arionConversationSession";
import { DesignerActionsPanel } from "./DesignerActionsPanel";
import "./arionDetached.css";

declare global { interface Window { __ARION_COMPACT__?: boolean; } }
import {
  ARION_ACTION_EVENT,
  ARION_CLOSED_EVENT,
  ARION_COMMAND_EVENT,
  ARION_CONVERSATION_EVENT,
  ARION_READY_EVENT,
  ARION_STATE_EVENT,
  type ArionActionName,
  type ArionDetachedViewState
} from "./arionWindowBridge";

export function ArionDetachedWindow() {
  const conversation = useMemo(() => createArionConversationSession(), []);
  const detachedWindow = useMemo(() => getCurrentWindow(), []);
  const [view, setView] = useState<ArionDetachedViewState | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const hydratingRef = useRef(false);

  useEffect(() => {
    const unlisteners = Promise.all([
      listen<ArionDetachedViewState>(ARION_STATE_EVENT, ({ payload }) => {
        hydratingRef.current = true;
        conversation.replaceSnapshot(payload.conversation);
        setView(payload);
        void emitTo("main", ARION_READY_EVENT, { sessionId: payload.sessionId });
        queueMicrotask(() => { hydratingRef.current = false; });
      }),
      detachedWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        await emitTo("main", ARION_CLOSED_EVENT);
      })
    ]);
    void unlisteners.then(() => emitTo("main", ARION_READY_EVENT, {}));
    return () => { void unlisteners.then((values) => values.forEach((unlisten) => unlisten())); };
  }, [conversation, detachedWindow]);

  useEffect(() => {
    const refreshMaximizedState = () => void detachedWindow.isMaximized().then(setIsMaximized);
    refreshMaximizedState();
    const unlisten = detachedWindow.onResized(refreshMaximizedState);
    return () => { void unlisten.then((stop) => stop()); };
  }, [detachedWindow]);

  useEffect(() => conversation.subscribe(() => {
    if (!view || hydratingRef.current) return;
    void emitTo("main", ARION_CONVERSATION_EVENT, { sessionId: view.sessionId, conversation: conversation.getSnapshot() });
  }), [conversation, view]);

  if (!view) return <main className="arion-detached-loading">Arion</main>;
  const t = createTranslator(view.language);
  const action = (name: ArionActionName, value?: string) => emitTo("main", ARION_ACTION_EVENT, { sessionId: view.sessionId, action: name, value });
  return (
    <I18nProvider language={view.language} t={t}>
      <main className={`arion-detached-root ${window.__ARION_COMPACT__ ? "arion-compact" : "arion-desktop"} ${isMaximized ? "arion-maximized" : ""}`}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          if (event.button === 0 && event.detail === 1 && target.closest(".designer-actions-header") && !target.closest("button, input, select, a")) {
            event.preventDefault();
            void detachedWindow.startDragging();
          }
        }}
        onDoubleClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest(".designer-actions-header") && !target.closest("button, input, select, a")) {
            void detachedWindow.toggleMaximize();
          }
        }}>
        <DesignerActionsPanel
          {...view.panel}
          conversation={conversation}
          onAnalyze={(command, snapshot) => void emitTo("main", ARION_COMMAND_EVENT, { sessionId: view.sessionId, command, conversation: snapshot })}
          onApply={() => void action("apply")}
          onCancel={() => void action("cancel")}
          onClose={() => void action("dock")}
          onImageSelect={() => void action("dock-for-image")}
          onResetConversation={() => void action("reset")}
          onUndo={() => void action("undo")}
          onExamineDestructiveAction={() => void action("destructive-examine")}
          onConfirmDestructiveAction={() => void action("destructive-confirm")}
          onCancelDestructiveAction={() => void action("destructive-cancel")}
          onUndoDestructiveAction={() => void action("destructive-undo")}
          open
          translate={t}
          windowControls={{
            isMaximized,
            onMinimize: () => void detachedWindow.minimize(),
            onToggleMaximize: () => void detachedWindow.toggleMaximize()
          }}
          usage={{
            ...view.panel.usage,
            clear: () => void action("usage-clear"),
            toggle: () => void action("usage-toggle"),
            remove: (id) => void action("usage-remove", id)
          }}
        />
        {!isMaximized ? (["North", "South", "East", "West", "NorthEast", "NorthWest", "SouthEast", "SouthWest"] as const).map(direction => (
          <div key={direction} className={`arion-resize arion-resize-${direction}`} aria-hidden="true"
            onMouseDown={event => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              void getCurrentWindow().startResizeDragging(direction);
            }} />
        )) : null}
      </main>
    </I18nProvider>
  );
}
