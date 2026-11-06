import { useMemo, useState } from "react";
import { TrashIcon } from "../../components/app/AppIcons";
import { useI18n } from "../../i18n/react";
import type { ObservationsController } from "./useObservations";
import type { ObservationTarget } from "./observationTypes";
import "./observations.css";

function NoteIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M5 3.5h14v12l-5 5H5zM14 20.5v-5h5M8 8h8M8 12h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}

function MenuIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden="true" className={expanded ? "expanded" : ""} fill="none" viewBox="0 0 24 24">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function ObservationToolbar({ controller, placement = "author" }: { controller: ObservationsController; placement?: "author" | "preview" | "outline" }) {
  const { t } = useI18n();
  const isAuthor = placement === "author";
  const opensGlobalReview = placement !== "preview";
  return (
    <div className={`observations-toolbar observations-toolbar--${placement}`}>
      <button
        aria-label={opensGlobalReview ? t("observations.showAll") : t("observations.show")}
        aria-pressed={opensGlobalReview ? undefined : controller.enabled}
        className={(opensGlobalReview ? controller.panelOpen && !controller.target : controller.enabled) ? "active" : ""}
        onClick={() => {
          if (opensGlobalReview) {
            controller.openReview();
            return;
          }
          const next = !controller.enabled;
          controller.setEnabled(next);
          controller.setTarget(null);
          controller.setPanelOpen(next);
        }}
        title={opensGlobalReview ? t("observations.showAll") : t("observations.show")}
        type="button"
      >
        <NoteIcon />
        {!isAuthor ? <span>{t("observations.title")}</span> : null}
        {controller.activeCount ? <strong>{controller.activeCount}</strong> : null}
      </button>
    </div>
  );
}

