import { listResourceBanks, saveResourceBanks, deleteResourceBank, uploadResourceBankImage } from "./resourceBankApi";
import { invokeCommand } from "./tauri";
import type {
  CreateBlockInput,
  DeleteBlockInput,
  DeleteDesignerBlocksInput,
  DeleteDesignerBlocksResult,
  DeleteChapterInput,
  CreateChapterInput,
  CreateModuleInput,
  CreatePageInput,
  CreateSnapshotInput,
  SnapshotRecord,
  DesignerBlockChange,
  ImportScormInput,
  LibraryProjectEntry,
  LessonCustomFont,
  NativeImageAnnotationDocument,
  PaideiaBlock,
  PaideiaChapter,
  PaideiaProject,
  PaideiaWorkspaceState,
  ProjectOverview,
  ProjectMutationResult,
  QuestionBankResource,
  ReferenceBankResource,
  SituationalDialogueCharacter,
  GlossaryAssistantResource,
  UpdateBlockInput,
  UpdateChapterInput,
  UpdateProjectMetadataInput
} from "../types/project";

const NO_PROJECT_PATH = "";

export type UserSituationalDialogueCharacterDefinition = {
  resourceModifiedAt?: number | null;
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  previewRef?: string | null;
  poses: Array<{
    state: string;
    label: string;
    assetRef: string;
  }>;
};

export type CharacterPackageInspection = {
  characterCount: number;
  names: string[];
  conflicts: Array<{ portableId: string; name: string; existingName: string }>;
};

export type CharacterPackageImportResult = {
  characters: UserSituationalDialogueCharacterDefinition[];
  importedCount: number;
  updatedCount: number;
  copiedCount: number;
};

export type UserGlossaryAssistantDefinition = GlossaryAssistantResource;

export type DistributionContext = {
  portable: boolean;
  dataRoot?: string | null;
  libraryRoot?: string | null;
};

export async function getAppOverview(): Promise<ProjectOverview | null> {
  try {
    return await invokeCommand<ProjectOverview>("get_app_overview");
  } catch {
    return null;
  }
}

export async function getDistributionContext(): Promise<DistributionContext | null> {
  try {
    return await invokeCommand<DistributionContext>("get_distribution_context");
  } catch {
    return null;
  }
}

export async function quitPaideia(): Promise<void> {
  await invokeCommand<void>("quit_paideia");
}

export async function getStartupPaideiaArchive(): Promise<string | null> {
  try {
    return await invokeCommand<string | null>("get_startup_paideia_archive");
  } catch {
    return null;
  }
}

export async function getDevLogPath(): Promise<string | null> {
  try {
    return await invokeCommand<string>("get_dev_log_path");
  } catch {
    return null;
  }
}

export async function getEmbeddedWebview2RuntimeVersion(): Promise<string | null> {
  try {
    return await invokeCommand<string | null>("get_embedded_webview2_runtime_version");
  } catch {
    return null;
  }
}

export async function getDefaultUserProjectsRoot(): Promise<string | null> {
  try {
    return await invokeCommand<string>("get_default_user_projects_root");
  } catch {
    return null;
  }
}

export async function getActiveUserProjectsRoot(): Promise<string | null> {
  try {
    return await invokeCommand<string>("get_active_user_projects_root");
  } catch {
    return null;
  }
}

export async function activateLibraryAssetRoot(libraryRoot: string): Promise<string> {
  return await invokeCommand<string>("activate_library_asset_root", { libraryRoot });
}

export async function listDefaultSituationalDialogueCharacters(): Promise<
  Array<{
    id: string;
    name: string;
    role?: string | null;
    description?: string | null;
    poses: Array<{
      state: string;
      label: string;
      assetRef: string;
    }>;
  }>
> {
  try {
    return await invokeCommand("list_default_situational_dialogue_characters");
  } catch {
    return [];
  }
}

export async function listUserSituationalDialogueCharacters(): Promise<UserSituationalDialogueCharacterDefinition[]> {
  try {
    return await invokeCommand("list_user_situational_dialogue_characters");
  } catch {
    return [];
  }
}

export async function getUserSituationalDialogueCharacterBankPath(): Promise<string> {
  try {
    return await invokeCommand<string>("get_user_situational_dialogue_character_bank_path");
  } catch {
    return "";
  }
}

export async function openUserSituationalDialogueCharacterBankFolder(): Promise<void> {
  await invokeCommand("open_user_situational_dialogue_character_bank_folder");
}

export async function saveUserSituationalDialogueCharacter(input: {
  id?: string | null;
  name: string;
  role?: string | null;
  description?: string | null;
}): Promise<UserSituationalDialogueCharacterDefinition> {
  return invokeCommand<UserSituationalDialogueCharacterDefinition>("save_user_situational_dialogue_character", {
    input
  });
}

export async function uploadUserSituationalDialogueCharacterPose(
  characterId: string,
  state: string,
  file: File,
  makeDefault: boolean
): Promise<UserSituationalDialogueCharacterDefinition[]> {
  const fileBytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invokeCommand<UserSituationalDialogueCharacterDefinition[]>("upload_user_situational_dialogue_character_pose", {
    characterId,
    state,
    fileName: file.name,
    fileBytes,
    makeDefault
  });
}

export async function uploadUserSituationalDialogueCharacterPreview(
  characterId: string,
  file: File
): Promise<UserSituationalDialogueCharacterDefinition[]> {
  const fileBytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invokeCommand<UserSituationalDialogueCharacterDefinition[]>("upload_user_situational_dialogue_character_preview", {
    characterId,
    fileName: file.name,
    fileBytes
  });
}

