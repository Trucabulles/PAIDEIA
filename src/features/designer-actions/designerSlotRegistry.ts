export type DesignerSlotId =
  | "help-topic"
  | "help-activity"
  | "help-choice"
  | "help-related"
  | "understanding-choice"
  | "unresolved-action"
  | "activity-intent-choice"
  | "activity-property"
  | "lesson-text-color"
  | "video-caption-color"
  | "video-caption-background"
  | "video-caption-outline"
  | "video-fullscreen"
  | "video-property"
  | "video-caption-property"
  | "appearance-property"
  | "color-property"
  | "font-property"
  | "continue-button-property"
  | "font-size-target"
  | "text-activity-font-size"
  | "activity-font-size-target"
  | "activity-font-target"
  | "activity-font-family"
  | "activity-spacing-target"
  | "activity-spacing-value"
  | "activity-background-target"
  | "activity-background-image"
  | "activity-background-color"
  | "activity-background-overlay"
  | "activity-background-blur"
  | "activity-background-wide"
  | "activity-background-rounded"
  | "activity-background-height"
  | "activity-frame-target"
  | "activity-frame-background-color"
  | "activity-frame-border-color"
  | "situational-dialogue-color"
  | "activity-frame-accent-color"
  | "activity-frame-border-width"
  | "activity-frame-border-style"
  | "activity-frame-rounded"
  | "activity-frame-shadow"
  | "divider-color"
  | "section-marker-text-color"
  | "section-marker-scheme"
  | "section-marker-type"
  | "header-background-color"
  | "header-text-color"
  | "header-background-blur"
  | "header-background-overlay"
  | "header-background-overlay-dark"
  | "header-content-align"
  | "header-text-outline"
  | "header-text-outline-color"
  | "reset-confirmation"
  | "continue-button-background-color"
  | "continue-button-text-color"
  | "continue-button-label"
  | "assistant-address-form-persistence-confirmation"
  | "chapter-reference-choice";

export type DesignerQuestionControl = "color" | "image" | "font";

