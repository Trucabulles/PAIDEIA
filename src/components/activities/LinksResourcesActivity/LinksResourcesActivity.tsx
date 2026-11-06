import type { CSSProperties } from "react";
import type { PaideiaBlock, ResourceAction } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import styles from "./LinksResourcesActivity.module.css";

export function isSafeResourceUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    if (!["https:", "http:", "mailto:"].includes(url.protocol)) return false;
    if (url.protocol === "mailto:") return Boolean(url.pathname.includes("@"));
    return Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function resourceActionsFromBlock(block: Pick<PaideiaBlock, "activityItems">): ResourceAction[] {
  return (block.activityItems ?? []).map((item) => ({
    id: item.id,
    label: item.title,
    descriptionHtml: item.contentHtml || "",
    url: item.resourceUrl || "",
    rawDestination: item.resourceRawDestination,
    openMode: item.resourceOpenMode === "same-window" ? "same-window" : "new-tab",
    valid: item.resourceValid !== false && isSafeResourceUrl(item.resourceUrl || "")
  }));
}

function normalizedResourceText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDuplicatedResourceIntro(introHtml: string, actions: ResourceAction[]): boolean {
  const intro = normalizedResourceText(introHtml);
  if (!intro) return false;
  const descriptions = actions
    .map((action) => normalizedResourceText(action.descriptionHtml))
    .filter(Boolean)
    .join(" ");
  return Boolean(descriptions) && intro === descriptions;
}

function GlobeIcon() {
  return (
    <svg aria-hidden="true" className={styles.globe} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
    </svg>
  );
}

export function LinksResourcesActivity({ block }: { block: PaideiaBlock }) {
  const { t } = useI18n();
  const actions = resourceActionsFromBlock(block);
  const introHtml = isDuplicatedResourceIntro(block.contentHtml || "", actions) ? "" : block.contentHtml;
  const single = actions.length <= 1;
  const visibleTitle = Boolean(
    block.title?.trim() && block.title.trim() !== t("activity.links-resources", undefined, "Liens & ressources")
  );
  const hasActionDescription = actions.some((action) => Boolean(normalizedResourceText(action.descriptionHtml)));
  const compact = !visibleTitle
    && !normalizedResourceText(introHtml || "")
    && !hasActionDescription
    && !block.summary?.trim();
  const style = {
    "--links-resources-background": block.panelBackgroundColor || "#edf4ff",
    "--links-resources-border": block.panelBorderColor || "#123a7a",
    "--links-resources-border-width": block.panelBorderWidth || "2px",
    "--links-resources-border-style": block.panelBorderStyle || "solid",
    "--links-resources-accent": block.buttonBackgroundColor || "#123a7a",
    "--links-resources-button-text": block.buttonTextColor || "#ffffff",
    "--links-resources-radius": block.panelRounded !== false ? "22px" : "0px",
    "--links-resources-shadow": block.panelShadow ? "0 16px 34px rgba(18, 58, 122, 0.14)" : "none"
  } as CSSProperties;

  return (
    <section className={`${styles.activity} ${single ? styles.editorial : styles.multiple} ${compact ? styles.compact : ""}`} style={style}>
      <span className={styles.iconBox}><GlobeIcon /></span>
      <div className={styles.copy}>
        {visibleTitle ? <h3>{block.title}</h3> : null}
        {introHtml ? <div className="rich-content" dangerouslySetInnerHTML={{ __html: introHtml }} /> : null}
      </div>
      <div className={styles.actions}>
        {actions.map((action) => (
          <div className={styles.actionRow} key={action.id}>
            <div className={styles.actionDescription} dangerouslySetInnerHTML={{ __html: action.descriptionHtml }} />
            {action.valid ? (
              <a
                className={styles.action}
                href={action.url}
                rel={action.openMode === "new-tab" ? "noopener noreferrer" : undefined}
                target={action.openMode === "new-tab" ? "_blank" : undefined}
              >
                {action.label}
              </a>
            ) : (
              <div aria-disabled="true" className={`${styles.action} ${styles.invalid}`} title={action.rawDestination || action.url}>
                {action.label}
              </div>
            )}
          </div>
        ))}
      </div>
      {block.summary?.trim() ? <p className={styles.after}>{block.summary}</p> : null}
    </section>
  );
}
