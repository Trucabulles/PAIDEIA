import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../../i18n/react";
import { downloadTranscriptRtf } from "./transcriptTools";
import styles from "./Transcript.module.css";

export function TranscriptIcon() {
  return (
    <svg aria-hidden="true" className={styles.icon} viewBox="0 0 32 32">
      <path d="M5.5 3.5h12l5 5v19h-17z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M17.5 3.5v5h5M9 13h8M9 17h7M9 21h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M20 17.5h2.4l3-2.4v9.8l-3-2.4H20zM27.2 18.2c1.3 1.1 1.3 4.5 0 5.6M29.2 16.5c2.3 2.1 2.3 6.9 0 9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

type Props = {
  allowDownload?: boolean;
  html: string;
  language?: string | null;
  title: string;
};

export function TranscriptAccessButton({ allowDownload = false, html, language, title }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloadRunning, setDownloadRunning] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    contentRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])')).filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function download() {
    setDownloadError("");
    setDownloadRunning(true);
    try {
      await downloadTranscriptRtf(title, language || "fr", html);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloadRunning(false);
    }
  }

  useEffect(() => {
    if (wasOpenRef.current && !open) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  return (
    <>
      <button
        aria-label={t("transcript.consult", undefined, "Consulter la transcription")}
        className={styles.accessButton}
        onClick={() => setOpen(true)}
        ref={triggerRef}
        title={t("transcript.consult", undefined, "Consulter la transcription")}
        type="button"
      >
        <TranscriptIcon />
      </button>
      {open ? (
        <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section aria-labelledby={titleId} aria-modal="true" className={styles.readerDialog} lang={language || undefined} ref={dialogRef} role="dialog">
            <header className={styles.readerHeader}>
              <div><span>{t("transcript.kicker", undefined, "Transcription audio")}</span><h2 id={titleId}>{title}</h2></div>
              <button aria-label={t("common.close", undefined, "Fermer")} className="ghost-icon-button" onClick={() => setOpen(false)} type="button">×</button>
            </header>
            <div className={styles.readerContent} dangerouslySetInnerHTML={{ __html: html }} ref={contentRef} tabIndex={0} />
            {allowDownload ? (
              <footer className={styles.readerFooter}>
                {downloadError ? <span className={styles.fileError} role="alert">{downloadError}</span> : null}
                <button className="ghost-pill" disabled={downloadRunning} onClick={() => void download()} type="button">
                  {t("transcript.download", undefined, "Télécharger la transcription")}
                </button>
              </footer>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
