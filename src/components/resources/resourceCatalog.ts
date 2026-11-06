export type ResourceSort = "name-asc" | "name-desc" | "recent" | "oldest";
export type ResourceSummary = { id: string; name: string; resourceModifiedAt?: number | null };
export const resourceSortModes: ResourceSort[] = ["name-asc", "name-desc", "recent", "oldest"];
export function normalizeResourceName(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
}
/** Operates on descriptors only; never loads or mutates bank contents. */
export function selectResourceTiles<T extends ResourceSummary>(items: readonly T[], query: string, sort: ResourceSort, language: string): T[] {
  const search = normalizeResourceName(query);
  const collator = new Intl.Collator(language, { sensitivity: "base", numeric: true });
  const byName = (a: T, b: T) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
  return items.filter(item => normalizeResourceName(item.name).includes(search)).sort((a, b) => {
    if (sort === "name-asc") return byName(a, b);
    if (sort === "name-desc") return -byName(a, b);
    const left = a.resourceModifiedAt;
    const right = b.resourceModifiedAt;
    // Unknown dates stay last in either direction.
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : byName(a, b);
    if (!Number.isFinite(right)) return -1;
    return (sort === "recent" ? right! - left! : left! - right!) || byName(a, b);
  });
}
