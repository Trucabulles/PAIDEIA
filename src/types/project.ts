export type PointOfInterestMarkerMedia = {
  type: "image" | "video" | "audio";
  assetRef: string;
  fileName: string;
  posterAssetRef?: string | null;
  subtitleAssetRef?: string | null;
  originalAssetRef?: string | null;
  optimizedAssetRef?: string | null;
  optimizationProfile?: string | null;
  imageAccessibility?: ImageAccessibility | null;
  transcriptHtml?: string | null;
  transcriptLanguage?: string | null;
  transcriptSource?: "manual" | "whisper" | "imported" | null;
  transcriptStatus?: "draft" | "validated" | null;
  transcriptAllowDownload?: boolean | null;
};

export type PointOfInterestMarker = {
  id: string;
  x: number;
  y: number;
  order: number;
  label: string;
  title: string;
  contentHtml: string;
  icon?: string | null;
  color?: string | null;
  media?: PointOfInterestMarkerMedia | null;
};

export type Image360Hotspot = {
  id: string;
  yaw: number;
  pitch: number;
  order: number;
  title: string;
  contentHtml: string;
  color?: string | null;
};

export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: "rectangle" | "ellipse";
};

export type NativeImageAnnotationPoint = {
  x: number;
  y: number;
};

export type NativeImageAnnotationStrokeStyle = {
  color: string;
  opacity: number;
  width: number;
};

export type NativeImageAnnotationFillStyle = {
  color: string;
  opacity: number;
};

export type NativeImageAnnotationTextStyle = {
  backgroundColor: string;
  backgroundOpacity: number;
  color: string;
  fontSize: number;
};

type NativeImageAnnotationBase = {
  id: string;
  blurAmount: number;
  blurEnabled: boolean;
  createdAt: number;
  fill: NativeImageAnnotationFillStyle;
  stroke: NativeImageAnnotationStrokeStyle;
  text: NativeImageAnnotationTextStyle;
  updatedAt: number;
};

export type NativeImagePathAnnotation = NativeImageAnnotationBase & {
  kind: "path";
  points: NativeImageAnnotationPoint[];
};

