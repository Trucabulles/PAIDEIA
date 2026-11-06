import { HtmlCustomActivityEditorPanel } from "../activities/HtmlCustomActivity";
import { LinksResourcesActivityEditor } from "../activities/LinksResourcesActivity";
import type { CSSProperties, ReactNode } from "react";
import type { BlockFormState } from "../../app/appStateTypes";
import type { PaideiaBlock } from "../../types/project";
import {
  AttachmentEditorPanel,
  NavigationEditorPanel,
  NoteEditorPanel
} from "./SimpleActivityEditorPanels";
import { HeaderEditorPanel } from "./ContentActivityEditorPanels";
import { useI18n } from "../../i18n/react";

type SimpleInlineBlockEditorsProps = {
  block: PaideiaBlock;
  defaultHtmlContent: string;
  getBlockLabel: (blockType: string) => string;
  headerHasImage: boolean;
  headerImageAccept: string;
  headerImageName: string;
  headerImageSrc: string | null;
  headerPreviewStyle: CSSProperties;
  htmlCodeScrollTop: number;
  htmlPackageImportPending: boolean;
  onAttachmentAdd: (file: File) => void;
  onAttachmentRemove: (attachmentId: string) => void;
  onAttachmentReplace: (attachmentId: string, file: File) => void;
  onChange: (patch: Partial<BlockFormState>) => void;
  onHtmlFileSelect: (file: File) => void;
  onHtmlScrollTopChange: (value: number) => void;
  onImageRemove: () => void;
  onImageUpload: (file: File) => void;
  quizOptions: Array<{ id: string; label: string }>;
  renderCourseExitRichTextField: (block: PaideiaBlock, html: string) => ReactNode;
  renderActivityItemRichTextField: (options: {
    block: PaideiaBlock;
    className?: string;
    field: "contentHtml";
    html: string;
    item: NonNullable<PaideiaBlock["activityItems"]>[number];
    label: string;
    placeholder: string;
  }) => ReactNode;
  value: BlockFormState;
};

