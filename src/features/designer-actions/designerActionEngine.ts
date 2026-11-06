import type { DesignerBlockChange, PaideiaBlock, PaideiaProject } from "../../types/project";
import { decodeHtmlEntities } from "../../lib/htmlEntities";
import { activityBackgroundWideDefault, supportsActivityBackground, supportsActivityBackgroundProperty } from "../../app/activityAppearanceCapabilities";
import { activityAccentStorageProperty, supportsActivityFrameAppearance, type ActivityFrameAppearanceProperty } from "../../app/activityFrameAppearanceCapabilities";
import { designerHelpSubject, findExactDesignerActivity, isDesignerHelpRequest, resolveDesignerHelp, resolveDesignerHelpSubject, resolveExactDesignerActivityHelp, suggestDesignerHelp } from "./designerHelpEngine";
import type { DesignerHelpTranslation } from "./designerHelpRegistry";
import { PAIDEIA_ACTIVITY_CATALOG } from "./designerKnowledgeCatalog";
import { DESIGNER_CAPABILITIES, DESIGNER_OPERATION_CAPABILITIES, type DesignerActionSuggestion, type DesignerCapability, type DesignerSuggestionConcept } from "./designerCapabilityRegistry";
import { designerEditDistance, normalizeDesignerText as normalizeCommand } from "./designerLanguage";
import { ambiguousDesignerDocumentation, designerActivityDocumentation, designerDocumentationDisplayTitle, designerDocumentationGroupEntries } from "./designerDocumentationRegistry";
import { resolveDesignerIntent, resolveDesignerIntentWithTrace } from "./designerIntentRegistry";
import { DESIGNER_SLOT_REGISTRY, type DesignerSlotId } from "./designerSlotRegistry";
import { applyDesignerAddressForm, matchDesignerSocialResponse } from "./designerSocialRegistry";
import type {
  AppearanceActivityTarget, BackgroundIntensity, DesignerActionIntent, DesignerActionOperation, DesignerActionPreview, DesignerActionScope,
  DesignerActionTarget, DesignerConversationDraft, DesignerConversationResult
} from "./designerActionModel";
import {
  confirmationAnswer, extractActivitySpacing, extractAppearanceBoolean,
  extractActivityFrameBorderStyle, extractActivityFrameBorderWidth, extractBackgroundActivityTarget, extractBackgroundIntensity, extractBoolean, extractFontSize,
  extractFontActivityTarget, extractHeaderContentAlign, extractHeaderTextOutline, extractHeaderTextOutlineColor, extractHeight, extractOutline, extractReplacementLabel, extractSectionMarkerScheme, extractSectionMarkerType, extractSingleColor,
  extractSpacingActivityTarget, normalizeDesignerColor
} from "./designerValueExtractors";
export { normalizeDesignerColor } from "./designerValueExtractors";
export { DESIGNER_CAPABILITIES } from "./designerCapabilityRegistry";
export { applyDesignerAddressForm } from "./designerSocialRegistry";
export type { DesignerActionSuggestion } from "./designerCapabilityRegistry";
export type * from "./designerActionModel";

export type { DesignerSlotId } from "./designerSlotRegistry";

export function suggestionInputValue(suggestion: DesignerActionSuggestion) {
  return suggestion.command;
}

export function isDesignerCancellationRequest(command: string) {
  const normalized = normalizeCommand(command).replace(/[.!?]+$/g, "").trim();
  return /^(?:annul(?:e|es|ez|er)|abandonn(?:e|es|ez|er)|arret(?:e|es|ez|er|ons)|stopp?(?:e|es|ez|er)?|laiss(?:e|es|ez|er) tomber|oubli(?:e|es|ez|er)(?: ca| cela)?|ne (?:fais|fait|faites) (?:plus )?rien|ne (?:continue|continues|continuez) pas|ne rien faire|je (?:ne )?(?:veux|souhaite) plus|je renonce|j ai change d avis|finalement non|on arrete|aucun|aucune|rien)$/.test(normalized);
}

const backgroundPropertyByOperation: Partial<Record<string, Parameters<typeof supportsActivityBackgroundProperty>[1]>> = {
  "set-activity-background-image": "image",
  "remove-activity-background-image": "image",
  "set-activity-background-color": "color",
  "set-activity-background-overlay": "overlay",
  "set-activity-background-overlay-dark": "overlay",
  "set-activity-background-blur": "blur",
  "set-activity-background-wide": "wide",
  "set-activity-background-rounded": "rounded",
  "set-activity-background-height": "height"
};

function capabilitySupportedByActivityType(capability: DesignerCapability, blockType: string) {
  return capability.operationKinds.every((kind) => {
    const property = backgroundPropertyByOperation[kind];
    return !property || supportsActivityBackgroundProperty(blockType, property);
  });
}


type AppearanceTargetSpec = {
  target: AppearanceActivityTarget;
  activityReference?: string;
  activityType?: string;
  activityTypes?: string[];
  excludedActivityTypes?: string[];
};

function designerDisplayText(value: string) {
  return decodeHtmlEntities(value).replace(/\u00a0/g, " ");
}

function matchesAppearanceTarget(block: PaideiaBlock, title: string, target: AppearanceTargetSpec) {
  if (target.excludedActivityTypes?.includes(block.type)) return false;
  if (target.target === "all") return true;
  if (target.target === "type") return target.activityTypes?.length
    ? target.activityTypes.includes(block.type)
    : block.type === target.activityType;
  return normalizeCommand(title) === normalizeCommand(target.activityReference ?? "");
}

function frameAppearanceStorage(block: PaideiaBlock, property: "background-color" | "rounded" | "shadow") {
  if (block.type === "matching") {
    if (property === "background-color") return { property: "matchingLabelBackgroundColor" as const, value: block.matching?.labelAppearance.backgroundColor ?? "#FFFFFF", unset: false, label: "Fond des étiquettes" };
    if (property === "rounded") return { property: "matchingLabelRounded" as const, value: String(block.matching?.labelAppearance.rounded ?? true), unset: false, label: "Coins des étiquettes" };
  }
  if (block.type === "find-elements") {
    if (property === "rounded") return { property: "findElementsImageRounded" as const, value: String(block.findElements?.imageAppearance.rounded ?? true), unset: false, label: "Coins de l’image" };
    if (property === "shadow") return { property: "findElementsImageShadow" as const, value: String(block.findElements?.imageAppearance.shadow ?? false), unset: false, label: "Ombre de l’image" };
  }
  if (block.type === "slides") {
    if (property === "background-color") return { property: "slidesActivityBackgroundColor" as const, value: block.slidesActivityBackgroundColor ?? "#ffffff", unset: block.slidesActivityBackgroundColor == null, label: "Fond du diaporama" };
    if (property === "rounded") return { property: "slidesActivityRounded" as const, value: String(block.slidesActivityRounded ?? true), unset: block.slidesActivityRounded == null, label: "Coins du diaporama" };
    if (property === "shadow") return { property: "slidesActivityShadow" as const, value: String(block.slidesActivityShadow ?? true), unset: block.slidesActivityShadow == null, label: "Ombre du diaporama" };
  }
  if (block.type === "card-sort" && property === "rounded") {
    return { property: "cardSortCardRounded" as const, value: String(block.cardSort?.cardAppearance.rounded ?? true), unset: false, label: "Coins des cartes" };
  }
  if (property === "background-color") return { property: "panelBackgroundColor" as const, value: block.panelBackgroundColor ?? "", unset: block.panelBackgroundColor == null, label: "Fond" };
  if (property === "rounded") return { property: "panelRounded" as const, value: String(block.panelRounded ?? true), unset: block.panelRounded == null, label: "Coins d’activité" };
  return { property: "panelShadow" as const, value: String(block.panelShadow ?? false), unset: block.panelShadow == null, label: "Ombre" };
}

type DesignerBackgroundOperation = Extract<DesignerActionOperation, { kind:
  | "set-activity-background-image" | "remove-activity-background-image" | "reset-activity-background-property"
  | "set-activity-background-color" | "set-activity-background-overlay" | "set-activity-background-overlay-dark" | "set-activity-background-blur"
  | "set-activity-background-wide" | "set-activity-background-rounded" | "set-activity-background-height"
  | "reset-activity-background"
}>;

function isBackgroundOperation(operation: DesignerActionOperation): operation is DesignerBackgroundOperation {
  return operation.kind.startsWith("set-activity-background-") || operation.kind === "remove-activity-background-image" || operation.kind === "reset-activity-background-property" || operation.kind === "reset-activity-background";
}

function applyBackgroundTarget(
  operations: DesignerActionOperation[],
  resolvedTarget: AppearanceTargetSpec
) {
  return operations.map((operation) => isBackgroundOperation(operation) ? { ...operation, ...resolvedTarget } : operation);
}

type DesignerFrameOperation = Extract<DesignerActionOperation, { kind:
  | "set-activity-frame-background-color" | "set-activity-frame-border-color" | "set-activity-frame-accent-color"
  | "set-activity-frame-border-width" | "set-activity-frame-border-style" | "set-activity-frame-rounded"
  | "set-activity-frame-shadow" | "reset-activity-frame-appearance"
}>;

function isFrameOperation(operation: DesignerActionOperation): operation is DesignerFrameOperation {
  return operation.kind.startsWith("set-activity-frame-") || operation.kind === "reset-activity-frame-appearance";
}

function applyFrameTarget(operations: DesignerActionOperation[], resolvedTarget: AppearanceTargetSpec) {
  return operations.map((operation) => isFrameOperation(operation) ? { ...operation, ...resolvedTarget } : operation);
}

type DesignerDividerOperation = Extract<DesignerActionOperation, { kind:
  | "set-divider-color" | "set-divider-width" | "set-divider-style"
  | "set-section-marker-scheme" | "set-section-marker-type" | "set-section-marker-text-color"
  | "reset-divider-appearance" | "reset-section-marker-appearance"
}>;

function isDividerOperation(operation: DesignerActionOperation): operation is DesignerDividerOperation {
  return operation.kind.startsWith("set-divider-") || operation.kind.startsWith("set-section-marker-")
    || operation.kind === "reset-divider-appearance" || operation.kind === "reset-section-marker-appearance";
}

function applyDividerTarget(operations: DesignerActionOperation[], resolvedTarget: AppearanceTargetSpec) {
  return operations.map((operation) => isDividerOperation(operation) ? { ...operation, ...resolvedTarget } : operation);
}

function framePropertyForOperation(operation: DesignerFrameOperation): ActivityFrameAppearanceProperty | null {
  if (operation.kind === "set-activity-frame-background-color") return "background-color";
  if (operation.kind === "set-activity-frame-border-color") return "border-color";
  if (operation.kind === "set-activity-frame-accent-color") return "accent-color";
  if (operation.kind === "set-activity-frame-border-width") return "border-width";
  if (operation.kind === "set-activity-frame-border-style") return "border-style";
  if (operation.kind === "set-activity-frame-rounded") return "rounded";
  if (operation.kind === "set-activity-frame-shadow") return "shadow";
  return null;
}

function matchesBackgroundTarget(block: PaideiaBlock, title: string, operation: DesignerBackgroundOperation) {
  if (!supportsActivityBackground(block.type)) return false;
  return matchesAppearanceTarget(block, title, operation);
}

