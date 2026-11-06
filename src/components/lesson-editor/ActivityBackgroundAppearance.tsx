import { useId } from "react";
import { AuthoringCheckbox } from "../authoring";
import { ColorPickerField } from "../color-picker/ColorPickerPopover";
import "./ActivityBackgroundAppearance.css";

export type ActivityBackgroundAppearanceLabels = {
  backgroundColor: string;
  backgroundColorAriaLabel: string;
  backgroundImage: string;
  backgroundImagePreview: string;
  blur: string;
  chooseImage: string;
  height: string;
  heightLarge: string;
  heightMedium: string;
  heightMinimum: string;
  light: string;
  medium: string;
  none: string;
  overlay: string;
  darkOverlay: string;
  removeImage: string;
  reset: string;
  roundedCorners: string;
  strong: string;
  title: string;
  wideBackground: string;
};

export type ActivityBackgroundAppearanceValue = {
  backgroundColor: string;
  backgroundImageName: string;
  backgroundImageRef: string;
  backgroundImageUrl: string | null;
  blur: number;
  height: "minimum" | "medium" | "large";
  overlay: number;
  darkOverlay: boolean;
  rounded: boolean;
  wide: boolean;
};

type NumericOption = {
  label: string;
  value: number;
};

export type ActivityBackgroundAppearanceProps = {
  imageAccept: string;
  labels: ActivityBackgroundAppearanceLabels;
  onChange: (patch: Partial<ActivityBackgroundAppearanceValue>) => void;
  onImageRemove: () => void;
  onImageUpload: (file: File) => void;
  onReset: () => void;
  showHeight?: boolean;
  showImage?: boolean;
  showRounded?: boolean;
  showWide?: boolean;
  value: ActivityBackgroundAppearanceValue;
};

function optionsWithCurrentValue(
  options: NumericOption[],
  currentValue: number,
  formatCurrentValue: (value: number) => string
): NumericOption[] {
  if (options.some((option) => option.value === currentValue)) {
    return options;
  }

  return [...options, { label: formatCurrentValue(currentValue), value: currentValue }].sort(
    (left, right) => left.value - right.value
  );
}

export function ActivityBackgroundAppearance({
  imageAccept,
  labels,
  onChange,
  onImageRemove,
  onImageUpload,
  onReset,
  showHeight = true,
  showImage = true,
  showRounded = true,
  showWide = true,
  value
}: ActivityBackgroundAppearanceProps) {
  const titleId = useId();
  const overlayOptions = optionsWithCurrentValue(
    [
      { label: labels.none, value: 0 },
      { label: labels.light, value: 0.25 },
      { label: labels.medium, value: 0.5 },
      { label: labels.strong, value: 0.75 }
    ],
    value.overlay,
    (currentValue) => `${Math.round(currentValue * 100)} %`
  );
  const blurOptions = optionsWithCurrentValue(
    [
      { label: labels.none, value: 0 },
      { label: labels.light, value: 4 },
      { label: labels.medium, value: 8 },
      { label: labels.strong, value: 12 }
    ],
    value.blur,
    (currentValue) => `${currentValue} px`
  );

  const handleImageSelection = (file: File | undefined) => {
    if (file) {
      if (!value.backgroundImageRef) {
        onChange({ wide: true });
      }
      onImageUpload(file);
    }
  };

  return (
    <section className="activity-background-appearance" aria-labelledby={titleId}>
      <header className="activity-background-appearance__header">
        <span className="editor-label" id={titleId}>
          {labels.title}
        </span>
        <button
          className="activity-background-appearance__reset"
          onClick={onReset}
          type="button"
        >
          {labels.reset}
        </button>
      </header>

      <div className="activity-background-appearance__settings">
        <label className="activity-background-appearance__control activity-background-appearance__color">
          <span>{labels.backgroundColor}</span>
          <ColorPickerField
            allowTransparent
            ariaLabel={labels.backgroundColorAriaLabel}
            onChange={(backgroundColor) => onChange({ backgroundColor })}
            value={value.backgroundColor}
          />
        </label>

        {showImage ? <div className="activity-background-appearance__control activity-background-appearance__overlay-control">
          <span>{labels.overlay}</span>
          <select
            onChange={(event) => onChange({ overlay: Number.parseFloat(event.target.value) || 0 })}
            value={String(value.overlay)}
          >
            {overlayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="activity-background-appearance__dark-overlay">
            <input
              checked={value.darkOverlay}
              onChange={(event) => onChange({ darkOverlay: event.target.checked })}
              type="checkbox"
            />
            <span>{labels.darkOverlay}</span>
          </label>
        </div> : null}

        {showImage ? <label className="activity-background-appearance__control">
          <span>{labels.blur}</span>
          <select
            onChange={(event) => onChange({ blur: Number.parseInt(event.target.value, 10) || 0 })}
            value={String(value.blur)}
          >
            {blurOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label> : null}

        {showWide ? (
          <label className="activity-background-appearance__control activity-background-appearance__toggle">
            <span>{labels.wideBackground}</span>
            <input
              checked={value.wide}
              onChange={(event) => onChange({ wide: event.target.checked })}
              type="checkbox"
            />
          </label>
        ) : null}

        {showRounded ? (
          <AuthoringCheckbox
            checked={value.rounded}
            compact
            disabled={value.wide}
            onChange={(event) => onChange({ rounded: event.target.checked })}
          >
            {labels.roundedCorners}
          </AuthoringCheckbox>
        ) : null}

        {showHeight ? (
          <label className="activity-background-appearance__control">
            <span>{labels.height}</span>
            <select
              onChange={(event) =>
                onChange({ height: event.target.value as ActivityBackgroundAppearanceValue["height"] })
              }
              value={value.height}
            >
              <option value="minimum">{labels.heightMinimum}</option>
              <option value="medium">{labels.heightMedium}</option>
              <option value="large">{labels.heightLarge}</option>
            </select>
          </label>
        ) : null}
      </div>

      {showImage ? <div className="activity-background-appearance__image-row">
        <span className="activity-background-appearance__field-label">{labels.backgroundImage}</span>

        {value.backgroundImageRef && value.backgroundImageUrl ? (
          <div className="activity-background-appearance__preview-shell">
            <label className="activity-background-appearance__preview-picker">
              <input
                accept={imageAccept}
                onChange={(event) => {
                  handleImageSelection(event.target.files?.[0]);
                  event.target.value = "";
                }}
                type="file"
              />
              <img
                alt={labels.backgroundImagePreview}
                className="activity-background-appearance__preview"
                src={value.backgroundImageUrl}
              />
            </label>
            <button
              aria-label={labels.removeImage}
              className="activity-background-appearance__remove-image"
              onClick={onImageRemove}
              title={labels.removeImage}
              type="button"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="activity-background-appearance__image-picker">
            <input
              accept={imageAccept}
              onChange={(event) => {
                handleImageSelection(event.target.files?.[0]);
                event.target.value = "";
              }}
              type="file"
            />
            <strong>{labels.chooseImage}</strong>
          </label>
        )}

        {value.backgroundImageRef ? (
          <span className="activity-background-appearance__image-name">
            {value.backgroundImageName}
          </span>
        ) : null}
      </div> : null}
    </section>
  );
}
