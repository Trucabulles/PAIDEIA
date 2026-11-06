import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'vite';

export function understandingStore(root) {
  const file = join(root, 'src/features/designer-actions/designerUnderstanding.data.json');
  const runtime = createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'silent' });
  let writes = Promise.resolve();
  async function modules() {
    const vite = await runtime;
    return Promise.all([
      vite.ssrLoadModule('/src/features/designer-actions/designerUnderstanding.ts'),
      vite.ssrLoadModule('/src/features/designer-actions/designerCapabilityRegistry.ts'),
      vite.ssrLoadModule('/src/features/designer-actions/designerSocialRegistry.ts'),
      vite.ssrLoadModule('/src/features/designer-actions/designerHelpEngine.ts')
    ]);
  }
  return {
    async read() {
      const [, capabilities] = await modules();
      return { registry: JSON.parse(await readFile(file, 'utf8')), capabilities: capabilities.DESIGNER_CAPABILITIES.filter(item => item.operationKinds.length) };
    },
    async validate(payload) {
      const [understanding, , social, help] = await modules();
      if (!Array.isArray(payload?.rules)) return { ok: false, errors: ['Liste de règles requise.'] };
      const errors = understanding.validateUnderstanding(payload.rules);
      if(payload.synonyms !== undefined && (!Array.isArray(payload.synonyms) || payload.synonyms.some(item=>!item || typeof item.canonical!=='string' || !item.canonical.trim() || !Array.isArray(item.forms) || item.forms.some(value=>typeof value!=='string'))))errors.push('Synonymes invalides.');
      const warnings = [];
      if (!errors.length) for (const rule of payload.rules) for (const phrase of [...rule.phrases, ...rule.positive]) {
        if (social.matchDesignerSocialResponse(phrase)) warnings.push(`${rule.id} : le social reconnaît aussi « ${phrase} ».`);
        if (help.resolveDesignerHelp(phrase)) warnings.push(`${rule.id} : l’aide reconnaît aussi « ${phrase} ».`);
      }
      const matches = !errors.length && payload.query ? understanding.matchUnderstandingRules(payload.query, payload.rules).map(rule => ({ id: rule.id, capabilityId: rule.capabilityId })) : [];
      return { ok: !errors.length, errors, warnings, matches };
    },
    save(payload) {
      const operation = writes.then(async () => {
        const result = await this.validate(payload.registry);
        if (!result.ok) return result;
        const previous = await readFile(file, 'utf8');
        if (JSON.stringify(JSON.parse(previous)) !== JSON.stringify(payload.previous)) throw new Error('Le registre a changé. Rechargez avant de sauvegarder.');
        const backups = join(root, 'tools/arion-registry-editor/backups');
        await mkdir(backups, { recursive: true });
        await copyFile(file, join(backups, `${Date.now()}-understanding.json`));
        await writeFile(`${file}.tmp`, JSON.stringify(payload.registry, null, 2) + '\n');
        await rename(`${file}.tmp`, file);
        return result;
      });
      writes = operation.catch(() => {});
      return operation;
    }
  };
}