function applyBulkFontSize(html: string, sizePx: number) {
  const headings: string[] = [];
  const protectedHtml = html.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]\s*>/gi, (heading) => {
    const index = headings.push(heading) - 1;
    return `<!--paideia-heading-${index}-->`;
  });
  const editableTextElement = /<(p|span|li|a|strong|em|b|i|u|s|blockquote|td|th|caption)(\s[^>]*)?>/gi;
  let changed = false;
  const nextHtml = protectedHtml.replace(editableTextElement, (opening, tag: string, rawAttributes = "") => {
    changed = true;
    const styleMatch = rawAttributes.match(/\sstyle=(['"])(.*?)\1/i);
    if (!styleMatch) return `<${tag}${rawAttributes} style="font-size:${sizePx}px">`;
    const declarations = styleMatch[2]
      .split(";")
      .map((declaration: string) => declaration.trim())
      .filter((declaration: string) => declaration && !/^font-size\s*:/i.test(declaration));
    declarations.push(`font-size:${sizePx}px`);
    return `<${tag}${rawAttributes.replace(styleMatch[0], ` style=${styleMatch[1]}${declarations.join(";")}${styleMatch[1]}`)}>`;
  });
  const restored = nextHtml.replace(/<!--paideia-heading-(\d+)-->/g, (_placeholder, index: string) => headings[Number(index)] ?? "");
  if (changed) return restored;
  return headings.length ? html : `<span style="font-size:${sizePx}px">${html}</span>`;
}

function resetBulkFontSize(html: string) {
  const headings: string[] = [];
  const protectedHtml = html.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]\s*>/gi, (heading) => {
    const index = headings.push(heading) - 1;
    return `<!--paideia-heading-${index}-->`;
  });
  return protectedHtml.replace(/\sstyle=(['"])(.*?)\1/gi, (attribute, quote: string, rawStyle: string) => {
    const declarations = rawStyle.split(";").map((declaration) => declaration.trim()).filter((declaration) => declaration && !/^font-size\s*:/i.test(declaration));
    return declarations.length ? ` style=${quote}${declarations.join(";")}${quote}` : "";
  }).replace(/<!--paideia-heading-(\d+)-->/g, (_placeholder, index: string) => headings[Number(index)] ?? "");
}

function applyBulkFontFamily(html: string, fontFamily: string) {
  const editableTextElement = /<(p|div|span|h[1-6]|li|a|strong|em|b|i|u|s|blockquote|td|th|caption)(\s[^>]*)?>/gi;
  const cssValue = `"${fontFamily.replace(/["\\]/g, "")}"`;
  let changed = false;
  const nextHtml = html.replace(editableTextElement, (opening, tag: string, rawAttributes = "") => {
    changed = true;
    const styleMatch = rawAttributes.match(/\sstyle=(['"])(.*?)\1/i);
    if (!styleMatch) return `<${tag}${rawAttributes} style="font-family:${cssValue}">`;
    const declarations = styleMatch[2].split(";").map((item: string) => item.trim()).filter((item: string) => item && !/^font-family\s*:/i.test(item));
    declarations.push(`font-family:${cssValue}`);
    return `<${tag}${rawAttributes.replace(styleMatch[0], ` style=${styleMatch[1]}${declarations.join(";")}${styleMatch[1]}`)}>`;
  });
  return changed ? nextHtml : `<div style="font-family:${cssValue}">${html}</div>`;
}

function resetBulkFontFamily(html: string) {
  return html.replace(/\sstyle=(['"])(.*?)\1/gi, (_attribute, quote: string, rawStyle: string) => {
    const declarations = rawStyle.split(";").map((item) => item.trim()).filter((item) => item && !/^font-family\s*:/i.test(item));
    return declarations.length ? ` style=${quote}${declarations.join(";")}${quote}` : "";
  });
}

const excludedRichHtmlKeys = new Set(["sourceRawHtml", "transcriptHtml"]);

function transformBlockRichHtml(value: unknown, transform: (html: string) => string, key = ""): { value: unknown; count: number } {
  if (typeof value === "string") {
    if (!/Html$/.test(key) || excludedRichHtmlKeys.has(key) || !value.trim()) return { value, count: 0 };
    const next = transform(value);
    return { value: next, count: next === value ? 0 : 1 };
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const result = transformBlockRichHtml(item, transform);
      count += result.count;
      return result.value;
    });
    return { value: count ? next : value, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const next = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => {
      const result = transformBlockRichHtml(childValue, transform, childKey);
      count += result.count;
      return [childKey, result.value];
    }));
    return { value: count ? next : value, count };
  }
  return { value, count: 0 };
}

function isForbidden(normalized: string) {
  return /\b(supprime|supprimer|efface|effacer)\b\s+(?:(?:tous|toutes|les|la|le|l|un|une|des|ce|cette|ces)\s+)*(?:activite|activites|video|videos|chapitre|chapitres|lecon|lecons|dossier|dossiers|projet|projets)\b/.test(normalized)
    || /\b(supprime|supprimer|efface|effacer)\b\s+(?:(?:tous|toutes|les|la|le|l|un|une|des)\s+)*boutons?\s+(?:continuer|continue)\b/.test(normalized)
    || /\b(score lms|parametre scorm|parametres scorm|reglage scorm|reglages scorm)\b/.test(normalized)
    || /\b(execute|executer|commande systeme|powershell|cmd exe)\b/.test(normalized)
    || /\b(modifie|modifier|reecris|reecrire)\b.*\b(json|html personnalise|fichier projet)\b/.test(normalized)
    || /\b(genere|generer|cree|creer)\b.*\b(image|images)\b/.test(normalized);
}

function preferenceRequest(normalized: string): DesignerConversationResult | null {
  if (/\b(oublie|oublier|efface|effacer|supprime|supprimer)\b.*\b(preference|reponses? au feminin|feminin)\b/.test(normalized)
    || /\b(?:n utilise plus|ne plus utiliser|cesse d utiliser|arrete d utiliser)\b.*\bfeminin\b/.test(normalized)) {
    return { status: "preference", action: "forget-address-form" };
  }
  if (/\b(memorise|memoriser|retiens|retenir|souviens toi)\b.*\b(reponses? au feminin|parler au feminin|adresse.*feminin|feminin)\b/.test(normalized)) {
    return incomplete({
      context: "assistant-preference",
      scope: "lesson",
      operations: [],
      pendingSlots: ["assistant-address-form-persistence-confirmation"],
      preferenceAction: "remember-feminine"
    });
  }
  if (/^(?:feminin|feminine|feminise|feminiser)$/.test(normalized) || /\b(feminise|feminiser)\b.*\b(reponses?|formulations?)\b|\b(adresse toi|parle moi|reponds moi)\b.*\bau feminin\b|^je suis une femme$/.test(normalized)) {
    return { status: "preference", action: "use-feminine-session" };
  }
  return null;
}

function upsertOperation(operations: DesignerActionOperation[], operation: DesignerActionOperation) {
  return [...operations.filter((candidate) => candidate.kind !== operation.kind), operation];
}

function incomplete(draft: DesignerConversationDraft): DesignerConversationResult {
  const question = draft.pendingSlots[0];
  return {
    status: "incomplete",
    draft,
    question,
    control: DESIGNER_SLOT_REGISTRY[question].control
  };
}

export function completeDesignerBackgroundImageSelection(draft: DesignerConversationDraft, assetRef: string): DesignerConversationResult {
  if (draft.pendingSlots[0] !== "activity-background-image" || !assetRef.trim()) return incomplete(draft);
  const pending = draft.operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-background-image" }> => operation.kind === "set-activity-background-image");
  if (!pending) return incomplete(draft);
  const operations = upsertOperation(draft.operations, { ...pending, assetRef });
  const pendingSlots = draft.pendingSlots.slice(1);
  return pendingSlots.length
    ? incomplete({ ...draft, operations, pendingSlots })
    : { status: "ready", intent: { kind: "designer-command", scope: draft.scope, chapterReference: draft.chapterReference, chapterResolution: draft.chapterResolution, operations } };
}

function completeDraftParameter(command: string, draft: DesignerConversationDraft, translate?: DesignerHelpTranslation): DesignerConversationResult {
  const normalized = normalizeCommand(command);
  const [current, ...remaining] = draft.pendingSlots;
  let operations = [...draft.operations];
  if (current === "assistant-address-form-persistence-confirmation") {
    const confirmed = confirmationAnswer(normalized);
    if (confirmed === false) return { status: "cancelled" };
    if (confirmed !== true) return incomplete(draft);
    return { status: "preference", action: draft.preferenceAction ?? "remember-feminine" };
  }
  if (["appearance-property", "color-property", "font-property", "continue-button-property"].includes(current)) {
    if (current === "continue-button-property") {
      const nextSlot = /\b(libelle|intitule|texte du bouton)\b/.test(normalized) && !/\bcouleur\b/.test(normalized)
        ? "continue-button-label"
        : /\bcouleur\b/.test(normalized) && /\b(texte|police|libelle)\b/.test(normalized)
          ? "continue-button-text-color"
          : /\b(couleur|fond|arriere plan)\b/.test(normalized)
            ? "continue-button-background-color"
            : null;
      return nextSlot ? incomplete({ ...draft, pendingSlots: [nextSlot, ...remaining] }) : incomplete(draft);
    }
    const contextualCommand = current === "appearance-property" && !/\b(?:activite|activites)\b/.test(normalized)
        ? `${command} des activités`
        : current === "color-property" && !/\bcouleur\b/.test(normalized)
          ? `Couleur ${command}`
          : current === "font-property" && !/\b(police|fonte|typographie)\b/.test(normalized)
            ? `Police ${command}`
            : command;
    const chapter = draft.chapterReference ? ` dans le chapitre ${draft.chapterReference}` : "";
    const result = parseDesignerConversationTurn(`${contextualCommand}${chapter}`, null, draft.scope, translate);
    return result.status === "unsupported" ? incomplete(draft) : result;
  }
  if (current === "video-property" || current === "video-caption-property") {
    const prefix = current === "video-caption-property" ? "Pour toutes les vidéos, règle les sous-titres : " : "Pour toutes les vidéos, ";
    const chapter = draft.chapterReference ? ` dans le chapitre ${draft.chapterReference}` : "";
    return parseDesignerConversationTurn(`${prefix}${command}${chapter}`, null, draft.scope, translate);
  }
  if (current === "font-size-target") {
    if (/\b(lecon|lesson)\b/.test(normalized)) return { status: "unavailable", reason: "lesson-font-size" };
    if (/\b(activite|activites|blocs?)\b/.test(normalized)) {
      const sizePx = extractFontSize(normalized);
      if (sizePx === "ambiguous") return { status: "ambiguous" };
      if (sizePx) {
        const target = extractBackgroundActivityTarget(normalized) ?? { target: "all" as const };
        operations = upsertOperation(operations, { kind: "set-text-activity-font-size", sizePx, ...target });
        const nextDraft = { ...draft, context: "text-activity-font-size" as const, operations, pendingSlots: remaining };
        return remaining.length ? incomplete(nextDraft) : { status: "ready", intent: { kind: "designer-command", scope: draft.scope, chapterReference: draft.chapterReference, chapterResolution: draft.chapterResolution, operations } };
      }
      return incomplete({ ...draft, context: "text-activity-font-size", pendingSlots: ["text-activity-font-size", ...remaining] });
    }
    return incomplete(draft);
  }
  if (current === "activity-font-size-target") {
    const confirmation = confirmationAnswer(normalized);
    if (confirmation === false) return { status: "cancelled" };
    const target = confirmation === true ? { target: "all" as const } : extractBackgroundActivityTarget(normalized)
      ?? extractBackgroundActivityTarget(`toutes les activites ${normalized}`);
    if (!target) return incomplete(draft);
    operations = operations.map((operation) => operation.kind === "set-text-activity-font-size" || operation.kind === "reset-text-activity-font-size"
      ? { ...operation, ...target }
      : operation);
  }
  if (current === "activity-spacing-target") {
    const confirmation = confirmationAnswer(normalized);
    if (confirmation === false) return { status: "cancelled" };
    const target = confirmation === true ? { target: "all" as const } : extractSpacingActivityTarget(normalized)
      ?? extractSpacingActivityTarget(`toutes les activites ${normalized}`);
    if (!target) return incomplete(draft);
    const pendingReset = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "reset-activity-spacing" }> => operation.kind === "reset-activity-spacing");
    if (pendingReset) {
      operations = upsertOperation(operations, { ...pendingReset, ...target });
      const nextDraft = { ...draft, operations, pendingSlots: remaining };
      return remaining.length ? incomplete(nextDraft) : { status: "ready", intent: { kind: "designer-command", scope: draft.scope, chapterReference: draft.chapterReference, chapterResolution: draft.chapterResolution, operations } };
    }
    const pendingSpacing = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-spacing" }> => operation.kind === "set-activity-spacing");
    if (pendingSpacing) {
      operations = upsertOperation(operations, { ...pendingSpacing, ...target });
      const nextDraft = { ...draft, operations, pendingSlots: remaining };
      return remaining.length ? incomplete(nextDraft) : { status: "ready", intent: { kind: "designer-command", scope: draft.scope, chapterReference: draft.chapterReference, chapterResolution: draft.chapterResolution, operations } };
    }
    const spacing = extractActivitySpacing(normalized);
    if (spacing === "ambiguous") return { status: "ambiguous" };
    if (spacing) {
      operations = upsertOperation(operations, { kind: "set-activity-spacing", spacing, ...target });
      const nextDraft = { ...draft, operations, pendingSlots: remaining };
      return remaining.length ? incomplete(nextDraft) : { status: "ready", intent: { kind: "designer-command", scope: draft.scope, chapterReference: draft.chapterReference, chapterResolution: draft.chapterResolution, operations } };
    }
    return incomplete({ ...draft, pendingSlots: ["activity-spacing-value", ...remaining], operations: [{ kind: "set-activity-spacing", spacing: "medium", ...target }] });
  }
  if (current === "activity-font-target") {
    const confirmation = confirmationAnswer(normalized);
    if (confirmation === false) return { status: "cancelled" };
    const target = confirmation === true ? { target: "all" as const } : extractFontActivityTarget(normalized)
      ?? extractFontActivityTarget(`toutes les activites ${normalized}`)
      ?? extractFontActivityTarget(`pour ${normalized}`);
    if (!target) return incomplete(draft);
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-font-family" }> => operation.kind === "set-activity-font-family");
    if (!pending) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, ...target });
  } else if (current === "activity-font-family") {
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-font-family" }> => operation.kind === "set-activity-font-family");
    if (!pending || !command.trim()) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, fontReference: command.trim(), fontFamily: undefined, fontLabel: undefined });
  }
  else if (current === "activity-background-target") {
    const confirmation = confirmationAnswer(normalized);
    if (confirmation === false) return { status: "cancelled" };
    const resolvedTarget = confirmation === true ? { target: "all" as const } : extractBackgroundActivityTarget(normalized)
      ?? extractBackgroundActivityTarget(`toutes les activites ${normalized}`)
      ?? extractBackgroundActivityTarget(`pour ${normalized}`);
    if (!resolvedTarget) return incomplete(draft);
    operations = applyBackgroundTarget(operations, resolvedTarget);
    const nextDraft = { ...draft, operations, pendingSlots: remaining };
    return remaining.length ? incomplete(nextDraft) : {
      status: "ready",
      intent: { kind: "designer-command", scope: draft.scope, chapterReference: draft.chapterReference, chapterResolution: draft.chapterResolution, operations }
    };
  }
  if (current === "activity-frame-target") {
    const confirmation = confirmationAnswer(normalized);
    if (confirmation === false) return { status: "cancelled" };
    const resolvedTarget = confirmation === true ? { target: "all" as const } : extractBackgroundActivityTarget(normalized)
      ?? extractBackgroundActivityTarget(`toutes les activites ${normalized}`)
      ?? extractBackgroundActivityTarget(`pour ${normalized}`);
    if (!resolvedTarget) return incomplete(draft);
    operations = applyFrameTarget(operations, resolvedTarget);
    const nextDraft = { ...draft, operations, pendingSlots: remaining };
    return remaining.length ? incomplete(nextDraft) : {
      status: "ready",
      intent: { kind: "designer-command", scope: draft.scope, chapterReference: draft.chapterReference, chapterResolution: draft.chapterResolution, operations }
    };
  }
  if (current === "reset-confirmation") {
    const confirmed = confirmationAnswer(normalized);
    if (confirmed === false) return { status: "cancelled" };
    if (confirmed !== true) return incomplete(draft);
  }
  if (current === "lesson-text-color" || current === "video-caption-color" || current === "activity-background-color" || current === "activity-frame-background-color" || current === "activity-frame-border-color" || current === "activity-frame-accent-color" || current === "divider-color" || current === "section-marker-text-color" || current === "header-background-color" || current === "header-text-color" || current === "continue-button-background-color" || current === "continue-button-text-color") {
    const color = extractSingleColor(
      command,
      current === "video-caption-color" ? "#FFFFFF" : current === "lesson-text-color" ? "#222222" : "#FFFFFF",
      current === "activity-background-color" || current === "activity-frame-background-color" || current === "header-background-color"
    );
    if (color === "ambiguous") return { status: "ambiguous" };
    if (!color) return incomplete(draft);
    if (current === "lesson-text-color") operations = upsertOperation(operations, { kind: "set-lesson-text-color", color });
    else if (current === "video-caption-color") operations = upsertOperation(operations, { kind: "set-video-caption-color", color });
    else if (current === "activity-background-color") {
      const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-background-color" }> => operation.kind === "set-activity-background-color");
      if (!pending) return incomplete(draft);
      operations = upsertOperation(operations, { ...pending, color });
    } else if (current === "activity-frame-background-color" || current === "activity-frame-border-color" || current === "activity-frame-accent-color") {
      const expectedKind = current === "activity-frame-background-color"
        ? "set-activity-frame-background-color"
        : current === "activity-frame-border-color"
          ? "set-activity-frame-border-color"
          : "set-activity-frame-accent-color";
      const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: typeof expectedKind }> => operation.kind === expectedKind);
      if (!pending) return incomplete(draft);
      operations = upsertOperation(operations, { ...pending, color } as DesignerActionOperation);
    } else if (current === "divider-color" || current === "section-marker-text-color") {
      const expectedKind = current === "divider-color" ? "set-divider-color" : "set-section-marker-text-color";
      const pending = operations.find((operation) => operation.kind === expectedKind);
      if (!pending) return incomplete(draft);
      operations = upsertOperation(operations, { ...pending, color } as DesignerActionOperation);
    } else if (current === "header-background-color" || current === "header-text-color") {
      const expectedKind = current === "header-background-color" ? "set-header-background-color" : "set-header-text-color";
      const pending = operations.find((operation) => operation.kind === expectedKind);
      if (!pending) return incomplete(draft);
      operations = upsertOperation(operations, { ...pending, color } as DesignerActionOperation);
    } else if (current === "continue-button-background-color") operations = upsertOperation(operations, { kind: "set-continue-button-background", color });
    else operations = upsertOperation(operations, { kind: "set-continue-button-text-color", color });
  } else if (current === "video-caption-background") {
    const enabled = extractBoolean(normalized, "background");
    if (enabled === "ambiguous") return { status: "ambiguous" };
    if (enabled === null) return incomplete(draft);
    operations = upsertOperation(operations, { kind: "set-video-caption-background", enabled });
  } else if (current === "video-caption-outline") {
    const outline = extractOutline(normalized);
    if (outline === "ambiguous") return { status: "ambiguous" };
    if (!outline) return incomplete(draft);
    operations = upsertOperation(operations, { kind: "set-video-caption-outline", outline });
  } else if (current === "video-fullscreen") {
    const enabled = extractBoolean(normalized, "fullscreen");
    if (enabled === "ambiguous") return { status: "ambiguous" };
    if (enabled === null) return incomplete(draft);
    operations = upsertOperation(operations, { kind: "set-video-fullscreen", enabled });
  } else if (current === "text-activity-font-size") {
    const sizePx = extractFontSize(normalized);
    if (sizePx === "ambiguous") return { status: "ambiguous" };
    if (!sizePx) return incomplete(draft);
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-text-activity-font-size" }> => operation.kind === "set-text-activity-font-size");
    operations = upsertOperation(operations, pending ? { ...pending, sizePx } : { kind: "set-text-activity-font-size", sizePx, target: "all" });
  } else if (current === "activity-spacing-value") {
    const spacing = extractActivitySpacing(normalized);
    if (spacing === "ambiguous") return { status: "ambiguous" };
    if (!spacing) return incomplete(draft);
    const pendingSpacing = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-spacing" }> => operation.kind === "set-activity-spacing");
    if (!pendingSpacing) return incomplete(draft);
    operations = upsertOperation(operations, { ...pendingSpacing, spacing });
  } else if (current === "activity-background-overlay" || current === "activity-background-blur") {
    const intensity = extractBackgroundIntensity(normalized);
    if (intensity === "ambiguous") return { status: "ambiguous" };
    if (!intensity) return incomplete(draft);
    if (current === "activity-background-overlay") {
      const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-background-overlay" }> => operation.kind === "set-activity-background-overlay");
      if (!pending) return incomplete(draft);
      operations = upsertOperation(operations, { ...pending, intensity });
    } else {
      const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-background-blur" }> => operation.kind === "set-activity-background-blur");
      if (!pending) return incomplete(draft);
      operations = upsertOperation(operations, { ...pending, intensity });
    }
  } else if (current === "activity-background-wide" || current === "activity-background-rounded") {
    const enabled = extractAppearanceBoolean(normalized);
    if (enabled === "ambiguous") return { status: "ambiguous" };
    if (enabled === null) return incomplete(draft);
    if (current === "activity-background-wide") {
      const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-background-wide" }> => operation.kind === "set-activity-background-wide");
      if (!pending) return incomplete(draft);
      operations = upsertOperation(operations, { ...pending, enabled });
    } else {
      const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-background-rounded" }> => operation.kind === "set-activity-background-rounded");
      if (!pending) return incomplete(draft);
      operations = upsertOperation(operations, { ...pending, enabled });
    }
  } else if (current === "activity-background-height") {
    const height = extractHeight(normalized);
    if (height === "ambiguous") return { status: "ambiguous" };
    if (!height) return incomplete(draft);
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-background-height" }> => operation.kind === "set-activity-background-height");
    if (!pending) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, height });
  } else if (current === "activity-frame-border-width") {
    const width = extractActivityFrameBorderWidth(normalized);
    if (width === "ambiguous") return { status: "ambiguous" };
    if (!width) return incomplete(draft);
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-frame-border-width" | "set-divider-width" }> => operation.kind === "set-activity-frame-border-width" || operation.kind === "set-divider-width");
    if (!pending) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, width });
  } else if (current === "activity-frame-border-style") {
    const style = extractActivityFrameBorderStyle(normalized);
    if (style === "ambiguous") return { status: "ambiguous" };
    if (!style) return incomplete(draft);
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-activity-frame-border-style" | "set-divider-style" }> => operation.kind === "set-activity-frame-border-style" || operation.kind === "set-divider-style");
    if (!pending) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, style });
  } else if (current === "activity-frame-rounded" || current === "activity-frame-shadow") {
    const enabled = extractAppearanceBoolean(normalized);
    if (enabled === "ambiguous") return { status: "ambiguous" };
    if (enabled === null) return incomplete(draft);
    const expectedKind = current === "activity-frame-rounded" ? "set-activity-frame-rounded" : "set-activity-frame-shadow";
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: typeof expectedKind }> => operation.kind === expectedKind);
    if (!pending) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, enabled } as DesignerActionOperation);
  } else if (current === "section-marker-scheme") {
    const scheme = extractSectionMarkerScheme(normalized);
    if (scheme === "ambiguous") return { status: "ambiguous" };
    if (!scheme) return incomplete(draft);
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-section-marker-scheme" }> => operation.kind === "set-section-marker-scheme");
    if (!pending) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, scheme });
  } else if (current === "section-marker-type") {
    const markerType = extractSectionMarkerType(normalized);
    if (markerType === "ambiguous") return { status: "ambiguous" };
    if (!markerType) return incomplete(draft);
    const pending = operations.find((operation): operation is Extract<DesignerActionOperation, { kind: "set-section-marker-type" }> => operation.kind === "set-section-marker-type");
    if (!pending) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, markerType });
  } else if (current === "header-background-blur" || current === "header-background-overlay") {
    const intensity = extractBackgroundIntensity(normalized);
    if (intensity === "ambiguous") return { status: "ambiguous" };
    if (!intensity) return incomplete(draft);
    const expectedKind = current === "header-background-blur" ? "set-header-background-blur" : "set-header-background-overlay";
    const pending = operations.find((operation) => operation.kind === expectedKind);
    if (!pending) return incomplete(draft);
    operations = upsertOperation(operations, { ...pending, intensity } as DesignerActionOperation);
  } else if (current === "header-background-overlay-dark") {
    const enabled = /\b(sombre|noir)\b/.test(normalized) ? true : /\b(clair|blanc)\b/.test(normalized) ? false : null;
    if (enabled === null) return incomplete(draft);
    operations = upsertOperation(operations, { kind: "set-header-background-overlay-dark", enabled });
  } else if (current === "header-content-align") {
    const align = extractHeaderContentAlign(normalized);
    if (align === "ambiguous") return { status: "ambiguous" };
    if (!align) return incomplete(draft);
    operations = upsertOperation(operations, { kind: "set-header-content-align", align });
  } else if (current === "header-text-outline") {
    const outline = extractHeaderTextOutline(normalized);
    if (outline === "ambiguous") return { status: "ambiguous" };
    if (!outline) return incomplete(draft);
    operations = upsertOperation(operations, { kind: "set-header-text-outline", outline });
  } else if (current === "header-text-outline-color") {
    const outlineColor = extractHeaderTextOutlineColor(normalized);
    if (outlineColor === "ambiguous") return { status: "ambiguous" };
    if (!outlineColor) return incomplete(draft);
    operations = upsertOperation(operations, { kind: "set-header-text-outline-color", outlineColor });
  } else if (current === "continue-button-label") {
    const label = extractReplacementLabel(command) ?? command.trim();
    if (!label || label.length > 120 || /[\u0000-\u001F\u007F]/.test(label)) return incomplete(draft);
    operations = upsertOperation(operations, { kind: "set-continue-button-label", label });
  } else if (current === "chapter-reference-choice") {
    const choosesTitle = /\b(nom|nomme|nommee|titre|intitule|intitulee)\b/.test(normalized);
    const choosesOrdinal = /\b(position|ordre|premier|premiere|deuxieme|second|seconde|troisieme|quatrieme|cinquieme|\d+(?:er|e|eme))\b/.test(normalized);
    if (choosesTitle === choosesOrdinal) return incomplete(draft);
    const nextDraft = {
      ...draft,
      chapterResolution: choosesTitle ? "title" as const : "ordinal" as const,
      operations,
      pendingSlots: remaining
    };
    return remaining.length ? incomplete(nextDraft) : {
      status: "ready",
      intent: {
        kind: "designer-command",
        scope: draft.scope,
        chapterReference: draft.chapterReference,
        chapterResolution: nextDraft.chapterResolution,
        operations
      }
    };
  }
  const nextDraft = { ...draft, operations, pendingSlots: remaining };
  return remaining.length ? incomplete(nextDraft) : {
    status: "ready",
    intent: {
      kind: "designer-command",
      scope: draft.scope,
      chapterReference: draft.chapterReference,
      chapterResolution: draft.chapterResolution,
      operations
    }
  };
}

