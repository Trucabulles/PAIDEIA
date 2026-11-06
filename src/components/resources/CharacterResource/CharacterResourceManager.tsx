import { useEffect, useRef, useState } from "react";
import type { DefaultSituationalDialogueCharacterDefinition } from "../../activities/SituationalDialogueActivity";
import "./CharacterResourceManager.css";
import { useI18n } from "../../../i18n/react";
import { useEscapeNavigation } from "../../../hooks/useEscapeNavigation";
import { CreateResourceButton } from "../CreateResourceButton";
import { ResourceSortControl, ResourceNoResults, useResourceTiles } from "../ResourceCatalogControls";

export type UserCharacterDraft = {
  id: string;
  name: string;
  role: string;
  description: string;
};

type UserCharacterPoseState = {
  key: string;
  labelKey: string;
  fallback: string;
};

type CharacterResourceManagerProps = {
  characters: DefaultSituationalDialogueCharacterDefinition[];
  draft: UserCharacterDraft;
  saveFeedbackState: "idle" | "saving" | "saved" | "error";
  selectedCharacterId: string;
  formatCount: (count: number, singular: string, plural: string) => string;
  onAddCharacter: () => void;
  onBackToTiles: () => void;
  onDeleteCharacterRequest: (character: DefaultSituationalDialogueCharacterDefinition) => void;
  onDuplicateCharacter: (characterId: string) => Promise<void>;
  onDraftChange: (patch: Partial<UserCharacterDraft>) => void;
  onExportCharacters: (characterIds: string[]) => Promise<void>;
  onImportCharacters: () => Promise<void>;
  onRenameCharacter: (characterId: string, name: string) => Promise<void>;
  onSaveCharacter: () => Promise<void>;
  onSelectCharacter: (characterId: string) => void;
  onSetDefaultPose: (characterId: string, state: string, assetRef: string) => void;
  onUploadPose: (state: string, file: File | null, makeDefault: boolean) => void;
  onUploadPreview: (characterId: string, file: File | null) => void;
  resolvePoseUrl: (assetRef?: string | null) => string | null;
  resolvePreviewUrl: (character: DefaultSituationalDialogueCharacterDefinition) => string | null;
};

const USER_CHARACTER_POSE_STATES: UserCharacterPoseState[] = [
  { key: "introduction", labelKey: "resources.poseIntroduction", fallback: "Introduction" },
  { key: "neutral", labelKey: "resources.poseNeutral", fallback: "Neutre" },
  { key: "question", labelKey: "resources.poseQuestion", fallback: "Question" },
  { key: "positive", labelKey: "resources.posePositive", fallback: "Positive" },
  { key: "negative", labelKey: "resources.poseNegative", fallback: "Négative" },
  { key: "conclusion", labelKey: "resources.poseConclusion", fallback: "Conclusion" }
];

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m15 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v5M12 16.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ExportIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v6h14v-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

function ImportIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 13v6h14v-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

