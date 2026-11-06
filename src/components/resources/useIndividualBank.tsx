import { useEffect, useRef, useState } from "react";
import { loadResourceBank, type BankFamily, type BankLoadingState } from "../../lib/resourceBankApi";
import { useI18n } from "../../i18n/react";

export function useIndividualBank<T extends BankLoadingState & { id: string; name: string }>(family: BankFamily, banks: T[], onChange: (banks: T[]) => void) {
  const { t } = useI18n();
  const current = useRef({ banks, onChange });
  current.current = { banks, onChange };
  const [loading, setLoading] = useState(0);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState("");
  const openSequence = useRef(0);
  useEffect(() => {
    if (!loading) { setShowLoading(false); return; }
    const timer = window.setTimeout(() => setShowLoading(true), 350);
    return () => window.clearTimeout(timer);
  }, [loading]);
  async function load(bank: T): Promise<T> {
    if (bank.contentLoaded !== false) return bank;
    setLoading(count => count + 1);
    setError("");
    try {
      let loaded = await loadResourceBank(family, bank);
      const latest = current.current;
      const draft = latest.banks.find(candidate => candidate.id === bank.id);
      if (draft && draft !== bank) {
        if (draft.contentLoaded !== false) loaded = draft;
        else {
          const content = family === "questions" ? "questions" : "entries";
          const data = loaded as unknown as Record<string, unknown>;
          loaded = { ...loaded, ...draft, contentLoaded: true, contentCount: undefined,
            [content]: data[content], ...(family === "assistants" ? { fallbackResponses: data.fallbackResponses } : {}) };
        }
      }
      const next = latest.banks.map(candidate => candidate.id === bank.id ? loaded : candidate);
      current.current = { ...latest, banks: next };
      latest.onChange(next);
      return loaded;
    } finally { setLoading(count => count - 1); }
  }
  const report = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));
  function open(bank: T, select: (bank: T) => void) {
    const sequence = ++openSequence.current;
    void load(bank).then(loaded => { if (sequence === openSequence.current) select(loaded); }).catch(report);
  }
  return { load, open, report, notice: <>{showLoading && loading ? <div className="import-blocking-backdrop" role="presentation">
    <section className="import-status-modal" role="dialog" aria-modal="true" aria-live="polite" aria-labelledby={`${family}-bank-loading-title`}>
      <div className="import-spinner" aria-hidden="true" />
      <h2 id={`${family}-bank-loading-title`}>{t("pdf.loading")}</h2>
    </section>
  </div> : null}{error ? <p role="alert">{error}</p> : null}</> };
}
