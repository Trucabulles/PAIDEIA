import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/react";
import { importBankFiles } from "./resourceBankPackage";

type Bank = { id: string; name: string };

export function useResourceBankTransfer(options: {
  banks: readonly Bank[];
  extensions: readonly string[];
  onImport: (files: File[]) => Promise<void>;
  onExport: (bankIds: string[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const { banks, extensions, onImport, onExport } = options;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedCount = banks.filter((bank) => selected.has(bank.id)).length;
  const allSelected = banks.length > 0 && selectedCount === banks.length;

  useEffect(() => {
    const available = new Set(banks.map((bank) => bank.id));
    setSelected((current) => {
      if ([...current].every((id) => available.has(id))) return current;
      return new Set([...current].filter((id) => available.has(id)));
    });
  }, [banks]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
  }, [selectedCount, allSelected]);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      await onImport(await importBankFiles(file, extensions));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!selectedCount || busy) return;
    setBusy(true);
    setError("");
    try {
      await onExport(banks.filter((bank) => selected.has(bank.id)).map((bank) => bank.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return {
    selectAll: <label className="resource-bank-select-all">
      <input
        ref={selectAllRef}
        checked={allSelected}
        disabled={busy || banks.length === 0}
        onChange={(event) => setSelected(event.target.checked ? new Set(banks.map((bank) => bank.id)) : new Set())}
        type="checkbox"
      />
      {t("common.selectAll")}
    </label>,
    actions: <div className="resource-bank-transfer-actions">
      <input
        ref={inputRef}
        accept={[...extensions.map((extension) => `.${extension}`), ".zip"].join(",")}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void handleFile(file);
        }}
        type="file"
      />
      <button className="resource-bank-transfer-button" disabled={busy} onClick={() => inputRef.current?.click()} type="button">
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
        {t("common.import")}
      </button>
      <button className="resource-bank-transfer-button" disabled={busy || !selectedCount} onClick={() => void handleExport()} type="button">
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M12 20V10m0 0 4 4m-4-4-4 4M5 6h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
        {t("resources.exportCharacters", { count: selectedCount })}
      </button>
    </div>,
    error: error ? <p className="resource-bank-transfer-error" role="alert">{error}</p> : null,
    checkbox: (bank: Bank) => <label className="resource-bank-tile-select" onClick={(event) => event.stopPropagation()}>
      <input
        aria-label={`${t("resources.selectCharacter")} — ${bank.name}`}
        checked={selected.has(bank.id)}
        disabled={busy}
        onChange={(event) => setSelected((current) => {
          const next = new Set(current);
          if (event.target.checked) next.add(bank.id); else next.delete(bank.id);
          return next;
        })}
        type="checkbox"
      />
    </label>
  };
}