export async function setUserSituationalDialogueCharacterDefaultPose(
  characterId: string,
  state: string,
  assetRef: string
): Promise<UserSituationalDialogueCharacterDefinition[]> {
  return invokeCommand<UserSituationalDialogueCharacterDefinition[]>("set_user_situational_dialogue_character_default_pose", {
    characterId,
    state,
    assetRef
  });
}

export async function deleteUserSituationalDialogueCharacter(
  characterId: string
): Promise<UserSituationalDialogueCharacterDefinition[]> {
  return invokeCommand<UserSituationalDialogueCharacterDefinition[]>("delete_user_situational_dialogue_character", {
    characterId
  });
}

export async function importUserSituationalDialogueCharacter(
  projectPath: string,
  blockId: string,
  characterId: string
): Promise<SituationalDialogueCharacter> {
  return invokeCommand<SituationalDialogueCharacter>("import_user_situational_dialogue_character", {
    projectPath,
    blockId,
    characterId
  });
}

export async function exportUserSituationalDialogueCharacters(
  characterIds: string[],
  destinationPath: string
): Promise<string> {
  return invokeCommand<string>("export_user_situational_dialogue_characters", { characterIds, destinationPath });
}

export async function inspectUserSituationalDialogueCharacterPackage(
  packagePath: string
): Promise<CharacterPackageInspection> {
  return invokeCommand<CharacterPackageInspection>("inspect_user_situational_dialogue_character_package", { packagePath });
}

export async function importUserSituationalDialogueCharacterPackage(
  packagePath: string,
  conflictPolicy: "update" | "copy" | "skip"
): Promise<CharacterPackageImportResult> {
  return invokeCommand<CharacterPackageImportResult>("import_user_situational_dialogue_character_package", {
    packagePath,
    conflictPolicy
  });
}

export async function listUserGlossaryAssistants(): Promise<UserGlossaryAssistantDefinition[]> {
  return listResourceBanks<UserGlossaryAssistantDefinition>("assistants");
}

export async function getUserGlossaryAssistantBankPath(): Promise<string> {
  try {
    return await invokeCommand<string>("get_user_glossary_assistant_bank_path");
  } catch {
    return "";
  }
}

export async function listUserQuestionBanks(): Promise<QuestionBankResource[]> {
  return listResourceBanks<QuestionBankResource>("questions");
}

export async function getUserQuestionBankPath(): Promise<string> {
  try {
    return await invokeCommand<string>("get_user_question_bank_path");
  } catch {
    return "";
  }
}

export async function listUserReferenceBanks(): Promise<ReferenceBankResource[]> {
  return listResourceBanks<ReferenceBankResource>("references");
}

export async function getUserReferenceBankPath(): Promise<string> {
  try {
    return await invokeCommand<string>("get_user_reference_bank_path");
  } catch {
    return "";
  }
}

export type UserPreferencesState = {
  appLanguage?: string | null;
  assistantAddressForm?: "feminine" | null;
  activityFavorites: string[];
  activityFavoritesLimit?: number | null;
  libraryProjectFavorites: string[];
  libraryCollectionOverrides: Record<string, string>;
  customLibraryCollections: string[];
  libraryCollectionImages: Record<string, string>;
  libraryCollectionColors?: Record<string, string>;
  libraryKeywordCatalog?: string[];
  libraryPinnedKeywords?: string[];
  libraryRecentKeywords?: string[];
  hiddenLibraryCollectionTiles: string[];
  ffmpegPath?: string | null;
  ffprobePath?: string | null;
  whisperCliPath?: string | null;
  whisperSmallModelPath?: string | null;
  whisperMediumModelPath?: string | null;
};

export type MediaToolValidation = {
  kind: "ffmpeg" | "ffprobe";
  path: string;
  valid: boolean;
  version?: string | null;
  error?: string | null;
};

export type FfmpegConfigurationStatus = {
  ffmpeg: MediaToolValidation;
  ffprobe: MediaToolValidation;
  ready: boolean;
  videoOptimizationReady: boolean;
  videoOptimizationError?: string | null;
};

export type WhisperComponentValidation = {
  kind: "engine" | "small" | "medium";
  path: string;
  valid: boolean;
  version?: string | null;
  sizeBytes?: number | null;
  error?: string | null;
};

export type WhisperConfigurationStatus = {
  engine: WhisperComponentValidation;
  smallModel: WhisperComponentValidation;
  mediumModel: WhisperComponentValidation;
  ffmpegReady: boolean;
  ready: boolean;
};

export type SubtitleGenerationOptions = {
  language: string;
  model: "small" | "medium";
  outputKind?: "subtitles" | "transcript";
};

export type SubtitleGenerationProgressEvent = {
  taskId: string;
  state: "extracting-audio" | "transcribing" | "completed" | "cancelled" | "failed";
  progress: number;
  elapsedSeconds: number;
  error?: string | null;
  vttContent?: string | null;
  textContent?: string | null;
  suggestedFileName?: string | null;
  detectedLanguage?: string | null;
};

export type VideoOptimizationAnalysis = {
  assetRef: string;
  fileName: string;
  sizeBytes: number;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  bitrateMbps?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  audioBitrateKbps?: number | null;
  container?: string | null;
  hasAudio: boolean;
  status: "recommended" | "adapted" | "neutral";
  reasons: string[];
};

