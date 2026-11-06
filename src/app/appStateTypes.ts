import type {
  ActivityItem,
  AttachmentFile,
  Image360Hotspot,
  ImageCrop,
  ImageAccessibility,
  PointOfInterestMarker,
  FindElementsActivityData,
  CompleteActivityData,
  CardSortActivityData,
  MatchingActivityData,
  NoteIconId,
  LibraryProjectEntry,
  PaideiaBlock,
  QuizActivityData,
  SituationalDialogueCharacter
} from "../types/project";
import type { RichTextToolbarProfile } from "../components/rich-text-toolbar/RichTextToolbar";
import type { ChapterEntry } from "./projectSelectors";

export type BlockFormState = {
  title: string;
  summary: string;
  blockType: string;
  contentHtml: string;
  quoteAuthorHtml: string;
  quoteShowAuthor: boolean;
  mediaLayout: string;
  imageSize: string;
  contentWidth: string;
  contentAlign: string;
  mediaGap: string;
  verticalAlign: string;
  imageRounded: boolean;
  mediaFileName: string;
  imageCrop: ImageCrop | null;
  imageAccessibility: ImageAccessibility | null;
  imageAnnotationStateRef?: string | null;
  imageAnnotationSourceAssetRef?: string | null;
  videoCaptionColor: string;
  videoCaptionBackgroundEnabled: boolean;
  videoCaptionOutline: "none" | "thin" | "thick";
  videoAllowFullscreen: boolean;
  audioAutoplayNext: boolean;
  audioAllowDownload: boolean;
  image360InitialYaw: number;
  image360InitialPitch: number;
  image360ZoomEnabled: boolean;
  image360FullWidth: boolean;
  image360AllowFullscreen: boolean;
  headerBackgroundColor: string;
  headerTextColor: string;
  headerTextOutline: "none" | "thin" | "medium" | "thick";
  headerTextOutlineColor: "light" | "dark";
  headerHeight: string;
  headerImagePositionY: number;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  panelBackgroundColor: string;
  panelBorderColor: string;
  panelBorderWidth: string;
  panelBorderStyle: string;
  panelPadding: string;
  panelRounded: boolean;
  panelShadow: boolean;
  noteIcon: NoteIconId;
  noteShowIcon: boolean;
  noteIconColor: string;
  noteIconMatchesBorder: boolean;
  flipCardFrontBackgroundColor: string;
  flipCardBackBackgroundColor: string;
  flipCardFrontBorderColor: string;
  flipCardBackBorderColor: string;
  slidesActivityBackgroundColor: string;
  slidesActivityBorderColor: string;
  slidesActivityBorderWidth: string;
  slidesActivityBorderStyle: string;
  slidesActivityRounded: boolean;
  slidesActivityShadow: boolean;
  sectionBackgroundColor: string;
  sectionBackgroundImageRef: string;
  sectionBackgroundOpacity: number;
  sectionBackgroundOverlayDark: boolean;
  sectionBackgroundBlur: number;
  sectionBackgroundPositionY: number;
  sectionBackgroundRounded: boolean;
  sectionBackgroundWide: boolean;
  sectionBackgroundHeight: "minimum" | "medium" | "large";
  dividerColor: string;
  dividerWidth: string;
  dividerStyle: string;
  markerScheme: string;
  markerTextColor: string;
  markerType: string;
  pointOfInterestMarkers: PointOfInterestMarker[];
  image360Hotspots: Image360Hotspot[];
  activityItems: ActivityItem[];
  situationalDialogueCharacters: SituationalDialogueCharacter[];
  attachmentFiles: AttachmentFile[];
  quiz: QuizActivityData | null;
  findElements: FindElementsActivityData | null;
  complete: CompleteActivityData | null;
  cardSort?: CardSortActivityData | null;
  matching?: MatchingActivityData | null;
  markerPopupWidth: string;
  markerPopupHeight: string;
};

export type PointerDragState = {
  kind: "new" | "move" | "favorite";
  label: string;
  blockType?: string;
  blockId?: string;
  favoriteType?: string;
  favoriteIndex?: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
};

export type ChapterPointerDragState = {
  chapterId: string;
  moduleId: string;
  sourceIndex: number;
  label: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
};

export type PaddingControlDragState = {
  blockId: string;
  pageId: string;
  startY: number;
  startOffset: number;
  currentOffset: number;
  basePadding: number;
  minimumPadding: number;
  maximumPadding: number | null;
  startHeaderHeight: number | null;
  currentHeaderHeight: number | null;
};

export type DeleteChapterDialogState = {
  entry: ChapterEntry;
  projectId: string;
  projectPath: string;
};

export type DeleteBlockDialogState = {
  pageId: string;
  block: PaideiaBlock;
};