export const DESIGNER_SLOT_REGISTRY: Record<DesignerSlotId, {
  questionKey: string;
  fallback: string;
  control?: DesignerQuestionControl;
  answerSuggestions?: string[];
}> = {
  "help-topic": { questionKey: "designerActions.questionHelpTopic", fallback: "Oui. Sur quoi avez-vous besoin d’aide ?" },
  "help-activity": { questionKey: "designerActions.helpChooseTopic", fallback: "Plusieurs activités correspondent à votre demande. Laquelle souhaitez-vous consulter ?" },
  "help-choice": { questionKey: "designerActions.helpChooseTopic", fallback: "Plusieurs rubriques correspondent à votre demande. Laquelle souhaitez-vous consulter ?" },
  "help-related": { questionKey: "designerActions.questionHelpRelated", fallback: "Souhaitez-vous consulter une autre rubrique sur ce sujet ?" },
  "understanding-choice": { questionKey: "designerActions.questionUnderstandingChoice", fallback: "Souhaitez-vous effectuer l’une de ces actions ? Choisissez une proposition ou précisez votre demande." },
  "unresolved-action": { questionKey: "designerActions.questionUnresolvedAction", fallback: "J’ai conservé les actions déjà comprises. Pouvez-vous reformuler l’action suivante ? Le lot attend cette précision avant application." },
  "activity-intent-choice": { questionKey: "designerActions.questionActivityIntent", fallback: "Souhaitez-vous consulter l’aide ou modifier cette activité ?" },
  "activity-property": { questionKey: "designerActions.questionActivityProperty", fallback: "Que voulez-vous modifier dans cette activité ?" },
  "lesson-text-color": { questionKey: "designerActions.questionLessonTextColor", fallback: "Oui. Quelle couleur souhaitez-vous utiliser pour le texte de la leçon ?", control: "color" },
  "video-caption-color": { questionKey: "designerActions.questionVideoCaptionColor", fallback: "Quelle couleur voulez-vous utiliser pour les sous-titres ?", control: "color" },
  "video-caption-background": { questionKey: "designerActions.questionVideoCaptionBackground", fallback: "Souhaitez-vous activer ou désactiver le fond des sous-titres ?", answerSuggestions: ["Activer", "Désactiver"] },
  "video-caption-outline": { questionKey: "designerActions.questionVideoCaptionOutline", fallback: "Quel contour souhaitez-vous utiliser : aucun, fin ou épais ?", answerSuggestions: ["Aucun", "Fin", "Épais"] },
  "video-fullscreen": { questionKey: "designerActions.questionVideoFullscreen", fallback: "Souhaitez-vous autoriser ou désactiver le plein écran ?", answerSuggestions: ["Autoriser", "Désactiver"] },
  "video-property": { questionKey: "designerActions.questionVideoProperty", fallback: "Que souhaitez-vous modifier dans les activités vidéo ?", answerSuggestions: ["Les sous-titres", "Le plein écran", "La hauteur"] },
  "video-caption-property": { questionKey: "designerActions.questionVideoCaptionProperty", fallback: "Que souhaitez-vous modifier dans les sous-titres : leur couleur, leur contour ou leur fond ?", answerSuggestions: ["La couleur", "Le contour", "Le fond"] },
  "appearance-property": { questionKey: "designerActions.questionAppearanceProperty", fallback: "Quel réglage d’apparence souhaitez-vous modifier ?", answerSuggestions: ["La couleur de fond", "L’image de fond", "Le voile", "Le flou", "La largeur", "Les coins arrondis", "La hauteur"] },
  "color-property": { questionKey: "designerActions.questionColorProperty", fallback: "Quelle couleur souhaitez-vous modifier ?", answerSuggestions: ["La couleur de fond des activités", "La couleur du texte de la leçon", "La couleur des sous-titres", "La couleur de fond des boutons Continuer", "La couleur du texte des boutons Continuer"] },
  "font-property": { questionKey: "designerActions.questionFontProperty", fallback: "Quel réglage de police souhaitez-vous modifier ?", answerSuggestions: ["La police des activités", "La taille de la police des activités Texte", "La couleur du texte de la leçon"] },
  "continue-button-property": { questionKey: "designerActions.questionContinueButtonProperty", fallback: "Que souhaitez-vous modifier sur les boutons Continuer ?", answerSuggestions: ["La couleur de fond", "La couleur du texte", "Le libellé"] },
  "font-size-target": { questionKey: "designerActions.questionFontSizeTarget", fallback: "Précisez votre demande en indiquant à quel endroit." },
  "text-activity-font-size": { questionKey: "designerActions.questionTextActivityFontSize", fallback: "Quelle taille voulez-vous utiliser pour les activités texte ? Vous pouvez saisir un nombre, avec ou sans px." },
  "activity-font-size-target": { questionKey: "designerActions.questionActivityFontSizeTarget", fallback: "Dans quelles activités souhaitez-vous normaliser la taille du texte courant ?" },
  "activity-font-target": { questionKey: "designerActions.questionActivityFontTarget", fallback: "Quelles activités souhaitez-vous modifier ?" },
  "activity-font-family": { questionKey: "designerActions.questionActivityFontFamily", fallback: "Quelle police souhaitez-vous appliquer ?", control: "font" },
  "activity-spacing-target": { questionKey: "designerActions.questionActivitySpacingTarget", fallback: "Quelles activités souhaitez-vous modifier ?" },
  "activity-spacing-value": { questionKey: "designerActions.questionActivitySpacingValue", fallback: "Quel espacement voulez-vous utiliser : minimum, moyen ou maximum ?", answerSuggestions: ["Minimum", "Moyen", "Maximum"] },
  "activity-background-target": { questionKey: "designerActions.questionActivityBackgroundTarget", fallback: "Quelles activités souhaitez-vous modifier ?" },
  "activity-background-image": { questionKey: "designerActions.questionActivityBackgroundImage", fallback: "Oui. Quelle image souhaitez-vous utiliser comme fond ?", control: "image" },
  "activity-background-color": { questionKey: "designerActions.questionActivityBackgroundColor", fallback: "Quelle couleur de fond souhaitez-vous utiliser ? Vous pouvez saisir son nom, une valeur HEX ou RGB.", control: "color" },
  "activity-background-overlay": { questionKey: "designerActions.questionActivityBackgroundOverlay", fallback: "Quel voile de fond souhaitez-vous utiliser : aucun, léger, moyen ou fort ?", answerSuggestions: ["Aucun", "Léger", "Moyen", "Fort"] },
  "activity-background-blur": { questionKey: "designerActions.questionActivityBackgroundBlur", fallback: "Quel flou de fond souhaitez-vous utiliser : aucun, léger, moyen ou fort ?", answerSuggestions: ["Aucun", "Léger", "Moyen", "Fort"] },
  "activity-background-wide": { questionKey: "designerActions.questionActivityBackgroundWide", fallback: "Souhaitez-vous activer ou désactiver le fond large ?", answerSuggestions: ["Activer", "Désactiver"] },
  "activity-background-rounded": { questionKey: "designerActions.questionActivityBackgroundRounded", fallback: "Souhaitez-vous activer ou désactiver les coins arrondis ?", answerSuggestions: ["Activer", "Désactiver"] },
  "activity-background-height": { questionKey: "designerActions.questionActivityBackgroundHeight", fallback: "Quelle hauteur d’apparence souhaitez-vous utiliser : minimale, moyenne ou grande ?", answerSuggestions: ["Minimale", "Moyenne", "Grande"] },
  "activity-frame-target": { questionKey: "designerActions.questionActivityFrameTarget", fallback: "Quelles activités souhaitez-vous modifier ?" },
  "activity-frame-background-color": { questionKey: "designerActions.questionActivityFrameBackgroundColor", fallback: "Quelle couleur de fond souhaitez-vous appliquer à l’apparence des activités ?", control: "color" },
  "activity-frame-border-color": { questionKey: "designerActions.questionActivityFrameBorderColor", fallback: "Quelle couleur de trait souhaitez-vous utiliser ?", control: "color" },
  "situational-dialogue-color": { questionKey: "designerActions.questionSituationalDialogueColor", fallback: "Quelle couleur souhaitez-vous appliquer ?", control: "color" },
  "activity-frame-accent-color": { questionKey: "designerActions.questionActivityFrameAccentColor", fallback: "Quelle couleur d’accent souhaitez-vous utiliser ?", control: "color" },
  "activity-frame-border-width": { questionKey: "designerActions.questionActivityFrameBorderWidth", fallback: "Quelle épaisseur souhaitez-vous utiliser : fine, normale, épaisse ou très épaisse ?", answerSuggestions: ["Fine", "Normale", "Épaisse", "Très épaisse"] },
  "activity-frame-border-style": { questionKey: "designerActions.questionActivityFrameBorderStyle", fallback: "Quel type de trait souhaitez-vous utiliser : aucun, plein, tirets ou pointillés ?", answerSuggestions: ["Aucun", "Plein", "Tirets", "Pointillés"] },
  "activity-frame-rounded": { questionKey: "designerActions.questionActivityFrameRounded", fallback: "Souhaitez-vous activer ou désactiver les coins arrondis ?", answerSuggestions: ["Activer", "Désactiver"] },
  "activity-frame-shadow": { questionKey: "designerActions.questionActivityFrameShadow", fallback: "Souhaitez-vous activer ou désactiver l’ombre ?", answerSuggestions: ["Activer", "Désactiver"] },
  "divider-color": { questionKey: "designerActions.questionDividerColor", fallback: "Quelle couleur de trait souhaitez-vous utiliser pour les séparateurs ?", control: "color" },
  "section-marker-text-color": { questionKey: "designerActions.questionSectionMarkerTextColor", fallback: "Quelle couleur souhaitez-vous utiliser pour les repères ?", control: "color" },
  "section-marker-scheme": { questionKey: "designerActions.questionSectionMarkerScheme", fallback: "Quelle numérotation souhaitez-vous utiliser : chiffres arabes, chiffres romains ou lettres ?", answerSuggestions: ["Chiffres arabes", "Chiffres romains", "Lettres"] },
  "section-marker-type": { questionKey: "designerActions.questionSectionMarkerType", fallback: "Quel type de repère souhaitez-vous utiliser : sans, cercle ou rond plein ?", answerSuggestions: ["Sans", "Cercle", "Rond plein"] },
  "header-background-color": { questionKey: "designerActions.questionHeaderBackgroundColor", fallback: "Quelle couleur de fond souhaitez-vous utiliser pour les en-têtes ?", control: "color" },
  "header-text-color": { questionKey: "designerActions.questionHeaderTextColor", fallback: "Quelle couleur souhaitez-vous utiliser pour le texte des en-têtes ?", control: "color" },
  "header-background-blur": { questionKey: "designerActions.questionHeaderBackgroundBlur", fallback: "Quel flou souhaitez-vous utiliser : aucun, léger, moyen ou fort ?", answerSuggestions: ["Aucun", "Léger", "Moyen", "Fort"] },
  "header-background-overlay": { questionKey: "designerActions.questionHeaderBackgroundOverlay", fallback: "Quel voile souhaitez-vous utiliser : aucun, léger, moyen ou fort ?", answerSuggestions: ["Aucun", "Léger", "Moyen", "Fort"] },
  "header-background-overlay-dark": { questionKey: "designerActions.questionHeaderBackgroundOverlayDark", fallback: "Souhaitez-vous un voile sombre ou clair ?", answerSuggestions: ["Sombre", "Clair"] },
  "header-content-align": { questionKey: "designerActions.questionHeaderContentAlign", fallback: "Où souhaitez-vous placer le bloc texte : à gauche, au centre ou à droite ?", answerSuggestions: ["À gauche", "Au centre", "À droite"] },
  "header-text-outline": { questionKey: "designerActions.questionHeaderTextOutline", fallback: "Quel renforcement du contraste souhaitez-vous : aucun, fin, moyen ou épais ?", answerSuggestions: ["Aucun", "Fin", "Moyen", "Épais"] },
  "header-text-outline-color": { questionKey: "designerActions.questionHeaderTextOutlineColor", fallback: "Souhaitez-vous un contour clair ou sombre ?", answerSuggestions: ["Clair", "Sombre"] },
  "reset-confirmation": { questionKey: "designerActions.questionResetConfirmation", fallback: "Êtes-vous sûr de vouloir réinitialiser ces réglages ? Répondez oui ou non.", answerSuggestions: ["Oui", "Non"] },
  "continue-button-background-color": { questionKey: "designerActions.questionContinueButtonBackgroundColor", fallback: "Quelle couleur souhaitez-vous utiliser pour les boutons Continuer ?", control: "color" },
  "continue-button-text-color": { questionKey: "designerActions.questionContinueButtonTextColor", fallback: "Quelle couleur souhaitez-vous utiliser pour le texte des boutons Continuer ?", control: "color" },
  "continue-button-label": { questionKey: "designerActions.questionContinueButtonLabel", fallback: "Quel libellé souhaitez-vous utiliser pour les boutons Continuer ?" },
  "assistant-address-form-persistence-confirmation": { questionKey: "designerActions.questionAddressFormPersistence", fallback: "Souhaitez-vous mémoriser localement cette préférence ? Répondez oui ou non." },
  "chapter-reference-choice": { questionKey: "designerActions.questionChapterReferenceChoice", fallback: "Voulez-vous dire le {position} chapitre ou le chapitre dont le nom est « {title} » ?" }
};
