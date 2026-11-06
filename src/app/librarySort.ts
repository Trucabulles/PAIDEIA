import { selectResourceTiles, type ResourceSort } from "../components/resources/resourceCatalog";

/** Sort lightweight library entries without opening projects or changing their contents. */
export function sortLibraryEntries<T extends { archivePath: string; title: string; updatedAt: string }>(entries: readonly T[], sort: ResourceSort, language: string): T[] {
  return selectResourceTiles(entries.map(entry => ({
    id: entry.archivePath,
    name: entry.title,
    resourceModifiedAt: Date.parse(entry.updatedAt),
    entry
  })), "", sort, language).map(item => item.entry);
}
