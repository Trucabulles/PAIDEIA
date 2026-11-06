import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createMassifiableStore(root) {
  const report = join(root, 'Dev_Documentation/07_Qualite/Audit_Couverture_Massifiable_Arion.json');
  const file = join(root, 'tools/arion-registry-editor/data/massifiable-decisions.json');
  let pending = Promise.resolve();
  async function read() {
    const audit = JSON.parse(await readFile(report, 'utf8'));
    const saved = await readFile(file, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return { decisions: {} }; throw error; });
    const current = new Set(audit.rows.map(row => row.property));
    return { ...audit, rows: audit.rows.map(row => ({ ...row, decision: saved.decisions[row.property]?.decision ?? '', notes: saved.decisions[row.property]?.notes ?? '', changed: Boolean(saved.decisions[row.property] && saved.decisions[row.property].type !== row.type) })), obsolete: Object.entries(saved.decisions).filter(([key]) => !current.has(key)).map(([property, value]) => ({ property, ...value })) };
  }
  function save(payload) {
    const operation = pending.then(async () => {
      const snapshot = await read();
      const rows = new Map(snapshot.rows.map(row => [row.property, row]));
      if (!Array.isArray(payload.decisions)) throw new Error('Décisions invalides.');
      const saved = await readFile(file, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return { decisions: {} }; throw error; });
      for (const item of payload.decisions) {
        if (!rows.has(item.property) || !['', 'À retenir', 'À exclure', 'À arbitrer'].includes(item.decision) || typeof item.notes !== 'string' || item.notes.length > 5000) throw new Error('Décision ou propriété invalide.');
        saved.decisions[item.property] = { decision: item.decision, notes: item.notes, type: rows.get(item.property).type };
      }
      await mkdir(join(root, 'tools/arion-registry-editor/data'), { recursive: true });
      await copyFile(file, `${file}.${Date.now()}-${randomUUID()}.bak`).catch(error => { if (error.code !== 'ENOENT') throw error; });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify({ version: 1, decisions: saved.decisions }, null, 2) + '\n');
      await rename(temporary, file);
      return { ok: true };
    });
    pending = operation.catch(() => {});
    return operation;
  }
  return { read, save };
}