export type VideoOptimizationOptions = {
  profile: "web-720" | "web-1080" | "quality-1080" | "strong" | "custom";
  rateControl?: "crf" | "bitrate" | null;
  crf?: number | null;
  maxHeight?: number | null;
  videoBitrateMbps?: number | null;
  audioBitrateKbps?: 96 | 128 | 160 | 192 | null;
  maxFps?: 0 | 25 | 30 | null;
};

export type VideoOptimizationProgressEvent = {
  taskId: string;
  state: "running" | "cancelling" | "cancelled" | "failed" | "awaiting-confirmation";
  progress: number;
  elapsedSeconds: number;
  error?: string | null;
  sourceAnalysis?: VideoOptimizationAnalysis | null;
  resultAnalysis?: VideoOptimizationAnalysis | null;
};

export async function listUserPreferences(): Promise<UserPreferencesState> {
  try {
    return await invokeCommand<UserPreferencesState>("list_user_preferences");
  } catch {
    return {
      appLanguage: null,
      assistantAddressForm: null,
      activityFavorites: [],
      activityFavoritesLimit: null,
      libraryProjectFavorites: [],
      libraryCollectionOverrides: {},
      customLibraryCollections: [],
      libraryCollectionImages: {},
      libraryCollectionColors: {},
      libraryKeywordCatalog: [],
      libraryPinnedKeywords: [],
      libraryRecentKeywords: [],
      hiddenLibraryCollectionTiles: [],
      ffmpegPath: null,
      ffprobePath: null,
      whisperCliPath: null,
      whisperSmallModelPath: null,
      whisperMediumModelPath: null
    };
  }
}

export async function saveUserPreferences(preferences: UserPreferencesState): Promise<UserPreferencesState> {
  return invokeCommand<UserPreferencesState>("save_user_preferences", {
    appLanguage: preferences.appLanguage ?? null,
    assistantAddressForm: preferences.assistantAddressForm ?? null,
    activityFavorites: preferences.activityFavorites,
    activityFavoritesLimit: preferences.activityFavoritesLimit ?? null,
    libraryProjectFavorites: preferences.libraryProjectFavorites,
    libraryCollectionOverrides: preferences.libraryCollectionOverrides,
    customLibraryCollections: preferences.customLibraryCollections,
    libraryCollectionImages: preferences.libraryCollectionImages,
    libraryCollectionColors: preferences.libraryCollectionColors ?? {},
    libraryKeywordCatalog: preferences.libraryKeywordCatalog ?? [],
    libraryPinnedKeywords: preferences.libraryPinnedKeywords ?? [],
    libraryRecentKeywords: preferences.libraryRecentKeywords ?? [],
    hiddenLibraryCollectionTiles: preferences.hiddenLibraryCollectionTiles,
    ffmpegPath: preferences.ffmpegPath ?? null,
    ffprobePath: preferences.ffprobePath ?? null,
    whisperCliPath: preferences.whisperCliPath ?? null,
    whisperSmallModelPath: preferences.whisperSmallModelPath ?? null,
    whisperMediumModelPath: preferences.whisperMediumModelPath ?? null
  });
}

export async function validateMediaToolPath(
  kind: "ffmpeg" | "ffprobe",
  path: string
): Promise<MediaToolValidation> {
  return invokeCommand<MediaToolValidation>("validate_media_tool_path", { kind, path });
}

export async function inspectFfmpegConfiguration(
  ffmpegPath?: string | null,
  ffprobePath?: string | null
): Promise<FfmpegConfigurationStatus> {
  return invokeCommand<FfmpegConfigurationStatus>("inspect_ffmpeg_configuration", {
    ffmpegPath: ffmpegPath ?? null,
    ffprobePath: ffprobePath ?? null
  });
}

export async function validateWhisperComponentPath(
  kind: "engine" | "small" | "medium",
  path: string
): Promise<WhisperComponentValidation> {
  return invokeCommand<WhisperComponentValidation>("validate_whisper_component_path", { kind, path });
}

export async function inspectWhisperConfiguration(
  whisperCliPath?: string | null,
  whisperSmallModelPath?: string | null,
  whisperMediumModelPath?: string | null
): Promise<WhisperConfigurationStatus> {
  return invokeCommand<WhisperConfigurationStatus>("inspect_whisper_configuration", {
    whisperCliPath: whisperCliPath ?? null,
    whisperSmallModelPath: whisperSmallModelPath ?? null,
    whisperMediumModelPath: whisperMediumModelPath ?? null
  });
}

export async function startSubtitleGeneration(
  taskId: string,
  projectPath: string,
  blockId: string,
  options: SubtitleGenerationOptions,
  configuration: {
    whisperCliPath: string;
    whisperSmallModelPath?: string | null;
    whisperMediumModelPath?: string | null;
  },
  assetRef?: string | null
): Promise<{ taskId: string }> {
  return invokeCommand<{ taskId: string }>("start_subtitle_generation", {
    taskId,
    projectPath,
    blockId,
    assetRef: assetRef ?? null,
    options,
    whisperCliPath: configuration.whisperCliPath,
    whisperSmallModelPath: configuration.whisperSmallModelPath ?? null,
    whisperMediumModelPath: configuration.whisperMediumModelPath ?? null
  });
}

export async function cancelSubtitleGeneration(taskId: string): Promise<void> {
  return invokeCommand<void>("cancel_subtitle_generation", { taskId });
}

export async function analyzeProjectVideo(
  projectPath: string,
  blockId: string,
  assetRef?: string | null
): Promise<VideoOptimizationAnalysis> {
  return invokeCommand<VideoOptimizationAnalysis>("analyze_project_video", { projectPath, blockId, assetRef: assetRef ?? null });
}