export function SimpleInlineBlockEditors({
  block,
  defaultHtmlContent,
  getBlockLabel,
  headerHasImage,
  headerImageAccept,
  headerImageName,
  headerImageSrc,
  headerPreviewStyle,
  htmlCodeScrollTop,
  htmlPackageImportPending,
  onAttachmentAdd,
  onAttachmentRemove,
  onAttachmentReplace,
  onChange,
  onHtmlFileSelect,
  onHtmlScrollTopChange,
  onImageRemove,
  onImageUpload,
  quizOptions,
  renderCourseExitRichTextField,
  renderActivityItemRichTextField,
  value
}: SimpleInlineBlockEditorsProps) {
  const { t } = useI18n();
  return (
    <>
      {block.type === "html-custom" ? (
        <HtmlCustomActivityEditorPanel
          fileName={block.htmlPackageName}
          htmlCodeScrollTop={htmlCodeScrollTop}
          importPending={htmlPackageImportPending}
          onChange={onChange}
          onFileSelect={onHtmlFileSelect}
          onScrollTopChange={onHtmlScrollTopChange}
          placeholder={defaultHtmlContent}
          title={block.htmlEntryFile}
          value={value}
        />
      ) : null}
      {block.type === "header" ? (
        <HeaderEditorPanel
          backgroundColor={value.headerBackgroundColor}
          backgroundBlur={value.sectionBackgroundBlur}
          backgroundOverlay={Math.max(0, Math.min(1, 1 - value.sectionBackgroundOpacity))}
          backgroundOverlayDark={value.sectionBackgroundOverlayDark}
          contentPosition={value.contentAlign === "right" ? "right" : value.contentAlign === "center" ? "center" : "left"}
          textOutline={value.headerTextOutline}
          textOutlineColor={value.headerTextOutlineColor}
          hasImage={headerHasImage}
          height={value.headerHeight}
          imageAccept={headerImageAccept}
          imageName={headerImageName}
          imageSrc={headerImageSrc}
          onBackgroundColorChange={(headerBackgroundColor) => onChange({ headerBackgroundColor })}
          onBackgroundBlurChange={(sectionBackgroundBlur) => onChange({ sectionBackgroundBlur })}
          onBackgroundOverlayChange={(overlay) => onChange({ sectionBackgroundOpacity: 1 - overlay })}
          onBackgroundOverlayDarkChange={(sectionBackgroundOverlayDark) => onChange({ sectionBackgroundOverlayDark })}
          onContentPositionChange={(contentAlign) => onChange({ contentAlign })}
          onTextOutlineChange={(headerTextOutline) => onChange({ headerTextOutline })}
          onTextOutlineColorChange={(headerTextOutlineColor) => onChange({ headerTextOutlineColor })}
          onHeightChange={(headerHeight) => onChange({ headerHeight })}
          onImageUpload={onImageUpload}
          onRemoveImage={onImageRemove}
          previewContentHtml={value.contentHtml}
          previewStyle={headerPreviewStyle}
        />
      ) : null}
      {block.type === "continue" || block.type === "course-exit" ? (
        <NavigationEditorPanel
          fallbackLabel={getBlockLabel(block.type)}
          isCourseExit={block.type === "course-exit"}
          onChange={onChange}
          richTextField={block.type === "course-exit" ? renderCourseExitRichTextField(block, value.contentHtml) : undefined}
          value={value}
        />
      ) : null}
      {block.type === "note" ? <NoteEditorPanel onChange={onChange} value={value} /> : null}
      {block.type === "result-message" ? (() => {
        const successBranch = value.activityItems.find((item) => item.kind === "result-success");
        const failureBranch = value.activityItems.find((item) => item.kind === "result-failure");
        const sourceQuizId = successBranch?.nextNodeId || failureBranch?.nextNodeId || "";
        const sourceQuizIsMissing = Boolean(sourceQuizId) && !quizOptions.some((option) => option.id === sourceQuizId);
        return (
          <section className="result-message-editor inspector-span-2">
            <label>
              <span className="editor-label">{t("resultMessage.sourceQuiz", undefined, "Quiz source")}</span>
              <select
                onChange={(event) => onChange({
                  activityItems: value.activityItems.map((item) =>
                    item.kind === "result-success" || item.kind === "result-failure"
                      ? { ...item, nextNodeId: event.target.value }
                      : item
                  )
                })}
                value={sourceQuizId}
              >
                <option value="">{t("resultMessage.selectQuiz", undefined, "Sélectionner un quiz")}</option>
                {quizOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            {!quizOptions.length ? <p className="field-hint">{t("resultMessage.noQuiz", undefined, "Ajoutez d’abord un quiz à cette leçon.")}</p> : null}
            {sourceQuizIsMissing ? <p className="field-hint field-hint-error">{t("resultMessage.missingQuiz", undefined, "Le quiz source n’existe plus. Sélectionnez un autre quiz.")}</p> : null}
            {successBranch ? renderActivityItemRichTextField({
              block,
              className: "activity-item-rich-editor result-message-rich-editor",
              field: "contentHtml",
              html: successBranch.contentHtml,
              item: successBranch,
              label: t("resultMessage.successBranch", undefined, "Après réussite"),
              placeholder: t("resultMessage.successPlaceholder", undefined, "Saisissez ici un message après la réussite du quiz")
            }) : null}
            {failureBranch ? renderActivityItemRichTextField({
              block,
              className: "activity-item-rich-editor result-message-rich-editor",
              field: "contentHtml",
              html: failureBranch.contentHtml,
              item: failureBranch,
              label: t("resultMessage.failureBranch", undefined, "Après échec final"),
              placeholder: t("resultMessage.failurePlaceholder", undefined, "Saisissez ici un message après l’échec final du quiz")
            }) : null}
            <NoteEditorPanel onChange={onChange} showIconSettings={false} value={value} />
          </section>
        );
      })() : null}
      {block.type === "attachment" ? (
        <AttachmentEditorPanel
          onAdd={onAttachmentAdd}
          onChange={onChange}
          onRemove={onAttachmentRemove}
          onReplace={onAttachmentReplace}
          value={value}
        />
      ) : null}
      {block.type === "links-resources" ? <LinksResourcesActivityEditor onChange={onChange} value={value} /> : null}
    </>
  );
}
