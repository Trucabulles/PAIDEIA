import type { ComponentProps } from "react";
import type { BlockFormState } from "../../app/appStateTypes";
import { AccordionActivityEditorPanel } from "../activities/AccordionActivity";
import { FlipCardsActivityEditorPanel } from "../activities/FlipCardsActivity";
import { SlidesActivityEditorPanel } from "../activities/SlidesActivity";
import { TabsActivityEditorPanel } from "../activities/TabsActivity";

type AccordionInlineBlockEditorProps = Omit<
  ComponentProps<typeof AccordionActivityEditorPanel>,
  "onStyleChange" | "style"
> & {
  onChange: (patch: Partial<BlockFormState>) => void;
  value: BlockFormState;
};

export function AccordionInlineBlockEditor({
  onChange,
  value,
  ...props
}: AccordionInlineBlockEditorProps) {
  return (
    <AccordionActivityEditorPanel
      {...props}
      onStyleChange={(patch) => {
        const next: Partial<BlockFormState> = {};
        if (patch.backgroundColor !== undefined) next.panelBackgroundColor = patch.backgroundColor;
        if (patch.borderColor !== undefined) next.panelBorderColor = patch.borderColor;
        if (patch.borderStyle !== undefined) next.panelBorderStyle = patch.borderStyle;
        if (patch.borderWidth !== undefined) next.panelBorderWidth = patch.borderWidth;
        if (patch.rounded !== undefined) next.panelRounded = patch.rounded;
        if (patch.shadow !== undefined) next.panelShadow = patch.shadow;
        onChange(next);
      }}
      style={{
        backgroundColor: value.panelBackgroundColor,
        borderColor: value.panelBorderColor,
        borderStyle: value.panelBorderStyle,
        borderWidth: value.panelBorderWidth,
        rounded: value.panelRounded,
        shadow: value.panelShadow
      }}
    />
  );
}

export function SlidesInlineBlockEditor(
  props: ComponentProps<typeof SlidesActivityEditorPanel>
) {
  return <SlidesActivityEditorPanel {...props} />;
}

export function FlipCardsInlineBlockEditor(
  props: ComponentProps<typeof FlipCardsActivityEditorPanel>
) {
  return <FlipCardsActivityEditorPanel {...props} />;
}

export function TabsInlineBlockEditor(
  props: ComponentProps<typeof TabsActivityEditorPanel>
) {
  return <TabsActivityEditorPanel {...props} />;
}