function splitDesignerCommands(command: string) {
  const quoted: string[] = [];
  const protectedCommand = command.replace(/"[^"]*"|«[^»]*»/g, value => { quoted.push(value); return `\u0000${quoted.length - 1}\u0000`; });
  return protectedCommand.split(/\s*;\s*|\s+(?:puis|ensuite)\s+|\s+et\s+(?=(?:mets|mettez|change|modifie|remplace|active|desactive|désactive|reinitialise|réinitialise)\b)/i)
    .map(value => value.replace(/\u0000(\d+)\u0000/g, (_, index) => quoted[Number(index)]).trim()).filter(Boolean);
}

export function parseDesignerConversationTurn(command: string, draft: DesignerConversationDraft | null = null, fallbackScope: DesignerActionScope = "lesson", translate?: DesignerHelpTranslation, interactionMode: "auto" | "help" | "actions" = "auto"): DesignerConversationResult {
  const commands = draft ? [command, ...(draft.queuedCommands ?? [])] : splitDesignerCommands(command);
  if (!draft && commands.length > 1 && !/\b(?:puis|ensuite)\b|;/.test(command)) {
    const existing = parseSingleDesignerTurn(command, null, fallbackScope, translate, interactionMode);
    if (existing.status === 'ready') return existing;
  }
  if (commands.length <= 1) return parseSingleDesignerTurn(command, draft, fallbackScope, translate, interactionMode);
  let accumulated = draft?.operations ?? [];
  let scope = draft?.scope ?? fallbackScope;
  let chapterReference = draft?.chapterReference;
  for (let index = 0; index < commands.length; index++) {
    let clause = commands[index];
    if (index > 0 && accumulated.some(operation => operation.kind.includes('continue-button')) && !/bouton/i.test(clause)) {
      clause = clause.replace(/\bleur\b/gi, 'des boutons Continuer').replace(/\bles\b/gi, 'les boutons Continuer');
    }
    const result = parseSingleDesignerTurn(clause, index === 0 ? draft : null, scope, translate, interactionMode);
    if (result.status === 'incomplete') return { ...result, draft: { ...result.draft, operations: [...(index === 0 && draft ? [] : accumulated), ...result.draft.operations], queuedCommands: commands.slice(index + 1), chapterReference: result.draft.chapterReference ?? chapterReference } };
    if (result.status !== 'ready') {
      if(accumulated.length && ['unsupported','ambiguous','unavailable'].includes(result.status))return incomplete({context:'activity-background',scope,chapterReference,operations:accumulated,pendingSlots:['unresolved-action'],queuedCommands:commands.slice(index+1)});
      return result;
    }
    accumulated = [...(index === 0 && draft ? [] : accumulated), ...result.intent.operations];
    scope = result.intent.scope;
    chapterReference = result.intent.chapterReference ?? chapterReference;
  }
  return { status: 'ready', intent: { kind: 'designer-command', scope, chapterReference, operations: accumulated } };
}

