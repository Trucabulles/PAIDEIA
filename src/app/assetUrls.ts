import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { isDefaultSituationalDialogueCharacterAssetRef } from "../components/activities/SituationalDialogueActivity";

export function normalizeAssetPath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/$/, "");
}

export function encodeFsPath(value: string) {
  return normalizeAssetPath(value)
    .split("/")
    .map((segment, index) => {
      if (index === 0 && /^[A-Za-z]:$/.test(segment)) {
        return segment;
      }

      return encodeURIComponent(segment);
    })
    .join("/");
}

export function buildAssetPath(projectPath: string, assetRef: string) {
  if (isDefaultSituationalDialogueCharacterAssetRef(assetRef)) {
    return `/${assetRef.replace(/^[/\\]+/, "").replace(/\\/g, "/")}`;
  }

  const normalizedProjectPath = normalizeAssetPath(projectPath);
  const normalizedAssetRef = assetRef.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  return `${normalizedProjectPath}/assets/${normalizedAssetRef}`;
}

export function buildAssetUrl(projectPath: string, assetRef?: string | null) {
  if (!assetRef) {
    return null;
  }

  if (isDefaultSituationalDialogueCharacterAssetRef(assetRef)) {
    return `/${assetRef.replace(/^[/\\]+/, "").replace(/\\/g, "/")}`;
  }

  const assetPath = buildAssetPath(projectPath, assetRef);
  if (isTauri()) {
    return convertFileSrc(assetPath);
  }

  return `/@fs/${encodeFsPath(assetPath)}`;
}

export function withAssetReloadKey(url: string | null, reloadKey: number) {
  if (!url || reloadKey <= 0) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}paideiaReload=${reloadKey}`;
}

export function buildHtmlAssetBaseUrl(projectPath: string, assetRoot?: string | null) {
  if (!assetRoot) {
    return null;
  }
  const url = buildAssetUrl(projectPath, `${assetRoot.replace(/[/\\]+$/, "")}/`);
  return url && !url.endsWith("/") ? `${url}/` : url;
}
