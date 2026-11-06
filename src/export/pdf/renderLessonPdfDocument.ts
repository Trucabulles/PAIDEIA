import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type {
  LessonPdfActivity,
  LessonPdfActivitySection,
  LessonPdfAsset,
  LessonPdfDocumentModel,
  LessonPdfExpandedItem,
  LessonPdfQuizQuestion
} from "./lessonPdfModel";
import { formatEstimatedDuration } from "../../app/lessonDuration";
import type { LessonPdfLabels } from "./pdfLocalization";
import { pdfSafeInlineRuns, richHtmlToPdf } from "./richHtmlToPdf";
import { decodeHtmlEntities } from "./htmlMetadata";

export type PreparedPdfAssets = Readonly<Record<string, string>>;

const PDF_IMAGE_DATA_URL = /^data:image\/(?:jpeg|png);base64,/i;

function safeColor(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim().toLocaleLowerCase("en-US");
  if (!normalized || normalized === "transparent" || normalized === "none") {
    return fallback;
  }
  if (/^(?:#[0-9a-f]{3,8}|[a-z]+)$/i.test(normalized)) {
    return normalized;
  }
  const rgb = normalized.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (!rgb || (rgb[4] != null && Number(rgb[4]) === 0)) {
    return fallback;
  }
  return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, "0")).join("")}`;
}

function cssPixels(value: string | null | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed * 0.75)) : fallback;
}

function formatMediaDuration(value: number): string {
  const totalSeconds = Math.max(0, Math.round(value));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function plainRichTextSource(value: string): string {
  return decodeHtmlEntities(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function plainRichText(value: string): string {
  return plainRichTextSource(value)
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/\uFE0F/g, "")
    .trim();
}

function plainRichTextRuns(value: string) {
  return pdfSafeInlineRuns(plainRichTextSource(value));
}

function richOptions(labels: LessonPdfLabels) {
  return { referenceLabel: labels.reference, bookmarkFallback: labels.bookmark };
}

function chapterDestination(order: number): string {
  return `pdf-chapter-${order}`;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function navigationButtonContent(section: Extract<LessonPdfActivitySection, { kind: "progress-marker" }>, activity: LessonPdfActivity): Content {
  const background = safeColor(activity.style.buttonBackgroundColor, "#123a7a");
  const foreground = safeColor(activity.style.buttonTextColor, "#ffffff");
  const label = escapeSvgText(section.label);
  const width = Math.max(150, Math.min(250, 105 + section.label.length * 6.5));
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="42" viewBox="0 0 ${width} 42"><rect x="1" y="1" width="${width - 2}" height="40" rx="11" fill="${background}"/><text x="${width / 2}" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="${foreground}">${label}</text></svg>`,
    width,
    height: 42,
    alignment: "center",
    margin: [0, 4, 0, 8]
  };
}

function dividerColor(value: string | null | undefined): string {
  const rgba = value?.trim().match(/^rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*([\d.]+)\s*\)$/i);
  if (!rgba) {
    return safeColor(value, "#c5ccd6");
  }
  const alpha = Math.max(0, Math.min(1, Number(rgba[4])));
  return `#${rgba.slice(1, 4).map((part) => {
    const channel = Math.max(0, Math.min(255, Number(part)));
    return Math.round(channel * alpha + 255 * (1 - alpha)).toString(16).padStart(2, "0");
  }).join("")}`;
}

function dividerContent(activity: LessonPdfActivity): Content {
  const style = activity.style.dividerStyle?.trim().toLocaleLowerCase("en-US");
  if (style === "none") {
    return { text: "", margin: [0, 4, 0, 8] };
  }
  const dash = style === "dashed"
    ? { length: 6, space: 4 }
    : style === "dotted"
      ? { length: 1, space: 3 }
      : undefined;
  return {
    canvas: [{
      type: "line",
      x1: 0,
      y1: 4,
      x2: 470,
      y2: 4,
      lineWidth: cssPixels(activity.style.dividerWidth, 1.5, 0.5, 6),
      lineColor: dividerColor(activity.style.dividerColor),
      ...(dash ? { dash } : {})
    }],
    margin: [0, 4, 0, 8]
  };
}