export async function startVideoOptimization(
  projectPath: string,
  blockId: string,
  options: VideoOptimizationOptions,
  assetRef?: string | null
): Promise<{ taskId: string }> {
  return invokeCommand<{ taskId: string }>("start_video_optimization", { projectPath, blockId, options, assetRef: assetRef ?? null });
}

export async function cancelVideoOptimization(taskId: string): Promise<void> {
  return invokeCommand<void>("cancel_video_optimization", { taskId });
}

export async function discardVideoOptimization(taskId: string): Promise<void> {
  return invokeCommand<void>("discard_video_optimization", { taskId });
}

export async function confirmVideoOptimization(taskId: string): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("confirm_video_optimization", { taskId });
}

export async function confirmDetachedVideoOptimization(taskId: string): Promise<{
  assetRef: string;
  originalAssetRef: string;
  profile: string;
}> {
  return invokeCommand("confirm_detached_video_optimization", { taskId });
}

export async function restoreOriginalVideo(
  projectPath: string,
  blockId: string
): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("restore_original_video", { projectPath, blockId });
}

export async function saveUserQuestionBanks(questionBanks: QuestionBankResource[]): Promise<QuestionBankResource[]> {
  return saveResourceBanks("questions", questionBanks);
}

export async function uploadUserQuestionBankTileImage(
  bankId: string,
  file: File
): Promise<QuestionBankResource[]> {
  return uploadResourceBankImage("questions", bankId, file);
}

export async function deleteUserQuestionBank(bankId: string): Promise<QuestionBankResource[]> {
  return deleteResourceBank("questions", bankId);
}

export async function saveUserReferenceBanks(referenceBanks: ReferenceBankResource[], projectPathsToSync: string[]): Promise<ReferenceBankResource[]> {
  return saveResourceBanks("references", referenceBanks, projectPathsToSync);
}

export async function applyUserReferenceBanks(projectPath: string, assignmentPath: string): Promise<void> {
  return invokeCommand<void>("apply_user_reference_banks", { projectPath, assignmentPath });
}

export async function uploadUserReferenceBankTileImage(bankId: string, file: File): Promise<ReferenceBankResource[]> {
  return uploadResourceBankImage("references", bankId, file);
}

export async function deleteUserReferenceBank(bankId: string): Promise<ReferenceBankResource[]> {
  return deleteResourceBank("references", bankId);
}

export async function saveUserGlossaryAssistants(
  assistants: UserGlossaryAssistantDefinition[],
  projectPathsToSync: string[]
): Promise<UserGlossaryAssistantDefinition[]> {
  return saveResourceBanks("assistants", assistants, projectPathsToSync);
}

export async function deleteUserGlossaryAssistant(
  assistantId: string,
  projectPathsToSync: string[]
): Promise<UserGlossaryAssistantDefinition[]> {
  return deleteResourceBank("assistants", assistantId, projectPathsToSync);
}

export async function exportResourceWorkbookTo(targetPath: string, fileBytes: number[]): Promise<string> {
  return invokeCommand<string>("export_resource_workbook_to", {
    targetPath,
    fileBytes
  });
}

export async function uploadUserGlossaryAssistantAvatar(
  assistantId: string,
  file: File
): Promise<UserGlossaryAssistantDefinition[]> {
  return uploadResourceBankImage("assistants", assistantId, file);
}

export async function migrateLibraryRoot(sourceRoot: string, destinationRoot: string): Promise<string> {
  return await invokeCommand<string>("migrate_library_root", {
    sourceRoot,
    destinationRoot
  });
}

export async function listPersonalLibraryProjects(): Promise<LibraryProjectEntry[]> {
  return await invokeCommand<LibraryProjectEntry[]>("list_personal_library_projects", {});
}

export async function listLibraryProjects(
  searchRoots: string[],
  includeArchives: string[]
): Promise<LibraryProjectEntry[]> {
  try {
    return await invokeCommand<LibraryProjectEntry[]>("list_library_projects", {
      searchRoots,
      includeArchives
    });
  } catch {
    return [];
  }
}

export async function deletePaideiaArchive(archivePath: string, libraryRoot: string): Promise<void> {
  await invokeCommand<void>("delete_paideia_archive", {
    archivePath,
    libraryRoot
  });
}

export async function saveProjectWorkspace(projectPath: string): Promise<void> {
  await invokeCommand<void>("save_project_workspace", {
    projectPath
  });
}

export async function updateQuestionBanks(projectPath: string, questionBanks: QuestionBankResource[]): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("update_question_banks", {
    projectPath,
    questionBanks
  });
}

export async function logDevEvent(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  try {
    await invokeCommand<void>("log_dev_event", {
      level,
      message,
      context
    });
  } catch {
    // Logging must never block the user workflow.
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    return await invokeCommand<boolean>("path_exists", { path });
  } catch {
    return false;
  }
}

export async function loadWorkspaceStateForProject(
  projectPath: string
): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("load_workspace_state", {
    projectPath
  });
}

export type PdfExportFilePayload = {
  assetRef: string;
  mimeType: string;
  dataBase64: string;
};

export async function loadProjectForPdfExport(sourcePath: string): Promise<PaideiaProject> {
  return invokeCommand<PaideiaProject>("load_project_for_pdf_export", { sourcePath });
}