export type NativeImageLineAnnotation = NativeImageAnnotationBase & {
  kind: "line";
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

export type NativeImageRectAnnotation = NativeImageAnnotationBase & {
  kind: "rect";
  height: number;
  width: number;
  x: number;
  y: number;
};

export type NativeImageEllipseAnnotation = NativeImageAnnotationBase & {
  kind: "ellipse";
  height: number;
  width: number;
  x: number;
  y: number;
};

export type NativeImageTextAnnotation = NativeImageAnnotationBase & {
  content: string;
  kind: "text";
  height: number;
  width: number;
  x: number;
  y: number;
};

export type NativeImageIconAnnotation = NativeImageAnnotationBase & {
  height: number;
  iconFlipX?: boolean;
  iconFlipY?: boolean;
  iconRotation?: number;
  iconType: "arrow" | "arrow2" | "arrow3" | "star" | "position" | "bubble";
  kind: "icon";
  width: number;
  x: number;
  y: number;
};

export type NativeImageAnnotation =
  | NativeImagePathAnnotation
  | NativeImageLineAnnotation
  | NativeImageRectAnnotation
  | NativeImageEllipseAnnotation
  | NativeImageIconAnnotation
  | NativeImageTextAnnotation;

export type NativeImageAnnotationDocument = {
  annotations: NativeImageAnnotation[];
  version: 1;
};

export type ImageAccessibility = {
  altText: string;
  decorative: boolean;
};

export type ActivityItem = {
  id: string;
  title: string;
  kind?: "intro" | "step" | "summary" | "result-success" | "result-failure";
  nodeType?: string | null;
  situationalDialogueIntroductionVisible?: boolean;
  characterId?: string | null;
  characterName?: string | null;
  characterRole?: string | null;
  situationalDialoguePoseRefs?: Record<string, string | null | undefined> | null;
  emotion?: string | null;
  nextNodeId?: string | null;
  responses?: SituationalDialogueResponse[];
  dateLabel?: string | null;
  contentTitle?: string | null;
  timeColor?: string | null;
  titleColor?: string | null;
  accentColor?: string | null;
  contentHtml: string;
  assetRefs?: string[];
  mediaFileName?: string | null;
  mediaLayout?: string | null;
  imageSize?: string | null;
  imageRounded?: boolean | null;
  imageCrop?: ImageCrop | null;
  imageAccessibility?: ImageAccessibility | null;
  imageAnnotationStateRef?: string | null;
  imageAnnotationSourceAssetRef?: string | null;
  frontType?: "text" | "image";
  frontText?: string;
  frontImageAssetRef?: string | null;
  frontImageFileName?: string | null;
  frontImageCrop?: ImageCrop | null;
  frontImageAccessibility?: ImageAccessibility | null;
  backType?: "text" | "image";
  backTitle?: string;
  backImageAssetRef?: string | null;
  backImageFileName?: string | null;
  backImageCrop?: ImageCrop | null;
  backImageAccessibility?: ImageAccessibility | null;
  resourceUrl?: string | null;
  resourceRawDestination?: string | null;
  resourceOpenMode?: "new-tab" | "same-window" | null;
  resourceValid?: boolean | null;
  correctCategoryId?: string | null;
  cardBackgroundColor?: string | null;
  cardFeedbackHtml?: string | null;
  cardFeedbackCorrectHtml?: string | null;
  cardFeedbackIncorrectHtml?: string | null;
  transcriptHtml?: string | null;
  transcriptLanguage?: string | null;
  transcriptSource?: "manual" | "whisper" | "imported" | null;
  transcriptStatus?: "draft" | "validated" | null;
  transcriptAllowDownload?: boolean | null;
};

export type ResourceAction = {
  id: string;
  label: string;
  descriptionHtml: string;
  url: string;
  rawDestination?: string | null;
  openMode: "new-tab" | "same-window";
  valid: boolean;
};

export type LinksResourcesActivityData = {
  title: string;
  introHtml: string;
  afterHtml: string;
  actions: ResourceAction[];
};

export type SituationalDialogueResponse = {
  id: string;
  label: string;
  feedbackHtml?: string | null;
  action?: "continue" | "tryAgain" | string | null;
  emotion?: string | null;
  nextNodeId?: string | null;
};

export type SituationalDialogueCharacterPose = {
  id: string;
  label: string;
  state?: "question" | "neutral" | "positive" | "negative" | string | null;
  usage?: "introduction" | "question" | "conclusion" | "response" | "neutral" | string | null;
  emotion?: string | null;
  assetRef?: string | null;
};

export type SituationalDialogueCharacter = {
  id: string;
  name: string;
  defaultCharacterId?: string | null;
  role?: string | null;
  description?: string | null;
  showNameRole?: boolean | null;
  backgroundRef?: string | null;
  defaultPoseId?: string | null;
  poses: SituationalDialogueCharacterPose[];
};

export type AttachmentFile = {
  id: string;
  displayName: string;
  storedName: string;
  extension: string;
  assetRef: string;
  sizeBytes?: number | null;
  openInNewTab?: boolean | null;
};

export type QuizQuestionMode = "single" | "multiple" | "true-false";
export type QuizReviewMode = "disabled" | "after-pass" | "after-attempts";
export type LessonScormStatus = "completed" | "incomplete" | "passed" | "failed";
export type ChapterScormTrackingMode = "completion" | "quiz-blocking" | "quiz-certification" | "advanced";

export type ChapterScormTracking = {
  mode: ChapterScormTrackingMode;
  successStatus: "completed" | "passed";
  failureStatus: "incomplete" | "failed";
};

export type QuizAnswer = {
  id: string;
  textHtml: string;
  correct: boolean;
  feedbackHtml?: string | null;
  creditPercent?: number | null;
};

export type QuizQuestion = {
  id: string;
  sourceQuestionId?: string | null;
  sourceBankId?: string | null;
  mode: QuizQuestionMode;
  creditMode?: "equal" | "custom" | null;
  questionHtml: string;
  answers: QuizAnswer[];
  generalFeedbackHtml?: string | null;
  feedbackCorrectHtml?: string | null;
  feedbackIncorrectHtml?: string | null;
  points: number;
};

export type QuizSettings = {
  shuffleAnswers: boolean;
  shuffleQuestions: boolean;
  limitQuestions: boolean;
  questionLimit: number;
  showFeedback: boolean;
  showCorrectness?: boolean;
  showCorrectAnswer: boolean;
  allowRetry: boolean;
  maxAttempts: number;
  passingScore: number;
  reviewMode: QuizReviewMode;
  reviewAfterAttempts: number;
  sendScoreToLms: boolean;
  gateChapterUntilPassed: boolean;
};

export type QuizActivityData = {
  titleHtml: string;
  titleMode?: "auto" | "custom";
  introHtml: string;
  startLeadHtml: string;
  questions: QuizQuestion[];
  settings: QuizSettings;
};

export type FindElementsPoint = {
  x: number;
  y: number;
};

export type FindElementsSeverity = "sans" | "faible" | "moyen" | "important" | "critique";

export type FindElementsZone = {
  id: string;
  shape: "rectangle" | "polygon";
  title: string;
  severity: FindElementsSeverity;
  descriptionHtml: string;
  riskHtml: string;
  correctionHtml: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: FindElementsPoint[];
};

export type FindElementsLabels = {
  description: string;
  risk: string;
  correction: string;
};

export type FindElementsImageAppearance = {
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  rounded: boolean;
  shadow: boolean;
};

export type FindElementsActivityData = {
  imageAppearance: FindElementsImageAppearance;
  maxAttempts: number;
  successThreshold: number;
  labels: FindElementsLabels;
  zones: FindElementsZone[];
};

export type CompleteBlank = {
  id: string;
  answer: string;
  variants: string[];
  caseSensitive: boolean;
};

export type CompleteExercise = {
  id: string;
  contentHtml: string;
  blanks: CompleteBlank[];
};

export type CompleteCover = {
  enabled: boolean;
  titleHtml: string;
  descriptionHtml: string;
};

export type CompleteEnding = {
  successHtml: string;
  failureHtml: string;
};

export type CompleteActivityData = {
  revealAnswersOnFinalReview?: boolean;
  orientation?: "portrait" | "landscape";
  cover: CompleteCover;
  ending: CompleteEnding;
  exercises: CompleteExercise[];
  maxAttempts: number;
  successThreshold: number;
  gateChapterUntilPassed: boolean;
};

export type CardSortCategory = {
  id: string;
  label: string;
  labelHtml: string;
  borderColor: string;
};

export type CardSortAppearance = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: string;
  rounded: boolean;
};

