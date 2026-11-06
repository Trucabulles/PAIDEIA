export const BLOCK_DRAG_MIME = "application/x-paideia-block";
export const FAVORITE_DRAG_MIME = "application/x-paideia-favorite";
export const COLLECTION_DRAG_MIME = "application/x-paideia-collection";

export const RECENT_LESSONS_KEY = "paideia.recentLessons";
export const LEGACY_RECENT_PAIDEIA_KEY = "paideia.recentArchives";
export const ACTIVITY_FAVORITES_KEY = "paideia.activityFavorites";
export const ACTIVITY_FAVORITES_LIMIT_KEY = "paideia.activityFavorites.limit";
export const LIBRARY_PROJECT_FAVORITES_KEY = "paideia.libraryProjectFavorites";
export const LIBRARY_COLLECTION_OVERRIDES_KEY = "paideia.libraryCollectionOverrides";
export const LIBRARY_CUSTOM_COLLECTIONS_KEY = "paideia.libraryCustomCollections";
export const LIBRARY_COLLECTION_IMAGES_KEY = "paideia.libraryCollectionImages";
export const LIBRARY_COLLECTION_COLORS_KEY = "paideia.libraryCollectionColors";

export function libraryLabelTextColor(color: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return "#17284d";
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.3 ? "#17284d" : "#fff";
}
export const LIBRARY_HIDDEN_COLLECTION_TILES_KEY = "paideia.libraryHiddenCollectionTiles";

const RESERVED_LIBRARY_COLLECTIONS = new Set(["project_paideia"]);

export const MAX_RECENT_LESSONS = 10;
export const DEFAULT_ACTIVITY_FAVORITES_LIMIT = 5;
export const MAX_ACTIVITY_FAVORITES_LIMIT = 20;
export const DEFAULT_ACTIVITY_FAVORITES = [
  "rich-text",
  "image-text",
  "continue",
  "course-exit"
];

export function normalizeRecentLessonPaths(paths: string[]) {
  return paths
    .map((path) => path.trim())
    .filter((path) => path && !path.toLocaleLowerCase("en-US").endsWith(".paideia"))
    .filter((path, index, entries) => entries.indexOf(path) === index)
    .slice(0, MAX_RECENT_LESSONS);
}

export function rebasePortableLibraryPath(path: string, currentLibraryRoot: string) {
  const normalizedPath = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRoot = currentLibraryRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalizedPath || !normalizedRoot) return normalizedPath;
  const marker = "/data/library";
  const markerIndex = normalizedPath.toLocaleLowerCase("en-US").lastIndexOf(marker);
  if (markerIndex < 0) return normalizedPath;
  const suffix = normalizedPath.slice(markerIndex + marker.length);
  return `${normalizedRoot}${suffix}`;
}

export const ACTIVITY_LIBRARY_SECTIONS = [
  {
    title: "text",
    titleKey: "library.section.text",
    items: ["rich-text", "quote", "note", "header"]
  },
  {
    title: "images",
    titleKey: "library.section.images",
    items: ["image", "image-text", "image-grid", "point-of-interest"]
  },
  {
    title: "interactions",
    titleKey: "library.section.interactions",
    items: ["accordion", "flip-cards", "slides", "timeline", "tabs", "image-360"]
  },
  {
    title: "assessments",
    titleKey: "library.section.assessments",
    items: ["quiz", "question-multiple", "question-unique", "question-true-false", "question-random", "complete", "card-sort", "matching", "result-message"]
  },
  {
    title: "situational-dialogues",
    titleKey: "library.section.situationalDialogues",
    items: ["situational-dialogue", "find-elements"]
  },
  {
    title: "multimedia",
    titleKey: "library.section.multimedia",
    items: ["links-resources", "attachment", "media", "audio", "html-custom"]
  },
  {
    title: "navigation",
    titleKey: "library.section.navigation",
    items: ["continue", "course-exit", "divider", "section-marker"]
  }
] as const;

const AVAILABLE_ACTIVITY_TYPES = new Set<string>(
  ACTIVITY_LIBRARY_SECTIONS.flatMap((section) => [...section.items])
);

export function normalizeActivityFavorites(types: string[], limit: number) {
  return types
    .filter((type, index) => AVAILABLE_ACTIVITY_TYPES.has(type) && types.indexOf(type) === index)
    .slice(0, limit);
}

export function isReservedLibraryCollection(value: string) {
  return RESERVED_LIBRARY_COLLECTIONS.has(value.trim().toLocaleLowerCase("fr-FR"));
}

export function libraryCoverTone(title: string) {
  const palette = [
    ["#0f2450", "#123a7a", "#6ba5ff"],
    ["#123a7a", "#1c5bb5", "#8bb9ff"],
    ["#15396b", "#265b91", "#87aedd"],
    ["#17304f", "#315f87", "#8db8d9"],
    ["#102947", "#3d6aa1", "#aac2eb"]
  ] as const;
  const index = Array.from(title).reduce((total, character) => total + character.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

export function libraryFilterEmptyMessageKey(labels: readonly string[], keywords: readonly string[], search: string): string | null {
  const hasSearch = Boolean(search.trim());
  if (labels.length === 1 && !keywords.length && !hasSearch) return "library.noLessonForLabel";
  if (keywords.length === 1 && !labels.length && !hasSearch) return "library.noLessonForKeyword";
  return labels.length || keywords.length || hasSearch ? "library.noLessonForFilters" : null;
}
