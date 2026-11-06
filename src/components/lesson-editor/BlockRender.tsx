import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useI18n } from "../../i18n/react";
import imageDefaultPreview from "../../assets/image-default-preview.webp";
import imageTextDefaultPreview from "../../assets/image-text-default-preview.webp";
import type { QuizResult } from "../../assessment";
import { AttachmentActivity } from "../activities/AttachmentActivity";
import { LinksResourcesActivity } from "../activities/LinksResourcesActivity";
import { TimelineActivity, type TimelineInlineField } from "../activities/TimelineActivity";
import { SlidesActivity, type SlidesInlineField } from "../activities/SlidesActivity";
import { VideoActivity } from "../activities/VideoActivity";
import { AudioActivity, normalizeAudioTracks } from "../activities/AudioActivity";
import {
  DEFAULT_IMAGE360_ASSET,
  IMAGE360_BLOCK_DEFAULTS,
  Image360Activity,
  normalizeImage360Hotspots
} from "../activities/Image360Activity";
import { TextActivity } from "../activities/TextActivity";
import { HeaderActivity, headerBannerStyle } from "../activities/HeaderActivity";
import { ImageActivity } from "../activities/ImageActivity";
import { ImageTextActivity } from "../activities/ImageTextActivity";
import { ImageGridActivity } from "../activities/ImageGridActivity";
import { FindElementsActivity, normalizeFindElementsData } from "../activities/FindElementsActivity";
import { CompleteActivity, normalizeCompleteData } from "../activities/CompleteActivity";
import { CardSortActivity, normalizeCardSortData, normalizeCardSortItems } from "../activities/CardSortActivity";
import { MatchingActivity, normalizeMatchingData } from "../activities/MatchingActivity";
import { AccordionActivity, type AccordionActivityProps } from "../activities/AccordionActivity";
import { FlipCardsActivity } from "../activities/FlipCardsActivity";
import { TabsActivity, type TabsActivityProps } from "../activities/TabsActivity";
import { HtmlCustomActivity, isDefaultCustomHtmlContent } from "../activities/HtmlCustomActivity";
import { PointOfInterestActivity } from "../activities/PointOfInterestActivity";
import { DividerActivity, blockDividerStyle } from "../activities/DividerActivity";
import { SectionMarkerActivity } from "../activities/SectionMarkerActivity";
import {
  SituationalDialogueActivity,
  normalizeSituationalDialogueActivityItems,
  normalizeSituationalDialogueResponses,
  resolveSituationalDialogueCharacterAssetRef
} from "../activities/SituationalDialogueActivity";
import {
  LessonNavigationActivity,
  blockButtonStyle,
  courseExitLayoutHasText,
  normalizeCourseExitLayout
} from "../activities/LessonNavigationActivity";
import { NoteActivity, normalizeNoteIcon } from "../activities/NoteActivity";
import {
  QuoteActivity,
  quoteAccentColor,
  quoteBackgroundColor,
  quoteBorderWidth,
  quoteImageWidth
} from "../activities/QuoteActivity";
import { QuizActivity } from "../activities/QuizActivity";
import { QuestionMultiple } from "../activities/QuizActivity/QuestionMultiple";
import { QuestionUnique } from "../activities/QuizActivity/QuestionUnique";
import { QuestionVraiFaux } from "../activities/QuizActivity/QuestionVraiFaux";
import { RandomQuestions } from "../activities/QuizActivity/RandomQuestions";
import { AudioCoverFallback } from "../app/AudioCoverFallback";
import { CroppedImage } from "../app/CroppedImage";
import { CustomHtmlPreview } from "../app/CustomHtmlPreview";
import type { RichTextToolbarProfile } from "../rich-text-toolbar/RichTextToolbar";
import {
  clampPercent,
  firstAssetRef,
  firstItemAudioAssetRef,
  firstItemImageAssetRef,
  isSupportedImageAsset,
  isSupportedVideoAsset
} from "../../app/mediaAssets";
import type { ActivityItem, AttachmentFile, PaideiaBlock, QuizActivityData } from "../../types/project";
import { buildAssetUrl, buildHtmlAssetBaseUrl } from "../../app/assetUrls";
import { imageAltAttributes } from "../../lib/imageAccessibility";
import { normalizeHexColor, resolveContextualTextColor } from "../../app/textContrast";

function mixHexColor(source: string, target: "#000000" | "#FFFFFF", ratio: number) {
  const normalizedSource = normalizeHexColor(source);
  if (!normalizedSource) {
    return null;
  }
  const sourceChannels = [1, 3, 5].map((offset) => Number.parseInt(normalizedSource.slice(offset, offset + 2), 16));
  const targetChannel = target === "#FFFFFF" ? 255 : 0;
  const mixedChannels = sourceChannels.map((channel) => Math.round(channel + (targetChannel - channel) * ratio));
  return mixedChannels;
}

function situationalDialogueDecorStyle(backgroundColor?: string | null): CSSProperties {
  const normalizedBackground = normalizeHexColor(backgroundColor);
  if (!normalizedBackground) {
    return {};
  }
  const channels = [1, 3, 5].map((offset) => Number.parseInt(normalizedBackground.slice(offset, offset + 2), 16));
  const luminance = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
  const target = luminance <= 0.5 ? "#FFFFFF" : "#000000";
  const softChannels = mixHexColor(normalizedBackground, target, luminance <= 0.5 ? 0.32 : 0.1);
  const dotChannels = mixHexColor(normalizedBackground, target, luminance <= 0.5 ? 0.58 : 0.34);
  if (!softChannels || !dotChannels) {
    return {};
  }
  return {
    ["--situational-dialogue-decor-soft" as string]: `rgba(${softChannels.join(", ")}, 0.73)`,
    ["--situational-dialogue-decor-dots" as string]: `rgba(${dotChannels.join(", ")}, 0.52)`
  } as CSSProperties;
}

