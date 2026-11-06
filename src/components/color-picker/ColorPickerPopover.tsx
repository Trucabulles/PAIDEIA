import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { SYSTEM_COLOR_PALETTE } from "./colorPalette";
import { hexToRgb, normalizeHex, rgbToHex } from "./colorUtils";
import { canPickScreenColorNatively, pickScreenColorNatively } from "../../lib/screenColor";
import "./ColorPickerPopover.css";
import { useI18n } from "../../i18n/react";
import { addPaletteColor, loadPalettes, normalizePalettes, PALETTES_KEY, type CustomPalettes } from './customPalettes';
import { HsvSelector } from './HsvSelector';
import { createRichColorPreview } from './richColorPreview';

const NEUTRAL_TRIGGER_COLOR = "#FFFFFF";
const RGB_CHANNEL_LABELS = { r: "R", g: "V", b: "B" } as const;
const RICH_TEXT_COLOR_SELECTION_HIGHLIGHT = "paideia-rich-text-color-selection";
const RICH_TEXT_COLOR_SELECTION_STYLE_ID = "paideia-rich-text-color-selection-style";

type HighlightRegistryLike = {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => boolean;
};

type HighlightConstructorLike = new (...ranges: Range[]) => unknown;

function richTextColorHighlightRegistry() {
  return (CSS as typeof CSS & { highlights?: HighlightRegistryLike }).highlights;
}

function richTextColorHighlightConstructor() {
  return (globalThis as typeof globalThis & { Highlight?: HighlightConstructorLike }).Highlight;
}

