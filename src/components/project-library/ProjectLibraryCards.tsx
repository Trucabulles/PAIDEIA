import type { CSSProperties, DragEvent, ReactNode } from "react";
import { useI18n } from "../../i18n/react";
import { libraryLabelTextColor } from "../../app/libraryConfig";
import type { LibraryProjectEntry } from "../../types/project";

export type LibraryActionMenu =
  | { type: "project" | "collection"; id: string }
  | null;

type ProjectLibraryCardProps = {
  actionMenu: LibraryActionMenu;
  canDropCollection: (event: DragEvent<HTMLElement>) => boolean;
  coverImageUrl: string | null;
  coverTones: readonly [string, string, string];
  dropReady: boolean;
  entry: LibraryProjectEntry;
  formatCount: (count: number, singular: string, plural: string) => string;
  formatDate: (value: string) => string;
  getDroppedCollection: (event: DragEvent<HTMLElement>) => string | null;
  isFavorite: boolean;
  labelColor?: string;
  occurrenceKey: string;
  onAssignCollection: (archivePath: string, collection: string) => void;
  onDelete?: (entry: LibraryProjectEntry) => void;
  onDropComplete: () => void;
  onDuplicate?: (entry: LibraryProjectEntry) => void;
  onExportPaideia?: (entry: LibraryProjectEntry) => void;
  onExportScorm12?: (entry: LibraryProjectEntry) => void;
  onGeneratePdf?: (entry: LibraryProjectEntry) => void;
  onMenuChange: (menu: LibraryActionMenu) => void;
  onOpen: (archivePath: string) => void;
  onManageLabelsKeywords: (entry: LibraryProjectEntry) => void;
  onRename?: (entry: LibraryProjectEntry) => void;
  onToggleFavorite: (archivePath: string) => void;
};

