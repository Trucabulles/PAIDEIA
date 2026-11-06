import type { PaideiaProject } from "../../types/project";
import { normalizeDesignerText } from "./designerLanguage";
import { parseDesignerActivityTypeList } from "./designerValueExtractors";

export type DesignerActivityDeletionRequest = {
  activityType?: string;
  activityTypes?: string[];
  activityLabels?: string[];
  excludedActivityTypes?: string[];
  excludedActivityLabels?: string[];
  activityLabel: string;
  originalCommand: string;
  chapterReference?: string;
  chapterResolution?: "title" | "ordinal";
  resolvedChapterIds?: string[];
  resolvedChapterTitles?: string[];
};

export type DesignerActivityDeletionTarget = {
  pageId: string;
  blockId: string;
  chapterId: string;
  chapterTitle: string;
};

export type DesignerActivityDeletionPlan = DesignerActivityDeletionRequest & {
  stage: "intent" | "review" | "completed";
  projectPath: string;
  projectId: string;
  projectUpdatedAt: string;
  targets: DesignerActivityDeletionTarget[];
  snapshotId?: string;
  snapshotLabel?: string;
  postMutationUpdatedAt?: string;
};

export type DesignerActivityDeletionClarification = Pick<
  DesignerActivityDeletionRequest,
  "originalCommand" | "chapterReference" | "chapterResolution"
>;

type DesignerActivityDeletionEnvelope = DesignerActivityDeletionClarification & {
  qualifier?: string;
  requestedType?: string;
  mentionsActivity: boolean;
};

const ACTIVITY_DELETION_REQUEST_PREFIX = String.raw`(?:(?:peux tu|pouvez vous|pourrais tu|pourriez vous|merci de|veuillez|je veux|je voudrais|j aimerais)\s+)?`;
const ACTIVITY_DELETION_LEAD = String.raw`${ACTIVITY_DELETION_REQUEST_PREFIX}(?:supprime|supprimer|supprimez|efface|effacer|effacez|retire|retirer|retirez|suppression(?:\s+(?:de|des))?)`;

function parseDesignerActivityDeletionEnvelope(command: string): DesignerActivityDeletionEnvelope | null {
  const normalized = normalizeDesignerText(command).replace(/[.!?]+$/g, "").trim();
  const prefixedChapter = normalized.match(new RegExp(`^(?:dans|sur|pour)\\s+(?:(?:le|les)\\s+)?chapitres?\\s+(.+?)\\s*,?\\s*(${ACTIVITY_DELETION_LEAD}\\b.+)$`));
  const suffixedChapter = normalized.match(new RegExp(`^(${ACTIVITY_DELETION_LEAD}\\b.+?)\\s+(?:(?:dans|sur|pour)\\s+(?:(?:le|les)\\s+)?|(?:du|des)\\s+)chapitres?\\s+(.+)$`));
  const bareSuffixedChapter = normalized.match(new RegExp(`^(${ACTIVITY_DELETION_LEAD}\\b.+?)\\s+chapitres?\\s+(.+)$`));
  const destructiveCommand = prefixedChapter?.[2] ?? suffixedChapter?.[1] ?? bareSuffixedChapter?.[1] ?? normalized;
  const rawChapterReference = (prefixedChapter?.[1] ?? suffixedChapter?.[2] ?? bareSuffixedChapter?.[2])?.trim();
  const namedChapter = rawChapterReference?.match(/^(?:nomme|intitule)\s+(.+)$/);
  const numberedChapter = rawChapterReference?.match(/^numero\s+(.+)$/);
  const chapterReference = (namedChapter?.[1] ?? numberedChapter?.[1] ?? rawChapterReference)?.trim();
  const chapterResolution = namedChapter ? "title" as const : numberedChapter ? "ordinal" as const : undefined;
  const match = destructiveCommand.match(new RegExp(
    `^${ACTIVITY_DELETION_LEAD}(?:\\s+((?:toutes(?:\\s+les)?|les|des|l|la|le|un|une)))?(?:\\s+(activites?))?(?:\\s+(.+))?$`
  ));
  if (!match) return null;
  return {
    originalCommand: command.trim(),
    chapterReference,
    chapterResolution,
    qualifier: match[1]?.trim(),
    mentionsActivity: Boolean(match[2]),
    requestedType: match[3]?.trim()
  };
}

