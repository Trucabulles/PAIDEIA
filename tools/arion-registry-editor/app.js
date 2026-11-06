let data;
async function readJsonResponse(response, context = 'Réponse du serveur') {
  const content = await response.text();
  if (!content.trim()) {
    throw new Error(`${context} interrompue : le serveur n’a renvoyé aucun résultat. Rechargez l’outil pour vérifier l’état enregistré.`);
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`${context} illisible : le serveur n’a pas renvoyé un document JSON complet.`);
  }
}
async function fetchRegistry(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    const content = await readJsonResponse(response, 'Chargement');
    return { ok: response.ok, json: async () => content };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Le serveur ne répond pas dans le délai attendu (15 secondes). Réessayez ou relancez l’outil.');
    throw error;
  } finally { clearTimeout(timer); }
}
let documentation = { version: 1, entries: [] };
let documentationSources = { documents: [] };
let tab = "social";
let selected = { social: 0, help: 0 };
let intentScroll = { social: 0, help: 0 };
let analyzedImport = null;
let massifiableData = null;
let knowledgeData = null, knowledgePrevious = null;
async function renderKnowledge() {
  if (!knowledgeData) { const response = await fetchRegistry('/api/knowledge'); if (!response.ok) throw new Error('Chargement des contenus impossible.'); knowledgeData = await response.json(); knowledgePrevious = structuredClone(knowledgeData); }
  if (tab !== 'knowledge') return;
  workspace.replaceChildren();
  const editor = document.createElement('article'); editor.className = 'editor';
  const title = document.createElement('h2'); title.textContent = 'Contenus d’aide'; editor.append(title);
  for (const [group, label] of [['activities', 'Fiches activités'], ['procedures', 'Procédures']]) {
    const heading = document.createElement('h3'); heading.textContent = label; editor.append(heading);
    const add = document.createElement('button'); add.textContent = 'Ajouter'; add.onclick = () => { knowledgeData[group].push(group === 'activities' ? {id:`fiche-${Date.now()}`,name:'',blockType:'rich-text',aliases:[],purpose:'',howItWorks:'',whenToUse:[],howTo:[],cautions:[]} : {id:`procedure-${Date.now()}`,name:'',aliases:[],summary:'',steps:[]}); renderKnowledge(); }; editor.append(add);
    for (const item of knowledgeData[group]) {
      const card = document.createElement('details'); card.className = 'documentation-card';
      const summary = document.createElement('summary'); summary.textContent = item.name || 'Nouvelle fiche'; card.append(summary);
      const fields = group === 'activities' ? [['id','Identifiant'],['name','Titre'],['blockType','Type d’activité'],['purpose','Rôle'],['howItWorks','Fonctionnement'],['aliases','Mots-clés et synonymes',true],['whenToUse','Usages',true],['cautions','Limites',true],['howTo','Étapes',true]] : [['id','Identifiant'],['name','Titre'],['summary','Présentation'],['aliases','Mots-clés et synonymes',true],['steps','Étapes',true]];
      for (const [key,label,list] of fields) card.append(input(label,item[key],value => {item[key]=value;if(key==='name')summary.textContent=value;},{multiline:!['id','name','blockType'].includes(key),list,rows:3}));
      const remove = document.createElement('button'); remove.textContent='Supprimer';remove.onclick=()=>{knowledgeData[group]=knowledgeData[group].filter(entry=>entry!==item);renderKnowledge();};card.append(remove);editor.append(card);
    }
  }
  workspace.append(editor);
}
let understandingData = null, understandingPrevious = null;
async function renderUnderstanding() {
  if (!understandingData) {
    const response = await fetchRegistry('/api/understanding');
    if (!response.ok) throw new Error('Chargement de la compréhension impossible.');
    understandingData = await response.json();
    understandingPrevious = structuredClone(understandingData.registry);
  }
  if (tab !== 'understanding') return;
  workspace.replaceChildren();
  const editor = document.createElement('article'); editor.className = 'editor';
  const heading = document.createElement('h2'); heading.textContent = 'Compréhension des actions'; editor.append(heading);
  const hint = document.createElement('p'); hint.textContent = 'Chaque règle complète la reconnaissance d’une action existante. Les regex reçoivent le texte en minuscules, sans accents, avec apostrophes et tirets remplacés par des espaces. Les libellés à appliquer restent inchangés.'; editor.append(hint);
  const catalog = document.createElement('details'); catalog.className = 'understanding-action-catalog';
  const catalogSummary = document.createElement('summary');
  const ruleCount = understandingData.registry.rules.length;
  catalogSummary.textContent = `${understandingData.capabilities.length} actions existantes — ${ruleCount} règle${ruleCount === 1 ? '' : 's'} complémentaire${ruleCount === 1 ? '' : 's'}`;
  const catalogBody = document.createElement('div'); catalogBody.className = 'understanding-action-catalog-body';
  const catalogIntro = document.createElement('p'); catalogIntro.textContent = 'Ces actions sont déjà comprises par Arion. Consultez-les pour choisir l’action à laquelle ajouter de nouvelles formulations.';
  const catalogSearch = document.createElement('input'); catalogSearch.type = 'search'; catalogSearch.placeholder = 'Rechercher une action…'; catalogSearch.setAttribute('aria-label', 'Rechercher parmi les actions existantes');
  const catalogCount = document.createElement('small');
  const catalogList = document.createElement('ul'); catalogList.className = 'understanding-action-list';
  function refreshActionCatalog() {
    const query = catalogSearch.value.trim().toLocaleLowerCase('fr-FR');
    const matches = understandingData.capabilities.filter((capability) => `${capability.command} ${capability.id}`.toLocaleLowerCase('fr-FR').includes(query));
    catalogList.replaceChildren(...matches.map((capability) => {
      const item = document.createElement('li');
      const label = document.createElement('strong'); label.textContent = capability.command;
      const identifier = document.createElement('code'); identifier.textContent = capability.id;
      item.append(label, identifier);
      return item;
    }));
    catalogCount.textContent = query ? `${matches.length} action${matches.length === 1 ? '' : 's'} trouvée${matches.length === 1 ? '' : 's'}` : `${matches.length} actions disponibles`;
  }
  catalogSearch.addEventListener('input', refreshActionCatalog);
  refreshActionCatalog();
  catalogBody.append(catalogIntro, catalogSearch, catalogCount, catalogList);
  catalog.append(catalogSummary, catalogBody); editor.append(catalog);
  const synonymsTitle=document.createElement('h3');synonymsTitle.textContent='Vocabulaire commun';editor.append(synonymsTitle);
  understandingData.registry.synonyms ??= [];
  for(const item of understandingData.registry.synonyms){const card=document.createElement('section');card.className='documentation-card';card.append(input('Terme reconnu par Arion',item.canonical,value=>item.canonical=value),input('Synonymes',item.forms,value=>item.forms=value,{multiline:true,list:true,rows:2}));const remove=document.createElement('button');remove.textContent='Retirer ce groupe';remove.onclick=()=>{understandingData.registry.synonyms=understandingData.registry.synonyms.filter(entry=>entry!==item);renderUnderstanding();};card.append(remove);editor.append(card);}
  const addSynonym=document.createElement('button');addSynonym.textContent='Ajouter des synonymes';addSynonym.onclick=()=>{understandingData.registry.synonyms.push({canonical:'',forms:[]});renderUnderstanding();};editor.append(addSynonym);
  const add = document.createElement('button'); add.textContent = 'Ajouter une règle'; add.onclick = () => { understandingData.registry.rules.push({ id: `regle-${Date.now()}`, capabilityId: understandingData.capabilities[0].id, phrases: [], patterns: [], positive: [], negative: [] }); renderUnderstanding(); }; editor.append(add);
  const exportButton=document.createElement('button');exportButton.textContent='Exporter XLSX';
  exportButton.onclick=async()=>{try{const response=await fetch('/api/understanding-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(understandingData.registry)});if(!response.ok)throw new Error('Corrigez les erreurs de validation avant export.');const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download='arion-comprehension-actions.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){showStatus(error.message,true);}};
  const upload=document.createElement('input');upload.type='file';upload.accept='.xlsx';upload.hidden=true;
  upload.onchange=async()=>{const file=upload.files[0];upload.value='';if(!file)return;try{const response=await fetch('/api/understanding-import',{method:'POST',body:await file.arrayBuffer()});const result=await response.json();if(!result.ok)throw new Error((result.errors??['Import impossible']).join('\n'));const existing=new Map(understandingData.registry.rules.map(rule=>[rule.id,rule]));for(const rule of result.registry.rules)existing.set(rule.id,rule);understandingData.registry.rules=[...existing.values()];renderUnderstanding();showStatus('Règles importées en mémoire. Validez puis enregistrez. Les identifiants identiques sont remplacés.');}catch(error){showStatus(error.message,true);}};
  const importButton=document.createElement('button');importButton.textContent='Importer XLSX';importButton.onclick=()=>upload.click();editor.append(exportButton,importButton,upload);
  for (const rule of understandingData.registry.rules) {
    const card = document.createElement('section'); card.className = 'documentation-card';
    card.append(input('Identifiant', rule.id, value => rule.id = value));
    const field = input('Action existante', rule.capabilityId, value => rule.capabilityId = value, { select: understandingData.capabilities.map(item => item.id) });
    [...field.querySelector('select').options].forEach(option => { option.textContent = understandingData.capabilities.find(item => item.id === option.value).command; }); card.append(field);
    for (const [key, label] of [['phrases', 'Formulations et synonymes de la demande'], ['patterns', 'Regex — powertool'], ['positive', 'Doit être reconnu'], ['negative', 'Ne doit pas être reconnu']]) card.append(input(label, rule[key], value => rule[key] = value, { multiline: true, list: true, rows: 3 }));
    const remove = document.createElement('button'); remove.textContent = 'Supprimer cette règle'; remove.onclick = () => { understandingData.registry.rules = understandingData.registry.rules.filter(item => item !== rule); renderUnderstanding(); }; card.append(remove); editor.append(card);
  }
  let query = '';
  editor.append(input('Tester une demande', '', value => query = value));
  const test = document.createElement('button'); test.textContent = 'Tester et vérifier les collisions';
  const output = document.createElement('pre'); output.style.whiteSpace = 'pre-wrap';
  test.onclick = async () => { try { const response = await fetch('/api/understanding-test', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ...understandingData.registry, query }) }); output.textContent = JSON.stringify(await response.json(), null, 2); } catch (error) { showStatus(error.message, true); } };
  editor.append(test, output); workspace.append(editor);
}
async function renderMassifiable() {
  if (!massifiableData) {
    const response = await fetchRegistry('/api/massifiable');
    if (!response.ok) throw new Error('Impossible de charger le catalogue massifiable.');
    massifiableData = await response.json();
  }
  if (tab !== 'massifiable') return;
  workspace.innerHTML = '<article class="editor"><h2>Paramètres massifiables</h2><p>Les décisions sont conservées indépendamment des régénérations de l’audit.</p><div id="mass-filters"></div><p id="mass-count"></p><div id="mass-list"></div></article>';
  let query = '', family = '', decision = '';
  const filters = workspace.querySelector('#mass-filters');
  function refresh() {
    const rows = massifiableData.rows.filter(row => (!family || row.family === family) && (!decision || (decision === 'Non examinés' ? !row.decision : row.decision === decision)) && `${row.property} ${row.family}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
    workspace.querySelector('#mass-count').textContent = `${rows.length} paramètres · ${massifiableData.obsolete.length} décisions sur des propriétés disparues`;
    const list = workspace.querySelector('#mass-list'); list.replaceChildren();
    for (const row of rows) {
      const card = document.createElement('section'); card.className = 'documentation-card';
      const title = document.createElement('h3'); title.textContent = `${row.family} — ${row.property}`;
      const detail = document.createElement('p'); detail.textContent = `${row.proposal} · Accès Arion : ${row.arionAccess}${row.changed ? ' · Type modifié : révision nécessaire' : ''}`;
      card.append(title, detail, input('Décision', row.decision, value => { row.decision = value; }, { select: ['', 'À retenir', 'À exclure', 'À arbitrer'] }), input('Note', row.notes, value => { row.notes = value; }));
      list.append(card);
    }
  }
  filters.append(input('Rechercher', '', value => { query = value; refresh(); }), input('Famille', '', value => { family = value; refresh(); }, { select: ['', ...new Set(massifiableData.rows.map(row => row.family))] }), input('Décision', '', value => { decision = value; refresh(); }, { select: ['', 'Non examinés', 'À retenir', 'À exclure', 'À arbitrer'] }));
  refresh();
}
const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");

const lines = (value) => String(value ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const showStatus = (message, error = false) => {
  status.textContent = message;
  status.className = `show${error ? " error" : ""}`;
  window.clearTimeout(showStatus.timer);
  showStatus.timer = window.setTimeout(() => { status.className = ""; }, error ? 9000 : 5000);
};

function input(label, value, onInput, options = {}) {
  const field = document.createElement("label"); field.className = `field${options.full ? " full" : ""}`;
  field.innerHTML = `<span>${label}</span>`;
  const control = document.createElement(options.multiline ? "textarea" : options.select ? "select" : "input");
  if (options.multiline) control.rows = options.rows ?? 7;
  if (options.readOnly) control.readOnly = true;
  if (options.select) for (const option of options.select) control.add(new Option(option, option));
  control.value = options.multiline && options.list ? (value ?? []).join("\n") : value ?? "";
  control.addEventListener("input", () => onInput(options.multiline && options.list ? lines(control.value) : control.value));
  field.append(control);
  if (options.hint) { const hint = document.createElement("small"); hint.textContent = options.hint; field.append(hint); }
  return field;
}

function nextIntentId(entries) {
  let ordinal = entries.length + 1;
  while (entries.some((entry) => entry.id === `nouvelle-intention-${ordinal}`)) ordinal += 1;
  return `nouvelle-intention-${ordinal}`;
}

function renderIntent(kind) {
  const entries = data[kind].intents;
  selected[kind] = Math.min(selected[kind], Math.max(0, entries.length - 1));
  const current = entries[selected[kind]];
  workspace.innerHTML = `<div class="layout"><aside class="sidebar"><header><h2>Intentions</h2>${kind === "social" ? '<button id="add-intent" title="Ajouter une intention">+</button>' : ''}</header><div class="registry-actions"><button id="import-list" class="secondary" title="Importer une liste">Importer</button>${kind === "social" ? '<button id="export-social" class="secondary" title="Exporter toutes les intentions sociales">Exporter XLSX</button>' : ''}</div><ul class="intent-list"></ul></aside><article class="editor"></article></div>`;
  const list = workspace.querySelector(".intent-list");
  entries.forEach((entry, index) => {
    const item = document.createElement("li"); const button = document.createElement("button");
    button.textContent = entry.id; button.className = index === selected[kind] ? "active" : "";
    button.onclick = () => { selected[kind] = index; render(); }; item.append(button); list.append(item);
  });
  list.scrollTop = intentScroll[kind];
  list.addEventListener("scroll", () => { intentScroll[kind] = list.scrollTop; }, { passive: true });
  if (!current) return;
  const editor = workspace.querySelector(".editor");
  const header = document.createElement("header");
  const heading = document.createElement("h2"); heading.textContent = current.id;
  header.append(heading);
  if (kind === "social") { const remove = document.createElement("button"); remove.className = "danger"; remove.textContent = "Supprimer"; remove.onclick = () => { if (confirm(`Supprimer l’intention « ${current.id} » ?`)) { entries.splice(selected[kind], 1); selected[kind] = 0; render(); } }; header.append(remove); }
  editor.append(header);
  const grid = document.createElement("div"); grid.className = "grid";
  const selectedButton = list.children[selected[kind]]?.querySelector("button");
  grid.append(input("Nom technique de l’intention", current.id, (value) => {
    current.id = value;
    const visibleName = value || "Intention sans nom";
    heading.textContent = visibleName;
    if (selectedButton) selectedButton.textContent = visibleName;
  }, { readOnly: kind === "help", hint: kind === "help" ? "Structurel pour le moteur d’aide." : "Ce nom apparaît dans la liste. Minuscules, chiffres et tirets uniquement." }));
  if (kind === "social") grid.append(input("Sélection des réponses", current.selection, (value) => current.selection = value, { select: ["fixed", "random"] }));
  grid.append(input("Phrases reconnues", current.phrases ?? [], (value) => current.phrases = value, { multiline: true, list: true, full: true, hint: kind === "social" ? "Usage courant : une phrase par ligne. La correspondance est exacte après normalisation." : "Usage courant : une formulation par ligne. Elle peut être suivie du sujet de la question." }));
  editor.append(grid);

  const advanced = document.createElement("details"); advanced.className = "advanced-section";
  const summary = document.createElement("summary"); summary.textContent = "Options avancées et tests";
  const advancedGrid = document.createElement("div"); advancedGrid.className = "grid";
  const helpRow = document.createElement("div"); helpRow.className = "advanced-help-row full";
  helpRow.innerHTML = '<p>Une regex permet de reconnaître plusieurs variantes avec une seule règle.</p><button type="button" class="secondary">Aide regex ?</button>';
  helpRow.querySelector("button").onclick = () => document.querySelector("#regex-help").showModal();
  advancedGrid.append(helpRow);
  advancedGrid.append(input("Expressions régulières", current.patterns ?? [], (value) => current.patterns = value, { multiline: true, list: true, full: true, hint: "Facultatif. Une expression sans délimiteurs /…/ par ligne. À utiliser seulement si les phrases simples ne suffisent pas." }));
  advancedGrid.append(input("Phrases de test", current.examples ?? [], (value) => current.examples = value, { multiline: true, list: true, full: true, hint: "Facultatif. Chaque ligne doit être reconnue par une phrase simple ou une expression régulière. Ces lignes servent à contrôler le registre, elles ne créent pas de nouvelle règle." }));
  advanced.append(summary, advancedGrid); editor.append(advanced);
  if (kind === "social") renderResponses(editor, current);
  document.querySelector("#import-list")?.addEventListener("click", () => openListImport(kind));
  document.querySelector("#export-social")?.addEventListener("click", () => exportSocialWorkbook().catch((error) => showStatus(error.message, true)));
  document.querySelector("#add-intent")?.addEventListener("click", () => { entries.push({ id: nextIntentId(entries), phrases: [], patterns: [], examples: [], responses: [{ key: `designerActions.custom${Date.now()}`, fallback: "Réponse d’Arion." }], selection: "fixed" }); selected.social = entries.length - 1; intentScroll.social = Number.MAX_SAFE_INTEGER; render(); });
}

async function exportSocialWorkbook() {
  const response = await fetch("/api/social-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.social) });
  if (!response.ok) {
    const result = await response.json();
    throw new Error((result.errors ?? ["Export impossible."]).join("\n"));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `arion-interactions-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus(`${data.social.intents.length} intention(s) exportée(s).`);
}

function renderResponses(editor, intent) {
  const title = document.createElement("div"); title.className = "editor-section-title"; title.innerHTML = '<p class="section-title">Réponses</p><button id="add-response">Ajouter une réponse</button>'; title.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-top:24px"; editor.append(title);
  const container = document.createElement("div"); container.className = "responses"; editor.append(container);
  const draw = () => {
    container.replaceChildren();
    intent.responses.forEach((response, index) => {
      const row = document.createElement("div"); row.className = "response-row";
      const fields = document.createElement("div"); fields.className = "fields";
      fields.append(input("Clé", response.key, (value) => response.key = value));
      fields.append(input("Réponse française", response.fallback, (value) => response.fallback = value, { multiline: true, rows: 3 }));
      const remove = document.createElement("button"); remove.className = "danger"; remove.textContent = "×"; remove.title = "Supprimer"; remove.onclick = () => { intent.responses.splice(index, 1); draw(); };
      row.append(fields, remove); container.append(row);
    });
  };
  title.querySelector("#add-response").onclick = () => { intent.responses.push({ key: `designerActions.custom${Date.now()}`, fallback: "Nouvelle réponse." }); draw(); };
  draw();
}

function renderTemplates() {
  workspace.innerHTML = '<div class="templates-grid"></div>';
  const root = workspace.firstElementChild;
  for (const entry of data.help.textTemplates) {
    const card = document.createElement("article"); card.className = "template-card"; card.innerHTML = `<h2>${entry.id}</h2>`;
    const grid = document.createElement("div"); grid.className = "grid";
    grid.append(input("Clé", entry.key, (value) => entry.key = value));
    grid.append(input("Texte français", entry.fallback, (value) => entry.fallback = value, { multiline: true, rows: 3 })); card.append(grid); root.append(card);
  }
  for (const entry of data.help.suggestionTemplates) {
    const card = document.createElement("article"); card.className = "template-card"; card.innerHTML = `<h2>Suggestion · ${entry.id}</h2>`;
    const grid = document.createElement("div"); grid.className = "grid";
    grid.append(input("Clé", entry.command.key, (value) => entry.command.key = value));
    grid.append(input("Formulation française", entry.command.fallback, (value) => entry.command.fallback = value));
    grid.append(input("Termes de recherche", entry.searchTerms, (value) => entry.searchTerms = value, { full: true })); card.append(grid); root.append(card);
  }
}

function renderDocumentation() {
  workspace.innerHTML = '<article class="editor documentation-editor"><header><div><h2>Documentation indexée</h2><p>Seuls les contenus que vous avez retenus sont intégrés à Arion.</p></div><span class="documentation-actions"><button id="select-documentation" class="secondary">Choisir dans les docs</button><button id="import-documentation">Importer un Markdown</button></span></header><div class="documentation-list"></div></article>';
  const list = workspace.querySelector(".documentation-list");
  if (!documentation.entries.length) list.innerHTML = '<p class="empty-state">Aucune section documentaire n’est encore indexée.</p>';
  for (const entry of documentation.entries) {
    const card = document.createElement("section"); card.className = "documentation-card";
    const title = document.createElement("h3"); title.textContent = entry.title;
    const content = document.createElement("p"); content.textContent = entry.content;
    const footer = document.createElement("footer");
    const id = document.createElement("span"); id.textContent = `ID : ${entry.id}`; footer.append(id);
    if (entry.activities?.length) { const activities = document.createElement("span"); activities.textContent = `Activités : ${entry.activities.join(", ")}`; footer.append(activities); }
    card.append(title, content, footer);
    list.append(card);
  }
  workspace.querySelector("#import-documentation").onclick = () => document.querySelector("#documentation-file").click();
  workspace.querySelector("#select-documentation").onclick = openSourceSelection;
  const manage = document.createElement('button'); manage.textContent = 'Modifier les documents importés'; manage.className = 'secondary';
  manage.onclick = () => manageDocuments().catch(error => showStatus(error.message, true));
  workspace.querySelector('.documentation-actions').append(manage);
}

async function manageDocuments() {
  const response = await fetch('/api/managed-documents');
  if (!response.ok) throw new Error('Chargement des documents impossible.');
  const { documents } = await response.json();
  const metadataPattern = /<!--\s*arion:meta\s+({[\s\S]*?})\s*-->/i;
  const readMetadata = content => {
    const match = content.match(metadataPattern);
    if (!match) return { sections: {} };
    try {
      const value = JSON.parse(match[1]);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      if (!value.sections || typeof value.sections !== 'object' || Array.isArray(value.sections)) value.sections = {};
      return value;
    } catch { throw new Error('Les métadonnées Arion de ce document sont invalides. Corrigez-les avant l’enregistrement.'); }
  };
  const headings = content => [...new Set([...content.matchAll(/^#{1,2}\s+(.+)$/gm)].map(match => match[1].trim()).filter(Boolean))];
  const normalizeSearch = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, ' ').trim();
  const drafts = documents.map(document => {
    let metadata;
    let metadataError = '';
    try { metadata = readMetadata(document.content); } catch (error) { metadata = { sections: {} }; metadataError = error.message; }
    return { ...document, original: document.content, content: document.content, metadata, originalMetadata: JSON.stringify(metadata), metadataError, dirty: false, externalChanged: false, externalConflict: false, externalMissing: false, externalContent: '' };
  });
  let selectedName = drafts[0]?.name ?? '';
  let query = '';

  const serialize = draft => {
    if (draft.externalConflict) throw new Error(`${draft.name} a été modifié à la fois dans l’outil et hors de l’outil. Rechargez d’abord sa version externe.`);
    if (draft.externalMissing) throw new Error(`${draft.name} a été supprimé hors de l’outil. Rechargez la liste des documents.`);
    if (draft.metadataError) throw new Error(`${draft.name} : ${draft.metadataError}`);
    const metadata = structuredClone(draft.metadata);
    const presentHeadings = new Set(headings(draft.content));
    metadata.sections = Object.fromEntries(Object.entries(metadata.sections ?? {}).filter(([name]) => presentHeadings.has(name)));
    return `<!-- arion:meta ${JSON.stringify(metadata)} -->\n\n${draft.content.replace(metadataPattern, '').trim()}\n`;
  };
  const refreshDirty = draft => {
    draft.dirty = draft.content !== draft.original || JSON.stringify(draft.metadata) !== draft.originalMetadata || draft.externalChanged || draft.externalConflict || draft.externalMissing;
  };
  const requestJson = async (url, options) => {
    const result = await fetch(url, options);
    const body = await readJsonResponse(result, 'Enregistrement');
    if (!result.ok || body.ok === false) throw new Error(body.errors?.join('\n') || 'Écriture impossible.');
    return body;
  };
  const refreshDocumentation = async () => {
    documentation = await (await fetch('/api/documentation')).json();
    renderDocumentation();
  };

  const dialog = document.createElement('dialog');
  dialog.className = 'documentation-manager-dialog';
  const article = document.createElement('article'); article.className = 'help-sheet documentation-manager';
  const header = document.createElement('header');
  const introduction = document.createElement('div');
  const title = document.createElement('h2'); title.textContent = 'Mettre à jour la documentation';
  const description = document.createElement('p'); description.textContent = 'Sélectionnez un fichier, corrigez-le puis reconstruisez l’aide Arion.';
  introduction.append(title, description);
  const headerActions = document.createElement('div'); headerActions.className = 'document-manager-header-actions';
  const saveAll = document.createElement('button'); saveAll.textContent = 'Tout enregistrer et reconstruire';
  const close = document.createElement('button'); close.textContent = 'Fermer'; close.className = 'secondary';
  headerActions.append(saveAll, close); header.append(introduction, headerActions); article.append(header);

  const layout = document.createElement('div'); layout.className = 'document-manager-layout';
  const sidebar = document.createElement('aside'); sidebar.className = 'document-manager-sidebar';
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Rechercher un document'; search.setAttribute('aria-label', 'Rechercher un document');
  const count = document.createElement('small'); count.className = 'document-manager-count';
  const documentList = document.createElement('div'); documentList.className = 'document-manager-list';
  sidebar.append(search, count, documentList);
  const editor = document.createElement('section'); editor.className = 'document-manager-editor';
  layout.append(sidebar, editor); article.append(layout);

  const updateControls = () => {
    saveAll.disabled = !drafts.some(draft => draft.dirty);
    count.textContent = `${drafts.length} document${drafts.length > 1 ? 's' : ''} · ${drafts.filter(draft => draft.dirty).length} modifié${drafts.filter(draft => draft.dirty).length > 1 ? 's' : ''}`;
  };
  const updateCurrentSave = draft => {
    const button = editor.querySelector('.document-save-current');
    if (button) button.disabled = !draft.dirty;
  };
  const renderList = () => {
    documentList.replaceChildren();
    const queryTokens = normalizeSearch(query).split(' ').filter(Boolean);
    const filtered = drafts.filter(draft => {
      if (!queryTokens.length) return true;
      const searchable = normalizeSearch(`${draft.title} ${draft.name} ${headings(draft.content).join(' ')} ${draft.content}`);
      return queryTokens.every(token => searchable.includes(token));
    });
    for (const draft of filtered) {
      const button = document.createElement('button'); button.className = `document-manager-item${draft.name === selectedName ? ' active' : ''}`;
      const label = document.createElement('strong'); label.textContent = draft.title;
      const fileName = document.createElement('span'); fileName.className = 'document-manager-filename'; fileName.textContent = draft.name;
      button.append(label, fileName);
      if (draft.dirty) {
        const marker = document.createElement('span'); marker.className = `document-dirty-marker${draft.externalConflict || draft.externalMissing ? ' conflict' : draft.externalChanged ? ' external' : ''}`;
        marker.textContent = draft.externalConflict ? 'Conflit' : draft.externalMissing ? 'Supprimé' : draft.externalChanged ? 'Externe' : 'Modifié'; button.append(marker);
      }
      button.onclick = () => { selectedName = draft.name; renderList(); renderEditor(); };
      documentList.append(button);
    }
    if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Aucun document ne correspond à cette recherche.'; documentList.append(empty); }
    updateControls();
  };
  const renderMetadata = (container, draft) => {
    const wasOpen = container.open;
    container.replaceChildren();
    const summary = document.createElement('summary'); summary.textContent = 'Reconnaissance des sections : alias et mots-clés'; container.append(summary);
    if (draft.metadataError) { const warning = document.createElement('p'); warning.className = 'document-metadata-error'; warning.textContent = draft.metadataError; container.append(warning); }
    const sectionHeadings = headings(draft.content);
    if (!sectionHeadings.length) { const empty = document.createElement('p'); empty.textContent = 'Ajoutez un titre Markdown pour paramétrer sa reconnaissance.'; container.append(empty); }
    for (const sectionHeading of sectionHeadings) {
      const values = draft.metadata.sections?.[sectionHeading] ?? { aliases: [], keywords: [] };
      const label = document.createElement('h4'); label.textContent = sectionHeading; container.append(label);
      container.append(
        input('Autres formulations (une par ligne)', values.aliases, value => {
          draft.metadata.sections ??= {}; draft.metadata.sections[sectionHeading] ??= { aliases: [], keywords: [] };
          draft.metadata.sections[sectionHeading].aliases = value; refreshDirty(draft); renderList(); updateCurrentSave(draft);
        }, { multiline: true, list: true, rows: 3 }),
        input('Mots-clés (un par ligne)', values.keywords, value => {
          draft.metadata.sections ??= {}; draft.metadata.sections[sectionHeading] ??= { aliases: [], keywords: [] };
          draft.metadata.sections[sectionHeading].keywords = value; refreshDirty(draft); renderList(); updateCurrentSave(draft);
        }, { multiline: true, list: true, rows: 3 })
      );
    }
    container.open = wasOpen;
  };
  const renderEditor = () => {
    editor.replaceChildren();
    const draft = drafts.find(item => item.name === selectedName);
    if (!draft) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Aucun document à modifier.'; editor.append(empty); return; }
    const editorHeader = document.createElement('header');
    const headingGroup = document.createElement('div');
    const documentTitle = document.createElement('h3'); documentTitle.textContent = draft.title;
    const documentName = document.createElement('small'); documentName.textContent = draft.name;
    headingGroup.append(documentTitle, documentName); editorHeader.append(headingGroup); editor.append(editorHeader);
    if (draft.externalChanged || draft.externalConflict || draft.externalMissing) {
      const notice = document.createElement('div'); notice.className = `document-external-notice${draft.externalConflict || draft.externalMissing ? ' conflict' : ''}`;
      const message = document.createElement('p');
      message.textContent = draft.externalConflict
        ? 'Ce fichier a été modifié hors de l’outil pendant que vous le corrigiez ici.'
        : draft.externalMissing
          ? 'Ce fichier a été supprimé hors de l’outil.'
          : 'Ce fichier a été modifié hors de l’outil. Enregistrez-le pour reconstruire l’aide Arion.';
      notice.append(message);
      if (draft.externalConflict && draft.externalContent) {
        const reloadExternal = document.createElement('button'); reloadExternal.type = 'button'; reloadExternal.className = 'secondary'; reloadExternal.textContent = 'Recharger la version externe';
        reloadExternal.onclick = () => {
          if (!confirm(`Abandonner les modifications locales de ${draft.name} et charger sa version externe ?`)) return;
          let metadata;
          let metadataError = '';
          try { metadata = readMetadata(draft.externalContent); } catch (error) { metadata = { sections: {} }; metadataError = error.message; }
          draft.content = draft.externalContent; draft.original = draft.externalContent; draft.metadata = metadata; draft.originalMetadata = JSON.stringify(metadata);
          draft.metadataError = metadataError; draft.title = draft.content.match(/^#\s+(.+)$/m)?.[1]?.trim() || draft.name.replace(/\.md$/i, '');
          draft.externalContent = ''; draft.externalConflict = false; draft.externalChanged = true; refreshDirty(draft); renderList(); renderEditor();
        };
        notice.append(reloadExternal);
      }
      editor.append(notice);
    }
    let metadataTimer;
    const markdownField = input('Markdown — ajoutez, corrigez ou retirez les sections ici', draft.content, value => {
      draft.content = value;
      draft.title = value.match(/^#\s+(.+)$/m)?.[1]?.trim() || draft.name.replace(/\.md$/i, '');
      refreshDirty(draft); renderList(); updateCurrentSave(draft);
      window.clearTimeout(metadataTimer);
      metadataTimer = window.setTimeout(() => renderMetadata(settings, draft), 250);
    }, { multiline: true, rows: 20 });
    markdownField.classList.add('document-markdown-field'); editor.append(markdownField);
    const settings = document.createElement('details'); settings.className = 'advanced-section document-metadata'; renderMetadata(settings, draft); editor.append(settings);
    const replacementRow = document.createElement('label'); replacementRow.className = 'document-replacement';
    const replacementLabel = document.createElement('span'); replacementLabel.textContent = 'Remplacer le contenu depuis un Markdown';
    const replace = document.createElement('input'); replace.type = 'file'; replace.accept = '.md';
    replace.onchange = async () => {
      const file = replace.files[0]; replace.value = ''; if (!file) return;
      const content = (await file.text()).replace(/^\uFEFF/, '');
      try { draft.metadata = readMetadata(content); draft.metadataError = ''; } catch (error) { draft.metadata = { sections: {} }; draft.metadataError = error.message; }
      draft.content = content; draft.title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || draft.name.replace(/\.md$/i, '');
      refreshDirty(draft); renderList(); renderEditor();
    };
    replacementRow.append(replacementLabel, replace); editor.append(replacementRow);
    const actions = document.createElement('footer'); actions.className = 'document-editor-actions';
    const save = document.createElement('button'); save.className = 'document-save-current'; save.textContent = 'Enregistrer ce document et reconstruire'; save.disabled = !draft.dirty;
    save.onclick = async () => {
      save.disabled = true;
      try {
        const nextContent = serialize(draft);
        const body = await requestJson('/api/managed-documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: draft.name, previous: draft.original, content: nextContent, action: 'save' }) });
        draft.content = nextContent; draft.original = nextContent; draft.originalMetadata = JSON.stringify(draft.metadata); draft.externalChanged = false; draft.externalConflict = false; draft.externalMissing = false; draft.externalContent = ''; refreshDirty(draft);
        await refreshDocumentation(); renderList(); renderEditor(); showStatus(`Document enregistré. Sauvegarde : ${body.backup}`);
      } catch (error) { showStatus(error.message, true); save.disabled = false; }
    };
    const remove = document.createElement('button'); remove.textContent = 'Supprimer le document'; remove.className = 'danger';
    remove.onclick = async () => {
      if (!confirm(`Supprimer ${draft.name} de la documentation Arion ? Une sauvegarde sera conservée.`)) return;
      remove.disabled = true;
      try {
        const body = await requestJson('/api/managed-documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: draft.name, previous: draft.original, content: draft.content, action: 'delete' }) });
        const index = drafts.indexOf(draft); drafts.splice(index, 1); selectedName = drafts[Math.min(index, drafts.length - 1)]?.name ?? '';
        await refreshDocumentation(); renderList(); renderEditor(); showStatus(`Document supprimé. Sauvegarde : ${body.backup}`);
      } catch (error) { showStatus(error.message, true); remove.disabled = false; }
    };
    actions.append(save, remove); editor.append(actions);
  };

  search.addEventListener('input', () => { query = search.value; renderList(); });
  saveAll.onclick = async () => {
    const changed = drafts.filter(draft => draft.dirty);
    if (!changed.length) return;
    saveAll.disabled = true;
    try {
      const updates = changed.map(draft => ({ name: draft.name, previous: draft.original, content: serialize(draft) }));
      const body = await requestJson('/api/managed-documents/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documents: updates }) });
      for (const draft of changed) {
        draft.content = updates.find(update => update.name === draft.name).content;
        draft.original = draft.content; draft.originalMetadata = JSON.stringify(draft.metadata); draft.externalChanged = false; draft.externalConflict = false; draft.externalMissing = false; draft.externalContent = ''; refreshDirty(draft);
      }
      await refreshDocumentation(); renderList(); renderEditor(); showStatus(`${body.count} document${body.count > 1 ? 's' : ''} enregistré${body.count > 1 ? 's' : ''}. Sauvegarde : ${body.backup}`);
    } catch (error) { showStatus(error.message, true); updateControls(); }
  };
  let externalCheckRunning = false;
  const checkExternalChanges = async () => {
    if (externalCheckRunning || !dialog.open) return;
    externalCheckRunning = true;
    try {
      const latestResponse = await fetch('/api/managed-documents');
      if (!latestResponse.ok) return;
      const latestDocuments = (await latestResponse.json()).documents;
      const latestByName = new Map(latestDocuments.map(document => [document.name, document]));
      let changed = false;
      for (const draft of drafts) {
        const latest = latestByName.get(draft.name);
        if (!latest) {
          if (!draft.externalMissing) { draft.externalMissing = true; refreshDirty(draft); changed = true; }
          continue;
        }
        latestByName.delete(draft.name);
        if (latest.content === draft.original || latest.content === draft.externalContent) continue;
        const hasLocalChanges = draft.content !== draft.original || JSON.stringify(draft.metadata) !== draft.originalMetadata;
        if (hasLocalChanges) {
          draft.externalConflict = true; draft.externalContent = latest.content; refreshDirty(draft); changed = true;
          continue;
        }
        let metadata;
        let metadataError = '';
        try { metadata = readMetadata(latest.content); } catch (error) { metadata = { sections: {} }; metadataError = error.message; }
        Object.assign(draft, latest, { original: latest.content, content: latest.content, metadata, originalMetadata: JSON.stringify(metadata), metadataError, externalChanged: true, externalConflict: false, externalMissing: false, externalContent: '' });
        refreshDirty(draft); changed = true;
      }
      for (const latest of latestByName.values()) {
        let metadata;
        let metadataError = '';
        try { metadata = readMetadata(latest.content); } catch (error) { metadata = { sections: {} }; metadataError = error.message; }
        drafts.push({ ...latest, original: latest.content, content: latest.content, metadata, originalMetadata: JSON.stringify(metadata), metadataError, dirty: true, externalChanged: true, externalConflict: false, externalMissing: false, externalContent: '' });
        changed = true;
      }
      if (changed) { renderList(); renderEditor(); showStatus('Modification externe de la documentation détectée.'); }
    } finally { externalCheckRunning = false; }
  };
  const externalCheckTimer = window.setInterval(checkExternalChanges, 4000);
  window.addEventListener('focus', checkExternalChanges);
  const attemptClose = () => { if (!drafts.some(draft => draft.dirty) || confirm('Fermer sans enregistrer les modifications en cours ?')) dialog.close(); };
  close.onclick = attemptClose;
  dialog.addEventListener('cancel', event => { event.preventDefault(); attemptClose(); });
  renderList(); renderEditor();
  dialog.append(article); document.body.append(dialog); dialog.addEventListener('close', () => { window.clearInterval(externalCheckTimer); window.removeEventListener('focus', checkExternalChanges); dialog.remove(); }); dialog.showModal();
}

function openSourceSelection() {
  const root = document.querySelector("#source-selection-list"); root.replaceChildren();
  for (const documentSource of documentationSources.documents) {
    const details = document.createElement("details"); details.className = "source-document";
    const summary = document.createElement("summary"); summary.textContent = documentSource.title;
    const body = document.createElement("div"); body.className = "source-document-body";
    const whole = sourceChoice(documentSource.path, "", "Document entier", documentSource.preview, documentSource.selectedWhole);
    body.append(whole);
    const wholeInput = whole.querySelector("input");
    const sectionInputs = [];
    for (const section of documentSource.sections) {
      const choice = sourceChoice(documentSource.path, section.heading, section.heading, section.preview, documentSource.selectedHeadings.includes(section.heading));
      sectionInputs.push(choice.querySelector("input")); body.append(choice);
    }
    const synchronize = () => { for (const input of sectionInputs) { input.disabled = wholeInput.checked; input.closest("label").classList.toggle("disabled", wholeInput.checked); } };
    wholeInput.addEventListener("change", synchronize); synchronize(); details.append(summary, body); root.append(details);
  }
  document.querySelector("#source-selection").showModal();
}

function sourceChoice(path, heading, label, preview, checked) {
  const choice = document.createElement("label"); choice.className = "source-choice";
  const input = document.createElement("input"); input.type = "checkbox"; input.checked = checked; input.dataset.path = path; input.dataset.heading = heading;
  const content = document.createElement("span"); const title = document.createElement("strong"); title.textContent = label;
  const excerpt = document.createElement("small"); excerpt.textContent = preview || "Section sans aperçu textuel."; content.append(title, excerpt); choice.append(input, content); return choice;
}

async function saveSourceSelection() {
  const selections = [...document.querySelectorAll("#source-selection-list input:checked:not(:disabled)")].map((input) => ({ path: input.dataset.path, ...(input.dataset.heading ? { heading: input.dataset.heading } : {}) }));
  const response = await fetch("/api/documentation-sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selections }) });
  const result = await response.json(); if (!response.ok || !result.ok) throw new Error((result.errors ?? ["Reconstruction impossible."]).join("\n"));
  const [indexResponse, sourcesResponse] = await Promise.all([fetch("/api/documentation"), fetch("/api/documentation-sources")]);
  documentation = await indexResponse.json(); documentationSources = await sourcesResponse.json(); document.querySelector("#source-selection").close(); render(); showStatus(`Index reconstruit : ${result.selected} sélection(s).`);
}

function render() {
  const documentationTab = tab === 'documentation';
  document.querySelector('#validate').hidden = documentationTab;
  document.querySelector('#save').hidden = documentationTab;
  const renderAsync = { knowledge: renderKnowledge, understanding: renderUnderstanding, massifiable: renderMassifiable }[tab];
  if (renderAsync) {
    const requestedTab = tab;
    const notice = document.createElement('article');
    notice.className = 'editor';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Chargement…';
    workspace.replaceChildren(notice);
    renderAsync().catch(error => {
      if (tab !== requestedTab) return;
      notice.textContent = `${error.message} Si l’outil vient d’être mis à jour, relancez son serveur puis cliquez sur Réessayer.`;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Réessayer';
      retry.onclick = render;
      notice.append(retry);
      workspace.replaceChildren(notice);
      showStatus(error.message, true);
    });
    return;
  }
  tab === 'templates' ? renderTemplates() : tab === 'documentation' ? renderDocumentation() : renderIntent(tab);
}

function parseImportRows(kind, source) {
  const trimmed = source.trim();
  if (!trimmed) return { rows: [], errors: ["La liste est vide."], duplicates: 0 };
  let rawRows;
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("Le JSON doit contenir une liste.");
    const asList = (value) => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
    rawRows = parsed.flatMap((entry) => {
      const phrases = asList(entry.phrases ?? entry.phrase); const patterns = asList(entry.regex ?? entry.patterns);
      const tests = asList(entry.tests ?? entry.examples ?? entry.test); const responses = asList(entry.responses ?? entry.response ?? entry.reponse).map((response) => typeof response === "object" ? response.fallback : response);
      const count = Math.max(1, phrases.length, patterns.length, tests.length, responses.length);
      return Array.from({ length: count }, (_, index) => kind === "social"
        ? [entry.intention ?? entry.intent ?? entry.id, phrases[index] ?? "", responses[index] ?? "", patterns[index] ?? "", tests[index] ?? ""]
        : [entry.intention ?? entry.intent ?? entry.id, phrases[index] ?? "", patterns[index] ?? "", tests[index] ?? ""]);
    });
  } catch (error) {
    if (/^[\[{]/.test(trimmed)) return { rows: [], errors: [`JSON invalide : ${error.message}`], duplicates: 0 };
    rawRows = trimmed.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split("\t"));
  }
  if (/^(intention|intent|id)$/i.test(String(rawRows[0]?.[0] ?? "").trim())) rawRows.shift();
  const errors = []; const rows = []; const seen = new Set(); let duplicates = 0;
  const allowedHelp = new Set(data.help.intents.map((entry) => entry.id));
  const existingSocial = new Set(data.social.intents.map((entry) => entry.id));
  rawRows.forEach((columns, index) => {
    const intent = String(columns[0] ?? "").trim(); const phrase = String(columns[1] ?? "").trim();
    const response = kind === "social" ? String(columns[2] ?? "").trim() : "";
    const pattern = String(columns[kind === "social" ? 3 : 2] ?? "").trim(); const example = String(columns[kind === "social" ? 4 : 3] ?? "").trim();
    if (!intent) { errors.push(`Ligne ${index + 1} : l’intention est obligatoire.`); return; }
    if (!phrase && !pattern && !(kind === "social" && response)) { errors.push(`Ligne ${index + 1} : une phrase ou une regex est obligatoire.`); return; }
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(intent)) { errors.push(`Ligne ${index + 1} : identifiant d’intention invalide « ${intent} ».`); return; }
    if (kind === "help" && !allowedHelp.has(intent)) { errors.push(`Ligne ${index + 1} : intention d’aide inconnue « ${intent} ».`); return; }
    if (pattern) try { new RegExp(pattern); } catch (error) { errors.push(`Ligne ${index + 1} : regex invalide (${error.message}).`); return; }
    const key = [intent, phrase.toLocaleLowerCase("fr"), response.toLocaleLowerCase("fr"), pattern, example.toLocaleLowerCase("fr")].join("\u0000");
    if (seen.has(key)) { duplicates += 1; return; }
    seen.add(key); rows.push({ intent, phrase, response, pattern, example, line: index + 1 });
  });
  for (const intent of new Set(rows.map((row) => row.intent))) {
    if (!rows.some((row) => row.intent === intent && (row.phrase || row.pattern))) errors.push(`L’intention « ${intent} » exige au moins une phrase ou une regex.`);
    if (kind === "social" && !existingSocial.has(intent) && !rows.some((row) => row.intent === intent && row.response)) errors.push(`La nouvelle intention « ${intent} » exige au moins une réponse.`);
  }
  return { rows, errors, duplicates };
}

function openListImport(kind) {
  const dialog = document.querySelector("#list-import"); dialog.dataset.kind = kind;
  document.querySelector("#list-import-format").innerHTML = kind === "social"
    ? 'Colonnes : <code>intention[TAB]phrase[TAB]réponse[TAB]regex[TAB]phrase de test</code>. Une nouvelle intention exige au moins une réponse. Les cellules inutiles peuvent rester vides.'
    : 'Colonnes : <code>intention[TAB]phrase[TAB]regex[TAB]phrase de test</code>. Intentions autorisées : <code>how-to</code>, <code>recommend</code>, <code>compare</code>, <code>purpose</code>, <code>details</code>, <code>limitation</code>.';
  const matrix = document.querySelector("#download-list-matrix");
  matrix.href = kind === "social" ? "/templates/matrice-arion-interactions.xlsx" : "/templates/matrice-arion-aide.xlsx";
  matrix.download = kind === "social" ? "matrice-arion-interactions.xlsx" : "matrice-arion-aide.xlsx";
  document.querySelector("#list-import-content").value = "";
  document.querySelector("#list-import-preview").textContent = "";
  document.querySelector("#apply-list-import").disabled = true;
  analyzedImport = null; dialog.showModal();
}

function analyzeListImport() {
  const dialog = document.querySelector("#list-import"); const kind = dialog.dataset.kind;
  analyzedImport = { kind, ...parseImportRows(kind, document.querySelector("#list-import-content").value) };
  const preview = document.querySelector("#list-import-preview");
  preview.className = `import-preview${analyzedImport.errors.length ? " error" : " valid"}`;
  preview.textContent = `${analyzedImport.rows.length} ligne(s) valide(s), ${analyzedImport.duplicates} doublon(s).${analyzedImport.errors.length ? `\n${analyzedImport.errors.join("\n")}` : "\nLa liste peut être intégrée."}`;
  document.querySelector("#apply-list-import").disabled = !analyzedImport.rows.length || Boolean(analyzedImport.errors.length);
}

function applyListImport() {
  if (!analyzedImport || analyzedImport.errors.length) return;
  const entries = data[analyzedImport.kind].intents; const mode = document.querySelector("#list-import-mode").value;
  const touched = new Set(analyzedImport.rows.map((row) => row.intent));
  if (mode === "replace") for (const entry of entries) if (touched.has(entry.id)) { entry.phrases = []; entry.patterns = []; entry.examples = []; }
  if (analyzedImport.kind === "social") for (const intent of touched) {
    if (!entries.some((entry) => entry.id === intent)) entries.push({ id: intent, phrases: [], patterns: [], examples: [], responses: [], selection: "fixed" });
  }
  analyzedImport.rows.forEach((row, rowIndex) => {
    let entry = entries.find((candidate) => candidate.id === row.intent);
    if (!entry) return;
    if (row.phrase && !entry.phrases.some((phrase) => phrase.toLocaleLowerCase("fr") === row.phrase.toLocaleLowerCase("fr"))) entry.phrases.push(row.phrase);
    if (row.pattern && !entry.patterns.includes(row.pattern)) entry.patterns.push(row.pattern);
    if (row.example && !entry.examples.some((example) => example.toLocaleLowerCase("fr") === row.example.toLocaleLowerCase("fr"))) entry.examples.push(row.example);
    if (analyzedImport.kind === "social" && row.response && !entry.responses.some((response) => response.fallback === row.response)) {
      entry.responses.push({ key: `designerActions.custom${Date.now()}${rowIndex}${entry.responses.length}`, fallback: row.response });
      entry.selection = entry.responses.length > 1 ? "random" : "fixed";
    }
  });
  document.querySelector("#list-import").close(); render(); showStatus("Liste intégrée dans l’éditeur. Cliquez sur Valider puis Enregistrer pour l’écrire.");
}

async function load() {
  understandingData = null; knowledgeData = null;
  massifiableData = null;
  const [registryResponse, documentationResponse, sourceResponse] = await Promise.all([fetchRegistry("/api/registries"), fetchRegistry("/api/documentation"), fetchRegistry("/api/documentation-sources")]);
  if (!registryResponse.ok || !documentationResponse.ok || !sourceResponse.ok) throw new Error("Impossible de charger les registres.");
  data = await registryResponse.json(); documentation = await documentationResponse.json(); documentationSources = await sourceResponse.json(); render();
}

async function submit(path) {
  if (tab === 'knowledge') {
    const response = await fetch(path === '/api/validate' ? '/api/knowledge-validate' : '/api/knowledge', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registry:knowledgeData,previous:knowledgePrevious})});
    const result = await readJsonResponse(response, 'Traitement des contenus');if(!result.ok)return showStatus((result.errors??['Enregistrement impossible.']).join('\n'),true);
    if(path!=='/api/validate')knowledgePrevious=structuredClone(knowledgeData);
    return showStatus(path==='/api/validate'?'Contenus validés.':'Contenus enregistrés avec sauvegarde.');
  }
  if (tab === 'understanding') {
    const validating = path === '/api/validate';
    const response = await fetch(validating ? '/api/understanding-test' : '/api/understanding', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(validating ? understandingData.registry : { registry: understandingData.registry, previous: understandingPrevious }) });
    const result = await readJsonResponse(response, 'Traitement des règles');
    if (!result.ok) return showStatus((result.errors ?? ['Enregistrement impossible.']).join('\n'), true);
    if (!validating) understandingPrevious = structuredClone(understandingData.registry);
    return showStatus([validating ? 'Règles validées.' : 'Règles enregistrées avec sauvegarde.', ...(result.warnings ?? [])].join('\n'));
  }
  if (tab === 'massifiable') {
    if (!massifiableData) return;
    if (path === '/api/validate') return showStatus('Choix valides. Utilisez Enregistrer pour les conserver.');
    const response = await fetch('/api/massifiable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decisions: massifiableData.rows.map(({property, decision, notes}) => ({property, decision, notes})) }) });
    if (!response.ok) throw new Error('Enregistrement des décisions impossible.');
    return showStatus('Décisions enregistrées et sauvegardées.');
  }
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const result = await readJsonResponse(response, path === '/api/validate' ? 'Validation' : 'Enregistrement');
  if (!result.ok) return showStatus((result.errors ?? ["Validation impossible."]).join("\n"), true);
  showStatus(path === "/api/validate" ? "Validation réussie. Aucune donnée écrite." : `Registres enregistrés.\nSauvegarde : ${result.backup}`);
}

const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

async function updateServerStatus() {
  const response = await fetch('/api/server-status', { cache: 'no-store' });
  if (!response.ok) throw new Error('Détection des serveurs impossible.');
  const status = await response.json();
  const label = `${status.servers.length} serveur${status.servers.length > 1 ? 's' : ''} détecté${status.servers.length > 1 ? 's' : ''}`;
  document.querySelector('#server-count').textContent = label;
  document.querySelector('#server-menu-label').title = label;
  return status;
}

async function controlServer(action) {
  const verb = action === 'restart' ? 'redémarrer' : 'arrêter';
  if (!confirm(`Voulez-vous ${verb} le ou les serveurs détectés ? Les modifications non enregistrées dans l’outil seront perdues.`)) return;
  const controls = [document.querySelector('#restart-server'), document.querySelector('#stop-server')];
  controls.forEach(button => { button.disabled = true; });
  try {
    const current = await updateServerStatus();
    const response = await fetch('/api/server-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, scope: 'all' }) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.errors?.join('\n') || 'Commande serveur impossible.');
    document.querySelector('.server-controls').open = false;
    if (action === 'stop') {
      const notice = document.createElement('article'); notice.className = 'editor server-stopped';
      const heading = document.createElement('h2'); heading.textContent = 'Serveur Arion arrêté';
      const detail = document.createElement('p'); detail.textContent = `${result.affected} serveur${result.affected > 1 ? 's ont' : ' a'} reçu la commande d’arrêt. Relancez l’outil depuis PAIDEIA ou le terminal pour continuer.`;
      notice.append(heading, detail); workspace.replaceChildren(notice); showStatus('Arrêt du serveur en cours.'); return;
    }
    showStatus('Redémarrage du serveur Arion…');
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await wait(250);
      try {
        const probe = await fetch(`/api/server-status?probe=${Date.now()}`, { cache: 'no-store' });
        if (!probe.ok) continue;
        const next = await probe.json();
        if (next.instanceId !== current.instanceId) { window.location.reload(); return; }
      } catch { /* Le serveur est momentanément arrêté pendant son remplacement. */ }
    }
    throw new Error('Le nouveau serveur ne répond pas. Relancez l’outil depuis PAIDEIA ou le terminal.');
  } catch (error) {
    controls.forEach(button => { button.disabled = false; });
    showStatus(error.message, true);
  }
}

document.querySelectorAll("[data-tab]").forEach((button) => button.onclick = () => { tab = button.dataset.tab; document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === button)); render(); });
document.querySelector('#restart-server').onclick = () => controlServer('restart');
document.querySelector('#stop-server').onclick = () => controlServer('stop');
document.querySelector("#reload").onclick = () => { if (confirm("Abandonner les modifications non enregistrées ?")) load().catch((error) => showStatus(error.message, true)); };
document.querySelector("#validate").onclick = () => submit("/api/validate").catch((error) => showStatus(error.message, true));
document.querySelector("#save").onclick = () => submit("/api/registries").catch((error) => showStatus(error.message, true));
document.querySelector("#close-regex-help").onclick = () => document.querySelector("#regex-help").close();
document.querySelector("#regex-help").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector("#close-list-import").onclick = () => document.querySelector("#list-import").close();
document.querySelector("#open-list-workbook").onclick = () => document.querySelector("#list-import-file").click();
document.querySelector("#analyze-list-import").onclick = analyzeListImport;
document.querySelector("#apply-list-import").onclick = applyListImport;
document.querySelector("#list-import-file").onchange = async (event) => {
  const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
  try {
    const kind = document.querySelector("#list-import").dataset.kind;
    const response = await fetch(`/api/workbook-import?kind=${encodeURIComponent(kind)}`, { method: "POST", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: await file.arrayBuffer() });
    const result = await response.json(); if (!response.ok || !result.ok) throw new Error((result.errors ?? ["Lecture du classeur impossible."]).join("\n"));
    document.querySelector("#list-import-content").value = result.content;
    analyzeListImport();
  } catch (error) { showStatus(error.message, true); }
};
document.querySelector("#close-source-selection").onclick = () => document.querySelector("#source-selection").close();
document.querySelector("#save-source-selection").onclick = () => saveSourceSelection().catch((error) => showStatus(error.message, true));
document.querySelector("#documentation-file").onchange = async (event) => {
  const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
  try {
    const response = await fetch("/api/documentation-import", { method: "POST", headers: { "Content-Type": "text/markdown; charset=utf-8", "X-PAIDEIA-File-Name": encodeURIComponent(file.name) }, body: await file.arrayBuffer() });
    const result = await response.json(); if (!response.ok || !result.ok) throw new Error((result.errors ?? ["Import impossible."]).join("\n"));
    documentation = await (await fetch("/api/documentation")).json(); render(); showStatus(`Document copié et index reconstruit : ${result.fileName}`);
  } catch (error) { showStatus(error.message, true); }
};
function showLoadError(error) {
  const notice = document.createElement('article');
  notice.className = 'editor';
  notice.setAttribute('role', 'alert');
  notice.textContent = error.message;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Réessayer';
  retry.onclick = () => { retry.disabled = true; load().catch(showLoadError); };
  notice.append(retry);
  workspace.replaceChildren(notice);
  showStatus(error.message, true);
}
Promise.all([load(), updateServerStatus()]).catch(showLoadError);