function parseSingleDesignerTurn(command: string, draft: DesignerConversationDraft | null = null, fallbackScope: DesignerActionScope = "lesson", translate?: DesignerHelpTranslation, interactionMode: "auto" | "help" | "actions" = "auto"): DesignerConversationResult {
  const normalized = normalizeCommand(command);
  const pendingSlot = draft?.pendingSlots[0];
  const bareNoneIsAValue = pendingSlot === "video-caption-outline"
    || pendingSlot === "activity-background-overlay"
    || pendingSlot === "activity-background-blur";
  if (draft && (
    /^(?:annule|annuler|abandonne|abandonner|stop|laisse tomber|ne fais rien|n en fais rien|oublie|oublier)(?:[.!?]+)?$/.test(normalized)
    || (!bareNoneIsAValue && /^(?:aucun|aucune|rien|non|non merci)(?:[.!?]+)?$/.test(normalized))
  )) return { status: "cancelled" };
  const genericActivityHelp = /^(?:aide\s+)?activites?$/.test(normalized);
  const genericBroadHelp = /^(?:aide\s+)?(?:chapitres?|projets?|lecons?|ressources?|images?|textes?|sous titres?)$/.test(normalized);
  const activityHelpDraft = () => {
    const activities = designerActivityDocumentation();
    return incomplete({
      context: "help",
      scope: fallbackScope,
      operations: [],
      pendingSlots: ["help-activity"],
      candidateCommands: activities.map((entry) => `Aide : ${designerDocumentationDisplayTitle(entry)}`),
      candidateSubjectIds: activities.map((entry) => entry.id)
    });
  };
  const ambiguousHelpDraft = (query: string) => {
    const matches = ambiguousDesignerDocumentation(query);
    if (!matches.length) return null;
    return incomplete({
      context: "help",
      scope: fallbackScope,
      operations: [],
      pendingSlots: ["help-choice"],
      candidateCommands: matches.map((entry) => `Aide : ${designerDocumentationDisplayTitle(entry)}`),
      candidateSubjectIds: matches.map((entry) => entry.id)
    });
  };
  const broadHelpDraft = (query: string) => {
    const matches = suggestDesignerHelp(query, 30, translate).filter((suggestion) => suggestion.id.startsWith("documentation:"));
    if (!matches.length) return null;
    return incomplete({
      context: "help",
      scope: fallbackScope,
      operations: [],
      pendingSlots: ["help-choice"],
      candidateCommands: matches.map((suggestion) => suggestion.command),
      candidateSubjectIds: matches.map((suggestion) => suggestion.id.replace(/^documentation:/, ""))
    });
  };
  if (!normalized) return draft ? incomplete(draft) : { status: "unsupported" };
  if (draft?.context === "activity-intent") {
    const activityLabel = draft.activityLabel ?? "cette activité";
    if (/^(?:aide|aide sur|consulter l aide|voir l aide)(?:\s+.*)?$/.test(normalized)) {
      const response = resolveExactDesignerActivityHelp(activityLabel);
      return response ? { status: "help", response } : incomplete(draft);
    }
    if (/^(?:modifier|modifie|modification|changer|change|editer|edition)(?:\s+.*)?$/.test(normalized)) {
      return incomplete({
        ...draft,
        context: "activity-target",
        pendingSlots: ["activity-property"],
        candidateCommands: undefined,
        candidateSubjectIds: undefined
      });
    }
    return incomplete(draft);
  }
  if (draft?.context === "activity-target") {
    const activityLabel = draft.activityLabel ?? "";
    const expanded = `${command} pour toutes les activités ${activityLabel}`.trim();
    const result = resolveDesignerIntent(expanded, normalizeCommand(expanded), draft.scope);
    if (result.status === "ready" || result.status === "incomplete") return result;
    return incomplete(draft);
  }
  if(draft?.pendingSlots[0]==='unresolved-action') {
    if(/^(?:annule|annuler|laisse tomber|rien)$/.test(normalized))return {status:'cancelled'};
    const result=resolveDesignerIntent(command,normalized,draft.scope);
    if(result.status==='ready')return {status:'ready',intent:{...result.intent,operations:[...draft.operations,...result.intent.operations]}};
    if(result.status==='incomplete')return {...result,draft:{...result.draft,operations:[...draft.operations,...result.draft.operations],queuedCommands:draft.queuedCommands}};
    return incomplete(draft);
  }
  if(draft?.pendingSlots[0]==='understanding-choice') {
    if(/^(?:non|aucune|rien|annuler|annule)$/.test(normalized))return {status:'cancelled'};
    const choices=draft.candidateCommands??[];
    if(normalized==='oui' && choices.length!==1)return incomplete(draft);
    const choice=choices.find(item=>normalizeCommand(item)===normalized) ?? (/^(?:oui|1|la premiere)$/.test(normalized) ? choices[0] : /^(?:2|la deuxieme)$/.test(normalized) ? choices[1] : /^(?:3|la troisieme)$/.test(normalized) ? choices[2] : undefined);
    if(choice)return resolveDesignerIntent(choice,normalizeCommand(choice),draft.scope);
    const next=resolveDesignerIntent(command,normalized,draft.scope);
    return next.status==='unsupported'?incomplete(draft):next;
  }
  if (isDesignerHelpRequest(command)) return incomplete({ context: "help", scope: fallbackScope, operations: [], pendingSlots: ["help-topic"] });
  if (genericActivityHelp && (interactionMode === "help" || draft?.context === "help")) return activityHelpDraft();
  if (genericBroadHelp && (interactionMode === "help" || draft?.context === "help")) {
    const broad = broadHelpDraft(command);
    if (broad) return broad;
  }
  const requestedHelpSubject = designerHelpSubject(command);
  if (requestedHelpSubject) {
    const ambiguous = ambiguousHelpDraft(requestedHelpSubject);
    if (ambiguous) return ambiguous;
    const response = resolveDesignerHelp(`Aide ${requestedHelpSubject}`, translate);
    if (response) return { status: "help", response };
  }
  if (draft?.context === "help") {
    if (/^(?:non|rien|aucun|aucune|annule|annuler|laisse tomber|non merci|merci)$/.test(normalized)) return { status: "cancelled" };
    if (draft.pendingSlots[0] === "help-related" || draft.pendingSlots[0] === "help-activity" || draft.pendingSlots[0] === "help-choice") {
      if (draft.pendingSlots[0] === "help-related" && /^(?:autre sujet|un autre sujet|changer de sujet|aide generale)$/.test(normalized)) {
        return incomplete({ context: "help", scope: draft.scope, operations: [], pendingSlots: ["help-topic"] });
      }
      const choices = draft.candidateCommands ?? [];
      if (/^(?:oui|volontiers|d accord)$/.test(normalized)) return incomplete(draft);
      const choiceIndex = choices.findIndex((item) => {
        const normalizedChoice = normalizeCommand(item);
        return normalized === normalizedChoice || normalized === normalizedChoice.replace(/^aide\s+/, "");
      });
      if (choiceIndex >= 0) {
        const choice = choices[choiceIndex];
        const subjectId = draft.candidateSubjectIds?.[choiceIndex];
        if (subjectId?.endsWith("-all")) {
          const entries = designerDocumentationGroupEntries(subjectId.replace(/^documentation:/, "").replace(/-all$/, ""));
          return incomplete({
            context: "help",
            scope: draft.scope,
            operations: [],
            pendingSlots: ["help-choice"],
            candidateCommands: entries.map((entry) => designerDocumentationDisplayTitle(entry)),
            candidateSubjectIds: entries.map((entry) => entry.id)
          });
        }
        const response = subjectId ? resolveDesignerHelpSubject(subjectId) : resolveDesignerHelp(choice, translate);
        if (response?.subjectId) return { status: "help", response };
      }
      // Help is a conversational context, not a closed mode: any independently
      // recognizable request leaves it immediately (action, social turn,
      // preference or a new explicit help request).
      const independentRequest = parseSingleDesignerTurn(command, null, fallbackScope, translate, interactionMode);
      if (independentRequest.status !== "unsupported") return independentRequest;
    }
    // The initial help-topic question already allowed an explicit editing
    // request to switch back to the action flow.
    if (/^(?:modifier|modifie|changer|change|remplacer|remplace|renommer|renomme|appliquer|applique|mettre|mets|faire|fais|supprimer|supprime|retirer|retire|effacer|efface|activer|active|desactiver|desactive)\b/.test(normalized)) {
      const action = resolveDesignerIntent(command, normalized, fallbackScope);
      if (action.status === "ready" || action.status === "incomplete") return action;
    }
    const helpSuggestions = suggestDesignerHelp(command, 5, translate);
    const ambiguous = ambiguousHelpDraft(command);
    if (ambiguous) return ambiguous;
    if (!helpSuggestions.length) return incomplete(draft);
    const response = resolveDesignerHelp(/^aide\b/.test(normalized) ? command : `Aide ${command}`, translate);
    if (response?.subjectId) return { status: "help", response };
    return incomplete(draft);
  }
  if (!draft) {
    const preference = preferenceRequest(normalized);
    if (preference) return preference;
  }
  if (!draft) {
    const exactActivity = findExactDesignerActivity(command);
    if (exactActivity) {
      if (interactionMode === "help") {
        const response = resolveExactDesignerActivityHelp(command);
        if (response) return { status: "help", response };
      }
      if (interactionMode === "actions") {
        return incomplete({
          context: "activity-target",
          scope: fallbackScope,
          operations: [],
          pendingSlots: ["activity-property"],
          activityType: exactActivity.blockType,
          activityLabel: exactActivity.name
        });
      }
      return incomplete({
        context: "activity-intent",
        scope: fallbackScope,
        operations: [],
        pendingSlots: ["activity-intent-choice"],
        activityType: exactActivity.blockType,
        activityLabel: exactActivity.name,
        candidateCommands: [`Aide sur l’activité ${exactActivity.name}`, `Modifier les activités ${exactActivity.name}`]
      });
    }
  }
  const social = matchDesignerSocialResponse(normalized);
  if (social === "politeness") return { status: "social", response: social };
  if (isForbidden(normalized)) return { status: "forbidden" };
  if (!draft && !/^comment\b/.test(normalized) && /(?:^|\s)(?:change|changer|modifie|modifier|remplace|remplacer|renomme|renommer|mets|mettez|fais|faire|applique|appliquer|active|activer|desactive|desactiver|supprime|supprimer|retire|retirer|efface|effacer|reinitialise|reinitialiser)\b/.test(normalized)) {
    const action = resolveDesignerIntent(command, normalized, fallbackScope);
    if (action.status !== "unsupported") return action;
  }
  if (social) return { status: "social", response: social };
  if (!draft && interactionMode === "help") {
    const ambiguous = ambiguousHelpDraft(command);
    if (ambiguous) return ambiguous;
    const contextualHelp = resolveDesignerHelp(/^aide\b/.test(normalized) ? command : `Aide ${command}`, translate);
    if (contextualHelp) return { status: "help", response: contextualHelp };
    const helpSuggestions = suggestDesignerHelp(command, 5, translate);
    return incomplete({
      context: "help",
      scope: fallbackScope,
      operations: [],
      pendingSlots: ["help-topic"],
      candidateCommands: helpSuggestions.map((suggestion) => suggestion.command),
      candidateSubjectIds: helpSuggestions.map((suggestion) => suggestion.id.replace(/^documentation:/, ""))
    });
  }
  if (!draft && interactionMode === "actions") {
    if (isForbidden(normalized)) return { status: "forbidden" };
    const action = resolveDesignerIntent(command, normalized, fallbackScope);
    if (action.status !== "unsupported") return action;
  }
  const help = resolveDesignerHelp(command, translate);
  if (help) return { status: "help", response: help };
  if (isForbidden(normalized)) return { status: "forbidden" };
  if (draft) return completeDraftParameter(command, draft, translate);
  return resolveDesignerIntent(command, normalized, fallbackScope);
}

export type DesignerFontOption = { value: string; label: string };

export function resolveDesignerFontSelection(result: DesignerConversationResult, fontOptions: DesignerFontOption[]): DesignerConversationResult {
  if (result.status !== "ready" && result.status !== "incomplete") return result;
  const source = result.status === "ready" ? result.intent : result.draft;
  let unresolved = false;
  const options = [
    { value: "__default__", label: "Police de la leçon (par défaut)" },
    ...fontOptions.filter((option) => option.value !== "__default__")
  ];
  const operations = source.operations.map((operation) => {
    if (operation.kind !== "set-activity-font-family" || operation.fontFamily) return operation;
    const reference = normalizeCommand(operation.fontReference);
    if (!reference) {
      unresolved = true;
      return operation;
    }
    if (operation.fontReference === "__default__" || /^(?:police )?(?:de la lecon|par defaut|defaut)$/.test(reference)) {
      return { ...operation, fontReference: "__default__", fontFamily: "__default__", fontLabel: "Police de la leçon" };
    }
    const exact = options.find((option) => normalizeCommand(option.label) === reference);
    const partial = options.filter((option) => {
      const label = normalizeCommand(option.label);
      return label.startsWith(reference) || reference.startsWith(label) || label.includes(reference);
    });
    const selected = exact ?? (partial.length === 1 ? partial[0] : null);
    if (!selected) {
      unresolved = true;
      return operation;
    }
    return { ...operation, fontFamily: selected.value, fontLabel: selected.label };
  });
  if (!unresolved) {
    if (result.status === "ready") return { ...result, intent: { ...result.intent, operations } };
    const pendingSlots = result.draft.pendingSlots.filter((slot) => slot !== "activity-font-family");
    return pendingSlots.length
      ? incomplete({ ...result.draft, operations, pendingSlots })
      : { status: "ready", intent: { kind: "designer-command", scope: result.draft.scope, chapterReference: result.draft.chapterReference, chapterResolution: result.draft.chapterResolution, operations } };
  }
  const draft: DesignerConversationDraft = result.status === "ready"
    ? { context: "activity-font-family", scope: result.intent.scope, chapterReference: result.intent.chapterReference, chapterResolution: result.intent.chapterResolution, operations, pendingSlots: ["activity-font-family"] }
    : { ...result.draft, operations, pendingSlots: result.draft.pendingSlots.includes("activity-font-family") ? result.draft.pendingSlots : ["activity-font-family", ...result.draft.pendingSlots] };
  return incomplete(draft);
}

export function suggestDesignerActions(value: string, limit = DESIGNER_CAPABILITIES.length, translate?: DesignerHelpTranslation): DesignerActionSuggestion[] {
  const query = normalizeCommand(value);
  if (!query) return [];
  const explicitlyRequestsEditing = /\b(change|changer|edition|editer|modifie|modifier|modification)\b/.test(query);
  const explicitlyRequestsHelp = /\b(a quoi sert|dis m en plus|explique|comment|quelle activite|compare|difference)\b/.test(query);
  if (explicitlyRequestsHelp) return suggestDesignerHelp(value, limit, translate);
  const concepts = new Set<DesignerSuggestionConcept>();
  if (/\b(couleur|color)\b/.test(query)) concepts.add("color");
  if (/\b(fond|arriere plan|background)\b/.test(query)) concepts.add("background");
  const requestsBackgroundImage = /\b(?:image|photo)\s+(?:(?:de|en|comme)\s+)?fond\b|\bfond\s+(?:(?:avec|en utilisant)\s+)?(?:une\s+)?(?:image|photo)\b/.test(query);
  if (requestsBackgroundImage) concepts.add("background-image");
  if (/\b(voile|opacite)\b/.test(query)) concepts.add("overlay");
  if (/\bflou\b/.test(query)) concepts.add("blur");
  if (/\b(fond large|pleine largeur)\b/.test(query)) concepts.add("wide");
  if (/\bcoins? arrondis?\b/.test(query)) concepts.add("rounded");
  if (/\b(sous titres?|subtitle|subtitles|captions|legendes)\b/.test(query)) concepts.add("captions");
  if (/\b(taille|dimension)\b.*\b(police|texte|caracteres|fonte)\b|\b(police|texte|caracteres|fonte)\b.*\b(taille|dimension)\b/.test(query)) concepts.add("font-size");
  if (/\b(police|polices|fonte|fontes|typographie)\b/.test(query) && !concepts.has("font-size") && !concepts.has("color")) concepts.add("font-family");
  if (/\b(plein ecran|fullscreen)\b/.test(query)) concepts.add("fullscreen");
  if (/\bhauteur\b/.test(query)) concepts.add("height");
  if (/\b(lecon|lesson)\b/.test(query)) concepts.add("lesson");
  if (/\b(padding|espacement|espace|marge|ecart|ecarts)\b/.test(query)) concepts.add("spacing");
  if (/\b(activite|activites)\s+(?:de\s+)?textes?\b|\bblocs?\s+textes?\b/.test(query)) concepts.add("text-activity");
  if (/\b(activite|activites)\b/.test(query) && !concepts.has("text-activity")) concepts.add("activity");
  if (/\b(video|videos|media|medias)\b/.test(query)) concepts.add("video");
  if (/\bboutons?\b/.test(query)) concepts.add("button");
  if (/\b(continuer|continue|suivant)\b/.test(query)) concepts.add("continue");
  if (/\b(libelle|intitule|renomme|renommer)\b/.test(query)) concepts.add("label");
  if (/\bcouleur\b/.test(query) && /\b(texte|police|libelle)\b/.test(query) && !concepts.has("background")) concepts.add("text-color");
  if (/\b(fem|feminin|feminine|feminise|feminiser|preference grammaticale)\b/.test(query)) concepts.add("preference");
  if (/\b(reinitialise|reinitialiser|remets|remettre)\b/.test(query)) concepts.add("reset");
  if (/\bapparence\b/.test(query)) concepts.add("appearance");
  if (/\b(supprime|supprimer|retire|retirer|efface|effacer)\b/.test(query) && requestsBackgroundImage) concepts.add("background-remove");
  const ignoredTokens = new Set([
    "a", "au", "aux", "d", "de", "des", "du", "en", "l", "la", "le", "les", "pour", "sur", "un", "une",
    "tous", "toutes", "chaque", "ensemble",
    "applique", "appliquer", "change", "changer", "edition", "editer", "fais", "faire", "met", "mets", "mettre", "modification", "modifie", "modifier", "regle", "regler", "utilise", "utiliser",
    "peux", "pourrais", "souhaite", "souhaiter", "veux", "voudrais"
  ]);
  const queryTokens = query.split(" ").filter((token) => !ignoredTokens.has(token) && !/^\d+$/.test(token));
  if (!queryTokens.length) {
    return explicitlyRequestsEditing
      ? DESIGNER_CAPABILITIES.filter((capability) => capability.operationKinds.length > 0).slice(0, limit)
      : [];
  }
  const forgetPreferenceQuery = /\b(oublie|oublier|efface|effacer|supprime|supprimer)\b/.test(query)
    || /\b(?:n utilise plus|ne plus utiliser|cesse d utiliser|arrete d utiliser)\b.*\bfeminin\b/.test(query);
  const tokenMatches = (queryToken: string, candidate: string) => candidate === queryToken
    || queryToken === `${candidate}s`
    || queryToken === `${candidate}x`
    || candidate === `${queryToken}s`
    || candidate === `${queryToken}x`
    || (queryToken.length >= 3 && candidate.length >= 3 && candidate.startsWith(queryToken))
    || (queryToken.length >= 5
      && candidate.length >= 5
      && queryToken[0] === candidate[0]
      && Math.abs(queryToken.length - candidate.length) <= 1
      && designerEditDistance(queryToken, candidate) <= 1);
  const targetableCapability = (suggestion: DesignerCapability) => suggestion.operationKinds.some((kind) => kind === "set-activity-font-family" || kind === "set-activity-spacing" || kind === "reset-activity-spacing" || kind.startsWith("set-activity-background-") || kind === "remove-activity-background-image" || kind === "reset-activity-background" || kind === "reset-activity-background-property");
  const catalogSearchTerms = PAIDEIA_ACTIVITY_CATALOG.flatMap((entry) => [entry.name, ...entry.aliases]).join(" ");
  const hasTargetableAppearanceConcept = concepts.has("activity") || ["appearance", "background", "background-image", "overlay", "blur", "wide", "rounded", "spacing", "height", "reset"].some((concept) => concepts.has(concept as DesignerSuggestionConcept));
  const extractedSuggestionTarget = hasTargetableAppearanceConcept ? extractBackgroundActivityTarget(query) : null;
  const requestedActivityType = extractedSuggestionTarget?.target === "type"
    ? PAIDEIA_ACTIVITY_CATALOG.find((entry) => entry.blockType === extractedSuggestionTarget.activityType) ?? null
    : null;
  const rankedActions = DESIGNER_CAPABILITIES.map((suggestion, registryIndex) => {
    if (requestedActivityType && targetableCapability(suggestion) && !capabilitySupportedByActivityType(suggestion, requestedActivityType.blockType)) return null;
    if (suggestion.id.startsWith("activity-background-overlay-dark-") && !/\b(sombre|noir|fonce|clair|blanc)\b/.test(query)) return null;
    for (const requiredConcept of ["background-image", "overlay", "blur", "wide", "rounded", "spacing", "font-family", "font-size", "fullscreen", "captions", "label"] as DesignerSuggestionConcept[]) {
      if (concepts.has(requiredConcept) && !suggestion.concepts.includes(requiredConcept)) return null;
    }
    if (concepts.has("reset") && !suggestion.concepts.includes("reset")) return null;
    if (concepts.has("reset") && suggestion.concepts.includes("video") && !concepts.has("video") && !concepts.has("captions") && !concepts.has("fullscreen")) return null;
    if (concepts.has("background-remove") && !suggestion.concepts.includes("background-remove")) return null;
    if (suggestion.concepts.includes("reset") && !concepts.has("reset")) return null;
    if (suggestion.concepts.includes("background-remove") && !concepts.has("background-remove")) return null;
    if (suggestion.concepts.includes("preference") && !concepts.has("preference")) return null;
    if (suggestion.concepts.includes("font-family") && !concepts.has("font-family")) return null;
    if ((concepts.has("continue") || concepts.has("button")) && !suggestion.concepts.includes("continue")) return null;
    if (suggestion.concepts.includes("continue") && !concepts.has("continue") && !concepts.has("button")) return null;
    if (suggestion.concepts.includes("video") && concepts.has("activity") && !concepts.has("video") && !concepts.has("captions") && !concepts.has("fullscreen")) return null;
    if (suggestion.id === "continue-button-text-color" && !concepts.has("text-color")) return null;
    if (suggestion.id === "continue-button-background" && concepts.has("text-color")) return null;
    if (suggestion.id === "assistant-feminine-session" && (/\b(memorise|memoriser)\b/.test(query) || forgetPreferenceQuery)) return null;
    if (suggestion.id === "assistant-feminine-remember" && (/\b(feminise|feminiser)\b/.test(query) || forgetPreferenceQuery)) return null;
    if (suggestion.id === "assistant-address-form-forget" && !forgetPreferenceQuery) return null;
    const command = normalizeCommand(suggestion.command);
    const searchText = normalizeCommand(`${suggestion.command} ${suggestion.searchTerms} ${targetableCapability(suggestion) && hasTargetableAppearanceConcept ? catalogSearchTerms : ""}`);
    const searchTokens = searchText.split(" ");
    const matches = queryTokens.every((queryToken) => searchTokens.some((token) => tokenMatches(queryToken, token)));
    if (!matches) return null;
    const conceptPenalty = [...concepts].filter((concept) => !suggestion.concepts.includes(concept)).length;
    const displaySuggestion = requestedActivityType && targetableCapability(suggestion) && !suggestion.concepts.includes("video")
      ? { ...suggestion, command: suggestion.command.replace("toutes les activités", `toutes les activités ${requestedActivityType.name}`) }
      : suggestion;
    return { suggestion: displaySuggestion, registryIndex, score: command.startsWith(query) ? 0 : queryTokens.reduce((total, token) => total + (searchText.includes(token) ? 0 : 1), 0) + conceptPenalty + 1 };
  }).filter((entry): entry is { suggestion: DesignerCapability; registryIndex: number; score: number } => entry !== null)
    .sort((left, right) => left.score - right.score || left.registryIndex - right.registryIndex).slice(0, limit).map(({ suggestion }) => suggestion);
  if (!rankedActions.length) return suggestDesignerHelp(value, limit);
  const firstTargetedIndex = rankedActions.findIndex((suggestion) => targetableCapability(suggestion) && !suggestion.concepts.includes("video"));
  const firstTargeted = firstTargetedIndex >= 0 ? rankedActions[firstTargetedIndex] : null;
  const generic = firstTargeted ? DESIGNER_CAPABILITIES.find((suggestion) => suggestion.id === firstTargeted.id) : null;
  if (!firstTargeted || !generic) return rankedActions;
  if (!requestedActivityType) {
    return rankedActions;
  }
  const globalVariant = generic.command === firstTargeted.command ? null : { ...generic, id: `${generic.id}-all` };
  const variants = [globalVariant].filter((suggestion): suggestion is DesignerCapability => Boolean(suggestion));
  return [...rankedActions.slice(0, firstTargetedIndex + 1), ...variants, ...rankedActions.slice(firstTargetedIndex + 1)].slice(0, limit);
}

