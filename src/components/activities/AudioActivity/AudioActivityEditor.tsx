import { AuthoringCheckbox, AuthoringFieldGrid, AuthoringFileButton, TrashIcon } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import styles from "./AudioActivity.module.css";
import type { AudioActivityEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";

export function AudioActivityEditor({
  accentColor,
  audioAccept,
  autoplayNext,
  allowDownload: _allowDownload,
  backgroundColor,
  borderColor,
  borderStyle,
  borderWidth,
  coverAccept,
  coverName,
  coverNode,
  coverRounded,
  rounded,
  shadow,
  tracks,
  getTrackAudioName,
  getTrackAudioSrc,
  onAccentColorChange,
  onAddTrack,
  onAllowDownloadChange,
  onAutoplayNextChange,
  onBackgroundColorChange,
  onBorderColorChange,
  onBorderStyleChange,
  onBorderWidthChange,
  onCoverRoundedChange,
  onCoverUpload,
  onMoveTrack,
  onRemoveCover,
  onRemoveTrack,
  onRemoveTrackAudio,
  onRoundedChange,
  onShadowChange,
  onTrackTitleChange,
  onUploadTrackAudio,
  renderTranscriptControls
}: AudioActivityEditorProps) {
  const { t } = useI18n();
  void _allowDownload;
  void onAllowDownloadChange;

  return (
    <section className={`inspector-span-2 ${styles.editorPanel}`}>
      <div className={styles.editorHeader}>
        <span className="editor-label">{t("activity.audio")}</span>
        <button className="ghost-pill" onClick={onAddTrack} type="button">
          {t("audio.addTrack", undefined, "Ajouter une piste")}
        </button>
      </div>

      <div className={styles.editorCoverRow}>
        <div className={styles.editorCoverPreview}>{coverNode}</div>
        <div className={styles.editorCoverActions}>
          <span className="editor-label">{t("audio.optionalCover", undefined, "Cover optionnelle")}</span>
          <AuthoringFileButton accept={coverAccept} onFileSelect={onCoverUpload}>
            <span>{t("editor.chooseImage")}</span>
          </AuthoringFileButton>
          {coverName ? (
            <button className="ghost-pill compact" onClick={onRemoveCover} type="button">
              {t("common.delete")}
            </button>
          ) : null}
          <AuthoringCheckbox checked={coverRounded} compact onChange={(event) => onCoverRoundedChange(event.target.checked)}>
            {t("audio.coverCorners", undefined, "Coins cover")}
          </AuthoringCheckbox>
          {coverName ? <span className={styles.editorFileName}>{coverName}</span> : null}
        </div>
      </div>

      <div className={styles.trackList}>
        {tracks.map((track, index) => {
          const trackSrc = getTrackAudioSrc(track);
          const audioName = getTrackAudioName(track);
          return (
            <article className={styles.trackEditor} key={track.id}>
              <div className={styles.trackEditorTop}>
                <strong>{t("audio.trackNumber", { count: index + 1 }, "Piste {count}")}</strong>
                {tracks.length > 1 ? (
                  <div className={styles.trackControls}>
                    <button className="ghost-pill compact" disabled={index === 0} onClick={() => onMoveTrack(track.id, -1)} type="button">
                      {t("common.up", undefined, "Haut")}
                    </button>
                    <button className="ghost-pill compact" disabled={index === tracks.length - 1} onClick={() => onMoveTrack(track.id, 1)} type="button">
                      {t("common.down", undefined, "Bas")}
                    </button>
                    <button
                      aria-label={t("audio.deleteTrack", { count: index + 1 }, "Supprimer la piste {count}")}
                      className="danger-pill compact compact-delete-button"
                      onClick={() => onRemoveTrack(track.id)}
                      title={t("audio.deleteTrack", { count: index + 1 }, "Supprimer la piste {count}")}
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ) : null}
              </div>
              <label>
                <span>{t("audio.displayTitle", undefined, "Titre affiché")}</span>
                <input
                  onChange={(event) => onTrackTitleChange(track.id, event.target.value)}
                  placeholder={t("audio.trackNumber", { count: index + 1 }, "Piste {count}")}
                  value={track.title}
                />
              </label>
              <div className={styles.trackUploadRow}>
                <AuthoringFileButton accept={audioAccept} onFileSelect={(file) => onUploadTrackAudio(track.id, file)}>
                  <span>{trackSrc ? t("audio.replaceAudio", undefined, "Remplacer l'audio") : t("audio.chooseAudio", undefined, "Choisir un audio")}</span>
                </AuthoringFileButton>
                <span className={styles.editorFileName}>{audioName || t("audio.noAudioFile", undefined, "Aucun fichier audio")}</span>
                {trackSrc ? (
                  <button className="ghost-pill compact" onClick={() => onRemoveTrackAudio(track.id)} type="button">
                    {t("common.remove")}
                  </button>
                ) : null}
              </div>
              {trackSrc ? renderTranscriptControls(track) : null}
            </article>
          );
        })}
      </div>

      <AuthoringFieldGrid className={styles.behaviorGrid}>
        <AuthoringCheckbox checked={autoplayNext} compact onChange={(event) => onAutoplayNextChange(event.target.checked)}>
          {t("audio.autoplayNext", undefined, "Lire automatiquement la piste suivante")}
        </AuthoringCheckbox>
        {/*
        Download control intentionally hidden for now: browser support and SCORM behavior are not stable enough.
        <AuthoringCheckbox checked={_allowDownload} compact onChange={(event) => onAllowDownloadChange(event.target.checked)}>
          Autoriser le telechargement
        </AuthoringCheckbox>
        */}
      </AuthoringFieldGrid>

      <section className="appearance-section" aria-label={t("audio.appearanceAria", undefined, "Apparence de l'activité audio")}>
        <span className="appearance-title">{t("editor.activityAppearance", undefined, "Apparence activité")}</span>
        <AuthoringFieldGrid className="appearance-grid">
          <label>
            <span>{t("editor.background", undefined, "Fond")}</span>
            <ColorPickerField allowTransparent ariaLabel={t("audio.backgroundColor", undefined, "Couleur de fond audio")} onChange={onBackgroundColorChange} value={backgroundColor} />
          </label>
          <label>
            <span>{t("editor.border", undefined, "Trait")}</span>
            <ColorPickerField ariaLabel={t("audio.borderColor", undefined, "Couleur du trait audio")} onChange={onBorderColorChange} value={borderColor} />
          </label>
          <label>
            <span>{t("editor.accent", undefined, "Accent")}</span>
            <ColorPickerField ariaLabel={t("audio.accentColor", undefined, "Couleur accent audio")} onChange={onAccentColorChange} value={accentColor} />
          </label>
          <label>
            <span>{t("sectionMarker.width")}</span>
            <select onChange={(event) => onBorderWidthChange(event.target.value)} value={borderWidth}>
              <option value="1px">{t("lineWidth.thin")}</option>
              <option value="2px">{t("lineWidth.normal")}</option>
              <option value="4px">{t("lineWidth.thick")}</option>
            </select>
          </label>
          <label>
            <span>{t("sectionMarker.lineStyle")}</span>
            <select onChange={(event) => onBorderStyleChange(event.target.value)} value={borderStyle}>
              <option value="solid">{t("lineStyle.solid")}</option>
              <option value="dashed">{t("lineStyle.dashed")}</option>
              <option value="dotted">{t("lineStyle.dotted")}</option>
            </select>
          </label>
          <AuthoringCheckbox checked={rounded} compact onChange={(event) => onRoundedChange(event.target.checked)}>
            {t("editor.activityCorners", undefined, "Coins activité")}
          </AuthoringCheckbox>
          <AuthoringCheckbox checked={shadow} compact onChange={(event) => onShadowChange(event.target.checked)}>
            {t("editor.shadow", undefined, "Ombre")}
          </AuthoringCheckbox>
        </AuthoringFieldGrid>
      </section>
    </section>
  );
}
