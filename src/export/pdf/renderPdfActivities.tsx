import { renderToStaticMarkup } from "react-dom/server";
import { MatchingActivity } from "../../components/activities/MatchingActivity/MatchingActivity";
import { normalizeMatchingData } from "../../components/activities/MatchingActivity/matchingDefaults";
import { TimelineActivity } from "../../components/activities/TimelineActivity/TimelineActivity";
import { ImageGridActivity } from "../../components/activities/ImageGridActivity/ImageGridActivity";
import { AudioCoverFallback } from "../../components/app/AudioCoverFallback";
import matchingCss from "../../components/activities/MatchingActivity/MatchingActivity.module.css?inline";
import timelineCss from "../../components/activities/TimelineActivity/TimelineActivity.module.css?inline";
import gridCss from "../../components/activities/ImageGridActivity/ImageGridActivity.module.css?inline";
import type { PaideiaBlock } from "../../types/project";

export const pdfActivityCss = matchingCss + timelineCss + gridCss;
export const audioFallbackHtml = () => renderToStaticMarkup(<AudioCoverFallback />);
export function renderPdfActivity(block: PaideiaBlock, rich: (html: string) => string, image: (ref: string) => string | undefined): string {
  if (block.type === "matching") {
    const data = normalizeMatchingData(block.matching);
    return renderToStaticMarkup(<MatchingActivity data={{ ...data, pairs: data.pairs.map(pair => ({ ...pair, leftHtml: rich(pair.leftHtml), rightHtml: rich(pair.rightHtml) })) }} />);
  }
  if (block.type === "timeline") return renderToStaticMarkup(<TimelineActivity block={block} displayTitle="" displaySummary="" items={block.activityItems ?? []} normalizeHtml={rich} />);
  if (block.type === "image-grid") return renderToStaticMarkup(<ImageGridActivity items={(block.activityItems ?? []).map(item => ({ ...item, contentHtml: rich(item.contentHtml || "") }))} getItemImageUrl={item => (item.assetRefs ?? []).map(image).find(Boolean) ?? ""} rounded={Boolean(block.imageRounded)} shadow={false} />);
  return "";
}
