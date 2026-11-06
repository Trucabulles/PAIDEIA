import { createDefaultCardSortData } from "../src/components/activities/CardSortActivity/cardSortDefaults";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { buildLessonPdfModel } from "../src/export/pdf/buildLessonPdfModel";
import { renderLessonPdfHtml, PDF_HTML_PRINT_ZOOM } from "../src/export/pdf/renderLessonPdfHtml";
import type { PaideiaBlock, PaideiaProject } from "../src/types/project";

const window = new Window();
for (const name of ["document", "Node", "Element", "HTMLElement", "HTMLAnchorElement", "HTMLImageElement", "HTMLSpanElement", "HTMLParagraphElement", "Text"]) (globalThis as any)[name] = (window as any)[name];
const block = (id: string, type: string, extra: Partial<PaideiaBlock> = {}): PaideiaBlock => ({id,type,title:"",summary:"",trackingKey:id,...extra});
const project = {
  id:"contract",title:"A4 <safe>",defaultLocale:"fr",activitySpacingPx:30,
  course:{id:"course",title:"Test",modules:[{id:"module",title:"M",chapters:[{id:"chapter",title:"C",pages:[{id:"page",title:"P",blocks:[
    block("inline","rich-text",{contentHtml:'<p><span style="font-size:18px;color:#245">Texte sélectionnable</span><script>bad()</script><img data-paideia-asset-ref="images/one.png" src="http://asset.localhost/wrong"></p>'}),
    block("image","image-text",{contentHtml:"<p>À droite</p>",mediaLayout:"image-right",imageSize:"40",assetRefs:["images/one.png"]}),
    block("tabs","tabs",{activityItems:[{id:"a",title:"Premier",contentHtml:"<p>Un</p>"},{id:"b",title:"Deuxième",contentHtml:"<p>Deux</p>"}]}),
    block("accordion","accordion",{activityItems:[{id:"a",title:"Ouvert",contentHtml:"<p>Contenu ouvert</p>"}]}),
    block("sort","card-sort",{cardSort:createDefaultCardSortData(),activityItems:[{id:"card-a",title:"Carte A",contentHtml:"<p>Carte A</p>",correctCategoryId:"category_1"},{id:"card-b",title:"Carte B",contentHtml:"<p>Carte B</p>",correctCategoryId:"category_2"}]}),
    block("note","note",{contentHtml:"<p>Information</p>",panelRounded:true,panelShadow:true,panelBorderColor:"#123a7a"}),
    block("audio","audio",{activityItems:[{id:"a",title:"Écouter",contentHtml:"<p>Commentaire</p>",assetRefs:["audio/a.mp3"]}]}),
    block("matching","matching",{matching:{pairs:[{id:"p",leftHtml:"<p>Gauche</p>",rightHtml:"<p>Droite</p>"}],successFeedbackHtml:"<p>Résultat</p>",failureFeedbackHtml:""} as any})
  ]}]}]}]}
} as PaideiaProject;
const before=JSON.stringify(project);
const model=buildLessonPdfModel(project);
const html=renderLessonPdfHtml(model,project,{"images/one.png":"data:image/png;base64,aA=="});
window.document.write(html);
assert.equal(JSON.stringify(project),before,"export does not mutate the source lesson");
assert.equal(window.document.querySelectorAll(".activity").length,8);
assert.equal(window.document.querySelectorAll(".expanded.tabs").length,2,"each tab has a separate selected state");
assert.equal(window.document.querySelectorAll(".expanded.accordion").length,1);
assert.ok(window.document.querySelector('.paideia-image-text-activity[data-layout="image-right"]'));
assert.ok(html.includes("--image-text-max-width: 970px"), "A4 uses the validated component width");
assert.ok(html.includes("flex: 0 0 auto"), "image width is intrinsic within its maximum");
assert.equal(window.document.querySelectorAll("script").length,0,"authored HTML cannot execute");
assert.ok(!html.includes("http://asset.localhost"),"no dependency on source WebView asset URLs");
assert.ok(html.includes("data:image/png;base64,aA=="),"inline image remains at its authored position");
assert.ok(html.includes("font-size:18px"),"authored font sizes retain their ratios");
assert.ok(Math.abs(18*PDF_HTML_PRINT_ZOOM*.75-11.5)<0.05,"default text is 11.5pt on A4");
assert.ok(html.includes("Gauche") && html.includes("Droite") && html.includes("Résultat"),"established correction remains present");
assert.ok(window.document.querySelector(".audio-player"));
assert.ok(window.document.querySelector(".card-sort-monobloc"),"real initial tri layout is present");
assert.ok(renderLessonPdfHtml({...model,lessonTitle:"MODULARIT&Eacute\u202f;"},project,{}).includes("MODULARITÉ"),"malformed legacy accent is decoded");
assert.ok(html.includes("Catégorie 1 — Carte A") && html.includes("Catégorie 2 — Carte B"),"both card/category answers remain below the initial layout");
assert.ok(html.includes("box-shadow:none!important"));
const learnerProject = structuredClone(project);
const learnerBlocks = learnerProject.course.modules[0].chapters[0].pages[0].blocks;
learnerBlocks.push(
  block("content-title", "rich-text", { title: "Titre technique du texte", contentHtml: "<h3>Titre pédagogique conservé</h3><p>Contenu pédagogique conservé</p>" }),
  block("grid-title", "image-grid", { title: "Titre technique de la grille", activityItems: [{ id: "grid-item", title: "Image", contentHtml: "<p>Légende pédagogique conservée</p>", assetRefs: ["images/one.png"] }] }),
  block("divider-title", "divider", { title: "Séparateur horizontal technique", dividerColor: "#aabbcc", dividerWidth: "3px" }),
  block("marker-title", "section-marker", { title: "Séparateur repéré technique", markerType: "filled" }),
  block("quiz", "quiz", { title: "Évaluation interdite" }),
  block("video", "media", { variant: "video", assetRefs: ["video/lesson.mp4"], subtitleRefs: ["subtitles/lesson.vtt"] }),
  block("continue", "continue", { summary: "Continuer" }),
  block("poi", "point-of-interest", { pointOfInterestMarkers: [{ id: "point", order: 1, x: 50, y: 50, label: "1", title: "À lire", contentHtml: "<p>Lecture du point</p>" }] })
);
learnerBlocks[0].contentHtml = '<p><span data-paideia-bookmark-id="bookmark-target">Destination</span> <span data-paideia-reference-id="reference-1" data-paideia-bookmark-target="bookmark-target">Voir le passage</span> <span data-paideia-reference-id="reference-2" data-paideia-bookmark-target="resource-entry" data-paideia-reference-bank-id="bank" data-paideia-reference-entry-id="entry" data-paideia-bookmark-label="Terme" data-paideia-reference-definition="&lt;p&gt;Définition utile.&lt;/p&gt;">Terme</span> puis <span data-paideia-reference-id="reference-3" data-paideia-bookmark-target="resource-entry" data-paideia-reference-bank-id="bank" data-paideia-reference-entry-id="entry" data-paideia-bookmark-label="Terme" data-paideia-reference-definition="&lt;p&gt;Définition utile.&lt;/p&gt;">ce terme</span>.</p>';
learnerBlocks.find((item) => item.id === "audio")!.activityItems![0].transcriptStatus = "validated";
learnerBlocks.find((item) => item.id === "audio")!.activityItems![0].transcriptHtml = "<p>Texte audio</p>";
const learnerModel = buildLessonPdfModel(learnerProject, { profile: "learner", subtitleHtmlByBlockId: { video: "<p>Texte vidéo</p>" } });
const learnerHtml = renderLessonPdfHtml(learnerModel, learnerProject, {});
assert.ok(learnerHtml.includes("Support de leçon édité le"));
const learnerDocument = window.document.createElement("div");
learnerDocument.innerHTML = learnerHtml;
assert.ok(learnerDocument.querySelector('[data-activity-id="divider-title"] hr'), "learner separator line remains");
assert.ok(learnerDocument.querySelector('[data-activity-id="marker-title"] .pdf-marker span'), "learner numbered marker remains");
assert.ok(!learnerDocument.querySelector('[data-activity-id="divider-title"] h3'));
assert.ok(!learnerDocument.querySelector('[data-activity-id="marker-title"] h3'));
assert.ok(!learnerHtml.includes("Séparateur horizontal technique") && !learnerHtml.includes("Séparateur repéré technique"));
assert.ok(!learnerHtml.includes("Titre technique du texte") && !learnerHtml.includes("Titre technique de la grille"), "all technical activity titles are hidden for learners");
assert.equal(learnerDocument.querySelector('[data-activity-id="content-title"] h3')?.textContent, "Titre pédagogique conservé", "authored headings remain without a duplicate technical heading");
assert.ok(learnerHtml.includes("Contenu pédagogique conservé") && learnerHtml.includes("Légende pédagogique conservée"), "authored content and image captions remain");
const reviewWithSeparators = renderLessonPdfHtml(buildLessonPdfModel(learnerProject), learnerProject, {});
assert.ok(reviewWithSeparators.includes("Séparateur horizontal technique") && reviewWithSeparators.includes("Séparateur repéré technique"), "review titles remain");
assert.ok(reviewWithSeparators.includes("Titre technique du texte") && reviewWithSeparators.includes("Titre technique de la grille"), "review keeps technical titles for every activity family");

assert.ok(learnerHtml.includes("Texte audio") && learnerHtml.includes("Texte vidéo"));
assert.ok(learnerHtml.includes("Lecture du point") && learnerHtml.includes("Contenu ouvert"));
assert.ok(!learnerHtml.includes("Évaluation interdite") && !learnerHtml.includes("Continuer") && !learnerHtml.includes('<div class="audio-player"'));
assert.ok(!learnerHtml.includes("Activité 1") && !learnerHtml.includes("Document de relecture"));
assert.ok(learnerHtml.includes('href="#pdf-bookmark-target"'));
assert.ok(learnerHtml.includes("Définition utile."));
assert.equal((learnerHtml.match(/id="pdf-note-1"/g) ?? []).length, 1);
assert.equal((learnerHtml.match(/href="#pdf-note-1"/g) ?? []).length, 2);
assert.ok(learnerHtml.indexOf('class="learner-notes"') > learnerHtml.indexOf('id="chapter-1"'));
console.log("Contrat HTML A4 expérimental validé.");
await window.happyDOM.close();