export async function readProjectFilesForPdfExport(
  sourcePath: string,
  assetRefs: string[]
): Promise<PdfExportFilePayload[]> {
  return invokeCommand<PdfExportFilePayload[]>("read_project_files_for_pdf_export", {
    sourcePath,
    assetRefs
  });
}

export async function writePdfExportAtomic(targetPath: string, pdfBase64: string): Promise<string> {
  return invokeCommand<string>("write_pdf_export_atomic", { targetPath, pdfBase64 });
}

export async function generatePdfA4(sourcePath: string, targetPath: string, profile: "review" | "learner" = "review"): Promise<string> {
  try {
    return await invokeCommand<string>("generate_pdf_a4", { sourcePath, targetPath, profile });
  } catch (error) {
    // Rust command errors arrive as strings; keep the actual diagnostic visible.
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function duplicateUserSituationalDialogueCharacter(characterId: string): Promise<UserSituationalDialogueCharacterDefinition> {
  return invokeCommand<UserSituationalDialogueCharacterDefinition>("duplicate_user_situational_dialogue_character", { characterId });
}

export async function readTranscriptDocument(path: string): Promise<string> {
  return invokeCommand<string>("read_transcript_document", { path });
}

export async function writeTranscriptRtf(targetPath: string, content: string): Promise<string> {
  return invokeCommand<string>("write_transcript_rtf", { targetPath, content });
}

export async function writeLessonDurationLog(
  projectPath: string,
  lessonTitle: string,
  content: string,
  replaceCurrent = false,
  signature?: string,
  seconds?: number
): Promise<string> {
  return invokeCommand<string>("write_lesson_duration_log", {
    projectPath,
    lessonTitle,
    content,
    replaceCurrent,
    signature,
    seconds
  });
}

export type PersistedLessonDurationEstimate = {
  schemaVersion: number;
  signature: string;
  seconds: number;
  reportContent: string;
  reportPath: string;
  calculatedAt: string;
};

export async function readLessonDurationCurrent(
  projectPath: string
): Promise<PersistedLessonDurationEstimate | null> {
  return invokeCommand<PersistedLessonDurationEstimate | null>("read_lesson_duration_current", { projectPath });
}

export async function createModule(input: CreateModuleInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("create_module", {
    ...input
  });
}

export async function createProject(
  destinationRoot: string,
  title: string,
  initialChapterTitle: string,
  projectLanguage: string
): Promise<string> {
  return invokeCommand<string>("create_project", {
    destinationRoot,
    title,
    initialChapterTitle,
    projectLanguage
  });
}

export async function duplicateProject(
  projectPath: string,
  options?: { destinationRoot?: string; createdBy?: string }
): Promise<string> {
  return invokeCommand<string>("duplicate_project", {
    projectPath,
    destinationRoot: options?.destinationRoot,
    createdBy: options?.createdBy
  });
}

export async function createChapter(input: CreateChapterInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("create_chapter", {
    ...input
  });
}

export async function deleteChapter(input: DeleteChapterInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("delete_chapter", {
    ...input
  });
}

export async function updateChapter(input: UpdateChapterInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("update_chapter", {
    ...input
  });
}

export async function reorderChapter(
  projectPath: string,
  moduleId: string,
  chapterId: string,
  targetIndex: number
): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("reorder_chapter", {
    projectPath,
    moduleId,
    chapterId,
    targetIndex
  });
}

export async function createPage(input: CreatePageInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("create_page", {
    ...input
  });
}

export async function createBlock(input: CreateBlockInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("create_block", {
    ...input
  });
}

export async function updateBlock(input: UpdateBlockInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("update_block", {
    ...input
  });
}

export async function applyDesignerBlockChanges(
  projectPath: string,
  changes: DesignerBlockChange[],
  metadata: { actionId: string; originalCommand: string; undo: boolean }
): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("apply_designer_block_changes", {
    projectPath,
    changes,
    ...metadata
  });
}

export async function deleteBlock(input: DeleteBlockInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("delete_block", {
    ...input
  });
}

export async function deleteDesignerBlocks(input: DeleteDesignerBlocksInput): Promise<DeleteDesignerBlocksResult> {
  return await invokeCommand<DeleteDesignerBlocksResult>("delete_designer_blocks", { ...input });
}

export async function pasteActivityBlock(input: {
  sourceProjectPath: string;
  sourceProjectId: string;
  targetProjectPath: string;
  targetProjectId: string;
  targetPageId: string;
  targetIndex: number;
  block: PaideiaBlock;
}): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("paste_activity_block", {
    sourceProjectPath: input.sourceProjectPath,
    sourceProjectId: input.sourceProjectId,
    targetProjectPath: input.targetProjectPath,
    targetProjectId: input.targetProjectId,
    targetPageId: input.targetPageId,
    targetIndex: input.targetIndex,
    block: input.block
  });
}

export type ChapterAssetDuplicate = {
  sourceAssetRef: string;
  sourceFileName: string;
  existingAssetRef: string;
  existingFileName: string;
  sizeBytes: number;
};

export type ChapterAssetReuse = {
  sourceAssetRef: string;
  targetAssetRef: string;
};

export async function inspectChapterAssetDuplicates(input: {
  sourceProjectPath: string;
  targetProjectPath: string;
  chapter: PaideiaChapter;
}): Promise<ChapterAssetDuplicate[]> {
  return await invokeCommand<ChapterAssetDuplicate[]>("inspect_chapter_asset_duplicates", input);
}

