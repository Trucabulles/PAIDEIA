import type {
  ActivityItem,
  PaideiaBlock,
  SituationalDialogueCharacter,
  SituationalDialogueCharacterPose,
  SituationalDialogueResponse
} from "../../../types/project";
import type {
  DefaultSituationalDialogueCharacterDefinition,
  DefaultSituationalDialogueCharacterPoseDefinition
} from "./types";

import { translateActive } from "../../../i18n";

const DEFAULT_SITUATIONAL_DIALOGUE_CHARACTER_ASSET_ROOT = "default-characters/";
const SITUATIONAL_DIALOGUE_POSE_STATE_ORDER = ["introduction", "question", "neutral", "positive", "negative", "conclusion"] as const;
const IMAGE_ASSET_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff"]);

function getAssetExtension(assetRef?: string | null) {
  return assetRef?.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
}

function firstItemImageAssetRef(item: ActivityItem | null | undefined) {
  if (!item) {
    return null;
  }
  return item.assetRefs?.find((assetRef) => IMAGE_ASSET_EXTENSIONS.has(getAssetExtension(assetRef))) ?? null;
}

export function createDefaultSituationalDialogueCharacterPose(
  order: number,
  usage: SituationalDialogueCharacterPose["usage"] = "question"
): SituationalDialogueCharacterPose {
  const state =
    usage === "introduction"
      ? "introduction"
      : usage === "question"
        ? "question"
        : usage === "conclusion"
          ? "conclusion"
          : usage === "neutral"
            ? "neutral"
            : "neutral";
  return {
    id: `situational_dialogue_character_pose_${Date.now()}_${order}`,
    label: translateActive("situationalDialogue.poseLabel", { detail: translateActive(
      usage === "question"
        ? "resources.poseQuestion"
        : usage === "response"
          ? "situationalDialogue.response"
          : "resources.poseNeutral"
    ) }),
    state,
    usage,
    emotion: usage === "question" ? "neutral" : null,
    assetRef: null
  };
}

export function createDefaultSituationalDialogueCharacter(order: number): SituationalDialogueCharacter {
  return {
    id: `situational_dialogue_character_${Date.now()}_${order}`,
    name: "",
    defaultCharacterId: null,
    role: "",
    description: null,
    showNameRole: true,
    backgroundRef: null,
    defaultPoseId: null,
    poses: [createDefaultSituationalDialogueCharacterPose(1, "question")]
  };
}

export function normalizeSituationalDialoguePoseState(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (["introduction", "intro", "start", "opening"].includes(normalized)) {
    return "introduction";
  }
  if (["conclusion", "summary", "ending", "end"].includes(normalized)) {
    return "conclusion";
  }
  if (["question", "prompt", "situation", "asking"].includes(normalized)) {
    return "question";
  }
  if (["positive", "happy", "content", "correct", "success"].includes(normalized)) {
    return "positive";
  }
  if (["negative", "unhappy", "disappointed", "incorrect", "error", "wrong"].includes(normalized)) {
    return "negative";
  }
  if (["neutral", "default", "response"].includes(normalized)) {
    return "neutral";
  }
  return normalized;
}

function SituationalDialoguePoseLabel(state: string, fallback?: string | null) {
  return (
    fallback ??
    (state === "introduction"
      ? "Pose introduction"
      : state === "conclusion"
        ? "Pose conclusion"
        : state === "question"
          ? "Pose question"
          : state === "positive"
            ? "Pose positive"
            : state === "negative"
              ? "Pose négative"
              : "Pose neutre")
  );
}

function SituationalDialoguePoseUsage(state: string): SituationalDialogueCharacterPose["usage"] {
  if (state === "introduction" || state === "question" || state === "conclusion" || state === "neutral") {
    return state;
  }
  return "response";
}

function SituationalDialoguePoseEmotion(state: string) {
  return state === "positive" ? "happy" : state === "negative" ? "disappointed" : "neutral";
}

