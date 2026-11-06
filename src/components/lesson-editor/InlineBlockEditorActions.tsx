import { useI18n } from "../../i18n/react";

type InlineBlockEditorActionsProps = {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export function InlineBlockEditorActions({
  saving,
  onCancel,
  onSave
}: InlineBlockEditorActionsProps) {
  const { t } = useI18n();
  return (
    <div className="inspector-actions">
      <button className="ghost-pill cancel-changes-pill" onClick={onCancel} type="button">
        {t("editor.cancelChanges")}
      </button>
      <button className="primary-pill" onClick={onSave} type="button">
        {saving ? t("common.saving") : t("common.save")}
      </button>
    </div>
  );
}