export function suggestDesignerConversationStarters(value: string, translate?: DesignerHelpTranslation) {
  const parsed = parseDesignerConversationTurn(value, null, "lesson", translate);
  if (parsed.status === 'help') return suggestDesignerHelp(value, 6, translate);
  if (/\b(change|changer|edition|editer|modifie|modifier|modification)\b/.test(normalizeCommand(value))) {
    const actionSuggestions = suggestDesignerActions(value, 6, translate);
    if (actionSuggestions.length) return actionSuggestions;
  }
  if (value.trim().split(/\s+/).length <= 3 && parsed.status !== 'ready' && parsed.status !== 'social') {
    const helpSuggestions = suggestDesignerHelp(value, 5, translate);
    if (helpSuggestions.some(suggestion => suggestion.id.startsWith('documentation:'))) return helpSuggestions;
  }
  return parsed.status === "unsupported" || parsed.status === "ambiguous"
    ? suggestDesignerActions(value, undefined, translate)
    : [];
}

export type DesignerConversationDiagnostic = {
  normalized: string;
  mode: "social" | "help" | "action" | "unknown";
  candidates: Array<{ id: string; operationKinds: string[] }>;
  status: DesignerConversationResult["status"];
  operations: string[];
  pendingSlots: DesignerSlotId[];
  resolverId: string | null;
  resolverCapabilityIds: string[];
};

export function diagnoseDesignerConversation(command: string, draft: DesignerConversationDraft | null = null): DesignerConversationDiagnostic {
  const result = parseDesignerConversationTurn(command, draft);
  const trace = !draft && ["ready", "incomplete", "ambiguous", "unavailable"].includes(result.status)
    ? resolveDesignerIntentWithTrace(command, normalizeCommand(command), "lesson")
    : null;
  const suggestions = suggestDesignerActions(command, 12);
  const candidates = suggestions.map((suggestion) => {
    const capability = DESIGNER_CAPABILITIES.find((entry) => entry.id === suggestion.id || `${entry.id}-all` === suggestion.id || `${entry.id}-one` === suggestion.id);
    return { id: suggestion.id, operationKinds: capability ? [...capability.operationKinds] : [] };
  });
  const mode = result.status === "social" || result.status === "preference" ? "social"
    : result.status === "help" ? "help"
      : result.status === "ready" || result.status === "incomplete" || result.status === "forbidden" || result.status === "ambiguous" || result.status === "unavailable" ? "action"
        : "unknown";
  return {
    normalized: normalizeCommand(command),
    mode,
    candidates,
    status: result.status,
    operations: result.status === "ready" ? result.intent.operations.map((operation) => operation.kind)
      : result.status === "incomplete" ? result.draft.operations.map((operation) => operation.kind)
        : [],
    pendingSlots: result.status === "incomplete" ? [...result.draft.pendingSlots] : [],
    resolverId: trace?.resolverId ?? null,
    resolverCapabilityIds: trace?.capabilityIds ?? []
  };
}

type DesignerResolvedTarget = Pick<DesignerActionTarget, "property" | "previousValue" | "previousUnset" | "value" | "unset" | "blockTitle" | "previousDisplayValue" | "displayValue">;

