import type {
  Dispatch,
  FormEvent,
  CSSProperties,
  MutableRefObject,
  ReactNode,
  SetStateAction
} from "react";
import type {
  ActivityItemEditorRichTextField,
  BlockFormState,
  FindElementsZoneRichTextField,
  Image360HotspotInlineField,
  PointOfInterestMarkerRichTextField,
  PendingBlockMediaDraftState
} from "../../app/appStateTypes";
import {
  assetDisplayName,
  firstAssetRef,
  firstItemAudioAssetRef,
  firstItemImageAssetRef,
  getAssetPickerAccept,
  isSupportedAudioAsset,
  isSupportedImageAsset,
  isSupportedVideoAsset
} from "../../app/mediaAssets";
import { buildAssetUrl, withAssetReloadKey } from "../../app/assetUrls";
import { activityBackgroundWideDefault, isActivityBackgroundAlwaysWide, supportsActivityBackground, supportsActivityBackgroundProperty } from "../../app/activityAppearanceCapabilities";
import { normalizeHexColor, resolveContextualTextColor } from "../../app/textContrast";
import type {
  ActivityItem,
  ImageCrop,
  PointOfInterestMarker,
  NativeImageAnnotationDocument,
  PaideiaBlock,
  QuestionBankResource,
  QuizActivityData,
  FindElementsZone,
  SituationalDialogueCharacter,
  SituationalDialogueCharacterPose,
  SituationalDialogueResponse
} from "../../types/project";
import { useI18n } from "../../i18n/react";
import { normalizeAudioTracks } from "../activities/AudioActivity";
import { defaultCustomHtmlContent } from "../activities/HtmlCustomActivity";
import { DEFAULT_IMAGE360_ASSET } from "../activities/Image360Activity";
import type { DefaultSituationalDialogueCharacterPoseDefinition } from "../activities/SituationalDialogueActivity";
import {
  isDefaultSituationalDialogueCharacterAssetRef,
  normalizeSituationalDialogueActivityItems
} from "../activities/SituationalDialogueActivity";
import type { TabsRichTextFieldName } from "../activities/TabsActivity";
import type { QuizRichTextFieldParams } from "../activities/QuizActivity";
import { isStandaloneQuestionType, STANDALONE_QUESTION_MODES } from "../activities/QuizActivity/standaloneQuestions";
import { StandaloneQuestionEditor } from "../activities/QuizActivity/StandaloneQuestionEditor";
import { RandomQuestionsEditor } from "../activities/QuizActivity/RandomQuestionsEditor";
import {
  AuthoringImageMediaEditor,
  ActivityFrameAppearanceControls,
  NativeImageAnnotationAccessIcon,
  NativeImageAnnotationTool
} from "../authoring";
import { CropIcon } from "../app/AppIcons";
import { ImageAltBadge } from "../app/ImageAltBadge";
import { CroppedImage } from "../app/CroppedImage";
import { RichTextToolbar, type RichTextToolbarFontOption, type RichTextToolbarProfile } from "../rich-text-toolbar/RichTextToolbar";
import {
  AccordionInlineBlockEditor,
  FlipCardsInlineBlockEditor,
  SlidesInlineBlockEditor,
  TabsInlineBlockEditor
} from "./ItemInlineBlockEditors";
import {
  AudioInlineBlockEditor,
  Image360InlineBlockEditor,
  VideoInlineBlockEditor
} from "./MediaInlineBlockEditors";
import {
  PointOfInterestInlineBlockEditor,
  SituationalDialogueInlineBlockEditor
} from "./AdvancedInlineBlockEditors";
import { InlineBlockEditorActions } from "./InlineBlockEditorActions";
import { ActivityBackgroundAppearance } from "./ActivityBackgroundAppearance";
import { DialogueAppearance } from "../activities/SituationalDialogueActivity/SituationalDialogueAppearance";
import { ActivityEditorTabs } from "./ActivityEditorTabs";
import { QuizInlineBlockEditor } from "./QuizInlineBlockEditor";
import { ImageGridActivityEditor } from "../activities/ImageGridActivity";
import { FindElementsActivityEditor, normalizeFindElementsData } from "../activities/FindElementsActivity";
import { CompleteActivityEditor, normalizeCompleteData, type CompleteContentRichTextFieldOptions } from "../activities/CompleteActivity";
import { CardSortActivityEditor, normalizeCardSortData, normalizeCardSortItems } from "../activities/CardSortActivity";
import { MatchingActivityEditor, normalizeMatchingData, type MatchingRichField } from "../activities/MatchingActivity";
import { SimpleInlineBlockEditors } from "./SimpleInlineBlockEditors";
import { DividerEditorPanel, SectionMarkerEditorPanel } from "./SimpleActivityEditorPanels";
import { StructuredInlineBlockEditors } from "./StructuredInlineBlockEditors";
import {
  deriveInlineBlockEditorMedia,
  normalizeImageSizeToken
} from "./inlineBlockEditorMedia";
import { headerBannerStyle } from "../activities/HeaderActivity";
import { TranscriptAuthoringControls } from "../transcript";

const SIMPLE_ACTIVITY_BACKGROUND_TAB_TYPES = new Set([
  "html-custom",
  "continue",
  "course-exit",
  "note",
  "result-message",
  "attachment",
  "links-resources"
]);

type ActivityAppearanceTabsProps = {
  activityLabel: string;
  appearanceLabel: string;
  appearancePanel: ReactNode;
  children: ReactNode;
  enabled: boolean;
  sessionKey: string;
};

function ActivityAppearanceTabs({
  activityLabel,
  appearanceLabel,
  appearancePanel,
  children,
  enabled,
  sessionKey
}: ActivityAppearanceTabsProps) {
  return enabled ? (
    <ActivityEditorTabs
      activityLabel={activityLabel}
      activityPanel={children}
      appearanceLabel={appearanceLabel}
      appearancePanel={appearancePanel}
      sessionKey={sessionKey}
    />
  ) : (
    <>{children}</>
  );
}

type InlineBlockEditorModel = {
  blockForm: BlockFormState;
  blockFormRef: MutableRefObject<BlockFormState>;
  busyAction: string | null;
  courseBackgroundColor: string;
  courseShadows: boolean;
  courseTextColor: string;
  currentProjectPath: string;
  htmlCodeScrollTop: number;
  htmlPackageImportPending: boolean;
  pendingBlockMediaDraft: PendingBlockMediaDraftState | null;
  quizAutomaticTitle: string;
  quizOptions: Array<{ id: string; label: string }>;
  selectedBlock: PaideiaBlock | null;
  sectionMarkerFontSize?: string;
  sectionMarkerLabel?: string;
  textColor: string;
  videoOptimizationAvailable: boolean;
  subtitleGenerationConfiguration: {
    ready: boolean;
    enginePath: string;
    smallModelPath: string;
    mediumModelPath: string;
    smallAvailable: boolean;
    mediumAvailable: boolean;
    defaultLanguage: string;
  };
  onVideoWorkspaceChange: (workspace: import("../../types/project").PaideiaWorkspaceState) => void;
};

type InlineBlockEditorMedia = {
  activeBlockImageAnnotationId: string | null;
  blockImageAnnotationDocuments: Record<string, NativeImageAnnotationDocument>;
  blockImageAnnotationSourceRefs: Record<string, string>;
  draftImageCrop: ImageCrop | null;
  image360CurrentView: { yaw: number; pitch: number };
  image360MediaReloadKey: number;
  isCropMode: boolean;
  applyBlockImageAnnotation: () => Promise<void>;
  applyImageCrop: () => Promise<void>;
  cancelImageCrop: () => void;
  closeBlockImageAnnotation: () => void;
  handleUploadActivityBackground: (file: File) => Promise<void>;
  handleUploadSelectedBlockAsset: (file: File, assetRole: "media" | "subtitle" | "subtitle-edit") => Promise<void>;
  handleUploadSelectedVideoPath: (sourcePath: string) => Promise<void>;
  removeSelectedBlockImage: () => Promise<void>;
  removeSelectedVideoMedia: () => Promise<void>;
  removeSelectedVideoSubtitle: () => Promise<void>;
  setDraftImageCrop: Dispatch<SetStateAction<ImageCrop | null>>;
  setIsAnnotationCommitRunning: Dispatch<SetStateAction<boolean>>;
  toggleBlockImageAnnotation: () => Promise<void>;
  toggleSelectedBlockCrop: () => Promise<void>;
  updateBlockImageAnnotation: (
    blockId: string,
    sourceAssetRef: string,
    document: NativeImageAnnotationDocument,
    renderedDataUrl?: string | null
  ) => Promise<void>;
};

type InlineBlockEditorItems = {
  activeActivityItemAnnotationId: string | null;
  activeActivityItemCropId: string | null;
  activityItemAnnotationDocuments: Record<string, NativeImageAnnotationDocument>;
  collapsedActivityItemIds: string[];
  addActivityItem: () => void;
  applyActivityItemAnnotation: () => Promise<void>;
  applyActivityItemCrop: () => Promise<void>;
  beginActivityItemCrop: (item: ActivityItem, face?: "front" | "back") => void;
  cancelActivityItemCrop: () => void;
  closeActivityItemAnnotation: () => void;
  duplicateActivityItem: (itemId: string) => void;
  handleUploadActivityItemAsset: (itemId: string, file: File, face?: "front" | "back") => Promise<void>;
  moveActivityItem: (itemId: string, direction: -1 | 1) => void;
  removeActivityItemImage: (itemId: string) => void;
  removeActivityItem: (itemId: string) => void;
  toggleActivityItemAnnotation: (item: ActivityItem) => Promise<void>;
  toggleActivityItemCollapse: (itemId: string) => void;
  updateActivityItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  editActivityItemImageAlt: (itemId: string, face?: "front" | "back") => void;
  editBlockImageAlt: () => void;
  updateActivityItemAnnotation: (
    itemId: string,
    sourceAssetRef: string,
    document: NativeImageAnnotationDocument,
    renderedDataUrl?: string | null
  ) => Promise<void>;
};