export type CardSortActivityData = {
  categories: CardSortCategory[];
  maxAttempts: number;
  successThreshold: number;
  gateChapterUntilPassed: boolean;
  interactionMode: "direct" | "feedback";
  successFeedbackHtml: string;
  failureFeedbackHtml: string;
  cardAppearance: CardSortAppearance;
};

export type MatchingPair = {
  id: string;
  leftId: string;
  rightId: string;
  leftHtml: string;
  rightHtml: string;
  leftBackgroundColor?: string | null;
  rightBackgroundColor?: string | null;
};

export type MatchingAppearance = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: string;
  rounded: boolean;
};

export type MatchingActivityData = {
  pairs: MatchingPair[];
  maxAttempts: number;
  successThreshold: number;
  showAttemptFeedback: boolean;
  successFeedbackHtml: string;
  failureFeedbackHtml: string;
  labelAppearance: MatchingAppearance;
};

export type QuestionBankQuestion = QuizQuestion & {
  title?: string | null;
  category?: string | null;
  tags?: string[];
};

export type QuestionBankResource = {
  resourceModifiedAt?: number | null;
  contentLoaded?: boolean;
  contentCount?: number;
  id: string;
  name: string;
  tileImageRef?: string | null;
  questions: QuestionBankQuestion[];
};

export type ReferenceBankEntry = {
  id: string;
  term: string;
  definitionHtml: string;
};

export type LessonReferenceBank = {
  id: string;
  name: string;
  tileImageRef?: string | null;
  sourceResourceId?: string | null;
  sourceRevision?: number | null;
  sourceContentHash?: string | null;
  entries: ReferenceBankEntry[];
};

export type ReferenceBankResource = {
  resourceModifiedAt?: number | null;
  contentLoaded?: boolean;
  contentCount?: number;
  id: string;
  name: string;
  tileImageRef?: string | null;
  revision: number;
  entries: ReferenceBankEntry[];
  projectPaths: string[];
  collectionIds: string[];
};

export type NoteIconId = "info-circle" | "no-entry" | "exclamation-circle" | "prohibition" | "warning-triangle" | "check-circle" | "check";