export function createSituationalDialogueCharacterFromDefaultDefinition(
  definition: DefaultSituationalDialogueCharacterDefinition,
  order: number
): SituationalDialogueCharacter {
  const poses = SITUATIONAL_DIALOGUE_POSE_STATE_ORDER
    .map((state) => definition.poses.find((pose) => normalizeSituationalDialoguePoseState(pose.state) === state))
    .filter((pose): pose is DefaultSituationalDialogueCharacterPoseDefinition => Boolean(pose))
    .map((pose, poseIndex) => ({
      id: `situational_dialogue_character_pose_${Date.now()}_${order}_${poseIndex + 1}`,
      label: SituationalDialoguePoseLabel(pose.state, pose.label),
      state: pose.state,
      usage: SituationalDialoguePoseUsage(pose.state),
      emotion: SituationalDialoguePoseEmotion(pose.state),
      assetRef: pose.assetRef
    }));

  return {
    id: `situational_dialogue_character_${Date.now()}_${order}`,
    name: definition.name,
    defaultCharacterId: definition.id,
    role: definition.role ?? "",
    description: definition.description ?? null,
    showNameRole: true,
    backgroundRef: null,
    defaultPoseId: poses[0]?.id ?? null,
    poses
  };
}

function isDefaultSituationalDialogueCharacterPlaceholderName(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized || /^personnage\s+\d+$/.test(normalized);
}

function isDefaultSituationalDialogueCharacterPlaceholderRole(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized || normalized === "rôle ou métier" || normalized === "role ou métier";
}

function createSituationalDialogueCharacterPoseFromDefaultDefinition(
  characterId: string,
  state: string,
  order: number,
  pose: DefaultSituationalDialogueCharacterPoseDefinition
): SituationalDialogueCharacterPose {
  return {
    id: `situational_dialogue_character_pose_${characterId}_${state}_${order}`,
    label: SituationalDialoguePoseLabel(state, pose.label),
    state,
    usage: SituationalDialoguePoseUsage(state),
    emotion: SituationalDialoguePoseEmotion(state),
    assetRef: pose.assetRef
  };
}

export function SituationalDialoguePoseMatchesState(pose: SituationalDialogueCharacterPose, state: string) {
  const poseState = normalizeSituationalDialoguePoseState(pose.state);
  return poseState === state;
}

export function synchronizeSituationalDialogueCharacterWithDefaultDefinition(
  character: SituationalDialogueCharacter,
  definition: DefaultSituationalDialogueCharacterDefinition
): SituationalDialogueCharacter {
  const defaultPosesByState = new Map<string, DefaultSituationalDialogueCharacterPoseDefinition>();

  SITUATIONAL_DIALOGUE_POSE_STATE_ORDER.forEach((state) => {
    const defaultPose = definition.poses.find((pose) => normalizeSituationalDialoguePoseState(pose.state) === state);
    if (defaultPose) {
      defaultPosesByState.set(state, defaultPose);
    }
  });

  const nextPoses: SituationalDialogueCharacterPose[] = [];
  SITUATIONAL_DIALOGUE_POSE_STATE_ORDER.forEach((state) => {
    const defaultPose = defaultPosesByState.get(state);
    if (!defaultPose) {
      return;
    }
    const currentPose = (character.poses ?? []).find(
      (pose) => normalizeSituationalDialoguePoseState(pose.state) === state
    );
    nextPoses.push({
      ...(currentPose ?? createSituationalDialogueCharacterPoseFromDefaultDefinition(
        character.id || `situational_dialogue_character_${Date.now()}`,
        state,
        nextPoses.length + 1,
        defaultPose
      )),
      label: SituationalDialoguePoseLabel(state, defaultPose.label),
      state,
      usage: SituationalDialoguePoseUsage(state),
      emotion: SituationalDialoguePoseEmotion(state),
      assetRef: defaultPose.assetRef
    });
  });

  return {
    ...character,
    name: isDefaultSituationalDialogueCharacterPlaceholderName(character.name) ? definition.name : character.name,
    defaultCharacterId: definition.id,
    role: isDefaultSituationalDialogueCharacterPlaceholderRole(character.role) ? definition.role ?? "" : character.role ?? "",
    defaultPoseId: nextPoses.some((pose) => pose.id === character.defaultPoseId)
      ? character.defaultPoseId
      : nextPoses[0]?.id ?? null,
    poses: nextPoses
  };
}

export function isDefaultSituationalDialogueCharacterAssetRef(assetRef?: string | null) {
  return Boolean(assetRef && assetRef.replace(/\\/g, "/").startsWith(DEFAULT_SITUATIONAL_DIALOGUE_CHARACTER_ASSET_ROOT));
}

export function extractDefaultSituationalDialogueCharacterIdFromAssetRef(assetRef?: string | null) {
  if (!isDefaultSituationalDialogueCharacterAssetRef(assetRef)) {
    return null;
  }
  const normalized = (assetRef ?? "").replace(/\\/g, "/");
  const relative = normalized.slice(DEFAULT_SITUATIONAL_DIALOGUE_CHARACTER_ASSET_ROOT.length);
  const [characterId] = relative.split("/");
  return characterId?.trim() || null;
}

