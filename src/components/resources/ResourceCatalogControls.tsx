import { createContext, useContext, useMemo } from "react";
import { useI18n } from "../../i18n/react";
import { selectResourceTiles, type ResourceSort, type ResourceSummary } from "./resourceCatalog";

export const ResourceCatalogContext = createContext<{ query: string; sort: ResourceSort; onSort: (sort: ResourceSort) => void } | null>(null);
export function useResourceTiles<T extends ResourceSummary>(items: readonly T[]) {
  const controls = useContext(ResourceCatalogContext);
  const { language } = useI18n();
  const query = controls?.query ?? "";
  const sort = controls?.sort ?? "name-asc";
  return useMemo(() => selectResourceTiles(items, query, sort, language), [items, query, sort, language]);
}
export function ResourceSortControl() {
  const controls = useContext(ResourceCatalogContext);
  if (!controls) return null;
  return <CatalogSortControl sort={controls.sort} onSort={controls.onSort} />;
}
export function CatalogSortControl({ sort, onSort }: { sort: ResourceSort; onSort: (sort: ResourceSort) => void }) {
  const { t } = useI18n();
  return <div className="resource-sort-control">
    <select aria-label={t("resources.sortBy")} value={sort} onChange={event => onSort(event.target.value as ResourceSort)}>
      <option value="name-asc">{t("resources.sortNameAsc")}</option>
      <option value="name-desc">{t("resources.sortNameDesc")}</option>
      <option value="recent">{t("resources.sortRecent")}</option>
      <option value="oldest">{t("resources.sortOldest")}</option>
    </select>
  </div>;
}
export function ResourceNoResults({ count }: { count: number }) {
  const { t } = useI18n();
  return count ? null : <p className="library-rail-empty" role="status">{t("resources.noResults")}</p>;
}
