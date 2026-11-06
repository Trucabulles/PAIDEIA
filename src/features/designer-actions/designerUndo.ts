import { normalizeDesignerText } from './designerLanguage';
import type { DesignerActionTarget } from './designerActionModel';
export function selectDesignerUndoTargets(request: string, targets: DesignerActionTarget[]): {targets: DesignerActionTarget[]; clarification?: string} {
  const text = normalizeDesignerText(request);
  if (!text || /^(?:annule|annuler)(?: tout| tout le lot| la derniere action| l action precedente| la derniere modification| ce qu on vient de faire)?$/.test(text) || /^(?:reviens|revient|retourne) en arriere$/.test(text)) return { targets };
  const rules: Array<[RegExp, RegExp]> = [[/libelle|intitule/, /Label/],[/couleur.*texte|texte.*couleur/, /TextColor|CaptionColor/],[/fond/, /BackgroundColor/],[/hauteur/, /Height/],[/espacement|marge/, /Spacing/],[/couleur/, /Color/]];
  const match = rules.find(([pattern])=>pattern.test(text));
  if (!match) return { targets: [], clarification: 'Quel changement souhaitez-vous annuler ? Précisez la propriété, ou dites « annule tout le lot ».' };
  const selected = targets.filter(target=>match[1].test(target.property));
  if (new Set(selected.map(target=>target.property)).size>1) return {targets:[],clarification:'Souhaitez-vous annuler la couleur du fond ou celle du texte ?'};
  return {targets:selected};
}