export async function pasteChapter(input: {
  sourceProjectPath: string;
  sourceProjectId: string;
  targetProjectPath: string;
  targetProjectId: string;
  targetModuleId: string;
  targetIndex: number;
  chapter: PaideiaChapter;
  assetReuse: ChapterAssetReuse[];
}): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("paste_chapter", input);
}

export async function renameProjectTitle(projectPath: string, title: string): Promise<{
  projectPath: string; title: string; updatedAt: string; courseCoverTitleHtml: string;
}> {
  return invokeCommand("rename_project_title", { projectPath, title });
}

export async function updateProjectMetadata(input: UpdateProjectMetadataInput): Promise<ProjectMutationResult> {
  return await invokeCommand<ProjectMutationResult>("update_project_metadata", {
    ...input,
    courseImageRef: input.courseImageRef ?? null,
    courseCoverTitleHtml: input.courseCoverTitleHtml ?? null,
    customFont: input.customFont ?? null,
    courseIntroHtml: input.courseIntroHtml ?? null,
    courseCoverStyle: input.courseCoverStyle ?? null,
    activitySpacingPx: input.activitySpacingPx ?? null,
    hideChapterTitleBanner: input.hideChapterTitleBanner ?? null,
    courseAppearance: input.courseAppearance ?? null
  });
}

export async function updateProjectKeywords(projectPath: string, keywords: string[]): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("update_project_keywords", { projectPath, keywords });
}

export async function updateProjectLanguage(
  projectPath: string,
  language: string,
  localizedCourse: PaideiaProject["course"]
): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("update_project_language", {
    projectPath,
    language,
    localizedCourse
  });
}

async function validateUploadedFont(fileName: string, bytes: number[]): Promise<void> {
  const faces = await invokeCommand<{ file_name: string; bytes: number[]; weight: number; style: string }[]>("prepare_uploaded_font", {
    fileName, fileBytes: bytes
  });
  for (const face of faces) {
    try {
      const preview = new FontFace("PaideiaImportValidation", new Uint8Array(face.bytes), {
        weight: String(face.weight), style: face.style
      });
      await preview.load();
    } catch {
      throw new Error(`La police « ${face.file_name} » est refusée par le moteur d’affichage. Le fichier contient des données de police incompatibles ou invalides. Aucune police n’a été importée.`);
    }
  }
}

export async function uploadProjectFont(projectPath: string, file: File): Promise<PaideiaWorkspaceState> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  await validateUploadedFont(file.name, bytes);
  return await invokeCommand<PaideiaWorkspaceState>("upload_project_font", {
    projectPath,
    fileName: file.name,
    fileBytes: bytes
  });
}

export async function selectBundledProjectFont(
  projectPath: string,
  fontId: string
): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("select_bundled_project_font", {
    projectPath,
    fontId
  });
}

export async function listUserFonts(libraryRoot?: string | null): Promise<LessonCustomFont[]> {
  return invokeCommand<LessonCustomFont[]>("list_user_fonts", {
    libraryRoot: libraryRoot ?? null
  });
}

export async function uploadUserFont(file: File, libraryRoot?: string | null): Promise<LessonCustomFont[]> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  await validateUploadedFont(file.name, bytes);
  return invokeCommand<LessonCustomFont[]>("upload_user_font", {
    fileName: file.name,
    fileBytes: bytes,
    libraryRoot: libraryRoot ?? null
  });
}

export async function deleteUserFont(fontId: string, libraryRoot?: string | null): Promise<LessonCustomFont[]> {
  return invokeCommand<LessonCustomFont[]>("delete_user_font", {
    fontId,
    libraryRoot: libraryRoot ?? null
  });
}

export async function selectUserProjectFont(
  projectPath: string,
  fontId: string,
  libraryRoot?: string | null
): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("select_user_project_font", {
    projectPath,
    fontId,
    libraryRoot: libraryRoot ?? null
  });
}

export async function listProjectRichTextFonts(projectPath: string): Promise<LessonCustomFont[]> {
  return invokeCommand<LessonCustomFont[]>("list_project_rich_text_fonts", { projectPath });
}

export async function linkBundledRichTextFont(
  projectPath: string,
  fontId: string
): Promise<LessonCustomFont[]> {
  return invokeCommand<LessonCustomFont[]>("link_bundled_rich_text_font", {
    projectPath,
    fontId
  });
}

export async function linkUserRichTextFont(
  projectPath: string,
  fontId: string,
  libraryRoot?: string | null
): Promise<LessonCustomFont[]> {
  return invokeCommand<LessonCustomFont[]>("link_user_rich_text_font", {
    projectPath,
    fontId,
    libraryRoot: libraryRoot ?? null
  });
}

export async function linkProjectRichTextFont(projectPath: string): Promise<LessonCustomFont[]> {
  return invokeCommand<LessonCustomFont[]>("link_project_rich_text_font", { projectPath });
}

export async function selectImportedProjectFont(projectPath: string, fontId: string): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("select_imported_project_font", { projectPath, fontId });
}
export async function deleteImportedProjectFont(projectPath: string, fontId: string): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("delete_imported_project_font", { projectPath, fontId });
}

export async function removeProjectFont(projectPath: string): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("remove_project_font", {
    projectPath
  });
}

export async function uploadCourseImage(projectPath: string, file: File): Promise<PaideiaWorkspaceState> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return await invokeCommand<PaideiaWorkspaceState>("upload_course_image", {
    projectPath,
    fileName: file.name,
    fileBytes: bytes
  });
}

export async function uploadCollectionImage(
  libraryRoot: string,
  collectionName: string,
  sourcePath: string
): Promise<string> {
  return invokeCommand<string>("upload_collection_image", {
    libraryRoot,
    collectionName,
    sourcePath
  });
}

