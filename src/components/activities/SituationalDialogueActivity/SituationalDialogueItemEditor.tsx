import { useI18n } from "../../../i18n/react";
import type { SituationalDialogueResponse } from "../../../types/project";
import type { SituationalDialogueItemEditorProps } from "./types";
import "./SituationalDialogueActivity.css";
import styles from "./SituationalDialogueItemEditor.module.css";

const SITUATIONAL_DIALOGUE_SEQUENCE_POSE_STATES = [
  { state: "question", labelKey: "situationalDialogue.questionPose" },
  { state: "positive", labelKey: "situationalDialogue.positivePose" },
  { state: "negative", labelKey: "situationalDialogue.negativePose" }
] as const;

export function SituationalDialogueItemEditor({
  item,
  isIntroduction,
  isConclusion,
  characters,
  responses,
  onUpdateItem,
  onAssignCharacter,
  onAddResponse,
  onUpdateResponse,
  onRemoveResponse,
  renderRichTextField
}: SituationalDialogueItemEditorProps) {
  const { t } = useI18n();
  const effectiveCharacterId = item.characterId || characters[0]?.id || "";
  const selectedCharacter = effectiveCharacterId
    ? characters.find((character) => character.id === effectiveCharacterId) ?? null
    : null;

  const updateSituationalDialoguePoseRef = (state: string, assetRef: string) => {
    const nextPoseRefs = { ...(item.situationalDialoguePoseRefs ?? {}) };
    if (assetRef) {
      nextPoseRefs[state] = assetRef;
    } else {
      delete nextPoseRefs[state];
    }

    onUpdateItem({
      situationalDialoguePoseRefs: nextPoseRefs
    });
  };

  const renderPoseSelector = (state: string, label: string) => {
    if (!selectedCharacter) {
      return null;
    }
    const poses = selectedCharacter.poses.filter((pose) => pose.state === state && pose.assetRef?.trim());
    const currentValue = item.situationalDialoguePoseRefs?.[state] || poses[0]?.assetRef || "";
    return (
      <label className={styles.poseSelect}>
        <span>{label}</span>
        <select
          disabled={poses.length <= 1}
          onChange={(event) => updateSituationalDialoguePoseRef(state, event.target.value)}
          value={currentValue}
        >
          {poses.length ? (
            poses.map((pose) => (
              <option key={pose.assetRef} value={pose.assetRef ?? ""}>
                {pose.label || pose.assetRef}
              </option>
            ))
          ) : (
            <option value="">{t("resources.noImage", undefined, "Aucune image")}</option>
          )}
        </select>
      </label>
    );
  };

  if (isIntroduction || isConclusion) {
    return (
      <div className={styles.conclusionEditor}>
        <div className={`style-grid ${styles.metaGrid}`}>
          <label>
            <span>{t("situationalDialogue.bankCharacter", undefined, "Personnage de la banque")}</span>
            <select
              onChange={(event) => onAssignCharacter(event.target.value)}
              value={effectiveCharacterId}
            >
              <option value="">{t("situationalDialogue.noLinkedCharacter", undefined, "Aucun personnage lié")}</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
          {renderPoseSelector(
            isIntroduction ? "introduction" : "conclusion",
            isIntroduction ? t("situationalDialogue.introductionPose") : t("situationalDialogue.conclusionPose")
          )}
        </div>
        {renderRichTextField({
          className: "inspector-span-2",
          field: "contentHtml",
          html: item.contentHtml || "<p></p>",
          item,
          label: isIntroduction ? t("situationalDialogue.introductionText", undefined, "Texte d'introduction") : t("situationalDialogue.generalFeedback", undefined, "Feedback général"),
          minRows: "large",
          placeholder: isIntroduction ? t("situationalDialogue.introductionPlaceholder", undefined, "Saisissez le texte d'introduction") : t("situationalDialogue.conclusionPlaceholder", undefined, "Saisissez le texte de conclusion")
        })}
        <p className="editor-helper">
          {isIntroduction ? (
            t("situationalDialogue.introductionHelp")
          ) : (
            t("situationalDialogue.conclusionHelp")
          )}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={`style-grid ${styles.metaGrid}`}>
        <label>
          <span>{t("situationalDialogue.character", undefined, "Personnage")}</span>
          <input
            onChange={(event) => onUpdateItem({ characterName: event.target.value })}
            placeholder={t("resources.characterName", undefined, "Nom du personnage")}
            value={item.characterName ?? ""}
          />
        </label>
        <label>
          <span>{t("resources.roleJob", undefined, "Rôle / métier")}</span>
          <input
            onChange={(event) => onUpdateItem({ characterRole: event.target.value })}
            placeholder={t("situationalDialogue.roleExample", undefined, "Ex : Analyste cybersécurité")}
            value={item.characterRole ?? ""}
          />
        </label>
        <label>
          <span>{t("situationalDialogue.bankCharacter", undefined, "Personnage de la banque")}</span>
          <select
            onChange={(event) => onAssignCharacter(event.target.value)}
            value={effectiveCharacterId}
          >
            <option value="">{t("situationalDialogue.noLinkedCharacter", undefined, "Aucun personnage lié")}</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </label>
        {SITUATIONAL_DIALOGUE_SEQUENCE_POSE_STATES.map((poseState) => (
          <div key={poseState.state}>{renderPoseSelector(poseState.state, t(poseState.labelKey))}</div>
        ))}
      </div>
      <div className={styles.contentField}>
        {renderRichTextField({
          field: "contentHtml",
          html: item.contentHtml || "<p></p>",
          item,
          label: t("situationalDialogue.situationText", undefined, "Texte de situation / dialogue"),
          minRows: "large",
          placeholder: t("situationalDialogue.situationPlaceholder", undefined, "Saisissez le texte de la situation")
        })}
      </div>
      <div className={`situational-dialogue-response-editor ${styles.responses}`}>
        <div className="interactive-editor-header compact">
          <span className="editor-label">{t("situationalDialogue.choicesAndFeedback", undefined, "Choix et feedbacks")}</span>
          <button className="ghost-pill compact" onClick={onAddResponse} type="button">
            {t("situationalDialogue.addChoice", undefined, "Ajouter un choix")}
          </button>
        </div>
        {responses.map((response, responseIndex) => (
          <div className={styles.responseCard} key={response.id}>
            {renderRichTextField({
              field: `choiceLabel:${response.id}`,
              html: response.label || "",
              item,
              label: t("situationalDialogue.choiceNumber", { number: responseIndex + 1 }),
              minRows: "compact",
              placeholder: t("situationalDialogue.choiceNumber", { number: responseIndex + 1 })
            })}
            <label>
              <span>{t("situationalDialogue.actionAfterFeedback", undefined, "Action après feedback")}</span>
              <select
                onChange={(event) =>
                  onUpdateResponse(response.id, {
                    action: event.target.value as SituationalDialogueResponse["action"]
                  })
                }
                value={response.action ?? "continue"}
              >
                <option value="continue">{t("common.continue", undefined, "Continuer")}</option>
                <option value="tryAgain">{t("situationalDialogue.tryAgain", undefined, "Essayer encore")}</option>
              </select>
            </label>
            {renderRichTextField({
              className: "inspector-span-2",
              field: `choiceFeedback:${response.id}`,
              html: response.feedbackHtml || "<p></p>",
              item,
              label: t("situationalDialogue.feedback"),
              minRows: "medium",
              placeholder: t("situationalDialogue.feedbackPlaceholder", undefined, "Saisissez le feedback")
            })}
            <button
              className="ghost-pill compact"
              onClick={() => onRemoveResponse(response.id)}
              type="button"
            >
              {t("situationalDialogue.deleteChoice", undefined, "Supprimer ce choix")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