export type PaideiaBlock = {
  situationalDialogueTitleHtml?: string | null;
  situationalDialogueBannerColor?: string | null;
  situationalDialogueFraming?: SituationalDialogueFraming[];
  id: string;
  type: string;
  family?: string | null;
  variant?: string | null;
  title: string;
  summary: string;
  contentHtml?: string | null;
  quoteAuthorHtml?: string | null;
  quoteShowAuthor?: boolean | null;
  htmlAssetRoot?: string | null;
  htmlEntryFile?: string | null;
  htmlPackageName?: string | null;
  mediaLayout?: string | null;
  imageSize?: string | null;
  contentWidth?: string | null;
  contentAlign?: string | null;
  mediaGap?: string | null;
  verticalAlign?: string | null;
  imageRounded?: boolean | null;
  mediaFileName?: string | null;
  imageCrop?: ImageCrop | null;
  imageAccessibility?: ImageAccessibility | null;
  imageAnnotationStateRef?: string | null;
  imageAnnotationSourceAssetRef?: string | null;
  videoCaptionColor?: string | null;
  videoCaptionBackgroundEnabled?: boolean | null;
  videoCaptionOutline?: "none" | "thin" | "thick" | null;
  videoSubtitleOriginalRef?: string | null;
  videoOriginalAssetRef?: string | null;
  videoOptimizedAssetRef?: string | null;
  videoOptimizationProfile?: string | null;
  videoAllowFullscreen?: boolean | null;
  audioAutoplayNext?: boolean | null;
  audioAllowDownload?: boolean | null;
  image360InitialYaw?: number | null;
  image360InitialPitch?: number | null;
  image360ZoomEnabled?: boolean | null;
  image360FullWidth?: boolean | null;
  image360AllowFullscreen?: boolean | null;
  headerBackgroundColor?: string | null;
  headerTextColor?: string | null;
  headerTextOutline?: "none" | "thin" | "medium" | "thick" | null;
  headerTextOutlineColor?: "light" | "dark" | null;
  headerHeight?: string | null;
  headerImagePositionY?: number | null;
  buttonBackgroundColor?: string | null;
  buttonTextColor?: string | null;
  panelBackgroundColor?: string | null;
  panelBorderColor?: string | null;
  panelBorderWidth?: string | null;
  panelBorderStyle?: string | null;
  panelPadding?: string | null;
  panelRounded?: boolean | null;
  panelShadow?: boolean | null;
  noteIcon?: NoteIconId | null;
  noteShowIcon?: boolean | null;
  noteIconColor?: string | null;
  noteIconMatchesBorder?: boolean | null;
  flipCardFrontBackgroundColor?: string | null;
  flipCardBackBackgroundColor?: string | null;
  flipCardFrontBorderColor?: string | null;
  flipCardBackBorderColor?: string | null;
  slidesActivityBackgroundColor?: string | null;
  slidesActivityBorderColor?: string | null;
  slidesActivityBorderWidth?: string | null;
  slidesActivityBorderStyle?: string | null;
  slidesActivityRounded?: boolean | null;
  slidesActivityShadow?: boolean | null;
  sectionBackgroundColor?: string | null;
  sectionBackgroundImageRef?: string | null;
  sectionBackgroundOpacity?: number | null;
  sectionBackgroundOverlayDark?: boolean | null;
  sectionBackgroundBlur?: number | null;
  sectionBackgroundPositionY?: number | null;
  sectionBackgroundRounded?: boolean | null;
  sectionBackgroundShadow?: "inherit" | "on" | "off" | null;
  sectionBackgroundWide?: boolean | null;
  sectionBackgroundHeight?: "minimum" | "medium" | "large" | null;
  dividerColor?: string | null;
  dividerWidth?: string | null;
  dividerStyle?: string | null;
  markerScheme?: string | null;
  markerTextColor?: string | null;
  markerType?: string | null;
  pointOfInterestMarkers?: PointOfInterestMarker[];
  image360Hotspots?: Image360Hotspot[];
  activityItems?: ActivityItem[];
  situationalDialogueCharacters?: SituationalDialogueCharacter[];
  attachmentFiles?: AttachmentFile[];
  quiz?: QuizActivityData | null;
  findElements?: FindElementsActivityData | null;
  complete?: CompleteActivityData | null;
  cardSort?: CardSortActivityData | null;
  matching?: MatchingActivityData | null;
  markerPopupWidth?: string | null;
  markerPopupHeight?: string | null;
  paddingOffset?: number | null;
  trackingKey: string;
  sourceFormat?: string | null;
  sourceBlockType?: string | null;
  sourceRawHtml?: string | null;
  assetRefs?: string[];
  richInlineAssetRefs?: string[];
  subtitleRefs?: string[];
};

