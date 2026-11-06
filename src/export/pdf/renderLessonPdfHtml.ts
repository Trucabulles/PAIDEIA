import { sanitizeRichTextHtml } from "../../app/richTextSanitizer";
import { formatEstimatedDuration } from "../../app/lessonDuration";
import type { ActivityItem, PaideiaBlock, PaideiaProject } from "../../types/project";
import type { LessonPdfActivity, LessonPdfAsset, LessonPdfDocumentModel } from "./lessonPdfModel";
import { noteIconSvg, sectionContent, type PreparedPdfAssets } from "./renderLessonPdfDocument";
import { cardSortCss, renderPdfCardSort } from "./renderPdfCardSort";
import { audioFallbackHtml, pdfActivityCss, renderPdfActivity } from "./renderPdfActivities";
import { imageTextActivityExportCss } from "../../components/activities/ImageTextActivity/ImageTextActivity.export";
import { prepareImageTextMedia } from "../../components/activities/ImageTextActivity/ImageTextActivity.media.js";
import { imageSizeToPercent } from "../../components/lesson-editor/inlineBlockEditorMedia";

// A4 renderer used by the production PDF export.
// One design coordinate system applies to text, controls, borders and spacing.
export const PDF_HTML_DESIGN_WIDTH = 806;
export const PDF_HTML_PRINT_ZOOM = (182 / 25.4 * 96) / PDF_HTML_DESIGN_WIDTH;
const POINTS_PER_DESIGN_PIXEL = PDF_HTML_PRINT_ZOOM * 0.75;
const decodeEntities = (value: string) => value.replace(/&(?:#\d+|#x[\da-f]+|[a-z]+)[\s\u00a0\u202f]*;/gi, entity => {
  const decoder = document.createElement("textarea"); decoder.innerHTML = entity.replace(/[\s\u00a0\u202f]+;/u, ";"); return decoder.value;
});
const escape = (value: unknown) => decodeEntities(String(value ?? "")).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const percent = (value: unknown, fallback: number) => Math.max(5, Math.min(100, Number.parseFloat(String(value ?? "")) || fallback));
const number = (value: unknown, fallback: number) => Number.isFinite(Number.parseFloat(String(value))) ? Number.parseFloat(String(value)) : fallback;
const color = (value: unknown, fallback: string) => /^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i.test(String(value ?? "")) ? String(value) : fallback;
const raster = /^data:image\/(?:png|jpeg|webp|gif);base64,/i;

