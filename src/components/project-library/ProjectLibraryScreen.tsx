import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, DragEvent, PointerEvent, ReactNode, Ref } from "react";
import { useI18n } from "../../i18n/react";
import { libraryLabelTextColor } from "../../app/libraryConfig";
import { ColorPickerField } from "../color-picker/ColorPickerPopover";
import { keywordKey, sidebarKeywords as selectSidebarKeywords } from "../../app/keywords";
import { normalizeSearchValue } from "../../app/textSearch";

export type LibrarySection = "tous" | "favoris" | "collections";

type ProjectLibraryScreenProps = {
  activeSection: LibrarySection;
  children: ReactNode;
  collectionNames: string[];
  collectionColors: Record<string, string>;
  collectionCount: number;
  collectionProjectCount: (collection: string) => number;
  favoriteCount: number;
  isManagingCollections: boolean;
  onCollectionContextMenu: () => void;
  onCollectionRename: (previous: string, next: string) => void;
  onCollectionColorChange: (collection: string, color: string) => void;
  onCollectionDragStart: (event: DragEvent<HTMLButtonElement>, collection: string) => void;
  onCollectionPointerDown: (event: PointerEvent<HTMLButtonElement>, collection: string) => void;
  shouldSuppressCollectionClick: () => boolean;
  onCreateCollection: () => void;
  onDeleteCollection: (collection: string) => void;
  keywords: string[];
  keywordCounts: Record<string, number>;
  pinnedKeywords: string[];
  recentKeywords: string[];
  usedKeywordFallback: string[];
  keywordFilter: string[];
  keywordMode: "all" | "any";
  filterOperator: "and" | "or";
  labelFilter: string[];
  onSearchApply: (filters: { text: string; labels: string[]; keywords: string[]; keywordMode: "all" | "any"; filterOperator: "and" | "or" }) => void;
  onSearchClear: () => void;
  onOpenKeywordManager: () => void;
  onKeywordPointerDown: (event: PointerEvent<HTMLButtonElement>, keyword: string) => void;
  shouldSuppressKeywordClick: () => boolean;
  onSectionChange: (section: LibrarySection) => void;
  onSortCollections: (direction: "asc" | "desc") => void;
  searchValue: string;
  selectedCollection: string | null;
  totalCount: number;
  viewportRef: Ref<HTMLDivElement>;
};

