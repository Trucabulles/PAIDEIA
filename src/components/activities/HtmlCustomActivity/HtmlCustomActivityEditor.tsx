import { AuthoringFileButton } from "../../authoring";
import styles from "./HtmlCustomActivity.module.css";
import type { HtmlCustomActivityEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";

export function HtmlCustomActivityEditor({
  code,
  fileName,
  htmlCodeScrollTop,
  importPending,
  lineCount,
  layout,
  onCodeChange,
  onFileSelect,
  onLayoutChange,
  onScrollTopChange,
  placeholder,
  title
}: HtmlCustomActivityEditorProps) {
  const { t } = useI18n();
  return (
    <div className={`inspector-span-2 custom-html-editor-shell ${styles.editor}`}>
      <div className="html-editor-options">
        <label className="html-layout-switch">
          <span className="editor-label">{t("htmlCustom.activityWidth", undefined, "Largeur de l'activité")}</span>
          <select
            onChange={(event) => onLayoutChange(event.target.value)}
            value={layout === "full-width" ? "full-width" : "activity-width"}
          >
            <option value="activity-width">{t("htmlCustom.activityFormat", undefined, "Format activité")}</option>
            <option value="full-width">{t("htmlCustom.fullWidth", undefined, "Pleine largeur")}</option>
          </select>
        </label>
        <label className="html-package-picker">
          <span className="editor-label">{t("htmlCustom.fileOrPackage", undefined, "Fichier ou paquet HTML")}</span>
          <AuthoringFileButton
            accept=".html,.htm,.zip,text/html,application/zip"
            className="html-package-picker-button"
            disabled={importPending}
            onFileSelect={onFileSelect}
          >
            {t("htmlCustom.importHtmlZip", undefined, "Importer HTML / ZIP")}
          </AuthoringFileButton>
          {fileName ? <small title={title ?? undefined}>{fileName}</small> : null}
        </label>
      </div>
      <span className="editor-label">{t("htmlCustom.code", undefined, "Code HTML")}</span>
      <div className="custom-html-code-editor">
        <pre
          aria-hidden="true"
          className="custom-html-line-numbers"
          style={{ transform: `translateY(-${htmlCodeScrollTop}px)` }}
        >
          {Array.from({ length: lineCount }, (_, index) => index + 1).join("\n")}
        </pre>
        <textarea
          aria-label={t("htmlCustom.customCode", undefined, "Code HTML personnalisé")}
          onChange={(event) => onCodeChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Tab") {
              return;
            }
            event.preventDefault();
            const target = event.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const nextValue = `${target.value.slice(0, start)}  ${target.value.slice(end)}`;
            onCodeChange(nextValue);
            window.requestAnimationFrame(() => {
              target.selectionStart = start + 2;
              target.selectionEnd = start + 2;
            });
          }}
          onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}
          placeholder={placeholder}
          spellCheck={false}
          value={code}
        />
      </div>
      {t("htmlCustom.help", undefined, "Collez ici votre code HTML ou le code d’intégration d’un contenu externe (Genially, simulation, activité interactive, etc.).")}
    </div>
  );
}
