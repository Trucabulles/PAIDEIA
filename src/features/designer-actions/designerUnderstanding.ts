import data from './designerUnderstanding.data.json';
import { DESIGNER_CAPABILITIES } from './designerCapabilityRegistry';
import { normalizeDesignerText, designerEditDistance } from './designerLanguage';

export type UnderstandingRule = { id: string; capabilityId: string; phrases: string[]; patterns: string[]; positive: string[]; negative: string[] };
export function expandUnderstandingSynonyms(normalized: string) {
  let value=normalized;
  for(const item of data.synonyms ?? [])for(const form of item.forms) {
    const escaped=normalizeDesignerText(form).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(escaped)value=value.replace(new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`,'g'),match=>`${match.startsWith(' ')?' ':''}${normalizeDesignerText(item.canonical)}`);
  }
  return value;
}
export function matchUnderstandingRules(command: string, rules: UnderstandingRule[] = data.rules) {
  const normalized = normalizeDesignerText(command);
  return rules.filter(rule => rule.phrases.some(phrase => normalizeDesignerText(phrase) === normalized)
    || rule.patterns.some(pattern => new RegExp(pattern, 'iu').test(normalized)));
}
export function validateUnderstanding(rules: UnderstandingRule[]) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') { errors.push('Règle invalide.'); continue; }
    if (!rule || typeof rule.id !== 'string' || !/^[a-z0-9-]+$/.test(rule.id) || ids.has(rule.id)) errors.push('Identifiant manquant, invalide ou dupliqué.');
    ids.add(rule?.id);
    if (!DESIGNER_CAPABILITIES.some(capability => capability.id === rule.capabilityId && capability.operationKinds.length)) errors.push(`${rule.id} : capacité inconnue.`);
    for (const field of ['phrases', 'patterns', 'positive', 'negative'] as const) {
      if (!Array.isArray(rule[field]) || rule[field].some(value => typeof value !== 'string')) errors.push(`${rule.id} : ${field} doit être une liste de textes.`);
    }
  }
  if (errors.length) return errors;
  for (const rule of rules) {
    try {
      rule.patterns.forEach(pattern => new RegExp(pattern, 'iu'));
      for (const phrase of [...rule.phrases, ...rule.positive]) {
        const matches = matchUnderstandingRules(phrase, rules);
        if (!matches.some(match => match.id === rule.id)) errors.push(`${rule.id} : exemple non reconnu « ${phrase} ».`);
        if (new Set(matches.map(match => match.capabilityId)).size > 1) errors.push(`${rule.id} : collision entre actions pour « ${phrase} ».`);
      }
      for (const phrase of rule.negative) if (matchUnderstandingRules(phrase, [rule]).length) errors.push(`${rule.id} : faux positif « ${phrase} ».`);
    } catch (error) { errors.push(`${rule.id} : ${String(error)}`); }
  }
  return errors;
}
export function understandingCandidates(command: string) {
  return [...new Set(matchUnderstandingRules(command).map(rule => rule.capabilityId))]
    .flatMap(id => DESIGNER_CAPABILITIES.filter(capability => capability.id === id));
}

export function nearbyUnderstandingCandidates(command: string) {
  const tokens=normalizeDesignerText(command).split(' ');
  if(tokens.length<2)return [];
  const ids=data.rules.filter(rule=>rule.phrases.some(phrase=>{
    const expected=normalizeDesignerText(phrase).split(' ');
    if(expected.length!==tokens.length)return false;
    let differences=0;
    return expected.every((word,index)=>{
      if(word===tokens[index])return true;
      if(word.length<5 || tokens[index].length<5 || designerEditDistance(word,tokens[index])>1)return false;
      return ++differences<=1;
    });
  })).map(rule=>rule.capabilityId);
  return DESIGNER_CAPABILITIES.filter(capability=>ids.includes(capability.id)).slice(0,3);
}
