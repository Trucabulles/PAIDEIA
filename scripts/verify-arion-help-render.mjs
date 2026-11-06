import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const vite = await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try {
  const {DesignerHelpText}=await vite.ssrLoadModule('/src/features/designer-actions/DesignerHelpText.tsx');
  const html=renderToStaticMarkup(createElement(DesignerHelpText,{text:'## Sous-titres\n\nLe corps reste normal, **ceci est important** et `Apparence` est du code.\n\n- Un réglage\n- Un autre\n\n| Raccourci | Action | État |\n|---|:---:|---:|\n| `Ctrl + S` | **Enregistrer** | Prêt |\n| `Ctrl + \\|` | Afficher le séparateur | Non |\n\n```text\nDécrire une demande\n  ↓\nAppliquer ou annuler\n```\n\n<script>alert(1)</script>\n\n## '}));
  assert.match(html,/<strong>Sous-titres<\/strong>/);
  assert.match(html,/<p>Le corps reste normal, <strong>ceci est important<\/strong> et <code>Apparence<\/code> est du code\.<\/p>/);
  assert.match(html,/<ul><li>Un réglage<\/li><li>Un autre<\/li><\/ul>/);
  assert.match(html,/<div class="designer-help-table-scroll" tabindex="0"><table><thead><tr><th scope="col">Raccourci<\/th><th class="align-center" scope="col">Action<\/th><th class="align-right" scope="col">État<\/th><\/tr><\/thead>/);
  assert.match(html,/<tbody><tr><td><code>Ctrl \+ S<\/code><\/td><td class="align-center"><strong>Enregistrer<\/strong><\/td><td class="align-right">Prêt<\/td><\/tr>/);
  assert.match(html,/<code>Ctrl \+ \|<\/code>/);
  assert.ok(!html.includes('|---|'));
  assert.match(html,/<pre class="designer-help-code" data-language="text"><code>Décrire une demande\n  ↓\nAppliquer ou annuler<\/code><\/pre>/);
  assert.ok(!html.includes('```'));
  assert.ok(!html.includes('<script>'));
  console.log('Aide Arion : titres, paragraphes, listes, tableaux, code Markdown et HTML non exécuté vérifiés.');
} finally { await vite.close(); }