function operationTarget(operation: DesignerActionOperation, block: PaideiaBlock, activitySpacingPx: number): DesignerResolvedTarget | null {
  const title = designerDisplayText(block.title || block.mediaFileName || (block.type === "media" ? "Vidéo" : block.type === "rich-text" ? "Texte" : "Activité"));
  const matchesTarget = (candidate: DesignerBackgroundOperation) => matchesBackgroundTarget(block, title, candidate);
  const booleanLabel = (value: boolean, plural = false) => value ? (plural ? "Activés" : "Activé") : (plural ? "Désactivés" : "Désactivé");
  const intensityLabel = (intensity: BackgroundIntensity) => intensity === "none" ? "Aucun" : intensity === "light" ? "Léger" : intensity === "medium" ? "Moyen" : "Fort";
  switch (operation.kind) {
    case "set-video-caption-color": return { property: "videoCaptionColor", previousValue: block.videoCaptionColor ?? "#FFFFFF", previousUnset: block.videoCaptionColor == null, value: operation.color, blockTitle: `${title} · Couleur des sous-titres` };
    case "set-video-caption-background": return { property: "videoCaptionBackgroundEnabled", previousValue: String(block.videoCaptionBackgroundEnabled ?? true), previousUnset: block.videoCaptionBackgroundEnabled == null, value: String(operation.enabled), blockTitle: `${title} · Fond des sous-titres`, previousDisplayValue: booleanLabel(block.videoCaptionBackgroundEnabled ?? true), displayValue: booleanLabel(operation.enabled) };
    case "set-video-caption-outline": return { property: "videoCaptionOutline", previousValue: block.videoCaptionOutline ?? "none", previousUnset: block.videoCaptionOutline == null, value: operation.outline, blockTitle: `${title} · Contour des sous-titres` };
    case "set-video-fullscreen": return { property: "videoAllowFullscreen", previousValue: String(block.videoAllowFullscreen ?? true), previousUnset: block.videoAllowFullscreen == null, value: String(operation.enabled), blockTitle: `${title} · Plein écran`, previousDisplayValue: booleanLabel(block.videoAllowFullscreen ?? true), displayValue: booleanLabel(operation.enabled) };
    case "reset-video-caption-color": return block.type === "media" ? { property: "videoCaptionColor", previousValue: block.videoCaptionColor ?? "#FFFFFF", previousUnset: block.videoCaptionColor == null, value: "#FFFFFF", unset: true, blockTitle: `${title} · Couleur des sous-titres`, displayValue: "Blanc (par défaut)" } : null;
    case "reset-video-caption-background": return block.type === "media" ? { property: "videoCaptionBackgroundEnabled", previousValue: String(block.videoCaptionBackgroundEnabled ?? true), previousUnset: block.videoCaptionBackgroundEnabled == null, value: "true", unset: true, blockTitle: `${title} · Fond des sous-titres`, displayValue: "Activé (par défaut)" } : null;
    case "reset-video-caption-outline": return block.type === "media" ? { property: "videoCaptionOutline", previousValue: block.videoCaptionOutline ?? "none", previousUnset: block.videoCaptionOutline == null, value: "none", unset: true, blockTitle: `${title} · Contour des sous-titres`, displayValue: "Aucun (par défaut)" } : null;
    case "reset-video-fullscreen": return block.type === "media" ? { property: "videoAllowFullscreen", previousValue: String(block.videoAllowFullscreen ?? true), previousUnset: block.videoAllowFullscreen == null, value: "true", unset: true, blockTitle: `${title} · Plein écran`, displayValue: "Autorisé (par défaut)" } : null;
    case "set-text-activity-font-size": {
      if (!matchesAppearanceTarget(block, title, operation)) return null;
      if (block.type === "rich-text") {
        const previousValue = block.contentHtml ?? "";
        const value = applyBulkFontSize(previousValue, operation.sizePx);
        return { property: "textActivityContentHtml", previousValue, value, blockTitle: `${title || "Texte"} · Taille du texte courant`, previousDisplayValue: "Actuelle", displayValue: `${operation.sizePx}px` };
      }
      const previousValue = JSON.stringify(block);
      const transformed = transformBlockRichHtml(block, (html) => applyBulkFontSize(html, operation.sizePx));
      if (!transformed.count) return null;
      return { property: "activityRichTextBlockJson", previousValue, value: JSON.stringify(transformed.value), blockTitle: `${title || "Activité"} · Taille du texte courant`, previousDisplayValue: "Actuelle", displayValue: `${operation.sizePx}px` };
    }
    case "reset-text-activity-font-size": {
      if (!matchesAppearanceTarget(block, title, operation)) return null;
      if (block.type === "rich-text") {
        const previousValue = block.contentHtml ?? "";
        return { property: "textActivityContentHtml", previousValue, value: resetBulkFontSize(previousValue), blockTitle: `${title || "Texte"} · Taille du texte courant`, previousDisplayValue: "Actuelle", displayValue: "Taille héritée de la leçon" };
      }
      const previousValue = JSON.stringify(block);
      const transformed = transformBlockRichHtml(block, resetBulkFontSize);
      if (!transformed.count) return null;
      return { property: "activityRichTextBlockJson", previousValue, value: JSON.stringify(transformed.value), blockTitle: `${title || "Activité"} · Taille du texte courant`, previousDisplayValue: "Actuelle", displayValue: "Taille héritée de la leçon" };
    }
    case "set-activity-font-family": {
      if (!operation.fontFamily || !matchesAppearanceTarget(block, title, operation)) return null;
      const previousValue = JSON.stringify(block);
      const transformed = transformBlockRichHtml(
        block,
        operation.fontFamily === "__default__"
          ? resetBulkFontFamily
          : (html) => applyBulkFontFamily(html, operation.fontFamily as string)
      );
      if (!transformed.count) return null;
      return {
        property: "activityRichTextBlockJson",
        previousValue,
        value: JSON.stringify(transformed.value),
        blockTitle: `${title || "Activité"} · Police des textes`,
        previousDisplayValue: "Actuelle",
        displayValue: operation.fontFamily === "__default__" ? "Police de la leçon" : operation.fontLabel ?? operation.fontFamily
      };
    }
    case "set-activity-spacing": {
      if (!matchesAppearanceTarget(block, title, operation)) return null;
      const hasBackground = Boolean(block.sectionBackgroundColor || block.sectionBackgroundImageRef);
      const centeredImageText = block.type === "image-text" && block.mediaLayout === "image-center";
      const intrinsicPadding = block.type === "header"
        ? 32
        : !hasBackground || centeredImageText || block.sectionBackgroundHeight === "minimum"
          ? 0
          : block.sectionBackgroundHeight === "large"
            ? 150
            : 75;
      const basePadding = activitySpacingPx + intrinsicPadding;
      const minimumPadding = block.type === "divider" || block.type === "header" ? 0 : 10;
      const minimumOffset = minimumPadding - basePadding;
      const previousOffset = Math.max(minimumOffset, Math.min(90, Math.round(block.paddingOffset ?? 0)));
      const nextOffset = operation.spacing === "minimum" ? minimumOffset : operation.spacing === "maximum" ? 90 : 0;
      const spacingLabel = operation.spacing === "minimum" ? "Minimum" : operation.spacing === "maximum" ? "Maximum" : "Moyen";
      const previousLabel = previousOffset === minimumOffset ? "Minimum" : previousOffset === 0 ? "Moyen" : previousOffset === 90 ? "Maximum" : `${previousOffset}px`;
      return { property: "paddingOffset", previousValue: String(previousOffset), previousUnset: block.paddingOffset == null, value: String(nextOffset), blockTitle: `${title || "Activité"} · Espacement`, previousDisplayValue: previousLabel, displayValue: spacingLabel };
    }
    case "reset-activity-spacing": {
      if (!matchesAppearanceTarget(block, title, operation)) return null;
      const previousOffset = Math.max(-240, Math.min(90, Math.round(block.paddingOffset ?? 0)));
      return { property: "paddingOffset", previousValue: String(previousOffset), previousUnset: block.paddingOffset == null, value: "0", unset: true, blockTitle: `${title || "Activité"} · Espacement`, previousDisplayValue: `${previousOffset}px`, displayValue: "Moyen (par défaut)" };
    }
    case "set-activity-background-image": {
      if (!matchesTarget(operation)) return null;
      const previousValue = block.sectionBackgroundImageRef ?? "";
      const displayValue = operation.assetRef.replace(/^pending:/, "").split(/[\\/]/).pop() || "Image sélectionnée";
      return { property: "sectionBackgroundImageRef", previousValue, previousUnset: block.sectionBackgroundImageRef == null, value: operation.assetRef, blockTitle: `${title} · Image de fond`, previousDisplayValue: previousValue ? "Image existante" : "Aucune", displayValue };
    }
    case "remove-activity-background-image": {
      if (!matchesTarget(operation)) return null;
      const previousValue = block.sectionBackgroundImageRef ?? "";
      return { property: "sectionBackgroundImageRef", previousValue, previousUnset: block.sectionBackgroundImageRef == null, value: "", unset: true, blockTitle: `${title} · Image de fond`, previousDisplayValue: previousValue ? "Image existante" : "Aucune", displayValue: "Aucune" };
    }
    case "reset-activity-background-property": {
      if (!matchesTarget(operation)) return null;
      if (operation.property === "color") return { property: "sectionBackgroundColor", previousValue: block.sectionBackgroundColor ?? "", previousUnset: block.sectionBackgroundColor == null, value: "", unset: true, blockTitle: `${title} · Couleur de fond`, displayValue: "Par défaut" };
      if (operation.property === "overlay") return { property: "sectionBackgroundOpacity", previousValue: String(block.sectionBackgroundOpacity ?? 1), previousUnset: block.sectionBackgroundOpacity == null, value: "1", unset: true, blockTitle: `${title} · Voile de fond`, displayValue: "Aucun" };
      if (operation.property === "overlay-color") return { property: "sectionBackgroundOverlayDark", previousValue: String(block.sectionBackgroundOverlayDark ?? true), previousUnset: block.sectionBackgroundOverlayDark == null, value: "true", unset: true, blockTitle: `${title} · Couleur du voile`, displayValue: "Sombre (par défaut)" };
      if (operation.property === "blur") return { property: "sectionBackgroundBlur", previousValue: String(block.sectionBackgroundBlur ?? 0), previousUnset: block.sectionBackgroundBlur == null, value: "0", unset: true, blockTitle: `${title} · Flou de fond`, displayValue: "Aucun" };
      if (operation.property === "wide") {
        const defaultWide = activityBackgroundWideDefault(block.type);
        return { property: "sectionBackgroundWide", previousValue: String(block.sectionBackgroundWide ?? defaultWide), previousUnset: block.sectionBackgroundWide == null, value: String(defaultWide), unset: true, blockTitle: `${title} · Fond large`, displayValue: defaultWide ? "Activé (par défaut)" : "Désactivé (par défaut)" };
      }
      if (operation.property === "rounded") return { property: block.type === "situational-dialogue" ? "panelRounded" : "sectionBackgroundRounded", previousValue: String(block.type === "situational-dialogue" ? block.panelRounded ?? true : block.sectionBackgroundRounded ?? true), previousUnset: block.type === "situational-dialogue" ? block.panelRounded == null : block.sectionBackgroundRounded == null, value: "true", unset: true, blockTitle: `${title} · Coins arrondis`, displayValue: "Activés (par défaut)" };
      if (!supportsActivityBackgroundProperty(block.type, "height")) return null;
      return { property: "sectionBackgroundHeight", previousValue: block.sectionBackgroundHeight ?? "medium", previousUnset: block.sectionBackgroundHeight == null, value: "medium", unset: true, blockTitle: `${title} · Hauteur`, displayValue: "Moyenne (par défaut)" };
    }
    case "set-activity-background-color": {
      if (!matchesTarget(operation)) return null;
      if (operation.color === "transparent") {
        return {
          property: "sectionBackgroundColor",
          previousValue: block.sectionBackgroundColor ?? "",
          previousUnset: block.sectionBackgroundColor == null,
          value: "",
          unset: true,
          blockTitle: `${title} · Couleur de fond`,
          displayValue: "Sans"
        };
      }
      return { property: "sectionBackgroundColor", previousValue: block.sectionBackgroundColor ?? "", previousUnset: block.sectionBackgroundColor == null, value: operation.color, blockTitle: `${title} · Couleur de fond` };
    }
    case "set-activity-background-overlay": {
      if (!matchesTarget(operation)) return null;
      const overlays: Record<BackgroundIntensity, number> = { none: 0, light: 0.25, medium: 0.5, strong: 0.75 };
      const overlay = overlays[operation.intensity];
      return { property: "sectionBackgroundOpacity", previousValue: String(block.sectionBackgroundOpacity ?? 1), previousUnset: block.sectionBackgroundOpacity == null, value: String(1 - overlay), blockTitle: `${title} · Voile de fond`, displayValue: intensityLabel(operation.intensity) };
    }
    case "set-activity-background-overlay-dark": {
      if (!matchesTarget(operation)) return null;
      const previousValue = block.sectionBackgroundOverlayDark ?? true;
      return { property: "sectionBackgroundOverlayDark", previousValue: String(previousValue), previousUnset: block.sectionBackgroundOverlayDark == null, value: String(operation.enabled), blockTitle: `${title} · Couleur du voile`, previousDisplayValue: previousValue ? "Sombre" : "Clair", displayValue: operation.enabled ? "Sombre" : "Clair" };
    }
    case "set-activity-background-blur": {
      if (!matchesTarget(operation)) return null;
      const blurs: Record<BackgroundIntensity, number> = { none: 0, light: 4, medium: 8, strong: 12 };
      return { property: "sectionBackgroundBlur", previousValue: String(block.sectionBackgroundBlur ?? 0), previousUnset: block.sectionBackgroundBlur == null, value: String(blurs[operation.intensity]), blockTitle: `${title} · Flou de fond`, displayValue: intensityLabel(operation.intensity) };
    }
    case "set-activity-background-wide": {
      if (!matchesTarget(operation)) return null;
      return { property: "sectionBackgroundWide", previousValue: String(block.sectionBackgroundWide ?? false), previousUnset: block.sectionBackgroundWide == null, value: String(operation.enabled), blockTitle: `${title} · Fond large`, previousDisplayValue: booleanLabel(block.sectionBackgroundWide ?? false), displayValue: booleanLabel(operation.enabled) };
    }
    case "set-activity-background-rounded": {
      if (!matchesTarget(operation)) return null;
      const previousEnabled = block.type === "situational-dialogue" ? block.panelRounded ?? true : block.sectionBackgroundRounded ?? true;
      return { property: block.type === "situational-dialogue" ? "panelRounded" : "sectionBackgroundRounded", previousValue: String(previousEnabled), previousUnset: block.type === "situational-dialogue" ? block.panelRounded == null : block.sectionBackgroundRounded == null, value: String(operation.enabled), blockTitle: `${title} · Coins arrondis`, previousDisplayValue: booleanLabel(previousEnabled, true), displayValue: booleanLabel(operation.enabled, true) };
    }
    case "set-activity-background-height": {
      if (!matchesTarget(operation) || !supportsActivityBackgroundProperty(block.type, "height")) return null;
      const label = operation.height === "minimum" ? "Minimale" : operation.height === "medium" ? "Moyenne" : "Grande";
      return { property: "sectionBackgroundHeight", previousValue: block.sectionBackgroundHeight ?? "medium", previousUnset: block.sectionBackgroundHeight == null, value: operation.height, blockTitle: `${title} · Hauteur`, displayValue: label };
    }
    case "set-activity-frame-background-color": {
      if (!matchesAppearanceTarget(block, title, operation) || !supportsActivityFrameAppearance(block.type, "background-color")) return null;
      const storage = frameAppearanceStorage(block, "background-color");
      return { property: storage.property, previousValue: storage.value, previousUnset: storage.unset, value: operation.color === "transparent" ? "" : operation.color, unset: operation.color === "transparent", blockTitle: `${title} · ${storage.label}`, displayValue: operation.color === "transparent" ? "Sans" : undefined };
    }
    case "set-activity-frame-border-color": {
      if (!matchesAppearanceTarget(block, title, operation) || !supportsActivityFrameAppearance(block.type, "border-color")) return null;
      return { property: "panelBorderColor", previousValue: block.panelBorderColor ?? "", previousUnset: block.panelBorderColor == null, value: operation.color, blockTitle: `${title} · Couleur du trait` };
    }
    case "set-activity-frame-accent-color": {
      if (!matchesAppearanceTarget(block, title, operation) || !supportsActivityFrameAppearance(block.type, "accent-color")) return null;
      const storage = activityAccentStorageProperty(block.type);
      const previousValue = storage === "buttonTextColor" ? block.buttonTextColor ?? "" : storage === "buttonBackgroundColor" ? block.buttonBackgroundColor ?? "" : block.panelBorderColor ?? "";
      return { property: "activityAccentColor", previousValue, previousUnset: previousValue === "", value: operation.color, blockTitle: `${title} · Couleur d’accent` };
    }
    case "set-activity-frame-border-width": {
      if (!matchesAppearanceTarget(block, title, operation) || !supportsActivityFrameAppearance(block.type, "border-width")) return null;
      const label = operation.width === "1px" ? "Fine" : operation.width === "2px" ? "Normale" : operation.width === "4px" ? "Épaisse" : "Très épaisse";
      return { property: "panelBorderWidth", previousValue: block.panelBorderWidth ?? "", previousUnset: block.panelBorderWidth == null, value: operation.width, blockTitle: `${title} · Épaisseur du trait`, displayValue: label };
    }
    case "set-activity-frame-border-style": {
      if (!matchesAppearanceTarget(block, title, operation) || !supportsActivityFrameAppearance(block.type, "border-style")) return null;
      const label = operation.style === "none" ? "Aucun" : operation.style === "solid" ? "Plein" : operation.style === "dashed" ? "Tirets" : "Pointillés";
      return { property: "panelBorderStyle", previousValue: block.panelBorderStyle ?? "", previousUnset: block.panelBorderStyle == null, value: operation.style, blockTitle: `${title} · Type de trait`, displayValue: label };
    }
    case "set-activity-frame-rounded": {
      if (!matchesAppearanceTarget(block, title, operation) || !supportsActivityFrameAppearance(block.type, "rounded")) return null;
      const storage = frameAppearanceStorage(block, "rounded");
      const previousValue = storage.value === "true";
      return { property: storage.property, previousValue: storage.value, previousUnset: storage.unset, value: String(operation.enabled), blockTitle: `${title} · ${storage.label}`, previousDisplayValue: booleanLabel(previousValue, true), displayValue: booleanLabel(operation.enabled, true) };
    }
    case "set-activity-frame-shadow": {
      if (!matchesAppearanceTarget(block, title, operation) || !supportsActivityFrameAppearance(block.type, "shadow")) return null;
      const storage = frameAppearanceStorage(block, "shadow");
      const previousValue = storage.value === "true";
      return { property: storage.property, previousValue: storage.value, previousUnset: storage.unset, value: String(operation.enabled), blockTitle: `${title} · ${storage.label}`, previousDisplayValue: booleanLabel(previousValue), displayValue: booleanLabel(operation.enabled) };
    }
    case "set-divider-color": {
      if (!matchesAppearanceTarget(block, title, operation) || !["divider", "section-marker"].includes(block.type)) return null;
      return { property: "dividerColor", previousValue: block.dividerColor ?? "#123a7a", previousUnset: block.dividerColor == null, value: operation.color, blockTitle: `${title} · Couleur du trait` };
    }
    case "set-divider-width": {
      if (!matchesAppearanceTarget(block, title, operation) || !["divider", "section-marker"].includes(block.type)) return null;
      const label = operation.width === "1px" ? "Fine" : operation.width === "2px" ? "Normale" : operation.width === "4px" ? "Épaisse" : "Très épaisse";
      return { property: "dividerWidth", previousValue: block.dividerWidth ?? "2px", previousUnset: block.dividerWidth == null, value: operation.width, blockTitle: `${title} · Épaisseur du trait`, displayValue: label };
    }
    case "set-divider-style": {
      if (!matchesAppearanceTarget(block, title, operation) || !["divider", "section-marker"].includes(block.type)) return null;
      const label = operation.style === "none" ? "Aucun" : operation.style === "solid" ? "Plein" : operation.style === "dashed" ? "Tirets" : "Pointillés";
      return { property: "dividerStyle", previousValue: block.dividerStyle ?? "solid", previousUnset: block.dividerStyle == null, value: operation.style, blockTitle: `${title} · Type de trait`, displayValue: label };
    }
    case "set-section-marker-scheme": {
      if (!matchesAppearanceTarget(block, title, operation) || block.type !== "section-marker") return null;
      const label = operation.scheme === "arabic" ? "Chiffres arabes" : operation.scheme === "roman" ? "Chiffres romains" : "Lettres";
      return { property: "markerScheme", previousValue: block.markerScheme ?? "arabic", previousUnset: block.markerScheme == null, value: operation.scheme, blockTitle: `${title} · Numérotation`, displayValue: label };
    }
    case "set-section-marker-type": {
      if (!matchesAppearanceTarget(block, title, operation) || block.type !== "section-marker") return null;
      const label = operation.markerType === "none" ? "Sans repère" : operation.markerType === "outline" ? "Cercle" : "Rond plein";
      return { property: "markerType", previousValue: block.markerType ?? "outline", previousUnset: block.markerType == null, value: operation.markerType, blockTitle: `${title} · Type de repère`, displayValue: label };
    }
    case "set-section-marker-text-color": {
      if (!matchesAppearanceTarget(block, title, operation) || block.type !== "section-marker") return null;
      return { property: "markerTextColor", previousValue: block.markerTextColor ?? block.dividerColor ?? "#123a7a", previousUnset: block.markerTextColor == null, value: operation.color, blockTitle: `${title} · Couleur du repère` };
    }
    case "set-header-background-color": {
      if (block.type !== "header") return null;
      return { property: "headerBackgroundColor", previousValue: block.headerBackgroundColor ?? "#d7eef0", previousUnset: block.headerBackgroundColor == null, value: operation.color === "transparent" ? "" : operation.color, unset: operation.color === "transparent", blockTitle: `${title} · Couleur de fond`, displayValue: operation.color === "transparent" ? "Sans" : undefined };
    }
    case "set-header-text-color": {
      if (block.type !== "header") return null;
      return { property: "headerTextColor", previousValue: block.headerTextColor ?? "#102752", previousUnset: block.headerTextColor == null, value: operation.color, blockTitle: `${title} · Couleur du texte` };
    }
    case "set-header-background-blur": {
      if (block.type !== "header") return null;
      const values: Record<BackgroundIntensity, number> = { none: 0, light: 4, medium: 8, strong: 12 };
      return { property: "sectionBackgroundBlur", previousValue: String(block.sectionBackgroundBlur ?? 0), previousUnset: block.sectionBackgroundBlur == null, value: String(values[operation.intensity]), blockTitle: `${title} · Flou`, displayValue: intensityLabel(operation.intensity) };
    }
    case "set-header-background-overlay": {
      if (block.type !== "header") return null;
      const overlays: Record<BackgroundIntensity, number> = { none: 0, light: 0.25, medium: 0.5, strong: 0.75 };
      return { property: "sectionBackgroundOpacity", previousValue: String(block.sectionBackgroundOpacity ?? 1), previousUnset: block.sectionBackgroundOpacity == null, value: String(1 - overlays[operation.intensity]), blockTitle: `${title} · Voile`, displayValue: intensityLabel(operation.intensity) };
    }
    case "set-header-background-overlay-dark": {
      if (block.type !== "header") return null;
      const previous = block.sectionBackgroundOverlayDark ?? true;
      return { property: "sectionBackgroundOverlayDark", previousValue: String(previous), previousUnset: block.sectionBackgroundOverlayDark == null, value: String(operation.enabled), blockTitle: `${title} · Couleur du voile`, previousDisplayValue: previous ? "Sombre" : "Clair", displayValue: operation.enabled ? "Sombre" : "Clair" };
    }
    case "set-header-content-align": {
      if (block.type !== "header") return null;
      const labels = { left: "À gauche", center: "Au centre", right: "À droite" } as const;
      return { property: "contentAlign", previousValue: block.contentAlign ?? "left", previousUnset: block.contentAlign == null, value: operation.align, blockTitle: `${title} · Position du bloc texte`, displayValue: labels[operation.align] };
    }
    case "set-header-text-outline": {
      if (block.type !== "header") return null;
      return { property: "headerTextOutline", previousValue: block.headerTextOutline ?? "none", previousUnset: block.headerTextOutline == null, value: operation.outline, blockTitle: `${title} · Renforcement du contraste` };
    }
    case "set-header-text-outline-color": {
      if (block.type !== "header") return null;
      return { property: "headerTextOutlineColor", previousValue: block.headerTextOutlineColor ?? "light", previousUnset: block.headerTextOutlineColor == null, value: operation.outlineColor, blockTitle: `${title} · Couleur du contour`, displayValue: operation.outlineColor === "light" ? "Clair" : "Sombre" };
    }
    case "set-continue-button-background": {
      if (block.type !== "continue") return null;
      return { property: "continueButtonBackgroundColor", previousValue: block.buttonBackgroundColor ?? "#123a7a", previousUnset: block.buttonBackgroundColor == null, value: operation.color, blockTitle: `${title || "Continuer"} · Couleur du bouton` };
    }
    case "set-continue-button-text-color": {
      if (block.type !== "continue") return null;
      return { property: "continueButtonTextColor", previousValue: block.buttonTextColor ?? "#ffffff", previousUnset: block.buttonTextColor == null, value: operation.color, blockTitle: `${title || "Continuer"} · Couleur du texte` };
    }
    case "set-continue-button-label": {
      if (block.type !== "continue") return null;
      return { property: "continueButtonLabel", previousValue: block.summary || "Continuer", value: operation.label, blockTitle: `${title || "Continuer"} · Libellé` };
    }
    case "reset-activity-background": return null;
    case "reset-activity-frame-appearance": return null;
    case "reset-divider-appearance": return null;
    case "reset-section-marker-appearance": return null;
    case "reset-header-appearance": return null;
    case "reset-continue-button": return null;
    default: return null;
  }
}