function ensureRichTextColorSelectionStyle() {
  if (document.getElementById(RICH_TEXT_COLOR_SELECTION_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = RICH_TEXT_COLOR_SELECTION_STYLE_ID;
  style.textContent = `::highlight(${RICH_TEXT_COLOR_SELECTION_HIGHLIGHT}) { background: rgba(37, 107, 220, 0.22); }`;
  document.head.appendChild(style);
}

function holdCurrentRichTextSelectionVisually() {
  const registry = richTextColorHighlightRegistry();
  const HighlightConstructor = richTextColorHighlightConstructor();
  const selection = window.getSelection();
  if (!registry || !HighlightConstructor || !selection || selection.rangeCount === 0) {
    return;
  }
  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return;
  }
  ensureRichTextColorSelectionStyle();
  registry.set(RICH_TEXT_COLOR_SELECTION_HIGHLIGHT, new HighlightConstructor(range.cloneRange()));
}

function releaseHeldRichTextSelectionVisually() {
  richTextColorHighlightRegistry()?.delete(RICH_TEXT_COLOR_SELECTION_HIGHLIGHT);
}

function normalizeColorPickerValue(value: string, allowTransparent: boolean) {
  const trimmedValue = value.trim();
  if (allowTransparent && (!trimmedValue || trimmedValue.toLowerCase() === "transparent")) {
    return "transparent";
  }
  return normalizeHex(trimmedValue) ?? NEUTRAL_TRIGGER_COLOR;
}

const COLOR_PICKER_EXCLUSIVE_OPEN_EVENT = "paideia:color-picker-exclusive-open";
const COLOR_PICKER_VIEWPORT_MARGIN = 12;
const COLOR_PICKER_AVOID_GAP = 12;
const LAST_APPLIED_COLORS = new Map<string, string>();

type ColorPickerFloatingStyle = CSSProperties & {
  visibility?: "hidden" | "visible";
};

function clampColorPickerPosition(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}


type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

type ColorPickerPopoverProps = {
  allowTransparent?: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onBeforePick?: () => void;
  onPreview?: (value: string) => void;
  onFinishPreview?: () => void;
  placement?: "above" | "below";
  pickScreenColor?: () => Promise<string | null>;
  anchorElement?: HTMLElement | null;
  avoidElement?: HTMLElement | null;
  positioning?: "contextual" | "lesson-options";
};

type ColorPickerFieldProps = {
  allowTransparent?: boolean;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  onBeforeOpen?: () => void;
  pickScreenColor?: () => Promise<string | null>;
  triggerVariant?: "swatch" | "font-color" | "highlight" | "field-fill";
  exclusiveGroup?: string;
  positioning?: "contextual" | "lesson-options";
  splitApply?: boolean;
  rememberedColorKey?: string;
};

function isSystemPaletteColor(value: string) {
  const normalized = normalizeHex(value);
  if (!normalized) {
    return false;
  }
  return SYSTEM_COLOR_PALETTE.some(
    (family) => family.base === normalized || family.shades.some((shade) => shade === normalized)
  );
}

function familyForColor(value: string) {
  const normalized = normalizeHex(value);
  return (
    SYSTEM_COLOR_PALETTE.find(
      (family) => family.base === normalized || family.shades.some((shade) => shade === normalized)
    ) ?? SYSTEM_COLOR_PALETTE[5]
  );
}

export function ColorPickerPopover({
  allowTransparent = false,
  value,
  onChange,
  onClose,
  onBeforePick,
  onPreview,
  onFinishPreview,
  placement = "below",
  pickScreenColor,
  anchorElement,
  avoidElement,
  positioning = "contextual"
}: ColorPickerPopoverProps) {
  const { t } = useI18n();
  const isTransparent = normalizeColorPickerValue(value, allowTransparent) === "transparent";
  const normalizedValue = normalizeHex(value) ?? NEUTRAL_TRIGGER_COLOR;
  const [selectedFamilyId, setSelectedFamilyId] = useState(() => familyForColor(normalizedValue).id);
  const [hexDraft, setHexDraft] = useState(normalizedValue);
  const [rgbDraft, setRgbDraft] = useState(() => {
    const initialRgb = hexToRgb(normalizedValue) ?? { r: 255, g: 255, b: 255 };
    return { r: String(initialRgb.r), g: String(initialRgb.g), b: String(initialRgb.b) };
  });
  const defaultPaletteName = t("color.myPalette");
  const [palettes, setPalettes] = useState(() => loadPalettes(localStorage, defaultPaletteName));
  const activePalette = palettes.palettes.find(palette => palette.id === palettes.activePaletteId)!;
  const customColors = activePalette.colors;
  const [hsvMode, setHsvMode] = useState(false);
  const [paletteAction, setPaletteAction] = useState<'create' | 'rename' | 'delete' | null>(null);
  const [paletteName, setPaletteName] = useState('');
  const [paletteMenu, setPaletteMenu] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const changePalettes = (next: CustomPalettes) => {
    setPalettes(next);
    try { localStorage.setItem(PALETTES_KEY, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  };
  const savePaletteName = () => {
    const name = paletteName.trim().slice(0, 40);
    if (!name) return;
    if (paletteAction === 'create') {
      const id = crypto.randomUUID();
      changePalettes({ ...palettes, activePaletteId: id, palettes: [...palettes.palettes, { id, name, colors: [] }] });
    } else changePalettes({ ...palettes, palettes: palettes.palettes.map(p => p.id === activePalette.id ? { ...p, name } : p) });
    setPaletteAction(null);
  };
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [floatingStyle, setFloatingStyle] = useState<ColorPickerFloatingStyle>({
    position: "fixed",
    left: 0,
    top: 0,
    visibility: "hidden",
    zIndex: 720
  });
  const isPickingRef = useRef(false);
  const isEditingColorValueRef = useRef(false);
  const activeColorValueInputRef = useRef<"hex" | "rgb" | null>(null);
  const selectedFamily =
    SYSTEM_COLOR_PALETTE.find((family) => family.id === selectedFamilyId) ?? SYSTEM_COLOR_PALETTE[0];
  useEffect(() => {
    if (isEditingColorValueRef.current) {
      return;
    }
    const nextRgb = hexToRgb(normalizedValue) ?? { r: 255, g: 255, b: 255 };
    setHexDraft(normalizedValue);
    setRgbDraft({ r: String(nextRgb.r), g: String(nextRgb.g), b: String(nextRgb.b) });
    setSelectedFamilyId(familyForColor(normalizedValue).id);
  }, [normalizedValue]);

  useLayoutEffect(() => {
    const popover = rootRef.current;
    if (!popover || !anchorElement) {
      return;
    }

    let stickyPosition: { left: number; top: number } | null = null;
    let stickySide: "left" | "right" | null = null;
    const placePopover = () => {
      const root = rootRef.current;
      if (!root || !anchorElement?.isConnected) {
        return;
      }

      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const margin = COLOR_PICKER_VIEWPORT_MARGIN;
      const gap = COLOR_PICKER_AVOID_GAP;

      const computedStyle = window.getComputedStyle(root);
      const horizontalBorder =
        (Number.parseFloat(computedStyle.borderLeftWidth) || 0) +
        (Number.parseFloat(computedStyle.borderRightWidth) || 0);
      const verticalBorder =
        (Number.parseFloat(computedStyle.borderTopWidth) || 0) +
        (Number.parseFloat(computedStyle.borderBottomWidth) || 0);

      // The popover has a fixed intrinsic size. It must never be compressed,
      // scaled or turned into a scroll container.
      const desiredWidth = Math.max(root.scrollWidth + horizontalBorder, 1);
      const desiredHeight = Math.max(root.scrollHeight + verticalBorder, 1);
      const anchorRect = anchorElement.getBoundingClientRect();
      const avoidRect = avoidElement?.isConnected ? avoidElement.getBoundingClientRect() : null;

      const viewportMinLeft = viewportLeft + margin;
      const viewportMaxLeft = Math.max(viewportMinLeft, viewportRight - margin - desiredWidth);
      const viewportMinTop = viewportTop + margin;
      const viewportMaxTop = Math.max(viewportMinTop, viewportBottom - margin - desiredHeight);

      // Activity pickers keep their viewport position throughout lesson scrolling.
      // Re-evaluate geometry only on viewport resize, retaining the chosen side.
      let left: number;
      let top: number;
      if (positioning !== "lesson-options" && avoidRect) {
        if (!stickyPosition) {
          const rightSpace = viewportRight - margin - avoidRect.right - gap;
          const leftSpace = avoidRect.left - gap - viewportMinLeft;
          // Prefer the right, allowing limited overlap before using the left lane.
          stickySide ??= rightSpace >= desiredWidth * 0.7 || leftSpace < desiredWidth ? "right" : "left";
          stickyPosition = {
            left: stickySide === "right" ? avoidRect.right + gap : avoidRect.left - gap - desiredWidth,
            top: anchorRect.top
          };
        }
        left = stickyPosition.left;
        top = stickyPosition.top;
      } else if (positioning === "lesson-options") {
        const right = anchorRect.right + 25;
        const leftAlternative = anchorRect.left - 25 - desiredWidth;
        left = right + desiredWidth <= viewportRight - margin
          ? right
          : leftAlternative >= viewportMinLeft ? leftAlternative : right;
        top = anchorRect.top;
      } else {
        left = anchorRect.left;
        top = placement === "above"
          ? anchorRect.top - desiredHeight - gap
          : anchorRect.bottom + gap;
      }

      left = clampColorPickerPosition(left, viewportMinLeft, viewportMaxLeft);
      top = clampColorPickerPosition(top, viewportMinTop, viewportMaxTop);

      setFloatingStyle({
        position: "fixed",
        left,
        top,
        width: desiredWidth,
        minWidth: desiredWidth,
        maxWidth: desiredWidth,
        height: "auto",
        minHeight: "max-content",
        maxHeight: "none",
        overflow: "visible",
        boxSizing: "border-box",
        transform: "none",
        transformOrigin: "top left",
        right: "auto",
        bottom: "auto",
        visibility: "visible",
        zIndex: 720
      });
    };

    placePopover();
    const resizeViewport = () => {
      stickyPosition = null;
      placePopover();
    };
    const observer = new ResizeObserver(placePopover);
    observer.observe(popover);
    window.addEventListener("resize", resizeViewport);
    window.addEventListener("scroll", placePopover, true);
    window.visualViewport?.addEventListener("resize", resizeViewport);
    window.visualViewport?.addEventListener("scroll", placePopover);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeViewport);
      window.removeEventListener("scroll", placePopover, true);
      window.visualViewport?.removeEventListener("resize", resizeViewport);
      window.visualViewport?.removeEventListener("scroll", placePopover);
    };
  }, [anchorElement, avoidElement, placement, positioning]);

  useEffect(() => {
    return () => releaseHeldRichTextSelectionVisually();
  }, []);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (isPickingRef.current) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!rootRef.current?.contains(target)) {
        isEditingColorValueRef.current = false;
        activeColorValueInputRef.current = null;
        releaseHeldRichTextSelectionVisually();
        onClose();
      }
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [onClose]);

  const storeCustomColor = (nextValue: string) => {
    const next = addPaletteColor(palettes, nextValue);
    if (next !== palettes) changePalettes(next);
  };

  const applyColor = (nextValue: string) => {
    const normalized = normalizeHex(nextValue);
    if (!normalized) {
      return;
    }
    setHexDraft(normalized);
    const rgb = hexToRgb(normalized)!;
    setRgbDraft({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });
    storeCustomColor(normalized);
    onChange(normalized);
  };

  const applyTransparent = () => {
    if (!allowTransparent) {
      return;
    }
    onChange("transparent");
  };

  const updateRgbDraftChannel = (channel: "r" | "g" | "b", rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, "").slice(0, 3);
    setRgbDraft((current) => ({ ...current, [channel]: digitsOnly }));
  };

  const applyRgbDraft = () => {
    const channels = (["r", "g", "b"] as const).map((channel) => {
      const raw = rgbDraft[channel].trim();
      if (!raw) {
        return null;
      }
      return Math.max(0, Math.min(255, Number(raw)));
    });
    if (channels.some((channel) => channel === null || !Number.isFinite(channel))) {
      return;
    }
    const hex = rgbToHex(channels[0] as number, channels[1] as number, channels[2] as number);
    if (hex) {
      applyColor(hex);
    }
  };

  const beginEditableColorInput = (kind: "hex" | "rgb") => {
    if (!isEditingColorValueRef.current) {
      onBeforePick?.();
      holdCurrentRichTextSelectionVisually();
    }
    isEditingColorValueRef.current = true;
    activeColorValueInputRef.current = kind;
  };

  const finishEditableColorInput = (nextTarget: EventTarget | null) => {
    if (
      nextTarget instanceof HTMLElement &&
      nextTarget.closest("[data-paideia-color-value-input='true']")
    ) {
      return false;
    }

    isEditingColorValueRef.current = false;
    activeColorValueInputRef.current = null;
    window.setTimeout(() => releaseHeldRichTextSelectionVisually(), 0);
    return true;
  };

  const releasePickingLock = () => {
    window.requestAnimationFrame(() => {
      isPickingRef.current = false;
    });
  };


  const applyPickedColor = (nextValue: string) => {
    window.requestAnimationFrame(() => {
      applyColor(nextValue);
      releasePickingLock();
    });
  };

  const pickColor = async () => {
    let pickedColor = false;
    try {
      isPickingRef.current = true;
      onBeforePick?.();
      if (pickScreenColor) {
        const picked = await pickScreenColor();
        if (picked) {
          pickedColor = true;
          applyPickedColor(picked);
        }
        return;
      }
      if (canPickScreenColorNatively()) {
        const picked = await pickScreenColorNatively();
        if (picked) {
          pickedColor = true;
          applyPickedColor(picked);
        }
        return;
      }
      const EyeDropper = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
      if (EyeDropper) {
        const result = await new EyeDropper().open();
        pickedColor = true;
        applyPickedColor(result.sRGBHex);
      }
    } catch {
      // The operating system picker can be cancelled without changing the color.
    } finally {
      if (!pickedColor) {
        releasePickingLock();
      }
    }
  };

  return (
    <div
      className={`paideia-color-popover ${placement === "above" ? "above" : ""}`}
      data-paideia-color-popover="true"
      data-rich-text-toolbar="true"
      ref={rootRef}
      style={floatingStyle}
      onPointerDownCapture={event => {
        if (!paletteMenu || !(event.target instanceof Element)) return;
        if (event.target.closest('.paideia-palette-menu, [data-paideia-palette-menu-trigger="true"]')) return;
        setPaletteMenu(false);
      }}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (paletteAction || paletteMenu) { setPaletteAction(null); setPaletteMenu(false); } else onClose(); } }}
    >
      <div className="paideia-color-heading">
        <strong>{t("color.colors")}</strong>
        {allowTransparent ? (
          <button
            aria-label={t("common.none", undefined, "Sans")}
            aria-pressed={isTransparent}
            className={`paideia-color-none-swatch${isTransparent ? " selected" : ""}`}
            onClick={applyTransparent}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.preventDefault();
              onBeforePick?.();
            }}
            title={t("common.none", undefined, "Sans")}
            type="button"
          />
        ) : null}
      </div>
      <div className="paideia-color-mode-area">
      {hsvMode ? <HsvSelector value={normalizedValue} onBeforePick={onBeforePick} onChange={color => {
        setHexDraft(color);
        const rgb = hexToRgb(color)!;
        setRgbDraft({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });
        (onPreview ?? onChange)(color);
      }} /> : <>
      <div className="paideia-color-family-grid">
        {SYSTEM_COLOR_PALETTE.map((family) => (
          <button
            aria-label={t(family.labelKey)}
            className={
              !isTransparent &&
              isSystemPaletteColor(normalizedValue) &&
              family.id === selectedFamilyId
                ? "selected"
                : ""
            }
            key={family.id}
            onClick={() => {
              setSelectedFamilyId(family.id);
              applyColor(family.base);
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              onBeforePick?.();
            }}
            onMouseDown={(event) => event.preventDefault()}
            style={{ backgroundColor: family.base }}
            title={t(family.labelKey)}
            type="button"
          />
        ))}
      </div>

      <strong>{t("color.shades")}</strong>
      <div className="paideia-color-shade-grid">
        {selectedFamily.shades.map((shade) => (
          <button
            aria-label={`${t(selectedFamily.labelKey)} ${shade}`}
            className={!isTransparent && shade === normalizedValue ? "selected" : ""}
            key={shade}
            onClick={() => applyColor(shade)}
            onPointerDown={(event) => {
              event.preventDefault();
              onBeforePick?.();
            }}
            onMouseDown={(event) => event.preventDefault()}
            style={{ backgroundColor: shade }}
            type="button"
          />
        ))}
      </div>

      </>}
      </div>
      <div className="paideia-color-inputs">
        <label>
          <span>HEX</span>
          <input
            data-paideia-color-value-input="true"
            disabled={isTransparent}
            onPointerDown={() => beginEditableColorInput("hex")}
            onBlur={(event) => {
              if (finishEditableColorInput(event.relatedTarget)) {
                applyColor(hexDraft);
              }
            }}
            onChange={(event) => setHexDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyColor(hexDraft);
                isEditingColorValueRef.current = false;
                activeColorValueInputRef.current = null;
                releaseHeldRichTextSelectionVisually();
                event.currentTarget.blur();
              }
            }}
            value={hexDraft}
          />
        </label>
        <div className="paideia-rgb-group"><span>RGB</span><div className="paideia-rgb-inputs">
          {(["r", "g", "b"] as const).map((channel) => (
            <label key={channel}>
              <input
                data-paideia-color-value-input="true"
                aria-label={RGB_CHANNEL_LABELS[channel]}
                title={RGB_CHANNEL_LABELS[channel]}
                disabled={isTransparent}
                inputMode="numeric"
                onPointerDown={() => beginEditableColorInput("rgb")}
                onBlur={(event) => {
                  if (finishEditableColorInput(event.relatedTarget)) {
                    applyRgbDraft();
                  }
                }}
                onChange={(event) => updateRgbDraftChannel(channel, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyRgbDraft();
                    isEditingColorValueRef.current = false;
                    activeColorValueInputRef.current = null;
                    releaseHeldRichTextSelectionVisually();
                    event.currentTarget.blur();
                  }
                }}
                type="text"
                value={rgbDraft[channel]}
              />
            </label>
          ))}
        </div></div>
      </div>

      <div className="paideia-color-actions">
        <button
          aria-label={t("color.pickFromScreen")}
          onClick={() => void pickColor()}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onBeforePick?.();
          }}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
          title={t("color.pickFromScreen")}
        >
          <span aria-hidden="true" className="paideia-color-dropper-icon" />
        </button>
        <button type="button" title={t("color.picker.hsvSelector")} aria-label={t("color.picker.hsvSelector")} aria-pressed={hsvMode}
          onMouseDown={event => event.preventDefault()}
          onClick={() => { onFinishPreview?.(); setHsvMode(!hsvMode); }}>
          <span className="paideia-hsv-icon" aria-hidden="true" />
        </button>
        {hsvMode ? <>
          <span className="paideia-hsv-current" title={normalizedValue} style={{ backgroundColor: isTransparent ? 'transparent' : normalizedValue }} />
          <button type="button" aria-label={t("color.picker.addCurrentToPalette")} title={customColors.length >= 7 ? t("color.picker.paletteFull", { max: 7 }) : t("color.picker.addCurrentToPalette")}
            disabled={isTransparent || customColors.length >= 7 || customColors.includes(normalizedValue) || isSystemPaletteColor(normalizedValue)}
            onMouseDown={event => event.preventDefault()} onClick={() => storeCustomColor(normalizedValue)}>
			<svg
  viewBox="0 0 16 16"
  width="14"
  height="14"
  aria-hidden="true"
>
  <path
    d="M8 3v10M3 8h10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  />
</svg>
	</button>
        </> : null}
      </div>

        <div className="paideia-palette-panel">
          <div className="paideia-palette-heading">
            {paletteAction === 'create' || paletteAction === 'rename' ? <>
              <input autoFocus maxLength={40} aria-label={t("color.picker.paletteName")} value={paletteName} onChange={event => setPaletteName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); savePaletteName(); } }} />
              <button type="button" aria-label={t("color.picker.validatePaletteName")} disabled={!paletteName.trim()} onClick={savePaletteName}>✓</button>
              <button type="button" aria-label={t("common.cancel")} onClick={() => setPaletteAction(null)}>×</button>
            </> : paletteAction === 'delete' ? <>
              <span title={activePalette.name}>{t("color.picker.deletePaletteQuestion")}</span>
              <button type="button" aria-label={t("color.picker.confirmPaletteDelete")} onClick={() => { changePalettes(normalizePalettes({ ...palettes, palettes: palettes.palettes.filter(p => p.id !== activePalette.id) }, defaultPaletteName)); setPaletteAction(null); }}>✓</button>
              <button type="button" aria-label={t("common.cancel")} onClick={() => setPaletteAction(null)}>×</button>
            </> : <>
              <select aria-label={t("color.picker.activePalette")} title={activePalette.name} value={activePalette.id} onChange={event => changePalettes({ ...palettes, activePaletteId: event.target.value })}>
                {palettes.palettes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="button" aria-label={t("color.picker.createPalette")} title={t("color.picker.createPalette")} onClick={() => { onBeforePick?.(); holdCurrentRichTextSelectionVisually(); setPaletteName(''); setPaletteAction('create'); setPaletteMenu(false); }}>
			  <svg
  viewBox="0 0 16 16"
  width="14"
  height="14"
  aria-hidden="true"
>
  <path
    d="M8 3v10M3 8h10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  />
</svg>
			  </button>
              <button type="button" aria-label={t("color.picker.managePalette")} title={t("color.picker.managePalette")} aria-expanded={paletteMenu} data-paideia-palette-menu-trigger="true" onClick={() => setPaletteMenu(!paletteMenu)}>⋯</button>
            </>}
            {paletteMenu ? <div className="paideia-palette-menu">
              <button type="button" onClick={() => { onBeforePick?.(); holdCurrentRichTextSelectionVisually(); setPaletteName(activePalette.name); setPaletteAction('rename'); setPaletteMenu(false); }}>{t("common.rename")}</button>
              <button type="button" onClick={() => { setPaletteAction('delete'); setPaletteMenu(false); }}>{t("common.delete")}</button>
            </div> : null}
          </div>
          <div className="paideia-custom-color-grid">
            {customColors.map((color) => (
              <button
                aria-label={color}
                className={!isTransparent && color === normalizedValue ? "selected" : ""}
                key={color}
                onClick={() => applyColor(color)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onBeforePick?.();
                }}
                onMouseDown={(event) => event.preventDefault()}
                onContextMenu={(event) => {
                  event.preventDefault();
                  const next = customColors.filter((item) => item !== color);
                  changePalettes({ ...palettes, palettes: palettes.palettes.map(p => p.id === activePalette.id ? { ...p, colors: next } : p) });
                }}
                onKeyDown={event => { if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); changePalettes({ ...palettes, palettes: palettes.palettes.map(p => p.id === activePalette.id ? { ...p, colors: p.colors.filter(c => c !== color) } : p) }); } }}
                style={{ backgroundColor: color }}
                title={`${color} — ${t("common.delete")}`}
                type="button"
              />
            ))}
            {Array.from({ length: 7 - customColors.length }, (_, index) => <span className="paideia-palette-empty" key={`empty-${index}`} />)}
          </div>
          {storageError ? <span role="alert" className="paideia-palette-storage-error">{t("color.picker.storageError")}</span> : null}
        </div>
    </div>
  );
}

