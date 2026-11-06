import type { DesignerActionPreview } from "./designerActionModel";

export type ArionIntentKind = "apply" | "undo";

export type ArionExecutionIntent = {
  intentId: string;
  sessionId: string;
  contextEpoch: number;
  projectPath: string;
  kind: ArionIntentKind;
  preview: DesignerActionPreview;
};

export type ArionAuthorityContext = {
  sessionId: string;
  contextEpoch: number;
  projectPath: string;
  canWrite: boolean;
};

export type ArionIntentValidation =
  | { valid: true }
  | { valid: false; reason: "duplicate" | "session" | "context" | "project" | "read-only" | "target" };

function createIntentId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `arion-intent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createArionExecutionIntent(
  kind: ArionIntentKind,
  context: Omit<ArionAuthorityContext, "canWrite">,
  preview: DesignerActionPreview
): ArionExecutionIntent {
  return { intentId: createIntentId(), kind, preview, ...context };
}

export function designerPreviewMatchesCurrent(prepared: DesignerActionPreview, current: DesignerActionPreview): boolean {
  const observed = [...current.targets, ...current.unchanged];
  return prepared.targets.every((target) => {
    const value = observed.find((candidate) =>
      candidate.pageId === target.pageId &&
      candidate.blockId === target.blockId &&
      candidate.property === target.property
    );
    return Boolean(
      value &&
      value.previousValue === target.previousValue &&
      Boolean(value.previousUnset) === Boolean(target.previousUnset)
    );
  });
}

export function createArionIntentAuthority() {
  const claimedIntentIds = new Set<string>();
  const authority = {
    validate(intent: ArionExecutionIntent, context: ArionAuthorityContext): ArionIntentValidation {
      if (claimedIntentIds.has(intent.intentId)) return { valid: false, reason: "duplicate" };
      if (intent.sessionId !== context.sessionId) return { valid: false, reason: "session" };
      if (intent.projectPath !== context.projectPath) return { valid: false, reason: "project" };
      if (intent.contextEpoch !== context.contextEpoch) return { valid: false, reason: "context" };
      if (!context.canWrite) return { valid: false, reason: "read-only" };
      return { valid: true };
    },
    claim(intentId: string): boolean {
      if (claimedIntentIds.has(intentId)) return false;
      claimedIntentIds.add(intentId);
      return true;
    },
    authorize(
      intent: ArionExecutionIntent,
      context: ArionAuthorityContext,
      currentPreview: DesignerActionPreview
    ): ArionIntentValidation {
      const validation = authority.validate(intent, context);
      if (!validation.valid) return validation;
      if (!designerPreviewMatchesCurrent(intent.preview, currentPreview)) return { valid: false, reason: "target" };
      return authority.claim(intent.intentId) ? { valid: true } : { valid: false, reason: "duplicate" };
    }
  };
  return authority;
}

export type ArionIntentAuthority = ReturnType<typeof createArionIntentAuthority>;
