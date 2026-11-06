import { invokeCommand } from "./tauri";

export type BankFamily = "questions" | "references" | "assistants";
export type BankLoadingState = { contentLoaded?: boolean; contentCount?: number; loadError?: string; resourceModifiedAt?: number | null };
type Bank = BankLoadingState & { id: string; name: string };
const baselines = new Map<string, string>();
const key = (family: BankFamily, bank: Bank) => `${family}:${bank.id}:${bank.contentLoaded === false ? "summary" : "content"}`;
async function signature(bank: Bank) {
  const { contentLoaded, contentCount, loadError, resourceModifiedAt, ...data } = bank;
  // Keep fingerprints, not a second copy of detailed HTML/base64 in memory.
  const text = JSON.stringify(data, (_, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function listResourceBanks<T extends Bank>(family: BankFamily): Promise<T[]> {
  let catalog: { banks: T[]; errors: Array<{ path: string; message: string }> };
  try {
    catalog = await invokeCommand("resource_bank_catalog", { family });
  } catch (error) {
    window.dispatchEvent(new CustomEvent("paideia-bank-errors", { detail: { family, errors: [{ path: family, message: String(error) }] } }));
    throw error;
  }
  const banks = catalog.banks;
  for (const bank of banks) {
    if (family === "assistants") Object.assign(bank, { fallbackResponses: [] });
    baselines.set(key(family, bank), await signature(bank));
  }
  // Corruption is visible, never silently converted into an empty catalog.
  window.dispatchEvent(new CustomEvent("paideia-bank-errors", { detail: { family, errors: catalog.errors } }));
  return banks;
}
export async function loadResourceBank<T extends Bank>(family: BankFamily, bank: T): Promise<T> {
  if (bank.contentLoaded !== false) return bank;
  const loaded = await invokeCommand<T>("resource_bank_load", { family, bankId: bank.id });
  baselines.set(key(family, loaded), await signature(loaded));
  // Preserve metadata edits made in the tile list before loading its content.
  const content = family === "questions" ? "questions" : "entries";
  const merged = { ...loaded, ...bank, resourceModifiedAt: loaded.resourceModifiedAt ?? bank.resourceModifiedAt, contentLoaded: true, contentCount: undefined } as T;
  Object.assign(merged, { [content]: (loaded as unknown as Record<string, unknown>)[content] });
  if (family === "assistants") Object.assign(merged, { fallbackResponses: (loaded as unknown as Record<string, unknown>).fallbackResponses });
  return merged;
}
export async function saveResourceBanks<T extends Bank>(family: BankFamily, banks: T[], projectPathsToSync: string[] = []): Promise<T[]> {
  const results: T[] = [];
  for (const bank of banks) {
    if (baselines.get(key(family, bank)) === await signature(bank)) { results.push(bank); continue; }
    const saved = await invokeCommand<T>("resource_bank_save", { family, bank, projectPathsToSync });
    const result = bank.contentLoaded === false
      ? { ...bank, ...saved, contentLoaded: false, [family === "questions" ? "questions" : "entries"]: [], ...(family === "assistants" ? { fallbackResponses: [] } : {}) } as T
      : saved;
    baselines.set(key(family, result), await signature(result));
    results.push(result);
  }
  return results;
}
export async function deleteResourceBank<T extends Bank>(family: BankFamily, id: string, projectPathsToSync: string[] = []): Promise<T[]> {
  await invokeCommand("resource_bank_delete", { family, bankId: id, projectPathsToSync });
  baselines.delete(`${family}:${id}:summary`);
  baselines.delete(`${family}:${id}:content`);
  return listResourceBanks<T>(family);
}
export async function uploadResourceBankImage<T extends Bank>(family: BankFamily, id: string, file: File): Promise<T[]> {
  const saved = await invokeCommand<T>("resource_bank_image", { family, bankId: id, fileName: file.name, fileBytes: Array.from(new Uint8Array(await file.arrayBuffer())) });
  baselines.set(key(family, saved), await signature(saved));
  return [saved];
}
