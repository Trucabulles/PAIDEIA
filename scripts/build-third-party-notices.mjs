import fs from "node:fs";
import path from "node:path";
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim();
const components = [];
function notices(directory) {
  return fs.readdirSync(directory).filter(name => /^(licen[cs]e|copying|notice)([._-]|$)/i.test(name))
    .filter(name => fs.statSync(`${directory}/${name}`).isFile())
    .sort().map(name => ({ name, text: read(`${directory}/${name}`) }));
}
const documented = [
  ["Tauri Single Instance", "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/single-instance", "legal/tauri-plugin-single-instance-LICENSE.txt"],
  ["webview2-com", "https://github.com/wravery/webview2-rs", "legal/webview2-com-LICENSE.txt"],
  ["pdfmake", "https://github.com/bpampuch/pdfmake", "legal/pdfmake-LICENSE.txt", "Génération des exports PDF des banques de références et du glossaire. Le PDF A4 des leçons utilise WebView2."],
  ["React", "https://github.com/facebook/react", "legal/React-LICENSE.txt", "Interface de PAIDEIA et préparation du rendu de certaines activités pour le PDF A4."],
  ["React DOM", "https://github.com/facebook/react", "legal/React-DOM-LICENSE.txt", "Rendu de l’interface et génération du HTML de certaines activités pour le PDF A4."],
  ["html-entities", "https://github.com/mdevils/html-entities", "legal/html-entities-LICENSE.txt", "Décodage des caractères HTML, notamment pour le PDF A4."],
  ["Plyr", "https://github.com/sampotts/plyr", "legal/Plyr-LICENSE.txt"],
  ["read-excel-file / write-excel-file", "https://gitlab.com/catamphetamine/read-excel-file", "legal/read-write-excel-file-LICENSE.txt"]
];
for (const [name, source, file, description] of documented) {
  components.push({ group: "Composants", name, version: "", license: "MIT", source, ...(description ? { description } : {}), notices: [{ name: "LICENSE", text: read(file) }] });
}
for (const directory of fs.readdirSync("public/fonts").sort()) {
  const files = notices(path.join("public/fonts", directory));
  // OFL and OpenDyslexic use other file names.
  for (const name of fs.readdirSync(path.join("public/fonts", directory))) {
    if (/^(OFL|licence)\.txt$/i.test(name) && !files.some(file => file.name === name)) files.push({ name, text: read(path.join("public/fonts", directory, name)) });
  }
  components.push({ group: "Polices", name: directory.replaceAll("_", " ").replace("opendyslexic-0.92", "OpenDyslexic"), version: "", license: directory === "Permanent_Marker" ? "Apache-2.0" : "SIL OFL 1.1", source: "", notices: files });
}
components.push({ group: "Attributions", name: "TOAST UI Image Editor", version: "", license: "MIT", source: "https://github.com/nhn/tui.image-editor", description: "Référence pour l’interface, les comportements et l’iconographie de l’annotation. L’outil est développé dans PAIDEIA ; le moteur TOAST UI n’est pas embarqué.", notices: [{ name: "LICENSE", text: read("legal/Toast-UI-Image-Editor-LICENSE.txt") }] });
// Dropper's attribution is fully displayed by its name, licence and source link.
// It has no additional licence text to unfold or repeat in the Word document.
components.push({ group: "Attributions", name: "Dropper — Icon Works n°102647", version: "", license: "CC BY 4.0", source: "https://creativecommons.org/licenses/by/4.0/", notices: [] });
components.push({ group: "Runtime", name: "Microsoft Edge WebView2 Fixed Version", version: "", license: "Conditions Microsoft et licences de ses composants tiers", source: "https://developer.microsoft.com/microsoft-edge/webview2/", description: "Runtime fixe distribué avec PAIDEIA. Microsoft y intègre ses attributions Chromium et autres composants tiers.", notices: [] });
components.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const sections = [];
const texts = new Map();
for (const component of components) {
  component.notices = component.notices.map(notice => {
    let id = texts.get(notice.text);
    if (!id) { id = sections.length + 1; texts.set(notice.text, id); sections.push({ id, text: notice.text }); }
    return { name: notice.name, section: id };
  });
}
const toast = components.find(component => component.name === "TOAST UI Image Editor");
toast.descriptionEn = "Reference for annotation UI, behaviour and iconography. The tool is implemented in PAIDEIA; the TOAST UI engine is not bundled.";
const pdfmake = components.find(component => component.name === "pdfmake");
pdfmake.descriptionEn = "Generates PDF exports of reference banks and the glossary. Lesson A4 PDFs use WebView2.";
const document = { components, sections };
fs.writeFileSync("legal/third-party-notices.json", JSON.stringify(document, null, 2) + "\n");
const lines = ["# Composants tiers et polices de PAIDEIA", "", "Composants déjà documentés dans PAIDEIA et polices embarquées. Cette liste ne recense pas les dépendances indirectes ni les outils de développement ou de compilation. Les textes originaux et attributions sont conservés dans legal/third-party-notices.json et consultables dans PAIDEIA.", ""];
for (const component of components) lines.push(`## ${component.name}${component.version ? ` ${component.version}` : ""}`, "", `- Catégorie : ${component.group}`, `- Licence déclarée : ${component.license}`, ...(component.source ? [`- Source : ${component.source.replace(/^git\+/, "")}`] : []), ...(component.description ? [`- Usage : ${component.description}`] : []), `- Notices : ${component.notices.map(notice => `${notice.name} (texte ${notice.section})`).join(", ") || (component.group === "Runtime" ? "fournies avec le runtime Microsoft" : "attribution ci-dessus")}`, "");
fs.writeFileSync("THIRD_PARTY_NOTICES.md", lines.join("\n"));
console.log(`${components.length} components, ${sections.length} licence and attribution texts, including 12 font families.`);