export function designerChapterCandidates(project: PaideiaProject, chapterReference?: string) {
  const chapters = project.course.modules.flatMap((module) => module.chapters);
  if (!chapterReference) return { title: null, ordinal: null };
  const normalizedReference = normalizeCommand(chapterReference);
  const title = chapters.find((chapter) => normalizeCommand(designerDisplayText(chapter.title)) === normalizedReference) ?? null;
  const ordinalValue = /^\d+$/.test(normalizedReference) ? Number(normalizedReference) : NaN;
  const ordinal = Number.isSafeInteger(ordinalValue) && ordinalValue > 0
    ? chapters[ordinalValue - 1] ?? null
    : null;
  return { title, ordinal };
}

export type DesignerChapterSelection =
  | { status: "resolved"; chapters: ReturnType<typeof flattenDesignerChapters> }
  | { status: "ambiguous"; reference: string }
  | { status: "missing"; reference: string };

function flattenDesignerChapters(project: PaideiaProject) {
  return project.course.modules.flatMap((module) => module.chapters);
}

export function splitDesignerChapterReferences(chapterReference: string) {
  return chapterReference
    .split(/\s*,\s*|\s+et\s+/)
    .map((reference) => reference.trim())
    .filter(Boolean);
}

export function resolveDesignerChapters(
  project: PaideiaProject,
  chapterReference?: string,
  activeChapterId?: string | null,
  chapterResolution?: "title" | "ordinal"
): DesignerChapterSelection {
  const chapters = flattenDesignerChapters(project);
  if (!chapterReference) {
    const active = chapters.find((chapter) => chapter.id === activeChapterId);
    return active ? { status: "resolved", chapters: [active] } : { status: "missing", reference: "chapitre courant" };
  }
  const normalizedReference = normalizeCommand(chapterReference);
  if (!normalizedReference) return { status: "missing", reference: chapterReference };
  const parses: Array<typeof chapters> = [];
  const consumeSeparator = (value: string) => value.replace(/^(?:\s*,\s*|\s+et\s+)/, "").trim();
  const hasBoundary = (value: string, token: string) => value === token
    || value.startsWith(`${token},`)
    || value.startsWith(`${token} et `);
  const visit = (remaining: string, selected: typeof chapters) => {
    if (!remaining) {
      parses.push(selected);
      return;
    }
    const candidates: typeof chapters = [];
    if (chapterResolution !== "ordinal") {
      for (const chapter of chapters) {
        const title = normalizeCommand(designerDisplayText(chapter.title));
        if (title && hasBoundary(remaining, title)) candidates.push(chapter);
      }
    }
    if (chapterResolution !== "title") {
      const ordinalMatch = remaining.match(/^(\d+)(?=$|,|\s+et\s+)/);
      const ordinal = ordinalMatch ? chapters[Number(ordinalMatch[1]) - 1] : null;
      if (ordinal) candidates.push(ordinal);
    }
    for (const candidate of candidates) {
      if (selected.some((chapter) => chapter.id === candidate.id)) continue;
      const title = normalizeCommand(designerDisplayText(candidate.title));
      const ordinal = String(chapters.indexOf(candidate) + 1);
      const token = chapterResolution === "ordinal"
        ? ordinal
        : chapterResolution === "title"
          ? title
          : hasBoundary(remaining, title) ? title : ordinal;
      visit(consumeSeparator(remaining.slice(token.length)), [...selected, candidate]);
    }
  };
  visit(normalizedReference, []);
  const uniqueParses = [...new Map(parses.map((selection) => [selection.map((chapter) => chapter.id).join("|"), selection])).values()];
  if (!uniqueParses.length) return { status: "missing", reference: chapterReference };
  if (uniqueParses.length > 1) return { status: "ambiguous", reference: chapterReference };
  return { status: "resolved", chapters: uniqueParses[0] };
}

export function disambiguateDesignerChapter(project: PaideiaProject, result: DesignerConversationResult): DesignerConversationResult {
  if (result.status !== "ready" && result.status !== "incomplete") return result;
  const source = result.status === "ready" ? result.intent : result.draft;
  if (source.scope !== "chapter" || !source.chapterReference || source.chapterResolution) return result;
  const candidates = designerChapterCandidates(project, source.chapterReference);
  if (!candidates.title || !candidates.ordinal || candidates.title.id === candidates.ordinal.id) return result;
  if (result.status === "incomplete") {
    if (result.draft.pendingSlots.includes("chapter-reference-choice")) return result;
    return incomplete({
      ...result.draft,
      pendingSlots: ["chapter-reference-choice", ...result.draft.pendingSlots]
    });
  }
  const context = result.intent.operations.some((operation) => operation.kind.startsWith("set-video-caption"))
    ? "video-captions"
    : result.intent.operations.some((operation) => operation.kind.startsWith("set-video"))
      ? "video"
      : "lesson-text";
  return incomplete({
    context,
    scope: result.intent.scope,
    chapterReference: result.intent.chapterReference,
    operations: result.intent.operations,
    pendingSlots: ["chapter-reference-choice"]
  });
}

export function resolveDesignerChapter(
  project: PaideiaProject,
  chapterReference?: string,
  activeChapterId?: string | null,
  chapterResolution?: "title" | "ordinal"
) {
  const selection = resolveDesignerChapters(project, chapterReference, activeChapterId, chapterResolution);
  return selection.status === "resolved" && selection.chapters.length === 1 ? selection.chapters[0] : null;
}

function hasEditableRichHtml(value: unknown, key = ""): boolean {
  if (typeof value === "string") return /Html$/.test(key) && !excludedRichHtmlKeys.has(key) && Boolean(value.trim());
  if (Array.isArray(value)) return value.some((item) => hasEditableRichHtml(item));
  return Boolean(value && typeof value === "object" && Object.entries(value as Record<string, unknown>)
    .some(([childKey, childValue]) => hasEditableRichHtml(childValue, childKey)));
}

function operationSupportsMassTarget(operation: DesignerActionOperation, block: PaideiaBlock) {
  if (operation.kind === "set-activity-font-family") return hasEditableRichHtml(block);
  if (operation.kind === "set-text-activity-font-size" || operation.kind === "reset-text-activity-font-size") return hasEditableRichHtml(block);
  if (operation.kind === "set-activity-spacing" || operation.kind === "reset-activity-spacing") return true;
  if (isFrameOperation(operation)) {
    if (operation.kind === "reset-activity-frame-appearance") {
      return (["background-color", "border-color", "accent-color", "border-width", "border-style", "rounded", "shadow"] as ActivityFrameAppearanceProperty[])
        .some((property) => supportsActivityFrameAppearance(block.type, property));
    }
    const property = framePropertyForOperation(operation);
    return Boolean(property && supportsActivityFrameAppearance(block.type, property));
  }
  if (!isBackgroundOperation(operation) || !supportsActivityBackground(block.type)) return false;
  if (operation.kind === "reset-activity-background") return true;
  if (operation.kind === "reset-activity-background-property") {
    const property = operation.property === "overlay-color" ? "overlay" : operation.property;
    return supportsActivityBackgroundProperty(block.type, property);
  }
  const property = backgroundPropertyByOperation[operation.kind];
  return !property || supportsActivityBackgroundProperty(block.type, property);
}

export function designerMassTargetSuggestions(
  project: PaideiaProject,
  draft: DesignerConversationDraft,
  activeChapterId?: string | null
) {
  if(draft.candidateCommands?.length)return draft.candidateCommands;
  const targetSlots: DesignerSlotId[] = ["activity-background-target", "activity-frame-target", "activity-font-target", "activity-font-size-target", "activity-spacing-target"];
  if (!draft.pendingSlots.some((slot) => targetSlots.includes(slot))) return undefined;
  const scopedChapter = draft.scope === "chapter"
    ? resolveDesignerChapter(project, draft.chapterReference, activeChapterId, draft.chapterResolution)
    : null;
  const blocks = project.course.modules.flatMap((module) => module.chapters)
    .filter((chapter) => !scopedChapter || chapter.id === scopedChapter.id)
    .flatMap((chapter) => chapter.pages)
    .flatMap((page) => page.blocks);
  const compatibleTypes = new Set(blocks
    .filter((block) => draft.operations.every((operation) => operationSupportsMassTarget(operation, block)))
    .map((block) => block.type));
  const typeChoices = PAIDEIA_ACTIVITY_CATALOG
    .filter((activity) => compatibleTypes.has(activity.blockType))
    .map((activity) => `Toutes les activités ${activity.name}`);
  return ["Oui — toutes les activités compatibles", ...typeChoices, "Aucune"];
}

function designerTargetIsUnchanged(target: Pick<DesignerActionTarget, "previousValue" | "previousUnset" | "value" | "unset">) {
  if (target.unset) return target.previousUnset === true;
  return target.previousUnset !== true && target.previousValue.toUpperCase() === target.value.toUpperCase();
}