export type PaideiaPage = {
  id: string;
  title: string;
  blocks: PaideiaBlock[];
};

export type PaideiaChapter = {
  id: string;
  title: string;
  pages: PaideiaPage[];
  scormTracking?: ChapterScormTracking | null;
};

export type PaideiaModule = {
  id: string;
  title: string;
  chapters: PaideiaChapter[];
};

export type PaideiaCourse = {
  id: string;
  title: string;
  modules: PaideiaModule[];
};

export type GlossaryAssistantEntry = {
  id: string;
  term: string;
  aliases: string[];
  contentHtml: string;
  related: string[];
  fuzzy: boolean;
};

export type GlossaryAssistantResource = {
  resourceModifiedAt?: number | null;
  contentLoaded?: boolean;
  contentCount?: number;
  id: string;
  name: string;
  avatarRef?: string | null;
  entries: GlossaryAssistantEntry[];
  fallbackResponses: string[];
  caseInsensitive: boolean;
  ignoreAccents: boolean;
  fuzzyEnabled: boolean;
  fuzzyThreshold: number;
  assistantEnabled: boolean;
  alwaysVisible: boolean;
  position: "bottom-left" | "bottom-right";
  shortcut: string;
  lessonIds: string[];
  collectionIds: string[];
  projectPaths?: string[];
};

export type PaideiaProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  keywords?: string[];
  courseIntroHtml?: string | null;
  titleStyle?: CourseTitleStyle | null;
  customFont?: LessonCustomFont | null;
  importedFonts?: LessonCustomFont[];
  courseImageRef?: string | null;
  courseCoverTitleHtml?: string | null;
  courseCoverStyle?: CourseCoverStyle | null;
  activitySpacingPx?: number | null;
  hideChapterTitleBanner?: boolean;
  courseAppearance?: CourseAppearance | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  defaultLocale: string;
  locales: string[];
  status: string;
  currentVersion: string;
  rootCourseId: string;
  course: PaideiaCourse;
  glossaryAssistants?: GlossaryAssistantResource[];
  questionBanks?: QuestionBankResource[];
  referenceBanks?: LessonReferenceBank[];
};

export type AuditEventRecord = {
  id: string;
  projectId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  actorUserId: string;
  actorRole: string;
  timestamp: string;
  machine: string;
  label: string;
  targetPath: string;
  payload: Record<string, unknown>;
  diff: Record<string, unknown>;
};

export type SnapshotRecord = {
  id: string;
  label: string;
  versionTag: string;
  createdAt: string;
  createdBy: string;
  manifestPath: string;
};

export type PaideiaWorkspaceState = {
  readOnly?: boolean;
  project: PaideiaProject;
  auditEvents: AuditEventRecord[];
  snapshots: SnapshotRecord[];
};

export type ProjectMutationResult = {
  projectPath: string;
  workspaceState: PaideiaWorkspaceState;
};

export type ProjectOverview = {
  name: string;
  mode: string;
  storage: string;
  stack: string[];
};

export type LibraryProjectEntry = {
  archivePath: string;
  title: string;
  description: string;
  keywords?: string[];
  updatedAt: string;
  chaptersCount: number;
  activitiesCount: number;
  collection?: string | null;
  courseImagePath?: string | null;
  courseImageDataUrl?: string | null;
  importedFromScorm: boolean;
  hasError: boolean;
  collaborationLibraryId?: string | null;
  collaborationLibraryInstanceId?: string | null;
  collaborationId?: string | null;
};

export type CreateModuleInput = {
  projectPath: string;
  title: string;
};

export type CreateChapterInput = {
  projectPath: string;
  moduleId: string;
  title: string;
};

export type DeleteChapterInput = {
  projectPath: string;
  expectedProjectId: string;
  moduleId: string;
  chapterId: string;
};

export type DeleteBlockInput = {
  projectPath: string;
  pageId: string;
  blockId: string;
};

export type DesignerBlockDeletionTarget = {
  pageId: string;
  blockId: string;
};

