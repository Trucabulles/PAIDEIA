/** Resolve a navigation command without feeding it into the editing pipeline. */
export function parseArionActivityJump(command: string): string | null {
  const input = command.trim().replace(/[’]/g, "'");
  const match = /^(?:ouvre|ouvrir|va\s+[àa]|aller\s+[àa])\s+(?:(?:l'activité|une activité)\s+(?:(?:avec|portant)\s+)?(?:(?:l')?id\s*[:#]?\s*)?|(?:l')?id\s*[:#]?\s*)?([\w-]+|«\s*[\w-]+\s*»|`[\w-]+`|"[\w-]+")\s*[.!?]?$/iu.exec(input);
  if (!match) return null;
  const id = match[1].replace(/[«»`"\s]/g, "");
  return /\bid\b/i.test(input) || /^(?:[a-z0-9]{8}|(?=.{3,128}$)(?=.*\d)[\w-]+)$/i.test(id) ? id : null;
}
