import data from './designerKnowledge.data.json';
export type PaideiaActivityKnowledge = {
  id: string;
  blockType: string;
  name: string;
  aliases: string[];
  purpose: string;
  whenToUse: string[];
  howItWorks: string;
  howTo?: string[];
  cautions?: string[];
};

export const PAIDEIA_ACTIVITY_CATALOG: PaideiaActivityKnowledge[] = data.activities;
export const PAIDEIA_HELP_PROCEDURES: Array<{ id: string; name: string; aliases: string[]; summary: string; steps: string[] }> = data.procedures;
