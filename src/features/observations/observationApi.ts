import { invokeCommand } from "../../lib/tauri";
import type { ObservationState, ObservationTarget } from "./observationTypes";

function command(projectPath: string, local: string, args: Record<string, unknown>): Promise<ObservationState> {
  return invokeCommand<ObservationState>(local, { projectPath, ...args });
}

export function listObservations(projectPath: string): Promise<ObservationState> {
  return command(projectPath, "list_observations", {});
}

export function createObservation(projectPath: string, target: ObservationTarget, text: string): Promise<ObservationState> {
  return command(projectPath, "create_observation", {
    chapterId: target.chapterId,
    pageId: target.pageId,
    blockId: target.blockId,
    blockLabel: target.blockLabel,
    text
  });
}

export function replyObservation(projectPath: string, threadId: string, text: string): Promise<ObservationState> {
  return command(projectPath, "reply_observation", { threadId, text });
}

export function setObservationResolved(projectPath: string, threadId: string, resolved: boolean): Promise<ObservationState> {
  return command(projectPath, "set_observation_resolved", { threadId, resolved });
}

export function deleteObservationMessage(projectPath: string, messageId: string): Promise<ObservationState> {
  return command(projectPath, "delete_observation_message", { messageId });
}

export function purgeObservations(projectPath: string): Promise<ObservationState> {
  return command(projectPath, "purge_observations", {});
}
