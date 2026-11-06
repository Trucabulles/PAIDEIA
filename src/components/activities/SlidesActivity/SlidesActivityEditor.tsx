import type { ReactNode } from "react";
import type { ActivityItem } from "../../../types/project";
import { slidesItemLabel } from "./SlidesItems";
import { useI18n } from "../../../i18n/react";
import {
  ActivityFrameAppearanceControls,
  AuthoringCheckbox,
  AuthoringFieldGrid
} from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { ActivityEditorTabs } from "../../lesson-editor/ActivityEditorTabs";

export type SlidesNavigationStyleValue = {
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  borderWidth: string;
  rounded: boolean;
  shadow: boolean;
};

export type SlidesActivityAppearanceValue = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: string;
  rounded: boolean;
  shadow: boolean;
};

export type SlidesActivityEditorProps = {
  appearanceBackgroundPanel?: ReactNode;
  collapsedItemIds: string[];
  items: ActivityItem[];
  onAddItem: () => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onRemoveItem: (itemId: string) => void;
  onToggleCollapse: (itemId: string) => void;
  onStyleChange: (patch: Partial<SlidesNavigationStyleValue>) => void;
  onActivityAppearanceChange: (patch: Partial<SlidesActivityAppearanceValue>) => void;
  renderItemEditor: (item: ActivityItem, index: number, label: string) => ReactNode;
  visiblePanel?: "activity" | "appearance" | "all";
  style: SlidesNavigationStyleValue;
  activityAppearance: SlidesActivityAppearanceValue;
  tabs?: {
    activityLabel: string;
    appearanceLabel: string;
    sessionKey: string;
  };
};

export function SlidesActivityEditor(props: SlidesActivityEditorProps) {
  const {
  appearanceBackgroundPanel,
  collapsedItemIds,
  items,
  onAddItem,
  onMoveItem,
  onRemoveItem,
  onToggleCollapse,
  onStyleChange,
  onActivityAppearanceChange,
  renderItemEditor,
  visiblePanel = "all",
  style,
  activityAppearance,
  tabs
  } = props;
  const { t } = useI18n();
  if (tabs) {
    return (
      <ActivityEditorTabs
        activityLabel={tabs.activityLabel}
        activityPanel={<SlidesActivityEditor {...props} tabs={undefined} visiblePanel="activity" />}
        appearanceLabel={tabs.appearanceLabel}
        appearancePanel={<SlidesActivityEditor {...props} tabs={undefined} visiblePanel="appearance" />}
        sessionKey={tabs.sessionKey}
      />
    );
  }
  return (
    <div className="inspector-span-2 activity-items-editor">
      {visiblePanel !== "appearance" ? <><div className="interactive-editor-header">
        <span className="editor-label">{t("activity.slides")}</span>
        <button className="ghost-pill" onClick={onAddItem} type="button">
          {t("slides.addSlide", undefined, "Ajouter une diapo")}
        </button>
      </div>
      <div className="activity-item-editor-list">
        {items.map((item, index) => {
          const isCollapsed = collapsedItemIds.includes(item.id);
          const label = slidesItemLabel(item, index, items.length, items);
          return (
            <article className={`activity-item-editor-card ${isCollapsed ? "collapsed" : ""}`} key={item.id}>
              <div className="marker-editor-card-header activity-item-card-header">
                <button
                  aria-expanded={!isCollapsed}
                  aria-label={t(isCollapsed ? "richText.expand" : "common.collapse")}
                  className="activity-item-collapse-button"
                  onClick={() => onToggleCollapse(item.id)}
                  type="button"
                >
                  {isCollapsed ? "›" : "⌄"}
                </button>
                <strong>{label} </strong>
                <div className="activity-item-reorder-controls">
                  <button
                    className="ghost-pill compact"
                    disabled={index <= 0}
                    onClick={() => onMoveItem(item.id, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    className="ghost-pill compact"
                    disabled={index === items.length - 1}
                    onClick={() => onMoveItem(item.id, 1)}
                    type="button"
                  >
                    ↓
                  </button>
                </div>
                <button
                  className="ghost-pill compact"
                  onClick={() => onRemoveItem(item.id)}
                  type="button"
                >
                  {t("common.delete")}
                </button>
              </div>
              {isCollapsed ? null : renderItemEditor(item, index, label)}
            </article>
          );
        })}
      </div>
      </> : null}
      {visiblePanel !== "activity" ? <>
      {appearanceBackgroundPanel}
      <section className="appearance-section appearance-section--card" aria-label={t("slides.navigation") }>
        <span className="appearance-title">{t("slides.navigation")}</span>
        <AuthoringFieldGrid className="appearance-grid">
          <label>
            <span>{t("editor.accent")}</span>
            <ColorPickerField
              ariaLabel={t("editor.accent")}
              onChange={(accentColor) => onStyleChange({ accentColor })}
              value={style.accentColor}
            />
          </label>
          <label>
            <span>{t("activity.rich-text")}</span>
            <ColorPickerField
              ariaLabel={t("navigation.buttonTextColorAria")}
              onChange={(textColor) => onStyleChange({ textColor })}
              value={style.textColor}
            />
          </label>
          <label>
            <span>{t("editor.background")}</span>
            <ColorPickerField
              allowTransparent
              ariaLabel={t("editor.backgroundColor")}
              onChange={(backgroundColor) => onStyleChange({ backgroundColor })}
              value={style.backgroundColor}
            />
          </label>
          <label>
            <span>{t("sectionMarker.width")}</span>
            <select
              onChange={(event) => onStyleChange({ borderWidth: event.target.value })}
              value={style.borderWidth}
            >
              <option value="0px">{t("lineWidth.none")}</option>
              <option value="1px">{t("lineWidth.thin")}</option>
              <option value="2px">{t("lineWidth.normal")}</option>
              <option value="4px">{t("lineWidth.thick")}</option>
            </select>
          </label>
          <AuthoringCheckbox
            checked={style.rounded}
            compact
            onChange={(event) => onStyleChange({ rounded: event.target.checked })}
          >
            {t("editor.roundedCorners")}
          </AuthoringCheckbox>
          <AuthoringCheckbox
            checked={style.shadow}
            compact
            onChange={(event) => onStyleChange({ shadow: event.target.checked })}
          >
            {t("editor.shadow")}
          </AuthoringCheckbox>
        </AuthoringFieldGrid>
      </section>
      <ActivityFrameAppearanceControls
        labels={{
          accent: t("editor.accent"),
          activityAppearance: t("editor.activityAppearance"),
          background: t("editor.background"),
          backgroundColor: t("editor.backgroundColor"),
          borderStyle: t("sectionMarker.lineStyle"),
          borderWidth: t("sectionMarker.width"),
          dashed: t("lineStyle.dashed"),
          dotted: t("lineStyle.dotted"),
          lineNone: t("lineWidth.none"),
          lineNormal: t("lineWidth.normal"),
          lineThick: t("lineWidth.thick"),
          lineThin: t("lineWidth.thin"),
          roundedCorners: t("editor.roundedCorners"),
          shadow: t("editor.shadow"),
          solid: t("lineStyle.solid")
        }}
        onChange={onActivityAppearanceChange}
        value={activityAppearance}
      />
      </> : null}
    </div>
  );
}
