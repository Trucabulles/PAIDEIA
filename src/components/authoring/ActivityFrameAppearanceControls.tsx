import { ColorPickerField } from "../color-picker/ColorPickerPopover";
import { AuthoringCheckbox } from "./AuthoringCheckbox";
import { AuthoringFieldGrid } from "./AuthoringFieldGrid";

export type ActivityFrameAppearanceValue = {
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  rounded: boolean;
  shadow: boolean;
};

export type ActivityFrameAppearanceLabels = {
  accent: string;
  activityAppearance: string;
  background: string;
  backgroundColor: string;
  borderStyle: string;
  borderWidth: string;
  dotted: string;
  dashed: string;
  lineNone: string;
  lineNormal: string;
  lineThick: string;
  lineThin: string;
  roundedCorners: string;
  shadow: string;
  solid: string;
};

type ActivityFrameAppearanceControlsProps = {
  labels: ActivityFrameAppearanceLabels;
  onChange: (patch: Partial<ActivityFrameAppearanceValue>) => void;
  roundedDisabled?: boolean;
  showBackground?: boolean;
  showShadow?: boolean;
  value: ActivityFrameAppearanceValue;
};

export function ActivityFrameAppearanceControls({
  labels,
  onChange,
  roundedDisabled = false,
  showBackground = true,
  showShadow = true,
  value
}: ActivityFrameAppearanceControlsProps) {
  return (
    <section className="appearance-section appearance-section--card" aria-label={labels.activityAppearance}>
      <span className="appearance-title">{labels.activityAppearance}</span>
      <AuthoringFieldGrid className="appearance-grid">
        {showBackground ? <label>
          <span>{labels.background}</span>
          <ColorPickerField
            allowTransparent
            ariaLabel={labels.backgroundColor}
            onChange={(backgroundColor) => onChange({ backgroundColor })}
            value={value.backgroundColor}
          />
        </label> : null}
        <label>
          <span>{labels.accent}</span>
          <ColorPickerField
            ariaLabel={labels.accent}
            onChange={(borderColor) => onChange({ borderColor })}
            value={value.borderColor}
          />
        </label>
        <label>
          <span>{labels.borderWidth}</span>
          <select
            onChange={(event) => onChange({ borderWidth: event.target.value })}
            value={value.borderWidth}
          >
            <option value="0px">{labels.lineNone}</option>
            <option value="1px">{labels.lineThin}</option>
            <option value="2px">{labels.lineNormal}</option>
            <option value="4px">{labels.lineThick}</option>
          </select>
        </label>
        <label>
          <span>{labels.borderStyle}</span>
          <select
            onChange={(event) => onChange({ borderStyle: event.target.value })}
            value={value.borderStyle}
          >
            <option value="solid">{labels.solid}</option>
            <option value="dashed">{labels.dashed}</option>
            <option value="dotted">{labels.dotted}</option>
          </select>
        </label>
        <AuthoringCheckbox
          checked={value.rounded}
          compact
          disabled={roundedDisabled}
          onChange={(event) => onChange({ rounded: event.target.checked })}
        >
          {labels.roundedCorners}
        </AuthoringCheckbox>
        {showShadow ? <AuthoringCheckbox
          checked={value.shadow}
          compact
          onChange={(event) => onChange({ shadow: event.target.checked })}
        >
          {labels.shadow}
        </AuthoringCheckbox> : null}
      </AuthoringFieldGrid>
    </section>
  );
}
