import { useState } from "react";
import { AuthoringButton, AuthoringCheckbox, AuthoringFieldGrid } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import type { ActivityItem } from "../../../types/project";
import { isDuplicatedResourceIntro, isSafeResourceUrl, resourceActionsFromBlock } from "./LinksResourcesActivity";

type Value = {
  title: string;
  summary: string;
  contentHtml: string;
  activityItems: ActivityItem[];
  buttonBackgroundColor: string;
  buttonTextColor: string;
  panelBackgroundColor: string;
  panelBorderColor: string;
  panelBorderWidth: string;
  panelBorderStyle: string;
  panelRounded: boolean;
  panelShadow: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function createResourceAction(order: number, defaultLabel: string): ActivityItem {
  return {
    id: `resource_${Date.now()}_${order}`,
    title: defaultLabel,
    kind: "step",
    contentHtml: "",
    resourceUrl: "https://",
    resourceRawDestination: null,
    resourceOpenMode: "new-tab",
    resourceValid: false
  };
}

export function LinksResourcesActivityEditor({ onChange, value }: { onChange: (patch: Partial<Value>) => void; value: Value }) {
  const { t } = useI18n();
  const actions = value.activityItems;
  const introValue = isDuplicatedResourceIntro(value.contentHtml, resourceActionsFromBlock(value))
    ? ""
    : htmlToText(value.contentHtml);
  const [collapsedActionIds, setCollapsedActionIds] = useState<string[]>([]);
  const updateAction = (id: string, patch: Partial<ActivityItem>) => onChange({
    activityItems: actions.map((action) => action.id === id ? { ...action, ...patch } : action)
  });
  const toggleAction = (id: string) => setCollapsedActionIds((current) => current.includes(id)
    ? current.filter((candidate) => candidate !== id)
    : [...current, id]);
  const addAction = () => {
    const action = createResourceAction(actions.length + 1, t("linksResources.defaultAction", undefined, "Accéder à la ressource"));
    setCollapsedActionIds((current) => current.filter((id) => id !== action.id));
    onChange({ activityItems: [...actions, action] });
  };
  const removeAction = (id: string) => {
    setCollapsedActionIds((current) => current.filter((candidate) => candidate !== id));
    onChange({ activityItems: actions.filter((candidate) => candidate.id !== id) });
  };

  return (
    <section className="links-resources-editor inspector-span-2">
      <div className="links-resources-editor-copy">
        <label>
          <span className="editor-label">{t("linksResources.title", undefined, "Titre facultatif")}</span>
          <input onChange={(event) => onChange({ title: event.target.value })} placeholder={t("activity.links-resources", undefined, "Liens & ressources")} value={value.title} />
        </label>
        <label>
          <span className="editor-label">{t("linksResources.intro", undefined, "Texte avant")}</span>
          <textarea
            onChange={(event) => onChange({ contentHtml: event.target.value.trim() ? `<p>${escapeHtml(event.target.value)}</p>` : "" })}
            placeholder={t("linksResources.introPlaceholder", undefined, "Présentez brièvement les ressources proposées.")}
            rows={3}
            value={introValue}
          />
        </label>
      </div>

      <div className="links-resources-actions-editor">
        <div className="links-resources-editor-heading">
          <div>
            <span className="editor-label">{actions.length <= 1 ? t("linksResources.editorialLayout", undefined, "Disposition éditoriale") : t("linksResources.multipleActions", undefined, "Plusieurs actions")}</span>
            <p>{t("linksResources.layoutHint", undefined, "La disposition s’adapte automatiquement au nombre de liens.")}</p>
          </div>
          <AuthoringButton compact onClick={addAction} variant="ghost">
            {t("linksResources.addAction", undefined, "Ajouter un lien")}
          </AuthoringButton>
        </div>
        {actions.map((action, index) => {
          const isCollapsed = collapsedActionIds.includes(action.id);
          return (
          <article className={`links-resources-action-editor activity-item-editor-card ${isCollapsed ? "collapsed" : ""}`} key={action.id}>
            <div className="links-resources-action-title">
              <button
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed
                  ? t("situationalDialogue.expandItemAria", { label: t("linksResources.actionNumber", { index: index + 1 }, `Lien ${index + 1}`) }, `Déplier le lien ${index + 1}`)
                  : t("situationalDialogue.collapseItemAria", { label: t("linksResources.actionNumber", { index: index + 1 }, `Lien ${index + 1}`) }, `Replier le lien ${index + 1}`)}
                className="activity-item-collapse-button"
                onClick={() => toggleAction(action.id)}
                type="button"
              >
                {isCollapsed ? "›" : "⌄"}
              </button>
              <strong>{t("linksResources.actionNumber", { index: index + 1 }, `Lien ${index + 1}`)}</strong>
              {actions.length > 1 ? (
                <AuthoringButton aria-label={t("linksResources.removeAction", undefined, "Supprimer ce lien")} compact onClick={() => removeAction(action.id)} variant="danger">
                  {t("common.delete", undefined, "Supprimer")}
                </AuthoringButton>
              ) : null}
            </div>
            {isCollapsed ? null : <div className="links-resources-action-grid">
              <label><span>{t("linksResources.label", undefined, "Libellé")}</span><input onChange={(event) => updateAction(action.id, { title: event.target.value })} value={action.title} /></label>
              <label><span>{t("linksResources.url", undefined, "Adresse du lien")}</span><input onChange={(event) => updateAction(action.id, { resourceUrl: event.target.value, resourceRawDestination: event.target.value, resourceValid: isSafeResourceUrl(event.target.value) })} value={action.resourceUrl || ""} /></label>
              <label className="links-resources-description"><span>{t("linksResources.description", undefined, "Description facultative")}</span><textarea onChange={(event) => updateAction(action.id, { contentHtml: event.target.value.trim() ? `<p>${escapeHtml(event.target.value)}</p>` : "" })} rows={2} value={htmlToText(action.contentHtml)} /></label>
              <label><span>{t("linksResources.openMode", undefined, "Ouverture")}</span><select onChange={(event) => updateAction(action.id, { resourceOpenMode: event.target.value as "new-tab" | "same-window" })} value={action.resourceOpenMode || "new-tab"}><option value="new-tab">{t("linksResources.newTab", undefined, "Nouvelle fenêtre")}</option><option value="same-window">{t("linksResources.sameWindow", undefined, "Même fenêtre")}</option></select></label>
            </div>}
          </article>
        );})}
      </div>

      <label className="links-resources-after"><span className="editor-label">{t("linksResources.after", undefined, "Texte après")}</span><textarea onChange={(event) => onChange({ summary: event.target.value })} rows={2} value={value.summary} /></label>

      <div className="activity-style-panel">
        <span className="editor-label">{t("linksResources.appearance", undefined, "Apparence de l’activité")}</span>
        <AuthoringFieldGrid className="appearance-grid links-resources-style-grid">
          <label><span>{t("editor.background", undefined, "Fond")}</span><ColorPickerField allowTransparent ariaLabel={t("editor.background", undefined, "Fond")} onChange={(panelBackgroundColor) => onChange({ panelBackgroundColor })} value={value.panelBackgroundColor} /></label>
          <label><span>{t("editor.border", undefined, "Trait")}</span><ColorPickerField ariaLabel={t("editor.border", undefined, "Trait")} onChange={(panelBorderColor) => onChange({ panelBorderColor })} value={value.panelBorderColor} /></label>
          <label><span>{t("editor.accent", undefined, "Accent")}</span><ColorPickerField ariaLabel={t("editor.accent", undefined, "Accent")} onChange={(buttonBackgroundColor) => onChange({ buttonBackgroundColor })} value={value.buttonBackgroundColor} /></label>
          <label><span>{t("richText.textColor", undefined, "Couleur du texte")}</span><ColorPickerField ariaLabel={t("richText.textColor", undefined, "Couleur du texte")} onChange={(buttonTextColor) => onChange({ buttonTextColor })} value={value.buttonTextColor} /></label>
          <label><span>{t("sectionMarker.width", undefined, "Épaisseur")}</span><select onChange={(event) => onChange({ panelBorderWidth: event.target.value })} value={value.panelBorderWidth}><option value="1px">{t("lineWidth.thin", undefined, "Fine")}</option><option value="2px">{t("lineWidth.normal", undefined, "Normale")}</option><option value="4px">{t("lineWidth.thick", undefined, "Épaisse")}</option></select></label>
          <label><span>{t("sectionMarker.lineStyle", undefined, "Type de trait")}</span><select onChange={(event) => onChange({ panelBorderStyle: event.target.value })} value={value.panelBorderStyle}><option value="none">{t("common.none", undefined, "Aucun")}</option><option value="solid">{t("lineStyle.solid", undefined, "Plein")}</option><option value="dashed">{t("lineStyle.dashed", undefined, "Tirets")}</option><option value="dotted">{t("lineStyle.dotted", undefined, "Pointillés")}</option></select></label>
          <AuthoringCheckbox checked={value.panelRounded} compact onChange={(event) => onChange({ panelRounded: event.target.checked })}>{t("editor.roundedCorners", undefined, "Coins arrondis")}</AuthoringCheckbox>
          <AuthoringCheckbox checked={value.panelShadow} compact onChange={(event) => onChange({ panelShadow: event.target.checked })}>{t("editor.shadow", undefined, "Ombre")}</AuthoringCheckbox>
        </AuthoringFieldGrid>
      </div>
    </section>
  );
}
