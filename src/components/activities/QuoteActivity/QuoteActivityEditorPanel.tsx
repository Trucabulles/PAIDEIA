import type { ReactNode } from "react";
import { QuoteActivityEditor } from "./QuoteActivityEditor";

type QuoteEditorValue = {
  buttonTextColor: string;
  panelBackgroundColor: string;
  panelBorderColor: string;
  panelBorderStyle: string;
  panelBorderWidth: string;
  panelRounded: boolean;
  panelShadow: boolean;
  quoteShowAuthor: boolean;
};

type QuoteActivityEditorPanelProps = {
  authorField: ReactNode;
  onChange: (patch: Partial<QuoteEditorValue>) => void;
  value: QuoteEditorValue;
};

export function QuoteActivityEditorPanel({ authorField, onChange, value }: QuoteActivityEditorPanelProps) {
  return (
    <div className="inspector-span-2">
      <QuoteActivityEditor
        accentColor={value.buttonTextColor || "#123a7a"}
        authorField={authorField}
        backgroundColor={value.panelBackgroundColor}
        borderColor={value.panelBorderColor}
        borderStyle={value.panelBorderStyle}
        borderWidth={value.panelBorderWidth}
        onAccentColorChange={(buttonTextColor) => onChange({ buttonTextColor })}
        onBackgroundColorChange={(panelBackgroundColor) => onChange({ panelBackgroundColor })}
        onBorderColorChange={(panelBorderColor) => onChange({ panelBorderColor })}
        onBorderStyleChange={(panelBorderStyle) => onChange({ panelBorderStyle })}
        onBorderWidthChange={(panelBorderWidth) => onChange({ panelBorderWidth })}
        onRoundedChange={(panelRounded) => onChange({ panelRounded })}
        onShadowChange={(panelShadow) => onChange({ panelShadow })}
        onShowAuthorChange={(quoteShowAuthor) => onChange({ quoteShowAuthor })}
        rounded={value.panelRounded}
        shadow={value.panelShadow}
        showAuthor={value.quoteShowAuthor}
      />
    </div>
  );
}