export function previewDesignerAction(project: PaideiaProject, intent: DesignerActionIntent, context?: { activeChapterId?: string | null }): DesignerActionPreview {
  if (intent.operations.length > 1) {
    const final = new Map<string, DesignerActionTarget>();
    for (const operation of intent.operations) {
      const step = previewDesignerAction(project, { ...intent, operations: [operation] }, context);
      for (const target of [...step.targets, ...step.unchanged]) final.set(`${target.pageId}:${target.blockId}:${target.property}`, target);
    }
    return { intent, targets: [...final.values()].filter(target => !designerTargetIsUnchanged(target)), unchanged: [...final.values()].filter(designerTargetIsUnchanged) };
  }
  for (const operation of intent.operations) {
    if (!DESIGNER_OPERATION_CAPABILITIES.has(operation.kind)) throw new Error(`Unregistered designer operation: ${operation.kind}`);
  }
  const targets: DesignerActionTarget[] = [];
  const unchanged: DesignerActionTarget[] = [];
  const resolvedScope = intent.scope === "chapter" && !intent.resolvedChapterIds
    ? resolveDesignerChapters(project, intent.chapterReference, context?.activeChapterId, intent.chapterResolution)
    : null;
  const scopedChapterIds = intent.scope === "chapter"
    ? new Set(intent.resolvedChapterIds ?? (resolvedScope?.status === "resolved" ? resolvedScope.chapters.map((chapter) => chapter.id) : []))
    : null;
  const navigationStyleCopy = intent.operations.length === 1 && [
    "copy-continue-button-style-to-course-exit",
    "copy-course-exit-button-style-to-continue"
  ].includes(intent.operations[0].kind) ? intent.operations[0] : null;
  if (navigationStyleCopy) {
    const scopedBlocks = project.course.modules.flatMap((module) => module.chapters)
      .filter((chapter) => !scopedChapterIds || scopedChapterIds.has(chapter.id))
      .flatMap((chapter) => chapter.pages.flatMap((page) => page.blocks.map((block) => ({ chapter, page, block }))));
    const exitToContinue = navigationStyleCopy.kind === "copy-course-exit-button-style-to-continue";
    const sourceType = exitToContinue ? "course-exit" : "continue";
    const destinationType = exitToContinue ? "continue" : "course-exit";
    const sources = scopedBlocks.filter(({ block }) => block.type === sourceType);
    if (!sources.length) return { intent, targets: [], unchanged: [], blockedReason: exitToContinue ? "course-exit-missing" : "continue-style-missing" };
    const styles = new Map(sources.map(({ block }) => {
      const background = (block.buttonBackgroundColor ?? "#123a7a").toUpperCase();
      const text = (block.buttonTextColor ?? "#ffffff").toUpperCase();
      return [`${background}|${text}`, { background, text }];
    }));
    if (styles.size !== 1) return { intent, targets: [], unchanged: [], blockedReason: exitToContinue ? "course-exit-styles-differ" : "continue-styles-differ" };
    const style = [...styles.values()][0];
    const destinations = scopedBlocks.filter(({ block }) => block.type === destinationType);
    if (!destinations.length) return { intent, targets: [], unchanged: [], blockedReason: exitToContinue ? "continue-style-missing" : "course-exit-missing" };
    const copied: DesignerActionTarget[] = [];
    for (const { chapter, page, block } of destinations) {
      const title = designerDisplayText(block.title || block.summary || (exitToContinue ? "Continuer" : "Sortir de la leçon"));
      copied.push(
        { pageId: page.id, blockId: block.id, chapterTitle: designerDisplayText(chapter.title), pageTitle: designerDisplayText(page.title), property: "continueButtonBackgroundColor", previousValue: block.buttonBackgroundColor ?? "#123a7a", previousUnset: block.buttonBackgroundColor == null, value: style.background, blockTitle: `${title} · Couleur du bouton` },
        { pageId: page.id, blockId: block.id, chapterTitle: designerDisplayText(chapter.title), pageTitle: designerDisplayText(page.title), property: "continueButtonTextColor", previousValue: block.buttonTextColor ?? "#ffffff", previousUnset: block.buttonTextColor == null, value: style.text, blockTitle: `${title} · Couleur du texte` }
      );
    }
    return { intent, targets: copied.filter((target) => !designerTargetIsUnchanged(target)), unchanged: copied.filter(designerTargetIsUnchanged) };
  }
  const activitySpacingPx = Math.max(15, Math.min(60, Math.round(project.activitySpacingPx ?? 30)));
  for (const operation of intent.operations) {
    if (operation.kind === "set-lesson-text-color" || operation.kind === "reset-lesson-text-color") {
      const previousValue = project.courseAppearance?.textColorMode === "custom" ? project.courseAppearance.textColor : "#222222";
      const value = operation.kind === "set-lesson-text-color" ? operation.color : "#222222";
      const target: DesignerActionTarget = { pageId: "__lesson__", blockId: "__lesson-appearance__", property: "courseTextColor", value, unset: operation.kind === "reset-lesson-text-color", chapterTitle: "Leçon", pageTitle: "", blockTitle: "Couleur de la police de la leçon", previousValue, previousUnset: project.courseAppearance?.textColorMode !== "custom", displayValue: operation.kind === "reset-lesson-text-color" ? "Par défaut" : undefined };
      (designerTargetIsUnchanged(target) ? unchanged : targets).push(target);
      continue;
    }
    for (const module of project.course.modules) for (const chapter of module.chapters) {
      if (intent.scope === "chapter" && !scopedChapterIds?.has(chapter.id)) continue;
      for (const page of chapter.pages) for (const block of page.blocks) {
        if (operation.kind.startsWith("set-video") && block.type !== "media") continue;
        if (operation.kind === "reset-continue-button") {
          if (block.type !== "continue") continue;
          const title = designerDisplayText(block.title || block.summary || "Continuer");
          const resetValues: DesignerResolvedTarget[] = [];
          if (operation.property === "background" || operation.property === "all") resetValues.push({ property: "continueButtonBackgroundColor", previousValue: block.buttonBackgroundColor ?? "#123a7a", previousUnset: block.buttonBackgroundColor == null, value: "#123a7a", unset: true, blockTitle: `${title} · Couleur du bouton` });
          if (operation.property === "text-color" || operation.property === "all") resetValues.push({ property: "continueButtonTextColor", previousValue: block.buttonTextColor ?? "#ffffff", previousUnset: block.buttonTextColor == null, value: "#ffffff", unset: true, blockTitle: `${title} · Couleur du texte` });
          if (operation.property === "label" || operation.property === "all") resetValues.push({ property: "continueButtonLabel", previousValue: block.summary || "Continuer", value: "Continuer", blockTitle: `${title} · Libellé` });
          for (const resolved of resetValues) {
            const target: DesignerActionTarget = { pageId: page.id, blockId: block.id, chapterTitle: designerDisplayText(chapter.title), pageTitle: designerDisplayText(page.title), ...resolved };
            (designerTargetIsUnchanged(target) ? unchanged : targets).push(target);
          }
          continue;
        }
        if (operation.kind === "reset-activity-frame-appearance") {
          const title = designerDisplayText(block.title || block.mediaFileName || "Activité");
          if (!matchesAppearanceTarget(block, title, operation)) continue;
          const resetValues: DesignerResolvedTarget[] = [];
          if (supportsActivityFrameAppearance(block.type, "background-color")) {
            const storage = frameAppearanceStorage(block, "background-color");
            const nested = storage.property === "matchingLabelBackgroundColor";
            resetValues.push({ property: storage.property, previousValue: storage.value, previousUnset: storage.unset, value: nested ? "#FFFFFF" : storage.property === "slidesActivityBackgroundColor" ? "#ffffff" : "", unset: !nested, blockTitle: `${title} · ${storage.label}` });
          }
          if (supportsActivityFrameAppearance(block.type, "border-color")) resetValues.push({ property: "panelBorderColor", previousValue: block.panelBorderColor ?? "", previousUnset: block.panelBorderColor == null, value: "", unset: true, blockTitle: `${title} · Couleur du trait` });
          if (supportsActivityFrameAppearance(block.type, "border-width")) resetValues.push({ property: "panelBorderWidth", previousValue: block.panelBorderWidth ?? "", previousUnset: block.panelBorderWidth == null, value: "", unset: true, blockTitle: `${title} · Épaisseur du trait` });
          if (supportsActivityFrameAppearance(block.type, "border-style")) resetValues.push({ property: "panelBorderStyle", previousValue: block.panelBorderStyle ?? "", previousUnset: block.panelBorderStyle == null, value: "", unset: true, blockTitle: `${title} · Type de trait` });
          if (supportsActivityFrameAppearance(block.type, "rounded")) {
            const storage = frameAppearanceStorage(block, "rounded");
            const nested = ["matchingLabelRounded", "findElementsImageRounded", "cardSortCardRounded"].includes(storage.property);
            resetValues.push({ property: storage.property, previousValue: storage.value, previousUnset: storage.unset, value: "true", unset: !nested, blockTitle: `${title} · ${storage.label}` });
          }
          if (supportsActivityFrameAppearance(block.type, "shadow")) {
            const storage = frameAppearanceStorage(block, "shadow");
            const nested = storage.property === "findElementsImageShadow";
            resetValues.push({ property: storage.property, previousValue: storage.value, previousUnset: storage.unset, value: storage.property === "slidesActivityShadow" ? "true" : "false", unset: !nested, blockTitle: `${title} · ${storage.label}` });
          }
          if (supportsActivityFrameAppearance(block.type, "accent-color")) {
            const storage = activityAccentStorageProperty(block.type);
            const previousValue = storage === "buttonTextColor" ? block.buttonTextColor ?? "" : storage === "buttonBackgroundColor" ? block.buttonBackgroundColor ?? "" : block.panelBorderColor ?? "";
            resetValues.push({ property: "activityAccentColor", previousValue, previousUnset: previousValue === "", value: "", unset: true, blockTitle: `${title} · Couleur d’accent` });
          }
          for (const resolved of resetValues) {
            const target: DesignerActionTarget = { pageId: page.id, blockId: block.id, chapterTitle: designerDisplayText(chapter.title), pageTitle: designerDisplayText(page.title), ...resolved };
            (designerTargetIsUnchanged(target) ? unchanged : targets).push(target);
          }
          continue;
        }
        if (operation.kind === "reset-divider-appearance" || operation.kind === "reset-section-marker-appearance") {
          const title = designerDisplayText(block.title || "Séparateur");
          const expectedType = operation.kind === "reset-section-marker-appearance" ? "section-marker" : "divider";
          if (block.type !== expectedType || !matchesAppearanceTarget(block, title, operation)) continue;
          const resetValues: DesignerResolvedTarget[] = [
            { property: "dividerColor", previousValue: block.dividerColor ?? "#123a7a", previousUnset: block.dividerColor == null, value: "#123a7a", unset: true, blockTitle: `${title} · Couleur du trait` },
            { property: "dividerWidth", previousValue: block.dividerWidth ?? "2px", previousUnset: block.dividerWidth == null, value: "2px", unset: true, blockTitle: `${title} · Épaisseur du trait`, displayValue: "Normale (par défaut)" },
            { property: "dividerStyle", previousValue: block.dividerStyle ?? "solid", previousUnset: block.dividerStyle == null, value: "solid", unset: true, blockTitle: `${title} · Type de trait`, displayValue: "Plein (par défaut)" }
          ];
          if (block.type === "section-marker") resetValues.push(
            { property: "markerScheme", previousValue: block.markerScheme ?? "arabic", previousUnset: block.markerScheme == null, value: "arabic", unset: true, blockTitle: `${title} · Numérotation`, displayValue: "Chiffres arabes (par défaut)" },
            { property: "markerType", previousValue: block.markerType ?? "outline", previousUnset: block.markerType == null, value: "outline", unset: true, blockTitle: `${title} · Type de repère`, displayValue: "Cercle (par défaut)" },
            { property: "markerTextColor", previousValue: block.markerTextColor ?? block.dividerColor ?? "#123a7a", previousUnset: block.markerTextColor == null, value: "#123a7a", unset: true, blockTitle: `${title} · Couleur du repère` }
          );
          for (const resolved of resetValues) {
            const target: DesignerActionTarget = { pageId: page.id, blockId: block.id, chapterTitle: designerDisplayText(chapter.title), pageTitle: designerDisplayText(page.title), ...resolved };
            (designerTargetIsUnchanged(target) ? unchanged : targets).push(target);
          }
          continue;
        }
        if (operation.kind === "reset-header-appearance") {
          if (block.type !== "header") continue;
          const title = designerDisplayText(block.title || "En-tête");
          const resetValues: DesignerResolvedTarget[] = [
            { property: "headerBackgroundColor", previousValue: block.headerBackgroundColor ?? "#d7eef0", previousUnset: block.headerBackgroundColor == null, value: "#d7eef0", unset: true, blockTitle: `${title} · Couleur de fond` },
            { property: "headerTextColor", previousValue: block.headerTextColor ?? "#102752", previousUnset: block.headerTextColor == null, value: "#102752", unset: true, blockTitle: `${title} · Couleur du texte` },
            { property: "sectionBackgroundBlur", previousValue: String(block.sectionBackgroundBlur ?? 0), previousUnset: block.sectionBackgroundBlur == null, value: "0", unset: true, blockTitle: `${title} · Flou`, displayValue: "Aucun (par défaut)" },
            { property: "sectionBackgroundOpacity", previousValue: String(block.sectionBackgroundOpacity ?? 1), previousUnset: block.sectionBackgroundOpacity == null, value: "1", unset: true, blockTitle: `${title} · Voile`, displayValue: "Aucun (par défaut)" },
            { property: "sectionBackgroundOverlayDark", previousValue: String(block.sectionBackgroundOverlayDark ?? true), previousUnset: block.sectionBackgroundOverlayDark == null, value: "true", unset: true, blockTitle: `${title} · Couleur du voile`, displayValue: "Sombre (par défaut)" },
            { property: "contentAlign", previousValue: block.contentAlign ?? "left", previousUnset: block.contentAlign == null, value: "left", unset: true, blockTitle: `${title} · Position du bloc texte`, displayValue: "À gauche (par défaut)" },
            { property: "headerTextOutline", previousValue: block.headerTextOutline ?? "none", previousUnset: block.headerTextOutline == null, value: "none", unset: true, blockTitle: `${title} · Renforcement du contraste`, displayValue: "Aucun (par défaut)" },
            { property: "headerTextOutlineColor", previousValue: block.headerTextOutlineColor ?? "light", previousUnset: block.headerTextOutlineColor == null, value: "light", unset: true, blockTitle: `${title} · Couleur du contour`, displayValue: "Clair (par défaut)" }
          ];
          for (const resolved of resetValues) {
            const target: DesignerActionTarget = { pageId: page.id, blockId: block.id, chapterTitle: designerDisplayText(chapter.title), pageTitle: designerDisplayText(page.title), ...resolved };
            (designerTargetIsUnchanged(target) ? unchanged : targets).push(target);
          }
          continue;
        }
        if (operation.kind === "reset-activity-background") {
          const title = designerDisplayText(block.title || block.mediaFileName || "Activité");
          if (!supportsActivityBackground(block.type)) continue;
          if (!matchesBackgroundTarget(block, title, operation)) continue;
          const defaultWide = activityBackgroundWideDefault(block.type);
          const resetValues: DesignerResolvedTarget[] = [
            { property: "sectionBackgroundColor", previousValue: block.sectionBackgroundColor ?? "", previousUnset: block.sectionBackgroundColor == null, value: "", unset: true, blockTitle: `${title} · Couleur de fond` },
            { property: "sectionBackgroundImageRef", previousValue: block.sectionBackgroundImageRef ?? "", previousUnset: block.sectionBackgroundImageRef == null, value: "", unset: true, blockTitle: `${title} · Image de fond` },
            { property: "sectionBackgroundOpacity", previousValue: String(block.sectionBackgroundOpacity ?? 1), previousUnset: block.sectionBackgroundOpacity == null, value: "1", unset: true, blockTitle: `${title} · Voile de fond` },
            { property: "sectionBackgroundOverlayDark", previousValue: String(block.sectionBackgroundOverlayDark ?? true), previousUnset: block.sectionBackgroundOverlayDark == null, value: "true", unset: true, blockTitle: `${title} · Couleur du voile` },
            { property: "sectionBackgroundBlur", previousValue: String(block.sectionBackgroundBlur ?? 0), previousUnset: block.sectionBackgroundBlur == null, value: "0", unset: true, blockTitle: `${title} · Flou de fond` },
            { property: block.type === "situational-dialogue" ? "panelRounded" : "sectionBackgroundRounded", previousValue: String(block.type === "situational-dialogue" ? block.panelRounded ?? true : block.sectionBackgroundRounded ?? true), previousUnset: block.type === "situational-dialogue" ? block.panelRounded == null : block.sectionBackgroundRounded == null, value: "true", unset: true, blockTitle: `${title} · Coins arrondis` },
            { property: "sectionBackgroundWide", previousValue: String(block.sectionBackgroundWide ?? defaultWide), previousUnset: block.sectionBackgroundWide == null, value: String(defaultWide), unset: true, blockTitle: `${title} · Fond large` },
            ...(supportsActivityBackgroundProperty(block.type, "height") ? [{ property: "sectionBackgroundHeight" as const, previousValue: block.sectionBackgroundHeight ?? "medium", previousUnset: block.sectionBackgroundHeight == null, value: "medium", unset: true, blockTitle: `${title} · Hauteur` }] : [])
          ];
          for (const resolved of resetValues) {
            const target: DesignerActionTarget = { pageId: page.id, blockId: block.id, chapterTitle: designerDisplayText(chapter.title), pageTitle: designerDisplayText(page.title), ...resolved };
            (designerTargetIsUnchanged(target) ? unchanged : targets).push(target);
          }
          continue;
        }
        const resolved = operationTarget(operation, block, activitySpacingPx);
        if (!resolved) continue;
        const target: DesignerActionTarget = { pageId: page.id, blockId: block.id, chapterTitle: designerDisplayText(chapter.title), pageTitle: designerDisplayText(page.title), ...resolved };
        (designerTargetIsUnchanged(target) ? unchanged : targets).push(target);
      }
    }
  }
  return {
    intent,
    targets,
    unchanged,
    ...(intent.operations.some((operation) => operation.kind === "set-text-activity-font-size")
      ? { warning: "Cette normalisation remplace les tailles du texte courant. Les titres, sous-titres, couleurs et autres mises en forme sont conservés." }
      : {})
  };
}

export function unsupportedDesignerAppearanceOperations(
  project: PaideiaProject,
  intent: DesignerActionIntent,
  context?: { activeChapterId?: string | null }
) {
  return intent.operations.filter((operation) => {
    if (!isFrameOperation(operation) && !operation.kind.startsWith("set-activity-background-") && operation.kind !== "remove-activity-background-image" && operation.kind !== "reset-activity-background-property" && operation.kind !== "reset-activity-background") return false;
    const preview = previewDesignerAction(project, { ...intent, operations: [operation] }, context);
    return preview.targets.length === 0 && preview.unchanged.length === 0;
  });
}

export function inverseDesignerChanges(preview: DesignerActionPreview): DesignerBlockChange[] {
  return preview.targets.map(({ pageId, blockId, property, previousValue, previousUnset }) => ({ pageId, blockId, property, value: previousValue, unset: previousUnset }));
}