export type DeleteDesignerBlocksInput = {
  projectPath: string;
  expectedProjectId: string;
  expectedProjectUpdatedAt: string;
  expectedActivityType?: string | null;
  expectedActivityTypes?: string[] | null;
  excludedActivityTypes?: string[] | null;
  expectedChapterIds?: string[] | null;
  targets: DesignerBlockDeletionTarget[];
  snapshotLabel: string;
  versionTag: string;
  originalCommand: string;
};

export type DeleteDesignerBlocksResult = {
  workspaceState: PaideiaWorkspaceState;
  snapshotId: string;
};

export type UpdateChapterInput = {
  projectPath: string;
  moduleId: string;
  chapterId: string;
  title: string;
  scormTracking?: ChapterScormTracking | null;
};

export type CreatePageInput = {
  projectPath: string;
  moduleId: string;
  chapterId: string;
  title: string;
};

export type CreateBlockInput = {
  situationalDialogueBannerColor?: string | null;
  projectPath: string;
  pageId: string;
  targetIndex?: number | null;
  duplicateSourceBlockId?: string | null;
  blockType: string;
  title: string;
  summary: string;
  contentHtml?: string | null;
  quoteAuthorHtml?: string | null;
  quoteShowAuthor?: boolean | null;
  mediaLayout?: string | null;
  imageSize?: string | null;
  contentWidth?: string | null;
  contentAlign?: string | null;
  mediaGap?: string | null;
  verticalAlign?: string | null;
  imageRounded?: boolean | null;
  mediaFileName?: string | null;
  imageCrop?: ImageCrop | null;
  imageAccessibility?: ImageAccessibility | null;
  videoCaptionColor?: string | null;
  videoCaptionBackgroundEnabled?: boolean | null;
  videoCaptionOutline?: "none" | "thin" | "thick" | null;
  videoSubtitleOriginalRef?: string | null;
  videoAllowFullscreen?: boolean | null;
  audioAutoplayNext?: boolean | null;
  audioAllowDownload?: boolean | null;
  image360InitialYaw?: number | null;
  image360InitialPitch?: number | null;
  image360ZoomEnabled?: boolean | null;
  image360FullWidth?: boolean | null;
  image360AllowFullscreen?: boolean | null;
  headerBackgroundColor?: string | null;
  headerTextColor?: string | null;
  headerTextOutline?: "none" | "thin" | "medium" | "thick" | null;
  headerTextOutlineColor?: "light" | "dark" | null;
  headerHeight?: string | null;
  headerImagePositionY?: number | null;
  buttonBackgroundColor?: string | null;
  buttonTextColor?: string | null;
  panelBackgroundColor?: string | null;
  panelBorderColor?: string | null;
  panelBorderWidth?: string | null;
  panelBorderStyle?: string | null;
  panelPadding?: string | null;
  panelRounded?: boolean | null;
  panelShadow?: boolean | null;
  noteIcon?: NoteIconId | null;
  noteShowIcon?: boolean | null;
  noteIconColor?: string | null;
  noteIconMatchesBorder?: boolean | null;
  flipCardFrontBackgroundColor?: string | null;
  flipCardBackBackgroundColor?: string | null;
  flipCardFrontBorderColor?: string | null;
  flipCardBackBorderColor?: string | null;
  slidesActivityBackgroundColor?: string | null;
  slidesActivityBorderColor?: string | null;
  slidesActivityBorderWidth?: string | null;
  slidesActivityBorderStyle?: string | null;
  slidesActivityRounded?: boolean | null;
  slidesActivityShadow?: boolean | null;
  sectionBackgroundColor?: string | null;
  sectionBackgroundImageRef?: string | null;
  sectionBackgroundOpacity?: number | null;
  sectionBackgroundOverlayDark?: boolean | null;
  sectionBackgroundBlur?: number | null;
  sectionBackgroundPositionY?: number | null;
  sectionBackgroundRounded?: boolean | null;
  sectionBackgroundShadow?: "inherit" | "on" | "off" | null;
  sectionBackgroundWide?: boolean | null;
  sectionBackgroundHeight?: "minimum" | "medium" | "large" | null;
  dividerColor?: string | null;
  dividerWidth?: string | null;
  dividerStyle?: string | null;
  markerScheme?: string | null;
  markerTextColor?: string | null;
  markerType?: string | null;
  pointOfInterestMarkers?: PointOfInterestMarker[];
  image360Hotspots?: Image360Hotspot[];
  activityItems?: ActivityItem[];
  situationalDialogueCharacters?: SituationalDialogueCharacter[];
  attachmentFiles?: AttachmentFile[];
  quiz?: QuizActivityData | null;
  findElements?: FindElementsActivityData | null;
  complete?: CompleteActivityData | null;
  cardSort?: CardSortActivityData | null;
  matching?: MatchingActivityData | null;
  markerPopupWidth?: string | null;
  markerPopupHeight?: string | null;
  paddingOffset?: number | null;
  assetRefs?: string[];
  subtitleRefs?: string[];
};