function sectionMarkerContent(section: Extract<LessonPdfActivitySection, { kind: "section-marker" }>, activity: LessonPdfActivity): Content {
  const lineColor = dividerColor(activity.style.dividerColor);
  const textColor = dividerColor(activity.style.markerTextColor ?? activity.style.dividerColor);
  const lineWidth = cssPixels(activity.style.dividerWidth, 1.5, 0.5, 6);
  const dash = activity.style.dividerStyle === "dashed" ? " stroke-dasharray=\"6 4\"" : activity.style.dividerStyle === "dotted" ? " stroke-dasharray=\"1 3\"" : "";
  const label = escapeSvgText(section.label);
  const markerType = activity.style.markerType === "none" || activity.style.markerType === "filled"
    ? activity.style.markerType
    : "outline";
  const badgeWidth = 76;
  const leftEnd = 235 - badgeWidth / 2 - 10;
  const rightStart = 235 + badgeWidth / 2 + 10;
  const markerFill = markerType === "filled" ? lineColor : markerType === "outline" ? "#ffffff" : "none";
  const markerStroke = markerType === "none" ? "none" : lineColor;
  const marker = `<rect x="${235 - badgeWidth / 2}" y="4" width="${badgeWidth}" height="76" rx="38" fill="${markerFill}" stroke="${markerStroke}" stroke-width="${lineWidth}"/><text x="235" y="55" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${textColor}">${label}</text>`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="470" height="84" viewBox="0 0 470 84"><line x1="0" y1="42" x2="${leftEnd}" y2="42" stroke="${lineColor}" stroke-width="${lineWidth}"${dash}/><line x1="${rightStart}" y1="42" x2="470" y2="42" stroke="${lineColor}" stroke-width="${lineWidth}"${dash}/>${marker}</svg>`, width: 470, height: 84, margin: [0, 4, 0, 8] };
}

function imageData(asset: LessonPdfAsset | null | undefined, assets: PreparedPdfAssets): string | null {
  if (!asset) {
    return null;
  }
  const data = assets[asset.ref];
  return data && PDF_IMAGE_DATA_URL.test(data) ? data : null;
}

function imageContent(
  asset: LessonPdfAsset | null | undefined,
  assets: PreparedPdfAssets,
  fallbackLabel: string,
  width = 470,
  height = 340
): Content {
  const data = imageData(asset, assets);
  if (!data) {
    return {
      text: fallbackLabel,
      italics: true,
      color: "#475569",
      margin: [0, 4, 0, 8]
    };
  }
  return { image: data, fit: [width, height], alignment: "center", margin: [0, 4, 0, 8] };
}

function labeledRichText(
  label: string | undefined,
  html: string,
  labels?: LessonPdfLabels,
  ignoreFieldBackgrounds = false
): Content[] {
  const content = richHtmlToPdf(html, {
    ...(labels ? richOptions(labels) : {}),
    ignoreFieldBackgrounds
  });
  return label && content.length
    ? [{ text: label, bold: true, color: "#334155", margin: [0, 4, 0, 2] }, ...content]
    : content;
}

function quizAnswerReview(question: LessonPdfQuizQuestion, labels: LessonPdfLabels): Content[] {
  const correctCount = question.answers.filter((answer) => answer.correct).length;
  return question.answers.map((answer) => {
    const credit = answer.creditPercent ?? (question.creditMode === "equal" && answer.correct && correctCount
      ? Number((100 / correctCount).toFixed(4))
      : null);
    return {
      stack: [
        { text: answer.correct ? labels.correctAnswer : labels.proposedAnswer, bold: true, color: answer.correct ? "#15803d" : "#64748b" },
        ...richHtmlToPdf(answer.textHtml, richOptions(labels)),
        ...(credit == null ? [] : [{ text: `${question.creditLabel ?? "Crédit de cette réponse (%)"} : ${credit} %`, color: "#475569" }]),
        ...labeledRichText(question.answerFeedbackLabel ?? "Feedback", answer.feedbackHtml ?? "", labels)
      ]
    };
  });
}

function expandedItemContent(
  item: LessonPdfExpandedItem,
  activity: LessonPdfActivity,
  assets: PreparedPdfAssets,
  labels: LessonPdfLabels,
  useItemBorder = false
): Content {
  const stack: Content[] = [
    { text: plainRichTextRuns(`${item.order}. ${plainRichTextSource(item.title)}`), bold: true, color: "#0f3b70", margin: [0, 2, 0, 3] }
  ];
  if (item.dateLabel?.trim()) {
    stack.push({ text: item.dateLabel.trim(), italics: true, color: "#64748b", margin: [0, 0, 0, 3] });
  }
  for (const asset of item.assets) {
    if (asset.role === "image") {
      stack.push(imageContent(asset, assets, item.title, 380));
    } else if (asset.role === "audio") {
      stack.push({ text: `${labels.audioTrack} — ${item.title}`, italics: true, color: "#475569", margin: [0, 2, 0, 4] });
    }
  }
  if (item.secondaryHtml?.trim()) {
    stack.push(...labeledRichText(labels.frontAdditional, item.secondaryHtml, labels));
  }
  stack.push(...richHtmlToPdf(item.contentHtml, richOptions(labels)));
  if (item.transcriptHtml?.trim()) {
    stack.push(...labeledRichText(labels.transcript ?? "Transcription", item.transcriptHtml, labels));
  }
  const tileBackground = useItemBorder ? "#ffffff" : safeColor(activity.style.panelBackgroundColor, "#ffffff");
  const tileBorder = useItemBorder
    ? safeColor(item.accentColor, "#244585")
    : safeColor(activity.style.panelBorderColor, "#dbe4ee");
  return {
    table: { widths: ["*"], body: [[{ stack, margin: [9, 7] }]] },
    layout: {
      fillColor: tileBackground,
      hLineColor: tileBorder,
      vLineColor: tileBorder
    },
    margin: [0, 3, 0, 6]
  };
}

function flipCardContent(item: LessonPdfExpandedItem, activity: LessonPdfActivity, assets: PreparedPdfAssets, labels: LessonPdfLabels): Content {
  const copy: Content[] = [
    { text: plainRichTextRuns(`${labels.card} ${item.order}${item.title ? ` — ${plainRichTextSource(item.title)}` : ""}`), bold: true, color: "#0f3b70", margin: [0, 5, 0, 3] }
  ];
  const frontImage = item.assets.find((asset) => asset.face === "front");
  const backImage = item.assets.find((asset) => asset.face === "back");
  const hasFrontImage = item.frontType === "image" && Boolean(frontImage);
  const hasBackImage = item.backType === "image" && Boolean(backImage);
  const frontBackground = safeColor(activity.style.flipCardFrontBackgroundColor, "#F3F5FA");
  const backBackground = safeColor(activity.style.flipCardBackBackgroundColor, "#ffffff");
  const frontBorder = safeColor(activity.style.flipCardFrontBorderColor, "#123A7A");
  const backBorder = safeColor(activity.style.flipCardBackBorderColor, "#123A7A");

  if (hasFrontImage || hasBackImage) {
    const mediaCell = (
      label: string,
      image: LessonPdfAsset | undefined,
      fallbackLabel: string,
      background: string
    ): Content => ({
      stack: [
        { text: label, bold: true, color: "#64748b", margin: [0, 0, 0, 2] },
        ...(image ? [imageContent(image, assets, fallbackLabel, 120, 105)] : [])
      ],
      fillColor: background,
      margin: [7, 5]
    });
    copy.push({
      table: {
        widths: ["*", "*"],
        body: [[
          mediaCell(labels.front, hasFrontImage ? frontImage : undefined, item.frontText || item.title, frontBackground),
          mediaCell(labels.back, hasBackImage ? backImage : undefined, item.backTitle || item.title, backBackground)
        ]],
        dontBreakRows: true
      },
      layout: {
        hLineColor: (index: number) => index === 0 || index === 1 ? frontBorder : "#cbd5e1",
        vLineColor: (index: number) => index <= 1 ? frontBorder : backBorder,
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8
      },
      margin: [0, 2, 0, 4]
    });
  }

  if (item.frontType !== "image" && item.frontText?.trim()) {
    copy.push({ text: labels.front, bold: true, color: "#64748b", margin: [0, 3, 0, 1] });
    copy.push(...richHtmlToPdf(item.frontText, richOptions(labels)));
  }
  if (item.backType !== "image" && (item.backTitle?.trim() || item.contentHtml.trim())) {
    copy.push({ text: labels.back, bold: true, color: "#64748b", margin: [0, 3, 0, 1] });
    if (item.backTitle?.trim()) {
      copy.push({ text: plainRichTextRuns(item.backTitle.trim()), bold: true, margin: [0, 0, 0, 2] });
    }
    if (item.contentHtml.trim()) {
      copy.push(...richHtmlToPdf(item.contentHtml, richOptions(labels)));
    }
  }
  const cell: Content = { stack: copy, margin: [9, 7] as [number, number] };
  const tileBorder = frontBorder === frontBackground ? "#cbd5e1" : frontBorder;
  return {
    table: {
      widths: ["*"],
      body: [[cell]]
    },
    layout: {
      fillColor: "#ffffff",
      hLineColor: tileBorder,
      vLineColor: tileBorder,
      hLineWidth: () => 0.8,
      vLineWidth: () => 0.8
    },
    margin: [0, 3, 0, 7]
  };
}

function timelineItemContent(
  item: LessonPdfExpandedItem,
  activity: LessonPdfActivity,
  isFirst: boolean,
  isLast: boolean,
  labels: LessonPdfLabels
): Content {
  const accent = safeColor(item.accentColor ?? activity.style.panelBorderColor, "#123a7a");
  const textLength = plainRichText(item.contentHtml).length + plainRichText(item.title).length;
  const railHeight = Math.max(50, Math.min(108, 30 + Math.ceil(textLength / 85) * 15));
  const copy: Content[] = [];
  if (item.title.trim()) {
    copy.push({
      text: plainRichTextRuns(plainRichTextSource(item.title).toLocaleUpperCase(labels.locale)),
      bold: true,
      color: accent,
      fontSize: 11,
      margin: [0, 0, 0, 5]
    });
  }
  copy.push(...richHtmlToPdf(item.contentHtml, richOptions(labels)));
  return {
    table: {
      widths: [90, 28, "*"],
      body: [[
        {
          text: plainRichTextRuns(item.dateLabel ?? ""),
          bold: true,
          color: accent,
          alignment: "right",
          fontSize: 11,
          margin: [0, 1, 5, 0]
        },
        {
          canvas: [
            ...(!isFirst || !isLast ? [{
              type: "line" as const,
              x1: 12,
              y1: isFirst ? 9 : -8,
              x2: 12,
              y2: isLast ? 9 : railHeight + 9,
              lineWidth: 6,
              lineColor: accent
            }] : []),
            { type: "ellipse" as const, x: 12, y: 9, r1: 8, r2: 8, color: accent },
            { type: "ellipse" as const, x: 12, y: 9, r1: 3, r2: 3, color: "#ffffff" }
          ],
          margin: [0, 0, 0, 0]
        },
        { stack: copy, color: "#6b7da0", margin: [7, 0, 0, 4] }
      ]],
      dontBreakRows: true
    },
    layout: "noBorders",
    margin: [0, 0, 0, 0]
  };
}

export function sectionContent(
  section: LessonPdfActivitySection,
  activity: LessonPdfActivity,
  assets: PreparedPdfAssets,
  labels: LessonPdfLabels
): Content[] {
  switch (section.kind) {
    case "rich-text":
      return [
        ...labeledRichText(
          section.label,
          section.html,
          labels,
          activity.sourceType === "rich-text" || activity.sourceType === "list"
        ),
        ...(section.inlineAssets ?? []).map((asset) => imageContent(asset, assets, activity.label, 420))
      ];
    case "visual": {
      const raster = section.assets.filter((asset) => asset.role !== "video" || imageData(asset, assets));
      if (raster.length) {
        return raster.map((asset) => imageContent(asset, assets, activity.label));
      }
      return [imageContent(null, assets, activity.label)];
    }
    case "expanded-items":
      return section.items.length
        ? section.items.map((item, index) => section.presentation === "flip-cards"
            ? flipCardContent(item, activity, assets, labels)
          : section.presentation === "timeline"
            ? timelineItemContent(item, activity, index === 0, index === section.items.length - 1, labels)
            : expandedItemContent(item, activity, assets, labels, section.presentation === "card-sort"))
        : [{ text: activity.label, italics: true, color: "#64748b" }];
    case "interactive-visual": {
      const annotatedData = assets[`interactive:${activity.id}`];
      const poster = annotatedData && PDF_IMAGE_DATA_URL.test(annotatedData)
        ? { image: annotatedData, fit: [470, 340], alignment: "center", margin: [0, 4, 0, 8] } as Content
        : imageContent(section.poster, assets, activity.label);
      const details: Content[] = section.points.map((point, index) => ({
        table: {
          widths: [24, "*"],
          body: [[
            { text: String(index + 1), bold: true, color: "#ffffff", alignment: "center", fillColor: "#1d4ed8", margin: [2, 4] },
            {
              stack: [
                {
                  text: plainRichTextRuns(point.title || point.label || `${labels.point} ${index + 1}`),
                  bold: true
                },
                ...(point.media ? [{
                  text: `${labels.media ?? "Média"} : ${point.media.type === "image" ? (labels.image ?? "Image") : point.media.type === "video" ? (labels.video ?? "Vidéo") : (labels.audio ?? "Audio")} — ${point.media.fileName}${point.media.durationSeconds ? ` — ${formatMediaDuration(point.media.durationSeconds)}` : ""}`,
                  italics: true,
                  color: "#64748b",
                  margin: [0, 3, 0, 4]
                } as Content] : []),
                ...richHtmlToPdf(point.contentHtml, richOptions(labels)),
                ...(point.media?.transcriptHtml?.trim()
                  ? labeledRichText(labels.transcript ?? "Transcription", point.media.transcriptHtml, labels)
                  : [])
              ],
              margin: [7, 3]
            }
          ]],
          dontBreakRows: true
        },
        layout: "noBorders",
        margin: [0, 2, 0, 5]
      }));
      return [poster, ...details];
    }
    case "standalone-question": {
      const question = section.question;
      const content: Content[] = [
        ...richHtmlToPdf(question.questionHtml, richOptions(labels)),
        {
          ul: quizAnswerReview(question, labels),
          margin: [8, 4, 0, 8]
        }
      ];
      if (section.showCorrectAnswer) {
        content.push({ text: labels.correctAnswer, bold: true, color: "#0f3b70", margin: [0, 5, 0, 2] });
        for (const answer of question.answers.filter((answer) => answer.correct)) content.push(...richHtmlToPdf(answer.textHtml, richOptions(labels)));
      }
      content.push(...labeledRichText(labels.generalFeedback, question.generalFeedbackHtml ?? "", labels));
      content.push(...labeledRichText(labels.correctFeedback, question.feedbackCorrectHtml ?? "", labels));
      content.push(...labeledRichText(labels.incorrectFeedback, question.feedbackIncorrectHtml ?? "", labels));
      return content;
    }
    case "quiz": {
      const content: Content[] = [
        ...richHtmlToPdf(section.titleHtml, richOptions(labels)),
        ...richHtmlToPdf(section.introHtml, richOptions(labels)),
        { text: section.settingsLabel, bold: true, color: "#0f3b70", margin: [0, 6, 0, 3] },
        {
          table: {
            widths: ["*", "auto"],
            body: section.settings.map((setting) => [
              { text: setting.label, color: "#334155", margin: [5, 3] },
              { text: setting.value, bold: true, color: "#0f3b70", margin: [5, 3] }
            ])
          },
          layout: { hLineColor: "#dbe4ee", vLineColor: "#dbe4ee" },
          margin: [0, 0, 0, 8]
        }
      ];
      if (section.assistantNotice) {
        content.push({
          text: section.assistantNotice,
          italics: true,
          color: "#92400e",
          fillColor: "#fffbeb",
          margin: [8, 6, 8, 8]
        });
      }
      for (const question of section.questions) {
        const questionStack: Content[] = [
          { text: `${labels.question} ${question.order}`, bold: true, color: "#0f3b70", margin: [0, 4, 0, 2] },
          ...richHtmlToPdf(question.questionHtml, richOptions(labels)),
          {
            ul: quizAnswerReview(question, labels),
            margin: [8, 2, 0, 5]
          }
        ];
        questionStack.push(...labeledRichText(labels.generalFeedback, question.generalFeedbackHtml ?? "", labels));
        questionStack.push(...labeledRichText(labels.correctFeedback, question.feedbackCorrectHtml ?? "", labels));
        questionStack.push(...labeledRichText(labels.incorrectFeedback, question.feedbackIncorrectHtml ?? "", labels));
        content.push({
          table: { widths: ["*"], body: [[{ stack: questionStack, margin: [9, 7] }]] },
          layout: {
            hLineColor: "#cbd5e1",
            vLineColor: "#cbd5e1"
          },
          margin: [0, 4, 0, 8]
        });
      }
      return content;
    }
    case "matching": {
      const rows: Array<[Content, Content]> = section.pairs.map((pair) => [{
        stack: [
          { text: `${pair.order}.`, bold: true, color: "#0f3b70", margin: [0, 2, 0, 2] },
          ...richHtmlToPdf(pair.leftHtml, richOptions(labels))
        ],
        margin: [8, 6] as [number, number]
      }, {
        stack: richHtmlToPdf(pair.rightHtml, richOptions(labels)),
        margin: [8, 6] as [number, number]
      }]);
      return [
        {
          table: { widths: ["*", "*"], body: rows, dontBreakRows: true },
          layout: { hLineColor: "#cbd5e1", vLineColor: "#cbd5e1" },
          margin: [0, 3, 0, 8]
        },
        ...labeledRichText(labels.correctFeedback, section.successFeedbackHtml, labels),
        ...labeledRichText(labels.incorrectFeedback, section.failureFeedbackHtml, labels)
      ];
    }
    case "situational-dialogue":
      return section.nodes.map((node) => ({
        table: {
          widths: ["*"],
          body: [[{
            stack: [
              { text: plainRichTextRuns(`${node.order}. ${plainRichTextSource(node.title)}`), bold: true, color: "#0f3b70" },
              ...(node.characterName ? [{ text: [node.characterName, node.characterRole].filter(Boolean).join(" — "), italics: true, color: "#64748b" } as Content] : []),
              ...node.assets.map((asset) => imageContent(asset, assets, node.title, node.order === 1 ? 165 : 220)),
              ...richHtmlToPdf(node.contentHtml, richOptions(labels)),
              ...node.responses.flatMap((response, responseIndex) => [
                { text: `${labels.answer} ${responseIndex + 1}`, bold: true, margin: [8, 3, 0, 1] } as Content,
                ...richHtmlToPdf(response.labelHtml, richOptions(labels)),
                ...labeledRichText(labels.feedback, response.feedbackHtml ?? "", labels)
              ])
            ],
            margin: [9, 7]
          }]]
        },
        layout: { fillColor: "#ffffff", hLineColor: "#dbe4ee", vLineColor: "#dbe4ee" },
        margin: [0, 3, 0, 7]
      }));
    case "attachments":
      return section.files.map((file) => ({
        text: `${labels.attachment} — ${file.displayName}${file.extension ? ` (.${file.extension.replace(/^\./, "")})` : ""}`,
        color: "#334155",
        margin: [8, 3, 0, 3]
      }));
    case "html-description":
      return [{
        table: {
          widths: ["*"],
          body: [[{
            stack: [
              { text: section.packageName?.trim() || activity.label, bold: true },
              { text: section.description || activity.label, italics: !section.description, color: "#475569", margin: [0, 3, 0, 0] }
            ],
            margin: [10, 9]
          }]]
        },
        layout: { fillColor: "#ffffff", hLineColor: "#cbd5e1", vLineColor: "#cbd5e1" },
        margin: [0, 4, 0, 8]
      }];
    case "progress-marker":
      return [navigationButtonContent(section, activity)];
    case "divider":
      return [dividerContent(activity)];
    case "section-marker":
      return [sectionMarkerContent(section, activity)];
    case "fallback":
      return [{
        text: section.activityLabel,
        italics: true,
        color: "#475569",
        margin: [0, 4, 0, 8]
      }];
  }
}

function layoutAwareSections(activity: LessonPdfActivity, assets: PreparedPdfAssets, labels: LessonPdfLabels): Content[] {
  if (activity.sourceType === "header") {
    const data = assets[`header:${activity.id}`];
    if (data && PDF_IMAGE_DATA_URL.test(data)) {
      return [{ image: data, fit: [470, 220], alignment: "center", margin: [0, 2, 0, 4] }];
    }
  }
  if (activity.sourceType !== "image-text" && activity.sourceType !== "quote") {
    return activity.sections.flatMap((section) => sectionContent(section, activity, assets, labels));
  }
  const visual = activity.sections.find((section) => section.kind === "visual");
  const richSections = activity.sections.filter((section) => section.kind === "rich-text");
  if (!visual || !richSections.length) {
    return activity.sections.flatMap((section) => sectionContent(section, activity, assets, labels));
  }
  const primaryAsset = visual.assets.find((asset) => asset.role !== "video");
  const quoteLayout = activity.sourceType === "quote";
  const layout = visual.layout ?? "image-left";
  const quoteImageSizeToken = visual.width?.trim().toLowerCase() ?? "medium";
  const quoteImagePercent = quoteImageSizeToken === "small"
    ? 20
    : quoteImageSizeToken === "large"
      ? 26
      : quoteImageSizeToken === "medium"
        ? 22
        : Math.min(36, Math.max(18, Number.parseFloat(quoteImageSizeToken) || 22));
  const quoteImageFit = layout === "image-center"
    ? Math.round(quoteImagePercent * 9)
    : Math.round(quoteImagePercent * 5.2);
  const image = imageContent(primaryAsset, assets, activity.label, quoteLayout ? quoteImageFit : 220);
  const copy: Content = {
    stack: richSections.flatMap((section) => sectionContent(section, activity, assets, labels))
  };
  const imageColumnWidth = quoteLayout ? `${quoteImagePercent}%` : "46%";
  let composed: Content;
  if (layout === "image-left") {
    composed = { columns: [{ width: imageColumnWidth, stack: [image] }, { width: "*", stack: [copy] }], columnGap: 12 };
  } else if (layout === "image-right") {
    composed = { columns: [{ width: "*", stack: [copy] }, { width: imageColumnWidth, stack: [image] }], columnGap: 12 };
  } else if (layout === "image-below") {
    composed = { stack: [copy, image] };
  } else {
    composed = { stack: [image, copy] };
  }
  const consumed = new Set<LessonPdfActivitySection>([visual, ...richSections]);
  return [
    composed,
    ...activity.sections.filter((section) => !consumed.has(section)).flatMap((section) => sectionContent(section, activity, assets, labels))
  ];
}

function activityContent(activity: LessonPdfActivity, assets: PreparedPdfAssets, labels: LessonPdfLabels): Content {
  const stack: Content[] = [
    { text: activity.heading, bold: true, fontSize: 12, color: "#0f3b70", margin: [0, 0, 0, 6] }
  ];
  if (activity.title && activity.title !== activity.label) {
    stack.push({ text: plainRichTextRuns(activity.title), bold: true, fontSize: 14, margin: [0, 0, 0, 4] });
  }
  stack.push(...layoutAwareSections(activity, assets, labels));
  for (const status of activity.imageAltStatuses) {
    stack.push({
      text: status === "decorative" ? labels.altDecorative : status === "filled" ? labels.altFilled : labels.altMissing,
      color: status === "missing" ? "#b42318" : status === "decorative" ? "#b25d00" : "#16794b",
      fontSize: 8,
      margin: [0, 4, 0, 0]
    });
  }

  // The PDF table is only a pagination container. It must not reproduce the
  // editor's generic panel defaults; activity-specific renderers draw their
  // own visible surfaces. A note is the sole root-level semantic panel.
  const ownsVisiblePanel = activity.sourceType === "note";
  const panelPadding = ownsVisiblePanel ? cssPixels(activity.style.panelPadding, 9, 0, 30) : 0;
  const borderWidth = cssPixels(activity.style.panelBorderWidth, ownsVisiblePanel ? 2 : 0.8, 0, 5);
  // Activity backgrounds are never reproduced in the review PDF. Note keeps
  // its semantic panel geometry and border, but its printable surface is white.
  const panelBackgroundColor = "#ffffff";
  const hasExplicitPanelBorder = ownsVisiblePanel && activity.style.panelBorderStyle !== "none";
  const containsRichTable = activity.sections.some(
    (section) => section.kind === "rich-text" && /<table\b/i.test(section.html)
  );
  const containsLongInteractiveVisual = activity.sections.some(
    (section) => section.kind === "interactive-visual" && section.points.length > 3
  );
  const keepTogether = activity.renderMode !== "assessment"
    && !containsRichTable
    && !containsLongInteractiveVisual
    && !(activity.sourceType === "situational-dialogue" && (
      activity.sections.filter((section) => section.kind === "situational-dialogue").flatMap((section) => section.nodes).length > 3
      || activity.sections.filter((section) => section.kind === "situational-dialogue").flatMap((section) => section.nodes).reduce(
        (length, node) => length + plainRichText(node.contentHtml).length + node.responses.reduce(
          (responseLength, response) => responseLength + plainRichText(response.labelHtml).length + plainRichText(response.feedbackHtml ?? "").length,
          0
        ),
        0
      ) > 1800
    ))
    && !(activity.renderMode === "expanded-items" && activity.sections.some(
      (section) => section.kind === "expanded-items" && section.items.length > 4
    ));
  const panelContent: Content[] = activity.sourceType === "note" && activity.style.noteShowIcon !== false
    ? [{
        columns: [
          {
            svg: noteIconSvg(
              activity.style.noteIcon,
              safeColor(
                activity.style.noteIconMatchesBorder === false
                  ? activity.style.noteIconColor
                  : activity.style.panelBorderColor,
                safeColor(activity.style.panelBorderColor, "#123a7a")
              )
            ),
            width: 36,
            color: safeColor(activity.style.panelBorderColor, "#123a7a")
          },
          { width: "*", stack }
        ],
        columnGap: 12
      }]
    : stack;
  return {
    table: {
      widths: ["*"],
      body: [[{ stack: panelContent, margin: [panelPadding, panelPadding] }]],
      dontBreakRows: keepTogether
    },
    layout: {
      fillColor: panelBackgroundColor,
      hLineColor: safeColor(activity.style.panelBorderColor, "#123a7a"),
      vLineColor: safeColor(activity.style.panelBorderColor, "#123a7a"),
      hLineWidth: () => hasExplicitPanelBorder ? borderWidth : 0,
      vLineWidth: () => hasExplicitPanelBorder ? borderWidth : 0
    },
    margin: [0, 0, 0, 12]
  };
}

export function noteIconSvg(value: LessonPdfActivity["style"]["noteIcon"], color: string): string {
  const paths: Record<string, string> = {
    "info-circle": '<circle cx="12" cy="12" r="18"/><path d="M12 10.5v6M12 7.5h.01" transform="translate(-4.615 -4.615) scale(1.384615)"/>',
    "no-entry": '<circle cx="12" cy="12" r="18"/><path d="M3 12h18"/>',
    "exclamation-circle": '<circle cx="12" cy="12" r="18"/><path d="M12 7.5v6M12 16.5h.01" transform="translate(-4.615 -4.615) scale(1.384615)"/>',
    prohibition: '<circle cx="12" cy="12" r="18"/><path d="M-.7-.7l25.4 25.4"/>',
    "warning-triangle": '<path d="M12 3.5 21 20H3L12 3.5Z"/><path d="M12 9v5M12 17h.01"/>',
    "check-circle": '<circle cx="12" cy="12" r="18"/><path d="m7.8 12.2 2.7 2.8 5.8-6" transform="translate(-4.615 -4.615) scale(1.384615)"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 7"/>'
  };
  const circular = value !== "warning-triangle" && value !== "check";
  return `<svg viewBox="${circular ? "-7 -7 38 38" : "0 0 24 24"}" fill="none" stroke="${color}" stroke-width="${value === "warning-triangle" ? "1.25" : "2"}" stroke-linecap="round" stroke-linejoin="round">${paths[value ?? "info-circle"] ?? paths["info-circle"]}</svg>`;
}

export function renderLessonPdfDocument(
  model: LessonPdfDocumentModel,
  assets: PreparedPdfAssets = {}
): TDocumentDefinitions {
  const coverData = imageData(model.coverImage, assets);
  const labels = model.labels;
  const content: Content[] = [
    { text: model.lessonTitle, bold: true, fontSize: 28, color: "#0f2450", alignment: "center", margin: [0, coverData ? 55 : 180, 0, 22] },
    ...(coverData ? [{ image: coverData, fit: [470, 360], alignment: "center", margin: [0, 0, 0, 22] } as Content] : []),
    { text: labels.reviewDocument, fontSize: 13, color: "#64748b", alignment: "center", pageBreak: "after" },
    { text: model.lessonTitle, bold: true, fontSize: 22, color: "#0f2450", margin: [0, 0, 0, 14] },
    { text: `${labels.estimatedDuration ?? "Durée estimée"} : ${formatEstimatedDuration(model.estimatedDurationSeconds)}`, bold: true, fontSize: 14, color: "#475569", margin: [0, 0, 0, 3] },
    { text: labels.durationCalculationNote ?? "Calcul indicatif fondé sur le texte présenté, la durée réelle des vidéos et fichiers audio et une estimation des interactions. Les sous-titres ne sont pas comptés séparément.", fontSize: 9, color: "#64748b", margin: [0, 0, 0, 16] },
    { text: labels.chapters, bold: true, fontSize: 16, color: "#0f3b70", margin: [0, 0, 0, 8] },
    {
      ul: model.chapterMenu.map((chapter) => ({
        text: `${labels.chapter} ${chapter.order} — ${chapter.title}`,
        linkToDestination: chapterDestination(chapter.order),
        color: "#0f3b70",
        decoration: "underline",
        margin: [0, 3, 0, 3]
      })),
      margin: [8, 0, 0, 10],
      pageBreak: "after"
    }
  ];

  model.chapters.forEach((chapter, chapterIndex) => {
    content.push({
      text: `${labels.chapterUppercase} ${chapter.order}`,
      id: chapterDestination(chapter.order),
      bold: true,
      fontSize: 10,
      characterSpacing: 1.2,
      color: "#64748b",
      margin: [0, 0, 0, 5],
      pageBreak: chapterIndex === 0 ? undefined : "before"
    });
    content.push({
      text: chapter.title,
      bold: true,
      fontSize: 22,
      color: "#0f2450",
      margin: [0, 0, 0, 14]
    });
    for (const activity of chapter.activities) {
      content.push(activityContent(activity, assets, labels));
    }
  });

  if (model.assistantAppendices.length) {
    content.push({ text: labels.assistantsAndGlossaries, bold: true, fontSize: 22, color: "#0f2450", pageBreak: "before", margin: [0, 0, 0, 14] });
    for (const assistant of model.assistantAppendices) {
      content.push({ text: assistant.name, bold: true, fontSize: 17, color: "#0f3b70", margin: [0, 6, 0, 7] });
      if (assistant.avatar) {
        content.push(imageContent(assistant.avatar, assets, assistant.name, 90));
      }
      for (const entry of assistant.entries) {
        const stack: Content[] = [
          { text: entry.term, bold: true, fontSize: 12, color: "#0f3b70" }
        ];
        if (entry.aliases.length) {
          stack.push({ text: `${labels.aliases}: ${entry.aliases.join(", ")}`, italics: true, color: "#64748b", margin: [0, 2, 0, 3] });
        }
        stack.push(...richHtmlToPdf(entry.contentHtml, richOptions(labels)));
        if (entry.related.length) {
          stack.push({ text: `${labels.relatedTerms}: ${entry.related.join(", ")}`, color: "#475569", margin: [0, 3, 0, 0] });
        }
        content.push({
          table: { widths: ["*"], body: [[{ stack, margin: [9, 7] }]] },
          layout: { fillColor: "#f8fafc", hLineColor: "#dbe4ee", vLineColor: "#dbe4ee" },
          margin: [0, 3, 0, 7]
        });
      }
    }
  }

  return {
    info: { title: model.lessonTitle, subject: labels.reviewDocumentSubject },
    pageSize: "A4",
    pageMargins: [40, 42, 40, 42],
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: "center",
      color: "#64748b",
      fontSize: 8,
      margin: [40, 10, 40, 0]
    }),
    defaultStyle: { font: "PaideiaDocument", fontSize: 10.5, lineHeight: 1.25, color: model.contentTextColor },
    content
  };
}