export function ObservationActivityAction({ controller, target }: { controller: ObservationsController; target: ObservationTarget }) {
  const { t } = useI18n();
  const threads = controller.threadsByBlock.get(target.blockId) ?? [];
  const activeCount = threads.filter((thread) => !thread.resolved).length;
  return (
    <button
      aria-label={activeCount ? t("observations.count", { count: activeCount }) : t("observations.add")}
      className={`export-block-action observation-activity-action${activeCount ? " has-observations" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        controller.openTarget(target);
      }}
      title={activeCount ? t("observations.count", { count: activeCount }) : t("observations.add")}
      type="button"
    >
      <NoteIcon />
      {activeCount ? <span>{activeCount}</span> : null}
    </button>
  );
}

export function ObservationMarker({ controller, previewMode, target }: { controller: ObservationsController; previewMode: boolean; target: ObservationTarget }) {
  const { t } = useI18n();
  const threads = controller.threadsByBlock.get(target.blockId) ?? [];
  const activeCount = threads.filter((thread) => !thread.resolved).length;
  if (!controller.enabled && (previewMode || threads.length === 0)) return null;
  return (
    <button
      aria-label={activeCount ? t("observations.count", { count: activeCount }) : t("observations.add")}
      className={`observation-marker${activeCount ? " has-observations" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        controller.openTarget(target);
      }}
      title={activeCount ? t("observations.count", { count: activeCount }) : t("observations.add")}
      type="button"
    >
      <NoteIcon />
      {activeCount ? <span>{activeCount}</span> : <span aria-hidden="true">+</span>}
    </button>
  );
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export function observationTargetReference(target: ObservationTarget, t: ReturnType<typeof useI18n>["t"]) {
  const parts = [];
  if (target.chapterNumber) parts.push(`${t("lesson.chapter", undefined, "Chapitre")} ${target.chapterNumber}`);
  if (target.activityNumber) parts.push(`${t("editor.activityTab", undefined, "Activité")} ${target.activityNumber}`);
  if (target.activityLabel) parts.push(target.activityLabel);
  return parts.join(" · ") || target.blockLabel;
}

type ObservationDrawerProps = {
  controller: ObservationsController;
  onExportPdf: () => Promise<void>;
  onNavigateTarget: (target: ObservationTarget) => void;
  resolveTarget: (target: Pick<ObservationTarget, "chapterId" | "pageId" | "blockId" | "blockLabel">) => ObservationTarget;
};

export function ObservationDrawer({ controller, onExportPdf, onNavigateTarget, resolveTarget }: ObservationDrawerProps) {
  const { language, t } = useI18n();
  const [draft, setDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [purgeConfirmationOpen, setPurgeConfirmationOpen] = useState(false);
  const [expandedResolvedIds, setExpandedResolvedIds] = useState<Set<string>>(() => new Set());
  const showAuthors = controller.state.collaborative || controller.state.threads.some((thread) =>
    thread.messages.some((message) => Boolean(message.authorDisplayName.trim()))
  );
  const deletedTrace = (author: string, date: string) => author.trim()
    ? t("observations.deleted", { author, date }, `Note supprimée le ${date} par ${author}.`)
    : `🗑 · ${date}`;
  const threads = useMemo(
    () => {
      const scoped = controller.target
        ? controller.state.threads.filter((thread) => thread.blockId === controller.target?.blockId)
        : controller.state.threads;
      const query = searchQuery.trim().toLocaleLowerCase(language);
      if (controller.target || !query) return scoped;
      return scoped.filter((thread) => {
        const target = resolveTarget(thread);
        return [
          observationTargetReference(target, t),
          ...thread.messages.flatMap((message) => [showAuthors ? message.authorDisplayName : "", message.deletedAt ? "" : message.text])
        ].join(" ").toLocaleLowerCase(language).includes(query);
      });
    },
    [controller.state.threads, controller.target, language, resolveTarget, searchQuery, showAuthors, t]
  );
  if (!controller.panelOpen) return null;
  return (
    <aside aria-label={t("observations.title")} className="observations-drawer">
      <header>
        <div className="observations-drawer__heading">
          <div className="observations-drawer__eyebrow">
            {controller.state.threads.length > 0 ? (
              <div
                className="observations-actions-menu"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setActionsMenuOpen(false);
                }}
              >
                <button
                  aria-expanded={actionsMenuOpen}
                  aria-haspopup="menu"
                  aria-label={t("observations.actions", undefined, "Actions sur les observations")}
                  className="observations-actions-menu__trigger"
                  onClick={() => setActionsMenuOpen((current) => !current)}
                  title={t("observations.actions", undefined, "Actions sur les observations")}
                  type="button"
                ><MenuIcon /></button>
                {actionsMenuOpen ? (
                  <div className="observations-actions-menu__popover" role="menu">
                    <button
                      disabled={exportPending}
                      onClick={() => {
                        setActionsMenuOpen(false);
                        setExportPending(true);
                        void onExportPdf().finally(() => setExportPending(false));
                      }}
                      role="menuitem"
                      type="button"
                    >{t("library.generatePdf")} · {t("observations.title")}</button>
                    {controller.state.canPurge ? (
                    <button
                      className="destructive"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        setPurgeConfirmationOpen(true);
                      }}
                      role="menuitem"
                      type="button"
                    >{t("observations.purge", undefined, "Purger toutes les notes")}</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <small>{controller.state.collaborative ? t("observations.collaborative") : t("observations.design")}</small>
          </div>
          <h2>{t("observations.title")}</h2>
          {!controller.target ? <p>{t("observations.allActivities")}</p> : null}
          {controller.target ? <button className="observations-show-all" onClick={() => { controller.setTarget(null); setSearchQuery(""); }} type="button">{t("observations.showAll")}</button> : null}
        </div>
        <button aria-label={t("common.close")} onClick={() => controller.setPanelOpen(false)} type="button"><CloseIcon /></button>
      </header>
      <div className="observations-drawer__body">
        {!controller.target ? (
          <label className="observations-search">
            <span>{t("observations.search", undefined, "Rechercher dans toutes les observations")}</span>
            <span className="observations-search__field">
              <span aria-hidden="true">⌕</span>
              <input
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("observations.searchPlaceholder", undefined, "Rechercher dans toutes les observations…")}
                type="search"
                value={searchQuery}
              />
            </span>
          </label>
        ) : null}
        {controller.target ? (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim() || controller.pending || !controller.target) return;
            void controller.create(controller.target, draft).then((saved) => saved && setDraft(""));
          }}>
            <button className="observation-target-card" onClick={() => onNavigateTarget(controller.target!)} type="button">
              {observationTargetReference(controller.target, t)}
            </button>
            <label htmlFor="new-observation">{t("observations.new")}</label>
            <textarea id="new-observation" maxLength={4000} onChange={(event) => setDraft(event.target.value)} placeholder={t("observations.placeholder")} rows={3} value={draft} />
            <button disabled={!draft.trim() || controller.pending} type="submit">{t("observations.addAction")}</button>
          </form>
        ) : null}
        {controller.error ? <p className="observations-error" role="alert">{controller.error}</p> : null}
        <div className="observation-thread-list">
          {threads.length === 0 ? <p className="observations-empty">{t("observations.empty")}</p> : null}
          {threads.map((thread) => {
            const collapsed = thread.resolved && !expandedResolvedIds.has(thread.id);
            const firstMessage = thread.messages[0];
            const threadTarget = resolveTarget(thread);
            const hasActiveMessages = thread.messages.some((message) => !message.deletedAt);
            if (!hasActiveMessages) {
              return (
                <article className="deleted-only" key={thread.id}>
                  {thread.messages.map((message) => {
                    const deletionLabel = deletedTrace(
                      message.deletedByDisplayName ?? message.authorDisplayName,
                      formatDate(message.deletedAt ?? message.createdAt, language)
                    );
                    return controller.target ? (
                      <p className="observation-deleted-line" key={message.id}>{deletionLabel}</p>
                    ) : (
                      <button className="observation-deleted-line" key={message.id} onClick={() => onNavigateTarget(threadTarget)} type="button">
                        <strong>{observationTargetReference(threadTarget, t)}</strong>
                        <span className="observation-deleted-line__trace">{deletionLabel}</span>
                      </button>
                    );
                  })}
                </article>
              );
            }
            return (
            <article className={`${thread.resolved ? "resolved" : ""}${collapsed ? " collapsed" : ""}`} key={thread.id}>
              {thread.resolved ? (
                <button
                  aria-expanded={!collapsed}
                  className="observation-thread-summary"
                  onClick={() => setExpandedResolvedIds((current) => {
                    const next = new Set(current);
                    if (next.has(thread.id)) next.delete(thread.id); else next.add(thread.id);
                    return next;
                  })}
                  type="button"
                >
                  <span className="observation-thread-summary__content">
                    <span><strong>{observationTargetReference(threadTarget, t)}</strong>{showAuthors && firstMessage?.authorDisplayName ? <> · {firstMessage.authorDisplayName}</> : null} · <em>✓ {t("observations.resolved", undefined, "Traitée")}</em></span>
                    <span>« {firstMessage?.deletedAt ? deletedTrace(firstMessage.deletedByDisplayName ?? firstMessage.authorDisplayName, formatDate(firstMessage.deletedAt, language)) : firstMessage?.text} »</span>
                  </span>
                  <span className="observation-thread-summary__chevron"><ChevronIcon expanded={!collapsed} /></span>
                </button>
              ) : null}
              {!collapsed ? <>
              {!controller.target ? <button className="observation-target-card" onClick={() => onNavigateTarget(threadTarget)} type="button">{observationTargetReference(threadTarget, t)}</button> : null}
              {thread.messages.map((message) => (
                <div className={`observation-message${message.deletedAt ? " deleted" : ""}`} key={message.id}>
                  <div className={`observation-message__header${showAuthors ? "" : " observation-message__header--without-author"}`}>
                    {showAuthors && message.authorDisplayName ? <strong>{message.authorDisplayName}</strong> : null}
                    <span>
                      <time>{formatDate(message.createdAt, language)}</time>
                      {!message.deletedAt && message.authorId === controller.state.currentUserId ? (
                        <button
                          aria-label={t("observations.deleteComment", undefined, "Supprimer ce commentaire")}
                          className="observation-message__delete"
                          disabled={controller.pending}
                          onClick={() => setDeleteCandidateId(message.id)}
                          title={t("observations.deleteComment", undefined, "Supprimer ce commentaire")}
                          type="button"
                        ><TrashIcon /></button>
                      ) : null}
                    </span>
                  </div>
                  {message.deletedAt ? (
                    <p>{deletedTrace(message.deletedByDisplayName ?? message.authorDisplayName, formatDate(message.deletedAt, language))}</p>
                  ) : (
                    <p>{message.text}</p>
                  )}
                </div>
              ))}
              {hasActiveMessages ? <form className="observation-reply" onSubmit={(event) => {
                event.preventDefault();
                const text = replyDrafts[thread.id]?.trim();
                if (!text || controller.pending) return;
                void controller.reply(thread.id, text).then((saved) => saved && setReplyDrafts((current) => ({ ...current, [thread.id]: "" })));
              }}>
                <textarea aria-label={t("observations.reply")} maxLength={4000} onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))} placeholder={t("observations.replyPlaceholder")} rows={2} value={replyDrafts[thread.id] ?? ""} />
                <div>
                  {controller.state.canResolve ? <button className="secondary" disabled={controller.pending} onClick={() => void controller.resolve(thread.id, !thread.resolved).then((saved) => {
                    if (saved && !thread.resolved) setExpandedResolvedIds((current) => {
                      const next = new Set(current);
                      next.delete(thread.id);
                      return next;
                    });
                  })} type="button">{thread.resolved ? t("observations.reopen") : t("observations.resolve")}</button> : null}
                  <button disabled={!replyDrafts[thread.id]?.trim() || controller.pending} type="submit">{t("observations.reply")}</button>
                </div>
              </form> : null}
              </> : null}
            </article>
            );
          })}
        </div>
      </div>
      {purgeConfirmationOpen ? (
        <div className="observations-purge-modal" onMouseDown={() => setPurgeConfirmationOpen(false)} role="presentation">
          <section aria-labelledby="observations-purge-title" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <h3 id="observations-purge-title">{t("observations.purge", undefined, "Purger toutes les notes")}</h3>
            <p>{t("observations.purgeConfirm", undefined, "Toutes les notes seront retirées de PAIDEIA. Une archive technique non consultable dans l’application sera conservée dans le projet.")}</p>
            <div>
              <button className="secondary" onClick={() => setPurgeConfirmationOpen(false)} type="button">{t("common.cancel")}</button>
              <button
                disabled={controller.pending}
                onClick={() => void controller.purge().then((saved) => saved && setPurgeConfirmationOpen(false))}
                type="button"
              >{t("observations.purgeAction", undefined, "Confirmer la purge")}</button>
            </div>
          </section>
        </div>
      ) : null}
      {deleteCandidateId ? (
        <div className="observations-purge-modal" onMouseDown={() => setDeleteCandidateId(null)} role="presentation">
          <section aria-labelledby="observation-delete-title" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <h3 id="observation-delete-title">{t("observations.deleteComment", undefined, "Supprimer ce commentaire")}</h3>
            <div>
              <button className="secondary" onClick={() => setDeleteCandidateId(null)} type="button">{t("common.cancel")}</button>
              <button
                disabled={controller.pending}
                onClick={() => void controller.deleteMessage(deleteCandidateId).then((saved) => saved && setDeleteCandidateId(null))}
                type="button"
              >{t("common.delete")}</button>
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
