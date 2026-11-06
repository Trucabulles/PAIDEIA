export type ArionConversationEntry = {
  role: "user" | "arion";
  text: string;
};

export type ArionDocumentationChoice = {
  id: string;
  command: string;
};

export type ArionConversationMode = "auto" | "help" | "actions";

export type ArionConversationSnapshot = {
  command: string;
  history: ArionConversationEntry[];
  documentationChoices: ArionDocumentationChoice[];
  mode: ArionConversationMode;
};

type StateUpdate<T> = T | ((value: T) => T);

export type ArionConversationSession = {
  getSnapshot: () => ArionConversationSnapshot;
  subscribe: (listener: () => void) => () => void;
  replaceSnapshot: (value: ArionConversationSnapshot) => void;
  setCommand: (value: StateUpdate<string>) => void;
  setHistory: (value: StateUpdate<ArionConversationEntry[]>) => void;
  setDocumentationChoices: (value: StateUpdate<ArionDocumentationChoice[]>) => void;
  setMode: (value: StateUpdate<ArionConversationMode>) => void;
};

function resolveStateUpdate<T>(current: T, update: StateUpdate<T>): T {
  return typeof update === "function" ? (update as (value: T) => T)(current) : update;
}

export function createArionConversationSession(): ArionConversationSession {
  let snapshot: ArionConversationSnapshot = { command: "", history: [], documentationChoices: [], mode: "auto" };
  const listeners = new Set<() => void>();
  const update = (next: ArionConversationSnapshot) => {
    if (Object.is(next, snapshot)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replaceSnapshot: (value) => update({
      command: value.command,
      history: [...value.history],
      documentationChoices: [...value.documentationChoices],
      mode: value.mode ?? "auto"
    }),
    setCommand: (value) => update({ ...snapshot, command: resolveStateUpdate(snapshot.command, value) }),
    setHistory: (value) => update({ ...snapshot, history: resolveStateUpdate(snapshot.history, value) }),
    setDocumentationChoices: (value) => update({
      ...snapshot,
      documentationChoices: resolveStateUpdate(snapshot.documentationChoices, value)
    }),
    setMode: (value) => update({ ...snapshot, mode: resolveStateUpdate(snapshot.mode, value) })
  };
}
