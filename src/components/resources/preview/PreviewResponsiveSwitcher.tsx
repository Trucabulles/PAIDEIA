import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { getNextPreviewDeviceMode, getPreviewDeviceConfig, type PreviewDeviceFamily, type PreviewDeviceMode } from "./previewDevices";
import "./PreviewResponsiveSwitcher.css";
import { useI18n } from "../../../i18n/react";

type PreviewResponsiveSwitcherProps = {
  mode: PreviewDeviceMode;
  onChange: (mode: PreviewDeviceMode) => void;
};

function DesktopIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 19h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M12 16.2v2.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MobilePortraitIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="7.2" y="2.8" width="9.6" height="18.4" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 6h4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="17.7" r="0.9" fill="currentColor" />
    </svg>
  );
}

function MobileLandscapeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="2.8" y="7.2" width="18.4" height="9.6" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 10v4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="17.7" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

function TabletPortraitIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="5.6" y="2.9" width="12.8" height="18.2" rx="1.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="16.8" r="0.8" fill="currentColor" />
    </svg>
  );
}

function TabletLandscapeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="2.6" y="5.6" width="18.8" height="12.8" rx="1.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.8" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function buttonLabel(mode: PreviewDeviceMode, family: PreviewDeviceFamily, t: (key: string) => string) {
  if (family === "desktop") {
    return t("preview.device.desktop");
  }
  if (family === "mobile") {
    return mode === "mobile-landscape" ? t("preview.device.mobileLandscapePreview") : t("preview.device.mobilePortraitPreview");
  }
  return mode === "tablet-landscape" ? t("preview.device.tabletLandscapePreview") : t("preview.device.tabletPortraitPreview");
}

function feedbackLabel(mode: PreviewDeviceMode, t: (key: string) => string) {
  const config = getPreviewDeviceConfig(mode);
  if (!config.width || !config.height) {
    return t("preview.device.desktop");
  }
  return `${t(config.labelKey)} - ${config.width} x ${config.height}`;
}

export function PreviewResponsiveSwitcher({ mode, onChange }: PreviewResponsiveSwitcherProps) {
  const { t } = useI18n();
  const [badge, setBadge] = useState<string | null>(null);
  const firstRenderRef = useRef(true);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    setBadge(feedbackLabel(mode, t));
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setBadge(null);
      timeoutRef.current = null;
    }, 1600);
  }, [mode]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  const families: Array<{ family: PreviewDeviceFamily; icon: JSX.Element }> = [
    { family: "desktop", icon: <DesktopIcon /> },
    {
      family: "mobile",
      icon: mode === "mobile-landscape" ? <MobileLandscapeIcon /> : <MobilePortraitIcon />
    },
    {
      family: "tablet",
      icon: mode === "tablet-portrait" ? <TabletPortraitIcon /> : <TabletLandscapeIcon />
    }
  ];

  return (
    <div className="preview-responsive-switcher-wrap">
      <div aria-label={t("preview.device.formatsAria")} className="preview-responsive-switcher" role="group">
        {families.map(({ family, icon }) => {
          const active = family === "desktop" ? mode.startsWith("desktop") : mode.startsWith(family);
          const label = buttonLabel(mode, family, t);
          return (
            <button
              aria-label={label}
              aria-pressed={active}
              className={`preview-responsive-switcher-button ${active ? "active" : ""}`}
              key={family}
              onClick={() => onChange(getNextPreviewDeviceMode(mode, family))}
              title={label}
              type="button"
            >
              {icon}
            </button>
          );
        })}
      </div>
      {badge ? <div className="preview-responsive-switcher-badge">{badge}</div> : null}
    </div>
  );
}