type InlineBlockEditorRichText = {
  richEditorRef: MutableRefObject<HTMLDivElement | null>;
  applyCaseTransform: (mode: "upper" | "lower" | "capitalize") => void;
  applyEditorFontFamily: (fontFamily: string) => Promise<void>;
  applyEditorFontSize: (fontSizePx: string) => void;
  richToolbarFontFamily: string;
  richTextFontOptions: RichTextToolbarFontOption[];
  applyEditorLineHeight: (lineHeight: string) => void;
  applyEditorTextColor: (color: string) => void;
  applyEditorTextHighlight: (color: string) => void;
  applyEditorFieldFill: (color: string) => void;
  applyEditorFieldFillOpacity: (opacity: number) => void;
  openCreateRichTextBookmark: () => void;
  openInsertRichTextReference: () => void;
  canInsertRichTextReference: boolean;
  richFieldFill: string;
  richFieldFillOpacity: number;
  textHighlightColor: string;
  applyLink: () => void;
  clearRichEditorFormatting: () => void;
  handleRichEditorBeforeInput: (event: FormEvent<HTMLDivElement>, editor: HTMLDivElement) => boolean;
  handleRichEditorLiveInput: (editor: HTMLDivElement, html: string) => void;
  insertRichEditorInlineImage: (file: File) => Promise<void>;
  renderCompleteContentField: (options: CompleteContentRichTextFieldOptions & { block: PaideiaBlock }) => ReactNode;
  renderCompleteCoverRichTextFieldForBlock: (options: {
    block: PaideiaBlock;
    field: "titleHtml" | "descriptionHtml" | "successHtml" | "failureHtml";
    html: string;
    label: string;
    placeholder: string;
  }) => ReactNode;
  renderCardSortRichTextFieldForBlock?: (options: {
    block: PaideiaBlock;
    field: "successFeedbackHtml" | "failureFeedbackHtml" | "categoryLabelHtml";
    categoryId?: string;
    html: string;
    label: string;
    placeholder: string;
  }) => ReactNode;
  renderMatchingRichTextFieldForBlock?: (options: {
    block: PaideiaBlock;
    field: MatchingRichField;
    html: string;
    pairId?: string;
    label: string;
    placeholder: string;
  }) => ReactNode;
  renderActivityItemEditorRichTextFieldForBlock: (options: {
    block: PaideiaBlock;
    className?: string;
    field: ActivityItemEditorRichTextField;
    html: string;
    item: ActivityItem;
    label: string;
    placeholder: string;
  }) => ReactNode;
  renderFindElementsZoneRichTextFieldForBlock: (options: {
    block: PaideiaBlock;
    className?: string;
    field: FindElementsZoneRichTextField;
    html: string;
    label: string;
    placeholder: string;
    zone: FindElementsZone;
  }) => ReactNode;
  renderInlineImage360HotspotFieldForBlock: (options: {
    block: PaideiaBlock;
    hotspotId: string;
    field: Image360HotspotInlineField;
    html: string;
    className?: string;
    label: string;
    onCommit: (html: string) => void;
    placeholder: string;
  }) => ReactNode;
  renderInlineSituationalDialogueItemFieldForBlock: (
    block: PaideiaBlock,
    item: ActivityItem,
    field: string,
    html: string,
    className: string,
    profile: RichTextToolbarProfile,
    placeholder?: string
  ) => ReactNode;
  renderPointOfInterestMarkerRichTextFieldForBlock: (options: {
    block: PaideiaBlock;
    className?: string;
    field: PointOfInterestMarkerRichTextField;
    html: string;
    label: string;
    marker: PointOfInterestMarker;
    placeholder: string;
  }) => ReactNode;
  renderQuizRichTextField: (params: QuizRichTextFieldParams) => ReactNode;
  renderQuoteAuthorEditorRichTextFieldForBlock: (block: PaideiaBlock, html: string) => ReactNode;
  renderDialogueBannerTitleField: (block: PaideiaBlock, html: string) => ReactNode;
  renderCourseExitRichTextFieldForBlock: (block: PaideiaBlock, html: string) => ReactNode;
  renderTabsEditorRichTextFieldForBlock: (options: {
    block: PaideiaBlock;
    className?: string;
    field: TabsRichTextFieldName;
    html: string;
    item: ActivityItem;
    label: string;
    placeholder: string;
  }) => ReactNode;
  runEditorCommand: (command: string, value?: string) => void;
  saveRealRichEditorSelection: () => void;
  saveRichEditorSelection: () => void;
  selectAllRichEditorText: () => void;
  syncRichEditorHtml: () => void;
};

type InlineBlockEditorSituationalDialogue = {
  SituationalDialogueBankCharacters: Array<{
    id: string;
    name: string;
    role?: string | null;
    description?: string | null;
    poses: DefaultSituationalDialogueCharacterPoseDefinition[];
  }>;
  selectedDefaultSituationalDialogueCharacterId: string;
  selectedSituationalDialogueBankCharacterId: string;
  addDefaultSituationalDialogueCharacter: () => void;
  addSituationalDialogueBankCharacter: () => Promise<void>;
  addSituationalDialogueCharacterPose: (characterId: string, usage?: SituationalDialogueCharacterPose["usage"]) => void;
  addSituationalDialogueResponse: (itemId: string) => void;
  assignSituationalDialogueCharacterToItem: (itemId: string, characterId: string) => void;
  getSituationalDialogueDefaultPoseOptions: (
    character: SituationalDialogueCharacter,
    pose: SituationalDialogueCharacterPose
  ) => DefaultSituationalDialogueCharacterPoseDefinition[];
  handleUploadSituationalDialogueCharacterPose: (characterId: string, poseId: string, file: File) => Promise<void>;
  removeSituationalDialogueCharacter: (characterId: string) => void;
  removeSituationalDialogueCharacterPose: (characterId: string, poseId: string) => void;
  removeSituationalDialogueResponse: (itemId: string, responseId: string) => void;
  setSelectedDefaultSituationalDialogueCharacterId: Dispatch<SetStateAction<string>>;
  setSelectedSituationalDialogueBankCharacterId: Dispatch<SetStateAction<string>>;
  updateSituationalDialogueCharacter: (characterId: string, patch: Partial<SituationalDialogueCharacter>) => void;
  updateSituationalDialogueCharacterPose: (
    characterId: string,
    poseId: string,
    patch: Partial<SituationalDialogueCharacterPose>
  ) => void;
  updateSituationalDialogueResponse: (
    itemId: string,
    responseId: string,
    patch: Partial<SituationalDialogueResponse>
  ) => void;
};

type InlineBlockEditorFeatures = {
  userQuestionBanks: QuestionBankResource[];
  createDefaultPointOfInterestMarker: (order: number) => PointOfInterestMarker;
  defaultBlockLabel: (blockType: string) => string;
  audioAccentColor: (block: Pick<PaideiaBlock, "buttonTextColor" | "panelBorderColor">) => string;
  handleImportHtmlActivityFile: (file: File) => Promise<void>;
  handleQuizSendScoreToLmsChange: (checked: boolean) => void;
  handleRemoveAttachment: (attachmentId: string) => Promise<void>;
  handleReplaceAttachment: (attachmentId: string, file: File) => Promise<void>;
  handleUploadAttachment: (file: File) => Promise<void>;
  handleUploadPointOfInterestMarkerAsset: (
    markerId: string,
    file: File,
    kind: "image" | "video" | "audio" | "subtitle"
  ) => Promise<string>;
  importQuizQuestionsFromBank: (bankId: string, questionIds: string[]) => Promise<void>;
  normalizeQuizData: (quiz: QuizActivityData | null | undefined) => QuizActivityData;
  normalizeSlidesActivityItems: (items: ActivityItem[]) => ActivityItem[];
  setHtmlCodeScrollTop: Dispatch<SetStateAction<number>>;
  setPickingImage360HotspotId: Dispatch<SetStateAction<string | null>>;
  updateQuizDraft: (updater: (quiz: QuizActivityData) => QuizActivityData) => void;
};

type InlineBlockEditorActionsContract = {
  cancelBlockEditing: () => Promise<void>;
  handleSaveBlock: (options?: { closeInspector?: boolean }) => Promise<void>;
  setBlockForm: Dispatch<SetStateAction<BlockFormState>>;
};

export type InlineBlockEditorProps = {
  actions: InlineBlockEditorActionsContract;
  features: InlineBlockEditorFeatures;
  items: InlineBlockEditorItems;
  media: InlineBlockEditorMedia;
  model: InlineBlockEditorModel;
  richText: InlineBlockEditorRichText;
  SituationalDialogue: InlineBlockEditorSituationalDialogue;
};