export async function reorderBlock(
  projectPath: string,
  pageId: string,
  blockId: string,
  targetIndex: number
): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("reorder_block", {
    projectPath,
    pageId,
    blockId,
    targetIndex
  });
}

export async function createSnapshot(input: CreateSnapshotInput): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("create_snapshot", {
    ...input
  });
}

export async function createInlineSnapshot(input: CreateSnapshotInput): Promise<SnapshotRecord[]> {
  return invokeCommand<SnapshotRecord[]>("create_inline_snapshot", { ...input });
}

export async function restoreSnapshot(projectPath: string, snapshotId: string): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("restore_snapshot", {
    projectPath,
    snapshotId
  });
}

export type ImportScormResult = {
  projectPath: string;
  isPaideiaRoundtrip: boolean;
  importEngine?: "resilient";
};

export async function importScorm(input: ImportScormInput): Promise<ImportScormResult> {
  return await invokeCommand<ImportScormResult>("import_scorm", input);
}

export type ImportSummary = {
  chaptersDetected: number;
  blocksDetected: number;
  blocksMappedExactly: number;
  blocksMappedApproximately: number;
  blocksUnsupported: number;
  assetsCopied: number;
};

export type ImportIssue = {
  severity: string;
  location: string;
  sourceBlockType: string;
  mappedTo: string;
  message: string;
};

export type ImportRematchingEntry = {
  location: string;
  sourceLabel: string;
  sourceFamily: string;
  sourceVariant: string;
  sourceType: string;
  mappedTo: string;
  status: string;
  missingProperties: string[];
  artifactPath?: string | null;
};

export type ImportReport = {
  sourceType: string;
  confidence: string;
  summary: ImportSummary;
  issues: ImportIssue[];
  rematching: ImportRematchingEntry[];
};

export async function readImportReport(projectPath: string): Promise<ImportReport> {
  return await invokeCommand<ImportReport>("read_import_report", { projectPath });
}

export async function writeImportLog(projectPath: string, content: string): Promise<string> {
  return await invokeCommand<string>("write_import_log", { projectPath, content });
}

export async function exportPaideiaArchive(projectPath: string, destinationRoot: string): Promise<string> {
  return invokeCommand<string>("export_paideia_archive", {
    projectPath,
    destinationRoot
  });
}

export async function exportPaideiaArchiveTo(projectPath: string, archivePath: string, includeResources = false): Promise<string> {
  return invokeCommand<string>("export_paideia_archive_to", { projectPath, archivePath, includeResources });
}

export function hasPaideiaSharedBanks(projectPath: string): Promise<boolean> {
  return invokeCommand<boolean>("has_paideia_shared_banks", { projectPath });
}

export function importPaideiaSharedBanks(projectPath: string): Promise<void> {
  return invokeCommand<void>("import_paideia_shared_banks", { projectPath });
}

export async function openPaideiaArchive(file: File, destinationRoot: string): Promise<string> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invokeCommand<string>("open_paideia_archive_bytes", {
    archiveName: file.name,
    archiveBytes: bytes,
    destinationRoot
  });
}

export async function openPaideiaArchivePath(archivePath: string, destinationRoot: string): Promise<string> {
  return invokeCommand<string>("open_paideia_archive_path", {
    archivePath,
    destinationRoot
  });
}

export async function exportScorm12(projectPath: string, destinationRoot: string, appLanguage: string): Promise<string> {
  return invokeCommand<string>("export_scorm_12", {
    projectPath,
    destinationRoot,
    appLanguage
  });
}

export async function exportScorm12To(projectPath: string, archivePath: string, appLanguage: string): Promise<string> {
  return invokeCommand<string>("export_scorm_12_to", {
    projectPath,
    archivePath,
    appLanguage
  });
}

export async function uploadBlockAsset(
  projectPath: string,
  blockId: string,
  file: File,
  assetRole: "media" | "image" | "subtitle" | "subtitle-edit" | "section-background" | "rich-inline-image",
  reuseAssetRef?: string | null
): Promise<PaideiaWorkspaceState> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return await invokeCommand<PaideiaWorkspaceState>("upload_block_asset", {
    projectPath,
    blockId,
    fileName: file.name,
    fileBytes: bytes,
    assetRole,
    reuseAssetRef: reuseAssetRef ?? null
  });
}

export async function applyActivityItemCrop(
  projectPath: string,
  pageId: string,
  blockId: string,
  itemId: string,
  face: "front" | "back" | null,
  file: File
): Promise<PaideiaWorkspaceState> {
  const fileBytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return await invokeCommand<PaideiaWorkspaceState>("apply_activity_item_crop", {
    projectPath,
    pageId,
    blockId,
    itemId,
    face,
    fileName: file.name,
    fileBytes
  });
}

export async function isProjectImageAnimated(projectPath: string, assetRef: string) {
  return await invokeCommand<boolean>("is_project_image_animated", {
    projectPath,
    assetRef
  });
}

export type ProjectAssetDuplicate = {
  assetRef: string;
  fileName: string;
  sizeBytes: number;
};

export async function inspectProjectAssetDuplicate(projectPath: string, file: File) {
  const fileBytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return await invokeCommand<ProjectAssetDuplicate | null>("inspect_project_asset_duplicate", {
    projectPath,
    fileName: file.name,
    fileBytes
  });
}

