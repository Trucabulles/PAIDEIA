import { invokeCommand, isTauriRuntimeAvailable } from "./tauri";

export function canPickScreenColorNatively() {
  return isTauriRuntimeAvailable();
}

export async function pickScreenColorNatively(): Promise<string | null> {
  return invokeCommand<string | null>("pick_screen_color");
}
