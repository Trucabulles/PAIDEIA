import type { DesignerActionIntent, DesignerActionOperation } from './designerActionModel';
import { normalizeDesignerText } from './designerLanguage';

export function prepareDesignerFollowUp(command: string, previous: DesignerActionIntent | null) {
  if (!previous) return {command, append:false};
  const normalized=normalizeDesignerText(command);
  const scopeOnly=/^(?:(?:non|finalement|en fait)\s+)?(?:seulement|uniquement|juste)?\s*(?:dans |pour |sur )?(?:ce chapitre|le chapitre courant|toute la lecon|toute la formation|partout)$/.test(normalized);
  if(scopeOnly)return {command,append:false,intent:{...previous,scope:/chapitre/.test(normalized)?'chapter' as const:'lesson' as const,chapterReference:undefined,chapterResolution:undefined}};
  const append=/^(?:et |aussi |puis |ensuite )/.test(normalized);
  if(!append)return {command,append:false};
  let resolved=command.replace(/^(?:et|aussi|puis|ensuite)\s+/i,'');
  if(previous.operations.every(operation=>operation.kind.includes('continue-button'))) {
    resolved=resolved.replace(/\bleur\b/gi,'des boutons Continuer').replace(/\bles\b(?!\s+boutons)/gi,'les boutons Continuer');
    if(!/bouton/i.test(resolved))resolved+=' pour les boutons Continuer';
  }
  return {command:resolved,append:true};
}
export function mergeDesignerOperations(previous: DesignerActionOperation[], additions: DesignerActionOperation[]) {
  // Keep order for reset then set; exact duplicate requests need no second operation.
  return [...previous,...additions].filter((operation,index,all)=>all.findIndex(candidate=>JSON.stringify(candidate)===JSON.stringify(operation))===index);
}
