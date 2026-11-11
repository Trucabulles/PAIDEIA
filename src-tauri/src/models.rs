use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppOverview {
    pub name: String,
    pub mode: String,
    pub storage: String,
    pub stack: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryProjectEntry {
    #[serde(rename = "archivePath")]
    pub archive_path: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "chaptersCount")]
    pub chapters_count: usize,
    #[serde(rename = "activitiesCount")]
    pub activities_count: usize,
    pub collection: Option<String>,
    #[serde(rename = "courseImagePath")]
    pub course_image_path: Option<String>,
    #[serde(rename = "courseImageDataUrl")]
    pub course_image_data_url: Option<String>,
    #[serde(rename = "importedFromScorm")]
    pub imported_from_scorm: bool,
    #[serde(rename = "hasError")]
    pub has_error: bool,
    #[serde(default, rename = "collaborationLibraryId")]
    pub collaboration_library_id: Option<String>,
    #[serde(default, rename = "collaborationLibraryInstanceId")]
    pub collaboration_library_instance_id: Option<String>,
    #[serde(default, rename = "collaborationId")]
    pub collaboration_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMeta {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default, rename = "courseIntroHtml")]
    pub course_intro_html: String,
    #[serde(default, rename = "titleStyle")]
    pub title_style: Option<CourseTitleStyle>,
    #[serde(default, rename = "customFont")]
    pub custom_font: Option<LessonCustomFont>,
    #[serde(default, rename = "importedFonts")]
    pub imported_fonts: Vec<LessonCustomFont>,
    #[serde(default, rename = "courseImageRef")]
    pub course_image_ref: Option<String>,
    #[serde(default, rename = "courseCoverTitleHtml")]
    pub course_cover_title_html: String,
    #[serde(default, rename = "courseCoverStyle")]
    pub course_cover_style: Option<CourseCoverStyle>,
    #[serde(default, rename = "activitySpacingPx")]
    pub activity_spacing_px: Option<u32>,
    #[serde(default, rename = "hideChapterTitleBanner")]
    pub hide_chapter_title_banner: bool,
    #[serde(default, rename = "courseAppearance")]
    pub course_appearance: Option<CourseAppearance>,
    #[serde(default, rename = "glossaryAssistants")]
    pub glossary_assistants: Vec<GlossaryAssistantResource>,
    #[serde(default, rename = "questionBanks")]
    pub question_banks: Vec<QuestionBankResource>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "defaultLocale")]
    pub default_locale: String,
    pub locales: Vec<String>,
    pub status: String,
    #[serde(rename = "currentVersion")]
    pub current_version: String,
    #[serde(rename = "rootCourseId")]
    pub root_course_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaideiaWorkspaceState {
    #[serde(default, rename = "readOnly")]
    pub read_only: bool,
    pub project: PaideiaProject,
    #[serde(rename = "auditEvents")]
    pub audit_events: Vec<EventRecord>,
    pub snapshots: Vec<SnapshotRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMutationResult {
    #[serde(rename = "projectPath")]
    pub project_path: String,
    #[serde(rename = "workspaceState")]
    pub workspace_state: PaideiaWorkspaceState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaideiaProject {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default, rename = "courseIntroHtml")]
    pub course_intro_html: String,
    #[serde(default, rename = "titleStyle")]
    pub title_style: Option<CourseTitleStyle>,
    #[serde(default, rename = "customFont")]
    pub custom_font: Option<LessonCustomFont>,
    #[serde(default, rename = "importedFonts")]
    pub imported_fonts: Vec<LessonCustomFont>,
    #[serde(default, rename = "courseImageRef")]
    pub course_image_ref: Option<String>,
    #[serde(default, rename = "courseCoverTitleHtml")]
    pub course_cover_title_html: String,
    #[serde(default, rename = "courseCoverStyle")]
    pub course_cover_style: Option<CourseCoverStyle>,
    #[serde(default, rename = "activitySpacingPx")]
    pub activity_spacing_px: Option<u32>,
    #[serde(default, rename = "hideChapterTitleBanner")]
    pub hide_chapter_title_banner: bool,
    #[serde(default, rename = "courseAppearance")]
    pub course_appearance: Option<CourseAppearance>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "defaultLocale")]
    pub default_locale: String,
    pub locales: Vec<String>,
    pub status: String,
    #[serde(rename = "currentVersion")]
    pub current_version: String,
    #[serde(rename = "rootCourseId")]
    pub root_course_id: String,
    pub course: PaideiaCourse,
    #[serde(default, rename = "glossaryAssistants")]
    pub glossary_assistants: Vec<GlossaryAssistantResource>,
    #[serde(default, rename = "questionBanks")]
    pub question_banks: Vec<QuestionBankResource>,
    #[serde(default, rename = "referenceBanks")]
    pub reference_banks: Vec<LessonReferenceBank>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseAppearance {
    #[serde(default = "default_true", rename = "roundedCorners")]
    pub rounded_corners: bool,
    #[serde(default = "default_true")]
    pub shadows: bool,
    #[serde(default, rename = "textColorMode")]
    pub text_color_mode: String,
    #[serde(default = "default_course_text_color", rename = "textColor")]
    pub text_color: String,
    #[serde(default = "default_course_background_color", rename = "backgroundColor")]
    pub background_color: String,
}

fn default_course_text_color() -> String {
    "#222222".to_string()
}