export type SituationalDialogueFraming = {
  layout: "responses-below" | "compact-portrait";
  asset: string;
  x: number;
  y: number;
  zoom: number;
};

export type UpdateBlockInput = {
  situationalDialogueTitleHtml?: string;
  situationalDialogueBannerColor?: string | null;
  projectPath: string;
  pageId: string;
  blockId: string;
  blockType: string;
  title: string;
  summary: string;
  contentHtml?: string | null;
  quoteAuthorHtml?: string | null;
  quoteShowAuthor?: boolean | null;
  mediaLayout?: string | null;
  imageSize?: string | null;
  contentWidth?: string | null;
  contentAlign?: string | null;
  mediaGap?: string | null;
  verticalAlign?: string | null;
  imageRounded?: boolean | null;
  mediaFileName?: string | null;
  imageCrop?: ImageCrop | null;
  imageAccessibility?: ImageAccessibility | null;
  imageAnnotationStateRef?: string | null;
  imageAnnotationSourceAssetRef?: string | null;
  videoCaptionColor?: string | null;
  videoCaptionBackgroundEnabled?: boolean | null;
  videoCaptionOutline?: "none" | "thin" | "thick" | null;
  videoSubtitleOriginalRef?: string | null;
  videoAllowFullscreen?: boolean | null;
  audioAutoplayNext?: boolean | null;
  audioAllowDownload?: boolean | null;
  image360InitialYaw?: number | null;
  image360InitialPitch?: number | null;
  image360ZoomEnabled?: boolean | null;
  image360FullWidth?: boolean | null;
  image360AllowFullscreen?: boolean | null;
  headerBackgroundColor?: string | null;
  headerTextColor?: string | null;
  headerTextOutline?: "none" | "thin" | "medium" | "thick" | null;
  headerTextOutlineColor?: "light" | "dark" | null;
  headerHeight?: string | null;
  headerImagePositionY?: number | null;
  buttonBackgroundColor?: string | null;
  buttonTextColor?: string | null;
  panelBackgroundColor?: string | null;
  panelBorderColor?: string | null;
  panelBorderWidth?: string | null;
  panelBorderStyle?: string | null;
  panelPadding?: string | null;
  panelRounded?: boolean | null;
  panelShadow?: boolean | null;
  noteIcon?: NoteIconId | null;
  noteShowIcon?: boolean | null;
  noteIconColor?: string | null;
  noteIconMatchesBorder?: boolean | null;
  flipCardFrontBackgroundColor?: string | null;
  flipCardBackBackgroundColor?: string | null;
  flipCardFrontBorderColor?: string | null;
  flipCardBackBorderColor?: string | null;
  slidesActivityBackgroundColor?: string | null;
  slidesActivityBorderColor?: string | null;
  slidesActivityBorderWidth?: string | null;
  slidesActivityBorderStyle?: string | null;
  slidesActivityRounded?: boolean | null;
  slidesActivityShadow?: boolean | null;
  sectionBackgroundColor?: string | null;
  sectionBackgroundImageRef?: string | null;
  sectionBackgroundOpacity?: number | null;
  sectionBackgroundOverlayDark?: boolean | null;
  sectionBackgroundBlur?: number | null;
  sectionBackgroundPositionY?: number | null;
  sectionBackgroundRounded?: boolean | null;
  sectionBackgroundShadow?: "inherit" | "on" | "off" | null;
  sectionBackgroundWide?: boolean | null;
  sectionBackgroundHeight?: "minimum" | "medium" | "large" | null;
  dividerColor?: string | null;
  dividerWidth?: string | null;
  dividerStyle?: string | null;
  markerScheme?: string | null;
  markerTextColor?: string | null;
  markerType?: string | null;
  pointOfInterestMarkers?: PointOfInterestMarker[];
  image360Hotspots?: Image360Hotspot[];
  activityItems?: ActivityItem[];
  situationalDialogueCharacters?: SituationalDialogueCharacter[];
  attachmentFiles?: AttachmentFile[];
  quiz?: QuizActivityData | null;
  findElements?: FindElementsActivityData | null;
  complete?: CompleteActivityData | null;
  cardSort?: CardSortActivityData | null;
  matching?: MatchingActivityData | null;
  markerPopupWidth?: string | null;
  markerPopupHeight?: string | null;
  paddingOffset?: number | null;
  assetRefs?: string[];
  subtitleRefs?: string[];
};

