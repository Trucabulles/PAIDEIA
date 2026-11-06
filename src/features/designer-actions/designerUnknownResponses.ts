export const DESIGNER_UNKNOWN_RESPONSES = [
  "Je n'ai pas compris votre demande.",
  "Je ne suis pas certain d’avoir compris. Pouvez-vous reformuler ?",
  "Je n’ai pas réussi à identifier votre demande. Pouvez-vous la préciser ?",
  "Je ne vois pas encore ce que vous souhaitez faire. Dites-m’en un peu plus.",
  "Cette demande m’échappe encore. Pouvez-vous l’exprimer autrement ?",
  "Comment ?",
  "Ce n’est pas très clair pour moi…"
] as const;

export function resolveDesignerUnknownResponse(
  previousResponse?: string,
  random: () => number = Math.random
) {
  const candidates = DESIGNER_UNKNOWN_RESPONSES.length > 1 && previousResponse
    ? DESIGNER_UNKNOWN_RESPONSES.filter((response) => response !== previousResponse)
    : DESIGNER_UNKNOWN_RESPONSES;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}
