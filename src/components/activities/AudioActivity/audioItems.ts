import type { ActivityItem } from "../../../types/project";
import { translateActive } from "../../../i18n";

export function createDefaultAudioTrack(order: number): ActivityItem {
  return {
    id: `audio-track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${order}`,
    title: translateActive("audio.trackNumber", { count: order }),
    contentHtml: "",
    assetRefs: [],
    mediaFileName: null
  };
}

export function normalizeAudioTracks(items: ActivityItem[] | undefined): ActivityItem[] {
  const tracks = items?.length ? items : [createDefaultAudioTrack(1)];
  return tracks.map((item, index) => ({
    ...item,
    title: item.title || translateActive("audio.trackNumber", { count: index + 1 }),
    contentHtml: item.contentHtml ?? "",
    assetRefs: item.assetRefs ?? []
  }));
}
