import type { ActivityItem, SituationalDialogueResponse } from "../../../types/project";
import { translateActive } from "../../../i18n";

const LEGACY_SITUATIONAL_DIALOGUE_SEQUENCE_CONTENT_HTML = new Set([
  "<p>Décrivez la situation professionnelle.</p>"
]);

const LEGACY_SITUATIONAL_DIALOGUE_RESPONSE_FEEDBACK_HTML = new Set([
  "<p>Bonne réponse.</p>",
  "<p>Ce choix peut être amélioré.</p>"
]);

function normalizeSituationalDialogueSequenceContentHtml(value?: string | null) {
  const html = value ?? "<p></p>";
  return LEGACY_SITUATIONAL_DIALOGUE_SEQUENCE_CONTENT_HTML.has(html.trim()) ? "<p></p>" : html;
}

function normalizeSituationalDialogueResponseLabel(value?: string | null) {
  const label = value ?? "";
  return /^Choix\s+\d+$/i.test(label.trim()) ? "" : label;
}

function normalizeSituationalDialogueResponseFeedbackHtml(value?: string | null) {
  const html = value ?? "<p></p>";
  return LEGACY_SITUATIONAL_DIALOGUE_RESPONSE_FEEDBACK_HTML.has(html.trim()) ? "<p></p>" : html;
}

function normalizeSituationalDialoguePoseRefs(value?: ActivityItem["situationalDialoguePoseRefs"]) {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, assetRef]) => typeof assetRef === "string" && assetRef.trim())
  );
}

export function createDefaultSituationalDialogueResponse(
  order: number,
  action: SituationalDialogueResponse["action"] = "continue"
): SituationalDialogueResponse {
  return {
    id: `situational_dialogue_response_${Date.now()}_${order}`,
    label: "",
    feedbackHtml: "<p></p>",
    action,
    emotion: null,
    nextNodeId: null
  };
}

export function createDefaultSituationalDialogueConclusionItem(): ActivityItem {
  return {
    id: `situational_dialogue_conclusion_${Date.now()}`,
    title: translateActive("situationalDialogue.conclusion"),
    nodeType: "conclusion",
    characterId: null,
    characterName: "",
    characterRole: "",
    emotion: "neutral",
    nextNodeId: null,
    responses: [],
    contentHtml: "<p></p>",
    assetRefs: [],
    situationalDialoguePoseRefs: {},
    mediaFileName: null,
    mediaLayout: "situational-dialogue",
    imageRounded: false,
    imageCrop: null
  };
}

export function createDefaultSituationalDialogueIntroductionItem(): ActivityItem {
  return {
    id: `situational_dialogue_introduction_${Date.now()}`,
    title: translateActive("situationalDialogue.introduction"),
    nodeType: "introduction",
    characterId: null,
    characterName: "",
    characterRole: "",
    emotion: "neutral",
    nextNodeId: null,
    responses: [],
    contentHtml: "<p></p>",
    assetRefs: [],
    situationalDialoguePoseRefs: {},
    mediaFileName: null,
    mediaLayout: "situational-dialogue",
    imageRounded: false,
    imageCrop: null
  };
}

export function createDefaultSituationalDialogueItem(order: number): ActivityItem {
  return {
    id: `situational_dialogue_node_${Date.now()}_${order}`,
    title: translateActive("situationalDialogue.sequenceNumber", { number: order }),
    nodeType: order === 1 ? "situation" : "dialogue",
    characterId: null,
    characterName: "",
    characterRole: "",
    emotion: "neutral",
    nextNodeId: null,
    responses:
      order === 1
        ? [createDefaultSituationalDialogueResponse(1, "continue"), createDefaultSituationalDialogueResponse(2, "tryAgain")]
        : [],
    contentHtml: "<p></p>",
    assetRefs: [],
    situationalDialoguePoseRefs: {},
    mediaFileName: null,
    mediaLayout: "situational-dialogue",
    imageRounded: false,
    imageCrop: null
  };
}

export function isSituationalDialogueConclusionItem(item: ActivityItem | null | undefined) {
  return Boolean(item && (item.nodeType === "conclusion" || item.title.trim().toLowerCase() === "conclusion"));
}

export function isSituationalDialogueIntroductionItem(item: ActivityItem | null | undefined) {
  return Boolean(item && (item.nodeType === "introduction" || item.title.trim().toLowerCase() === "introduction"));
}

export function normalizeSituationalDialogueActivityItems(items: ActivityItem[]) {
  const sequences: ActivityItem[] = [];
  items.forEach((item, index) => {
    if (isSituationalDialogueIntroductionItem(item) || isSituationalDialogueConclusionItem(item)) {
      return;
    }

    sequences.push({
      ...item,
      title: item.title?.trim() || translateActive("situationalDialogue.sequenceNumber", { number: index + 1 }),
      nodeType:
        item.nodeType === "situation" || item.nodeType === "dialogue"
          ? item.nodeType
          : index === 0
            ? "situation"
            : "dialogue",
      characterId: item.characterId ?? null,
      characterName: item.characterName ?? "",
      characterRole: item.characterRole ?? "",
      situationalDialoguePoseRefs: normalizeSituationalDialoguePoseRefs(item.situationalDialoguePoseRefs),
      emotion: item.emotion ?? "neutral",
      nextNodeId: item.nextNodeId ?? null,
      contentHtml: normalizeSituationalDialogueSequenceContentHtml(item.contentHtml),
      responses: normalizeSituationalDialogueResponses(item)
    });
  });

  const introduction = items.find((item) => isSituationalDialogueIntroductionItem(item)) ?? createDefaultSituationalDialogueIntroductionItem();
  const conclusion = items.find((item) => isSituationalDialogueConclusionItem(item)) ?? createDefaultSituationalDialogueConclusionItem();
  return [
    {
      ...introduction,
      title: translateActive("situationalDialogue.introduction"),
      nodeType: "introduction",
      situationalDialoguePoseRefs: normalizeSituationalDialoguePoseRefs(introduction.situationalDialoguePoseRefs),
      nextNodeId: null,
      responses: []
    },
    ...sequences,
    {
      ...conclusion,
      title: translateActive("situationalDialogue.conclusion"),
      nodeType: "conclusion",
      situationalDialoguePoseRefs: normalizeSituationalDialoguePoseRefs(conclusion.situationalDialoguePoseRefs),
      nextNodeId: null,
      responses: []
    }
  ];
}

export function normalizeSituationalDialogueResponses(item: ActivityItem): SituationalDialogueResponse[] {
  const seenIds = new Set<string>();
  return (item.responses ?? []).map((response, index) => {
    const baseId = response.id?.trim() || `situational_dialogue_response_${item.id}_${index + 1}`;
    let resolvedId = baseId;
    let duplicateIndex = 2;
    while (seenIds.has(resolvedId)) {
      resolvedId = `${baseId}_${duplicateIndex}`;
      duplicateIndex += 1;
    }
    seenIds.add(resolvedId);

    return {
      id: resolvedId,
      label: normalizeSituationalDialogueResponseLabel(response.label),
      feedbackHtml: normalizeSituationalDialogueResponseFeedbackHtml(response.feedbackHtml),
      action: response.action === "tryAgain" ? "tryAgain" : "continue",
      emotion: response.emotion ?? null,
      nextNodeId: response.nextNodeId ?? null
    };
  });
}