function deletionRequestFromTarget(
  target: string,
  base: DesignerActivityDeletionClarification
): DesignerActivityDeletionRequest | null {
  const normalizedTarget = normalizeDesignerText(target).replace(/[.!?]+$/g, "").trim();
  if (/^toutes(?:\s+(?:les\s+)?activites)?$/.test(normalizedTarget)) {
    return { activityLabel: "activités", ...base };
  }
  const compactExclusion = normalizedTarget.match(/^toutes(?:\s+(?:les\s+)?activites)?\s+sauf\s+(.+)$/)?.[1]?.trim();
  const withoutActivityPrefix = normalizedTarget
    .replace(/^(?:toutes(?:\s+les)?|les)?\s*activites\s+/, "")
    .trim();
  const exclusion = compactExclusion ?? withoutActivityPrefix.match(/^sauf\s+(.+)$/)?.[1]?.trim();
  if (exclusion) {
    const parsed = parseDesignerActivityTypeList(exclusion);
    if (!parsed?.activityTypes.length) return null;
    return {
      excludedActivityTypes: parsed.activityTypes,
      excludedActivityLabels: parsed.labels,
      activityLabel: "activités",
      ...base
    };
  }
  const parsed = parseDesignerActivityTypeList(withoutActivityPrefix);
  if (!parsed?.activityTypes.length) return null;
  return {
    activityType: parsed.activityTypes.length === 1 ? parsed.activityTypes[0] : undefined,
    activityTypes: parsed.activityTypes,
    activityLabels: parsed.labels,
    activityLabel: `activités ${parsed.labels.join(", ")}`,
    ...base
  };
}

// Deliberately narrow and anchored. Destructive commands must never be inferred
// from a substring, a mixed request or an approximate activity name.
export function parseDesignerActivityDeletionRequest(command: string): DesignerActivityDeletionRequest | null {
  const envelope = parseDesignerActivityDeletionEnvelope(command);
  if (!envelope) return null;
  const base = {
    originalCommand: envelope.originalCommand,
    chapterReference: envelope.chapterReference,
    chapterResolution: envelope.chapterResolution
  };
  if (!envelope.requestedType) {
    return envelope.qualifier?.startsWith("toutes")
      ? { activityLabel: "activités", ...base }
      : null;
  }
  return deletionRequestFromTarget(
    envelope.requestedType.startsWith("sauf") ? `toutes les activités ${envelope.requestedType}` : envelope.requestedType,
    base
  );
}

export function parseDesignerActivityDeletionClarification(command: string): DesignerActivityDeletionClarification | null {
  const envelope = parseDesignerActivityDeletionEnvelope(command);
  if (!envelope || !envelope.requestedType && envelope.qualifier?.startsWith("toutes")) return null;
  if (!envelope.mentionsActivity && !envelope.requestedType) return null;
  if (envelope.requestedType) {
    if (!envelope.mentionsActivity) return null;
    if (/\b(?:chapitres?|lecons?|dossiers?|projets?|boutons?)\b/.test(envelope.requestedType)) return null;
    if (/\b(?:et|puis|ensuite)\s+(?:mets|mettez|modifie|modifier|change|changer|applique|appliquer|supprime|supprimer)\b/.test(envelope.requestedType)) return null;
  }
  return {
    originalCommand: envelope.originalCommand,
    chapterReference: envelope.chapterReference,
    chapterResolution: envelope.chapterResolution
  };
}

export function completeDesignerActivityDeletionClarification(
  clarification: DesignerActivityDeletionClarification,
  answer: string
) {
  const directRequest = parseDesignerActivityDeletionRequest(answer);
  if (directRequest) return directRequest;
  return deletionRequestFromTarget(answer, {
    ...clarification,
    originalCommand: `${clarification.originalCommand} / ${answer.trim()}`
  });
}

export function collectDesignerActivityDeletionTargets(project: PaideiaProject, request: DesignerActivityDeletionRequest) {
  return project.course.modules.flatMap((module) => {
    return module.chapters
      .filter((chapter) => !request.resolvedChapterIds || request.resolvedChapterIds.includes(chapter.id))
      .flatMap((chapter) => chapter.pages.flatMap((page) => {
        return page.blocks
          .filter((block) => !request.activityTypes?.length || request.activityTypes.includes(block.type))
          .filter((block) => !request.excludedActivityTypes?.includes(block.type))
          .map((block) => ({ pageId: page.id, blockId: block.id, chapterId: chapter.id, chapterTitle: chapter.title }));
      }));
  });
}

export function designerDeletionFingerprint(targets: DesignerActivityDeletionTarget[]) {
  return targets.map(({ pageId, blockId }) => `${pageId}:${blockId}`).sort().join("|");
}
