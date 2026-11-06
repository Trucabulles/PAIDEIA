type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  }
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (!invoke) {
    throw new Error("Tauri runtime unavailable");
  }

  const startedAt = performance.now();
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (command !== "log_dev_event") {
      await invoke<void>("log_dev_event", {
        level: "error",
        message: "Tauri command failed",
        context: {
          command,
          argumentNames: Object.keys(args ?? {}).sort(),
          durationMs: Math.round(performance.now() - startedAt),
          errorName: error instanceof Error ? error.name : null,
          error: error instanceof Error ? error.message : String(error)
        }
      }).catch(() => {
        // The original command error remains authoritative if logging also fails.
      });
    }
    throw error;
  }
}

export function isTauriRuntimeAvailable(): boolean {
  return typeof window.__TAURI_INTERNALS__?.invoke === "function";
}