export function ProjectLibraryScreen({
  activeSection,
  children,
  collectionNames,
  collectionColors,
  collectionCount,
  collectionProjectCount,
  favoriteCount,
  isManagingCollections,
  onCollectionContextMenu,
  onCollectionRename,
  onCollectionColorChange,
  onCollectionDragStart,
  onCollectionPointerDown,
  shouldSuppressCollectionClick,
  onCreateCollection,
  onDeleteCollection,
  keywords,
  keywordCounts,
  pinnedKeywords,
  recentKeywords,
  usedKeywordFallback,
  keywordFilter,
  keywordMode,
  filterOperator,
  labelFilter,
  onSearchApply,
  onSearchClear,
  onOpenKeywordManager,
  onKeywordPointerDown,
  shouldSuppressKeywordClick,
  onSectionChange,
  onSortCollections,
  searchValue,
  selectedCollection,
  totalCount,
  viewportRef
}: ProjectLibraryScreenProps) {
  const { t } = useI18n();
  const [renamingCollection, setRenamingCollection] = useState<string | null>(null);
  const [colorEditingCollection, setColorEditingCollection] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftSearch, setDraftSearch] = useState(searchValue);
  const [draftLabels, setDraftLabels] = useState(labelFilter);
  const [draftKeywords, setDraftKeywords] = useState(keywordFilter);
  const [draftKeywordMode, setDraftKeywordMode] = useState(keywordMode);
  const [draftFilterOperator, setDraftFilterOperator] = useState(filterOperator);
  const [labelQuery, setLabelQuery] = useState("");
  const [keywordQuery, setKeywordQuery] = useState("");
  const keywordInputRef = useRef<HTMLInputElement>(null);
  const sortedUsedKeywords = keywords.filter((keyword) => (keywordCounts[keywordKey(keyword)] ?? 0) > 0)
    .sort((left, right) => (keywordCounts[keywordKey(right)] ?? 0) - (keywordCounts[keywordKey(left)] ?? 0)
      || left.localeCompare(right, "fr-FR"));
  const sidebarKeywords = selectSidebarKeywords(keywords, pinnedKeywords, recentKeywords, usedKeywordFallback);
  const availableLabels = collectionNames.filter((label) => !draftLabels.includes(label) && normalizeSearchValue(label).includes(normalizeSearchValue(labelQuery.trim()))).slice(0, 8);
  const availableKeywords = sortedUsedKeywords.filter((keyword) => !draftKeywords.some((selected) => keywordKey(selected) === keywordKey(keyword)) && normalizeSearchValue(keyword).includes(normalizeSearchValue(keywordQuery.trim()))).slice(0, 8);
  const appliedFilterCount = labelFilter.length + keywordFilter.length;
  useEffect(() => { setDraftSearch(searchValue); }, [searchValue]);
  useEffect(() => { setDraftLabels(labelFilter); }, [labelFilter]);
  useEffect(() => { setDraftKeywords(keywordFilter); }, [keywordFilter]);
  useEffect(() => { setDraftKeywordMode(keywordMode); }, [keywordMode]);
  useEffect(() => { setDraftFilterOperator(filterOperator); }, [filterOperator]);
  const openFilters = (focusKeywords = false) => {
    setFiltersOpen(true);
    if (focusKeywords) window.setTimeout(() => keywordInputRef.current?.focus(), 0);
  };
  const applyFilters = () => {
    onSearchApply({ text: draftSearch.trim(), labels: draftLabels, keywords: draftKeywords, keywordMode: draftKeywordMode, filterOperator: draftFilterOperator });
    setFiltersOpen(false);
  };
  const clearFilters = () => {
    setDraftSearch("");
    setDraftLabels([]);
    setDraftKeywords([]);
    setDraftKeywordMode("all");
    setDraftFilterOperator("or");
    setLabelQuery("");
    setKeywordQuery("");
    onSearchApply({ text: "", labels: [], keywords: [], keywordMode: "all", filterOperator: "or" });
    setFiltersOpen(false);
  };
  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);
  const renameTimer = useRef<number | null>(null);
  const cancelRename = useRef(false);
  useEffect(() => {
    if (isManagingCollections) return;
    if (renameTimer.current !== null) window.clearTimeout(renameTimer.current);
    setRenamingCollection(null);
    setColorEditingCollection(null);
  }, [isManagingCollections]);
  useEffect(() => () => {
    if (renameTimer.current !== null) window.clearTimeout(renameTimer.current);
  }, []);
  const finishRename = (collection: string) => {
    if (!cancelRename.current) onCollectionRename(collection, renameDraft);
    cancelRename.current = false;
    setRenamingCollection(null);
  };
  const navItems: Array<{ key: LibrarySection; label: string; count?: number }> = [
    { key: "tous", label: t("library.allLessons"), count: totalCount },
    { key: "favoris", label: t("library.favorites"), count: favoriteCount },
    { key: "collections", label: t("library.collections"), count: collectionCount },
  ];

  return (
    <main className="project-library-screen">
      {/* SIDEBAR LIBRARY: barre latérale fixe de la bibliothèque des projets. */}
      <aside className="project-library-sidebar">
        <div className="project-library-search project-library-search-sidebar">
          <span aria-hidden="true">⌕</span>
          <input
            onChange={(event) => {
              setDraftSearch(event.target.value);
              if (!event.target.value.trim() && searchValue) onSearchClear();
            }}
            onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
            placeholder={t("library.searchLesson")}
            type="search"
            value={draftSearch}
          />
          <button aria-expanded={filtersOpen} aria-label={`Filtres de recherche${appliedFilterCount > 0 ? ` (${appliedFilterCount} actif${appliedFilterCount > 1 ? "s" : ""})` : ""}`} className={`library-search-filter-toggle${appliedFilterCount > 0 ? " active" : ""}`} onClick={() => filtersOpen ? setFiltersOpen(false) : openFilters()} type="button">⋯</button>
        </div>
        {filtersOpen && createPortal(
          <div className="library-search-filter-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setFiltersOpen(false); }} role="presentation">
            <section aria-labelledby="library-filter-title" aria-modal="true" className="library-search-filters" role="dialog">
              <header className="library-filter-header">
                <h2 id="library-filter-title">Recherche avancée par filtre</h2>
                <button aria-label="Fermer les filtres" className="library-filter-close" onClick={() => setFiltersOpen(false)} type="button">×</button>
              </header>
              <div className="library-filter-group">
                <div className="library-filter-heading">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 4h10l8 8-9 9-9-9V4Z" /><circle cx="8" cy="9" r="1.3" /></svg>
                  <div><h3>Labels</h3><p>Filtrer les leçons par leurs labels.</p></div>
                </div>
                {draftLabels.length > 0 && <div className="library-filter-chips">{draftLabels.map((label) => <button aria-label={`Retirer le label ${label}`} key={label} onClick={() => setDraftLabels((current) => current.filter((item) => item !== label))} type="button">{label}<span aria-hidden="true">×</span></button>)}</div>}
                <div className="library-filter-search-field">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
                  <input aria-label="Chercher un label" id="library-label-filter" onChange={(event) => setLabelQuery(event.target.value)} placeholder="Rechercher un label…" type="search" value={labelQuery} />
                </div>
                <div className="library-filter-suggestions">
                  {availableLabels.length > 0 && <small>Suggestions</small>}
                  <div>{availableLabels.map((label) => <button key={label} onClick={() => { setDraftLabels((current) => [...current, label]); setLabelQuery(""); }} type="button">{label}</button>)}{availableLabels.length === 0 && <span>Aucun label trouvé.</span>}</div>
                </div>
              </div>
              <div className="library-filter-group">
                <div className="library-filter-heading">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="8" cy="8" r="5" /><path d="m12 12 9 9m-4-4 2-2m-4 0 2-2" /></svg>
                  <div><h3>Mots-clés</h3><p>Filtrer les leçons par leurs mots-clés.</p></div>
                </div>
                {draftKeywords.length > 0 && <div className="library-filter-chips">{draftKeywords.map((keyword) => <button aria-label={`Retirer le mot-clé ${keyword}`} key={keywordKey(keyword)} onClick={() => setDraftKeywords((current) => current.filter((item) => keywordKey(item) !== keywordKey(keyword)))} type="button">{keyword}<span aria-hidden="true">×</span></button>)}</div>}
                <div className="library-filter-search-field">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
                  <input aria-label="Chercher un mot-clé" id="library-keyword-filter" onChange={(event) => setKeywordQuery(event.target.value)} placeholder="Rechercher un mot-clé…" ref={keywordInputRef} type="search" value={keywordQuery} />
                </div>
                <div className="library-filter-suggestions">
                  {availableKeywords.length > 0 && <small>Suggestions</small>}
                  <div>{availableKeywords.map((keyword) => <button key={keywordKey(keyword)} onClick={() => { setDraftKeywords((current) => [...current, keyword]); setKeywordQuery(""); }} type="button">{keyword}</button>)}{availableKeywords.length === 0 && <span>Aucun mot-clé trouvé.</span>}</div>
                </div>
                {draftKeywords.length > 1 && <fieldset className="library-filter-keyword-mode"><legend>Combiner les mots-clés</legend><label><input checked={draftKeywordMode === "all"} onChange={() => setDraftKeywordMode("all")} type="radio" />Tous</label><label><input checked={draftKeywordMode === "any"} onChange={() => setDraftKeywordMode("any")} type="radio" />Au moins un</label></fieldset>}
              </div>
              <fieldset className="library-filter-mode" disabled={draftLabels.length === 0 || draftKeywords.length === 0}>
                <legend><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="4" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M12 6v5M5 17l7-6 7 6" /></svg>Opérateur de recherche</legend>
                <p>Choisir comment combiner les labels et les mots-clés.</p>
                <div className="library-filter-mode-options">
                  <label title="OU : au moins un des critères sélectionnés."><input checked={draftFilterOperator === "or"} onChange={() => setDraftFilterOperator("or")} type="radio" /><span>OU<small>Au moins un critère</small></span></label>
                  <label title="ET : tous les critères sélectionnés."><input checked={draftFilterOperator === "and"} onChange={() => setDraftFilterOperator("and")} type="radio" /><span>ET<small>Tous les critères</small></span></label>
                </div>
              </fieldset>
              <div className="library-filter-actions"><button onClick={clearFilters} type="button">Effacer</button><button onClick={applyFilters} type="button">Rechercher</button></div>
            </section>
          </div>, document.body
        )}
        <nav className="project-library-nav">
          {navItems.map((item) => (
            <button
              className={`project-library-nav-item ${activeSection === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => onSectionChange(item.key)}
              type="button"
            >
              <span>{item.label}</span>
              {typeof item.count === "number" ? <strong>{item.count}</strong> : null}
            </button>
          ))}
        </nav>

        <section className="project-library-collections-nav">
          <div className="project-library-sidebar-heading">
            <strong className="project-library-sidebar-title"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 4h10l8 8-9 9-9-9V4Z" /><circle cx="8" cy="9" r="1.3" /></svg>{t("library.labels")}</strong>
            {isManagingCollections ? (
              <div className="project-library-label-sort">
                <button onClick={() => onSortCollections("asc")} type="button">A-Z</button>
                <button onClick={() => onSortCollections("desc")} type="button">Z-A</button>
              </div>
            ) : null}
            <button aria-label="Gérer les labels" className="project-library-add-collection" onClick={onCreateCollection} title="Gérer les labels" type="button">
              +
            </button>
          </div>
          <div className="project-library-collection-list">
            {collectionNames.length ? (
              collectionNames.map((collection) => (
                <div
                  className="project-library-label-row"
                  key={collection}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onCollectionContextMenu();
                  }}
                >
                  <div className="project-library-label-main">
                  {renamingCollection === collection ? (
                    <input
                      autoFocus
                      className="project-library-label-rename"
                      onBlur={() => finishRename(collection)}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          cancelRename.current = true;
                          event.currentTarget.blur();
                        }
                      }}
                      value={renameDraft}
                    />
                  ) : (
                    <button
                      className={`project-library-collection-link ${(selectedCollection === collection || labelFilter.includes(collection)) && !isManagingCollections ? "active" : ""} ${isManagingCollections ? "managing" : ""} ${collectionColors[collection] ? "has-custom-color" : ""}`}
                      onPointerDown={(event) => { if (!isManagingCollections) onCollectionPointerDown(event, collection); }}
                      onDragStart={(event) => { if (!isManagingCollections) onCollectionDragStart(event, collection); }}
                      onClick={(event) => {
                        if (shouldSuppressCollectionClick()) {
                          event.preventDefault();
                          event.stopPropagation();
                          return;
                        }
                        if (!isManagingCollections) {
                          const selected = labelFilter.includes(collection) || selectedCollection === collection;
                          onSearchApply({ text: "", labels: selected ? [] : [collection], keywords: [], keywordMode: "all", filterOperator: "or" });
                          setFiltersOpen(false);
                          return;
                        }
                        if (event.detail !== 1) return;
                        if (renameTimer.current !== null) window.clearTimeout(renameTimer.current);
                        renameTimer.current = window.setTimeout(() => {
                          setColorEditingCollection(null);
                          setRenameDraft(collection);
                          setRenamingCollection(collection);
                          renameTimer.current = null;
                        }, 500);
                      }}
                      onDoubleClick={(event) => {
                        if (!isManagingCollections) return;
                        if (renameTimer.current !== null) window.clearTimeout(renameTimer.current);
                        renameTimer.current = null;
                        setColorEditingCollection((current) => current === collection ? null : collection);
                      }}
                      style={collectionColors[collection] ? { backgroundColor: collectionColors[collection], color: libraryLabelTextColor(collectionColors[collection]) } as CSSProperties : undefined}
                      type="button"
                    >
                      <span>{collection}</span>
                      <strong style={collectionColors[collection] ? { color: libraryLabelTextColor(collectionColors[collection]) } : undefined}>{collectionProjectCount(collection)}</strong>
                    </button>
                  )}
                  {isManagingCollections ? (
                    <button
                      aria-label={t("library.deleteLabelAria", { name: collection })}
                      className="project-library-label-delete"
                      onClick={(event) => {
                        event.preventDefault();
                        setColorEditingCollection(null);
                        onDeleteCollection(collection);
                      }}
                      type="button"
                    >
                      <svg aria-hidden="true" height="12" viewBox="0 0 12 12" width="12">
                        <path d="M2 2l8 8M10 2l-8 8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                      </svg>
                    </button>
                  ) : null}
                  </div>
                  {isManagingCollections && colorEditingCollection === collection ? (
                    <div className="project-library-label-color-popover">
                      <span>{t("common.color")}</span>
                      <ColorPickerField
                        ariaLabel={`${t("common.color")} : ${collection}`}
                        onChange={(color) => onCollectionColorChange(collection, color)}
                        value={collectionColors[collection] || "#eaf1ff"}
                      />
                      <button
                        aria-label={t("common.reset", undefined, "Réinitialiser")}
                        className="project-library-label-color-reset"
                        onClick={() => onCollectionColorChange(collection, "")}
                        title={t("common.reset", undefined, "Réinitialiser")}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="muted">{t("library.noCollection")}</p>
            )}
          </div>
        </section>
        <section className="project-library-keywords-nav" aria-label="Mots-clés">
          <div className="project-library-sidebar-heading">
            <strong className="project-library-sidebar-title"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="8" cy="8" r="5" /><path d="m12 12 9 9m-4-4 2-2m-4 0 2-2" /></svg>Mots-clés</strong>
            <button aria-label="Gérer les mots-clés" className="project-library-add-collection" onClick={onOpenKeywordManager} title="Gérer les mots-clés" type="button">+</button>
          </div>
          <div className="project-library-keyword-list">
            {sidebarKeywords.map((keyword) => {
              const selected = keywordFilter.some((item) => keywordKey(item) === keywordKey(keyword));
              return <button
                aria-pressed={selected}
                className={`project-library-keyword-link${selected ? " active" : ""}`}
                key={keywordKey(keyword)}
                onPointerDown={(event) => onKeywordPointerDown(event, keyword)}
                onDragStart={(event) => event.preventDefault()}
                onClick={(event) => {
                  if (shouldSuppressKeywordClick()) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  onSearchApply({ text: "", labels: [], keywords: selected ? [] : [keyword], keywordMode: "all", filterOperator: "or" });
                  setFiltersOpen(false);
                }}
                title={`Filtrer par ${keyword} ou glisser sur une leçon pour l’ajouter`}
                type="button"
              ><span>{keyword}</span><strong>{keywordCounts[keywordKey(keyword)] ?? 0}</strong></button>;
            })}
            {sidebarKeywords.length === 0 && <p className="muted">Aucun mot-clé affecté ou ancré.</p>}
          </div>
          {sortedUsedKeywords.some((keyword) => !sidebarKeywords.some((shown) => keywordKey(shown) === keywordKey(keyword))) && <button className="project-library-keywords-more" onClick={() => openFilters(true)} type="button">Chercher un mot-clé</button>}
        </section>
      </aside>

      <section className="project-library-content" ref={viewportRef}>
        <div className="project-library-stack">{children}</div>
      </section>
    </main>
  );
}