export async function inspectProjectAssetDuplicateFromPath(projectPath: string, sourcePath: string) {
  return await invokeCommand<ProjectAssetDuplicate | null>("inspect_project_asset_duplicate_from_path", {
    projectPath,
    sourcePath
  });
}

export async function stageDesignerBackgroundAsset(projectPath: string, file: File): Promise<string> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return await invokeCommand<string>("stage_designer_background_asset", {
    projectPath,
    fileName: file.name,
    fileBytes: bytes
  });
}

export async function stagePointOfInterestMarkerAsset(
  projectPath: string,
  blockId: string,
  markerId: string,
  file: File,
  assetKind: "image" | "video" | "audio" | "subtitle",
  reuseAssetRef?: string | null
): Promise<string> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invokeCommand<string>("stage_point_of_interest_marker_asset", {
    projectPath,
    blockId,
    markerId,
    fileName: file.name,
    fileBytes: bytes,
    assetKind,
    reuseAssetRef: reuseAssetRef ?? null
  });
}

export type ActivityItemAnnotationState = {
  sourceAssetRef: string;
  document: NativeImageAnnotationDocument;
};

export type ActivityItemAnnotationSaveResult = {
  annotatedAssetRef: string;
  stateRef: string;
  sourceAssetRef: string;
};

export async function saveActivityItemAnnotation(input: {
  projectPath: string;
  blockId: string;
  itemId: string;
  sourceAssetRef: string;
  document: NativeImageAnnotationDocument;
  imageFileName: string;
  imageBytes: Uint8Array;
}): Promise<ActivityItemAnnotationSaveResult> {
  return invokeCommand<ActivityItemAnnotationSaveResult>("save_activity_item_annotation", {
    projectPath: input.projectPath,
    blockId: input.blockId,
    itemId: input.itemId,
    sourceAssetRef: input.sourceAssetRef,
    document: input.document,
    imageFileName: input.imageFileName,
    imageBytes: Array.from(input.imageBytes)
  });
}

export async function loadActivityItemAnnotationState(
  projectPath: string,
  stateRef: string
): Promise<ActivityItemAnnotationState | null> {
  return invokeCommand<ActivityItemAnnotationState | null>("load_activity_item_annotation_state", {
    projectPath,
    stateRef
  });
}

export async function loadBlockImageAnnotationState(
  projectPath: string,
  blockId: string
): Promise<ActivityItemAnnotationState | null> {
  return invokeCommand<ActivityItemAnnotationState | null>("load_block_image_annotation_state", {
    projectPath,
    blockId
  });
}

export async function clearBlockImageAnnotationState(projectPath: string, blockId: string): Promise<void> {
  return invokeCommand<void>("clear_block_image_annotation_state", {
    projectPath,
    blockId
  });
}

export async function uploadAttachmentFile(
  projectPath: string,
  blockId: string,
  file: File,
  reuseAssetRef?: string | null
): Promise<PaideiaWorkspaceState> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return await invokeCommand<PaideiaWorkspaceState>("upload_attachment_file", {
    projectPath,
    blockId,
    fileName: file.name,
    fileBytes: bytes,
    reuseAssetRef: reuseAssetRef ?? null
  });
}

export async function removeAttachmentFile(
  projectPath: string,
  blockId: string,
  attachmentId: string
): Promise<PaideiaWorkspaceState> {
  return await invokeCommand<PaideiaWorkspaceState>("remove_attachment_file", {
    projectPath,
    blockId,
    attachmentId
  });
}

export async function exportAttachmentFileTo(
  projectPath: string,
  blockId: string,
  attachmentId: string,
  destinationPath: string
): Promise<string> {
  return invokeCommand<string>("export_attachment_file_to", {
    projectPath,
    blockId,
    attachmentId,
    destinationPath
  });
}

export async function exportPaideiaLicenseTo(destinationPath: string, language: string): Promise<string> {
  return invokeCommand<string>("export_paideia_license_to", { destinationPath, language });
}

export async function detachVideoBlockAsset(
  projectPath: string,
  blockId: string,
  assetKind: "media" | "subtitle"
): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("detach_video_block_asset", {
    projectPath,
    blockId,
    assetKind
  });
}

export async function uploadVideoBlockAssetFromPath(
  projectPath: string,
  blockId: string,
  sourcePath: string,
  reuseAssetRef?: string | null
): Promise<PaideiaWorkspaceState> {
  return invokeCommand<PaideiaWorkspaceState>("upload_video_block_asset_from_path", {
    projectPath,
    blockId,
    sourcePath,
    reuseAssetRef: reuseAssetRef ?? null
  });
}

export async function uploadSituationalDialogueCharacterAsset(
  projectPath: string,
  blockId: string,
  characterName: string,
  poseId: string,
  file: File
): Promise<string> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return await invokeCommand<string>("upload_situational_dialogue_character_asset", {
    projectPath,
    blockId,
    characterName,
    poseId,
    fileName: file.name,
    fileBytes: bytes
  });
}

export async function importHtmlActivityPackage(
  projectPath: string,
  pageId: string,
  blockId: string,
  file: File
): Promise<PaideiaWorkspaceState> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invokeCommand<PaideiaWorkspaceState>("import_html_activity_package", {
    projectPath,
    pageId,
    blockId,
    fileName: file.name,
    fileBytes: bytes
  });
}

export function getDefaultProjectPath() {
  return NO_PROJECT_PATH;
}


export async function exportThirdPartyNoticesTo(destinationPath: string, language: string): Promise<string> {
  return invokeCommand<string>("export_paideia_license_to", { destinationPath, language, thirdParty: true });
}
