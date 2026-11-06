import { AttachmentActivityEditor } from "../activities/AttachmentActivity";
import { DividerActivityEditor } from "../activities/DividerActivity";
import { SectionMarkerActivityEditor } from "../activities/SectionMarkerActivity";
import { NoteActivityEditor, type NoteIconId } from "../activities/NoteActivity";
import { LessonNavigationActivityEditor } from "../activities/LessonNavigationActivity";
import type { AttachmentFile } from "../../types/project";
import type { CourseExitLayout } from "../activities/LessonNavigationActivity";
import type { ReactNode } from "react";

type AttachmentEditorValue = {
  attachmentFiles: AttachmentFile[];
  panelBackgroundColor: string;
  panelBorderColor: string;
  panelRounded: boolean;
};

type AttachmentEditorPanelProps = {
  onAdd: (file: File) => void;
  onChange: (patch: Partial<AttachmentEditorValue>) => void;
  onRemove: (attachmentId: string) => void;
  onReplace: (attachmentId: string, file: File) => void;
  value: AttachmentEditorValue;
};

export function AttachmentEditorPanel({ onAdd, onChange, onRemove, onReplace, value }: AttachmentEditorPanelProps) {
  return (
    <div className="inspector-span-2">
      <AttachmentActivityEditor
        backgroundColor={value.panelBackgroundColor}
        borderColor={value.panelBorderColor}
        files={value.attachmentFiles}
        onAdd={onAdd}
        onBackgroundColorChange={(panelBackgroundColor) => onChange({ panelBackgroundColor })}
        onBorderColorChange={(panelBorderColor) => onChange({ panelBorderColor })}
        onRemove={onRemove}
        onReplace={onReplace}
        onRoundedChange={(panelRounded) => onChange({ panelRounded })}
        rounded={value.panelRounded}
      />
    </div>
  );
}

type DividerEditorValue = {
  dividerColor: string;
  dividerStyle: string;
  dividerWidth: string;
};

type DividerEditorPanelProps = {
  onChange: (patch: Partial<DividerEditorValue>) => void;
  value: DividerEditorValue;
};

export function DividerEditorPanel({ onChange, value }: DividerEditorPanelProps) {
  return (
    <div className="inspector-span-2">
      <DividerActivityEditor
        color={value.dividerColor}
        onColorChange={(dividerColor) => onChange({ dividerColor })}
        onStyleChange={(dividerStyle) => onChange({ dividerStyle })}
        onWidthChange={(dividerWidth) => onChange({ dividerWidth })}
        style={value.dividerStyle}
        width={value.dividerWidth}
      />
    </div>
  );
}

type SectionMarkerEditorValue = DividerEditorValue & {
  markerScheme: string;
  markerTextColor: string;
  markerType: string;
};

export function SectionMarkerEditorPanel({ label, markerFontSize, onChange, value }: { label?: string; markerFontSize?: string; onChange: (patch: Partial<SectionMarkerEditorValue>) => void; value: SectionMarkerEditorValue }) {
  return <div className="inspector-span-2"><SectionMarkerActivityEditor {...value} label={label} markerFontSize={markerFontSize} onChange={onChange} /></div>;
}

type NoteEditorValue = {
  noteIcon: NoteIconId;
  noteShowIcon: boolean;
  noteIconColor: string;
  noteIconMatchesBorder: boolean;
  panelBackgroundColor: string;
  panelBorderColor: string;
  panelBorderStyle: string;
  panelBorderWidth: string;
  panelRounded: boolean;
  panelShadow: boolean;
};

type NoteEditorPanelProps = {
  onChange: (patch: Partial<NoteEditorValue>) => void;
  showIconSettings?: boolean;
  value: NoteEditorValue;
};

export function NoteEditorPanel({ onChange, showIconSettings, value }: NoteEditorPanelProps) {
  return (
    <div className="inspector-span-2">
      <NoteActivityEditor
        backgroundColor={value.panelBackgroundColor}
        borderColor={value.panelBorderColor}
        borderStyle={value.panelBorderStyle}
        borderWidth={value.panelBorderWidth}
        icon={value.noteIcon}
        iconColor={value.noteIconColor}
        iconMatchesBorder={value.noteIconMatchesBorder}
        onBackgroundColorChange={(panelBackgroundColor) => onChange({ panelBackgroundColor })}
        onBorderColorChange={(panelBorderColor) => onChange({ panelBorderColor })}
        onBorderStyleChange={(panelBorderStyle) => onChange({ panelBorderStyle })}
        onBorderWidthChange={(panelBorderWidth) => onChange({ panelBorderWidth })}
        onIconChange={(noteIcon) => onChange({ noteIcon })}
        onIconColorChange={(noteIconColor) => onChange({ noteIconColor })}
        onIconMatchesBorderChange={(noteIconMatchesBorder) => onChange({ noteIconMatchesBorder })}
        onRoundedChange={(panelRounded) => onChange({ panelRounded })}
        onShadowChange={(panelShadow) => onChange({ panelShadow })}
        onShowIconChange={(noteShowIcon) => onChange({ noteShowIcon })}
        rounded={value.panelRounded}
        shadow={value.panelShadow}
        showIcon={value.noteShowIcon}
        showIconSettings={showIconSettings}
      />
    </div>
  );
}

type NavigationEditorValue = {
  buttonBackgroundColor: string;
  buttonTextColor: string;
  summary: string;
  contentHtml: string;
  mediaLayout: string;
};

type NavigationEditorPanelProps = {
  fallbackLabel: string;
  isCourseExit: boolean;
  onChange: (patch: Partial<NavigationEditorValue>) => void;
  richTextField?: ReactNode;
  value: NavigationEditorValue;
};

export function NavigationEditorPanel({ fallbackLabel, isCourseExit, onChange, richTextField, value }: NavigationEditorPanelProps) {
  return (
    <div className="inspector-span-2">
      <LessonNavigationActivityEditor
        activityType={isCourseExit ? "course-exit" : "continue"}
        backgroundColor={value.buttonBackgroundColor}
        label={value.summary}
        layout={value.mediaLayout as CourseExitLayout}
        onBackgroundColorChange={(buttonBackgroundColor) => onChange({ buttonBackgroundColor })}
        onLabelChange={(summary) => onChange({ summary })}
        onLayoutChange={(mediaLayout) => onChange({ mediaLayout })}
        onTextColorChange={(buttonTextColor) => onChange({ buttonTextColor })}
        previewLabel={value.summary || fallbackLabel}
        richTextField={richTextField}
        showLayout={isCourseExit}
        textColor={value.buttonTextColor}
      />
    </div>
  );
}