function assetData(ref: string, assets: PreparedPdfAssets): string | undefined {
  const normalized = ref.replace(/^assets\//, "");
  const data = assets[ref] ?? assets[normalized] ?? assets[`assets/${normalized}`];
  return data && raster.test(data) ? data : undefined;
}

function rich(html: string, assets: PreparedPdfAssets): string {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichTextHtml(html);
  const walker = document.createTreeWalker(template.content, 4 /* SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    node.textContent = decodeEntities(node.textContent || "");
  }
  for (const image of template.content.querySelectorAll("img")) {
    const ref = image.getAttribute("data-paideia-asset-ref") ?? image.getAttribute("src") ?? "";
    const data = assetData(ref, assets);
    if (data) image.src = data;
    else if (!raster.test(ref)) image.replaceWith(document.createTextNode(image.alt || ""));
    const authoredWidth = Number(image.getAttribute("width"));
    if (authoredWidth > 0) image.style.width = `${authoredWidth}px`;
  }
  // The editor's empty-field hint is an authoring affordance, not lesson content.
  const text = template.content.textContent?.trim().replace(/[.…]+$/u, "");
  if (text === "Saisissez votre texte ici" || text === "Nouveau contenu") return "";
  return template.innerHTML;
}

function learnerBodyWithReferences(body: string, assets: PreparedPdfAssets): string {
  const template = document.createElement("template");
  template.innerHTML = body;
  const bookmarks = new Set<string>();
  for (const marker of template.content.querySelectorAll<HTMLElement>("[data-paideia-bookmark-id]")) {
    const id = marker.getAttribute("data-paideia-bookmark-id")?.trim();
    if (!id) continue;
    marker.id = `pdf-${id}`;
    bookmarks.add(id);
  }
  const noteByTarget = new Map<string, { number: number; id: string }>();
  const notes = document.createElement("section");
  notes.className = "learner-notes";
  notes.innerHTML = "<h2>Notes</h2><ol></ol>";
  for (const marker of template.content.querySelectorAll<HTMLElement>("[data-paideia-reference-id]")) {
    const target = marker.getAttribute("data-paideia-bookmark-target")?.trim();
    const definition = marker.getAttribute("data-paideia-reference-definition")?.trim();
    if (target && bookmarks.has(target)) {
      const link = document.createElement("a");
      link.href = `#pdf-${target}`;
      link.innerHTML = marker.innerHTML;
      marker.replaceWith(link);
    } else if (definition) {
      const bankId = marker.getAttribute("data-paideia-reference-bank-id")?.trim();
      const entryId = marker.getAttribute("data-paideia-reference-entry-id")?.trim();
      const key = bankId && entryId ? `${bankId}:${entryId}` : target || definition;
      let note = noteByTarget.get(key);
      if (!note) {
        const number = noteByTarget.size + 1;
        note = { number, id: `pdf-note-${number}` };
        noteByTarget.set(key, note);
        const item = document.createElement("li");
        item.id = note.id;
        const title = document.createElement("strong");
        title.textContent = marker.getAttribute("data-paideia-bookmark-label")?.trim() || marker.textContent?.trim() || "Définition";
        const detail = document.createElement("div");
        detail.className = "learner-note-definition";
        detail.innerHTML = rich(definition, assets);
        item.append(title, document.createTextNode(" — "), detail);
        notes.querySelector("ol")?.append(item);
      }
      const link = document.createElement("a");
      link.href = `#${note.id}`;
      link.innerHTML = marker.innerHTML;
      const superscript = document.createElement("sup");
      superscript.textContent = String(note.number);
      link.append(superscript);
      marker.replaceWith(link);
    } else {
      marker.replaceWith(...Array.from(marker.childNodes));
    }
  }
  if (noteByTarget.size) template.content.append(notes);
  return template.innerHTML;
}

function image(asset: LessonPdfAsset | undefined, assets: PreparedPdfAssets, imageText = false): string {
  const data = asset && assetData(asset.ref, assets);
  if (!data) return "";
  const rounded = asset?.rounded ? "rounded" : "";
  // Imported crops retain percentage geometry; the browser fills the crop box
  // once natural image dimensions are known (before print readiness).
  const crop = asset?.crop;
  if (crop && crop.width > 0 && crop.height > 0) {
    return `<span class="media crop ${rounded}${imageText ? ` preview-media media-crop-frame${asset?.rounded ? " rounded-media" : ""}${crop.shape === "ellipse" ? " ellipse-crop" : ""}` : ""}" data-crop="${escape(JSON.stringify(crop))}"><img class="media-crop-image" src="${escape(data)}" alt=""></span>`;
  }
  if (imageText) return `<img class="preview-media${asset?.rounded ? " rounded-media" : ""}" src="${escape(data)}" alt="">`;
  return `<span class="media ${rounded}"><img src="${escape(data)}" alt=""></span>`;
}

type LayoutOwner = Pick<PaideiaBlock, "mediaLayout" | "imageSize" | "contentWidth" | "contentAlign" | "mediaGap" | "verticalAlign">;
function compose(media: string, copy: string, owner: LayoutOwner): string {
  if (!media) return `<div class="rich">${copy}</div>`;
  const layout = owner.mediaLayout ?? "image-center";
  const styles = `--image-width:${percent(owner.imageSize, 50)}%;--copy-width:${percent(owner.contentWidth, 100)}%;--gap:${Math.max(0, Math.min(100, number(owner.mediaGap, 28)))}px;text-align:${["left", "center", "right", "justify"].includes(owner.contentAlign ?? "") ? owner.contentAlign : "left"};--vertical-align:${owner.verticalAlign === "top" ? "start" : owner.verticalAlign === "bottom" ? "end" : "center"}`;
  return `<div class="composition ${escape(layout)}" style="${styles}">${media}<div class="rich">${copy}</div></div>`;
}

// The established documentary decompositions are reused rather than rewritten.
// Convert their pdfmake nodes to semantic HTML; text remains actual text.
function documentary(node: unknown, inline = false): string {
  if (node == null) return "";
  if (Array.isArray(node)) return node.map(item => documentary(item, inline)).join("");
  if (typeof node !== "object") return escape(node);
  const n = node as Record<string, any>;
  const styles: string[] = [];
  if (n.fontSize) styles.push(`font-size:${n.fontSize / 0.75}px`);
  if (n.bold) styles.push("font-weight:700");
  if (n.italics) styles.push("font-style:italic");
  if (n.color) styles.push(`color:${color(n.color, "#222")}`);
  if (n.background || n.fillColor) styles.push(`background-color:${color(n.background ?? n.fillColor, "transparent")}`);
  if (n.alignment) styles.push(`text-align:${n.alignment}`);
  if (n.decoration) styles.push(`text-decoration:${n.decoration === "lineThrough" ? "line-through" : "underline"}`);
  if (n.margin) {
    const m = typeof n.margin === "number" ? [n.margin, n.margin, n.margin, n.margin] : n.margin.length === 2 ? [n.margin[0], n.margin[1], n.margin[0], n.margin[1]] : n.margin;
    styles.push(`margin:${[m[1], m[2], m[3], m[0]].map(v => `${v / POINTS_PER_DESIGN_PIXEL}px`).join(" ")}`);
  }
  const style = escape(styles.join(";"));
  if (n.image && raster.test(n.image)) return `<div style="${style}"><img class="documentary-image" src="${escape(n.image)}" style="max-width:${(n.fit?.[0] ?? n.width ?? 470) / POINTS_PER_DESIGN_PIXEL}px;max-height:${(n.fit?.[1] ?? 340) / POINTS_PER_DESIGN_PIXEL}px" alt=""></div>`;
  if (n.svg) return `<div class="documentary-svg" style="${style};width:${(n.width ?? 36) / POINTS_PER_DESIGN_PIXEL}px">${n.svg}</div>`;
  if (n.canvas) return `<hr style="${style}">`;
  if (n.table) {
    const widths = n.table.widths ?? [];
    const cols = widths.map((w: unknown) => `<col${typeof w === "number" ? ` style="width:${w / POINTS_PER_DESIGN_PIXEL}px"` : typeof w === "string" && w.endsWith("%") ? ` style="width:${escape(w)}"` : ""}>`).join("");
    return `<table class="documentary-table ${n.layout === "noBorders" ? "borderless" : ""}" style="${style}"><colgroup>${cols}</colgroup><tbody>${n.table.body.map((row: unknown[]) => `<tr>${row.map(cell => `<td>${documentary(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  if (n.columns) return `<div class="documentary-columns" style="${style};gap:${(n.columnGap ?? 12) / POINTS_PER_DESIGN_PIXEL}px">${n.columns.map((cell: any) => `<div style="${typeof cell.width === "string" && cell.width.endsWith("%") ? `flex:0 0 ${cell.width}` : typeof cell.width === "number" ? `flex:0 0 ${cell.width / POINTS_PER_DESIGN_PIXEL}px` : "flex:1"}">${documentary(cell)}</div>`).join("")}</div>`;
  if (n.ul || n.ol) return `<${n.ul ? "ul" : "ol"} style="${style}">${(n.ul ?? n.ol).map((item: unknown) => `<li>${documentary(item)}</li>`).join("")}</${n.ul ? "ul" : "ol"}>`;
  if (n.stack) return `<div style="${style}">${documentary(n.stack)}</div>`;
  const tag = inline ? "span" : "div";
  return `<${tag} style="${style}">${documentary(n.text ?? "", true)}</${tag}>`;
}

function activityHtml(activity: LessonPdfActivity, block: PaideiaBlock, model: LessonPdfDocumentModel, assets: PreparedPdfAssets): string {
  const visual = activity.sections.find(s => s.kind === "visual");
  const copies = activity.sections.filter(s => s.kind === "rich-text");
  const copy = copies.map(s => `${s.label ? `<h4>${escape(s.label)}</h4>` : ""}${rich(s.html, assets)}`).join("");
  const media = visual?.assets.map(a => image(a, assets)).join("") ?? "";
  const audioCover = (block.assetRefs ?? []).filter(ref => /\.(png|jpe?g|webp|gif)$/i.test(ref)).map(ref => image({ref,role:"image",crop:block.imageCrop},assets)).join("");
  let content = "";
  if (activity.sourceType === "header") {
    const background = visual?.assets[0] && assetData(visual.assets[0].ref, assets);
    content = `<div class="header-banner" style="background-color:${color(activity.style.headerBackgroundColor, "#123a7a")};color:${color(activity.style.headerTextColor, "white")};min-height:${Math.min(520, Math.max(80, number(activity.style.headerHeight, 180)))}px;${background ? `background-image:url('${background}');background-position:center ${number(activity.style.headerImagePositionY, 50)}%;` : ""}"><div class="rich">${copy}</div></div>`;
  } else if (activity.sourceType === "image-text") {
    const layout = block.mediaLayout ?? "image-left";
    const imageTextMedia = visual?.assets.map(a => image(a, assets, true)).join("") ?? "";
    const styles = `--image-text-content-width:${percent(block.contentWidth, 100)}%;--image-text-image-size:${imageSizeToPercent(block.imageSize)}%;--image-text-media-gap:${Math.max(0, number(block.mediaGap, 28))}px;--image-text-vertical-align:${["start", "center", "end"].includes(block.verticalAlign ?? "") ? block.verticalAlign : "center"}`;
    content = `<div class="paideia-image-text-frame" data-layout="${escape(layout)}"><div class="paideia-image-text-activity" data-layout="${escape(layout)}" style="${styles}">${imageTextMedia}<div class="paideia-image-text-copy rich" style="text-align:${["left", "center", "right", "justify"].includes(block.contentAlign ?? "") ? block.contentAlign : "left"}">${copy}</div></div></div>`;
  } else {
    content = activity.sections.map(section => {
      if (section.kind === "rich-text") return `<div class="rich">${section.label ? `<h4>${escape(section.label)}</h4>` : ""}${rich(section.html, assets)}</div>`;
      if (section.kind === "visual") {
        // A video has both a poster and a captured frame in the model. They
        // represent one player, so printing both creates a false two-page view.
        const frame = block.type === "media" && block.variant === "video"
          ? section.assets.find(a => a.role === "video" && assetData(a.ref, assets))
            ?? section.assets.find(a => a.role === "poster" && assetData(a.ref, assets))
          : null;
        return `<div class="standalone-media${frame ? " video-frame" : ""}">${frame ? image(frame, assets) : section.assets.map(a => image(a, assets)).join("")}</div>`;
      }
      if (section.kind === "progress-marker") return `<div class="navigation"><span style="background:${color(activity.style.buttonBackgroundColor, "#123a7a")};color:${color(activity.style.buttonTextColor, "white")}">${escape(section.label)}</span></div>`;
      if (section.kind === "expanded-items" && ["tabs", "accordion", "audio", "slides", "image-grid"].includes(section.presentation)) {
        return section.items.map(item => {
          const source: ActivityItem | undefined = block.activityItems?.find(i => i.id === item.id);
          if (section.presentation === "audio") return `<div class="expanded audio"><div class="audio-cover">${audioCover || audioFallbackHtml()}</div><div><h4>${escape(item.title)}</h4><div class="audio-player"><span>▶</span><span class="audio-track"></span><span>0:00</span><span>◖))</span></div>${rich(item.contentHtml, assets)}${item.transcriptHtml ? `<h4>${escape(model.labels.transcript)}</h4>${rich(item.transcriptHtml, assets)}` : ""}</div></div>`;
          const tabs = section.presentation === "tabs" ? `<div class="tab-strip">${section.items.map(t => `<div class="tab-button ${t.id === item.id ? "selected" : ""}">${rich(t.title, assets)}</div>`).join("")}</div>` : `<div class="expanded-title">${rich(item.title, assets)}</div>`;
          return `<div class="expanded ${section.presentation}">${tabs}${compose(item.assets.map(a => image(a, assets)).join(""), rich(item.contentHtml, assets), source ?? {})}</div>`;
        }).join("");
      }
      return `<div class="documentary">${documentary(sectionContent(section, activity, assets, model.labels))}</div>`;
    }).join("");
  }
  if (activity.sourceType === "note") {
    const border = color(activity.style.panelBorderColor, "#123a7a");
    content = `<div class="note-panel" style="background:${color(activity.style.panelBackgroundColor, "#ffffff")};border-color:${border};border-width:${Math.max(0, number(activity.style.panelBorderWidth, 2))}px;border-style:${activity.style.panelBorderStyle === "none" ? "none" : "solid"};border-radius:${activity.style.panelRounded === false ? 0 : 20}px;padding:${Math.max(0, number(activity.style.panelPadding, 28))}px">${activity.style.noteShowIcon !== false ? `<div class="note-icon">${noteIconSvg(activity.style.noteIcon, activity.style.noteIconMatchesBorder === false ? color(activity.style.noteIconColor, border) : border)}</div>` : ""}<div>${content}</div></div>`;
  }
  if (activity.sourceType === "quote") {
    const quoteImage = visual?.assets.find(a => assetData(a.ref, assets));
    const author = block.quoteShowAuthor === false ? "" : rich(block.quoteAuthorHtml ?? "", assets);
    const quoteText = rich(block.contentHtml ?? "", assets);
    const layout = ["image-right", "image-center"].includes(block.mediaLayout ?? "") ? block.mediaLayout : "image-left";
    const background = block.panelBackgroundColor?.toLowerCase() === "#edf4ff" ? "#ffffff" : color(block.panelBackgroundColor, "#ffffff");
    const accent = color(block.buttonTextColor === "#ffffff" ? null : block.buttonTextColor, "#123a7a");
    const width = Math.min(36, Math.max(18, number(block.imageSize, 22)));
    content = `<figure class="pdf-quote ${escape(layout)} ${quoteImage ? "" : "without-image"}" style="background:${background};border-color:${color(block.panelBorderColor, "#d4dce9")};border-width:${escape(block.panelBorderWidth || "1px")};border-style:${block.panelBorderStyle === "dashed" || block.panelBorderStyle === "dotted" ? block.panelBorderStyle : "solid"};border-radius:${block.panelRounded ? "26px" : "0"};--quote-accent:${accent};--quote-image-width:${width}%">${quoteImage ? `<div class="quote-image">${image(quoteImage, assets)}</div>` : ""}<figcaption><span class="quote-mark">“</span><div class="quote-body rich">${quoteText}</div>${author ? `<div class="quote-author rich">${author}</div>` : ""}<span class="quote-mark close">”</span></figcaption></figure>`;
  }
  if (activity.sourceType === "attachment") {
    const files = block.attachmentFiles ?? [];
    content = `<div class="pdf-attachments" style="background:${color(block.panelBackgroundColor, "#edf4ff")};border-color:${color(block.panelBorderColor, "#123a7a")};border-radius:${block.panelRounded ? "22px" : "0"}">${files.map(file => `<div class="pdf-attachment"><span class="attachment-icon">${escape((file.extension || "FICHIER").toUpperCase())}</span><span class="attachment-copy"><strong>${escape(file.displayName)}</strong><small>${escape((file.extension || "FICHIER").toUpperCase())}${file.sizeBytes ? ` · ${escape(Math.round(file.sizeBytes / 1024))} Ko` : ""}</small></span><span class="attachment-download">↓</span></div>`).join("")}</div>`;
  }
  if (activity.sourceType === "links-resources") {
    const items = block.activityItems ?? [];
    const compact = !block.title?.trim() && !block.contentHtml?.trim() && !block.summary?.trim() && items.every(item => !item.contentHtml?.trim());
    const intro = block.contentHtml?.trim() ? `<div class="rich">${rich(block.contentHtml, assets)}</div>` : "";
    const linkRows = items.map(item => {
      const url = item.resourceUrl?.trim() ?? "";
      let safe = false;
      try { const parsed = new URL(url); safe = item.resourceValid !== false && (["https:", "http:"].includes(parsed.protocol) ? Boolean(parsed.hostname && !parsed.username && !parsed.password) : parsed.protocol === "mailto:" && parsed.pathname.includes("@")); } catch { /* display an inactive action */ }
      const label = escape(item.title);
      return `<div class="resource-row"><div class="rich">${rich(item.contentHtml ?? "", assets)}</div>${safe ? `<a href="${escape(url)}">${label}</a>` : `<span class="invalid-resource">${label}</span>`}</div>`;
    }).join("");
    content = `<div class="pdf-resources ${compact ? "compact" : ""}" style="background:${color(block.panelBackgroundColor, "#edf4ff")};border-color:${color(block.panelBorderColor, "#123a7a")};border-width:${escape(block.panelBorderWidth || "2px")};border-style:${block.panelBorderStyle === "dashed" || block.panelBorderStyle === "dotted" ? block.panelBorderStyle : "solid"};border-radius:${block.panelRounded === false ? "0" : "22px"};--resource-accent:${color(block.buttonBackgroundColor, "#123a7a")};--resource-text:${color(block.buttonTextColor, "#ffffff")}"><span class="resource-globe">◎</span>${intro ? `<div class="resource-intro">${intro}</div>` : ""}<div class="resource-actions">${linkRows}</div>${block.summary ? `<p class="resource-after">${escape(block.summary)}</p>` : ""}</div>`;
  }
  if (activity.sourceType === "course-exit") {
    const layout = ["text-left-button-right", "button-left-text-right", "text-top-button-bottom"].includes(block.mediaLayout ?? "") ? block.mediaLayout : "button-only";
    const button = `<span class="exit-button" style="background:${color(activity.style.buttonBackgroundColor, "#123a7a")};color:${color(activity.style.buttonTextColor, "#ffffff")}">${escape(block.summary || "Sortir de la leçon")}</span>`;
    const exitCopy = activity.sections.filter(section => section.kind === "rich-text").map(section => rich(section.html, assets)).join("");
    content = `<div class="course-exit-layout ${escape(layout)}">${layout === "button-left-text-right" ? button : ""}${layout !== "button-only" ? `<div class="rich">${exitCopy}</div>` : ""}${layout === "button-left-text-right" ? "" : button}</div>`;
  }
  if (activity.sourceType === "card-sort") {
    content = renderPdfCardSort(block, html => rich(html, assets), item => item.frontImageAssetRef ? assetData(item.frontImageAssetRef, assets) ?? null : null)
      + content;
  }
  if (["image-grid", "timeline"].includes(activity.sourceType)) content = renderPdfActivity(block, html => rich(html, assets), ref => assetData(ref, assets));
  if (activity.sourceType === "matching") content = renderPdfActivity(block, html => rich(html, assets), ref => assetData(ref, assets)) + content;
  if (activity.sourceType === "html-custom") {
    content = assetData(`pdf-html-first-view/${block.id}`, assets)
      ? image({ref:`pdf-html-first-view/${block.id}`,role:"poster"}, assets)
      : `<p>Vue initiale indisponible pour cette activité HTML.</p>`;
  }
  if (activity.sourceType === "section-marker") {
    const marker = activity.sections.find(section => section.kind === "section-marker");
    const markerColor = color(block.dividerColor,"#123a7a");
    const markerType = block.markerType === "filled" ? "filled" : block.markerType === "none" ? "none" : "outline";
    content = `<div class="pdf-marker" style="color:${color(block.markerTextColor,"#123a7a")};--marker-line:${markerColor};--marker-width:${escape(block.dividerWidth || "2px")};--marker-style:${block.dividerStyle === "dashed" || block.dividerStyle === "dotted" ? block.dividerStyle : "solid"}"><i></i><span class="${markerType}" style="${markerType === "filled" ? `background:${markerColor}` : markerType === "none" ? "border-color:transparent" : ""}">${escape(marker?.label || "1")}</span><i></i></div>`;
  }
  if (activity.sourceType === "flip-cards") {
    const section = activity.sections.find(s => s.kind === "expanded-items");
    content = `<div class="pdf-flip-grid">${section?.items.map(item => `<div class="pdf-flip-pair">${["front","back"].map(face => `<div class="pdf-flip-face" style="background:${color(face === "front" ? block.flipCardFrontBackgroundColor : block.flipCardBackBackgroundColor,face === "front" ? "#f3f5fa" : "white")};border-color:${color(face === "front" ? block.flipCardFrontBorderColor : block.flipCardBackBorderColor,"#123a7a")};border-width:${escape(block.panelBorderWidth || "2px")};border-style:${block.panelBorderStyle === "dashed" || block.panelBorderStyle === "dotted" ? block.panelBorderStyle : "solid"}">${item.assets.filter(a => a.face === face).map(a => image(a, assets)).join("")}<div class="rich">${rich(face === "front" ? item.frontText || item.title : item.contentHtml, assets)}</div></div>`).join("")}</div>`).join("") ?? ""}</div>`;
  }
  const heading = model.profile === "learner"
    ? (activity.sourceType === "learner-transcript" ? `<h3>${escape(activity.label)}</h3>` : "")
    : `<div class="review-label">${escape(activity.heading)}</div>`;
  const showTitle = model.profile !== "learner";
  return `<article class="activity ${escape(activity.sourceType)}" data-activity-id="${escape(activity.id)}">${heading}${showTitle && activity.title && activity.title !== activity.label ? `<h3>${escape(activity.title)}</h3>` : ""}${content}${model.profile === "learner" ? "" : activity.imageAltStatuses.map(status => `<small>${escape(status === "filled" ? model.labels.altFilled : status === "decorative" ? model.labels.altDecorative : model.labels.altMissing)}</small>`).join("")}</article>`;
}

