import { useEffect, useState } from "react";
import { useI18n } from "../../../i18n/react";
import type { SituationalDialogueCharacterBankEditorProps } from "./types";
import "./SituationalDialogueActivity.css";

type DeleteSituationalDialogueCharacterDialogState = {
  characterId: string;
  characterName: string;
  poseCount: number;
};

export function SituationalDialogueCharacterBankEditor({
  imageAccept,
  characters,
  defaultCharacters,
  userCharacters,
  selectedDefaultCharacterId,
  selectedUserCharacterId,
  onSelectedDefaultCharacterChange,
  onSelectedUserCharacterChange,
  onImportDefaultCharacter,
  onImportUserCharacter,
  onUpdateCharacter,
  onUpdatePose,
  onUploadPose,
  onRemovePose,
  onAddPose,
  onRemoveCharacter,
  getDefaultPoseOptions,
  isDefaultAssetRef,
  getAssetDisplayName,
  getAssetUrl,
}: SituationalDialogueCharacterBankEditorProps) {
  const { t } = useI18n();
  const [expandedCharacterIds, setExpandedCharacterIds] = useState<string[]>(
    [],
  );
  const [deleteCharacterDialog, setDeleteCharacterDialog] =
    useState<DeleteSituationalDialogueCharacterDialogState | null>(null);

  useEffect(() => {
    const currentCharacterIds = new Set(
      characters.map((character) => character.id),
    );
    setExpandedCharacterIds((current) =>
      current.filter((characterId) => currentCharacterIds.has(characterId)),
    );
  }, [characters]);

  const toggleCharacterCard = (characterId: string) => {
    setExpandedCharacterIds((current) =>
      current.includes(characterId)
        ? current.filter((candidateId) => candidateId !== characterId)
        : [...current, characterId],
    );
  };

  const requestCharacterDelete = (
    characterId: string,
    characterName: string,
    poseCount: number,
  ) => {
    setDeleteCharacterDialog({
      characterId,
      characterName: characterName.trim(),
      poseCount,
    });
  };

  const confirmCharacterDelete = () => {
    if (!deleteCharacterDialog) {
      return;
    }
    onRemoveCharacter(deleteCharacterDialog.characterId);
    setDeleteCharacterDialog(null);
  };

  const characterDeleteTitle = deleteCharacterDialog?.characterName
    ? t("situationalDialogue.deleteCharacterNamedTitle", { name: deleteCharacterDialog.characterName }, "Supprimer « {name} » de l'activité ?")
    : t("situationalDialogue.deleteCharacterTitle", undefined, "Supprimer ce personnage de l'activité ?");

  const characterDeletePoseText = deleteCharacterDialog
    ? deleteCharacterDialog.poseCount === 1
      ? t("situationalDialogue.deleteCharacterPoseSingular", undefined, "Cette action supprimera également la pose associée.")
      : t("situationalDialogue.deleteCharacterPosePlural", { count: deleteCharacterDialog.poseCount }, "Cette action supprimera également les {count} poses associées.")
    : "";
  return (
    <div className="situational-dialogue-bank-editor">
      <div className="interactive-editor-header compact situational-dialogue-character-bank-header">
        <span className="editor-label">{t("situationalDialogue.characterBank", undefined, "Banque de personnages")}</span>
        <div className="situational-dialogue-character-header-actions">
          {defaultCharacters.length ? (
            <>
              <select
                onChange={(event) =>
                  onSelectedDefaultCharacterChange(event.target.value)
                }
                value={selectedDefaultCharacterId}
              >
                <option value="">{t("situationalDialogue.defaultCharacter")}</option>
                {defaultCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
              <button
                className="ghost-pill compact"
                disabled={!selectedDefaultCharacterId}
                onClick={onImportDefaultCharacter}
                type="button"
              >
                {t("situationalDialogue.importCharacter", undefined, "Importer le personnage")}
              </button>
            </>
          ) : null}
          {userCharacters.length ? (
            <>
              <select
                onChange={(event) =>
                  onSelectedUserCharacterChange(event.target.value)
                }
                value={selectedUserCharacterId}
              >
                <option value="">{t("situationalDialogue.characterBank", undefined, "Banque de personnages")}</option>
                {userCharacters.map((character) => (
                  <option
                    key={character.id}
                    style={character.id.startsWith("default:") ? { fontStyle: "italic" } : undefined}
                    value={character.id}
                  >
                    {character.name}
                  </option>
                ))}
              </select>
              <button
                className="ghost-pill compact"
                disabled={!selectedUserCharacterId}
                onClick={onImportUserCharacter}
                type="button"
              >
                {t("situationalDialogue.importCustomCharacter", undefined, "Importer le personnage perso")}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {characters.length ? (
        characters.map((character) => {
          const isCollapsed = !expandedCharacterIds.includes(character.id);
          const poseCount = character.poses.length;
          const defaultCharacterName = defaultCharacters.find(
            (candidate) => candidate.id === character.defaultCharacterId,
          )?.name?.trim();
          const characterDisplayName = character.name.trim() || defaultCharacterName || t("situationalDialogue.character");
          const characterDisplayRole = character.role?.trim() ?? "";

          return (
            <div
              className={`situational-dialogue-character-card ${isCollapsed ? "collapsed" : ""}`}
              key={character.id}
            >
              <div className="situational-dialogue-character-card-header">
                <button
                  aria-expanded={!isCollapsed}
                  aria-label={t(isCollapsed ? "situationalDialogue.expandCharacterAria" : "situationalDialogue.collapseCharacterAria", { name: characterDisplayName })}
                  className="situational-dialogue-character-collapse-button"
                  onClick={() => toggleCharacterCard(character.id)}
                  type="button"
                >
                  {isCollapsed ? "›" : "⌄"}
                </button>
                <div className="situational-dialogue-character-card-title">
                  <strong>{characterDisplayName}</strong>
                  {characterDisplayRole ? <span>{characterDisplayRole}</span> : null}
                </div>
                <span className="situational-dialogue-character-card-meta">
                  {t(poseCount > 1 ? "situationalDialogue.poseCountPlural" : "situationalDialogue.poseCount", { count: poseCount })}
                </span>
                <button
                  aria-label={t("situationalDialogue.deleteCharacterAria", { name: characterDisplayName })}
                  className="situational-dialogue-character-delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    requestCharacterDelete(
                      character.id,
                      character.name,
                      poseCount,
                    );
                  }}
                  title={t("situationalDialogue.deleteCharacterButton", undefined, "Supprimer le personnage")}
                  type="button"
                >
                  −
                </button>
              </div>

              {isCollapsed ? null : (
                <>
                  <div className="style-grid situational-dialogue-character-details-grid">
                    <label>
                      <span>{t("common.name", undefined, "Nom")}</span>
                      <input
                        onChange={(event) =>
                          onUpdateCharacter(character.id, {
                            name: event.target.value,
                          })
                        }
                        value={character.name}
                      />
                    </label>
                    <label>
                      <span>{t("situationalDialogue.role")}</span>
                      <input
                        onChange={(event) =>
                          onUpdateCharacter(character.id, {
                            role: event.target.value,
                          })
                        }
                        value={character.role ?? ""}
                      />
                    </label>
                    <label className="situational-dialogue-character-caption-toggle">
                      <input
                        checked={character.showNameRole ?? true}
                        onChange={(event) =>
                          onUpdateCharacter(character.id, {
                            showNameRole: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      <span>{t("situationalDialogue.showNameRole")}</span>
                    </label>
                    <label className="inspector-span-2">
                      <span>{t("situationalDialogue.description")}</span>
                      <textarea
                        onChange={(event) =>
                          onUpdateCharacter(character.id, {
                            description: event.target.value,
                          })
                        }
                        placeholder={t("situationalDialogue.descriptionPlaceholder")}
                        value={character.description ?? ""}
                      />
                    </label>
                  </div>
                  <div className="situational-dialogue-pose-list">
                    {character.poses.length ? (
                      character.poses.map((pose) => {
                        const defaultOptions = getDefaultPoseOptions(
                          character,
                          pose,
                        );
                        const poseUrl = getAssetUrl(pose.assetRef);
                        return (
                          <div className="situational-dialogue-pose-card" key={pose.id}>
                            <div className="style-grid">
                              <label>
                                <span>{t("situationalDialogue.label")}</span>
                                <input
                                  onChange={(event) =>
                                    onUpdatePose(character.id, pose.id, {
                                      label: event.target.value,
                                    })
                                  }
                                  value={pose.label}
                                />
                              </label>
                              <label>
                                <span>{t("situationalDialogue.state")}</span>
                                <select
                                  onChange={(event) =>
                                    onUpdatePose(character.id, pose.id, {
                                      state: event.target.value,
                                    })
                                  }
                                  value={pose.state ?? "neutral"}
                                >
                                  <option value="introduction">
                                    {t("situationalDialogue.introduction")}
                                  </option>
                                  <option value="question">
                                    {t("situationalDialogue.questionSituation", undefined, "Question / situation")}
                                  </option>
                                  <option value="neutral">{t("situationalDialogue.neutral")}</option>
                                  <option value="positive">
                                    {t("situationalDialogue.positiveResponse", undefined, "Réponse positive")}
                                  </option>
                                  <option value="negative">
                                    {t("situationalDialogue.negativeResponse", undefined, "Réponse négative")}
                                  </option>
                                  <option value="conclusion">{t("situationalDialogue.conclusion")}</option>
                                </select>
                              </label>
                              <label>
                                <span>{t("situationalDialogue.usage")}</span>
                                <select
                                  onChange={(event) =>
                                    onUpdatePose(character.id, pose.id, {
                                      usage: event.target
                                        .value as typeof pose.usage,
                                    })
                                  }
                                  value={pose.usage ?? "response"}
                                >
                                  <option value="introduction">{t("situationalDialogue.introduction", undefined, "Introduction")}</option>
                                  <option value="question">{t("situationalDialogue.question", undefined, "Question")}</option>
                                  <option value="conclusion">{t("situationalDialogue.conclusion", undefined, "Conclusion")}</option>
                                  <option value="response">{t("situationalDialogue.response", undefined, "Réponse")}</option>
                                  <option value="neutral">{t("situationalDialogue.neutral", undefined, "Neutre")}</option>
                                </select>
                              </label>
                              <label className="inspector-file-field">
                                <span>{t("situationalDialogue.posePng")}</span>
                                <input
                                  accept={imageAccept}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                      onUploadPose(character.id, pose.id, file);
                                    }
                                    event.target.value = "";
                                  }}
                                  type="file"
                                />
                              </label>
                              <label>
                                <span>{t("situationalDialogue.defaultAsset")}</span>
                                {defaultOptions.length ? (
                                  <select
                                    onChange={(event) =>
                                      onUpdatePose(character.id, pose.id, {
                                        assetRef: event.target.value || null,
                                      })
                                    }
                                    value={
                                      isDefaultAssetRef(pose.assetRef)
                                        ? (pose.assetRef ?? "")
                                        : ""
                                    }
                                  >
                                    <option value="">
                                      {t("situationalDialogue.noDefaultPose")}
                                    </option>
                                    {defaultOptions.map((option) => (
                                      <option
                                        key={option.assetRef}
                                        value={option.assetRef}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    onChange={(event) =>
                                      onUpdatePose(character.id, pose.id, {
                                        assetRef: event.target.value.trim(),
                                      })
                                    }
                                    placeholder="default-characters/axel/question/question.png"
                                    value={
                                      isDefaultAssetRef(pose.assetRef)
                                        ? (pose.assetRef ?? "")
                                        : ""
                                    }
                                  />
                                )}
                              </label>
                              <div className="media-config-meta inspector-span-2">
                                <strong>
                                  {getAssetDisplayName(pose.assetRef) ||
                                    t("media.noFileSelected")}
                                </strong>
                              </div>
                            </div>
                            <div
                              className={`media-thumbnail activity-item-thumbnail ${poseUrl ? "" : "empty"}`}
                            >
                              {poseUrl ? (
                                <img
                                  alt={`${characterDisplayName} - ${pose.label}`}
                                  className="media-thumbnail-image"
                                  src={poseUrl}
                                />
                              ) : (
                                <span className="media-thumbnail-empty">
                                  {t("situationalDialogue.posePreview", undefined, "Aperçu pose")}
                                </span>
                              )}
                            </div>
                            <div className="situational-dialogue-character-actions">
                              <button
                                className="ghost-pill compact"
                                onClick={() =>
                                  onRemovePose(character.id, pose.id)
                                }
                                type="button"
                              >
                                {t("situationalDialogue.deletePose", undefined, "Supprimer la pose")}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="editor-helper">
                        {t("situationalDialogue.addAtLeastOnePose")}
                      </p>
                    )}
                  </div>
                  <div className="situational-dialogue-character-actions">
                    <button
                      className="ghost-pill compact"
                      onClick={() => onAddPose(character.id, "question")}
                      type="button"
                    >
                      {t("situationalDialogue.addQuestionPose", undefined, "Ajouter une pose question")}
                    </button>
                    <button
                      className="ghost-pill compact"
                      onClick={() => onAddPose(character.id, "response")}
                      type="button"
                    >
                      {t("situationalDialogue.addResponsePose", undefined, "Ajouter une pose réponse")}
                    </button>
                    <button
                      className="ghost-pill compact"
                      onClick={() =>
                        requestCharacterDelete(
                          character.id,
                          character.name,
                          poseCount,
                        )
                      }
                      type="button"
                    >
                      {t("situationalDialogue.deleteCharacterButton", undefined, "Supprimer le personnage")}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })
      ) : (
        <p className="editor-helper">{t("situationalDialogue.multipleCharactersHelp")}</p>
      )}
      {deleteCharacterDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <div
            aria-modal="true"
            className="paideia-modal"
            role="dialog"
            aria-labelledby="situational-dialogue-character-delete-title"
          >
            <p className="modal-kicker">{t("situationalDialogue.deleteCharacterKicker")}</p>
            <h2 id="situational-dialogue-character-delete-title">{characterDeleteTitle}</h2>
            <p>{characterDeletePoseText}</p>
            <div className="modal-actions">
              <button
                className="ghost-pill"
                onClick={() => setDeleteCharacterDialog(null)}
                type="button"
              >
                {t("common.cancel", undefined, "Annuler")}
              </button>
              <button
                className="danger-pill"
                onClick={confirmCharacterDelete}
                type="button"
              >
                {t("common.delete", undefined, "Supprimer")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
