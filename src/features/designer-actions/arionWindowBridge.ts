import type { AppLanguage } from "../../i18n";
import type { ArionConversationSnapshot } from "./arionConversationSession";
import { normalizeRecognition as normalizeDesignerText } from "./designerRecognition.mjs";
import type { DesignerActionsPanelViewModel } from "./DesignerActionsPanel";

export const ARION_WINDOW_LABEL = "arion";
export const ARION_STATE_EVENT = "paideia://arion/state";
export const ARION_READY_EVENT = "paideia://arion/ready";
export const ARION_COMMAND_EVENT = "paideia://arion/command";
export const ARION_CONVERSATION_EVENT = "paideia://arion/conversation";
export const ARION_ACTION_EVENT = "paideia://arion/action";
export const ARION_CLOSED_EVENT = "paideia://arion/closed";

export type ArionDetachedPanelModel = Omit<DesignerActionsPanelViewModel, "translate" | "usage"> & {
  usage: Pick<DesignerActionsPanelViewModel["usage"], "enabled" | "error" | "suggestions">;
};

export type ArionDetachedViewState = {
  sessionId: string;
  language: AppLanguage;
  panel: ArionDetachedPanelModel;
  conversation: ArionConversationSnapshot;
};

export type ArionCommandPayload = {
  sessionId: string;
  command: string;
  conversation: ArionConversationSnapshot;
};

export type ArionConversationPayload = {
  sessionId: string;
  conversation: ArionConversationSnapshot;
};

export type ArionActionName = "apply" | "cancel" | "undo" | "reset" | "dock" | "dock-for-image" | "destructive-examine" | "destructive-confirm" | "destructive-cancel" | "destructive-undo" | "usage-clear" | "usage-toggle" | "usage-remove";
export type ArionActionPayload = { sessionId: string; action: ArionActionName; value?: string };

export function resolveArionSurfaceCommand(command: string): "detach" | "dock" | null {
  const value = normalizeDesignerText(command).replace(/^\//, "").trim();
  if (/^(?:undock|undock arion|detache toi|detacher arion|ouvre arion (?:dans une )?fenetre separee|mets arion (?:(?:sur (?:le|mon)|au) )?second ecran)$/.test(value)) return "detach";
  if (/^(?:dock|dock arion|reintegre toi(?: dans paideia)?|reintegrer arion|reviens dans paideia|ancrer arion)$/.test(value)) return "dock";
  return null;
}

export function serializeArionPanelModel(model: DesignerActionsPanelViewModel): ArionDetachedPanelModel {
  const { translate: _translate, usage, ...serializable } = model;
  return {
    ...serializable,
    usage: { enabled: usage.enabled, error: usage.error, suggestions: usage.suggestions.map(({ id, command }) => ({ id, command })) }
  };
}