export function InlineBlockEditor({
  actions,
  features,
  items,
  media,
  model,
  richText,
  SituationalDialogue
}: InlineBlockEditorProps) {
  const { t } = useI18n();
  const bindings = {
    ...actions,
    ...features,
    ...items,
    ...media,
    ...model,
    ...richText,
    ...SituationalDialogue
  };
  const {
    activeActivityItemAnnotationId,
    activeActivityItemCropId,
    activeBlockImageAnnotationId,
    activityItemAnnotationDocuments,
    addActivityItem,
    addDefaultSituationalDialogueCharacter,
    addSituationalDialogueBankCharacter,
    addSituationalDialogueCharacterPose,
    addSituationalDialogueResponse,
    applyActivityItemAnnotation,
    applyActivityItemCrop,
    applyBlockImageAnnotation,
    applyCaseTransform,
    applyEditorFontFamily,
    applyEditorFontSize,
    richToolbarFontFamily,
    richTextFontOptions,
    applyEditorLineHeight,
    applyEditorTextColor,
    applyEditorTextHighlight,
    applyEditorFieldFill,
    applyEditorFieldFillOpacity,
    openCreateRichTextBookmark,
    openInsertRichTextReference,
    canInsertRichTextReference,
    richFieldFill,
    richFieldFillOpacity,
    textHighlightColor,
    applyImageCrop,
    applyLink,
    assignSituationalDialogueCharacterToItem,
    audioAccentColor,
    beginActivityItemCrop,
    blockForm,
    blockFormRef,
    blockImageAnnotationDocuments,
    blockImageAnnotationSourceRefs,
    busyAction,
    courseBackgroundColor,
    courseShadows,
    courseTextColor,
    htmlPackageImportPending,
    cancelActivityItemCrop,
    cancelBlockEditing,
    cancelImageCrop,
    clearRichEditorFormatting,
    closeActivityItemAnnotation,
    closeBlockImageAnnotation,
    collapsedActivityItemIds,
    createDefaultPointOfInterestMarker,
    currentProjectPath,
    defaultBlockLabel,
    draftImageCrop,
    duplicateActivityItem,
    editActivityItemImageAlt,
    editBlockImageAlt,
    getSituationalDialogueDefaultPoseOptions,
    handleImportHtmlActivityFile,
    handleQuizSendScoreToLmsChange,
    handleRemoveAttachment,
    handleReplaceAttachment,
    handleRichEditorBeforeInput,
    handleRichEditorLiveInput,
    handleSaveBlock,
    handleUploadActivityItemAsset,
    handleUploadAttachment,
    handleUploadActivityBackground,
    handleUploadPointOfInterestMarkerAsset,
    handleUploadSituationalDialogueCharacterPose,
    handleUploadSelectedBlockAsset,
    handleUploadSelectedVideoPath,
    htmlCodeScrollTop,
    image360CurrentView,
    image360MediaReloadKey,
    importQuizQuestionsFromBank,
    insertRichEditorInlineImage,
    isCropMode,
    moveActivityItem,
    normalizeQuizData,
    normalizeSlidesActivityItems,
    pendingBlockMediaDraft,
    videoOptimizationAvailable,
    subtitleGenerationConfiguration,
    onVideoWorkspaceChange,
    quizAutomaticTitle,
    quizOptions,
    removeActivityItemImage,
    removeActivityItem,
    removeSituationalDialogueCharacter,
    removeSituationalDialogueCharacterPose,
    removeSituationalDialogueResponse,
    removeSelectedBlockImage,
    removeSelectedVideoMedia,
    removeSelectedVideoSubtitle,
    renderCompleteContentField,
    renderCompleteCoverRichTextFieldForBlock,
    renderActivityItemEditorRichTextFieldForBlock,
    renderCardSortRichTextFieldForBlock = () => null,
    renderMatchingRichTextFieldForBlock = () => null,
    renderFindElementsZoneRichTextFieldForBlock,
    renderInlineImage360HotspotFieldForBlock,
    renderInlineSituationalDialogueItemFieldForBlock,
    renderPointOfInterestMarkerRichTextFieldForBlock,
    renderQuizRichTextField,
    renderQuoteAuthorEditorRichTextFieldForBlock,
    renderDialogueBannerTitleField,
    renderCourseExitRichTextFieldForBlock,
    renderTabsEditorRichTextFieldForBlock,
    richEditorRef,
    runEditorCommand,
    saveRealRichEditorSelection,
    saveRichEditorSelection,
    SituationalDialogueBankCharacters,
    selectAllRichEditorText,
    selectedBlock,
    sectionMarkerFontSize,
    sectionMarkerLabel,
    selectedDefaultSituationalDialogueCharacterId,
    selectedSituationalDialogueBankCharacterId,
    setBlockForm,
    setDraftImageCrop,
    setHtmlCodeScrollTop,
    setIsAnnotationCommitRunning,
    setPickingImage360HotspotId,
    setSelectedDefaultSituationalDialogueCharacterId,
    setSelectedSituationalDialogueBankCharacterId,
    syncRichEditorHtml,
    textColor,
    toggleActivityItemAnnotation,
    toggleActivityItemCollapse,
    toggleBlockImageAnnotation,
    toggleSelectedBlockCrop,
    updateActivityItem,
    updateActivityItemAnnotation,
    updateBlockImageAnnotation,
    updateQuizDraft,
    updateSituationalDialogueCharacter,
    updateSituationalDialogueCharacterPose,
    updateSituationalDialogueResponse,
    userQuestionBanks
  } = bindings;

    if (!selectedBlock) {
      return null;
    }

    const activeMediaDraft = pendingBlockMediaDraft?.blockId === selectedBlock.id
      ? pendingBlockMediaDraft
      : null;
    const editorAssetRefs = activeMediaDraft?.assetRefs ?? selectedBlock.assetRefs;
    const editorImageAssetRef = firstAssetRef(editorAssetRefs, isSupportedImageAsset);
    const editorImageAsset = buildAssetUrl(currentProjectPath, editorImageAssetRef);
    const editorImage360Asset =
      selectedBlock.type === "image-360" ? withAssetReloadKey(editorImageAsset, image360MediaReloadKey) : editorImageAsset;
    const editorVideoAssetRef = firstAssetRef(selectedBlock.assetRefs, isSupportedVideoAsset);
    const editorVideoAsset = buildAssetUrl(currentProjectPath, editorVideoAssetRef);
    const editorVideoOptimizedActive = Boolean(
      selectedBlock.videoOptimizedAssetRef &&
      selectedBlock.assetRefs?.includes(selectedBlock.videoOptimizedAssetRef)
    );
    const editorSubtitleAsset = buildAssetUrl(currentProjectPath, selectedBlock.subtitleRefs?.[0]);
    const editorOriginalSubtitleAsset = buildAssetUrl(
      currentProjectPath,
      selectedBlock.videoSubtitleOriginalRef ?? selectedBlock.subtitleRefs?.[0]
    );
    const displayedMediaFileName = blockForm.mediaFileName || assetDisplayName(editorImageAssetRef) || "";
    const displayedVideoFileName = editorVideoOptimizedActive
      ? assetDisplayName(editorVideoAssetRef) || ""
      : isSupportedVideoAsset(blockForm.mediaFileName)
        ? blockForm.mediaFileName
        : assetDisplayName(editorVideoAssetRef) || "";
    const displayedSubtitleFileName = assetDisplayName(selectedBlock.subtitleRefs?.[0]);
    const {
      cropPreviewActive,
      editorImageLayoutStyle,
      editorMediaLayout,
      inlineImageEditingEnabled,
      liveEditorCrop
    } = deriveInlineBlockEditorMedia({
      blockType: selectedBlock.type,
      draftImageCrop,
      imageAsset: editorImageAsset,
      imageCrop: blockForm.imageCrop,
      imageSize: blockForm.imageSize,
      isCropMode,
      mediaLayout: blockForm.mediaLayout
    });
    const editorActivityItems =
      selectedBlock.type === "slides"
        ? normalizeSlidesActivityItems(blockForm.activityItems)
        : selectedBlock.type === "situational-dialogue"
          ? normalizeSituationalDialogueActivityItems(blockForm.activityItems)
          : selectedBlock.type === "audio"
            ? normalizeAudioTracks(blockForm.activityItems)
          : blockForm.activityItems;
    const renderActivityItemAnnotationEditor = (item: ActivityItem, imageAlt: string) => {
      const itemImageRef = firstItemImageAssetRef(item);
      const annotationSourceRef = item.imageAnnotationSourceAssetRef || itemImageRef;
      const annotationImageAsset = buildAssetUrl(currentProjectPath, annotationSourceRef);
      if (!annotationImageAsset || !annotationSourceRef) {
        return null;
      }
      const annotationDocument =
        activityItemAnnotationDocuments[item.id] ?? { version: 1, annotations: [] };
      return (
        <NativeImageAnnotationTool
          imageAlt={imageAlt}
          imageSrc={annotationImageAsset}
          onApply={applyActivityItemAnnotation}
          onApplyEnd={() => setIsAnnotationCommitRunning(false)}
          onApplyStart={() => setIsAnnotationCommitRunning(true)}
          onCancel={closeActivityItemAnnotation}
          onChange={(document, renderedDataUrl) =>
            updateActivityItemAnnotation(item.id, annotationSourceRef, document, renderedDataUrl)
          }
                  title={t("annotation.title")}
          value={annotationDocument}
        />
      );
    };
    const renderActivityItemImageAltBadge = (item: ActivityItem, face?: "front" | "back") => (
      <ImageAltBadge
        accessibility={face === "front" ? item.frontImageAccessibility : face === "back" ? item.backImageAccessibility : item.imageAccessibility}
        className="in-flow"
        onClick={() => editActivityItemImageAlt(item.id, face)}
      />
    );
    const blockImageAnnotationSourceRef = selectedBlock.type === "image-text"
      ? blockImageAnnotationSourceRefs[selectedBlock.id] || editorImageAssetRef
      : null;
    const blockImageAnnotationSource = buildAssetUrl(currentProjectPath, blockImageAnnotationSourceRef);
    const blockImageAnnotationEditor =
      selectedBlock.type === "image-text" &&
      activeBlockImageAnnotationId === selectedBlock.id &&
      blockImageAnnotationSourceRef &&
      blockImageAnnotationSource ? (
        <NativeImageAnnotationTool
          imageAlt={selectedBlock.title || "Image et texte"}
          imageSrc={blockImageAnnotationSource}
          onApply={applyBlockImageAnnotation}
          onApplyEnd={() => setIsAnnotationCommitRunning(false)}
          onApplyStart={() => setIsAnnotationCommitRunning(true)}
          onCancel={closeBlockImageAnnotation}
          onChange={(document, renderedDataUrl) =>
            updateBlockImageAnnotation(
              selectedBlock.id,
              blockImageAnnotationSourceRef,
              document,
              renderedDataUrl
            )
          }
                  title={t("annotation.title")}
          value={blockImageAnnotationDocuments[selectedBlock.id] ?? { version: 1, annotations: [] }}
        />
      ) : null;
    const inlineImageMediaControls = inlineImageEditingEnabled ? (
      <AuthoringImageMediaEditor
        accept={getAssetPickerAccept("image")}
        annotationActive={activeBlockImageAnnotationId === selectedBlock.id}
        annotationEditor={blockImageAnnotationEditor}
        annotationIcon={selectedBlock.type === "image-text" ? <NativeImageAnnotationAccessIcon /> : undefined}
        crop={draftImageCrop}
        cropIcon={<CropIcon />}
        cropPreviewActive={cropPreviewActive}
        displayedMediaFileName={displayedMediaFileName}
        editorMediaLayout={editorMediaLayout}
        imageAlt={selectedBlock.title}
        imageAltBadge={<ImageAltBadge accessibility={blockForm.imageAccessibility} className="in-flow" onClick={editBlockImageAlt} />}
        imageAsset={editorImageAsset}
        imageAssetRef={editorImageAssetRef}
        imageRounded={blockForm.imageRounded}
        imageSizeToken={normalizeImageSizeToken(blockForm.imageSize)}
        isCropMode={isCropMode}
        showLayoutSelector={selectedBlock.type !== "image"}
        showSizeForCenteredLayout={["quote", "image-text"].includes(selectedBlock.type)}
        onApplyCrop={applyImageCrop}
        onToggleAnnotation={selectedBlock.type === "image-text" ? () => void toggleBlockImageAnnotation() : undefined}
        onCancelCrop={cancelImageCrop}
        onCropChange={setDraftImageCrop}
        onImageRoundedChange={(imageRounded) =>
          setBlockForm((current) => ({
            ...current,
            imageRounded
          }))
        }
        onImageSizeChange={(imageSize) =>
          setBlockForm((current) => ({
            ...current,
            imageSize
          }))
        }
        onLayoutChange={(mediaLayout) =>
          setBlockForm((current) => ({
            ...current,
            mediaLayout,
            imageRounded: selectedBlock.type === "image" && mediaLayout === "page-width"
              ? false
              : current.imageRounded
          }))
        }
        onRemoveImage={() => void removeSelectedBlockImage()}
        onToggleCrop={() => void toggleSelectedBlockCrop()}
        onUpload={(file) => void handleUploadSelectedBlockAsset(file, "media")}
      />
    ) : null;

    const completeCoverMediaControls = selectedBlock.type === "complete" ? (
      <AuthoringImageMediaEditor
        accept={getAssetPickerAccept("image")}
        crop={draftImageCrop}
        cropIcon={<CropIcon />}
        cropPreviewActive={Boolean(isCropMode && editorImageAsset)}
        compactActionControls
        displayedMediaFileName={displayedMediaFileName}
        editorMediaLayout="image-center"
        imageAlt={selectedBlock.title}
        imageAltBadge={<ImageAltBadge accessibility={blockForm.imageAccessibility} className="in-flow" onClick={editBlockImageAlt} />}
        imageAsset={editorImageAsset}
        imageAssetRef={editorImageAssetRef}
        imageRounded
        imageSizeToken="medium"
        isCropMode={isCropMode}
        showAppearanceControls={false}
        showLayoutSelector={false}
        showRoundedControl
        showSizeForCenteredLayout={false}
        onApplyCrop={applyImageCrop}
        onCancelCrop={cancelImageCrop}
        onCropChange={setDraftImageCrop}
        onImageRoundedChange={(imageRounded) => setBlockForm((current) => ({ ...current, imageRounded }))}
        onImageSizeChange={() => undefined}
        onLayoutChange={() => undefined}
        onRemoveImage={() => void removeSelectedBlockImage()}
        onToggleCrop={() => void toggleSelectedBlockCrop()}
        onUpload={(file) => void handleUploadSelectedBlockAsset(file, "media")}
      />
    ) : null;

    const updateActivityBackgroundAppearance = (
      patch: Partial<{
        backgroundColor: string;
        blur: number;
        height: "minimum" | "medium" | "large";
        overlay: number;
        darkOverlay: boolean;
        rounded: boolean;
        shadow: boolean;
        wide: boolean;
      }>
    ) => {
      setBlockForm((current) => {
        const next = {
          ...current,
          sectionBackgroundColor: patch.backgroundColor ?? current.sectionBackgroundColor,
          sectionBackgroundBlur: patch.blur ?? current.sectionBackgroundBlur,
          sectionBackgroundOpacity:
            patch.overlay == null ? current.sectionBackgroundOpacity : 1 - patch.overlay,
          sectionBackgroundOverlayDark: patch.darkOverlay ?? current.sectionBackgroundOverlayDark,
          sectionBackgroundRounded:
            selectedBlock.type === "situational-dialogue"
              ? current.sectionBackgroundRounded
              : patch.rounded ?? current.sectionBackgroundRounded,
          panelRounded:
            selectedBlock.type === "situational-dialogue"
              ? patch.rounded ?? current.panelRounded
              : current.panelRounded,
          sectionBackgroundShadow: patch.shadow === undefined ? current.sectionBackgroundShadow : patch.shadow ? "on" : "off",
          sectionBackgroundWide: isActivityBackgroundAlwaysWide(selectedBlock.type)
            ? true
            : patch.wide ?? current.sectionBackgroundWide,
          sectionBackgroundHeight: patch.height ?? current.sectionBackgroundHeight
        };
        blockFormRef.current = next;
        return next;
      });
    };

    const activityBackgroundAppearance = supportsActivityBackground(selectedBlock.type) ? (
      <ActivityBackgroundAppearance
        imageAccept={getAssetPickerAccept("image")}
        labels={{
          backgroundColor: t("editor.backgroundColor"),
          backgroundColorAriaLabel: t("editor.backgroundColor"),
          backgroundImage: t("situationalDialogue.backgroundImage"),
          backgroundImagePreview: t("situationalDialogue.backgroundImagePreview"),
          blur: t("situationalDialogue.backgroundBlur"),
          chooseImage: t("editor.chooseImage"),
          height: t("lessonSettings.height"),
          heightLarge: t("lessonSettings.coverHeightLarge").replace(/\s*[—-].*$/, ""),
          heightMedium: t("lessonSettings.coverHeightMedium").replace(/\s*[—-].*$/, ""),
          heightMinimum: t("activityBackground.heightMinimum"),
          light: t("common.light"),
          medium: t("common.medium"),
          none: t("common.none"),
          overlay: t("situationalDialogue.backgroundOverlay"),
          darkOverlay: t("activityBackground.darkOverlay", undefined, "Voile sombre"),
          removeImage: t("situationalDialogue.removeBackgroundImage"),
          reset: t("common.reset"),
          roundedCorners: t("common.roundedCorners"),
          shadow: t("editor.shadow"),
          strong: t("common.strong"),
          title: t("situationalDialogue.activityBackground"),
          wideBackground: t("situationalDialogue.wideBackground")
        }}
        onChange={updateActivityBackgroundAppearance}
        onImageRemove={() => {
          setBlockForm((current) => {
            const next = { ...current, sectionBackgroundImageRef: "" };
            blockFormRef.current = next;
            return next;
          });
        }}
        onImageUpload={(file) => void handleUploadActivityBackground(file)}
        onReset={() => {
          setBlockForm((current) => {
            const supportsBackgroundImage = supportsActivityBackgroundProperty(selectedBlock.type, "image");
            const next: BlockFormState = {
              ...current,
              sectionBackgroundColor: "",
              sectionBackgroundImageRef: supportsBackgroundImage ? "" : current.sectionBackgroundImageRef,
              sectionBackgroundOpacity: supportsBackgroundImage ? 1 : current.sectionBackgroundOpacity,
              sectionBackgroundOverlayDark: supportsBackgroundImage ? true : current.sectionBackgroundOverlayDark,
              sectionBackgroundBlur: supportsBackgroundImage ? 0 : current.sectionBackgroundBlur,
              sectionBackgroundRounded: true,
              sectionBackgroundShadow: "inherit",
              panelRounded: selectedBlock.type === "situational-dialogue" ? true : current.panelRounded,
              sectionBackgroundWide: activityBackgroundWideDefault(selectedBlock.type),
              sectionBackgroundHeight: "medium" as const
            };
            blockFormRef.current = next;
            return next;
          });
        }}
        value={{
          backgroundColor: blockForm.sectionBackgroundColor || "transparent",
          backgroundImageName: assetDisplayName(blockForm.sectionBackgroundImageRef),
          backgroundImageRef: blockForm.sectionBackgroundImageRef,
          backgroundImageUrl: buildAssetUrl(currentProjectPath, blockForm.sectionBackgroundImageRef),
          blur: blockForm.sectionBackgroundBlur ?? 0,
          height: blockForm.sectionBackgroundHeight,
          overlay: Math.max(0, Math.min(1, 1 - (blockForm.sectionBackgroundOpacity ?? 1))),
          darkOverlay: blockForm.sectionBackgroundOverlayDark,
          rounded: selectedBlock.type === "situational-dialogue"
            ? blockForm.panelRounded
            : blockForm.sectionBackgroundRounded,
          shadow: blockForm.sectionBackgroundShadow === "inherit"
            ? courseShadows && Boolean(selectedBlock.type === "situational-dialogue" || blockForm.sectionBackgroundColor || blockForm.sectionBackgroundImageRef)
            : blockForm.sectionBackgroundShadow === "on",
          wide: isActivityBackgroundAlwaysWide(selectedBlock.type) ? true : blockForm.sectionBackgroundWide
        }}
        showHeight={supportsActivityBackgroundProperty(selectedBlock.type, "height")}
        showImage={supportsActivityBackgroundProperty(selectedBlock.type, "image")}
        showRounded={!isActivityBackgroundAlwaysWide(selectedBlock.type)}
        showShadow={selectedBlock.type === "situational-dialogue"}
        showWide={!isActivityBackgroundAlwaysWide(selectedBlock.type)}
      />
    ) : null;

    const findElementsImageAppearance = selectedBlock.type === "find-elements" ? (
      <ActivityFrameAppearanceControls
        labels={{
          accent: t("editor.borderColor"), activityAppearance: t("editor.imageAppearance", undefined, "Apparence de l’image"), background: t("editor.backgroundColor"), backgroundColor: t("editor.backgroundColor"),
          borderStyle: t("editor.borderStyle", undefined, "Type de trait"), borderWidth: t("editor.borderWidth", undefined, "Épaisseur"), dashed: t("lineStyle.dashed"), dotted: t("lineStyle.dotted"), lineNone: t("lineWidth.none"), lineNormal: t("lineWidth.normal"), lineThick: t("lineWidth.thick"), lineThin: t("lineWidth.thin"), roundedCorners: t("common.roundedCorners"), shadow: t("editor.shadow"), solid: t("lineStyle.solid")
        }}
        onChange={(patch) => setBlockForm((current) => {
          const data = normalizeFindElementsData(current.findElements);
          return { ...current, findElements: { ...data, imageAppearance: {
            borderColor: patch.borderColor ?? data.imageAppearance.borderColor,
            borderStyle: patch.borderStyle ?? data.imageAppearance.borderStyle,
            borderWidth: patch.borderWidth ?? data.imageAppearance.borderWidth,
            rounded: patch.rounded ?? data.imageAppearance.rounded,
            shadow: patch.shadow ?? data.imageAppearance.shadow
          } } };
        })}
        showBackground={false}
        value={{ backgroundColor: "transparent", ...normalizeFindElementsData(blockForm.findElements).imageAppearance }}
      />
    ) : null;

    const cardSortAppearance = selectedBlock.type === "card-sort" ? (
      <ActivityFrameAppearanceControls
        labels={{
          accent: t("editor.borderColor"), activityAppearance: t("cardSort.cardAppearance", undefined, "Apparence des cartes"), background: t("editor.backgroundColor"), backgroundColor: t("editor.backgroundColor"),
          borderStyle: t("editor.borderStyle", undefined, "Type de trait"), borderWidth: t("editor.borderWidth", undefined, "Épaisseur"), dashed: t("lineStyle.dashed"), dotted: t("lineStyle.dotted"), lineNone: t("lineWidth.none"), lineNormal: t("lineWidth.normal"), lineThick: t("lineWidth.thick"), lineThin: t("lineWidth.thin"), roundedCorners: t("common.roundedCorners"), shadow: t("editor.shadow"), solid: t("lineStyle.solid")
        }}
        onChange={(patch) => setBlockForm((current) => {
          const data = normalizeCardSortData(current.cardSort);
          return { ...current, cardSort: { ...data, cardAppearance: {
            backgroundColor: patch.backgroundColor ?? data.cardAppearance.backgroundColor,
            borderColor: patch.borderColor ?? data.cardAppearance.borderColor,
            borderStyle: patch.borderStyle ?? data.cardAppearance.borderStyle,
            borderWidth: patch.borderWidth ?? data.cardAppearance.borderWidth,
            rounded: patch.rounded ?? data.cardAppearance.rounded
          } } };
        })}
        showShadow={false}
        value={{ ...normalizeCardSortData(blockForm.cardSort).cardAppearance, shadow: false }}
      />
    ) : null;

    const matchingAppearance = selectedBlock.type === "matching" ? (
      <ActivityFrameAppearanceControls
        labels={{
          accent: t("editor.borderColor"), activityAppearance: t("matching.labelAppearance", undefined, "Apparence des cartes"), background: t("editor.backgroundColor"), backgroundColor: t("editor.backgroundColor"),
          borderStyle: t("editor.borderStyle", undefined, "Type de trait"), borderWidth: t("editor.borderWidth", undefined, "Épaisseur"), dashed: t("lineStyle.dashed"), dotted: t("lineStyle.dotted"), lineNone: t("lineWidth.none"), lineNormal: t("lineWidth.normal"), lineThick: t("lineWidth.thick"), lineThin: t("lineWidth.thin"), roundedCorners: t("common.roundedCorners"), shadow: t("editor.shadow"), solid: t("lineStyle.solid")
        }}
        onChange={(patch) => setBlockForm((current) => {
          const data = normalizeMatchingData(current.matching);
          return { ...current, matching: { ...data, labelAppearance: {
            backgroundColor: patch.backgroundColor ?? data.labelAppearance.backgroundColor,
            borderColor: patch.borderColor ?? data.labelAppearance.borderColor,
            borderStyle: patch.borderStyle ?? data.labelAppearance.borderStyle,
            borderWidth: patch.borderWidth ?? data.labelAppearance.borderWidth,
            rounded: patch.rounded ?? data.labelAppearance.rounded
          } } };
        })}
        showShadow={false}
        value={{ ...normalizeMatchingData(blockForm.matching).labelAppearance, shadow: false }}
      />
    ) : null;

    return (
      <div
        className="inline-block-editor"
        style={{
          "--activity-content-text": resolveContextualTextColor(
            courseTextColor,
            selectedBlock.type === "flip-cards"
              ? "#FFFFFF"
              : (selectedBlock.type === "rich-text" ? null : normalizeHexColor(blockForm.panelBackgroundColor))
                ?? normalizeHexColor(blockForm.sectionBackgroundColor)
                ?? courseBackgroundColor
          )
        } as CSSProperties}
        onDragStart={(event) => event.preventDefault()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="editor-header">
          <div>
            <h2>{selectedBlock.title}</h2>
          </div>
        </div>

        <div className="inspector-grid">
          {selectedBlock.type === "rich-text" ? (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={<p>{t("lesson.inlineEditOnly")}</p>}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              defaultTab="appearance"
              sessionKey={selectedBlock.id}
            />
          ) : null}
          {selectedBlock.type === "image-text" ? (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={inlineImageMediaControls}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          ) : selectedBlock.type === "image" ? (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={inlineImageMediaControls}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          ) : selectedBlock.type === "quote" ? null : (
            inlineImageMediaControls
          )}
          {selectedBlock.type === "divider" ? (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={<DividerEditorPanel onChange={(patch) => setBlockForm((current) => ({ ...current, ...patch }))} value={blockForm} />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          ) : null}
          {selectedBlock.type === "section-marker" ? (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={<SectionMarkerEditorPanel label={sectionMarkerLabel} markerFontSize={sectionMarkerFontSize} onChange={(patch) => setBlockForm((current) => ({ ...current, ...patch }))} value={blockForm} />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          ) : null}
          <ActivityAppearanceTabs
            activityLabel={t("editor.activityTab")}
            appearanceLabel={t("editor.appearanceTab")}
            appearancePanel={activityBackgroundAppearance}
            enabled={SIMPLE_ACTIVITY_BACKGROUND_TAB_TYPES.has(selectedBlock.type)}
            sessionKey={selectedBlock.id}
          >
            <SimpleInlineBlockEditors
            block={selectedBlock}
            defaultHtmlContent={defaultCustomHtmlContent()}
            getBlockLabel={defaultBlockLabel}
            headerHasImage={Boolean(editorImageAssetRef)}
            headerImageAccept={getAssetPickerAccept("image")}
            headerImageName={displayedMediaFileName}
            headerImageSrc={editorImageAsset}
            headerPreviewStyle={headerBannerStyle(
              {
                assetRefs: selectedBlock.assetRefs,
                family: selectedBlock.family,
                variant: selectedBlock.variant,
                sourceFormat: selectedBlock.sourceFormat,
                headerBackgroundColor: blockForm.headerBackgroundColor,
                headerTextColor: blockForm.headerTextColor,
                headerTextOutline: blockForm.headerTextOutline,
                headerTextOutlineColor: blockForm.headerTextOutlineColor,
                headerHeight: blockForm.headerHeight,
                headerImagePositionY: blockForm.headerImagePositionY,
                sectionBackgroundBlur: blockForm.sectionBackgroundBlur,
                sectionBackgroundOpacity: blockForm.sectionBackgroundOpacity,
                sectionBackgroundOverlayDark: blockForm.sectionBackgroundOverlayDark
              },
              (assetRefs) => buildAssetUrl(currentProjectPath, firstAssetRef(assetRefs, isSupportedImageAsset))
            )}
            htmlCodeScrollTop={htmlCodeScrollTop}
            htmlPackageImportPending={htmlPackageImportPending}
            onAttachmentAdd={(file) => void handleUploadAttachment(file)}
            onAttachmentRemove={(attachmentId) => void handleRemoveAttachment(attachmentId)}
            onAttachmentReplace={(attachmentId, file) => void handleReplaceAttachment(attachmentId, file)}
            onChange={(patch) => setBlockForm((current) => ({ ...current, ...patch }))}
            onHtmlFileSelect={(file) => void handleImportHtmlActivityFile(file)}
            onHtmlScrollTopChange={setHtmlCodeScrollTop}
            onImageRemove={() => void removeSelectedBlockImage()}
            onImageUpload={(file) => void handleUploadSelectedBlockAsset(file, "media")}
            quizOptions={quizOptions}
            renderCourseExitRichTextField={renderCourseExitRichTextFieldForBlock}
            renderActivityItemRichTextField={renderActivityItemEditorRichTextFieldForBlock}
            value={blockForm}
            />
          </ActivityAppearanceTabs>
          {selectedBlock.type === "flip-cards" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={<FlipCardsInlineBlockEditor
              activeCropItemId={activeActivityItemCropId}
              blockImageRounded={blockForm.imageRounded}
              collapsedItemIds={collapsedActivityItemIds}
              draftImageCrop={draftImageCrop}
              imageAccept={getAssetPickerAccept("image")}
              isCropMode={isCropMode}
              items={editorActivityItems}
              onAddItem={addActivityItem}
              onApplyCrop={applyActivityItemCrop}
              onBeginCrop={(item, face) => beginActivityItemCrop(item, face)}
              onCancelCrop={cancelActivityItemCrop}
              onCropChange={setDraftImageCrop}
              onRemoveItem={removeActivityItem}
              onStyleChange={(patch) =>
                setBlockForm((current) => ({
                  ...current,
                  flipCardFrontBackgroundColor: patch.frontBackgroundColor ?? current.flipCardFrontBackgroundColor,
                  flipCardBackBackgroundColor: patch.backBackgroundColor ?? current.flipCardBackBackgroundColor,
                  flipCardFrontBorderColor: patch.frontBorderColor ?? current.flipCardFrontBorderColor,
                  flipCardBackBorderColor: patch.backBorderColor ?? current.flipCardBackBorderColor,
                  panelBorderStyle: patch.borderStyle ?? current.panelBorderStyle,
                  panelBorderWidth: patch.borderWidth ?? current.panelBorderWidth
                }))
              }
              onToggleCollapse={toggleActivityItemCollapse}
              onUpdateItem={updateActivityItem}
              onUploadImage={(itemId, face, file) => void handleUploadActivityItemAsset(itemId, file, face)}
              renderRichTextField={({ className, field, html, item, label, placeholder }) =>
                renderActivityItemEditorRichTextFieldForBlock({
                  block: selectedBlock,
                  className,
                  field,
                  html,
                  item,
                  label,
                  placeholder
                })
              }
              renderImageAltBadge={renderActivityItemImageAltBadge}
              resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef)}
              style={{
                frontBackgroundColor: blockForm.flipCardFrontBackgroundColor,
                backBackgroundColor: blockForm.flipCardBackBackgroundColor,
                frontBorderColor: blockForm.flipCardFrontBorderColor,
                backBorderColor: blockForm.flipCardBackBorderColor,
                borderStyle: blockForm.panelBorderStyle,
                borderWidth: blockForm.panelBorderWidth
              }}
            />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "image-grid" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={
                <ImageGridActivityEditor
                  activeCropItemId={activeActivityItemCropId}
                  columns={Number(blockForm.contentWidth)}
                  cropIcon={<CropIcon />}
                  draftImageCrop={draftImageCrop}
                  imageAccept={getAssetPickerAccept("image")}
                  imageRounded={blockForm.imageRounded}
                  imageShadow={blockForm.panelShadow}
                  isCropMode={isCropMode}
                  items={editorActivityItems}
                  onAddItem={addActivityItem}
                  onApplyCrop={applyActivityItemCrop}
                  onBeginCrop={beginActivityItemCrop}
                  onCancelCrop={cancelActivityItemCrop}
                  onColumnsChange={(columns) => setBlockForm((current) => ({ ...current, contentWidth: String(columns) }))}
                  onCropChange={setDraftImageCrop}
                  onImageRoundedChange={(imageRounded) => setBlockForm((current) => ({ ...current, imageRounded }))}
                  onImageShadowChange={(panelShadow) => setBlockForm((current) => ({ ...current, panelShadow }))}
                  onRemoveImage={removeActivityItemImage}
                  onRemoveItem={removeActivityItem}
                  onUploadImage={(itemId, file) => void handleUploadActivityItemAsset(itemId, file)}
                  renderRichTextField={({ className, field, html, item, label, placeholder }) =>
                    renderActivityItemEditorRichTextFieldForBlock({
                      block: selectedBlock,
                      className,
                      field,
                      html,
                      item,
                      label,
                      placeholder
                    })
                  }
                  resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef)}
                />
              }
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          )}
          <ActivityAppearanceTabs
            activityLabel={t("editor.activityTab")}
            appearanceLabel={t("editor.appearanceTab")}
            appearancePanel={activityBackgroundAppearance}
            enabled={["quote", "timeline"].includes(selectedBlock.type)}
            sessionKey={selectedBlock.id}
          >
            {selectedBlock.type === "quote" ? inlineImageMediaControls : null}
            <StructuredInlineBlockEditors
              block={selectedBlock}
              collapsedItemIds={collapsedActivityItemIds}
              items={editorActivityItems}
              onChange={(patch) => setBlockForm((current) => ({ ...current, ...patch }))}
              onRemoveItem={removeActivityItem}
              onTimelineColorChange={(value) =>
                setBlockForm((current) => ({
                  ...current,
                  panelBorderColor: value,
                  activityItems: current.activityItems.map((item) => ({
                    ...item,
                    accentColor: value,
                    timeColor: null,
                    titleColor: null
                  }))
                }))
              }
              onToggleCollapse={toggleActivityItemCollapse}
              onUpdateItem={updateActivityItem}
              quoteAuthorField={
                selectedBlock.type === "quote"
                  ? renderQuoteAuthorEditorRichTextFieldForBlock(selectedBlock, blockForm.quoteAuthorHtml)
                  : null
              }
              value={blockForm}
            />
          </ActivityAppearanceTabs>
          <ActivityAppearanceTabs
            activityLabel={t("editor.activityTab")}
            appearanceLabel={t("editor.appearanceTab")}
            appearancePanel={activityBackgroundAppearance}
            enabled={selectedBlock.type === "quiz" || isStandaloneQuestionType(selectedBlock.type) || selectedBlock.type === "question-random"}
            sessionKey={selectedBlock.id}
          >
            {selectedBlock.type === "question-random" ? <RandomQuestionsEditor
              onQuizChange={updateQuizDraft}
              questionBanks={userQuestionBanks}
              quiz={normalizeQuizData(blockForm.quiz)}
            /> : isStandaloneQuestionType(selectedBlock.type) ? <StandaloneQuestionEditor
              mode={STANDALONE_QUESTION_MODES[selectedBlock.type]}
              onQuizChange={updateQuizDraft}
              questionBanks={userQuestionBanks}
              quiz={normalizeQuizData(blockForm.quiz)}
              renderRichTextField={renderQuizRichTextField}
            /> : <QuizInlineBlockEditor
              active={selectedBlock.type === "quiz"}
              automaticTitle={quizAutomaticTitle}
              onImportQuestionsFromBank={importQuizQuestionsFromBank}
              onQuizChange={updateQuizDraft}
              onToggleSendScoreToLms={handleQuizSendScoreToLmsChange}
              questionBanks={userQuestionBanks}
              quiz={selectedBlock.type === "quiz" ? normalizeQuizData(blockForm.quiz) : null}
              renderRichTextField={renderQuizRichTextField}
            />}
          </ActivityAppearanceTabs>
          {selectedBlock.type === "tabs" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={<TabsInlineBlockEditor
              activeAnnotationItemId={activeActivityItemAnnotationId}
              activeCropItemId={activeActivityItemCropId}
              crop={draftImageCrop}
              imageAccept={getAssetPickerAccept("image")}
              isCropMode={isCropMode}
              items={editorActivityItems}
              onAddItem={addActivityItem}
              onApplyCrop={applyActivityItemCrop}
              onBeginAnnotation={(item) => void toggleActivityItemAnnotation(item)}
              onBeginCrop={beginActivityItemCrop}
              onCancelCrop={cancelActivityItemCrop}
              onCropChange={setDraftImageCrop}
              onDuplicateItem={duplicateActivityItem}
              onMoveItem={moveActivityItem}
              onRemoveItem={removeActivityItem}
              onStyleChange={(patch) =>
                setBlockForm((current) => ({
                  ...current,
                  imageRounded: patch.imageRounded ?? current.imageRounded,
                  panelBackgroundColor: patch.backgroundColor ?? current.panelBackgroundColor,
                  panelBorderColor: patch.accentColor ?? current.panelBorderColor,
                  panelBorderStyle: patch.borderStyle ?? current.panelBorderStyle,
                  panelBorderWidth: patch.borderWidth ?? current.panelBorderWidth,
                  panelRounded: patch.rounded ?? current.panelRounded,
                  panelShadow: patch.shadow ?? current.panelShadow
                }))
              }
              onUpdateItem={updateActivityItem}
              onUploadItemImage={(itemId, file) => void handleUploadActivityItemAsset(itemId, file)}
              renderAnnotationEditor={renderActivityItemAnnotationEditor}
              renderImageAltBadge={renderActivityItemImageAltBadge}
              renderRichTextField={({ className, field, html, item, label, placeholder }) =>
                renderTabsEditorRichTextFieldForBlock({
                  block: selectedBlock,
                  className,
                  field,
                  html,
                  item,
                  label,
                  placeholder
                })
              }
              resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef)}
              style={{
                accentColor: blockForm.panelBorderColor,
                backgroundColor: blockForm.panelBackgroundColor,
                borderStyle: blockForm.panelBorderStyle,
                borderWidth: blockForm.panelBorderWidth,
                imageRounded: blockForm.imageRounded,
                rounded: blockForm.panelRounded,
                shadow: blockForm.panelShadow
              }}
              visiblePanel="activity"
            />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={<div className="tabs-appearance-stack">
                {activityBackgroundAppearance}
                <TabsInlineBlockEditor
                  activeAnnotationItemId={activeActivityItemAnnotationId}
                  activeCropItemId={activeActivityItemCropId}
                  crop={draftImageCrop}
                  imageAccept={getAssetPickerAccept("image")}
                  isCropMode={isCropMode}
                  items={editorActivityItems}
                  onAddItem={addActivityItem}
                  onApplyCrop={applyActivityItemCrop}
                  onBeginAnnotation={(item) => void toggleActivityItemAnnotation(item)}
                  onBeginCrop={beginActivityItemCrop}
                  onCancelCrop={cancelActivityItemCrop}
                  onCropChange={setDraftImageCrop}
                  onDuplicateItem={duplicateActivityItem}
                  onMoveItem={moveActivityItem}
                  onRemoveItem={removeActivityItem}
                  onStyleChange={(patch) => setBlockForm((current) => ({
                    ...current,
                    imageRounded: patch.imageRounded ?? current.imageRounded,
                    panelBackgroundColor: patch.backgroundColor ?? current.panelBackgroundColor,
                    panelBorderColor: patch.accentColor ?? current.panelBorderColor,
                    panelBorderStyle: patch.borderStyle ?? current.panelBorderStyle,
                    panelBorderWidth: patch.borderWidth ?? current.panelBorderWidth,
                    panelRounded: patch.rounded ?? current.panelRounded,
                    panelShadow: patch.shadow ?? current.panelShadow
                  }))}
                  onUpdateItem={updateActivityItem}
                  onUploadItemImage={(itemId, file) => void handleUploadActivityItemAsset(itemId, file)}
                  renderAnnotationEditor={renderActivityItemAnnotationEditor}
                  renderImageAltBadge={renderActivityItemImageAltBadge}
                  renderRichTextField={({ className, field, html, item, label, placeholder }) => renderTabsEditorRichTextFieldForBlock({ block: selectedBlock, className, field, html, item, label, placeholder })}
                  resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef)}
                  style={{
                    accentColor: blockForm.panelBorderColor,
                    backgroundColor: blockForm.panelBackgroundColor,
                    borderStyle: blockForm.panelBorderStyle,
                    borderWidth: blockForm.panelBorderWidth,
                    imageRounded: blockForm.imageRounded,
                    rounded: blockForm.panelRounded,
                    shadow: blockForm.panelShadow
                  }}
                  visiblePanel="appearance"
                />
              </div>}
              sessionKey={selectedBlock.id}
            />
          )}
          {(!inlineImageEditingEnabled && (selectedBlock.type === "image" || selectedBlock.type === "image-text")) && (
            <div className="inspector-span-2 media-options-row">
              <label>
                <span>{t("image.layout")}</span>
                <select
                  onChange={(event) =>
                    setBlockForm((current) => ({
                      ...current,
                      mediaLayout: event.target.value
                    }))
                  }
                  value={blockForm.mediaLayout}
                >
                  <option value="image-left">{t("editor.imageLeft", undefined, "Image à gauche")}</option>
                  <option value="image-right">{t("editor.imageRight", undefined, "Image à droite")}</option>
                  <option value="image-center">{t("editor.imageCenter", undefined, "Image centrée")}</option>
                </select>
              </label>
              <label className="checkbox-line compact">
                <input
                  checked={blockForm.imageRounded}
                  onChange={(event) =>
                    setBlockForm((current) => ({
                      ...current,
                      imageRounded: event.target.checked
                    }))
                  }
                  type="checkbox"
                />
                <span>{t("common.roundedCorners")}</span>
              </label>
            </div>
          )}
          {selectedBlock.type === "point-of-interest" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanelCard={false}
              activityPanel={<PointOfInterestInlineBlockEditor
                acceptImageTypes={getAssetPickerAccept("image")}
                blockId={selectedBlock.id}
                createMarker={createDefaultPointOfInterestMarker}
                editorSessionKey={selectedBlock.id}
                imageAltControl={editorImageAsset ? (
                  <ImageAltBadge
                    accessibility={blockForm.imageAccessibility}
                    className="in-flow"
                    onClick={editBlockImageAlt}
                  />
                ) : null}
                imageSrc={editorImageAsset}
                optimizationAvailable={videoOptimizationAvailable}
                projectPath={currentProjectPath}
                subtitleGenerationConfiguration={subtitleGenerationConfiguration}
                onImageSelect={(file) => void handleUploadSelectedBlockAsset(file, "media")}
                onMarkersChange={(update) =>
                  setBlockForm((current) => ({
                    ...current,
                    pointOfInterestMarkers: update(current.pointOfInterestMarkers)
                  }))
                }
                onRemoveImage={() => {
                  setBlockForm((current) => ({ ...current, pointOfInterestMarkers: [] }));
                  void removeSelectedBlockImage();
                }}
                onUploadMarkerAsset={handleUploadPointOfInterestMarkerAsset}
                resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef)}
                renderMarkerRichTextField={({ className, field, html, label, marker, placeholder }) =>
                  renderPointOfInterestMarkerRichTextFieldForBlock({
                    block: selectedBlock,
                    className,
                    field,
                    html,
                    label,
                    marker,
                    placeholder
                  })
                }
                title={selectedBlock.title}
                value={blockForm}
              />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={<div className="tabs-appearance-stack">
                {activityBackgroundAppearance}
              </div>}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "find-elements" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanelCard={false}
              activityPanel={<FindElementsActivityEditor
                acceptImageTypes={getAssetPickerAccept("image")}
                data={normalizeFindElementsData(blockForm.findElements)}
                imageAlt={blockForm.imageAccessibility?.altText ?? ""}
                imageAltControl={editorImageAsset ? (
                  <ImageAltBadge
                    accessibility={blockForm.imageAccessibility}
                    className="in-flow"
                    onClick={editBlockImageAlt}
                  />
                ) : null}
                imageSrc={editorImageAsset}
                instructionHtml={blockForm.contentHtml}
                onDataChange={(updater) => setBlockForm((current) => ({ ...current, findElements: updater(normalizeFindElementsData(current.findElements)) }))}
                onImageSelect={(file) => void handleUploadSelectedBlockAsset(file, "media")}
                onInstructionChange={(contentHtml) => setBlockForm((current) => ({ ...current, contentHtml }))}
                onRemoveImage={() => {
                  setBlockForm((current) => ({
                    ...current,
                    findElements: {
                      ...normalizeFindElementsData(current.findElements),
                      zones: []
                    }
                  }));
                  void removeSelectedBlockImage();
                }}
                onTitleChange={(title) => setBlockForm((current) => ({ ...current, title }))}
                renderZoneRichTextField={({ className, field, html, label, placeholder, zone }) => renderFindElementsZoneRichTextFieldForBlock({ block: selectedBlock, className, field, html, label, placeholder, zone })}
                title={blockForm.title}
              />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={<div className="tabs-appearance-stack">
                {activityBackgroundAppearance}
                {findElementsImageAppearance}
              </div>}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "complete" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanelCard={false}
              activityPanel={<CompleteActivityEditor
                coverMediaEditor={completeCoverMediaControls}
                data={normalizeCompleteData(blockForm.complete, blockForm.contentHtml)}
                onDataChange={(updater) => setBlockForm((current) => {
                  const complete = updater(normalizeCompleteData(current.complete, current.contentHtml));
                  return {
                    ...current,
                    complete,
                    // Kept as a compatibility projection for existing SCORM renderers and old projects.
                    contentHtml: complete.exercises.map((exercise) => exercise.contentHtml).join("\n")
                  };
                })}
                renderContentRichTextField={(options) => renderCompleteContentField({ block: selectedBlock, ...options })}
                renderCoverRichTextField={({ field, html, label, placeholder }) => renderCompleteCoverRichTextFieldForBlock({ block: selectedBlock, field, html, label, placeholder })}
              />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "card-sort" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanelCard={false}
              activityPanel={<CardSortActivityEditor
                activeCropItemId={activeActivityItemCropId}
                cropIcon={<CropIcon />}
                data={normalizeCardSortData(blockForm.cardSort)}
                draftImageCrop={draftImageCrop}
                imageAccept={getAssetPickerAccept("image")}
                items={normalizeCardSortItems(editorActivityItems, normalizeCardSortData(blockForm.cardSort))}
                onApplyCrop={applyActivityItemCrop}
                onBeginCrop={beginActivityItemCrop}
                onCancelCrop={cancelActivityItemCrop}
                onCropChange={setDraftImageCrop}
                onDataChange={(updater) => setBlockForm((current) => ({ ...current, cardSort: updater(normalizeCardSortData(current.cardSort)) }))}
                onItemsChange={(activityItems) => setBlockForm((current) => ({ ...current, activityItems }))}
                onUpdateItem={updateActivityItem}
                onUploadImage={(itemId, file) => void handleUploadActivityItemAsset(itemId, file, "front")}
                renderCategoryRichTextField={({ categoryId, html, label, placeholder }) => renderCardSortRichTextFieldForBlock({ block: selectedBlock, categoryId, field: "categoryLabelHtml", html, label, placeholder })}
                renderGlobalRichTextField={({ field, html, label, placeholder }) => renderCardSortRichTextFieldForBlock({ block: selectedBlock, field, html, label, placeholder })}
                renderImage={(item, alt) => <CroppedImage alt={alt} className="activity-item-image-preview" crop={item.frontImageCrop} rounded={item.imageRounded ?? true} src={buildAssetUrl(currentProjectPath, item.frontImageAssetRef) || ""} />}
                renderImageAltBadge={(item) => renderActivityItemImageAltBadge(item, "front")}
                renderRichTextField={({ className, field, html, item, label, placeholder }) => renderActivityItemEditorRichTextFieldForBlock({ block: selectedBlock, className, field, html, item, label, placeholder })}
                resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef) || ""}
              />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={<div className="tabs-appearance-stack">{activityBackgroundAppearance}{cardSortAppearance}</div>}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "matching" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanelCard={false}
              activityPanel={<MatchingActivityEditor
                data={normalizeMatchingData(blockForm.matching)}
                onChange={(updater) => setBlockForm((current) => ({ ...current, matching: updater(normalizeMatchingData(current.matching)) }))}
                renderRichTextField={({ field, html, pair, label, placeholder }) => renderMatchingRichTextFieldForBlock({ block: selectedBlock, field, html, pairId: pair?.id, label, placeholder })}
              />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={<div className="tabs-appearance-stack">{activityBackgroundAppearance}{matchingAppearance}</div>}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "accordion" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={<AccordionInlineBlockEditor
              activeAnnotationItemId={activeActivityItemAnnotationId}
              activeCropItemId={activeActivityItemCropId}
              collapsedItemIds={collapsedActivityItemIds}
              draftImageCrop={draftImageCrop}
              imageAccept={getAssetPickerAccept("image")}
              isCropMode={isCropMode}
              items={editorActivityItems}
              onAddItem={addActivityItem}
              onApplyCrop={applyActivityItemCrop}
              onBeginAnnotation={(item) => void toggleActivityItemAnnotation(item)}
              onBeginCrop={beginActivityItemCrop}
              onCancelCrop={cancelActivityItemCrop}
              onCropChange={setDraftImageCrop}
              onRemoveItem={removeActivityItem}
              onChange={(patch) => setBlockForm((current) => ({ ...current, ...patch }))}
              onToggleCollapse={toggleActivityItemCollapse}
              onUpdateItem={updateActivityItem}
              onUploadImage={(itemId, file) => void handleUploadActivityItemAsset(itemId, file)}
              renderAnnotationEditor={renderActivityItemAnnotationEditor}
              renderImageAltBadge={renderActivityItemImageAltBadge}
              renderRichTextField={({ className, field, html, item, label, placeholder }) =>
                renderActivityItemEditorRichTextFieldForBlock({
                  block: selectedBlock,
                  className,
                  field,
                  html,
                  item,
                  label,
                  placeholder
                })
              }
              resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef)}
              value={blockForm}
              />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "slides" && (
            <SlidesInlineBlockEditor
              appearanceBackgroundPanel={activityBackgroundAppearance}
              activeAnnotationItemId={activeActivityItemAnnotationId}
              activeCropItemId={activeActivityItemCropId}
              annotationDocuments={activityItemAnnotationDocuments}
              blockImageRounded={blockForm.imageRounded}
              collapsedItemIds={collapsedActivityItemIds}
              draftImageCrop={draftImageCrop}
              imageAccept={getAssetPickerAccept("image")}
              isCropMode={isCropMode}
              items={editorActivityItems}
              normalizeImageSize={normalizeImageSizeToken}
              onAddItem={addActivityItem}
              onAnnotationChange={updateActivityItemAnnotation}
              onApplyAnnotation={applyActivityItemAnnotation}
              onApplyAnnotationEnd={() => setIsAnnotationCommitRunning(false)}
              onApplyAnnotationStart={() => setIsAnnotationCommitRunning(true)}
              onApplyCrop={applyActivityItemCrop}
              onBeginAnnotation={(item) => void toggleActivityItemAnnotation(item)}
              onBeginCrop={beginActivityItemCrop}
              onCancelAnnotation={closeActivityItemAnnotation}
              onCancelCrop={cancelActivityItemCrop}
              onCropChange={setDraftImageCrop}
              onMoveItem={moveActivityItem}
              onRemoveItem={removeActivityItem}
              onStyleChange={(patch) =>
                setBlockForm((current) => ({
                  ...current,
                  buttonTextColor: patch.textColor ?? current.buttonTextColor,
                  panelBackgroundColor: patch.backgroundColor ?? current.panelBackgroundColor,
                  panelBorderColor: patch.accentColor ?? current.panelBorderColor,
                  panelBorderStyle: "solid",
                  panelBorderWidth: patch.borderWidth ?? current.panelBorderWidth,
                  panelRounded: patch.rounded ?? current.panelRounded,
                  panelShadow: patch.shadow ?? current.panelShadow
                }))
              }
              onActivityAppearanceChange={(patch) =>
                setBlockForm((current) => ({
                  ...current,
                  slidesActivityBackgroundColor:
                    patch.backgroundColor ?? current.slidesActivityBackgroundColor,
                  slidesActivityBorderColor: patch.borderColor ?? current.slidesActivityBorderColor,
                  slidesActivityBorderWidth: patch.borderWidth ?? current.slidesActivityBorderWidth,
                  slidesActivityBorderStyle: patch.borderStyle ?? current.slidesActivityBorderStyle,
                  slidesActivityRounded: patch.rounded ?? current.slidesActivityRounded,
                  slidesActivityShadow: patch.shadow ?? current.slidesActivityShadow
                }))
              }
              onToggleCollapse={toggleActivityItemCollapse}
              onUpdateItem={updateActivityItem}
              onUploadItemAsset={(itemId, file) => void handleUploadActivityItemAsset(itemId, file)}
              renderImageAltBadge={renderActivityItemImageAltBadge}
              resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef)}
              style={{
                accentColor: blockForm.panelBorderColor || "#F5F5F5",
                textColor: blockForm.buttonTextColor || "#72809F",
                backgroundColor: blockForm.panelBackgroundColor || "#ffffff",
                borderWidth: blockForm.panelBorderWidth || "1px",
                rounded: blockForm.panelRounded,
                shadow: blockForm.panelShadow
              }}
              activityAppearance={{
                backgroundColor: blockForm.slidesActivityBackgroundColor || "#ffffff",
                borderColor: blockForm.slidesActivityBorderColor || "#123a7a",
                borderWidth: blockForm.slidesActivityBorderWidth || "2px",
                borderStyle: blockForm.slidesActivityBorderStyle || "solid",
                rounded: blockForm.slidesActivityRounded,
                shadow: blockForm.slidesActivityShadow
              }}
              tabs={{
                activityLabel: t("editor.activityTab"),
                appearanceLabel: t("editor.appearanceTab"),
                sessionKey: selectedBlock.id
              }}
            />
          )}
          {selectedBlock.type === "situational-dialogue" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={
                <SituationalDialogueInlineBlockEditor
                  block={selectedBlock}
                  titleEditor={renderDialogueBannerTitleField(selectedBlock, blockForm.situationalDialogueTitleHtml ?? "")}
                  characterBankProps={{
                characters: blockForm.situationalDialogueCharacters,
                defaultCharacters: [],
                getAssetDisplayName: assetDisplayName,
                getAssetUrl: (assetRef) => buildAssetUrl(currentProjectPath, assetRef),
                getDefaultPoseOptions: getSituationalDialogueDefaultPoseOptions,
                imageAccept: getAssetPickerAccept("image"),
                isDefaultAssetRef: isDefaultSituationalDialogueCharacterAssetRef,
                onAddPose: addSituationalDialogueCharacterPose,
                onImportDefaultCharacter: addDefaultSituationalDialogueCharacter,
                onImportUserCharacter: () => void addSituationalDialogueBankCharacter(),
                onRemoveCharacter: removeSituationalDialogueCharacter,
                onRemovePose: removeSituationalDialogueCharacterPose,
                onSelectedDefaultCharacterChange: setSelectedDefaultSituationalDialogueCharacterId,
                onSelectedUserCharacterChange: setSelectedSituationalDialogueBankCharacterId,
                onUpdateCharacter: updateSituationalDialogueCharacter,
                onUpdatePose: updateSituationalDialogueCharacterPose,
                onUploadPose: (characterId, poseId, file) =>
                  void handleUploadSituationalDialogueCharacterPose(characterId, poseId, file),
                selectedDefaultCharacterId: selectedDefaultSituationalDialogueCharacterId,
                selectedUserCharacterId: selectedSituationalDialogueBankCharacterId,
                userCharacters: SituationalDialogueBankCharacters
                  }}
                  collapsedItemIds={collapsedActivityItemIds}
                  imageAccept={getAssetPickerAccept("image")}
                  items={editorActivityItems}
                  onAddItem={addActivityItem}
                  onAddResponse={addSituationalDialogueResponse}
                  onAssignCharacter={assignSituationalDialogueCharacterToItem}
                  onRemoveItem={removeActivityItem}
                  onRemoveResponse={removeSituationalDialogueResponse}
                  onToggleCollapse={toggleActivityItemCollapse}
                  onUpdateItem={updateActivityItem}
                  onUpdateResponse={updateSituationalDialogueResponse}
                  onUploadImage={(itemId, file) => void handleUploadActivityItemAsset(itemId, file)}
                  renderRichTextEditor={({ item, field, html, minRows = "medium", placeholder = "" }) =>
                    renderInlineSituationalDialogueItemFieldForBlock(
                      selectedBlock,
                      item,
                      field,
                      html,
                      `situational-dialogue-rich-editor situational-dialogue-rich-editor-${minRows}`,
                      "full",
                      placeholder
                    )
                  }
                  resolveAssetUrl={(assetRef) => buildAssetUrl(currentProjectPath, assetRef)}
                />
              }
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={<>
                <DialogueAppearance layout={blockForm.mediaLayout} color={blockForm.buttonBackgroundColor}
                  bannerColor={blockForm.situationalDialogueBannerColor}
                  onChange={patch => setBlockForm(current => {
                    const next = { ...current, ...patch };
                    blockFormRef.current = next;
                    return next;
                  })} />
                {activityBackgroundAppearance}
              </>}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "media" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={
                <VideoInlineBlockEditor
                  blockId={selectedBlock.id}
                  projectPath={currentProjectPath}
                  optimizationAvailable={videoOptimizationAvailable}
                  subtitleGenerationConfiguration={subtitleGenerationConfiguration}
                  optimizedVideoActive={editorVideoOptimizedActive}
                  originalVideoAvailable={Boolean(selectedBlock.videoOriginalAssetRef)}
                  onChange={(patch) => setBlockForm((current) => ({ ...current, ...patch }))}
                  onSubtitleRemove={removeSelectedVideoSubtitle}
                  onVideoPathUpload={handleUploadSelectedVideoPath}
                  onVideoRemove={removeSelectedVideoMedia}
                  onWorkspaceChange={onVideoWorkspaceChange}
                  onSubtitleUpload={(file) => handleUploadSelectedBlockAsset(file, "subtitle")}
                  onSubtitleEdit={(file) => handleUploadSelectedBlockAsset(file, "subtitle-edit")}
                  subtitleAccept={getAssetPickerAccept("subtitle")}
                  subtitleFileName={displayedSubtitleFileName}
                  subtitleSrc={editorSubtitleAsset}
                  originalSubtitleSrc={editorOriginalSubtitleAsset}
                  value={blockForm}
                  videoAccept={getAssetPickerAccept("video")}
                  videoFileName={displayedVideoFileName}
                  videoSrc={editorVideoAsset}
                />
              }
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "image-360" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={<Image360InlineBlockEditor
              currentPitch={image360CurrentView.pitch}
              currentYaw={image360CurrentView.yaw}
              imageAccept={getAssetPickerAccept("image")}
              imageName={displayedMediaFileName}
              imageSrc={editorImage360Asset || DEFAULT_IMAGE360_ASSET}
              imageAltBadge={<ImageAltBadge accessibility={blockForm.imageAccessibility} className="in-flow" onClick={editBlockImageAlt} />}
              onChange={(updater) =>
                setBlockForm((current) => ({
                  ...current,
                  ...updater(current)
                }))
              }
              onRemoveImage={() => void removeSelectedBlockImage()}
              renderHotspotRichTextField={({ className, field, hotspotId, html, label, onCommit, placeholder }) =>
                renderInlineImage360HotspotFieldForBlock({
                  block: selectedBlock,
                  hotspotId,
                  field,
                  html,
                  className,
                  label,
                  onCommit,
                  placeholder
                })
              }
              onStartHotspotPick={(hotspotId) => setPickingImage360HotspotId(hotspotId ?? null)}
              onUploadImage={(file) => void handleUploadSelectedBlockAsset(file, "media")}
              value={blockForm}
              />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          )}
          {selectedBlock.type === "audio" && (
            <ActivityEditorTabs
              activityLabel={t("editor.activityTab")}
              activityPanel={<AudioInlineBlockEditor
              accentColor={audioAccentColor(blockForm)}
              audioAccept={getAssetPickerAccept("audio")}
              coverAccept={getAssetPickerAccept("image")}
              coverCrop={blockForm.imageCrop}
              coverName={displayedMediaFileName}
              coverSrc={editorImageAsset}
              coverTitle={blockForm.title}
              getTrackAudioName={(track) => assetDisplayName(firstItemAudioAssetRef(track)) || track.mediaFileName || ""}
              getTrackAudioSrc={(track) => buildAssetUrl(currentProjectPath, firstItemAudioAssetRef(track))}
              onAccentColorChange={(value) =>
                setBlockForm((current) => ({
                  ...current,
                  buttonTextColor: value,
                  panelBorderColor: current.panelBorderColor || value
                }))
              }
              onAddTrack={addActivityItem}
              onChange={(patch) => setBlockForm((current) => ({ ...current, ...patch }))}
              onCoverUpload={(file) => void handleUploadSelectedBlockAsset(file, "media")}
              onMoveTrack={(trackId, delta) => moveActivityItem(trackId, delta > 0 ? 1 : -1)}
              onRemoveCover={() => void removeSelectedBlockImage()}
              onRemoveTrack={removeActivityItem}
              onRemoveTrackAudio={(trackId) => {
                const track = editorActivityItems.find((item) => item.id === trackId);
                updateActivityItem(trackId, {
                  assetRefs: (track?.assetRefs ?? []).filter((assetRef) => !isSupportedAudioAsset(assetRef)),
                  mediaFileName: null,
                  transcriptHtml: null,
                  transcriptLanguage: null,
                  transcriptSource: null,
                  transcriptStatus: null,
                  transcriptAllowDownload: false
                });
              }}
              onUploadTrackAudio={(trackId, file) => void handleUploadActivityItemAsset(trackId, file).then(() => updateActivityItem(trackId, {
                transcriptHtml: null,
                transcriptLanguage: null,
                transcriptSource: null,
                transcriptStatus: null,
                transcriptAllowDownload: false
              }))}
              renderTranscriptControls={(track) => {
                const assetRef = firstItemAudioAssetRef(track);
                return assetRef ? (
                  <TranscriptAuthoringControls
                    assetRef={assetRef}
                    blockId={`${selectedBlock.id}-${track.id}`}
                    configuration={subtitleGenerationConfiguration}
                    onChange={(patch) => updateActivityItem(track.id, patch)}
                    projectPath={currentProjectPath}
                    value={track}
                  />
                ) : null;
              }}
              tracks={editorActivityItems}
              value={blockForm}
              />}
              appearanceLabel={t("editor.appearanceTab")}
              appearancePanel={activityBackgroundAppearance}
              sessionKey={selectedBlock.id}
            />
          )}
        </div>

        <InlineBlockEditorActions
          onCancel={() => void cancelBlockEditing()}
          onSave={() => void handleSaveBlock()}
          saving={busyAction === "save-block"}
        />
      </div>
    );
}