export type BlockRenderHelpers = {
  DEFAULT_VIDEO_CAPTION_COLOR: string;
  IMAGE_BLOCK_MOCK_LABEL: string;
  REQUIRE_MANUAL_EXTERNAL_IFRAME_ACTIVATION: boolean;
  audioAccentColor: (block: Pick<PaideiaBlock, "buttonTextColor" | "panelBorderColor">) => string;
  blockPanelStyle: (block: PaideiaBlock) => CSSProperties;
  blockSectionStyle: (block: PaideiaBlock, projectPath: string) => CSSProperties;
  defaultInlineBlockDocument: (blockType: string) => string;
  hasBlockSectionStyle: (block: PaideiaBlock) => boolean;
  imageSizeToPercent: (sizeToken?: string | null) => number;
  normalizeFrenchTypographyInHtml: (value: string) => string;
  normalizeQuizData: (quiz: QuizActivityData | null | undefined) => QuizActivityData;
  normalizeSlidesActivityItems: (items: ActivityItem[]) => ActivityItem[];
  normalizedContentAlign: (blockLike: { contentAlign?: string | null }) => "left" | "center" | "right" | "justify";
  normalizedContentWidth: (blockLike: { contentWidth?: string | null }) => string;
  normalizedImageSize: (blockLike: { imageSize?: string | null }) => string;
  normalizedMediaGap: (blockLike: { mediaGap?: string | null }) => string;
  normalizedMediaLayout: (block: PaideiaBlock) => string;
  normalizedVerticalAlign: (blockLike: { verticalAlign?: string | null }) => string;
  optionalHtmlOrNull: (value?: string | null) => string | null;
  SituationalDialogueOverlayOpacityFromBlock: (block: PaideiaBlock) => number;
  stripHtmlForEditor: (value: string) => string;
  visibleBlockSummary: (block: PaideiaBlock) => string;
  visibleBlockTitle: (block: PaideiaBlock) => string;
  visibleButtonText: (block: PaideiaBlock) => string;
};

