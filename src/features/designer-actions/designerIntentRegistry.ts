import { expandUnderstandingSynonyms, nearbyUnderstandingCandidates, understandingCandidates } from './designerUnderstanding';
import { normalizeDesignerText } from './designerLanguage';
import type {
  BackgroundAppearanceProperty, DesignerActionOperation, DesignerActionScope,
  DesignerConversationDraft, DesignerConversationResult
} from "./designerActionModel";
import { DESIGNER_SLOT_REGISTRY, type DesignerSlotId } from "./designerSlotRegistry";
import {
  appearanceClause, extractActivitySpacing, extractAppearanceBoolean, extractBackgroundActivityTarget,
  extractActivityFrameBorderStyle, extractActivityFrameBorderWidth, extractBackgroundIntensity, extractBoolean, extractFontSize, extractHeight, extractOutline,
  extractFontActivityTarget, extractFontReference, extractHeaderContentAlign, extractHeaderTextOutline, extractHeaderTextOutlineColor, extractReplacementLabel, extractSectionMarkerScheme, extractSectionMarkerType, extractSingleColor, extractSpacingActivityTarget
} from "./designerValueExtractors";

type DesignerIntentContext = {
  command: string;
  normalized: string;
  scope: DesignerActionScope;
  chapterReference?: string;
};

export type DesignerIntentResolver = {
  id: string;
  capabilityIds: string[];
  resolve: (context: DesignerIntentContext) => DesignerConversationResult | null;
};

function incomplete(draft: DesignerConversationDraft): DesignerConversationResult {
  const question = draft.pendingSlots[0];
  return { status: "incomplete", draft, question, control: DESIGNER_SLOT_REGISTRY[question].control };
}

function ready(context: DesignerIntentContext, operations: DesignerActionOperation[]): DesignerConversationResult {
  return { status: "ready", intent: { kind: "designer-command", scope: context.scope, chapterReference: context.chapterReference, operations } };
}

function chapterReferenceFrom(normalized: string): string | undefined {
  const numbered = normalized.match(/\b(?:(?:dans|sur|pour)\s+(?:les?\s+)?|(?:du|de|des)\s+)chapitres?\s+(\d+(?:(?:\s*,\s*|\s+et\s+)\d+)*)\b/);
  if (numbered?.[1]?.trim()) return numbered[1].trim();
  const plural = normalized.match(/\b(?:(?:dans|sur|pour)\s+(?:les\s+)?|des\s+)chapitres\s+(.+)$/);
  if (plural?.[1]?.trim()) return plural[1].trim();
  const match = normalized.match(/\b(?:(?:dans|sur|pour) (?:le )?|du )chapitre\s+([^,]+)(?:,|$)/);
  const reference = match?.[1]?.trim();
  return !reference || /^(courant|actuel)$/.test(reference) ? undefined : reference;
}

function scopeFrom(normalized: string, fallback: DesignerActionScope): Pick<DesignerIntentContext, "scope" | "chapterReference"> {
  const chapterReference = chapterReferenceFrom(normalized);
  const scope = chapterReference || /\b(ce chapitre|chapitre courant|dans le chapitre|dans ce chapitre|sur ce chapitre|du chapitre|dans les chapitres|sur les chapitres|pour les chapitres|des chapitres)\b/.test(normalized) ? "chapter" : fallback;
  return { scope, chapterReference };
}

const resetResolver: DesignerIntentResolver = {
  id: "reset",
  capabilityIds: ["video-height-reset", "video-caption-reset", "video-fullscreen-reset", "lesson-text-color-reset", "text-activity-font-size-reset", "activity-spacing-reset"],
  resolve: ({ normalized, scope, chapterReference }) => {
    const resetVerb = /\b(reinitialise|reinitialiser|remets|remettre)\b/.test(normalized);
    const restoresDefault = resetVerb || /\b(retablis|retablir|remise? par defaut|valeurs? par defaut)\b/.test(normalized);
    if (!restoresDefault) return null;
    if (/\b(couleur|color)\b/.test(normalized) && /\b(police|texte|text)\b/.test(normalized) && /\b(lecon|lesson)\b/.test(normalized)) {
      return incomplete({ context: "lesson-text", scope, chapterReference, operations: [{ kind: "reset-lesson-text-color" }], pendingSlots: ["reset-confirmation"] });
    }
    if (/\b(taille|dimension)\b.*\b(police|texte|caracteres|fonte)\b|\b(police|texte|caracteres|fonte)\b.*\b(taille|dimension)\b/.test(normalized)
      && /\b(activite|activites|blocs?)\b/.test(normalized)) {
      const target = /\bactivites?\s+(?:de\s+)?textes?\b|\bblocs?\s+textes?\b/.test(normalized)
        ? { target: "type" as const, activityType: "rich-text" }
        : extractBackgroundActivityTarget(normalized) ?? (/\btoutes? les activites\b/.test(normalized) ? { target: "all" as const } : null);
      return incomplete({ context: "text-activity-font-size", scope, chapterReference, operations: [{ kind: "reset-text-activity-font-size", ...(target ?? { target: "all" as const }) }], pendingSlots: target ? ["reset-confirmation"] : ["activity-font-size-target", "reset-confirmation"] });
    }
    if (/\b(padding|espacement|espace|marge|ecart|ecarts)\b/.test(normalized)) {
      const target = extractSpacingActivityTarget(normalized);
      return incomplete({ context: "activity-spacing", scope, chapterReference, operations: [{ kind: "reset-activity-spacing", ...(target ?? { target: "all" }) }], pendingSlots: target ? ["reset-confirmation"] : ["activity-spacing-target", "reset-confirmation"] });
    }
    const mentionsVideoResetSetting = /\b(sous titres?|subtitle|subtitles|captions|legendes|plein ecran|fullscreen)\b/.test(normalized)
      || /\b(hauteur|apparence)\b.*\b(video|videos|media|medias)\b|\b(video|videos|media|medias)\b.*\b(hauteur|apparence)\b/.test(normalized)
      || /\b(tous les reglages|tous les parametres|parametres video|reglages video)\b/.test(normalized);
    if (!mentionsVideoResetSetting) return null;
    const operations: DesignerActionOperation[] = [];
    const captions = /\b(sous titres?|subtitle|subtitles|captions|legendes)\b/.test(normalized);
    const allVideoSettings = /\b(tous les reglages|tous les parametres|parametres video|reglages video)\b/.test(normalized);
    if (allVideoSettings || /\bhauteur\b/.test(normalized)) operations.push({ kind: "reset-activity-background-property", property: "height", target: "type", activityType: "media" });
    if (allVideoSettings || /\b(plein ecran|fullscreen)\b/.test(normalized)) operations.push({ kind: "reset-video-fullscreen" });
    if (captions && (allVideoSettings || !/\b(couleur|fond|arriere plan|contour|outline)\b/.test(normalized) || /\bcouleur\b/.test(normalized))) operations.push({ kind: "reset-video-caption-color" });
    if (captions && (allVideoSettings || !/\b(couleur|fond|arriere plan|contour|outline)\b/.test(normalized) || /\b(fond|arriere plan)\b/.test(normalized))) operations.push({ kind: "reset-video-caption-background" });
    if (captions && (allVideoSettings || !/\b(couleur|fond|arriere plan|contour|outline)\b/.test(normalized) || /\b(contour|outline)\b/.test(normalized))) operations.push({ kind: "reset-video-caption-outline" });
    return operations.length ? incomplete({ context: captions ? "video-captions" : "video", scope, chapterReference, operations, pendingSlots: ["reset-confirmation"] }) : null;
  }
};

