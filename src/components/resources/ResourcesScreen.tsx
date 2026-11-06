import { useRef, useState } from "react";
import { ResourceCatalogContext } from "./ResourceCatalogControls";
import { resourceSortModes, type ResourceSort } from "./resourceCatalog";
import type { ReactNode } from "react";
import { useI18n } from "../../i18n/react";
import { ScrollBoundaryControls } from "../app/ScrollBoundaryControls";

export type ResourceSection = "characters" | "questions" | "assistant" | "references";

type ResourcesScreenProps = {
  activeSection: ResourceSection;
  children: ReactNode;
  onSectionChange: (section: ResourceSection) => void;
};

export function ResourcesScreen({ activeSection, children, onSectionChange }: ResourcesScreenProps) {
  const { t, language } = useI18n();
  const viewportRef = useRef<HTMLElement | null>(null);
  const [queries, setQueries] = useState<Partial<Record<ResourceSection, string>>>({});
  const [sorts, setSorts] = useState<Partial<Record<ResourceSection, ResourceSort>>>(() => {
    try { return Object.fromEntries((["characters", "questions", "assistant", "references"] as ResourceSection[]).map(section => {
      const value = localStorage.getItem(`paideia.resources.sort.${section}`) as ResourceSort;
      return [section, resourceSortModes.includes(value) ? value : "name-asc"];
    })); } catch { return {}; }
  });
  const query = queries[activeSection] ?? "";
  const sort = sorts[activeSection] ?? "name-asc";
  function onSort(value: ResourceSort) {
    setSorts(current => ({ ...current, [activeSection]: value }));
    try { localStorage.setItem(`paideia.resources.sort.${activeSection}`, value); } catch { /* In-memory preference remains available. */ }
  }
  const resourceItems: Array<{ key: ResourceSection; label: string }> = [
    { key: "characters", label: t("resources.characters") },
    { key: "questions", label: t("resources.questions") },
    { key: "assistant", label: t("resources.assistant") },
    { key: "references", label: t("resources.references", undefined, "Balises & renvois") }
  ];
  resourceItems.sort((left, right) => left.label.localeCompare(right.label, language, { sensitivity: "base" }));
  return (
    <>
    <main className="resources-screen" ref={viewportRef}>
      <aside className="resources-sidebar">
        <label className="project-library-search project-library-search-sidebar resource-search">
          <span aria-hidden="true">⌕</span>
          <input aria-label={t("resources.searchByName")} placeholder={t("resources.searchByName")} type="search" value={query} onChange={event => setQueries(current => ({ ...current, [activeSection]: event.target.value }))} />
        </label>
        <nav className="resources-nav">
          {resourceItems.map((item) => (
            <button
              className={`resources-nav-item ${activeSection === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => onSectionChange(item.key)}
              type="button"
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="resources-screen-inner"><ResourceCatalogContext.Provider value={{query, sort, onSort}}>{children}</ResourceCatalogContext.Provider></div>
    </main>
    <ScrollBoundaryControls targetRef={viewportRef} />
    </>
  );
}
