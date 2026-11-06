import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import frenchLicenseText from "../../../LICENSE?raw";
import internationalLicenseText from "../../../legal/License-PAIDEIA-International-EN.txt?raw";
import { exportPaideiaLicenseTo, exportThirdPartyNoticesTo } from "../../lib/projectApi";
import { useI18n } from "../../i18n/react";

type LicenseDialogProps = {
  onClose: () => void;
  document?: "license" | "third-party";
};

function renderLicenseContent(licenseText: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = licenseText.split(/\r?\n/);
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) {
      return;
    }
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    const listMatch = line.match(/^(?:-\s+|[•·]\s*|\d+\.\t+)(.+)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    }

    flushList();
    if (line.startsWith("LICENCE PAIDEIA") || line.startsWith("PAIDEIA LICENSE")) {
      return;
    }
    if (/^\d+\.\d+\.\s/.test(line)) {
      nodes.push(<h4 key={`heading-${nodes.length}`}>{line}</h4>);
      return;
    }
    if (/^\d+\.\s/.test(line)) {
      nodes.push(<h3 key={`heading-${nodes.length}`}>{line}</h3>);
      return;
    }
    nodes.push(<p key={`paragraph-${nodes.length}`}>{line}</p>);
  });
  flushList();
  return nodes;
}

export function LicenseDialog({ onClose, document: documentKind = "license" }: LicenseDialogProps) {
  const { language, t } = useI18n();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadRunning, setDownloadRunning] = useState(false);
  const licenseText = language === "fr" ? frenchLicenseText : internationalLicenseText;
  const thirdParty = documentKind === "third-party";
  const [notices, setNotices] = useState<ThirdPartyNotices | null>(null);
  useEffect(() => {
    if (!thirdParty) return;
    let cancelled = false;
    void import("../../../legal/third-party-notices.json").then(module => {
      if (!cancelled) setNotices(module.default);
    }).catch(error => { if (!cancelled) setDownloadError(String(error)); });
    return () => { cancelled = true; };
  }, [thirdParty]);
  const content = useMemo(() => thirdParty
    ? (notices ? <ThirdPartyContent notices={notices} french={language === "fr"} /> : <p>{t("pdf.loading")}</p>)
    : renderLicenseContent(licenseText), [licenseText, thirdParty, notices, language, t]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
          )
        );
        if (!focusable.length) {
          event.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const downloadLicense = async () => {
    if (downloadRunning) return;
    setDownloadRunning(true);
    setDownloadError(null);
    try {
      const destinationPath = await save({
        defaultPath: thirdParty ? "PAIDEIA-Composants-tiers-et-polices.docx" : language === "fr" ? "Licence-PAIDEIA.docx" : "PAIDEIA-License-International-EN.docx",
        filters: [{ name: "Document Word", extensions: ["docx"] }]
      });
      if (!destinationPath) {
        return;
      }

      if (thirdParty) await exportThirdPartyNoticesTo(destinationPath, language);
      else await exportPaideiaLicenseTo(destinationPath, language);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloadRunning(false);
    }
  };

  return (
    <div className="paideia-modal-backdrop license-dialog-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="license-dialog-title"
        aria-modal="true"
        className="paideia-modal license-dialog"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="license-dialog-header">
          <div>
            <p className="modal-kicker">{t("license.legalInfo", undefined, "Informations légales")}</p>
            <h2 id="license-dialog-title">{thirdParty ? t("thirdParty.title", undefined, "Composants tiers et polices") : t("license.title", undefined, "Licence PAIDEIA")}</h2>
          </div>
          <button aria-label={thirdParty ? t("common.close") : t("license.closeAria", undefined, "Fermer la licence")} className="ghost-icon-button license-dialog-close" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="license-dialog-content" tabIndex={0}>{content}</div>
        {downloadError ? <p className="license-dialog-error" role="alert">{downloadError}</p> : null}
        <footer className="modal-actions license-dialog-actions">
          <button className="ghost-pill" onClick={onClose} type="button">{t("common.close")}</button>
          <button className="primary-pill" disabled={downloadRunning} onClick={() => void downloadLicense()} type="button">
            {downloadRunning ? t("license.downloading", undefined, "Téléchargement…") : thirdParty ? t("thirdParty.download", undefined, "Télécharger le document") : t("license.download", undefined, "Télécharger la licence")}
          </button>
        </footer>
      </section>
    </div>
  );
}


type ThirdPartyNotices = {
  components: { group: string; name: string; version: string; license: string; source: string; description?: string; descriptionEn?: string; notices: { name: string; section: number }[] }[];
  sections: { id: number; text: string }[];
};

function ThirdPartyContent({ notices, french }: { notices: ThirdPartyNotices; french: boolean }) {
  const { t } = useI18n();
  const groups = [...new Set(notices.components.map(component => component.group))];
  return <>
    <p>{t("thirdParty.description")}</p>
    {groups.map(group => <div key={group}>
      <h3>{group === "Polices" ? t("pdf.fonts") : group === "Attributions" ? t("thirdParty.attributions") : t("thirdParty.label")}</h3>
      <ul>{notices.components.filter(component => component.group === group).map(component => <li key={`${component.name}-${component.version}`}>
        <strong>{component.name} {component.version}</strong> — {component.license}
        {component.source ? <div className="third-party-source">{component.source.replace(/^git\+/, "")}</div> : null}
        {(french ? component.description : component.descriptionEn) ? <p>{french ? component.description : component.descriptionEn}</p> : null}
        {component.notices.map(notice => <details className="third-party-notice" key={`${notice.section}-${notice.name}`}>
          <summary>{t("thirdParty.viewLicense")}</summary>
          <pre>{notices.sections.find(section => section.id === notice.section)?.text}</pre>
        </details>)}
      </li>)}</ul>
    </div>)}
  </>;
}