export function BlockRender({
  block,
  courseBackgroundColor,
  courseTextColor,
  sectionMarkerLabel = "1",
  sectionMarkerFontSize = "1.5rem",
  enableExternalHtmlViewportUnload = false,
  projectPath,
  onContinue,
  onCourseExit,
  onImageOpen,
  onHeaderImagePositionChange,
  onSituationalDialogueBackgroundPositionChange,
  onAttachmentDownload,
  onActivityComplete,
  onQuizStart,
  quizAutomaticTitle,
  quizStarted = false,
  quizResults = {},
  resultMessageSourceIsValid = true,
  authoringMode = false,
  renderRichContent,
  renderSlidesItemField,
  renderTabsItemField,
  onBeforeTabsTabChange,
  renderAccordionItemContent,
  renderAccordionItemTitle,
  onBeforeAccordionPanelToggle,
  renderTimelineItemField,
  onTimelineItemAdd,
  onSlidesItemAdd,
  image360PickingHotspotId = null,
  onImage360ScenePointPick,
  onImage360ViewChange,
  helpers,
}: {
  block: PaideiaBlock;
  courseBackgroundColor?: string;
  courseTextColor?: string;
  sectionMarkerLabel?: string;
  sectionMarkerFontSize?: string;
  authoringMode?: boolean;
  enableExternalHtmlViewportUnload?: boolean;
  projectPath: string;
  onContinue?: (blockId: string) => void;
  onCourseExit?: () => void;
  onImageOpen?: (src: string, alt: string, rounded?: boolean) => void;
  onHeaderImagePositionChange?: (blockId: string, value: number) => void;
  onSituationalDialogueBackgroundPositionChange?: (blockId: string, value: number) => void;
  onAttachmentDownload?: (block: PaideiaBlock, file: AttachmentFile) => void;
  onActivityComplete?: (blockId: string, result?: QuizResult) => void;
  onQuizStart?: (blockId: string) => void;
  quizAutomaticTitle?: string;
  quizStarted?: boolean;
  quizResults?: Record<string, QuizResult>;
  resultMessageSourceIsValid?: boolean;
  renderRichContent?: (html: string, className?: string) => ReactNode;
  renderTabsItemField?: TabsActivityProps["renderItemField"];
  onBeforeTabsTabChange?: () => void;
  renderAccordionItemContent?: AccordionActivityProps["renderItemContent"];
  renderAccordionItemTitle?: AccordionActivityProps["renderItemTitle"];
  onBeforeAccordionPanelToggle?: () => void;
  renderSlidesItemField?: (
    block: PaideiaBlock,
    item: ActivityItem,
    field: SlidesInlineField,
    html: string,
    className: string,
    profile: RichTextToolbarProfile
  ) => ReactNode;
  renderTimelineItemField?: (
    block: PaideiaBlock,
    item: ActivityItem,
    field: TimelineInlineField,
    html: string,
    className: string,
    profile: RichTextToolbarProfile
  ) => ReactNode;
  onTimelineItemAdd?: (block: PaideiaBlock) => void;
  onSlidesItemAdd?: (block: PaideiaBlock) => void;
  image360PickingHotspotId?: string | null;
  onImage360ScenePointPick?: (blockId: string, yaw: number, pitch: number) => void;
  onImage360ViewChange?: (blockId: string, yaw: number, pitch: number) => void;
  helpers: BlockRenderHelpers;
}) {
  const { t } = useI18n();
  const {
    DEFAULT_VIDEO_CAPTION_COLOR,
    IMAGE_BLOCK_MOCK_LABEL,
    REQUIRE_MANUAL_EXTERNAL_IFRAME_ACTIVATION,
    audioAccentColor,
    blockPanelStyle,
    blockSectionStyle,
    defaultInlineBlockDocument,
    hasBlockSectionStyle,
    imageSizeToPercent,
    normalizeFrenchTypographyInHtml,
    normalizeQuizData,
    normalizeSlidesActivityItems,
    normalizedContentAlign,
    normalizedContentWidth,
    normalizedImageSize,
    normalizedMediaGap,
    normalizedMediaLayout,
    normalizedVerticalAlign,
    optionalHtmlOrNull,
    SituationalDialogueOverlayOpacityFromBlock,
    stripHtmlForEditor,
    visibleBlockSummary,
    visibleBlockTitle,
    visibleButtonText
  } = helpers;
  const blockImageAlt = imageAltAttributes(block.imageAccessibility);
  // Imported Rise projects may contain a legacy duplicate of the activity
  // background in assetRefs. It is not content and must never become an image
  // inside a Rich Text field (or another activity body).
  const contentAssetRefs = block.type === "rich-text" && block.sourceFormat === "rise-scorm"
    ? (block.assetRefs ?? []).filter((assetRef) => !isSupportedImageAsset(assetRef))
    : block.type === "header" || block.type === "image"
      ? block.assetRefs
      : (block.assetRefs ?? []).filter((assetRef) => assetRef !== block.sectionBackgroundImageRef);
  const imageAssetRef = firstAssetRef(contentAssetRefs, isSupportedImageAsset);
  const videoAssetRef = firstAssetRef(contentAssetRefs, isSupportedVideoAsset);
  const imageAsset = buildAssetUrl(projectPath, imageAssetRef);
  const image360Asset = block.type === "image-360" ? imageAsset ?? DEFAULT_IMAGE360_ASSET : imageAsset;
  const quoteImageRefs =
    block.type === "quote" ? (contentAssetRefs ?? []).filter((assetRef) => isSupportedImageAsset(assetRef)) : [];
  const quoteMediaLayout = block.type === "quote" ? normalizedMediaLayout(block) : "image-left";
  const quoteHasAvatar = block.type === "quote" && ["image-left", "image-right", "image-center"].includes(quoteMediaLayout);
  const quoteAvatarAsset = buildAssetUrl(projectPath, quoteHasAvatar ? quoteImageRefs[0] : null);
  const videoAsset = buildAssetUrl(projectPath, videoAssetRef);
  const subtitleAsset = buildAssetUrl(projectPath, block.subtitleRefs?.[0]);
  const rawContentHtml = block.type === "html-custom" && isDefaultCustomHtmlContent(block.contentHtml) ? "" : block.contentHtml;
  const richContent = rawContentHtml?.trim()
    ? block.type === "html-custom"
      ? rawContentHtml.trim()
      : normalizeFrenchTypographyInHtml(rawContentHtml.trim())
    : "";
  const hasImageAsset = Boolean(imageAssetRef);
  const hasVideoAsset = Boolean(videoAssetRef);
  const displayTitle = visibleBlockTitle(block);
  const displaySummary = visibleBlockSummary(block);
  const mediaLayout = normalizedMediaLayout(block);
  const imageSize = normalizedImageSize(block);
  const contentWidth = normalizedContentWidth(block);
  const contentAlign = normalizedContentAlign(block);
  const verticalAlign = normalizedVerticalAlign(block);
  const mediaGap = normalizedMediaGap(block);
  const activityBackgroundColor = (block.type === "rich-text" ? null : normalizeHexColor(block.panelBackgroundColor))
    ?? normalizeHexColor(block.sectionBackgroundColor)
    ?? courseBackgroundColor;
  const activityContentTextColor = resolveContextualTextColor(
    courseTextColor ?? "#222222",
    activityBackgroundColor
  );
  const imageClassName = `preview-media zoomable-media${block.imageRounded ? " rounded-media" : ""}`;
  const visualContentStyle = {
    "--content-width": `${contentWidth}%`,
    "--content-align": contentAlign,
    "--media-gap": mediaGap,
    "--vertical-align": verticalAlign,
    "--activity-content-text": activityContentTextColor
  } as CSSProperties;
  const imageLayoutStyle = {
    ...visualContentStyle,
    "--content-width": mediaLayout === "page-width" ? "100vw" : `${contentWidth}%`,
    "--image-size": `${imageSize}%`
  } as CSSProperties;
  const sortedMarkers = [...(block.pointOfInterestMarkers ?? [])].sort((left, right) => left.order - right.order);
  const activityItems = block.type === "slides" ? normalizeSlidesActivityItems(block.activityItems ?? []) : block.activityItems ?? [];
  const audioTracks =
    block.type === "audio"
      ? normalizeAudioTracks(activityItems).map((track) => ({
          ...track,
          audioSrc: buildAssetUrl(projectPath, firstItemAudioAssetRef(track))
        }))
      : [];
  const [activeMarkerId, setActiveMarkerId] = useState("");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [activeSituationalDialogueNodeId, setActiveSituationalDialogueNodeId] = useState("");
  const [selectedSituationalDialogueResponseId, setSelectedSituationalDialogueResponseId] = useState("");
  const [pendingSituationalDialogueResponseId, setPendingSituationalDialogueResponseId] = useState("");
  const [openAccordionIds, setOpenAccordionIds] = useState<string[]>([]);
  const [flippedCardIds, setFlippedCardIds] = useState<string[]>([]);
  const activeMarker = sortedMarkers.find((marker) => marker.id === activeMarkerId) ?? null;
  useEffect(() => {
    if (block.type !== "slides") {
      setActiveSlideIndex(0);
      return;
    }
    if (!activityItems.length) {
      setActiveSlideIndex(0);
      return;
    }
    setActiveSlideIndex((current) => Math.max(0, Math.min(activityItems.length - 1, current)));
  }, [activityItems.length, block.id, block.type]);
  useEffect(() => {
    if (block.type !== "situational-dialogue") {
      if (activeSituationalDialogueNodeId) {
        setActiveSituationalDialogueNodeId("");
      }
      if (selectedSituationalDialogueResponseId) {
        setSelectedSituationalDialogueResponseId("");
      }
      if (pendingSituationalDialogueResponseId) {
        setPendingSituationalDialogueResponseId("");
      }
      return;
    }
    const defaultNodeId = activityItems[0]?.id ?? "";
    if (!activityItems.length) {
      if (activeSituationalDialogueNodeId) {
        setActiveSituationalDialogueNodeId("");
      }
      return;
    }
    if (!activeSituationalDialogueNodeId || !activityItems.some((item) => item.id === activeSituationalDialogueNodeId)) {
      setActiveSituationalDialogueNodeId(defaultNodeId);
      setSelectedSituationalDialogueResponseId("");
      setPendingSituationalDialogueResponseId("");
    }
  }, [activityItems, activeSituationalDialogueNodeId, block.type, pendingSituationalDialogueResponseId, selectedSituationalDialogueResponseId]);
  const renderRichContentNode = (className = "rich-content") =>
    renderRichContent ? (
      renderRichContent(rawContentHtml?.trim() || richContent || defaultInlineBlockDocument(block.type), className)
    ) : (
      <div className={className} dangerouslySetInnerHTML={{ __html: richContent || defaultInlineBlockDocument(block.type) }} />
    );
  const videoInlineHtml =
    stripHtmlForEditor(rawContentHtml ?? "").trim() === "Nouveau contenu"
      ? ""
      : rawContentHtml || richContent;

  if (videoAsset && hasVideoAsset) {
    return (
      <VideoActivity
        allowFullscreen={block.videoAllowFullscreen ?? true}
        captionColor={block.videoCaptionColor ?? DEFAULT_VIDEO_CAPTION_COLOR}
        captionBackgroundEnabled={block.videoCaptionBackgroundEnabled ?? true}
        captionOutline={block.videoCaptionOutline === "thin" || block.videoCaptionOutline === "thick" ? block.videoCaptionOutline : "none"}
        mediaSrc={videoAsset}
        posterSrc={imageAsset}
        subtitleSrc={subtitleAsset}
        summary={authoringMode || videoInlineHtml ? undefined : displaySummary}
        summaryNode={
          authoringMode && renderRichContent
            ? renderRichContent(videoInlineHtml || "<p></p>", "video-inline-copy rich-content")
            : videoInlineHtml ? (
                <div className="video-inline-copy rich-content" dangerouslySetInnerHTML={{ __html: videoInlineHtml }} />
              )
            : undefined
        }
        title={displayTitle}
      />
    );
  }

  if (
    imageAsset &&
    hasImageAsset &&
    !["image", "image-text", "image-grid", "point-of-interest", "find-elements", "complete", "card-sort", "matching", "image-360", "media", "audio", "accordion", "slides", "flip-cards", "timeline", "situational-dialogue", "tabs", "header", "quote", "html-custom"].includes(block.type)
  ) {
    return (
      <>
        {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
        <img alt={block.title} className={imageClassName} onClick={() => onImageOpen?.(imageAsset, block.title, Boolean(block.imageRounded))} src={imageAsset} />
        {block.summary ? <p className="export-block-copy">{block.summary}</p> : null}
      </>
    );
  }

  switch (block.type) {
    case "links-resources":
      return <LinksResourcesActivity block={block} />;
    case "attachment":
      return (
        <AttachmentActivity
          authoringMode={authoringMode}
          block={block}
          onDownload={onAttachmentDownload}
          resolveAssetUrl={(assetRef) => buildAssetUrl(projectPath, assetRef)}
        />
      );
    case "header":
      return (
        <HeaderActivity
          authoringMode={authoringMode}
          contentPosition={block.contentAlign === "right" ? "right" : block.contentAlign === "center" ? "center" : "left"}
          contentNode={
            authoringMode && renderRichContent ? (
              renderRichContentNode()
            ) : richContent ? (
              renderRichContentNode()
            ) : block.summary ? (
              <p className="export-block-copy">{block.summary}</p>
            ) : null
          }
          imagePositionY={block.headerImagePositionY}
          onImagePositionChange={authoringMode ? (value) => onHeaderImagePositionChange?.(block.id, value) : undefined}
          style={headerBannerStyle(block, (assetRefs) =>
            buildAssetUrl(projectPath, firstAssetRef(assetRefs, isSupportedImageAsset))
          )}
        />
      );
    case "html-custom":
      return (
        <HtmlCustomActivity
          authoringMode={authoringMode}
          hasContent={Boolean(richContent)}
          layout={mediaLayout}
          previewNode={
            richContent ? (
              <CustomHtmlPreview
                assetBaseUrl={buildHtmlAssetBaseUrl(projectPath, block.htmlAssetRoot)}
                blockId={block.id}
                enableViewportUnload={enableExternalHtmlViewportUnload}
                requireManualExternalIframeActivation={
                  REQUIRE_MANUAL_EXTERNAL_IFRAME_ACTIVATION && enableExternalHtmlViewportUnload
                }
                html={richContent}
                layout={mediaLayout}
                title={block.title || t("htmlCustom.title")}
              />
            ) : null
          }
        />
      );
    case "image": {
      const imageUsesPageWidth = mediaLayout === "page-width";
      const imageActivityClassName = imageUsesPageWidth ? "preview-media" : imageClassName;
      return (
        <ImageActivity
          contentAlign={contentAlign}
          contentNode={
            imageAsset && hasImageAsset || authoringMode ? null : (
              <p className="export-block-copy image-mock-copy">{IMAGE_BLOCK_MOCK_LABEL}</p>
            )
          }
          displayTitle={displayTitle}
          imageNode={
            imageAsset && hasImageAsset ? (
              <CroppedImage
                alt={blockImageAlt.alt}
                className={imageActivityClassName}
                crop={block.imageCrop}
                onClick={imageUsesPageWidth ? undefined : () => onImageOpen?.(imageAsset, block.title, Boolean(block.imageRounded))}
                rounded={imageUsesPageWidth ? false : Boolean(block.imageRounded)}
                role={blockImageAlt.role}
                src={imageAsset}
              />
            ) : authoringMode ? (
              <CroppedImage
            alt={t("preview.imageAlt")}
                className={imageActivityClassName}
                crop={null}
                onClick={imageUsesPageWidth ? undefined : () => onImageOpen?.(
                  imageDefaultPreview,
                  t("preview.imageAlt"),
                  Boolean(block.imageRounded)
                )}
                rounded={imageUsesPageWidth ? false : Boolean(block.imageRounded)}
                src={imageDefaultPreview}
              />
            ) : null
          }
          layout={mediaLayout}
          style={imageLayoutStyle}
        />
      );
    }
    case "image-text":
      return (
        <ImageTextActivity
          contentAlign={contentAlign}
          contentNode={
            richContent ? (
              renderRichContentNode()
            ) : block.summary ? (
              <p className="export-block-copy">{block.summary}</p>
            ) : null
          }
          displayTitle={displayTitle}
          imageNode={
            imageAsset && hasImageAsset ? (
              <CroppedImage
                alt={blockImageAlt.alt}
                className={imageClassName}
                crop={block.imageCrop}
                onClick={() => onImageOpen?.(imageAsset, block.title, Boolean(block.imageRounded))}
                rounded={Boolean(block.imageRounded)}
                role={blockImageAlt.role}
                src={imageAsset}
              />
            ) : authoringMode ? (
              <CroppedImage
            alt={t("preview.imageTextAlt")}
                className={imageClassName}
                crop={null}
                onClick={() => onImageOpen?.(
                  imageTextDefaultPreview,
                  t("preview.imageTextAlt"),
                  Boolean(block.imageRounded)
                )}
                rounded={Boolean(block.imageRounded)}
                src={imageTextDefaultPreview}
              />
            ) : null
          }
          layout={mediaLayout}
          contentWidth={block.contentWidth}
          imageSize={Number(imageSize)}
          mediaGap={block.mediaGap}
          verticalAlign={block.verticalAlign}
          contentTextColor={activityContentTextColor}
        />
      );
    case "point-of-interest":
      const pointOfInterestSourceHtml = rawContentHtml || richContent;
      const pointOfInterestPlainText = stripHtmlForEditor(pointOfInterestSourceHtml ?? "")
        .replace(/\u00a0/g, " ")
        .trim()
        .replace(/[.…]+$/u, "")
        .trim();
      const pointOfInterestPlaceholderValues = new Set([
        "Nouveau contenu",
        t("editor.richTextPlaceholder", undefined, "Saisissez votre texte ici")
          .replace(/[.…]+$/u, "")
          .trim(),
        "Saisissez votre texte ici"
      ]);
      const PointOfInterestInlineHtml = !pointOfInterestPlainText || pointOfInterestPlaceholderValues.has(pointOfInterestPlainText)
        ? ""
        : pointOfInterestSourceHtml;
      return (
        <PointOfInterestActivity
          activeMarker={activeMarker}
          clampPercent={clampPercent}
          contentNode={
            PointOfInterestInlineHtml && authoringMode && renderRichContent
              ? renderRichContent(PointOfInterestInlineHtml, "rich-content")
              : PointOfInterestInlineHtml ? (
                  <div className="rich-content" dangerouslySetInnerHTML={{ __html: PointOfInterestInlineHtml }} />
                )
              : undefined
          }
          displayTitle={displayTitle}
          hasImageAsset={hasImageAsset}
          imageAsset={imageAsset}
          imageAlt={blockImageAlt.alt}
          imageRole={blockImageAlt.role}
          markerPopupHeight={block.markerPopupHeight}
          markerPopupWidth={block.markerPopupWidth}
          markers={sortedMarkers}
          onMarkerClose={() => setActiveMarkerId("")}
          onMarkerToggle={(markerId) => setActiveMarkerId((current) => (current === markerId ? "" : markerId))}
          onImageOpen={(src, alt) => onImageOpen?.(src, alt, false)}
          resolveAssetUrl={(assetRef) => buildAssetUrl(projectPath, assetRef)}
          richContent=""
          title={block.title}
        />
      );
    case "image-360":
      return (
        <Image360Activity
          allowFullscreen={block.image360AllowFullscreen ?? IMAGE360_BLOCK_DEFAULTS.allowFullscreen}
          backgroundColor={block.panelBackgroundColor || IMAGE360_BLOCK_DEFAULTS.backgroundColor}
          borderColor={block.panelBorderColor || IMAGE360_BLOCK_DEFAULTS.borderColor}
          borderStyle={block.panelBorderStyle || IMAGE360_BLOCK_DEFAULTS.borderStyle}
          borderWidth={block.panelBorderWidth || IMAGE360_BLOCK_DEFAULTS.borderWidth}
          contentNode={
            authoringMode && renderRichContent ? (
              renderRichContent(rawContentHtml || richContent || "<p></p>")
            ) : richContent ? (
              renderRichContentNode()
            ) : null
          }
          fullWidth={block.image360FullWidth ?? IMAGE360_BLOCK_DEFAULTS.fullWidth}
          hotspots={normalizeImage360Hotspots(block.image360Hotspots ?? [])}
          imageSrc={image360Asset || DEFAULT_IMAGE360_ASSET}
          imageAlt={block.imageAccessibility?.altText || undefined}
          imageDecorative={Boolean(block.imageAccessibility?.decorative)}
          initialPitch={block.image360InitialPitch ?? IMAGE360_BLOCK_DEFAULTS.initialPitch}
          initialYaw={block.image360InitialYaw ?? IMAGE360_BLOCK_DEFAULTS.initialYaw}
          onScenePointPick={(yaw, pitch) => onImage360ScenePointPick?.(block.id, yaw, pitch)}
          onViewChange={(yaw, pitch) => onImage360ViewChange?.(block.id, yaw, pitch)}
          pickingMode={authoringMode && Boolean(image360PickingHotspotId)}
          rounded={block.panelRounded ?? IMAGE360_BLOCK_DEFAULTS.rounded}
          shadow={block.panelShadow ?? IMAGE360_BLOCK_DEFAULTS.shadow}
          titleNode={displayTitle ? <h3>{displayTitle}</h3> : null}
          zoomEnabled={block.image360ZoomEnabled ?? IMAGE360_BLOCK_DEFAULTS.zoomEnabled}
        />
      );
    case "quiz":
      return (
        <QuizActivity
          automaticTitle={quizAutomaticTitle}
          authoringMode={authoringMode}
          blockId={block.id}
          onComplete={authoringMode ? undefined : (result) => onActivityComplete?.(block.id, result)}
          onStart={authoringMode ? undefined : () => onQuizStart?.(block.id)}
          quiz={normalizeQuizData(block.quiz)}
          started={quizStarted}
        />
      );
    case "question-multiple":
      return <QuestionMultiple blockId={block.id} quiz={normalizeQuizData(block.quiz)} />;
    case "question-unique":
      return <QuestionUnique blockId={block.id} quiz={normalizeQuizData(block.quiz)} />;
    case "question-true-false":
      return <QuestionVraiFaux blockId={block.id} quiz={normalizeQuizData(block.quiz)} />;
    case "question-random":
      return <RandomQuestions blockId={block.id} quiz={normalizeQuizData(block.quiz)} />;
    case "complete":
      return <CompleteActivity authoringMode={authoringMode} coverImageAlt={blockImageAlt.alt} coverImageCrop={block.imageCrop} coverImageRounded={block.imageRounded ?? true} coverImageSrc={imageAsset ?? undefined} data={normalizeCompleteData(block.complete, rawContentHtml || "<p></p>")} title={block.title} onComplete={authoringMode ? undefined : (result) => onActivityComplete?.(block.id, { quizId: block.id, scoreRaw: result.score, scoreMax: 100, scorePercent: result.score, passed: result.passed, completed: true, questions: [] })} />;
    case "card-sort": {
      const data = normalizeCardSortData(block.cardSort);
      const cards = normalizeCardSortItems(activityItems, data);
      return <CardSortActivity
        authoringMode={authoringMode}
        data={data}
        getItemImageUrl={(item) => buildAssetUrl(projectPath, item.frontImageAssetRef)}
        items={cards}
        onComplete={authoringMode ? undefined : (result) => onActivityComplete?.(block.id, { quizId: block.id, scoreRaw: result.score, scoreMax: 100, scorePercent: result.score, passed: result.passed, completed: true, questions: [] })}
      />;
    }
    case "matching":
      return <MatchingActivity authoringMode={authoringMode} data={normalizeMatchingData(block.matching)} onComplete={authoringMode ? undefined : (result) => onActivityComplete?.(block.id, { quizId: block.id, scoreRaw: result.score, scoreMax: 100, scorePercent: result.score, passed: result.passed, completed: true, questions: [] })} />;
    case "image-grid": {
      return (
        <ImageGridActivity
          authoringMode={authoringMode}
          getItemImageUrl={(item) => buildAssetUrl(projectPath, firstAssetRef(item.assetRefs, isSupportedImageAsset))}
          items={activityItems}
          onImageOpen={onImageOpen}
          renderRichContent={renderRichContent}
          rounded={Boolean(block.imageRounded)}
          shadow={Boolean(block.panelShadow)}
        />
      );
    }
    case "find-elements":
      return (
        <FindElementsActivity
          authoringMode={authoringMode}
          data={normalizeFindElementsData(block.findElements)}
          imageAlt={blockImageAlt.alt}
          imageSrc={imageAsset}
          instructionHtml={rawContentHtml || "<p></p>"}
          onComplete={authoringMode ? undefined : () => onActivityComplete?.(block.id)}
          renderRichContent={renderRichContent}
          title={block.title}
          key={`${authoringMode ? "editor" : "preview"}-${block.id}`}
        />
      );
    case "result-message": {
      const successBranch = activityItems.find((item) => item.kind === "result-success");
      const failureBranch = activityItems.find((item) => item.kind === "result-failure");
      const sourceQuizId = successBranch?.nextNodeId || failureBranch?.nextNodeId || "";
      const sourceResult = resultMessageSourceIsValid ? quizResults[sourceQuizId] : undefined;
      const visibleBranches = authoringMode
        ? [successBranch, failureBranch]
        : sourceResult
          ? [sourceResult.passed ? successBranch : failureBranch]
          : [];
      const meaningfulBranches = visibleBranches.filter((item): item is ActivityItem => Boolean(item?.contentHtml && stripHtmlForEditor(item.contentHtml).trim()));
      const resultMessageStyle = {
        ...visualContentStyle,
        ...blockPanelStyle(block),
        borderRadius: block.panelRounded ? "22px" : "0px",
        boxShadow: block.panelShadow ? "0 16px 34px rgba(18, 58, 122, 0.14)" : "none"
      };
      if (!meaningfulBranches.length) {
        return authoringMode ? (
          <section className="result-message-activity result-message-activity-empty" style={resultMessageStyle}>
            <span className="result-message-label">{t("activity.result-message", undefined, "Accompagnement pédagogique")}</span>
          </section>
        ) : null;
      }
      return (
        <section aria-live={authoringMode ? undefined : "polite"} className="result-message-activity" style={resultMessageStyle}>
          {meaningfulBranches.map((item) => (
            <div className="result-message-branch" key={item.id}>
              {authoringMode ? <span className="result-message-label">{item.kind === "result-success" ? t("resultMessage.successBranch", undefined, "Après réussite") : t("resultMessage.failureBranch", undefined, "Après échec final")}</span> : null}
              <div className="rich-content" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />
            </div>
          ))}
        </section>
      );
    }
    case "timeline":
      return (
        <TimelineActivity
          block={block}
          displaySummary={displaySummary}
          displayTitle={displayTitle}
          items={activityItems}
          normalizeHtml={normalizeFrenchTypographyInHtml}
          onItemAdd={onTimelineItemAdd}
          renderItemField={renderTimelineItemField}
        />
      );
    case "slides":
      return (
        <SlidesActivity
          activeIndex={activeSlideIndex}
          block={block}
          displaySummary={displaySummary}
          displayTitle={displayTitle}
          getItemImageUrl={(item) => buildAssetUrl(projectPath, firstItemImageAssetRef(item))}
          imageSizeToPercent={imageSizeToPercent}
          items={activityItems}
          normalizeHtml={normalizeFrenchTypographyInHtml}
          onActiveIndexChange={setActiveSlideIndex}
          onImageOpen={(src, alt, rounded) =>
            onImageOpen?.(src, alt, rounded)
          }
          onItemAdd={onSlidesItemAdd}
          renderItemField={renderSlidesItemField}
          renderItemImage={(item, options) => {
            const src = buildAssetUrl(projectPath, firstItemImageAssetRef(item));
            const itemAlt = imageAltAttributes(item.imageAccessibility);
            return src ? (
              <CroppedImage
                alt={itemAlt.alt}
                className={options.className}
                crop={item.imageCrop}
                onClick={options.onClick}
                rounded={options.rounded}
                role={itemAlt.role}
                src={src}
              />
            ) : null;
          }}
          stripHtml={stripHtmlForEditor}
        />
      );
    case "situational-dialogue": {
      const SituationalDialogueItems = normalizeSituationalDialogueActivityItems(activityItems);
      const activeNode =
        SituationalDialogueItems.find((item) => item.id === activeSituationalDialogueNodeId) ??
        SituationalDialogueItems[0] ??
        null;
      const activeNodeIndex = activeNode ? SituationalDialogueItems.findIndex((item) => item.id === activeNode.id) : -1;
      const responses = activeNode ? normalizeSituationalDialogueResponses(activeNode) : [];
      const pendingResponse = responses.find((response) => response.id === pendingSituationalDialogueResponseId) ?? null;
      const selectedResponse = responses.find((response) => response.id === selectedSituationalDialogueResponseId) ?? null;
      const characterImageRef = resolveSituationalDialogueCharacterAssetRef(block, activeNode, selectedResponse);
      const characterImage = buildAssetUrl(projectPath, characterImageRef);
      const hasSituationalDialogueCardContent = Boolean(stripHtmlForEditor(activeNode?.contentHtml || "").trim());
      const sectionStyle = blockSectionStyle(block, projectPath);
      const SituationalDialogueStyle = hasBlockSectionStyle(block)
        ? {
            ...sectionStyle,
            ...situationalDialogueDecorStyle(block.sectionBackgroundColor),
            ["--situational-dialogue-background" as const]: block.sectionBackgroundColor || undefined,
            ["--situational-dialogue-bg-image" as const]: block.sectionBackgroundImageRef
              ? `url("${buildAssetUrl(projectPath, block.sectionBackgroundImageRef) ?? ""}")`
              : "none",
            ["--situational-dialogue-bg-position-y" as const]: `${Math.min(100, Math.max(0, block.sectionBackgroundPositionY ?? 50))}%`,
            ["--situational-dialogue-bg-overlay-opacity" as const]: `${SituationalDialogueOverlayOpacityFromBlock(block)}`,
            ["--situational-dialogue-bg-overlay-color" as const]: block.sectionBackgroundOverlayDark !== false
              ? "0, 0, 0"
              : "247, 249, 252",
            ["--situational-dialogue-bg-blur" as const]: `${Math.max(0, block.sectionBackgroundBlur ?? 0)}px`
          }
        : undefined;
      const hasCustomSituationalDialogueBackground = Boolean(
        block.sectionBackgroundImageRef?.trim() || block.sectionBackgroundColor?.trim()
      );
      return (
        <SituationalDialogueActivity
          authoringMode={authoringMode}
          activeNode={activeNode}
          activeNodeIndex={activeNodeIndex}
          characterImage={characterImage}
          situationalDialogueCharacters={block.situationalDialogueCharacters ?? []}
          displaySummary={displaySummary}
          displayTitle={displayTitle}
          hasBackgroundImage={Boolean(block.sectionBackgroundImageRef)}
          backgroundPositionY={block.sectionBackgroundPositionY}
          hasCustomBackground={hasCustomSituationalDialogueBackground}
          hasSituationalDialogueCardContent={hasSituationalDialogueCardContent}
          items={SituationalDialogueItems}
          normalizeHtml={normalizeFrenchTypographyInHtml}
          rounded={(block.panelRounded ?? true) && !block.sectionBackgroundWide}
          wide={Boolean(block.sectionBackgroundWide)}
          onActiveNodeChange={setActiveSituationalDialogueNodeId}
          onBackgroundPositionChange={authoringMode
            ? (value) => onSituationalDialogueBackgroundPositionChange?.(block.id, value)
            : undefined}
          onComplete={() => onActivityComplete?.(block.id)}
          onPendingResponseChange={setPendingSituationalDialogueResponseId}
          onSelectedResponseChange={setSelectedSituationalDialogueResponseId}
          pendingResponse={pendingResponse}
          responses={responses}
          selectedResponse={selectedResponse}
          style={SituationalDialogueStyle}
        />
      );
    }
    case "tabs":
      return (
        <TabsActivity
          renderItemField={authoringMode ? renderTabsItemField : undefined}
          onBeforeTabChange={authoringMode ? onBeforeTabsTabChange : undefined}
          authoringMode={authoringMode}
          block={block}
          contentTextColor={activityContentTextColor}
          displaySummary={displaySummary}
          displayTitle={displayTitle}
          getItemImageUrl={(item) => buildAssetUrl(projectPath, firstItemImageAssetRef(item))}
          items={activityItems}
          onImageOpen={(src, alt) => onImageOpen?.(src, alt, false)}
        />
      );
    case "accordion":
      return (
        <AccordionActivity
          renderItemTitle={authoringMode ? renderAccordionItemTitle : undefined}
          renderItemContent={authoringMode ? renderAccordionItemContent : undefined}
          onBeforePanelToggle={authoringMode ? onBeforeAccordionPanelToggle : undefined}
          block={block}
          displaySummary={displaySummary}
          displayTitle={displayTitle}
          getItemImageUrl={(item) => buildAssetUrl(projectPath, firstItemImageAssetRef(item))}
          items={activityItems}
          onImageOpen={(src, alt) => onImageOpen?.(src, alt, false)}
          onOpenIdsChange={setOpenAccordionIds}
          openIds={openAccordionIds}
        />
      );
    case "flip-cards":
      return (
        <FlipCardsActivity
          block={block}
          displaySummary={displaySummary}
          displayTitle={displayTitle}
          flippedIds={flippedCardIds}
          getItemImageUrl={(item, face) => buildAssetUrl(projectPath, face === "front" ? item.frontImageAssetRef : item.backImageAssetRef)}
          items={activityItems}
          onFlippedIdsChange={setFlippedCardIds}
          renderFaceImage={(item, face, _fallbackAlt) => {
            const itemImage = buildAssetUrl(projectPath, face === "front" ? item.frontImageAssetRef : item.backImageAssetRef);
            const itemAlt = imageAltAttributes(face === "front" ? item.frontImageAccessibility : item.backImageAccessibility);
            return itemImage ? (
              <CroppedImage
                alt={itemAlt.alt}
                className="flip-card-face-image"
                crop={face === "front" ? item.frontImageCrop : item.backImageCrop}
                role={itemAlt.role}
                src={itemImage}
              />
            ) : null;
          }}
        />
      );
    case "media":
      return (
        <VideoActivity
          allowFullscreen={block.videoAllowFullscreen ?? true}
          captionColor={block.videoCaptionColor ?? DEFAULT_VIDEO_CAPTION_COLOR}
          captionBackgroundEnabled={block.videoCaptionBackgroundEnabled ?? true}
          captionOutline={block.videoCaptionOutline === "thin" || block.videoCaptionOutline === "thick" ? block.videoCaptionOutline : "none"}
          mediaSrc={videoAsset}
          posterSrc={imageAsset}
          subtitleSrc={subtitleAsset}
          summary={authoringMode || videoInlineHtml ? undefined : displaySummary}
          summaryNode={
            authoringMode && renderRichContent
              ? renderRichContent(videoInlineHtml || "<p></p>", "video-inline-copy rich-content")
              : videoInlineHtml ? (
                  <div className="video-inline-copy rich-content" dangerouslySetInnerHTML={{ __html: videoInlineHtml }} />
                )
              : undefined
          }
          title={displayTitle}
        />
      );
    case "audio":
      return (
        <AudioActivity
          accentColor={audioAccentColor(block)}
          allowDownload={Boolean(block.audioAllowDownload)}
          autoplayNext={block.audioAutoplayNext ?? true}
          backgroundColor={block.panelBackgroundColor || "#ffffff"}
          borderColor={block.panelBorderColor || "rgba(18, 58, 122, 0.16)"}
          borderStyle={block.panelBorderStyle || "solid"}
          borderWidth={block.panelBorderWidth || "1px"}
          coverNode={
            imageAsset ? (
              <CroppedImage
                alt={displayTitle || t("audio.optionalCover")}
                className="preview-media"
                crop={block.imageCrop}
                src={imageAsset}
              />
            ) : (
              <AudioCoverFallback />
            )
          }
          descriptionNode={
            authoringMode && renderRichContent ? (
              renderRichContent(rawContentHtml || richContent || "<p></p>")
            ) : richContent ? (
              renderRichContentNode()
            ) : displaySummary ? (
              <p>{displaySummary}</p>
            ) : null
          }
          rounded={Boolean(block.panelRounded)}
          shadow={Boolean(block.panelShadow)}
          titleNode={displayTitle ? <h3>{displayTitle}</h3> : null}
          tracks={audioTracks}
        />
      );
    case "continue":
    case "course-exit":
      const navigationLayout = block.type === "course-exit"
        ? normalizeCourseExitLayout(block.mediaLayout)
        : "button-only";
      const navigationContent = block.type === "course-exit" && courseExitLayoutHasText(navigationLayout)
        ? authoringMode && renderRichContent
          ? renderRichContentNode()
          : richContent
            ? renderRichContentNode()
            : null
        : null;
      const buttonAction =
        block.type === "course-exit"
          ? () => {
              // In authoring this returns to the chapter menu; in preview it
              // returns to the learner chapter menu.
              onCourseExit?.();
            }
          : () => {
              if (!authoringMode) {
                onActivityComplete?.(block.id);
              }
              onContinue?.(block.id);
            };
      return (
        <LessonNavigationActivity
          activityType={block.type}
          content={navigationContent}
          label={visibleButtonText(block)}
          layout={navigationLayout}
          onActivate={buttonAction}
          style={blockButtonStyle(block)}
        />
      );
    case "divider":
      return <DividerActivity style={blockDividerStyle(block)} />;
    case "section-marker":
      return <SectionMarkerActivity dividerColor={block.dividerColor} dividerStyle={block.dividerStyle} dividerWidth={block.dividerWidth} label={sectionMarkerLabel} markerFontSize={sectionMarkerFontSize} markerScheme={block.markerScheme} markerTextColor={block.markerTextColor} markerType={block.markerType} />;
    case "note":
      return (
        <NoteActivity
          content={
            richContent ? (
              renderRichContentNode()
            ) : block.summary ? (
              <p className="export-block-copy">{block.summary}</p>
            ) : null
          }
          icon={normalizeNoteIcon(block.noteIcon)}
          iconColor={block.noteIconMatchesBorder === false ? block.noteIconColor ?? undefined : undefined}
          rounded={Boolean(block.panelRounded)}
          shadow={Boolean(block.panelShadow)}
          showIcon={block.noteShowIcon !== false}
          style={{ ...visualContentStyle, ...blockPanelStyle(block) }}
          title={displayTitle}
        />
      );
    case "quote":
      return (
        <QuoteActivity
          accentColor={quoteAccentColor(block.buttonTextColor)}
          authorHtml={block.quoteAuthorHtml}
          content={richContent ? renderRichContentNode() : null}
          imageAlt={blockImageAlt.alt}
          imageLayout={quoteMediaLayout as "image-left" | "image-right" | "image-center"}
          imageRole={blockImageAlt.role}
          imageRounded={Boolean(block.imageRounded)}
          imageSrc={quoteAvatarAsset}
          imageWidth={quoteImageWidth(block)}
          rounded={Boolean(block.panelRounded)}
          shadow={Boolean(block.panelShadow)}
          showAuthor={block.quoteShowAuthor ?? Boolean(optionalHtmlOrNull(block.quoteAuthorHtml))}
          style={{
          ...visualContentStyle,
          ...blockPanelStyle(block),
          backgroundColor: quoteBackgroundColor(block.panelBackgroundColor),
          borderWidth: quoteBorderWidth(block.panelBorderWidth)
        }}
        />
      );
    case "rich-text":
      return (
        <TextActivity
          contentHtml={rawContentHtml?.trim() || richContent || ""}
          displaySummary={displaySummary}
          displayTitle={displayTitle}
          renderRichContent={renderRichContent}
          style={{
            ...visualContentStyle,
            backgroundColor: "transparent"
          }}
        />
      );
    case "list":
      return (
        <div className="visual-content" style={visualContentStyle}>
          {richContent ? (
            renderRichContentNode()
          ) : block.summary ? (
            <>
              {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
              <p className="export-block-copy">{block.summary}</p>
            </>
          ) : null}
        </div>
      );
    case "html-fallback":
      return (
        <>
          {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
          {block.sourceRawHtml ? (
            <div className="preview-html" dangerouslySetInnerHTML={{ __html: normalizeFrenchTypographyInHtml(block.sourceRawHtml) }} />
          ) : block.summary ? (
            <p className="export-block-copy">{block.summary}</p>
          ) : null}
        </>
      );
    default:
      return (
        <>
          {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
          {block.summary ? <p className="export-block-copy">{block.summary}</p> : null}
        </>
      );
  }
}