export function renderLessonPdfHtml(model: LessonPdfDocumentModel, project: PaideiaProject, assets: PreparedPdfAssets, fontCss = ""): string {
  const blocks = new Map(project.course.modules.flatMap(m => m.chapters).flatMap(c => c.pages).flatMap(p => p.blocks).map(b => [b.id, b]));
  const cover = model.coverImage && image(model.coverImage, assets);
  const learner = model.profile === "learner";
  const date = new Intl.DateTimeFormat(model.labels.locale || "fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(model.generatedAt ?? Date.now()));
  const coverSubtitle = learner ? `Support de leçon édité le ${date}` : model.labels.reviewDocument;
  const coverNotice = learner ? "<p class=\"edition-notice\">Ce document reflète les informations disponibles à sa date d’édition. Vérifiez leur actualité avant de les utiliser.</p>" : "";
  const body = `<section class="cover"><h1>${escape(model.lessonTitle)}</h1>${cover ?? ""}<p>${escape(coverSubtitle)}</p>${coverNotice}</section><section class="contents"><h1>${escape(model.labels.chapters)}</h1>${learner ? "" : `<p>${escape(model.labels.estimatedDuration)} : ${escape(formatEstimatedDuration(model.estimatedDurationSeconds))}</p><p class="duration-note">${escape(model.labels.durationCalculationNote)}</p>`}${model.chapterMenu.map(c => `<p><a href="#chapter-${c.order}">${c.order}. ${escape(c.title)}</a></p>`).join("")}</section>` + model.chapters.map(chapter => `<section class="chapter" id="chapter-${chapter.order}">${learner ? "" : `<div class="chapter-number">${escape(model.labels.chapter)} ${chapter.order}</div>`}<h1 class="chapter-title">${learner ? `${escape(model.labels.chapter)} ${chapter.order} — ` : ""}${escape(chapter.title)}</h1>${chapter.activities.map(a => activityHtml(a, blocks.get(a.id) ?? {id:a.id,type:a.sourceType,title:a.title,summary:"",trackingKey:a.id}, model, assets)).join("")}</section>`).join("") + (learner ? "" : model.assistantAppendices.map(a => `<section class="appendix"><h1>${escape(a.name)}</h1>${a.avatar ? image(a.avatar, assets) : ""}${a.entries.map(e => `<h3>${escape(e.term)}</h3>${e.aliases.length ? `<p>${escape(model.labels.aliases)} : ${escape(e.aliases.join(", "))}</p>` : ""}<div class="rich">${rich(e.contentHtml, assets)}</div>${e.related.length ? `<p>${escape(model.labels.relatedTerms)} : ${escape(e.related.join(", "))}</p>` : ""}`).join("")}</section>`).join(""));
  const printableBody = learner ? learnerBodyWithReferences(body, assets) : body;
  return `<!doctype html><html lang="${escape(project.defaultLocale || "fr")}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline';"><title>${escape(model.lessonTitle)}</title><style>${fontCss}
  ${cardSortCss}
  ${pdfActivityCss}
${imageTextActivityExportCss}
.expanded.audio{width:73.394495%;margin-inline:auto}.card-sort-monobloc{margin-bottom:24px;break-inside:avoid}.card-sort-monobloc button{font:inherit}.card-sort-monobloc p{margin-block:0}
@page{size:A4;margin:15mm 14mm}*{box-sizing:border-box;box-shadow:none!important;text-shadow:none!important}html{background:white}body{margin:0;width:${PDF_HTML_DESIGN_WIDTH}px;zoom:${PDF_HTML_PRINT_ZOOM};font:18px/1.5 'Inter','Atkinson Hyperlegible',sans-serif;color:${color(model.contentTextColor, "#222")};print-color-adjust:exact;-webkit-print-color-adjust:exact}h1,h2,h3,h4{line-height:1.25;color:#142752;break-after:avoid}h1{font-size:32px}h2{font-size:28px}h3{font-size:24px}h4{font-size:18px}p{margin:0 0 20px}a{color:#123a7a}img{max-width:100%}img.rich-inline-image[data-paideia-inline-rounded="true"]{border-radius:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #c5d0e5;padding:10px;overflow-wrap:anywhere}tr{break-inside:avoid}thead{display:table-header-group}ul,ol{padding-left:28px}li{margin-bottom:4px}blockquote{margin:18px 0;padding-left:18px;border-left:3px solid #123a7a}.cover{min-height:1100px;text-align:center;padding-top:110px;break-after:page}.cover h1{font-size:42px}.cover .media{max-width:100%;margin:35px auto}.contents{break-after:page}.chapter+.chapter,.appendix{break-before:page}.chapter-number{font-size:11px;color:#73809a;margin-bottom:8px;break-after:avoid}.chapter-title{margin:0 0 28px}.activity{margin-bottom:${Math.max(12, number(project.activitySpacingPx, 30))}px;break-inside:avoid}.activity.long{break-inside:auto}.review-label{font-size:11px;color:#73809a;margin-bottom:8px;break-after:avoid}.activity small{display:block;font-size:10px;color:#73809a}.rich{display:flow-root;overflow-wrap:break-word}.rich:after{content:'';display:table;clear:both}.rich p{orphans:3;widows:3}.media{display:block;position:relative;overflow:hidden;break-inside:avoid}.media img{display:block;width:100%;height:auto}.media.rounded{border-radius:20px}.media.crop img{position:absolute;max-width:none}.composition{width:var(--copy-width);margin:0 auto;display:flow-root}.composition.image-left,.composition.image-right{display:flex;gap:var(--gap);align-items:var(--vertical-align)}.composition.image-left>.media,.composition.image-right>.media{flex:0 0 calc(var(--image-width) - var(--gap)/2)}.composition.image-left>.rich,.composition.image-right>.rich{flex:1;min-width:0}.composition.image-right>.media{order:2}.composition.image-center>.media{width:var(--image-width);margin:0 auto var(--gap)}.composition.image-center>.rich{max-width:75%;margin:0 auto}.composition.image-below{display:flex;flex-direction:column;gap:var(--gap)}.composition.image-below>.media{order:2;width:var(--image-width);margin:auto}.standalone-media>.media{margin:0 auto 18px}.note-panel{width:min(100%,750px);margin-inline:auto;display:flex;align-items:start;gap:18px;background:white;break-inside:avoid}.note-panel>div:last-child{flex:1;min-width:0}.note-icon{flex:0 0 44px}.note-icon svg{width:100%}.note-panel p:last-child{margin-bottom:0}.navigation{text-align:center;margin:28px 0}.navigation span{display:inline-block;padding:12px 22px;border-radius:20px;font-weight:700;font-size:16px}.header-banner{background-size:cover;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;overflow:hidden}.header-banner h1,.header-banner h2,.header-banner h3{color:inherit}.header-banner p:last-child{margin-bottom:0}.header-banner .rich{width:100%}.expanded{margin:0 0 24px;padding:20px;border:1px solid #c5d0e5;border-radius:16px;break-inside:avoid}.expanded.long{break-inside:auto}.tab-strip{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;border-bottom:1px solid #c5d0e5}.tab-strip span{padding:8px 12px;font-size:16px}.tab-strip .selected{background:#123a7a;color:white;border-radius:10px 10px 0 0}.audio-player{display:flex;gap:18px;align-items:center;border:1px solid #c5d0e5;border-radius:12px;padding:14px;font-size:16px;margin-bottom:18px}.audio-track{flex:1;height:5px;background:#ccd6e7}.documentary-image{display:block;width:auto;height:auto;margin:auto;object-fit:contain}.documentary-svg{margin:auto}.documentary-svg svg{max-width:100%;height:auto}.documentary-table{margin-bottom:14px}.documentary-table.borderless td{border:none}.documentary-columns{display:flex}.documentary-columns>div{min-width:0}.documentary{font-size:18px;line-height:1.5}.documentary-table td>span{display:block}.paideia-rich-drop-cap{float:left;font-size:3.8em!important;line-height:.82!important;padding:0 .06em 0 0}.rich-inline-image{display:block}.rich-inline-image[data-paideia-image-layout="left"],.paideia-rich-image-float[data-paideia-rich-image-wrap="left"]{float:left;margin:4px 28px 14px 0;width:38%}.rich-inline-image[data-paideia-image-layout="right"],.paideia-rich-image-float[data-paideia-rich-image-wrap="right"]{float:right;margin:4px 0 14px 28px;width:38%}.rich-inline-image[data-paideia-image-layout="center"]{margin:18px auto}.paideia-rich-image-float img{width:100%}
/* Authored table and rich-image metadata uses the same contracts as the editor. */
.paideia-rich-table{--paideia-table-border-color:#c9d4e8;--paideia-table-border-width:1px}
.paideia-rich-table[data-paideia-table-border-width="2"]{--paideia-table-border-width:2px}
.paideia-rich-table[data-paideia-table-border-width="3"]{--paideia-table-border-width:3px}
.paideia-rich-table[data-paideia-table-border-width="4"]{--paideia-table-border-width:4px}
.paideia-rich-table th,.paideia-rich-table td{border:var(--paideia-table-border-width) solid var(--paideia-table-border-color)}
.paideia-rich-table[data-paideia-table-border-mode="outer"]{border:var(--paideia-table-border-width) solid var(--paideia-table-border-color)}
.paideia-rich-table[data-paideia-table-border-mode="outer"] th,.paideia-rich-table[data-paideia-table-border-mode="outer"] td,.paideia-rich-table[data-paideia-table-border-mode="none"] th,.paideia-rich-table[data-paideia-table-border-mode="none"] td{border-color:transparent}
.paideia-rich-table[data-paideia-table-border-mode="outer"] [data-paideia-table-edge-top]{border-top-color:var(--paideia-table-border-color)}
.paideia-rich-table[data-paideia-table-border-mode="outer"] [data-paideia-table-edge-right]{border-right-color:var(--paideia-table-border-color)}
.paideia-rich-table[data-paideia-table-border-mode="outer"] [data-paideia-table-edge-bottom]{border-bottom-color:var(--paideia-table-border-color)}
.paideia-rich-table[data-paideia-table-border-mode="outer"] [data-paideia-table-edge-left]{border-left-color:var(--paideia-table-border-color)}
.paideia-rich-table[data-paideia-table-border-mode="inner"] [data-paideia-table-edge-top]{border-top-color:transparent}
.paideia-rich-table[data-paideia-table-border-mode="inner"] [data-paideia-table-edge-right]{border-right-color:transparent}
.paideia-rich-table[data-paideia-table-border-mode="inner"] [data-paideia-table-edge-bottom]{border-bottom-color:transparent}
.paideia-rich-table[data-paideia-table-border-mode="inner"] [data-paideia-table-edge-left]{border-left-color:transparent}
.paideia-rich-table[data-paideia-table-width="75"]{width:75%;margin-inline:auto}.paideia-rich-table[data-paideia-table-width="50"]{width:50%;margin-inline:auto}.paideia-rich-table[data-paideia-table-width="auto"]{width:auto;margin-inline:auto}.paideia-rich-table[data-paideia-table-custom-size="true"]{width:var(--paideia-table-custom-width,75%);margin-left:var(--paideia-table-custom-offset,auto);margin-right:auto}.paideia-rich-table--striped tbody tr:nth-child(even) td{background:#f4f7fb}.paideia-rich-table[data-paideia-table-border-mode="none"] td,.paideia-rich-table--borderless td{border-color:transparent}.rich ul[data-paideia-list-marker="arrow"]>li::marker{content:"→  ";color:var(--paideia-list-marker-color);font-size:var(--paideia-list-marker-size);font-weight:var(--paideia-list-marker-weight)}.paideia-rich-image-float[data-paideia-rich-image-wrap]{display:block;width:auto;max-width:100%;margin-block:0}.paideia-rich-image-float[data-paideia-rich-image-wrap="left"]{margin-inline:0 1em}.paideia-rich-image-float[data-paideia-rich-image-wrap="right"]{margin-inline:1em 0}.paideia-rich-image-float img{width:auto;max-width:100%;height:auto}.rich-inline-image{max-width:min(100%,300px);max-height:300px;object-fit:contain}.rich p:not(:where(table p)){margin-block:0}
.tab-strip .tab-button{padding:8px 12px;font-size:16px}.tab-button p:last-child{margin-bottom:0}.expanded-title{font-weight:700;margin-bottom:20px}.duration-note{font-size:13px;color:#73809a}.composition.image-overlay{display:grid}.composition.image-overlay>.media,.composition.image-overlay>.rich{grid-area:1/1}.composition.image-overlay>.rich{align-self:center;padding:28px;background:rgba(255,255,255,.9)}
.rich p[style*="text-align:center"]>.rich-inline-image,.rich p[style*="text-align: center"]>.rich-inline-image{margin-inline:auto}
.expanded.audio{display:grid;grid-template-columns:25% minmax(0,1fr);gap:24px;padding:25px}.audio-cover{aspect-ratio:1;display:grid;place-items:center;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#edf4ff,#fff)}.audio-cover .media{width:100%;height:100%}.audio-cover img{width:100%;height:100%;object-fit:cover}.audio-cover svg{width:68px;height:68px}.audio-player{gap:10px;padding:10px;font-size:14px}.audio-track{min-width:15px}.pdf-marker{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;margin:28px auto}.pdf-marker i{flex:1;border-top:var(--marker-width) var(--marker-style) var(--marker-line)}.pdf-marker span{display:grid;place-items:center;flex:0 0 50px;height:50px;border:var(--marker-width) var(--marker-style) var(--marker-line);border-radius:50%;font-weight:700}.pdf-flip-grid{display:grid;gap:24px}.pdf-flip-pair{display:grid;grid-template-columns:repeat(2,minmax(0,calc((100% - 36px) / 3)));justify-content:center;gap:18px;break-inside:avoid-page;page-break-inside:avoid}.pdf-flip-face{min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:2px solid;border-radius:24px;padding:20px;overflow-wrap:anywhere}.pdf-flip-face .rich{width:100%}.pdf-flip-face img{max-height:180px;width:auto}.activity.matching *{filter:none!important}.video-frame{break-inside:avoid}.video-frame .media{width:100%;max-height:690px}.video-frame img{max-height:690px;object-fit:contain}.course-exit-layout{width:64%;margin:0 auto;display:flex;align-items:center;gap:24px;break-inside:avoid}.course-exit-layout .rich{flex:1;min-width:0}.course-exit-layout .exit-button{display:inline-block;padding:12px 22px;border-radius:20px;font-size:16px;font-weight:700;white-space:nowrap}.course-exit-layout.button-only{justify-content:center}.course-exit-layout.text-left-button-right,.course-exit-layout.button-left-text-right{justify-content:space-between}.course-exit-layout.text-top-button-bottom{flex-direction:column;align-items:stretch}.course-exit-layout.text-top-button-bottom .exit-button{align-self:center}
.pdf-quote{width:68.8%;margin:0 auto;padding:34px 26px 20px 20px;border:1px solid;display:grid;grid-template-columns:minmax(100px,var(--quote-image-width)) minmax(0,1fr);gap:28px;align-items:center;color:#102752;break-inside:avoid}.pdf-quote.without-image,.pdf-quote.image-center{grid-template-columns:minmax(0,1fr)}.pdf-quote.image-right{grid-template-columns:minmax(0,1fr) minmax(100px,var(--quote-image-width))}.pdf-quote.image-right .quote-image{grid-column:2;grid-row:1}.pdf-quote.image-right figcaption{grid-column:1;grid-row:1}.pdf-quote.image-center .quote-image{max-width:var(--quote-image-width);margin-inline:auto}.pdf-quote .quote-image img{max-height:260px;object-fit:cover}.pdf-quote figcaption{min-width:0}.quote-mark{display:block;color:var(--quote-accent);font:100px/0.8 Bellefair,Georgia,serif}.quote-mark.close{text-align:right}.quote-body{font:italic 18px/1.35 Spectral,Georgia,serif}.quote-author{margin-top:22px;font:15px/1.4 Spectral,Georgia,serif}.quote-author::before{content:"";display:block;width:82px;border-top:3px solid var(--quote-accent);margin-bottom:12px}.pdf-attachments{width:64%;margin-inline:auto;border:2px solid;overflow:hidden;break-inside:avoid}.pdf-attachment{display:flex;align-items:center;gap:20px;padding:16px 20px;border-bottom:1px solid #aabbd4;color:#123a7a}.pdf-attachment:last-child{border-bottom:0}.attachment-icon{flex:0 0 74px;height:74px;border:2px solid;border-radius:12px;display:grid;place-items:center;background:#fff;font-size:12px;font-weight:900;overflow-wrap:anywhere;text-align:center}.attachment-copy{min-width:0;flex:1;display:flex;flex-direction:column}.attachment-copy strong{overflow-wrap:anywhere}.attachment-copy small{color:#5870a6}.attachment-download{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#123a7a;color:#fff}.pdf-resources{width:95.4%;margin-inline:auto;display:grid;grid-template-columns:82px minmax(0,1fr);gap:16px 24px;align-items:center;padding:24px 26px;border:2px solid;break-inside:avoid}.resource-globe{grid-row:1/span 2;width:72px;height:72px;display:grid;place-items:center;border-radius:18px;background:#fff;color:var(--resource-accent);font-size:58px;line-height:1}.resource-intro{grid-column:2}.resource-actions{grid-column:2;display:grid;gap:10px}.resource-row{display:grid;grid-template-columns:minmax(0,1fr) max-content;align-items:center;gap:16px}.resource-row .rich p{margin:0}.resource-row a,.resource-row .invalid-resource{display:inline-flex;min-height:48px;align-items:center;justify-content:center;padding:8px 14px;border:2px solid var(--resource-accent);border-radius:7px;background:var(--resource-accent);color:var(--resource-text);font-weight:700;text-decoration:none;text-align:center}.resource-row .invalid-resource{opacity:.55}.resource-after{grid-column:1/-1;margin:0}.pdf-resources.compact{width:66%;grid-template-columns:72px minmax(0,1fr)}.pdf-resources.compact .resource-globe{grid-row:1}.pdf-resources.compact .resource-actions{grid-column:2}.pdf-resources.compact .resource-row{grid-template-columns:1fr}.pdf-resources.compact .resource-row .rich{display:none}
.edition-notice{max-width:560px;margin:18px auto;color:#64748b;font-size:16px}.learner-notes{break-before:page;padding-top:18px}.learner-notes h2{font-size:28px;margin:0 0 20px}.learner-notes ol{padding-left:30px}.learner-notes li{padding:0 0 12px;break-inside:avoid}.learner-note-definition{display:inline}.learner-note-definition p:first-child{display:inline}.learner-note-definition p{margin:0 0 6px}.learner-notes li:has(img) .learner-note-definition{display:block;margin-top:8px}.learner-note-definition img{display:block;width:auto!important;max-width:min(100%,200px)!important;max-height:200px;object-fit:contain;margin:10px 0}.learner-transcript{width:min(100%,750px);margin-inline:auto}
</style></head><body>${printableBody}</body></html>`;
}

/** Called by the print host after fonts/images have loaded, never by the editor. */
export function prepareLessonPdfHtmlForPrint(root: Document): void {
  for (const frame of root.querySelectorAll<HTMLElement>("[data-crop]")) {
    const img = frame.querySelector("img");
    const crop = JSON.parse(frame.dataset.crop ?? "null");
    if (!img?.naturalWidth || !crop) continue;
    frame.style.aspectRatio = frame.closest(".paideia-image-text-activity") ? `${crop.width} / ${crop.height}` : `${img.naturalWidth * crop.width} / ${img.naturalHeight * crop.height}`;
    frame.style.borderRadius = crop.shape === "ellipse" ? "50%" : "";
    Object.assign(img.style, {width:`${10000/crop.width}%`,height:`${10000/crop.height}%`,left:`-${crop.x*100/crop.width}%`,top:`-${crop.y*100/crop.height}%`});
  }
  prepareImageTextMedia(root);
  // Avoid is a preference only for blocks which fit one A4 printable page.
  const pageHeight = (267 / 25.4 * 96) / PDF_HTML_PRINT_ZOOM;
  for (const block of root.querySelectorAll<HTMLElement>(".activity,.expanded")) {
    if (block.getBoundingClientRect().height / PDF_HTML_PRINT_ZOOM > pageHeight - 80) block.classList.add("long");
  }
}