export type ActivityClipboardState = {
  sourceProjectPath: string;
  sourceProjectId: string;
  sourceProjectTitle: string;
  block: PaideiaBlock;
  label: string;
  copiedAt: number;
};

export type CopyActivityDialogState = {
  block: PaideiaBlock;
};

export type PasteActivityDialogState = {
  targetIndex: number;
  mode: "paste" | "empty";
};

export type QuizLmsConflictDialogState = {
  currentBlockId: string;
  replacementBlockId: string;
  replacementPageId: string;
  replacementTitle: string;
};

export type ImportDialogState = {
  status: "running" | "done" | "error";
  title?: string;
  allowBackground?: boolean;
  backgroundLabel?: string;
  runningNote?: string;
  doneTitle?: string;
  message?: string;
  closeLabel?: string;
  reportContent?: string;
  reportPath?: string;
  reportTitle?: string;
  reportVisible?: boolean;
  reportKind?: "import" | "metrology" | "changelog";
  reportSecondarySectionMarker?: string;
  reportRows?: Array<{
    title: string;
    location: string;
    result: string;
    details: string[];
    level: "ok" | "warning" | "error";
  }>;
  reportDownloadName?: string;
};

export type CharacterPackageConflictDialogState = {
  packagePath: string;
  conflicts: Array<{
    portableId: string;
    name: string;
    existingName: string;
  }>;
};

export type AnnotationCropWarningDialogState = {
  item: ActivityItem;
};

export type EditorOriginalMediaState = {
  blockId: string;
  assetRefs: string[];
  subtitleRefs: string[];
  videoSubtitleOriginalRef: string | null;
  mediaFileName: string;
  imageCrop: ImageCrop | null;
  activityItems: ActivityItem[];
};

export type PendingBlockMediaDraftState = {
  blockId: string;
  assetRefs?: string[];
  mediaFileName: string;
  imageCrop: ImageCrop | null;
};

export type ProjectTab = {
  path: string;
  title: string;
  archivePath?: string;
};

export type EnlargedImageState = {
  src: string;
  alt: string;
  rounded?: boolean;
};

export type Image360HotspotInlineField = "title" | "contentHtml";
export type PointOfInterestMarkerRichTextField = "title" | "contentHtml";
export type ActivityItemEditorRichTextField = "title" | "contentHtml" | "frontText" | "cardFeedbackHtml" | "cardFeedbackCorrectHtml" | "cardFeedbackIncorrectHtml";
export type FindElementsZoneRichTextField = "descriptionHtml" | "riskHtml" | "correctionHtml";

export type InlineRichTextEditState = {
  blockId: string;
  itemId?: string | null;
  itemField?: string | null;
  profile?: RichTextToolbarProfile;
  toolbarPlacement?: "above" | "below";
  originalHtml: string;
  currentHtml: string;
  lastSavedHtml: string;
  snapshotCreated: boolean;
};

export type PendingInlineStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  outline?: "auto" | "none";
    color?: string | null;
    backgroundColor?: string | null;
  fontSize?: string | null;
  fontFamily?: string | null;
};

export type RichEditorSelectionBookmark = {
  cellPath?: number[];
  cellAnchorOffset?: number;
  cellFocusOffset?: number;
  anchorOffset: number;
  focusOffset: number;
  anchorPath?: number[];
  anchorNodeOffset?: number;
  focusPath?: number[];
  focusNodeOffset?: number;
};

export type LibraryActionMenuState = {
  type: "project" | "collection";
  id: string;
};

export type ScormBatchProgressState = {
  collection: string;
  current: number;
  total: number;
  lessonTitle: string;
};

export type ScormBatchSummaryState = {
  title: string;
  collection: string;
  exportedCount: number;
  totalCount: number;
  errors: string[];
  destinationRoot?: string;
};

export type PdfExportDialogState = {
  status: "running" | "done" | "error";
  lessonTitle: string;
  phase?: "loading" | "fonts" | "assets" | "document" | "finalizing" | "saving";
  targetPath?: string;
  message?: string;
};

export type DeleteLibraryProjectDialogState = {
  entry: LibraryProjectEntry;
};

export type RenameLibraryProjectDialogState = {
  entry: LibraryProjectEntry;
  value: string;
};

export type CreateLessonDialogState = {
  value: string;
  mode: "open" | "create-only";
};

export type CreateLibraryCollectionDialogState = {
  value: string;
};

export type HamburgerPanel = "projects" | "settings" | "collaboration" | "add-ons" | "info" | null;
export type DeleteUserCharacterDialogState = {
  id: string;
  name: string;
};

export type DeleteUserFontDialogState = {
  id: string;
  name: string;
  projectPath?: string;
};
