import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMassifiableStore } from '../tools/arion-registry-editor/massifiable.mjs';
import { createServer } from 'vite';

const root = await mkdtemp(join(tmpdir(), 'arion-management-'));
await mkdir(join(root, 'Dev_Documentation/07_Qualite'), { recursive: true });
const file = join(root, 'Dev_Documentation/07_Qualite/Audit_Couverture_Massifiable_Arion.json');
const rows = [{ property: 'block.contentWidth', type: 'string', family: 'Texte' }];
await writeFile(file, JSON.stringify({ rows }));
const store = createMassifiableStore(root);
await store.save({ decisions: [{ property: rows[0].property, decision: 'À retenir', notes: 'Commun' }] });
assert.equal((await store.read()).rows[0].decision, 'À retenir');
await writeFile(file, JSON.stringify({ rows: [{ ...rows[0], type: 'number' }] }));
assert.equal((await store.read()).rows[0].changed, true);
await assert.rejects(store.save({ decisions: [{ property: 'unknown', decision: 'À retenir', notes: '' }] }));
await writeFile(file, JSON.stringify({ rows: [] }));
assert.equal((await store.read()).obsolete[0].property, rows[0].property);
assert.ok(await readFile(join(root, 'tools/arion-registry-editor/data/massifiable-decisions.json'), 'utf8'));

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { designerDocumentationDisplayTitle, searchDesignerDocumentation, DESIGNER_DOCUMENTATION_REGISTRY, relatedDesignerDocumentation } = await vite.ssrLoadModule('/src/features/designer-actions/designerDocumentationRegistry.ts');
  const { suggestDesignerHelp, resolveDesignerHelp } = await vite.ssrLoadModule('/src/features/designer-actions/designerHelpEngine.ts');
  const { parseDesignerConversationTurn: turn } = await vite.ssrLoadModule('/src/features/designer-actions/designerActionEngine.ts');
  for (const request of ['Aide', 'aide-moi', 'Peux-tu m’aider ?', 'pouvez-vous m’aider', 'tu peux m’aider ?', 'J’ai besoin d’aide', 'aidez-moi SVP']) {
    const result = turn(request);
    assert.equal(result.status, 'incomplete', request);
    assert.equal(result.question, 'help-topic', request);
    assert.equal(turn('vidéo', result.draft).status, 'help');
    assert.equal(turn('rien', result.draft).status, 'cancelled');
    assert.equal(turn('zzzzintrouvable', result.draft).status, 'incomplete');
    assert.equal(turn('modifier la couleur du texte de la leçon', result.draft).status, 'incomplete');
  }
  assert.equal(turn('Peux-tu m’aider sur la vidéo ?').status, 'help');
  const groupedEntry = DESIGNER_DOCUMENTATION_REGISTRY.find(entry => entry.groupId && relatedDesignerDocumentation(entry).length);
  assert.ok(groupedEntry, 'Une documentation découpée doit conserver son groupe de rubriques');
  const groupedHelp = resolveDesignerHelp(`Aide ${groupedEntry.title}`);
  assert.ok(groupedHelp?.relatedTopics?.length, 'Une rubrique doit proposer les autres rubriques du même document');
  assert.ok(groupedHelp.relatedTopics.every(topic => /^(?:Rubrique précédente : .+|Rubrique suivante : .+|Toutes les rubriques de cette aide)$/.test(topic.command)), 'La navigation documentaire doit annoncer clairement la destination proposée');
  assert.ok(groupedHelp.relatedTopics.every(topic => topic.id !== `documentation:${groupedEntry.id}`), 'La rubrique courante ne doit pas être reproposée');
  assert.ok(groupedHelp.relatedTopics.every(topic => topic.id === `documentation:${groupedEntry.groupId}-all` || DESIGNER_DOCUMENTATION_REGISTRY.find(entry => `documentation:${entry.id}` === topic.id)?.groupId === groupedEntry.groupId), 'Les rubriques connexes doivent rester dans le document de l’activité courante');
  const configurationEntries = DESIGNER_DOCUMENTATION_REGISTRY.filter(entry => entry.title === 'Configuration');
  assert.ok(configurationEntries.length > 1, 'Le corpus doit couvrir le cas des titres génériques répétés');
  assert.equal(new Set(configurationEntries.map(designerDocumentationDisplayTitle)).size, configurationEntries.length, 'Chaque titre générique doit être qualifié par son activité');
  const configurationSuggestions = suggestDesignerHelp('configuration');
  assert.equal(new Set(configurationSuggestions.map(topic => topic.command)).size, configurationSuggestions.length, 'Les choix de configuration affichés doivent être non ambigus');
  const relatedDraft = { context: 'help', scope: 'lesson', operations: [], pendingSlots: ['help-related'], candidateCommands: [...groupedHelp.relatedTopics.map(topic => topic.command), 'Autre sujet'], candidateSubjectIds: [...groupedHelp.relatedTopics.map(topic => topic.id.replace(/^documentation:/, '')), ''] };
  assert.equal(turn('oui', relatedDraft).status, 'incomplete');
  const relatedChoice = turn(groupedHelp.relatedTopics[0].command.replace(/^Aide\s+/, ''), relatedDraft);
  assert.equal(relatedChoice.status, 'help');
  assert.equal(relatedChoice.response.subjectId, groupedHelp.relatedTopics[0].id.replace(/^documentation:/, ''));
  const otherTopic = turn('autre sujet', relatedDraft);
  assert.equal(otherTopic.status, 'incomplete');
  assert.equal(otherTopic.question, 'help-topic');
  assert.equal(turn('non merci', relatedDraft).status, 'cancelled');
  assert.equal(turn('bonjour', relatedDraft).status, 'social', 'Une interaction sociale doit sortir du choix de rubrique');
  assert.equal(turn('Mets la hauteur d’apparence de toutes les activités vidéo sur minimale', relatedDraft).status, 'ready', 'Une action de masse doit sortir du choix de rubrique');
  assert.ok(suggestDesignerHelp('vidéo').length > 1);
  assert.ok(suggestDesignerHelp('aide moi sur la vidéo').length > 1);
  assert.equal(suggestDesignerHelp('aide moi').length, 0);
  if (DESIGNER_DOCUMENTATION_REGISTRY.some(entry => entry.id === 'video-9')) {
    assert.equal(searchDesignerDocumentation('comment optimiser une vidéo')[0].entry.id, 'video-9');
    assert.ok(suggestDesignerHelp('sous-titre').some(entry => entry.id === 'documentation:video-4'));
    assert.ok(resolveDesignerHelp('aide vidéo'));
  }
  assert.equal(searchDesignerDocumentation('zzzzintrouvable').length, 0);
} finally { await vite.close(); }
console.log('Arion : conservation des décisions et recherche documentaire vérifiées.');