export function CharacterResourceManager({
  characters,
  draft,
  saveFeedbackState,
  selectedCharacterId,
  formatCount,
  onAddCharacter,
  onBackToTiles,
  onDeleteCharacterRequest,
  onDuplicateCharacter,
  onDraftChange,
  onExportCharacters,
  onImportCharacters,
  onRenameCharacter,
  onSaveCharacter,
  onSelectCharacter,
  onSetDefaultPose,
  onUploadPose,
  onUploadPreview,
  resolvePoseUrl,
  resolvePreviewUrl
}: CharacterResourceManagerProps) {
  const { t } = useI18n();
  const visibleCharacters = useResourceTiles(characters);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [renameCharacterId, setRenameCharacterId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [tileError, setTileError] = useState("");
  const suppressTileOpenRef = useRef(false);
  const suppressTileOpenTimeoutRef = useRef<number | null>(null);
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? null;
  const renameCharacter = characters.find((character) => character.id === renameCharacterId) ?? null;

  async function confirmRename() {
    const name = renameName.trim();
    if (!renameCharacter || !name || renameBusy) return;
    if (name === renameCharacter.name) { setRenameCharacterId(null); return; }
    setRenameBusy(true);
    setRenameError("");
    try {
      await onRenameCharacter(renameCharacter.id, name);
      setRenameCharacterId(null);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : String(error));
    } finally {
      setRenameBusy(false);
    }
  }
  useEscapeNavigation(Boolean(selectedCharacterId), onBackToTiles);
  const canUploadPose = Boolean(draft.id || selectedCharacterId);
  const selectedPreviewUrl = selectedCharacter ? resolvePreviewUrl(selectedCharacter) : null;
  const saveButtonStateClass =
    saveFeedbackState === "saving"
      ? "is-saving"
      : saveFeedbackState === "saved"
        ? "is-saved"
        : saveFeedbackState === "error"
          ? "is-error"
          : "";

  const armTileOpenSuppression = () => {
    suppressTileOpenRef.current = true;
    if (suppressTileOpenTimeoutRef.current !== null) {
      window.clearTimeout(suppressTileOpenTimeoutRef.current);
    }
    suppressTileOpenTimeoutRef.current = window.setTimeout(() => {
      suppressTileOpenRef.current = false;
      suppressTileOpenTimeoutRef.current = null;
    }, 500);
  };

  useEffect(() => {
    if (!actionMenuId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".resource-character-menu, .resource-character-menu-toggle")
      ) {
        return;
      }
      setActionMenuId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [actionMenuId]);

  useEffect(() => {
    return () => {
      if (suppressTileOpenTimeoutRef.current !== null) {
        window.clearTimeout(suppressTileOpenTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const available = new Set(characters.map((character) => character.id));
    setSelectedForExport((current) => new Set([...current].filter((id) => available.has(id))));
  }, [characters]);

  const selectedCount = characters.filter((character) => selectedForExport.has(character.id)).length;
  const allSelected = characters.length > 0 && selectedCount === characters.length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
  }, [selectedCount, allSelected]);

  if (!selectedCharacterId) {
    return (
      <section className="character-resource-manager resource-bank-panel">
        {renameCharacter ? <div className="paideia-modal-backdrop" role="presentation"><section className="paideia-modal" role="dialog" aria-modal="true" aria-labelledby="character-rename-title">
          <h2 id="character-rename-title">{t("common.rename")}</h2>
          <label className="modal-field">{t("common.name")}<input autoFocus disabled={renameBusy} value={renameName} onChange={(event) => setRenameName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void confirmRename(); }} /></label>
        {renameError ? <p role="alert">{renameError}</p> : null}
          <div className="modal-actions"><button className="ghost-pill" disabled={renameBusy} onClick={() => setRenameCharacterId(null)} type="button">{t("common.cancel")}</button><button className="primary-pill" disabled={renameBusy || !renameName.trim()} onClick={() => void confirmRename()} type="button">{t("common.save")}</button></div>
        </section></div> : null}
        {tileError ? <p role="alert">{tileError}</p> : null}
        <div className="resource-bank-summary resource-bank-title-row">
            <span>{t(characters.length > 1 ? "resources.characterCountPlural" : "resources.characterCount", { count: characters.length }, characters.length > 1 ? "{count} personnages" : "{count} personnage")}</span>
            <CreateResourceButton label={t("resources.addCharacter", undefined, "Ajouter un personnage")} onClick={onAddCharacter} />
            <label className="resource-bank-select-all">
              <input
                ref={selectAllRef}
                checked={allSelected}
                disabled={transferBusy || characters.length === 0}
                onChange={(event) => setSelectedForExport(event.target.checked ? new Set(characters.map((character) => character.id)) : new Set())}
                type="checkbox"
              />
              Tout sélectionner
            </label>
          <div className="resource-character-transfer-actions">
            <button
              className="character-resource-button"
              disabled={transferBusy}
              onClick={() => {
                setTransferBusy(true);
                void onImportCharacters().catch(() => undefined).finally(() => setTransferBusy(false));
              }}
              type="button"
            >
              <span className="character-resource-button-icon"><ImportIcon /></span>
              <span>{t("resources.importCharacters", undefined, "Importer")}</span>
            </button>
            <button
              className="character-resource-button"
              disabled={transferBusy || selectedForExport.size === 0}
              onClick={() => {
                setTransferBusy(true);
                void onExportCharacters([...selectedForExport]).catch(() => undefined).finally(() => setTransferBusy(false));
              }}
              type="button"
            >
              <span className="character-resource-button-icon"><ExportIcon /></span>
              <span>{t("resources.exportCharacters", { count: selectedForExport.size }, "Exporter ({count})")}</span>
            </button>
          </div>
          <ResourceSortControl />
        </div>
        <div className="resource-portal-grid">
          <ResourceNoResults count={visibleCharacters.length} />
          {visibleCharacters.map((character) => {
            const previewUrl = resolvePreviewUrl(character);
            return (
              <article className="resource-portal-card" key={character.id}>
                <label className="resource-character-export-select" onClick={(event) => event.stopPropagation()}>
                  <input
                    checked={selectedForExport.has(character.id)}
                    onChange={(event) => setSelectedForExport((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(character.id); else next.delete(character.id);
                      return next;
                    })}
                    type="checkbox"
                  />
                  <span>{t("resources.selectCharacter", undefined, "Sélectionner")}</span>
                </label>
                <button
                  className="resource-portal-open"
                  onClick={() => {
                    if (suppressTileOpenRef.current) {
                      suppressTileOpenRef.current = false;
                      return;
                    }
                    onSelectCharacter(character.id);
                  }}
                  type="button"
                >
                  <span className={`resource-portal-cover ${previewUrl ? "" : "resource-portal-cover-empty"}`}>
                    {previewUrl ? (
                      <img alt="" className="resource-portal-image" src={previewUrl} />
                    ) : (
                      <span className="resource-portal-empty-label">{t("common.preview", undefined, "Aperçu")}</span>
                    )}
                  </span>
                  <span className="resource-portal-body">
                    <span className="resource-portal-title">{character.name}</span>
                  </span>
                </button>
                <button
                  aria-label={t("common.optionsFor", { name: character.name }, "Options {name}")}
                  className="library-card-menu-toggle resource-character-menu-toggle"
                  onClick={() => setActionMenuId((current) => (current === character.id ? null : character.id))}
                  type="button"
                >
                  ...
                </button>
                {actionMenuId === character.id ? (
                  <div
                    className="library-card-menu resource-character-menu"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button onClick={() => { setActionMenuId(null); setRenameError(""); setRenameCharacterId(character.id); setRenameName(character.name); }} type="button">{t("common.rename")}</button>
                    <button disabled={transferBusy} onClick={() => { setActionMenuId(null); setTransferBusy(true); void onExportCharacters([character.id]).catch(() => undefined).finally(() => setTransferBusy(false)); }} type="button">{t("references.export")}</button>
                    <button onClick={() => { setActionMenuId(null); setTileError(""); void onDuplicateCharacter(character.id).catch((error) => setTileError(error instanceof Error ? error.message : String(error))); }} type="button">{t("common.duplicate")}</button>
                    <label
                      className="library-card-menu-file-option"
                      onPointerDown={(event) => {
                        armTileOpenSuppression();
                        event.stopPropagation();
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t("editor.chooseImage")}
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        onClick={(event) => {
                          armTileOpenSuppression();
                          event.stopPropagation();
                        }}
                        onChange={(event) => {
                          armTileOpenSuppression();
                          onUploadPreview(character.id, event.target.files?.[0] ?? null);
                          event.target.value = "";
                          setActionMenuId(null);
                        }}
                        type="file"
                      />
                    </label>
                    <button
                      className="danger resource-character-delete-action"
                      onClick={() => {
                        setActionMenuId(null);
                        onDeleteCharacterRequest(character);
                      }}
                      type="button"
                    >
                      <span className="resource-character-delete-icon"><TrashIcon /></span>
                      <span>{t("resources.deleteCharacter", undefined, "Supprimer le personnage")}</span>
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="character-resource-manager resource-bank-panel">
      <div className="resource-character-topbar">
        <button className="character-resource-button character-resource-back-button" onClick={onBackToTiles} type="button">
          <span className="character-resource-button-icon"><BackIcon /></span>
          <span>
            {t("resources.backToTiles", undefined, "Retour aux tuiles")}
          </span>
        </button>
        <div className="resource-character-save-area">
          <button
            aria-keyshortcuts="Control+S"
            className={`resource-save-button active character-resource-button character-resource-save-button ${saveButtonStateClass}`}
            disabled={!draft.name.trim() || saveFeedbackState === "saving"}
            onClick={() => void onSaveCharacter().catch(() => undefined)}
            title={`${t("common.save")} (Ctrl+S)`}
            type="button"
          >
            <span className={`character-resource-button-icon ${saveFeedbackState === "saving" ? "is-spinning" : ""}`}>
              {saveFeedbackState === "saving"
                ? <SpinnerIcon />
                : saveFeedbackState === "saved"
                  ? <CheckIcon />
                  : saveFeedbackState === "error"
                    ? <ErrorIcon />
                    : <SaveIcon />}
            </span>
            <span>{t("common.save")}</span>
          </button>
        </div>
      </div>

      <div className="resource-character-workbench">
        <div className="resource-character-editor">
          <section className="resource-character-identity-card">
            <div className="resource-character-identity-preview">
              <span className="resource-character-eyebrow">{t("common.preview", undefined, "Aperçu")}</span>
              <div className={`resource-character-identity-image ${selectedPreviewUrl ? "has-image" : ""}`}>
                {selectedPreviewUrl ? (
                  <img alt="" src={selectedPreviewUrl} />
                ) : (
                  <span>{t("common.preview", undefined, "Aperçu")}</span>
                )}
              </div>
            </div>

            <div className="resource-character-form">
              <label>
                <span>{t("common.name", undefined, "Nom")}</span>
                <input
                  onChange={(event) => onDraftChange({ name: event.target.value })}
                  placeholder={t("resources.characterName", undefined, "Nom du personnage")}
                  value={draft.name}
                />
              </label>
              <label>
                <span>{t("resources.role", undefined, "Rôle")}</span>
                <input
                  onChange={(event) => onDraftChange({ role: event.target.value })}
                  placeholder={t("resources.rolePlaceholder", undefined, "Rôle / métier")}
                  value={draft.role}
                />
              </label>
              <label className="resource-character-form-wide">
                <span>{t("resources.description", undefined, "Description")}</span>
                <textarea
                  onChange={(event) => onDraftChange({ description: event.target.value })}
                  placeholder={t("resources.characterNotes", undefined, "Notes internes sur ce personnage")}
                  value={draft.description}
                />
              </label>
            </div>
          </section>

          <div className="resource-pose-editor-list">
            {USER_CHARACTER_POSE_STATES.map((state) => {
              const poses = selectedCharacter?.poses.filter((pose) => pose.state === state.key) ?? [];
              const defaultPose = poses[0] ?? null;
              const defaultPoseUrl = resolvePoseUrl(defaultPose?.assetRef);
              return (
                <div className="resource-pose-row" key={state.key}>
                  <div className="resource-pose-row-title">
                    <strong>{t(state.labelKey, undefined, state.fallback)}</strong>
                    <span>{poses.length ? formatCount(poses.length, "image", "images") : t("resources.noImage", undefined, "Aucune image")}</span>
                  </div>
                  <div className="resource-pose-main">
                    <div className="resource-pose-default-preview">
                      {defaultPoseUrl ? <img alt="" src={defaultPoseUrl} /> : <span>{t("resources.noImage", undefined, "Aucune image")}</span>}
                    </div>
                    <div className="resource-pose-details">
                      {poses.length > 1 ? (
                        <label className="resource-pose-default-select">
                          <span>{t("resources.defaultPose", undefined, "Pose par défaut")}</span>
                          <select
                            onChange={(event) =>
                              onSetDefaultPose(selectedCharacter?.id ?? "", state.key, event.target.value)
                            }
                            value={defaultPose?.assetRef ?? ""}
                          >
                            {poses.map((pose) => (
                              <option key={pose.assetRef} value={pose.assetRef}>
                                {pose.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <span className="resource-pose-file-name">
                        {defaultPose ? defaultPose.label : t("resources.noDefaultPose", undefined, "Aucune pose par défaut")}
                      </span>
                    </div>
                    <div className="resource-pose-actions">
                      <label className={`ghost-pill compact resource-pose-upload-button ${canUploadPose ? "" : "disabled"}`}>
                        <span className="resource-pose-upload-label">{t("common.replace", undefined, "Remplacer")}</span>
                        <input
                          accept="image/png,image/jpeg,image/webp"
                          disabled={!canUploadPose}
                          onChange={(event) => onUploadPose(state.key, event.target.files?.[0] ?? null, true)}
                          type="file"
                        />
                      </label>
                      <label className={`ghost-pill compact resource-pose-upload-button ${canUploadPose ? "" : "disabled"}`}>
                        <span className="resource-pose-upload-label">{t("resources.addPose", undefined, "Ajouter une pose")}</span>
                        <input
                          accept="image/png,image/jpeg,image/webp"
                          disabled={!canUploadPose}
                          onChange={(event) => onUploadPose(state.key, event.target.files?.[0] ?? null, false)}
                          type="file"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!canUploadPose ? (
            <div className="library-rail-empty">{t("resources.saveCharacterBeforeImages", undefined, "Enregistrez le personnage avant d'ajouter ses images.")}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