export type UpdateProjectMetadataInput = {
  projectPath: string;
  title: string;
  author: string;
  courseImageRef?: string | null;
  courseCoverTitleHtml?: string | null;
  courseIntroHtml?: string | null;
  titleStyle?: CourseTitleStyle | null;
  customFont?: LessonCustomFont | null;
  importedFonts?: LessonCustomFont[];
  courseCoverStyle?: CourseCoverStyle | null;
  activitySpacingPx?: number | null;
  hideChapterTitleBanner?: boolean | null;
  courseAppearance?: CourseAppearance | null;
};

export type CourseAppearance = {
  roundedCorners: boolean;
  shadows: boolean;
  textColorMode: "default" | "custom";
  textColor: string;
  backgroundColor: string;
};

export type CourseTitleStyle = {
  fontFamily: string;
  fontSize: string;
  color: string;
  fontWeight: string;
  fontStyle: string;
};

export type CourseCoverStyle = {
  heightPx: number;
  backgroundPositionY?: number;
  backgroundColor: string;
  titleColor: string;
  titlePosition?: "left-bottom" | "center" | "center-bottom" | "right-bottom";
  titleAlign?: "left" | "center" | "right" | "justify";
  overlayEnabled: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
  overlayPosition?: "left" | "center" | "right" | "full";
  overlaySpread?: "compact" | "normal" | "wide";
  buttonPosition?: "under-title" | "center-bottom" | "right-bottom";
  titleOutline?: "none" | "thin" | "medium" | "thick";
  titleOutlineColor?: "light" | "dark";
};

export type DesignerBlockChange = {
  pageId: string;
  blockId: string;
  property:
    | "sectionBackgroundHeight"
    | "courseTextColor"
    | "videoCaptionColor"
    | "videoCaptionBackgroundEnabled"
    | "videoCaptionOutline"
    | "videoAllowFullscreen"
    | "textActivityContentHtml"
    | "activityRichTextBlockJson"
    | "paddingOffset"
    | "sectionBackgroundColor"
    | "sectionBackgroundImageRef"
    | "sectionBackgroundOpacity"
    | "sectionBackgroundOverlayDark"
    | "sectionBackgroundBlur"
    | "sectionBackgroundRounded"
    | "sectionBackgroundWide"
    | "panelRounded"
    | "panelBackgroundColor"
    | "panelBorderColor"
    | "panelBorderWidth"
    | "panelBorderStyle"
    | "panelShadow"
    | "activityAccentColor"
    | "matchingLabelBackgroundColor"
    | "matchingLabelRounded"
    | "findElementsImageRounded"
    | "findElementsImageShadow"
    | "slidesActivityBackgroundColor"
    | "slidesActivityRounded"
    | "slidesActivityShadow"
    | "sectionBackgroundShadow"
    | "situationalDialogueBannerColor"
    | "situationalDialogueButtonsColor"
    | "cardSortCardRounded"
    | "dividerColor"
    | "dividerWidth"
    | "dividerStyle"
    | "markerScheme"
    | "markerType"
    | "markerTextColor"
    | "headerBackgroundColor"
    | "headerTextColor"
    | "headerTextOutline"
    | "headerTextOutlineColor"
    | "contentAlign"
    | "continueButtonBackgroundColor"
    | "continueButtonTextColor"
    | "continueButtonLabel";
  value: string;
  unset?: boolean;
};

export type LessonCustomFont = {
  id?: string;
  fontFamily: string;
  fileName: string;
  assetRef: string;
  licenseRef?: string | null;
  source?: "bundled" | "user" | "project" | "legacy" | string;
  faces?: LessonFontFace[];
};

export type LessonFontFace = {
  fileName: string;
  assetRef: string;
  weight: number;
  style: "normal" | "italic";
};

export type CreateSnapshotInput = {
  projectPath: string;
  label: string;
  versionTag: string;
};

export type ImportScormInput = {
  scormZipPath: string;
  destinationRoot: string;
};