export function resolveSituationalDialogueCharacterDefaultCharacterId(character: SituationalDialogueCharacter) {
  if (character.defaultCharacterId?.trim()) {
    return character.defaultCharacterId.trim();
  }
  for (const pose of character.poses ?? []) {
    const characterId = extractDefaultSituationalDialogueCharacterIdFromAssetRef(pose.assetRef);
    if (characterId) {
      return characterId;
    }
  }
  return null;
}

export function normalizeSituationalDialogueCharacters(characters: SituationalDialogueCharacter[] | undefined | null): SituationalDialogueCharacter[] {
  return (characters ?? []).map((character, index) => ({
    id: character.id || `situational_dialogue_character_${index + 1}`,
    name: character.name ?? "",
    defaultCharacterId:
      character.defaultCharacterId ??
      (character.poses ?? [])
        .map((pose) => extractDefaultSituationalDialogueCharacterIdFromAssetRef(pose.assetRef))
        .find(Boolean) ??
      null,
    role: character.role ?? "",
    description: character.description ?? null,
    showNameRole: character.showNameRole ?? true,
    backgroundRef: character.backgroundRef ?? null,
    defaultPoseId: character.defaultPoseId ?? null,
    poses: (character.poses ?? []).map((pose, poseIndex) => ({
      id: pose.id || `situational_dialogue_character_pose_${character.id || index + 1}_${poseIndex + 1}`,
      label: pose.label || translateActive("situationalDialogue.poseLabel", { detail: poseIndex + 1 }),
      state: pose.state ?? null,
      usage: pose.usage ?? null,
      emotion: pose.emotion ?? null,
      assetRef: pose.assetRef ?? null
    }))
  }));
}

function findSituationalDialogueCharacter(block: PaideiaBlock | null | undefined, item: ActivityItem | null | undefined) {
  const characters = normalizeSituationalDialogueCharacters(block?.situationalDialogueCharacters ?? []);
  if (!characters.length) {
    return null;
  }
  const byId = item?.characterId ? characters.find((character) => character.id === item.characterId) : null;
  if (byId) {
    return byId;
  }
  const itemName = item?.characterName?.trim().toLowerCase();
  if (itemName) {
    const byName = characters.find((character) => character.name.trim().toLowerCase() === itemName);
    if (byName) {
      return byName;
    }
  }
  return characters[0] ?? null;
}

function resolveSituationalDialoguePoseState(
  item: ActivityItem | null | undefined,
  response: SituationalDialogueResponse | null | undefined
) {
  if (response) {
    return response.action === "tryAgain" ? "negative" : "positive";
  }
  if (item?.nodeType === "introduction") {
    return "introduction";
  }
  if (item?.nodeType === "conclusion") {
    return "conclusion";
  }
  if (item?.nodeType === "situation") {
    return "question";
  }
  if ((item?.responses?.length ?? 0) > 0) {
    return "question";
  }
  return "neutral";
}

export function resolveSituationalDialogueCharacterAssetRef(
  block: PaideiaBlock | null | undefined,
  item: ActivityItem | null | undefined,
  response: SituationalDialogueResponse | null | undefined
) {
  const character = findSituationalDialogueCharacter(block, item);
  if (!character) {
    return firstItemImageAssetRef(item);
  }

  const targetState = resolveSituationalDialoguePoseState(item, response);
  const selectedPoseRef = item?.situationalDialoguePoseRefs?.[targetState]?.trim();
  if (selectedPoseRef) {
    const selectedPose = character.poses.find(
      (candidate) => candidate.assetRef === selectedPoseRef && SituationalDialoguePoseMatchesState(candidate, targetState)
    );
    if (selectedPose?.assetRef) {
      return selectedPose.assetRef;
    }
  }
  const fallbackStates =
    targetState === "positive" || targetState === "negative"
      ? [targetState, "neutral", "question"]
      : targetState === "introduction"
        ? ["introduction", "question", "neutral", "positive", "negative", "conclusion"]
        : targetState === "conclusion"
          ? ["conclusion", "neutral", "question", "positive", "negative", "introduction"]
          : targetState === "question"
            ? ["question", "neutral", "positive", "negative"]
            : ["neutral", "question", "positive", "negative"];
  const pose = fallbackStates
    .flatMap((state) => character.poses.find((candidate) => SituationalDialoguePoseMatchesState(candidate, state)) ?? [])
    .find(Boolean);
  return pose?.assetRef ?? character.backgroundRef ?? firstItemImageAssetRef(item);
}
