import { HtmlCustomActivityEditor } from "./HtmlCustomActivityEditor";

type HtmlCustomEditorValue = {
  contentHtml: string;
  mediaLayout: string;
};

type HtmlCustomActivityEditorPanelProps = {
  fileName?: string | null;
  htmlCodeScrollTop: number;
  importPending: boolean;
  onChange: (patch: Partial<HtmlCustomEditorValue>) => void;
  onFileSelect: (file: File) => void;
  onScrollTopChange: (value: number) => void;
  placeholder: string;
  title?: string | null;
  value: HtmlCustomEditorValue;
};

export function HtmlCustomActivityEditorPanel({
  fileName,
  htmlCodeScrollTop,
  importPending,
  onChange,
  onFileSelect,
  onScrollTopChange,
  placeholder,
  title,
  value
}: HtmlCustomActivityEditorPanelProps) {
  const lineCount = Math.max(1, value.contentHtml.split(/\r\n|\r|\n/).length);

  return (
    <HtmlCustomActivityEditor
      code={value.contentHtml}
      fileName={fileName}
      htmlCodeScrollTop={htmlCodeScrollTop}
      importPending={importPending}
      layout={value.mediaLayout}
      lineCount={lineCount}
      // Pour interdire la saisie et l’import d’iframes distantes, valider le HTML
      // dans onCodeChange et dans le traitement du fichier par onFileSelect.
      onCodeChange={(contentHtml) => onChange({ contentHtml })}
      onFileSelect={onFileSelect}
      onLayoutChange={(mediaLayout) => onChange({ mediaLayout })}
      onScrollTopChange={onScrollTopChange}
      placeholder={placeholder}
      title={title}
    />
  );
}
