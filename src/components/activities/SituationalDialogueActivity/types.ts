import type { CSSProperties, ReactNode } from "react";
import type {
  ActivityItem,
  SituationalDialogueCharacter,
  SituationalDialogueCharacterPose,
  SituationalDialogueFraming,
  SituationalDialogueResponse
} from "../../../types/project";

export type DefaultSituationalDialogueCharacterPoseDefinition = {
  state: "question" | "neutral" | "positive" | "negative" | string;
  label?: string;
  assetRef: string;
};

export type DefaultSituationalDialogueCharacterDefinition = {
  resourceModifiedAt?: number | null;
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  poses: DefaultSituationalDialogueCharacterPoseDefinition[];
};

export type SituationalDialogueRichTextFieldRenderOptions = {
  item: ActivityItem;
  field: string;
  html: string;
  label: string;
  minRows?: "compact" | "medium" | "large";
  className?: string;
  placeholder?: string;
};

export type SituationalDialogueActivityProps = {
  authoringMode?: boolean;
  bannerTitleHtml: string;
  bannerBackgroundColor?: string | null;
  layout: string;
  buttonBackgroundColor?: string | null;
  displaySummary: string;
  items: ActivityItem[];
  activeNode: ActivityItem | null;
  activeNodeIndex: number;
  responses: SituationalDialogueResponse[];
  pendingResponse: SituationalDialogueResponse | null;
  selectedResponse: SituationalDialogueResponse | null;
  resolveCharacterImage: (node: ActivityItem, response: SituationalDialogueResponse | null) => {
    image: string | null;
    imageRef: string | null;
  };
  characterFraming?: SituationalDialogueFraming[];
  onCharacterFramingChange?: (framing: SituationalDialogueFraming) => void;
  situationalDialogueCharacters: SituationalDialogueCharacter[];
  hasSituationalDialogueCardContent: boolean;
  hasCustomBackground: boolean;
  hasBackgroundImage: boolean;
  backgroundPositionY?: number | null;
  rounded: boolean;
  wide: boolean;
  style?: CSSProperties;
  normalizeHtml: (html: string) => string;
  onActiveNodeChange: (nodeId: string) => void;
  onPendingResponseChange: (responseId: string) => void;
  onSelectedResponseChange: (responseId: string) => void;
  onComplete?: () => void;
  onBackgroundPositionChange?: (value: number) => void;
};

export type SituationalDialogueCharacterBankEditorProps = {
  imageAccept: string;
  characters: SituationalDialogueCharacter[];
  defaultCharacters: DefaultSituationalDialogueCharacterDefinition[];
  userCharacters: DefaultSituationalDialogueCharacterDefinition[];
  selectedDefaultCharacterId: string;
  selectedUserCharacterId: string;
  onSelectedDefaultCharacterChange: (value: string) => void;
  onSelectedUserCharacterChange: (value: string) => void;
  onImportDefaultCharacter: () => void;
  onImportUserCharacter: () => void;
  onUpdateCharacter: (characterId: string, patch: Partial<SituationalDialogueCharacter>) => void;
  onUpdatePose: (
    characterId: string,
    poseId: string,
    patch: Partial<SituationalDialogueCharacterPose>
  ) => void;
  onUploadPose: (characterId: string, poseId: string, file: File) => void;
  onRemovePose: (characterId: string, poseId: string) => void;
  onAddPose: (characterId: string, usage: SituationalDialogueCharacterPose["usage"]) => void;
  onRemoveCharacter: (characterId: string) => void;
  getDefaultPoseOptions: (
    character: SituationalDialogueCharacter,
    pose: SituationalDialogueCharacterPose
  ) => DefaultSituationalDialogueCharacterPoseDefinition[];
  isDefaultAssetRef: (assetRef?: string | null) => boolean;
  getAssetDisplayName: (assetRef?: string | null) => string;
  getAssetUrl: (assetRef?: string | null) => string | null;
};

export type SituationalDialogueItemEditorProps = {
  item: ActivityItem;
  isIntroduction: boolean;
  isConclusion: boolean;
  sequenceNumber: number;
  characters: SituationalDialogueCharacter[];
  imageAccept: string;
  imageName: string;
  imagePreview: ReactNode;
  responses: SituationalDialogueResponse[];
  onUpdateItem: (patch: Partial<ActivityItem>) => void;
  onAssignCharacter: (characterId: string) => void;
  onUploadImage: (file: File) => void;
  onAddResponse: () => void;
  onUpdateResponse: (responseId: string, patch: Partial<SituationalDialogueResponse>) => void;
  onRemoveResponse: (responseId: string) => void;
  renderRichTextField: (options: SituationalDialogueRichTextFieldRenderOptions) => ReactNode;
};