const navigationStyleCopyResolver: DesignerIntentResolver = {
  id: "navigation-style-copy",
  capabilityIds: ["copy-continue-style-to-course-exit", "copy-course-exit-style-to-continue"],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    const mentionsContinue = /\bboutons?\s+(?:de\s+)?(?:continuer|continue|suivant)\b/.test(normalized);
    const mentionsExit = /\bboutons?\s+(?:de\s+)?(?:sortir|sortie)(?:\s+de\s+la\s+lecon)?\b/.test(normalized);
    const copiesStyle = /\b(meme|memes|copie|copier|reprends|reprendre|utilise|utiliser|applique|appliquer|harmonise|harmoniser|assortis|assortir|aligne|aligner)\b/.test(normalized)
      && /\b(style|apparence|couleur|couleurs)\b/.test(normalized);
    if (!mentionsContinue || !mentionsExit || !copiesStyle) return null;
    const exitIsSource = /\b(?:style|apparence|couleurs?)\s+(?:du|de ce|des?)\s+boutons?\s+(?:de\s+)?(?:sortir|sortie)\b/.test(normalized)
      || /\bboutons?\s+(?:de\s+)?(?:sortir|sortie).*\b(?:vers|sur|pour|aux?)\s+(?:tous?\s+les\s+)?boutons?\s+(?:de\s+)?(?:continuer|continue|suivant)\b/.test(normalized);
    const continueIsSource = /\b(?:style|apparence|couleurs?)\s+(?:du|de ces|des?)\s+boutons?\s+(?:de\s+)?(?:continuer|continue|suivant)\b/.test(normalized)
      || /\bboutons?\s+(?:de\s+)?(?:continuer|continue|suivant).*\b(?:vers|sur|pour|au)\s+(?:le\s+)?boutons?\s+(?:de\s+)?(?:sortir|sortie)\b/.test(normalized);
    if (exitIsSource === continueIsSource) return { status: "ambiguous" };
    return ready({ command, normalized, scope, chapterReference }, [{
      kind: exitIsSource ? "copy-course-exit-button-style-to-continue" : "copy-continue-button-style-to-course-exit"
    }]);
  }
};

const continueResolver: DesignerIntentResolver = {
  id: "continue-button",
  capabilityIds: ["continue-button-background", "continue-button-text-color", "continue-button-label", "continue-button-reset"],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    if (!/\bboutons?\s+(?:de\s+)?(?:continuer|continue|suivant)\b|\bactivites?\s+continuer\b/.test(normalized)) return null;
    const removeProperty = /\b(supprime|supprimer|retire|retirer|efface|effacer)\b/.test(normalized) && /\b(couleur|fond|texte|police|libelle|apparence)\b/.test(normalized);
    if (/\b(reinitialise|reinitialiser|remets|remettre|retablis|retablir)\b/.test(normalized) || removeProperty || /\bremise? par defaut\b/.test(normalized)) {
      const property = /\b(libelle|texte)\b/.test(normalized) && !/\bcouleur\b/.test(normalized) ? "label"
        : /\b(couleur).*(?:texte|police)|(?:texte|police).*\bcouleur\b/.test(normalized) ? "text-color"
          : /\b(couleur|fond|arriere plan)\b/.test(normalized) ? "background" : "all";
      return incomplete({ context: "continue-button", scope, chapterReference, operations: [{ kind: "reset-continue-button", property }], pendingSlots: ["reset-confirmation"] });
    }
    const operations: DesignerActionOperation[] = [];
    const pendingSlots: DesignerSlotId[] = [];
    const mentionsLabel = /\b(libelle|intitule|renomme|renommer|remplace|remplacer)\b/.test(normalized) || /\btexte\b/.test(normalized) && !/\bcouleur\b/.test(normalized);
    const mentionsTextColor = /\bcouleur\b/.test(normalized) && /\b(texte|police|caracteres|libelle)\b/.test(normalized);
    const hasChainedButtonColors = /\b(?:leur|du|de leur)\s+(?:texte|police)\b/.test(normalized) && /\b(?:boutons?|fond)\b/.test(normalized);
    const explicitColor = hasChainedButtonColors ? null : extractSingleColor(command, "#123A7A");
    if (explicitColor === "ambiguous") return { status: "ambiguous" };
    if (((/\bcouleur\b/.test(normalized) || explicitColor !== null) && !mentionsTextColor) || hasChainedButtonColors) {
      const clause = hasChainedButtonColors ? command.split(/\b(?:leur|du|de leur)\s+(?:texte|police)\b/i)[0] : command;
      const color = extractSingleColor(clause, "#123A7A");
      if (color === "ambiguous") return { status: "ambiguous" };
      color ? operations.push({ kind: "set-continue-button-background", color }) : pendingSlots.push("continue-button-background-color");
    }
    if (mentionsTextColor || hasChainedButtonColors) {
      const clause = hasChainedButtonColors ? command.split(/\b(?:leur|du|de leur)\s+(?:texte|police)\b/i).slice(1).join(" ") : command;
      const color = extractSingleColor(clause, "#FFFFFF");
      if (color === "ambiguous") return { status: "ambiguous" };
      color ? operations.push({ kind: "set-continue-button-text-color", color }) : pendingSlots.push("continue-button-text-color");
    }
    if (mentionsLabel) {
      const label = extractReplacementLabel(command);
      label ? operations.push({ kind: "set-continue-button-label", label }) : pendingSlots.push("continue-button-label");
    }
    if (!operations.length && !pendingSlots.length) return null;
    const draft = { context: "continue-button" as const, scope, chapterReference, operations, pendingSlots };
    return pendingSlots.length ? incomplete(draft) : ready({ command, normalized, scope, chapterReference }, operations);
  }
};

