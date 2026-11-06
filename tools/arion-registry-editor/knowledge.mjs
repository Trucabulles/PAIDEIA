import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
export function validateKnowledge(data) {
  const errors = [];
  if (!Array.isArray(data?.activities) || !Array.isArray(data?.procedures)) return ['Fiches et procédures requises.'];
  const ids = new Set();
  for (const [group, items] of Object.entries(data)) {
    if (!['activities', 'procedures'].includes(group)) continue;
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) { errors.push('Identifiant manquant ou dupliqué.'); continue; }
      ids.add(item.id);
      const texts = group === 'activities' ? ['name', 'blockType', 'purpose', 'howItWorks'] : ['name', 'summary'];
      const lists = group === 'activities' ? ['aliases', 'whenToUse'] : ['aliases', 'steps'];
      for (const key of texts) if (typeof item[key] !== 'string' || !item[key].trim()) errors.push(`${item.id} : ${key} requis.`);
      for (const key of [...lists, ...(group === 'activities' ? ['howTo', 'cautions'] : [])]) if ((lists.includes(key) || item[key] !== undefined) && (!Array.isArray(item[key]) || item[key].some(value => typeof value !== 'string'))) errors.push(`${item.id} : liste ${key} invalide.`);
    }
  }
  return errors;
}
export function knowledgeStore(root) {
  const file = join(root, 'src/features/designer-actions/designerKnowledge.data.json');
  let writes = Promise.resolve();
  return {
    async read() { return JSON.parse(await readFile(file, 'utf8')); },
    save(payload) {
      const job = writes.then(async () => {
        const errors = validateKnowledge(payload.registry);
        if (errors.length) return { ok: false, errors };
        const previous = await readFile(file, 'utf8');
        if (JSON.stringify(JSON.parse(previous)) !== JSON.stringify(payload.previous)) throw new Error('Les contenus ont changé. Rechargez avant de sauvegarder.');
        const backup = join(root, 'tools/arion-registry-editor/backups');
        await mkdir(backup, {recursive:true});
        await copyFile(file, join(backup, `${Date.now()}-knowledge.json`));
        await writeFile(`${file}.tmp`, JSON.stringify(payload.registry, null, 2) + '\n');
        await rename(`${file}.tmp`, file);
        return {ok:true};
      });
      writes = job.catch(() => {}); return job;
    }
  };
}
