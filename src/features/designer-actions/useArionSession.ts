import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { DesignerActionPreview, DesignerConversationDraft } from "./designerActionEngine";
import type { DesignerSlotId } from "./designerSlotRegistry";
import type { ResolvedDesignerSocialMediaEffect } from "./designerSocialRegistry";
import { useDesignerUsage } from "./designerUsage";
import { createArionConversationSession, type ArionConversationSession } from "./arionConversationSession";
import { createArionIntentAuthority, type ArionExecutionIntent } from "./arionIntentAuthority";
export type { ArionConversationSession } from "./arionConversationSession";

function createArionSessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `arion-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useArionConversation(session: ArionConversationSession) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return {
    ...snapshot,
    setCommand: session.setCommand,
    setHistory: session.setHistory,
    setDocumentationChoices: session.setDocumentationChoices,
    setMode: session.setMode
  };
}

export function useArionSession() {
  const sessionIdRef = useRef("");
  if (!sessionIdRef.current) sessionIdRef.current = createArionSessionId();

  const [designerActionsOpen, setDesignerActionsOpen] = useState(false);
  const [surface, setSurface] = useState<"anchored" | "detached">("anchored");
  const [designerActionPreview, setDesignerActionPreview] = useState<DesignerActionPreview | null>(null);
  const [designerActionCommand, setDesignerActionCommand] = useState("");
  const [designerActionStatus, setDesignerActionStatus] = useState<"idle" | "applied" | "undone">("idle");
  const [designerActionError, setDesignerActionError] = useState("");
  const [designerActionFeedback, setDesignerActionFeedback] = useState("");
  const [designerConversationDraft, setDesignerConversationDraft] = useState<DesignerConversationDraft | null>(null);
  const [designerActionQuestion, setDesignerActionQuestion] = useState<DesignerSlotId | null>(null);
  const [designerAssistantMessage, setDesignerAssistantMessage] = useState("");
  const [designerSocialTurnActive, setDesignerSocialTurnActive] = useState(false);
  const [designerSocialEffect, setDesignerSocialEffect] = useState<{ effect: ResolvedDesignerSocialMediaEffect; key: number } | null>(null);
  const [designerBackgroundImageFile, setDesignerBackgroundImageFile] = useState<File | null>(null);

  const conversationRef = useRef<ArionConversationSession | null>(null);
  if (!conversationRef.current) conversationRef.current = createArionConversationSession();

  const designerSocialEffectSequenceRef = useRef(0);
  const designerSocialResponseHistoryRef = useRef<Record<string, string>>({});
  const designerUnknownResponseRef = useRef("");
  const designerConversationDraftRef = useRef<DesignerConversationDraft | null>(null);
  const designerActionContextPathRef = useRef("");
  const designerAppliedHistoryRef = useRef<Array<{ path: string; preview: DesignerActionPreview }>>([]);
  const designerUndoClarificationRef = useRef(false);
  const designerActionsPreviousFocusRef = useRef<HTMLElement | null>(null);
  const contextEpochRef = useRef(0);
  const pendingIntentRef = useRef<ArionExecutionIntent | null>(null);
  const intentAuthorityRef = useRef(createArionIntentAuthority());
  const designerUsage = useDesignerUsage();
  const advanceContextEpoch = useCallback(() => {
    contextEpochRef.current += 1;
    return contextEpochRef.current;
  }, []);

  return {
    sessionId: sessionIdRef.current,
    surface,
    setSurface,
    conversation: conversationRef.current,
    designerActionsOpen,
    setDesignerActionsOpen,
    designerActionPreview,
    setDesignerActionPreview,
    designerActionCommand,
    setDesignerActionCommand,
    designerActionStatus,
    setDesignerActionStatus,
    designerActionError,
    setDesignerActionError,
    designerActionFeedback,
    setDesignerActionFeedback,
    designerConversationDraft,
    setDesignerConversationDraft,
    designerActionQuestion,
    setDesignerActionQuestion,
    designerAssistantMessage,
    setDesignerAssistantMessage,
    designerSocialTurnActive,
    setDesignerSocialTurnActive,
    designerSocialEffect,
    setDesignerSocialEffect,
    designerBackgroundImageFile,
    setDesignerBackgroundImageFile,
    designerSocialEffectSequenceRef,
    designerSocialResponseHistoryRef,
    designerUnknownResponseRef,
    designerConversationDraftRef,
    designerActionContextPathRef,
    designerAppliedHistoryRef,
    designerUndoClarificationRef,
    designerActionsPreviousFocusRef,
    contextEpochRef,
    pendingIntentRef,
    intentAuthority: intentAuthorityRef.current,
    advanceContextEpoch,
    designerUsage
  };
}

export type ArionSession = ReturnType<typeof useArionSession>;
