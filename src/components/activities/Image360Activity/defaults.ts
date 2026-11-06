import type { Image360Hotspot } from "../../../types/project";
import { translateActive } from "../../../i18n";

export const DEFAULT_IMAGE360_ASSET = "/default-assets/image360-demo.jpg";

export const IMAGE360_BLOCK_DEFAULTS = {
  initialYaw: 0,
  initialPitch: 0,
  zoomEnabled: false,
  fullWidth: false,
  allowFullscreen: true,
  backgroundColor: "#ffffff",
  borderColor: "rgba(18, 58, 122, 0.16)",
  borderWidth: "1px",
  borderStyle: "solid",
  rounded: true,
  shadow: true
};

export function createDefaultImage360Hotspot(order: number, yaw = 0, pitch = 0): Image360Hotspot {
  return {
    id: `image360-hotspot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${order}`,
    yaw,
    pitch,
    order,
    title: translateActive("image360.pointNumber", { count: order }),
    contentHtml: "",
    color: "#123a7a"
  };
}

export function normalizeImage360Hotspots(items: Image360Hotspot[] | null | undefined): Image360Hotspot[] {
  return [...(items ?? [])]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((item, index) => ({
      ...item,
      yaw: Number.isFinite(item.yaw) ? item.yaw : 0,
      pitch: Number.isFinite(item.pitch) ? Math.max(-89, Math.min(89, item.pitch)) : 0,
      order: index + 1,
      title: item.title ?? "",
      contentHtml: item.contentHtml ?? "",
      color: item.color || "#123a7a"
    }));
}