const backgroundResolver: DesignerIntentResolver = {
  id: "activity-background",
  capabilityIds: ["activity-background-image", "activity-background-color", "activity-background-overlay", "activity-background-overlay-dark-enable", "activity-background-overlay-dark-disable", "activity-background-blur", "activity-background-wide-enable", "activity-background-wide-disable", "activity-background-rounded-enable", "activity-background-rounded-disable", "activity-background-height", "video-height-minimum", "activity-background-reset", "activity-background-remove-image"],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    const resetVerb = /\b(reinitialise|reinitialiser|remets|remettre)\b/.test(normalized);
    const resetAll = resetVerb && (/\b(parametres?|reglages?|options?) d apparence\b/.test(normalized)
      || /\bapparence\b.*\b(activite|activites)\b/.test(normalized) && !/\b(hauteur|couleur|voile|opacite|flou|fond large|coins? arrondis?)\b/.test(normalized)
      || /\bfonds?\b.*\bactivites?\b/.test(normalized) && !/\b(image|photo|couleur|voile|opacite|flou|large)\b/.test(normalized));
    if (resetAll) {
      const target = extractBackgroundActivityTarget(normalized);
      return incomplete({ context: "activity-background", scope, chapterReference, operations: [{ kind: "reset-activity-background", ...(target ?? { target: "all" }) }], pendingSlots: target ? ["reset-confirmation"] : ["activity-background-target", "reset-confirmation"] });
    }
    const removesImage = /\b(?:supprime|supprimer|retire|retirer|efface|effacer)\b.*(?:\b(?:image|photo)\s+(?:(?:de|en|comme)\s+)?fond\b|\bfond\s+(?:(?:avec|en utilisant)\s+)?(?:une\s+)?(?:image|photo)\b)/.test(normalized);
    if (removesImage) {
      const target = extractBackgroundActivityTarget(normalized);
      return incomplete({ context: "activity-background", scope, chapterReference, operations: [{ kind: "remove-activity-background-image", ...(target ?? { target: "all" }) }], pendingSlots: target ? ["reset-confirmation"] : ["activity-background-target", "reset-confirmation"] });
    }
    const resetProperty: BackgroundAppearanceProperty | null = resetVerb || /\b(supprime|supprimer|retire|retirer|efface|effacer)\b/.test(normalized)
      ? /\bcouleur\b.*\bfond\b|\bfond\b.*\bcouleur\b/.test(normalized) ? "color"
        : /\b(voile|opacite)\b/.test(normalized) ? "overlay" : /\bflou\b/.test(normalized) ? "blur"
          : /\bfond large\b|\bpleine largeur\b|\blargeur\b/.test(normalized) ? "wide" : /\bcoins?(?: arrondis?)?\b/.test(normalized) ? "rounded"
            : /\bhauteur\b/.test(normalized) ? "height" : null : null;
    if (resetProperty) {
      const target = extractBackgroundActivityTarget(normalized);
      const resolvedTarget = target ?? { target: "all" as const };
      const operations: DesignerActionOperation[] = [{ kind: "reset-activity-background-property", property: resetProperty, ...resolvedTarget }];
      if (resetProperty === "overlay") operations.push({ kind: "reset-activity-background-property", property: "overlay-color", ...resolvedTarget });
      return incomplete({ context: "activity-background", scope, chapterReference, operations, pendingSlots: target ? ["reset-confirmation"] : ["activity-background-target", "reset-confirmation"] });
    }
    if (/\b(?:image|photo)\s+(?:(?:de|en|comme)\s+)?fond\b|\bfond\s+(?:(?:avec|en utilisant)\s+)?(?:une\s+)?(?:image|photo)\b/.test(normalized)) {
      const target = extractBackgroundActivityTarget(normalized);
      return incomplete({ context: "activity-background", scope, chapterReference, operations: [{ kind: "set-activity-background-image", assetRef: "", ...(target ?? { target: "all" }) }], pendingSlots: target ? ["activity-background-image"] : ["activity-background-target", "activity-background-image"] });
    }
    const requestedBackgroundColor = /\b(fond|arriere plan)\b/.test(normalized) && extractSingleColor(command, "#FFFFFF", true) !== null;
    const mentionsAppearance = !/\b(sous titres?|subtitle|subtitles|captions|legendes)\b/.test(normalized)
      && !/\b(lecon|lesson)\b/.test(normalized)
      && !(/\b(video|videos|media|medias)\b/.test(normalized) && !/\b(couleur|voile|opacite|flou|fond large|pleine largeur|coins? arrondis?|hauteur)\b/.test(normalized) && !/\bactivite\b/.test(normalized))
      && (requestedBackgroundColor || /\b(couleur|voile|opacite|flou|fond large|pleine largeur|largeur|large|coins?|coins? arrondis?|hauteur|apparence)\b/.test(normalized));
    if (!mentionsAppearance) return null;
    const resolvedTarget = extractBackgroundActivityTarget(normalized);
    const target = resolvedTarget ?? { target: "all" as const };
    const operations: DesignerActionOperation[] = [];
    const pendingSlots: DesignerSlotId[] = [];
    if ((/\bcouleur\b/.test(normalized) || requestedBackgroundColor) && /\b(fond|arriere plan)\b/.test(normalized)) {
      const color = extractSingleColor(command, "#FFFFFF", true);
      if (color === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-background-color", color: color ?? "", ...target });
      if (!color) pendingSlots.push("activity-background-color");
    }
    if (/\b(voile|opacite)\b/.test(normalized)) {
      const darkOverlayMention = /\b(?:voile|fond)\s+(?:sombre|noir|fonce)\b/.test(normalized);
      const lightOverlayMention = /\b(?:voile|fond)\s+(?:clair|blanc)\b/.test(normalized);
      if (darkOverlayMention || lightOverlayMention) {
        operations.push({ kind: "set-activity-background-overlay-dark", enabled: darkOverlayMention, ...target });
      }
      const value = extractBackgroundIntensity(appearanceClause(normalized, /\b(voile|opacite)\b/));
      if (value === "ambiguous") return { status: "ambiguous" };
      if (value) operations.push({ kind: "set-activity-background-overlay", intensity: value, ...target });
      else if (!darkOverlayMention && !lightOverlayMention) {
        operations.push({ kind: "set-activity-background-overlay", intensity: "none", ...target });
        pendingSlots.push("activity-background-overlay");
      }
    }
    if (/\bflou\b/.test(normalized)) {
      const value = extractBackgroundIntensity(appearanceClause(normalized, /\bflou\b/));
      if (value === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-background-blur", intensity: value ?? "none", ...target });
      if (!value) pendingSlots.push("activity-background-blur");
    }
    if (/\b(fond large|pleine largeur|largeur)\b/.test(normalized) || /^(?:le |la )?large$/.test(normalized)) {
      const value = extractAppearanceBoolean(appearanceClause(normalized, /\b(fond large|pleine largeur|largeur|large)\b/));
      if (value === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-background-wide", enabled: value ?? true, ...target });
      if (value === null) pendingSlots.push("activity-background-wide");
    }
    if (/\bcoins?(?: arrondis?)?\b/.test(normalized)) {
      const value = extractAppearanceBoolean(appearanceClause(normalized, /\bcoins?(?: arrondis?)?\b/));
      if (value === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-background-rounded", enabled: value ?? true, ...target });
      if (value === null) pendingSlots.push("activity-background-rounded");
    }
    if (/\bhauteur\b/.test(normalized)) {
      const heightClause = normalized.split(/\s*[,;]\s*/).find((part) => /\bhauteur\b/.test(part)) ?? normalized;
      const value = extractHeight(heightClause);
      if (value === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-background-height", height: value ?? "medium", ...target });
      if (!value) pendingSlots.push("activity-background-height");
    }
    if (target.target === "type" && target.activityType === "media" && /\b(plein ecran|fullscreen)\b/.test(normalized)) {
      const value = extractBoolean(normalized, "fullscreen");
      if (value === "ambiguous") return { status: "ambiguous" };
      value === null ? pendingSlots.push("video-fullscreen") : operations.push({ kind: "set-video-fullscreen", enabled: value });
    }
    if (!operations.length) return null;
    if (!resolvedTarget) pendingSlots.unshift("activity-background-target");
    const draft = { context: "activity-background" as const, scope, chapterReference, operations, pendingSlots };
    return pendingSlots.length ? incomplete(draft) : ready({ command, normalized, scope, chapterReference }, operations);
  }
};

const situationalDialogueColorResolver: DesignerIntentResolver = {
  id: "situational-dialogue-color",
  capabilityIds: ["situational-dialogue-banner-color", "situational-dialogue-buttons-color"],
  resolve: (context) => {
    const { command, normalized, scope, chapterReference } = context;
    const target = extractBackgroundActivityTarget(normalized);
    if (target?.target !== "type" || target.activityType !== "situational-dialogue" || (target.activityTypes?.length ?? 0) > 1 || target.excludedActivityTypes?.length) return null;
    if (!/\b(couleur|fond)\b/.test(normalized)) return null;
    const banner = /\bbandeau\b/.test(normalized);
    const buttons = /\b(boutons?|etiquettes?|cartouche)\b/.test(normalized);
    if (!banner && !buttons) return null;
    const color = extractSingleColor(command);
    if ((banner && buttons) || color === "ambiguous") return { status: "ambiguous" };
    const operations: DesignerActionOperation[] = [{ kind: "set-situational-dialogue-color", part: banner ? "banner" : "buttons", color: color ?? "", target: "type", activityType: "situational-dialogue" }];
    return color ? ready(context, operations) : incomplete({ context: "activity-frame-appearance", scope, chapterReference, operations, pendingSlots: ["situational-dialogue-color"] });
  }
};

const frameAppearanceResolver: DesignerIntentResolver = {
  id: "activity-frame-appearance",
  capabilityIds: [
    "activity-frame-background", "activity-frame-border-color", "activity-frame-accent",
    "activity-frame-border-width", "activity-frame-border-style", "activity-frame-rounded-enable",
    "activity-frame-rounded-disable", "activity-frame-shadow-enable", "activity-frame-shadow-disable",
    "activity-frame-reset"
  ],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    const target = extractBackgroundActivityTarget(normalized);
    const explicitlyNamesFrameObject = /\b(cadre|cartouche|panneau)\b/.test(normalized);
    const explicitlyNamesFrame = explicitlyNamesFrameObject || /\bapparence\b.*\bactivites?\b/.test(normalized);
    const specializedBackgroundTarget = target?.target === "type" && (
      target.activityType === "slides"
      || (target.activityType === "matching" && /\b(?:etiquettes?|libelles?|cartes?)\b/.test(normalized))
    );
    const specializedRoundedTarget = target?.target === "type" && (
      (target.activityType === "matching" && /\b(?:etiquettes?|libelles?|cartes?)\b/.test(normalized))
      || target.activityType === "slides"
      || (target.activityType === "find-elements" && /\b(?:coins?\s+arrondis?|arrondis?)\b.*\b(?:de|sur) l image\b/.test(normalized))
      || (target.activityType === "card-sort" && /\b(?:coins?\s+arrondis?|arrondis?)\b.*\b(?:des|sur les) cartes?\b/.test(normalized))
    );
    const mentionsBorder = /\b(trait|bordure)\b/.test(normalized);
    const mentionsAccent = /\baccent\b/.test(normalized);
    const mentionsShadow = /\bombre\b/.test(normalized);
    const mentionsRounded = /\b(?:coins?\s+)?arrondis?|\bcoins?\b/.test(normalized) && (explicitlyNamesFrame || specializedRoundedTarget);
    const mentionsFrameBackground = /\bfond\b/.test(normalized)
      && !/\b(voile|flou|large|image|hauteur)\b/.test(normalized)
      && (explicitlyNamesFrame || specializedBackgroundTarget);
    const requestsReset = /\b(reinitialise|reinitialiser|remets|remettre|retablis|retablir)\b/.test(normalized);
    const reset = requestsReset && (explicitlyNamesFrameObject || (target?.target === "type" && target.activityType === "situational-dialogue" && explicitlyNamesFrame));
    if (requestsReset && !reset) return null;
    if (!mentionsBorder && !mentionsAccent && !mentionsShadow && !mentionsRounded && !mentionsFrameBackground && !reset) return null;

    const resolvedTarget = target ?? { target: "all" as const };
    if (reset) {
      return incomplete({
        context: "activity-frame-appearance",
        scope,
        chapterReference,
        operations: [{ kind: "reset-activity-frame-appearance", ...resolvedTarget }],
        pendingSlots: [...(target ? [] : ["activity-frame-target" as const]), "reset-confirmation"]
      });
    }

    const operations: DesignerActionOperation[] = [];
    const pendingSlots: DesignerSlotId[] = [];
    if (mentionsFrameBackground) {
      const color = extractSingleColor(command, "#FFFFFF", true);
      if (color === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-frame-background-color", color: color ?? "", ...resolvedTarget });
      if (!color) pendingSlots.push("activity-frame-background-color");
    }
    if (mentionsAccent) {
      const color = extractSingleColor(command);
      if (color === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-frame-accent-color", color: color ?? "", ...resolvedTarget });
      if (!color) pendingSlots.push("activity-frame-accent-color");
    }
    if (mentionsBorder) {
      const color = extractSingleColor(command);
      if (color === "ambiguous") return { status: "ambiguous" };
      const width = extractActivityFrameBorderWidth(normalized);
      const style = extractActivityFrameBorderStyle(normalized);
      if (width === "ambiguous" || style === "ambiguous") return { status: "ambiguous" };
      if (color) operations.push({ kind: "set-activity-frame-border-color", color, ...resolvedTarget });
      if (width) operations.push({ kind: "set-activity-frame-border-width", width, ...resolvedTarget });
      if (style) operations.push({ kind: "set-activity-frame-border-style", style, ...resolvedTarget });
      if (!color && !width && !style) pendingSlots.push("activity-frame-border-color");
    }
    if (mentionsRounded) {
      const enabled = extractAppearanceBoolean(normalized);
      if (enabled === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-frame-rounded", enabled: enabled ?? true, ...resolvedTarget });
      if (enabled === null) pendingSlots.push("activity-frame-rounded");
    }
    if (mentionsShadow) {
      const enabled = extractAppearanceBoolean(normalized);
      if (enabled === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-activity-frame-shadow", enabled: enabled ?? true, ...resolvedTarget });
      if (enabled === null) pendingSlots.push("activity-frame-shadow");
    }
    if (!operations.length && !pendingSlots.length) return null;
    if (!target) pendingSlots.unshift("activity-frame-target");
    return pendingSlots.length
      ? incomplete({ context: "activity-frame-appearance", scope, chapterReference, operations, pendingSlots })
      : ready({ command, normalized, scope, chapterReference }, operations);
  }
};

const headerAppearanceResolver: DesignerIntentResolver = {
  id: "header-appearance",
  capabilityIds: ["header-background-color", "header-text-color", "header-background-blur", "header-background-overlay", "header-content-align", "header-text-outline", "header-reset"],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    if (!/\b(en tetes?|entetes?|bandeaux?)\b/.test(normalized)) return null;
    const requestsReset = /\b(reinitialise|reinitialiser|remets|remettre|retablis|retablir)\b/.test(normalized);
    if (requestsReset) return incomplete({
      context: "header-appearance", scope, chapterReference,
      operations: [{ kind: "reset-header-appearance" }], pendingSlots: ["reset-confirmation"]
    });
    const operations: DesignerActionOperation[] = [];
    const pendingSlots: DesignerSlotId[] = [];
    const requestedHeaderColor = extractSingleColor(command, "#d7eef0", true);
    const requestsTextColor = /\bcouleur\b.*\b(?:texte|police|lettres?)\b|\b(?:texte|police|lettres?)\b.*\bcouleur\b/.test(normalized);
    if (requestsTextColor) {
      const color = extractSingleColor(command);
      if (color === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-header-text-color", color: color ?? "" });
      if (!color) pendingSlots.push("header-text-color");
    }
    if (!requestsTextColor && (/\b(couleur de fond)\b/.test(normalized) || (/\bfond\b/.test(normalized) && Boolean(requestedHeaderColor)))) {
      const color = requestedHeaderColor;
      if (color === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-header-background-color", color: color ?? "" });
      if (!color) pendingSlots.push("header-background-color");
    }
    if (/\bflou\b/.test(normalized)) {
      const segment = normalized.match(/\bflou\b.*?(?=\bet\s+(?:un\s+)?voile\b|$)/)?.[0] ?? normalized;
      const intensity = extractBackgroundIntensity(segment);
      if (intensity === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-header-background-blur", intensity: intensity ?? "medium" });
      if (!intensity) pendingSlots.push("header-background-blur");
    }
    if (/\bvoile\b/.test(normalized)) {
      const segment = normalized.match(/\bvoile\b.*?(?=\bet\s+(?:un\s+)?flou\b|$)/)?.[0] ?? normalized;
      const intensity = extractBackgroundIntensity(segment);
      if (intensity === "ambiguous") return { status: "ambiguous" };
      if (intensity) operations.push({ kind: "set-header-background-overlay", intensity });
      else if (!/\b(sombre|clair|noir|blanc)\b/.test(normalized)) {
        operations.push({ kind: "set-header-background-overlay", intensity: "medium" });
        pendingSlots.push("header-background-overlay");
      }
      if (/\b(sombre|noir)\b/.test(normalized)) operations.push({ kind: "set-header-background-overlay-dark", enabled: true });
      else if (/\b(clair|blanc)\b/.test(normalized)) operations.push({ kind: "set-header-background-overlay-dark", enabled: false });
    }
    if (/\b(position|place|placer|aligne|aligner|gauche|centre|droite)\b/.test(normalized) && /\b(texte|bloc)\b/.test(normalized)) {
      const align = extractHeaderContentAlign(normalized);
      if (align === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-header-content-align", align: align ?? "center" });
      if (!align) pendingSlots.push("header-content-align");
    }
    if (/\b(contour|renforcement|contraste)\b/.test(normalized)) {
      const outline = extractHeaderTextOutline(normalized);
      const outlineColor = extractHeaderTextOutlineColor(normalized);
      if (outline === "ambiguous" || outlineColor === "ambiguous") return { status: "ambiguous" };
      if (outline) operations.push({ kind: "set-header-text-outline", outline });
      if (outlineColor) operations.push({ kind: "set-header-text-outline-color", outlineColor });
      if (!outline && !outlineColor) {
        operations.push({ kind: "set-header-text-outline", outline: "medium" });
        pendingSlots.push("header-text-outline");
      }
    }
    if (!operations.length) return null;
    return pendingSlots.length
      ? incomplete({ context: "header-appearance", scope, chapterReference, operations, pendingSlots })
      : ready({ command, normalized, scope, chapterReference }, operations);
  }
};

const dividerAppearanceResolver: DesignerIntentResolver = {
  id: "divider-appearance",
  capabilityIds: ["divider-color", "divider-width", "divider-style", "section-marker-scheme", "section-marker-type", "section-marker-text-color", "divider-reset", "section-marker-reset"],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    if (!/\bseparateurs?\b/.test(normalized)) return null;
    const target = extractBackgroundActivityTarget(normalized);
    const isSectionMarker = target?.target === "type" && target.activityType === "section-marker" || /\brepere|reperes|numerotation|numerote|numeroter\b/.test(normalized);
    const resolvedTarget = target ?? { target: "type" as const, activityType: isSectionMarker ? "section-marker" : "divider" };
    const requestsReset = /\b(reinitialise|reinitialiser|remets|remettre|retablis|retablir)\b/.test(normalized);
    if (requestsReset) {
      return incomplete({
        context: "divider-appearance",
        scope,
        chapterReference,
        operations: [{ kind: isSectionMarker ? "reset-section-marker-appearance" : "reset-divider-appearance", ...resolvedTarget }],
        pendingSlots: ["reset-confirmation"]
      });
    }
    const operations: DesignerActionOperation[] = [];
    const pendingSlots: DesignerSlotId[] = [];
    const scheme = extractSectionMarkerScheme(normalized);
    const markerType = extractSectionMarkerType(normalized);
    if (scheme === "ambiguous" || markerType === "ambiguous") return { status: "ambiguous" };
    if (isSectionMarker && /\b(numerotation|numerote|numeroter|lettres?|chiffres?|arabes?|romains?|alphabetique)\b/.test(normalized)) {
      operations.push({ kind: "set-section-marker-scheme", scheme: scheme ?? "arabic", ...resolvedTarget });
      if (!scheme) pendingSlots.push("section-marker-scheme");
    }
    if (isSectionMarker && /\b(type de repere|forme du repere|sans repere|cercle|rond plein)\b/.test(normalized)) {
      operations.push({ kind: "set-section-marker-type", markerType: markerType ?? "outline", ...resolvedTarget });
      if (!markerType) pendingSlots.push("section-marker-type");
    }
    const mentionsMarkerColor = isSectionMarker && !/\bfond\b/.test(normalized)
      && /(?:\bcouleur\b.*\b(?:texte|repere)\b|\b(?:texte|repere)\b.*\bcouleur\b)/.test(normalized);
    const explicitColor = extractSingleColor(command);
    const mentionsDividerColor = (/\bcouleur\b.*\b(trait|separateurs?)\b|\b(trait|separateurs?)\b.*\bcouleur\b/.test(normalized)
      || Boolean(explicitColor && explicitColor !== "ambiguous" && /\b(trait|separateurs?)\b/.test(normalized))) && !mentionsMarkerColor && !/\bfond\b/.test(normalized);
    if (mentionsMarkerColor || mentionsDividerColor) {
      const color = extractSingleColor(command);
      if (color === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: mentionsMarkerColor ? "set-section-marker-text-color" : "set-divider-color", color: color ?? "", ...resolvedTarget });
      if (!color) pendingSlots.push(mentionsMarkerColor ? "section-marker-text-color" : "divider-color");
    }
    const requestedWidth = extractActivityFrameBorderWidth(normalized);
    if (requestedWidth || /\b(epaisseur|trait (?:fin|normal|epais|tres epais))\b/.test(normalized)) {
      const width = requestedWidth;
      if (width === "ambiguous") return { status: "ambiguous" };
      operations.push({ kind: "set-divider-width", width: width ?? "2px", ...resolvedTarget });
      if (!width) pendingSlots.push("activity-frame-border-width");
    }
    if (/\b(type de trait|style de trait|trait (?:plein|tirets?|pointilles?))\b/.test(normalized)) {
      const style = extractActivityFrameBorderStyle(normalized);
      if (style === "ambiguous" || (isSectionMarker && style === "none")) return { status: "ambiguous" };
      operations.push({ kind: "set-divider-style", style: style ?? "solid", ...resolvedTarget });
      if (!style) pendingSlots.push("activity-frame-border-style");
    }
    if (!operations.length) return null;
    return pendingSlots.length
      ? incomplete({ context: "divider-appearance", scope, chapterReference, operations, pendingSlots })
      : ready({ command, normalized, scope, chapterReference }, operations);
  }
};

const activityFontResolver: DesignerIntentResolver = {
  id: "activity-font-family",
  capabilityIds: ["activity-font-family", "activity-font-family-default"],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    const mentionsFont = /\b(police|polices|fonte|fontes|typographie)\b/.test(normalized);
    const mentionsActivity = /\bactivite|activites\b/.test(normalized);
    if (!mentionsFont || !mentionsActivity || /\b(taille|dimension|couleur)\b/.test(normalized) || /\b(lecon|lesson)\b/.test(normalized)) return null;
    const target = extractFontActivityTarget(normalized);
    const fontReference = extractFontReference(command, normalized);
    const operation: DesignerActionOperation = {
      kind: "set-activity-font-family",
      fontReference: fontReference ?? "",
      ...(target ?? { target: "all" })
    };
    const pendingSlots: DesignerSlotId[] = [];
    if (!target) pendingSlots.push("activity-font-target");
    if (!fontReference) pendingSlots.push("activity-font-family");
    return pendingSlots.length
      ? incomplete({ context: "activity-font-family", scope, chapterReference, operations: [operation], pendingSlots })
      : ready({ command, normalized, scope, chapterReference }, [operation]);
  }
};

const textAndSpacingResolver: DesignerIntentResolver = {
  id: "text-and-spacing",
  capabilityIds: ["lesson-text-color", "text-activity-font-size", "activity-spacing"],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    const fontSize = /\b(taille|dimension)\b.*\b(police|texte|caracteres|fonte)\b|\b(police|texte|caracteres|fonte)\b.*\b(taille|dimension)\b/.test(normalized);
    if (fontSize) {
      if (/\b(lecon|lesson)\b/.test(normalized) && !/\b(activite|activites)\s+(?:de\s+)?textes?\b/.test(normalized)) return { status: "unavailable", reason: "lesson-font-size" };
      if (!/\b(activite|activites|blocs?)\b/.test(normalized)) return incomplete({ context: "text-activity-font-size", scope, chapterReference, operations: [], pendingSlots: ["font-size-target"] });
      const target = /\bactivites?\s+(?:de\s+)?textes?\b|\bblocs?\s+textes?\b/.test(normalized)
        ? { target: "type" as const, activityType: "rich-text" }
        : extractBackgroundActivityTarget(normalized) ?? (/\btoutes? les activites\b/.test(normalized) ? { target: "all" as const } : null);
      const value = extractFontSize(normalized);
      if (value === "ambiguous") return { status: "ambiguous" };
      const operations = [{ kind: "set-text-activity-font-size" as const, sizePx: value ?? 16, ...(target ?? { target: "all" as const }) }];
      const pendingSlots: DesignerSlotId[] = [];
      if (!target) pendingSlots.push("activity-font-size-target");
      if (!value) pendingSlots.push("text-activity-font-size");
      return pendingSlots.length
        ? incomplete({ context: "text-activity-font-size", scope, chapterReference, operations, pendingSlots })
        : ready({ command, normalized, scope, chapterReference }, operations);
    }
    if (/\b(padding|espacement|espace|marge|ecart|ecarts)\b/.test(normalized)) {
      const target = extractSpacingActivityTarget(normalized);
      const value = extractActivitySpacing(normalized);
      if (value === "ambiguous") return { status: "ambiguous" };
      if (!target) return incomplete({
        context: "activity-spacing",
        scope,
        chapterReference,
        operations: value ? [{ kind: "set-activity-spacing", spacing: value, target: "all" }] : [],
        pendingSlots: value ? ["activity-spacing-target"] : ["activity-spacing-target", "activity-spacing-value"]
      });
      return value ? ready({ command, normalized, scope, chapterReference }, [{ kind: "set-activity-spacing", spacing: value, ...target }]) : incomplete({ context: "activity-spacing", scope, chapterReference, operations: [{ kind: "set-activity-spacing", spacing: "medium", ...target }], pendingSlots: ["activity-spacing-value"] });
    }
    if (/\b(couleur|color)\b/.test(normalized) && /\b(police|texte|text)\b/.test(normalized) && /\b(lecon|lesson)\b/.test(normalized)) {
      const color = extractSingleColor(command);
      if (color === "ambiguous") return { status: "ambiguous" };
      return color ? ready({ command, normalized, scope, chapterReference }, [{ kind: "set-lesson-text-color", color }]) : incomplete({ context: "lesson-text", scope, chapterReference, operations: [], pendingSlots: ["lesson-text-color"] });
    }
    return null;
  }
};

const videoResolver: DesignerIntentResolver = {
  id: "video",
  capabilityIds: ["video-caption-color", "video-caption-background-enable", "video-caption-background-disable", "video-caption-outline", "video-fullscreen-enable", "video-fullscreen-disable"],
  resolve: ({ command, normalized, scope, chapterReference }) => {
    const captions = /\b(sous titres|sous titre|subtitle|subtitles|captions|legendes)\b/.test(normalized);
    if (!/\b(video|videos|media|medias)\b/.test(normalized) && !captions && !/\b(plein ecran|fullscreen)\b/.test(normalized)) return null;
    const operations: DesignerActionOperation[] = [];
    const pendingSlots: DesignerSlotId[] = [];
    if (captions) {
      const color = extractSingleColor(command, "#FFFFFF");
      const mentionsColor = /\b(couleur|color)\b/.test(normalized) || color !== null;
      const mentionsBackground = /\b(fond|arriere plan|background)\b/.test(normalized);
      const mentionsOutline = /\b(contour|outline)\b/.test(normalized);
      if (mentionsColor) {
        if (color === "ambiguous") return { status: "ambiguous" };
        color ? operations.push({ kind: "set-video-caption-color", color }) : pendingSlots.push("video-caption-color");
      }
      if (mentionsBackground) {
        const value = extractBoolean(normalized, "background");
        if (value === "ambiguous") return { status: "ambiguous" };
        value === null ? pendingSlots.push("video-caption-background") : operations.push({ kind: "set-video-caption-background", enabled: value });
      }
      if (mentionsOutline) {
        const value = extractOutline(normalized);
        if (value === "ambiguous") return { status: "ambiguous" };
        value ? operations.push({ kind: "set-video-caption-outline", outline: value }) : pendingSlots.push("video-caption-outline");
      }
      if (!mentionsColor && !mentionsBackground && !mentionsOutline) pendingSlots.push("video-caption-property");
    }
    if (/\b(plein ecran|fullscreen)\b/.test(normalized)) {
      const value = extractBoolean(normalized, "fullscreen");
      if (value === "ambiguous") return { status: "ambiguous" };
      value === null ? pendingSlots.push("video-fullscreen") : operations.push({ kind: "set-video-fullscreen", enabled: value });
    }
    if (!captions && !/\b(plein ecran|fullscreen)\b/.test(normalized)) pendingSlots.push("video-property");
    return pendingSlots.length ? incomplete({ context: captions ? "video-captions" : "video", scope, chapterReference, operations, pendingSlots }) : ready({ command, normalized, scope, chapterReference }, operations);
  }
};

const conceptResolver: DesignerIntentResolver = {
  id: "concept-dialogue",
  capabilityIds: [],
  resolve: ({ normalized, scope, chapterReference }) => {
    const concept = normalized
      .replace(/^(?:je (?:veux|voudrais|souhaite)\s+)?(?:changer|change|modifier|modifie|regler|regle)\s+/, "")
      .replace(/^(?:le|la|les)\s+/, "")
      .trim();
    if (concept === "apparence") return incomplete({ context: "activity-background", scope, chapterReference, operations: [], pendingSlots: ["appearance-property"] });
    if (concept === "couleur") return incomplete({ context: "activity-background", scope, chapterReference, operations: [], pendingSlots: ["color-property"] });
    if (/^(?:police|fonte|typographie)$/.test(concept)) return incomplete({ context: "activity-font-family", scope, chapterReference, operations: [], pendingSlots: ["font-property"] });
    if (/^(?:bouton|boutons) (?:continuer|continue|suivant)$/.test(concept)) return incomplete({ context: "continue-button", scope, chapterReference, operations: [], pendingSlots: ["continue-button-property"] });
    return null;
  }
};

export const DESIGNER_INTENT_RESOLVERS: DesignerIntentResolver[] = [resetResolver, navigationStyleCopyResolver, situationalDialogueColorResolver, continueResolver, headerAppearanceResolver, dividerAppearanceResolver, frameAppearanceResolver, backgroundResolver, activityFontResolver, textAndSpacingResolver, videoResolver, conceptResolver];

export function resolveDesignerIntentWithTrace(command: string, normalized: string, fallbackScope: DesignerActionScope) {
  const context: DesignerIntentContext = { command, normalized, ...scopeFrom(normalized, fallbackScope) };
  for (const resolver of DESIGNER_INTENT_RESOLVERS) {
    const result = resolver.resolve(context);
    if (result) return { resolverId: resolver.id, capabilityIds: [...resolver.capabilityIds], result };
  }
  const candidates = understandingCandidates(command);
  const expanded=expandUnderstandingSynonyms(normalized);
  if(expanded!==normalized)for(const resolver of DESIGNER_INTENT_RESOLVERS){const result=resolver.resolve({...context,normalized:expanded});if(result)return {resolverId:`synonyms:${resolver.id}`,capabilityIds:[...resolver.capabilityIds],result};}
  if (candidates.length > 1) return { resolverId: 'declarative', capabilityIds: candidates.map(candidate => candidate.id), result: incomplete({context:'activity-background',scope:context.scope,chapterReference:context.chapterReference,operations:[],pendingSlots:['understanding-choice'],candidateCommands:candidates.slice(0,3).map(candidate=>candidate.command)}) };
  if (candidates.length === 1) {
    const capability = candidates[0];
    const canonical = { ...context, command: capability.command, normalized: normalizeDesignerText(capability.command) };
    for (const resolver of DESIGNER_INTENT_RESOLVERS) {
      const result = resolver.resolve(canonical);
      if (result) return { resolverId: `declarative:${resolver.id}`, capabilityIds: [capability.id], result };
    }
  }
  const nearby=nearbyUnderstandingCandidates(command);
  if(nearby.length)return {resolverId:'spelling-suggestion',capabilityIds:nearby.map(candidate=>candidate.id),result:incomplete({context:'activity-background',scope:context.scope,chapterReference:context.chapterReference,operations:[],pendingSlots:['understanding-choice'],candidateCommands:nearby.map(candidate=>candidate.command)})};
  return { resolverId: null, capabilityIds: [], result: { status: "unsupported" } as DesignerConversationResult };
}

export function resolveDesignerIntent(command: string, normalized: string, fallbackScope: DesignerActionScope): DesignerConversationResult {
  return resolveDesignerIntentWithTrace(command, normalized, fallbackScope).result;
}