export function ColorPickerField({
  allowTransparent = false,
  value,
  onChange,
  ariaLabel,
  className = "",
  onBeforeOpen,
  pickScreenColor,
  triggerVariant = "swatch",
  exclusiveGroup,
  positioning = "contextual",
  splitApply = false,
  rememberedColorKey
}: ColorPickerFieldProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState<"above" | "below">("below");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const fieldRef = useRef<HTMLSpanElement | null>(null);
  const fieldIdRef = useRef(`color-picker-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const pendingLocalValueRef = useRef<string | null>(null);
  const pendingLocalValueReleaseRef = useRef<number | null>(null);
  const normalizedPropValue = normalizeColorPickerValue(value, allowTransparent);
  const initialRememberedValue = rememberedColorKey
    ? LAST_APPLIED_COLORS.get(rememberedColorKey)
    : undefined;
  const splitFallbackValue = normalizeHex(initialRememberedValue ?? "")
    ?? normalizeHex(normalizedPropValue)
    ?? (triggerVariant === "highlight" ? "#FFF19C" : NEUTRAL_TRIGGER_COLOR);
  const [localValue, setLocalValue] = useState(splitApply ? splitFallbackValue : normalizedPropValue);
  const selectionRef = useRef<Range | null>(null);
  const previewRef = useRef<ReturnType<typeof createRichColorPreview>>(null);
  const previewValueRef = useRef<string | null>(null);
  const previewInitialRef = useRef<string | null>(null);
  const changeRef = useRef(onChange); changeRef.current = onChange;
  const finishPreview = () => {
    const color = previewValueRef.current;
    const initial = previewInitialRef.current;
    const preview = previewRef.current;
    previewRef.current = null; previewValueRef.current = null; previewInitialRef.current = null;
    preview?.finish();
    if (preview && color && color !== initial) {
      const normalizedColor = normalizeHex(color);
      if (splitApply && rememberedColorKey && normalizedColor) {
        LAST_APPLIED_COLORS.set(rememberedColorKey, normalizedColor);
        setLocalValue(normalizedColor);
      }
      changeRef.current(color);
    }
    const selection = window.getSelection();
    if (selection?.rangeCount) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };
  const finishRef = useRef(finishPreview); finishRef.current = finishPreview;
  useEffect(() => () => finishRef.current(), []);

  useEffect(() => {
    const closeWhenPeerOpens = (event: Event) => {
      const detail = (event as CustomEvent<{ group?: string; fieldId?: string }>).detail;
      if (
        detail?.fieldId &&
        detail.fieldId !== fieldIdRef.current
      ) {
        finishRef.current();
        releaseHeldRichTextSelectionVisually();
        setIsOpen(false);
        pendingLocalValueRef.current = null;
      }
    };

    window.addEventListener(COLOR_PICKER_EXCLUSIVE_OPEN_EVENT, closeWhenPeerOpens);
    return () => window.removeEventListener(COLOR_PICKER_EXCLUSIVE_OPEN_EVENT, closeWhenPeerOpens);
  }, []);

  useEffect(() => {
    // While the popover is open, its local value is authoritative. Applying a
    // RichText color temporarily changes focus/selection state and the parent can
    // emit a stale/default color before it recomputes the real selected color.
    // Do not let that transient parent value reset the open picker.
    if (isOpen) {
      return;
    }

    pendingLocalValueRef.current = null;
    if (pendingLocalValueReleaseRef.current !== null) {
      window.clearTimeout(pendingLocalValueReleaseRef.current);
      pendingLocalValueReleaseRef.current = null;
    }
    if (!splitApply) {
      setLocalValue(normalizedPropValue);
    }
  }, [isOpen, normalizedPropValue, splitApply]);

  useEffect(() => {
    return () => {
      if (pendingLocalValueReleaseRef.current !== null) {
        window.clearTimeout(pendingLocalValueReleaseRef.current);
      }
    };
  }, []);

  const isTransparent = allowTransparent && localValue.trim().toLowerCase() === "transparent";
  const normalizedValue = isTransparent
    ? "transparent"
    : normalizeHex(localValue) ?? normalizedPropValue;

  const handleChange = (nextValue: string) => {
    finishPreview();
    const normalizedNextValue = normalizeHex(nextValue) ?? nextValue;

    // "Sans" removes highlighting from the content but does not replace the
    // last usable color displayed by the split apply button.
    if (splitApply && normalizedNextValue === "transparent") {
      onChange(normalizedNextValue);
      return;
    }

    // Keep the value chosen inside an open popover authoritative while the parent
    // RichText selection state catches up. The parent can briefly emit the default
    // color during selection restoration; accepting that transient value makes the
    // open popover flash/reset to white even though the chosen color was applied.
    pendingLocalValueRef.current = normalizedNextValue;
    if (pendingLocalValueReleaseRef.current !== null) {
      window.clearTimeout(pendingLocalValueReleaseRef.current);
    }
    pendingLocalValueReleaseRef.current = window.setTimeout(() => {
      pendingLocalValueRef.current = null;
      pendingLocalValueReleaseRef.current = null;
    }, 250);

    setLocalValue(normalizedNextValue);
    if (splitApply && rememberedColorKey) {
      const rememberedValue = normalizeHex(normalizedNextValue);
      if (rememberedValue) {
        LAST_APPLIED_COLORS.set(rememberedColorKey, rememberedValue);
      }
    }
    onChange(normalizedNextValue);
    const selection = window.getSelection();
    if (selection?.rangeCount) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const togglePopover = () => {
    if (!isOpen) {
      const selection = window.getSelection();
      selectionRef.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const rect = triggerRef.current?.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const estimatedPopoverHeight = 390;
      const shouldOpenAbove =
        rect ? rect.bottom + estimatedPopoverHeight > viewportHeight && rect.top > estimatedPopoverHeight : false;

      // Standard fields open on their current value. Split RichText controls
      // deliberately keep their last applied color instead of following the
      // formatting under the caret.
      if (!splitApply) {
        setLocalValue(normalizedPropValue);
      }
      setPopoverPlacement(shouldOpenAbove ? "above" : "below");
      window.dispatchEvent(
        new CustomEvent(COLOR_PICKER_EXCLUSIVE_OPEN_EVENT, {
          detail: { group: exclusiveGroup, fieldId: fieldIdRef.current }
        })
      );
      setIsOpen(true);
      return;
    }

    finishPreview();
    releaseHeldRichTextSelectionVisually();
    setIsOpen(false);
  };

  const handleTriggerClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    // A ColorPickerField is often rendered inside a visual <label>. Browsers
    // synthesize a click on the nested button when the label text is clicked.
    // Ignore that delegated click when its pointer coordinates are outside the
    // actual color icon. Keyboard and assistive-technology clicks use 0/0 and
    // remain supported.
    if (event.clientX !== 0 || event.clientY !== 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      const clickedInsideIcon =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!clickedInsideIcon) {
        return;
      }
    }
    togglePopover();
  };

  const applyRememberedColor = () => {
    const normalizedRememberedValue = normalizeHex(localValue) ?? splitFallbackValue;
    if (rememberedColorKey) {
      LAST_APPLIED_COLORS.set(rememberedColorKey, normalizedRememberedValue);
    }
    setLocalValue(normalizedRememberedValue);
    onChange(normalizedRememberedValue);
    const selection = window.getSelection();
    if (selection?.rangeCount) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const triggerContents = (
    <>
      {triggerVariant === "font-color" ? <span aria-hidden="true" className="rich-color-trigger-glyph">A</span> : null}
      {triggerVariant === "highlight" ? <span aria-hidden="true" className="rich-color-trigger-glyph highlight-glyph">ab</span> : null}
      {triggerVariant === "field-fill" ? (
        <svg aria-hidden="true" className="rich-fill-trigger-glyph" viewBox="0 0 24 24">
          <path d="m5.3 10.4 6.1-6.1 7 7-6.2 6.2a2 2 0 0 1-2.8 0l-4.1-4.2a2 2 0 0 1 0-2.9Z" />
          <path d="m5 5 7.1 7.1" />
          <path className="rich-fill-trigger-drop" d="M20.4 16.7c0 1.4-1 2.5-2.3 2.5s-2.3-1.1-2.3-2.5c0-1.1 1.5-3.1 2.3-4.1.8 1 2.3 3 2.3 4.1Z" />
        </svg>
      ) : null}
    </>
  );

  return (
    <span className={`paideia-color-field ${splitApply ? "paideia-color-field--split" : ""} ${className}`} data-rich-text-toolbar="true" ref={fieldRef}>
      {splitApply ? (
        <>
          <button
            aria-label={`${ariaLabel} : ${localValue}`}
            className={`paideia-color-trigger paideia-color-trigger--apply ${triggerVariant !== "swatch" ? `rich-color-trigger ${triggerVariant}` : ""}`}
            onClick={applyRememberedColor}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onBeforeOpen?.();
            }}
            style={triggerVariant === "swatch"
              ? { backgroundColor: localValue }
              : ({ "--rich-trigger-color": localValue } as CSSProperties)}
            title={`${ariaLabel} : ${localValue}`}
            type="button"
          >
            {triggerContents}
          </button>
          <button
            aria-expanded={isOpen}
            aria-label={`${ariaLabel} — ${t("common.choose", undefined, "Choisir")}`}
            className="paideia-color-trigger-picker"
            ref={triggerRef}
            onClick={handleTriggerClick}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onBeforeOpen?.();
            }}
            title={`${ariaLabel} — ${t("common.choose", undefined, "Choisir")}`}
            type="button"
          />
        </>
      ) : (
        <button
          aria-label={ariaLabel}
          className={`paideia-color-trigger ${isTransparent ? "transparent" : ""} ${triggerVariant !== "swatch" ? `rich-color-trigger ${triggerVariant}` : ""}`}
          ref={triggerRef}
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onBeforeOpen?.();
          }}
          onClick={handleTriggerClick}
          style={triggerVariant === "swatch"
            ? { backgroundColor: normalizedValue }
            : ({ "--rich-trigger-color": normalizedValue } as CSSProperties)}
          title={`${ariaLabel} : ${isTransparent ? t("common.none", undefined, "Sans") : normalizedValue}`}
          type="button"
        >
          {triggerContents}
        </button>
      )}
      {isOpen
        ? createPortal(
            <ColorPickerPopover
              allowTransparent={allowTransparent}
              anchorElement={fieldRef.current}
              positioning={positioning}
              avoidElement={
                triggerRef.current?.closest(".rich-toolbar")
                  ? (
                      triggerRef.current
                        ?.closest(".inline-rich-text-wrapper.active")
                        ?.querySelector<HTMLElement>(".inline-rich-text-field.active") ??
                      document.querySelector<HTMLElement>(".inline-rich-text-field.active")
                    )
                  : null
              }
              onBeforePick={onBeforeOpen}
              onChange={handleChange}
              onPreview={color => {
                if (previewValueRef.current === null) {
                  previewInitialRef.current = localValue;
                  previewRef.current = createRichColorPreview(triggerRef.current, selectionRef.current, triggerVariant);
                }
                previewValueRef.current = color;
                setLocalValue(color);
                if (previewRef.current) previewRef.current.update(color);
                else onChange(color);
              }}
              onFinishPreview={finishPreview}
              onClose={() => {
                finishPreview();
                releaseHeldRichTextSelectionVisually();
                setIsOpen(false);
                pendingLocalValueRef.current = null;
              }}
              placement={popoverPlacement}
              pickScreenColor={pickScreenColor}
              value={normalizedValue}
            />,
            document.body
          )
        : null}
    </span>
  );
}
