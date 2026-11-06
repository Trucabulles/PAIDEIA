import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/react";

type RichTextLinkDialogProps = {
  error?: string | null;
  initialText: string;
  initialUrl: string;
  onApply: (url: string, text: string) => void;
  onClose: () => void;
};

export function RichTextLinkDialog({
  error,
  initialText,
  initialUrl,
  onApply,
  onClose
}: RichTextLinkDialogProps) {
  const { t } = useI18n();
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
    urlInputRef.current?.select();
  }, []);

  return (
    <div
      className="paideia-modal-backdrop rich-text-dialog-backdrop"
      data-rich-text-dialog="true"
      role="presentation"
    >
      <form
        aria-labelledby="rich-text-link-dialog-title"
        aria-modal="true"
        className="paideia-modal rich-text-link-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onApply(url, text);
        }}
        role="dialog"
      >
        <p className="modal-kicker">{t("richText.link", undefined, "Lien")}</p>
        <h2 id="rich-text-link-dialog-title">{t("richText.insertLink", undefined, "Insérer un lien")}</h2>
        <label className="modal-field">
          URL
          <input
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://exemple.fr"
            ref={urlInputRef}
            type="text"
            value={url}
          />
        </label>
        <label className="modal-field">
          {t("richText.displayText", undefined, "Texte à afficher")}
          <input
            onChange={(event) => setText(event.target.value)}
            placeholder={t("richText.emptyDisplaysUrl", undefined, "Laisser vide pour afficher l'URL")}
            type="text"
            value={text}
          />
        </label>
        {error ? <p className="rich-text-link-error" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <button className="ghost-pill" onClick={onClose} type="button">{t("common.cancel")}</button>
          <button className="primary-pill" type="submit">{t("richText.insert", undefined, "Insérer")}</button>
        </div>
      </form>
    </div>
  );
}