fn default_course_background_color() -> String {
    "#FFFFFF".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryAssistantEntry {
    pub id: String,
    pub term: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default, rename = "contentHtml")]
    pub content_html: String,
    #[serde(default)]
    pub related: Vec<String>,
    #[serde(default)]
    pub fuzzy: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryAssistantResource {
    pub id: String,
    pub name: String,
    #[serde(default, rename = "avatarRef")]
    pub avatar_ref: Option<String>,
    #[serde(default)]
    pub entries: Vec<GlossaryAssistantEntry>,
    #[serde(default, rename = "fallbackResponses")]
    pub fallback_responses: Vec<String>,
    #[serde(default, rename = "caseInsensitive")]
    pub case_insensitive: bool,
    #[serde(default, rename = "ignoreAccents")]
    pub ignore_accents: bool,
    #[serde(default, rename = "fuzzyEnabled")]
    pub fuzzy_enabled: bool,
    #[serde(default, rename = "fuzzyThreshold")]
    pub fuzzy_threshold: usize,
    #[serde(default, rename = "assistantEnabled")]
    pub assistant_enabled: bool,
    #[serde(default, rename = "alwaysVisible")]
    pub always_visible: bool,
    #[serde(default)]
    pub position: String,
    #[serde(default)]
    pub shortcut: String,
    #[serde(default, rename = "lessonIds")]
    pub lesson_ids: Vec<String>,
    #[serde(default, rename = "collectionIds")]
    pub collection_ids: Vec<String>,
    #[serde(default, rename = "projectPaths")]
    pub project_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestionBankQuestion {
    #[serde(flatten)]
    pub question: QuizQuestion,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestionBankResource {
    pub id: String,
    pub name: String,
    #[serde(default, rename = "tileImageRef")]
    pub tile_image_ref: Option<String>,
    #[serde(default)]
    pub questions: Vec<QuestionBankQuestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReferenceBankEntry {
    pub id: String,
    pub term: String,
    #[serde(default, rename = "definitionHtml")]
    pub definition_html: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LessonReferenceBank {
    pub id: String,
    pub name: String,
    #[serde(default, rename = "tileImageRef")]
    pub tile_image_ref: Option<String>,
    #[serde(default, rename = "sourceResourceId")]
    pub source_resource_id: Option<String>,
    #[serde(default, rename = "sourceRevision")]
    pub source_revision: Option<u64>,
    #[serde(default, rename = "sourceContentHash")]
    pub source_content_hash: Option<String>,
    #[serde(default)]
    pub entries: Vec<ReferenceBankEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceBankResource {
    pub id: String,
    pub name: String,
    #[serde(default, rename = "tileImageRef")]
    pub tile_image_ref: Option<String>,
    #[serde(default = "default_reference_bank_revision")]
    pub revision: u64,
    #[serde(default)]
    pub entries: Vec<ReferenceBankEntry>,
    #[serde(default, rename = "projectPaths")]
    pub project_paths: Vec<String>,
    #[serde(default, rename = "collectionIds")]
    pub collection_ids: Vec<String>,
}

fn default_reference_bank_revision() -> u64 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseTitleStyle {
    #[serde(rename = "fontFamily")]
    pub font_family: String,
    #[serde(rename = "fontSize")]
    pub font_size: String,
    pub color: String,
    #[serde(rename = "fontWeight")]
    pub font_weight: String,
    #[serde(rename = "fontStyle")]
    pub font_style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseCoverStyle {
    #[serde(rename = "heightPx")]
    pub height_px: u32,
    #[serde(default = "default_course_cover_background_position_y", rename = "backgroundPositionY")]
    pub background_position_y: f64,
    #[serde(rename = "backgroundColor")]
    pub background_color: String,
    #[serde(rename = "titleColor")]
    pub title_color: String,
    #[serde(default, rename = "titlePosition")]
    pub title_position: Option<String>,
    #[serde(default, rename = "titleAlign")]
    pub title_align: Option<String>,
    #[serde(rename = "overlayEnabled")]
    pub overlay_enabled: bool,
    #[serde(default, rename = "overlayColor")]
    pub overlay_color: Option<String>,
    #[serde(default, rename = "overlayOpacity")]
    pub overlay_opacity: Option<f64>,
    #[serde(default, rename = "overlayPosition")]
    pub overlay_position: Option<String>,
    #[serde(default, rename = "overlaySpread")]
    pub overlay_spread: Option<String>,
    #[serde(default, rename = "buttonPosition")]
    pub button_position: Option<String>,
    #[serde(default, rename = "titleOutline")]
    pub title_outline: Option<String>,
    #[serde(default, rename = "titleOutlineColor")]
    pub title_outline_color: Option<String>,
}

fn default_course_cover_background_position_y() -> f64 {
    50.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LessonCustomFont {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "fontFamily")]
    pub font_family: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "assetRef")]
    pub asset_ref: String,
    #[serde(default, rename = "licenseRef")]
    pub license_ref: Option<String>,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub faces: Vec<LessonFontFace>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LessonFontFace {
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "assetRef")]
    pub asset_ref: String,
    pub weight: u16,
    pub style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaideiaCourse {
    pub id: String,
    pub title: String,
    pub modules: Vec<PaideiaModule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaideiaModule {
    pub id: String,
    pub title: String,
    #[serde(default, alias = "lessons")]
    pub chapters: Vec<PaideiaChapter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaideiaChapter {
    pub id: String,
    pub title: String,
    pub pages: Vec<PaideiaPage>,
    #[serde(default, rename = "scormTracking")]
    pub scorm_tracking: Option<ChapterScormTracking>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterScormTracking {
    pub mode: String,
    #[serde(rename = "successStatus")]
    pub success_status: String,
    #[serde(rename = "failureStatus")]
    pub failure_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaideiaPage {
    pub id: String,
    pub title: String,
    pub blocks: Vec<PaideiaBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointOfInterestMarkerMedia {
    #[serde(rename = "type")]
    pub media_type: String,
    #[serde(rename = "assetRef")]
    pub asset_ref: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(default, rename = "posterAssetRef")]
    pub poster_asset_ref: Option<String>,
    #[serde(default, rename = "subtitleAssetRef")]
    pub subtitle_asset_ref: Option<String>,
    #[serde(default, rename = "originalAssetRef")]
    pub original_asset_ref: Option<String>,
    #[serde(default, rename = "optimizedAssetRef")]
    pub optimized_asset_ref: Option<String>,
    #[serde(default, rename = "optimizationProfile")]
    pub optimization_profile: Option<String>,
    #[serde(default, rename = "imageAccessibility")]
    pub image_accessibility: Option<ImageAccessibility>,
    #[serde(default, rename = "transcriptHtml")]
    pub transcript_html: Option<String>,
    #[serde(default, rename = "transcriptLanguage")]
    pub transcript_language: Option<String>,
    #[serde(default, rename = "transcriptSource")]
    pub transcript_source: Option<String>,
    #[serde(default, rename = "transcriptStatus")]
    pub transcript_status: Option<String>,
    #[serde(default, rename = "transcriptAllowDownload")]
    pub transcript_allow_download: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointOfInterestMarker {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub order: usize,
    pub label: String,
    pub title: String,
    #[serde(default, rename = "contentHtml")]
    pub content_html: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub media: Option<PointOfInterestMarkerMedia>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Image360Hotspot {
    pub id: String,
    pub yaw: f64,
    pub pitch: f64,
    pub order: usize,
    pub title: String,
    #[serde(default, rename = "contentHtml")]
    pub content_html: String,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageCrop {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub shape: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SituationalDialogueResponse {
    pub id: String,
    pub label: String,
    #[serde(default, rename = "feedbackHtml", skip_serializing_if = "Option::is_none")]
    pub feedback_html: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub emotion: Option<String>,
    #[serde(default, rename = "nextNodeId")]
    pub next_node_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SituationalDialogueFraming {
    pub layout: String,
    pub asset: String,
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SituationalDialogueCharacterPose {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub usage: Option<String>,
    #[serde(default)]
    pub emotion: Option<String>,
    #[serde(default, rename = "assetRef")]
    pub asset_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SituationalDialogueCharacter {
    pub id: String,
    pub name: String,
    #[serde(default, rename = "defaultCharacterId")]
    pub default_character_id: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "showNameRole")]
    pub show_name_role: Option<bool>,
    #[serde(default, rename = "backgroundRef")]
    pub background_ref: Option<String>,
    #[serde(default, rename = "defaultPoseId")]
    pub default_pose_id: Option<String>,
    #[serde(default)]
    pub poses: Vec<SituationalDialogueCharacterPose>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentFile {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "storedName")]
    pub stored_name: String,
    pub extension: String,
    #[serde(rename = "assetRef")]
    pub asset_ref: String,
    #[serde(default, rename = "sizeBytes")]
    pub size_bytes: Option<u64>,
    #[serde(default, rename = "openInNewTab")]
    pub open_in_new_tab: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizAnswer {
    pub id: String,
    #[serde(default, rename = "textHtml")]
    pub text_html: String,
    #[serde(default)]
    pub correct: bool,
    #[serde(default, rename = "feedbackHtml")]
    pub feedback_html: Option<String>,
    #[serde(default, rename = "creditPercent")]
    pub credit_percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizQuestion {
    pub id: String,
    #[serde(default, rename = "creditMode")]
    pub credit_mode: Option<String>,
    #[serde(default, rename = "sourceQuestionId")]
    pub source_question_id: Option<String>,
    #[serde(default, rename = "sourceBankId")]
    pub source_bank_id: Option<String>,
    #[serde(default)]
    pub mode: String,
    #[serde(default, rename = "questionHtml")]
    pub question_html: String,
    #[serde(default)]
    pub answers: Vec<QuizAnswer>,
    #[serde(default, rename = "generalFeedbackHtml")]
    pub general_feedback_html: Option<String>,
    #[serde(default, rename = "feedbackCorrectHtml")]
    pub feedback_correct_html: Option<String>,
    #[serde(default, rename = "feedbackIncorrectHtml")]
    pub feedback_incorrect_html: Option<String>,
    #[serde(default)]
    pub points: f64,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizSettings {
    #[serde(default, rename = "shuffleAnswers")]
    pub shuffle_answers: bool,
    #[serde(default, rename = "shuffleQuestions")]
    pub shuffle_questions: bool,
    #[serde(default, rename = "limitQuestions")]
    pub limit_questions: bool,
    #[serde(default, rename = "questionLimit")]
    pub question_limit: u32,
    #[serde(default, rename = "showFeedback")]
    pub show_feedback: bool,
    #[serde(default, rename = "showCorrectness")]
    pub show_correctness: bool,
    #[serde(default, rename = "showCorrectAnswer")]
    pub show_correct_answer: bool,
    #[serde(default, rename = "allowRetry")]
    pub allow_retry: bool,
    #[serde(default, rename = "maxAttempts")]
    pub max_attempts: u32,
    #[serde(default, rename = "passingScore")]
    pub passing_score: f64,
    #[serde(default, rename = "reviewMode")]
    pub review_mode: String,
    #[serde(default, rename = "reviewAfterAttempts")]
    pub review_after_attempts: u32,
    #[serde(default, rename = "sendScoreToLms")]
    pub send_score_to_lms: bool,
    #[serde(
        default = "default_true",
        rename = "gateChapterUntilPassed",
        alias = "gateChapterUntilPassed"
    )]
    pub gate_chapter_until_passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizActivityData {
    #[serde(default, rename = "titleHtml")]
    pub title_html: String,
    #[serde(default, rename = "titleMode")]
    pub title_mode: String,
    #[serde(default, rename = "introHtml")]
    pub intro_html: String,
    #[serde(default, rename = "startLeadHtml")]
    pub start_lead_html: String,
    #[serde(default)]
    pub questions: Vec<QuizQuestion>,
    pub settings: QuizSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindElementsPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindElementsZone {
    pub id: String,
    pub shape: String,
    pub title: String,
    pub severity: String,
    #[serde(default, rename = "descriptionHtml")]
    pub description_html: String,
    #[serde(default, rename = "riskHtml")]
    pub risk_html: String,
    #[serde(default, rename = "correctionHtml")]
    pub correction_html: String,
    #[serde(default)]
    pub x: Option<f64>,
    #[serde(default)]
    pub y: Option<f64>,
    #[serde(default)]
    pub width: Option<f64>,
    #[serde(default)]
    pub height: Option<f64>,
    #[serde(default)]
    pub points: Vec<FindElementsPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindElementsLabels {
    pub description: String,
    pub risk: String,
    pub correction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindElementsImageAppearance {
    #[serde(default = "default_find_elements_border_color", rename = "borderColor")]
    pub border_color: String,
    #[serde(default = "default_find_elements_border_style", rename = "borderStyle")]
    pub border_style: String,
    #[serde(default = "default_find_elements_border_width", rename = "borderWidth")]
    pub border_width: String,
    #[serde(default = "default_true")]
    pub rounded: bool,
    #[serde(default)]
    pub shadow: bool,
}

fn default_find_elements_border_color() -> String { "#123a7a".to_string() }
fn default_find_elements_border_style() -> String { "solid".to_string() }
fn default_find_elements_border_width() -> String { "0px".to_string() }
fn default_find_elements_image_appearance() -> FindElementsImageAppearance {
    FindElementsImageAppearance {
        border_color: default_find_elements_border_color(),
        border_style: default_find_elements_border_style(),
        border_width: default_find_elements_border_width(),
        rounded: true,
        shadow: false,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindElementsActivityData {
    #[serde(default = "default_find_elements_image_appearance", rename = "imageAppearance")]
    pub image_appearance: FindElementsImageAppearance,
    #[serde(rename = "maxAttempts")]
    pub max_attempts: i32,
    #[serde(rename = "successThreshold")]
    pub success_threshold: i32,
    pub labels: FindElementsLabels,
    pub zones: Vec<FindElementsZone>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteBlank {
    pub id: String,
    pub answer: String,
    #[serde(default)]
    pub variants: Vec<String>,
    #[serde(default, rename = "caseSensitive")]
    pub case_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteExercise {
    pub id: String,
    #[serde(default, rename = "contentHtml")]
    pub content_html: String,
    #[serde(default)]
    pub blanks: Vec<CompleteBlank>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteCover {
    #[serde(default = "default_complete_cover_enabled")]
    pub enabled: bool,
    #[serde(default = "default_complete_cover_title", rename = "titleHtml")]
    pub title_html: String,
    #[serde(default, rename = "descriptionHtml")]
    pub description_html: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompleteEnding {
    #[serde(default, rename = "successHtml")]
    pub success_html: String,
    #[serde(default, rename = "failureHtml")]
    pub failure_html: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteActivityData {
    #[serde(default, rename = "revealAnswersOnFinalReview")]
    pub reveal_answers_on_final_review: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orientation: Option<String>,
    #[serde(default = "default_complete_cover")]
    pub cover: CompleteCover,
    #[serde(default)]
    pub ending: CompleteEnding,
    #[serde(default)]
    pub exercises: Vec<CompleteExercise>,
    #[serde(default = "default_complete_max_attempts", rename = "maxAttempts")]
    pub max_attempts: i32,
    #[serde(default = "default_complete_success_threshold", rename = "successThreshold")]
    pub success_threshold: i32,
    #[serde(default, rename = "gateChapterUntilPassed")]
    pub gate_chapter_until_passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardSortCategory {
    pub id: String,
    pub label: String,
    #[serde(default, rename = "labelHtml")]
    pub label_html: String,
    #[serde(default = "default_card_sort_border_color", rename = "borderColor", alias = "backgroundColor")]
    pub border_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardSortAppearance {
    #[serde(default = "default_card_sort_background_color", rename = "backgroundColor")]
    pub background_color: String,
    #[serde(default = "default_card_sort_border_color", rename = "borderColor")]
    pub border_color: String,
    #[serde(default = "default_card_sort_border_width", rename = "borderWidth")]
    pub border_width: String,
    #[serde(default = "default_card_sort_border_style", rename = "borderStyle")]
    pub border_style: String,
    #[serde(default = "default_true")]
    pub rounded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardSortActivityData {
    #[serde(default)]
    pub categories: Vec<CardSortCategory>,
    #[serde(default = "default_card_sort_max_attempts", rename = "maxAttempts")]
    pub max_attempts: i32,
    #[serde(default = "default_card_sort_success_threshold", rename = "successThreshold")]
    pub success_threshold: i32,
    #[serde(default, rename = "gateChapterUntilPassed")]
    pub gate_chapter_until_passed: bool,
    #[serde(default, rename = "interactionMode")]
    pub interaction_mode: Option<String>,
    #[serde(default, rename = "successFeedbackHtml")]
    pub success_feedback_html: String,
    #[serde(default, rename = "failureFeedbackHtml")]
    pub failure_feedback_html: String,
    #[serde(default = "default_card_sort_appearance", rename = "cardAppearance")]
    pub card_appearance: CardSortAppearance,
}

fn default_card_sort_max_attempts() -> i32 { 3 }
fn default_card_sort_success_threshold() -> i32 { 80 }
fn default_card_sort_background_color() -> String { "#FFFFFF".to_string() }
fn default_card_sort_border_color() -> String { "#244585".to_string() }
fn default_card_sort_border_width() -> String { "1px".to_string() }
fn default_card_sort_border_style() -> String { "solid".to_string() }
fn default_card_sort_appearance() -> CardSortAppearance {
    CardSortAppearance {
        background_color: default_card_sort_background_color(),
        border_color: default_card_sort_border_color(),
        border_width: default_card_sort_border_width(),
        border_style: default_card_sort_border_style(),
        rounded: true,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingPair {
    pub id: String,
    #[serde(rename = "leftId")]
    pub left_id: String,
    #[serde(rename = "rightId")]
    pub right_id: String,
    #[serde(default, rename = "leftHtml")]
    pub left_html: String,
    #[serde(default, rename = "rightHtml")]
    pub right_html: String,
    #[serde(default, rename = "leftBackgroundColor")]
    pub left_background_color: Option<String>,
    #[serde(default, rename = "rightBackgroundColor")]
    pub right_background_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingAppearance {
    #[serde(default = "default_card_sort_background_color", rename = "backgroundColor")]
    pub background_color: String,
    #[serde(default = "default_card_sort_border_color", rename = "borderColor")]
    pub border_color: String,
    #[serde(default = "default_card_sort_border_width", rename = "borderWidth")]
    pub border_width: String,
    #[serde(default = "default_card_sort_border_style", rename = "borderStyle")]
    pub border_style: String,
    #[serde(default = "default_true")]
    pub rounded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingActivityData {
    #[serde(default)]
    pub pairs: Vec<MatchingPair>,
    #[serde(default = "default_card_sort_max_attempts", rename = "maxAttempts")]
    pub max_attempts: i32,
    #[serde(default = "default_card_sort_success_threshold", rename = "successThreshold")]
    pub success_threshold: i32,
    #[serde(default = "default_true", rename = "showAttemptFeedback")]
    pub show_attempt_feedback: bool,
    #[serde(default, rename = "successFeedbackHtml")]
    pub success_feedback_html: String,
    #[serde(default, rename = "failureFeedbackHtml")]
    pub failure_feedback_html: String,
    #[serde(default = "default_matching_appearance", rename = "labelAppearance")]
    pub label_appearance: MatchingAppearance,
}

fn default_matching_appearance() -> MatchingAppearance {
    MatchingAppearance {
        background_color: default_card_sort_background_color(),
        border_color: default_card_sort_border_color(),
        border_width: default_card_sort_border_width(),
        border_style: default_card_sort_border_style(),
        rounded: true,
    }
}

fn default_complete_max_attempts() -> i32 { 3 }
fn default_complete_success_threshold() -> i32 { 80 }
fn default_complete_cover_enabled() -> bool { true }
fn default_complete_cover_title() -> String { "<h1>Texte à compléter</h1>".to_string() }
fn default_complete_cover() -> CompleteCover { CompleteCover { enabled: true, title_html: default_complete_cover_title(), description_html: String::new() } }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAccessibility {
    #[serde(default, rename = "altText")]
    pub alt_text: String,
    #[serde(default)]
    pub decorative: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityItem {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default, rename = "nodeType")]
    pub node_type: Option<String>,
    #[serde(default, rename = "situationalDialogueIntroductionVisible", skip_serializing_if = "Option::is_none")]
    pub situational_dialogue_introduction_visible: Option<bool>,
    #[serde(default, rename = "characterId")]
    pub character_id: Option<String>,
    #[serde(default, rename = "characterName")]
    pub character_name: Option<String>,
    #[serde(default, rename = "characterRole")]
    pub character_role: Option<String>,
    #[serde(default, rename = "situationalDialoguePoseRefs")]
    pub situational_dialogue_pose_refs: HashMap<String, String>,
    #[serde(default)]
    pub emotion: Option<String>,
    #[serde(default, rename = "nextNodeId")]
    pub next_node_id: Option<String>,
    #[serde(default)]
    pub responses: Vec<SituationalDialogueResponse>,
    #[serde(default, rename = "dateLabel")]
    pub date_label: Option<String>,
    #[serde(default, rename = "contentTitle")]
    pub content_title: Option<String>,
    #[serde(default, rename = "timeColor")]
    pub time_color: Option<String>,
    #[serde(default, rename = "titleColor")]
    pub title_color: Option<String>,
    #[serde(default, rename = "accentColor")]
    pub accent_color: Option<String>,
    #[serde(default, rename = "contentHtml")]
    pub content_html: String,
    #[serde(default, rename = "assetRefs")]
    pub asset_refs: Vec<String>,
    #[serde(default, rename = "mediaFileName")]
    pub media_file_name: Option<String>,
    #[serde(default, rename = "mediaLayout")]
    pub media_layout: Option<String>,
    #[serde(default, rename = "imageSize")]
    pub image_size: Option<String>,
    #[serde(default, rename = "imageRounded")]
    pub image_rounded: Option<bool>,
    #[serde(default, rename = "imageCrop")]
    pub image_crop: Option<ImageCrop>,
    #[serde(default, rename = "imageAccessibility")]
    pub image_accessibility: Option<ImageAccessibility>,
    #[serde(default, rename = "imageAnnotationStateRef")]
    pub image_annotation_state_ref: Option<String>,
    #[serde(default, rename = "imageAnnotationSourceAssetRef")]
    pub image_annotation_source_asset_ref: Option<String>,
    #[serde(default, rename = "frontType")]
    pub front_type: Option<String>,
    #[serde(default, rename = "frontText")]
    pub front_text: Option<String>,
    #[serde(default, rename = "frontImageAssetRef")]
    pub front_image_asset_ref: Option<String>,
    #[serde(default, rename = "frontImageFileName")]
    pub front_image_file_name: Option<String>,
    #[serde(default, rename = "frontImageCrop")]
    pub front_image_crop: Option<ImageCrop>,
    #[serde(default, rename = "frontImageAccessibility")]
    pub front_image_accessibility: Option<ImageAccessibility>,
    #[serde(default, rename = "backType")]
    pub back_type: Option<String>,
    #[serde(default, rename = "backTitle")]
    pub back_title: Option<String>,
    #[serde(default, rename = "backImageAssetRef")]
    pub back_image_asset_ref: Option<String>,
    #[serde(default, rename = "backImageFileName")]
    pub back_image_file_name: Option<String>,
    #[serde(default, rename = "backImageCrop")]
    pub back_image_crop: Option<ImageCrop>,
    #[serde(default, rename = "backImageAccessibility")]
    pub back_image_accessibility: Option<ImageAccessibility>,
    #[serde(default, rename = "resourceUrl")]
    pub resource_url: Option<String>,
    #[serde(default, rename = "resourceRawDestination")]
    pub resource_raw_destination: Option<String>,
    #[serde(default, rename = "resourceOpenMode")]
    pub resource_open_mode: Option<String>,
    #[serde(default, rename = "resourceValid")]
    pub resource_valid: Option<bool>,
    #[serde(default, rename = "correctCategoryId")]
    pub correct_category_id: Option<String>,
    #[serde(default, rename = "cardBackgroundColor")]
    pub card_background_color: Option<String>,
    #[serde(default, rename = "cardFeedbackHtml")]
    pub card_feedback_html: Option<String>,
    #[serde(default, rename = "cardFeedbackCorrectHtml")]
    pub card_feedback_correct_html: Option<String>,
    #[serde(default, rename = "cardFeedbackIncorrectHtml")]
    pub card_feedback_incorrect_html: Option<String>,
    #[serde(default, rename = "transcriptHtml")]
    pub transcript_html: Option<String>,
    #[serde(default, rename = "transcriptLanguage")]
    pub transcript_language: Option<String>,
    #[serde(default, rename = "transcriptSource")]
    pub transcript_source: Option<String>,
    #[serde(default, rename = "transcriptStatus")]
    pub transcript_status: Option<String>,
    #[serde(default, rename = "transcriptAllowDownload")]
    pub transcript_allow_download: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaideiaBlock {
    pub id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    #[serde(default)]
    pub family: Option<String>,
    #[serde(default)]
    pub variant: Option<String>,
    pub title: String,
    pub summary: String,
    #[serde(default, rename = "contentHtml")]
    pub content_html: Option<String>,
    #[serde(default, rename = "quoteAuthorHtml")]
    pub quote_author_html: Option<String>,
    #[serde(default, rename = "quoteShowAuthor")]
    pub quote_show_author: Option<bool>,
    #[serde(default, rename = "htmlAssetRoot")]
    pub html_asset_root: Option<String>,
    #[serde(default, rename = "htmlEntryFile")]
    pub html_entry_file: Option<String>,
    #[serde(default, rename = "htmlPackageName")]
    pub html_package_name: Option<String>,
    #[serde(default, rename = "mediaLayout")]
    pub media_layout: Option<String>,
    #[serde(default, rename = "imageSize")]
    pub image_size: Option<String>,
    #[serde(default, rename = "contentWidth")]
    pub content_width: Option<String>,
    #[serde(default, rename = "contentAlign")]
    pub content_align: Option<String>,
    #[serde(default, rename = "mediaGap")]
    pub media_gap: Option<String>,
    #[serde(default, rename = "verticalAlign")]
    pub vertical_align: Option<String>,
    #[serde(default, rename = "imageRounded")]
    pub image_rounded: Option<bool>,
    #[serde(default, rename = "mediaFileName")]
    pub media_file_name: Option<String>,
    #[serde(default, rename = "imageCrop")]
    pub image_crop: Option<ImageCrop>,
    #[serde(default, rename = "imageAccessibility")]
    pub image_accessibility: Option<ImageAccessibility>,
    #[serde(default, rename = "imageAnnotationStateRef")]
    pub image_annotation_state_ref: Option<String>,
    #[serde(default, rename = "imageAnnotationSourceAssetRef")]
    pub image_annotation_source_asset_ref: Option<String>,
    #[serde(default, rename = "videoCaptionColor")]
    pub video_caption_color: Option<String>,
    #[serde(default, rename = "videoCaptionBackgroundEnabled")]
    pub video_caption_background_enabled: Option<bool>,
    #[serde(default, rename = "videoCaptionOutline")]
    pub video_caption_outline: Option<String>,
    #[serde(default, rename = "videoSubtitleOriginalRef")]
    pub video_subtitle_original_ref: Option<String>,
    #[serde(default, rename = "videoOriginalAssetRef")]
    pub video_original_asset_ref: Option<String>,
    #[serde(default, rename = "videoOptimizedAssetRef")]
    pub video_optimized_asset_ref: Option<String>,
    #[serde(default, rename = "videoOptimizationProfile")]
    pub video_optimization_profile: Option<String>,
    #[serde(default, rename = "videoAllowFullscreen")]
    pub video_allow_fullscreen: Option<bool>,
    #[serde(default, rename = "audioAutoplayNext")]
    pub audio_autoplay_next: Option<bool>,
    #[serde(default, rename = "audioAllowDownload")]
    pub audio_allow_download: Option<bool>,
    #[serde(default, rename = "image360InitialYaw")]
    pub image360_initial_yaw: Option<f64>,
    #[serde(default, rename = "image360InitialPitch")]
    pub image360_initial_pitch: Option<f64>,
    #[serde(default, rename = "image360ZoomEnabled")]
    pub image360_zoom_enabled: Option<bool>,
    #[serde(default, rename = "image360FullWidth")]
    pub image360_full_width: Option<bool>,
    #[serde(default, rename = "image360AllowFullscreen")]
    pub image360_allow_fullscreen: Option<bool>,
    #[serde(default, rename = "headerBackgroundColor")]
    pub header_background_color: Option<String>,
    #[serde(default, rename = "headerTextColor")]
    pub header_text_color: Option<String>,
    #[serde(default, rename = "headerTextOutline")]
    pub header_text_outline: Option<String>,
    #[serde(default, rename = "headerTextOutlineColor")]
    pub header_text_outline_color: Option<String>,
    #[serde(default, rename = "headerHeight")]
    pub header_height: Option<String>,
    #[serde(default, rename = "headerImagePositionY")]
    pub header_image_position_y: Option<f64>,
    #[serde(default, rename = "buttonBackgroundColor")]
    pub button_background_color: Option<String>,
    #[serde(default, rename = "buttonTextColor")]
    pub button_text_color: Option<String>,
    #[serde(default, rename = "panelBackgroundColor")]
    pub panel_background_color: Option<String>,
    #[serde(default, rename = "panelBorderColor")]
    pub panel_border_color: Option<String>,
    #[serde(default, rename = "panelBorderWidth")]
    pub panel_border_width: Option<String>,
    #[serde(default, rename = "panelBorderStyle")]
    pub panel_border_style: Option<String>,
    #[serde(default, rename = "panelPadding")]
    pub panel_padding: Option<String>,
    #[serde(default, rename = "panelRounded")]
    pub panel_rounded: Option<bool>,
    #[serde(default, rename = "panelShadow")]
    pub panel_shadow: Option<bool>,
    #[serde(default, rename = "noteIcon")]
    pub note_icon: Option<String>,
    #[serde(default, rename = "noteShowIcon")]
    pub note_show_icon: Option<bool>,
    #[serde(default, rename = "noteIconColor")]
    pub note_icon_color: Option<String>,
    #[serde(default, rename = "noteIconMatchesBorder")]
    pub note_icon_matches_border: Option<bool>,
    #[serde(default, rename = "flipCardFrontBackgroundColor")]
    pub flip_card_front_background_color: Option<String>,
    #[serde(default, rename = "flipCardBackBackgroundColor")]
    pub flip_card_back_background_color: Option<String>,
    #[serde(default, rename = "flipCardFrontBorderColor")]
    pub flip_card_front_border_color: Option<String>,
    #[serde(default, rename = "flipCardBackBorderColor")]
    pub flip_card_back_border_color: Option<String>,
    #[serde(default, rename = "slidesActivityBackgroundColor")]
    pub slides_activity_background_color: Option<String>,
    #[serde(default, rename = "slidesActivityBorderColor")]
    pub slides_activity_border_color: Option<String>,
    #[serde(default, rename = "slidesActivityBorderWidth")]
    pub slides_activity_border_width: Option<String>,
    #[serde(default, rename = "slidesActivityBorderStyle")]
    pub slides_activity_border_style: Option<String>,
    #[serde(default, rename = "slidesActivityRounded")]
    pub slides_activity_rounded: Option<bool>,
    #[serde(default, rename = "slidesActivityShadow")]
    pub slides_activity_shadow: Option<bool>,
    #[serde(default, rename = "sectionBackgroundColor")]
    pub section_background_color: Option<String>,
    #[serde(default, rename = "sectionBackgroundImageRef")]
    pub section_background_image_ref: Option<String>,
    #[serde(default, rename = "sectionBackgroundOpacity")]
    pub section_background_opacity: Option<f64>,
    #[serde(default, rename = "sectionBackgroundOverlayDark")]
    pub section_background_overlay_dark: Option<bool>,
    #[serde(default, rename = "sectionBackgroundBlur")]
    pub section_background_blur: Option<f64>,
    #[serde(default, rename = "sectionBackgroundPositionY")]
    pub section_background_position_y: Option<f64>,
    #[serde(default, rename = "sectionBackgroundRounded")]
    pub section_background_rounded: Option<bool>,
    #[serde(default, rename = "sectionBackgroundShadow", skip_serializing_if = "Option::is_none")]
    pub section_background_shadow: Option<String>,
    #[serde(default, rename = "sectionBackgroundWide")]
    pub section_background_wide: Option<bool>,
    #[serde(default, rename = "sectionBackgroundHeight")]
    pub section_background_height: Option<String>,
    #[serde(default, rename = "dividerColor")]
    pub divider_color: Option<String>,
    #[serde(default, rename = "dividerWidth")]
    pub divider_width: Option<String>,
    #[serde(default, rename = "dividerStyle")]
    pub divider_style: Option<String>,
    #[serde(default, rename = "markerScheme")]
    pub marker_scheme: Option<String>,
    #[serde(default, rename = "markerType")]
    pub marker_type: Option<String>,
    #[serde(default, rename = "markerTextColor")]
    pub marker_text_color: Option<String>,
    #[serde(default, rename = "pointOfInterestMarkers")]
    pub point_of_interest_markers: Vec<PointOfInterestMarker>,
    #[serde(default, rename = "image360Hotspots")]
    pub image360_hotspots: Vec<Image360Hotspot>,
    #[serde(default, rename = "activityItems")]
    pub activity_items: Vec<ActivityItem>,
    #[serde(default, rename = "situationalDialogueCharacters")]
    pub situational_dialogue_characters: Vec<SituationalDialogueCharacter>,
    #[serde(default, rename = "situationalDialogueTitleHtml", skip_serializing_if = "Option::is_none")]
    pub situational_dialogue_title_html: Option<String>,
    #[serde(default, rename = "situationalDialogueBannerColor", skip_serializing_if = "Option::is_none")]
    pub situational_dialogue_banner_color: Option<String>,
    #[serde(default, rename = "situationalDialogueFraming", skip_serializing_if = "Vec::is_empty")]
    pub situational_dialogue_framing: Vec<SituationalDialogueFraming>,
    #[serde(default, rename = "attachmentFiles")]
    pub attachment_files: Vec<AttachmentFile>,
    #[serde(default)]
    pub quiz: Option<QuizActivityData>,
    #[serde(default, rename = "findElements")]
    pub find_elements: Option<FindElementsActivityData>,
    #[serde(default)]
    pub complete: Option<CompleteActivityData>,
    #[serde(default, rename = "cardSort")]
    pub card_sort: Option<CardSortActivityData>,
    #[serde(default)]
    pub matching: Option<MatchingActivityData>,
    #[serde(default, rename = "markerPopupWidth")]
    pub marker_popup_width: Option<String>,
    #[serde(default, rename = "markerPopupHeight")]
    pub marker_popup_height: Option<String>,
    #[serde(default, rename = "paddingOffset")]
    pub padding_offset: Option<i32>,
    #[serde(rename = "trackingKey")]
    pub tracking_key: String,
    #[serde(default, rename = "sourceFormat")]
    pub source_format: Option<String>,
    #[serde(default, rename = "sourceBlockType")]
    pub source_block_type: Option<String>,
    #[serde(default, rename = "sourceRawHtml")]
    pub source_raw_html: Option<String>,
    #[serde(default, rename = "assetRefs")]
    pub asset_refs: Vec<String>,
    #[serde(default, rename = "richInlineAssetRefs")]
    pub rich_inline_asset_refs: Vec<String>,
    #[serde(default, rename = "subtitleRefs")]
    pub subtitle_refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotRecord {
    pub id: String,
    pub label: String,
    #[serde(rename = "versionTag")]
    pub version_tag: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "manifestPath")]
    pub manifest_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventRecord {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "aggregateType")]
    pub aggregate_type: String,
    #[serde(rename = "aggregateId")]
    pub aggregate_id: String,
    #[serde(rename = "eventType")]
    pub event_type: String,
    #[serde(rename = "actorUserId")]
    pub actor_user_id: String,
    #[serde(rename = "actorRole")]
    pub actor_role: String,
    pub timestamp: String,
    pub machine: String,
    #[serde(default)]
    pub label: String,
    #[serde(default, rename = "targetPath")]
    pub target_path: String,
    #[serde(default)]
    pub payload: serde_json::Value,
    #[serde(default)]
    pub diff: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportReport {
    #[serde(rename = "sourceType")]
    pub source_type: String,
    pub confidence: String,
    pub summary: ImportSummary,
    pub issues: Vec<ImportIssue>,
    #[serde(default)]
    pub rematching: Vec<ImportRematchingEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSummary {
    #[serde(rename = "chaptersDetected")]
    pub chapters_detected: usize,
    #[serde(rename = "blocksDetected")]
    pub blocks_detected: usize,
    #[serde(rename = "blocksMappedExactly")]
    pub blocks_mapped_exactly: usize,
    #[serde(rename = "blocksMappedApproximately")]
    pub blocks_mapped_approximately: usize,
    #[serde(rename = "blocksUnsupported")]
    pub blocks_unsupported: usize,
    #[serde(rename = "assetsCopied")]
    pub assets_copied: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportIssue {
    pub severity: String,
    pub location: String,
    #[serde(rename = "sourceBlockType")]
    pub source_block_type: String,
    #[serde(rename = "mappedTo")]
    pub mapped_to: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRematchingEntry {
    pub location: String,
    #[serde(rename = "sourceLabel")]
    pub source_label: String,
    #[serde(rename = "sourceFamily")]
    pub source_family: String,
    #[serde(rename = "sourceVariant")]
    pub source_variant: String,
    #[serde(rename = "sourceType")]
    pub source_type: String,
    #[serde(rename = "mappedTo")]
    pub mapped_to: String,
    pub status: String,
    #[serde(default, rename = "missingProperties")]
    pub missing_properties: Vec<String>,
    #[serde(default, rename = "artifactPath")]
    pub artifact_path: Option<String>,
}

#[cfg(test)]
mod complete_final_review_tests {
    use super::CompleteActivityData;

    #[test]
    fn complete_final_review_defaults_off_and_survives_serialization() {
        let legacy: CompleteActivityData = serde_json::from_str("{}").unwrap();
        assert!(!legacy.reveal_answers_on_final_review);
        let configured: CompleteActivityData = serde_json::from_str(r#"{"revealAnswersOnFinalReview":true}"#).unwrap();
        let saved = serde_json::to_value(&configured).unwrap();
        assert_eq!(saved["revealAnswersOnFinalReview"], true);
        let reopened: CompleteActivityData = serde_json::from_value(saved).unwrap();
        assert!(reopened.reveal_answers_on_final_review);
    }
}