export function ProjectLibraryCard({
  actionMenu,
  canDropCollection,
  coverImageUrl,
  coverTones,
  dropReady,
  entry,
  formatCount,
  formatDate,
  getDroppedCollection,
  isFavorite,
  labelColor,
  occurrenceKey,
  onAssignCollection,
  onDelete,
  onDropComplete,
  onDuplicate,
  onExportPaideia,
  onExportScorm12,
  onGeneratePdf,
  onMenuChange,
  onOpen,
  onManageLabelsKeywords,
  onRename,
  onToggleFavorite
}: ProjectLibraryCardProps) {
  const { t } = useI18n();
  const isFolderProject = !entry.archivePath.toLowerCase().endsWith(".paideia");
  const localizedCount = (count: number, singularKey: string, pluralKey: string) =>
    t(count > 1 ? pluralKey : singularKey, { count });

  const assignDroppedCollection = (event: DragEvent<HTMLElement>, completeDrop: boolean) => {
    const collection = getDroppedCollection(event);
    if (!collection) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onAssignCollection(entry.archivePath, collection);
    if (completeDrop) {
      onDropComplete();
    }
  };

  return (
    <article
      className={`library-project-card ${dropReady ? "collection-drop-ready" : ""}`}
      data-library-archive-path={entry.archivePath}
      onDragOver={(event) => {
        if (canDropCollection(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => assignDroppedCollection(event, false)}
    >
      <div
        aria-hidden="true"
        className="library-project-drop-shield"
        onDragEnter={(event) => {
          if (canDropCollection(event)) {
            event.preventDefault();
          }
        }}
        onDragOver={(event) => {
          if (canDropCollection(event)) {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => assignDroppedCollection(event, true)}
      />
      <button
        aria-label={t("library.openLessonAria", { title: entry.title })}
        title={(entry.keywords ?? []).length ? t("keywords.cardList", { keywords: entry.keywords!.join(", ") }) : t("keywords.empty")}
        className="library-project-open"
        onDragOver={(event) => {
          if (canDropCollection(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => assignDroppedCollection(event, true)}
        onClick={() => onOpen(entry.archivePath)}
        type="button"
      >
        <div
          className="library-project-cover"
          style={
            {
              "--cover-start": coverTones[0],
              "--cover-middle": coverTones[1],
              "--cover-end": coverTones[2],
              "--project-cover-image": coverImageUrl ? `url("${coverImageUrl}")` : "none"
            } as CSSProperties
          }
        >
        </div>
        <div className="library-project-body">
          <div className="library-project-head">
            <strong>{entry.title}</strong>
            {entry.collection ? <span className="library-tag" style={labelColor ? { backgroundColor: labelColor, color: libraryLabelTextColor(labelColor) } : undefined}>{entry.collection}</span> : null}
          </div>
          <div className="library-project-meta">
            <span>{localizedCount(entry.chaptersCount, "library.chapterCount", "library.chapterCountPlural")}</span>
            <span>{localizedCount(entry.activitiesCount, "library.activityCount", "library.activityCountPlural")}</span>
          </div>
          <div className="library-project-footer">
            <span>{t("library.updatedAt", { date: formatDate(entry.updatedAt) })}</span>
          </div>
        </div>
      </button>
      <button
        aria-label={isFavorite ? t("library.removeFavoriteAria", { title: entry.title }) : t("library.addFavoriteAria", { title: entry.title })}
        aria-pressed={isFavorite}
        className={`library-favorite-toggle ${isFavorite ? "active" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(entry.archivePath);
        }}
        type="button"
      >
        {isFavorite ? "★" : "☆"}
      </button>
      <button
        aria-label={t("library.actionsFor", { title: entry.title })}
        className="library-card-menu-toggle project"
        onClick={(event) => {
          event.stopPropagation();
          onMenuChange(
            actionMenu?.type === "project" && actionMenu.id === occurrenceKey
              ? null
              : { type: "project", id: occurrenceKey }
          );
        }}
        type="button"
      >
        ⋯
      </button>
      {actionMenu?.type === "project" && actionMenu.id === occurrenceKey ? (
        <div className="library-card-menu">
          {isFolderProject && onDuplicate ? <button onClick={() => onDuplicate(entry)} type="button">{t("library.duplicateLesson")}</button> : null}
          {isFolderProject && onRename ? <button onClick={() => onRename(entry)} type="button">{t("library.renameLesson")}</button> : null}
          {onGeneratePdf ? <button onClick={() => onGeneratePdf(entry)} type="button">{t("library.generatePdf")}</button> : null}
          {isFolderProject && onExportPaideia ? <button onClick={() => onExportPaideia(entry)} type="button">{t("menu.exportPaideia")}</button> : null}
          {onExportScorm12 ? <button onClick={() => onExportScorm12(entry)} type="button">{t("library.exportScorm")}</button> : null}
          <button onClick={() => onManageLabelsKeywords(entry)} type="button">{t("keywords.manageLesson")}</button>
          {onDelete ? <button className="danger" onClick={() => onDelete(entry)} type="button">{t("library.deleteLesson")}</button> : null}
        </div>
      ) : null}
    </article>
  );
}

type ProjectLibraryCollectionCardProps = {
  actionMenu: LibraryActionMenu;
  busy: boolean;
  collection: string;
  coverImageUrl: string | null;
  coverTones: readonly [string, string, string];
  formatCount: (count: number, singular: string, plural: string) => string;
  projectCount: number;
  onChooseImage: (collection: string) => void;
  onExportScorm12?: (collection: string) => void;
  onMenuChange: (menu: LibraryActionMenu) => void;
  onOpen: (collection: string) => void;
  onRemove: (collection: string) => void;
};

export function ProjectLibraryCollectionCard({
  actionMenu,
  busy,
  collection,
  coverImageUrl,
  coverTones,
  formatCount,
  projectCount,
  onChooseImage,
  onExportScorm12,
  onMenuChange,
  onOpen,
  onRemove
}: ProjectLibraryCollectionCardProps) {
  const { t } = useI18n();
  const localizedCount = (count: number, singularKey: string, pluralKey: string) =>
    t(count > 1 ? pluralKey : singularKey, { count });
  return (
    <article className="library-collection-card-wrap">
      <button className="library-collection-card" onClick={() => onOpen(collection)} type="button">
        <div
          className="library-collection-cover"
          style={
            {
              "--collection-image": coverImageUrl ? `url("${coverImageUrl}")` : "none",
              "--cover-start": coverTones[0],
              "--cover-middle": coverTones[1],
              "--cover-end": coverTones[2]
            } as CSSProperties
          }
        />
        <div className="library-collection-caption">
          <strong>{collection}</strong>
          <span>{localizedCount(projectCount, "library.lessonCount", "library.lessonCountPlural")}</span>
        </div>
      </button>
      <button
        aria-label={t("library.actionsFor", { title: collection })}
        className="library-card-menu-toggle collection"
        onClick={(event) => {
          event.stopPropagation();
          onMenuChange(
            actionMenu?.type === "collection" && actionMenu.id === collection
              ? null
              : { type: "collection", id: collection }
          );
        }}
        type="button"
      >
        ⋯
      </button>
      {actionMenu?.type === "collection" && actionMenu.id === collection ? (
        <div className="library-card-menu">
          <button onClick={() => onChooseImage(collection)} type="button">{t("library.chooseImage")}</button>
          {onExportScorm12 ? <button disabled={busy} onClick={() => onExportScorm12(collection)} type="button">
            {busy ? t("common.exporting") : t("library.collectionToScorm")}
          </button> : null}
          <button className="danger" onClick={() => onRemove(collection)} type="button">{t("library.removeCollection")}</button>
        </div>
      ) : null}
    </article>
  );
}

type ProjectLibraryGridProps = {
  children: ReactNode;
  emptyMessage: string;
  centerEmpty?: boolean;
  hasItems: boolean;
  headerAction?: ReactNode;
  sortControl?: ReactNode;
  title: string;
};

export function ProjectLibraryGrid({
  children,
  emptyMessage,
  centerEmpty = false,
  hasItems,
  headerAction,
  sortControl,
  title
}: ProjectLibraryGridProps) {
  return (
    <section className={`library-rail-section${!hasItems && centerEmpty ? " library-rail-section-filter-empty" : ""}`}>
      <div className="library-rail-header">
        <div><h2>{title}</h2></div>
        {headerAction}
        {sortControl}
      </div>
      {hasItems ? <div className="library-grid">{children}</div> : <div className="library-rail-empty" role="status">{emptyMessage}</div>}
    </section>
  );
}

type CreateLessonButtonProps = {
  onClick: () => void;
};

export function CreateLessonButton({ onClick }: CreateLessonButtonProps) {
  const { t } = useI18n();
  return (
    <button aria-label={t("library.createLessonAria")} className="library-rail-add-button" onClick={onClick} type="button">
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 6v12M6 12h12" />
      </svg>
    </button>
  );
}
