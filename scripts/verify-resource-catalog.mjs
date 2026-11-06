import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { Window } from "happy-dom";

const window = new Window({url:"http://localhost"});
for (const key of ["window","document","navigator","HTMLElement","Element","Node","Event","MouseEvent","localStorage"]) Object.defineProperty(globalThis,key,{configurable:true,value:key === "window" ? window : window[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
const jsx = await import("react/jsx-runtime");
const {createRoot} = await import("react-dom/client");
const {Simulate} = await import("react-dom/test-utils");
const {act} = React;
const modules = new Map();
function sourceModule(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {};
  const code = ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function("exports","require",code)(exports,name => {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsx;
    if (name.includes("i18n")) return {useI18n:()=>({language:"fr",t:key=>key}),translateActive:key=>key};
    if (name.includes("ScrollBoundaryControls")) return {ScrollBoundaryControls:()=>null};
    if (name.endsWith(".module.css")) return {default:new Proxy({},{get:(_,key)=>String(key)})};
    if (name.endsWith(".css")) return {};
    if (name.includes("useEscapeNavigation")) return {useEscapeNavigation(){}};
    if (name.includes("useResourceBankTransfer")) return {useResourceBankTransfer:()=>({checkbox:()=>null})};
    if (name.includes("resourceBankApi")) return {loadResourceBank(){throw Error("Search must not load bank content");}};
    if (/resourceWorkbook|resourceBankPackage|moodleQuestionBank/.test(name)) return {};
    if (name.includes("ResourceCatalogControls")) return sourceModule("src/components/resources/ResourceCatalogControls.tsx");
    if (name.includes("resourceCatalog")) return sourceModule("src/components/resources/resourceCatalog.ts");
    if (name.startsWith(".")) {
      const base = path.join(path.dirname(file),name);
      for (const suffix of [".ts",".tsx"]) if (existsSync(base + suffix)) return sourceModule(base + suffix);
    }
    throw new Error(name);
  });
  modules.set(file,exports);
  return exports;
}
const {selectResourceTiles} = sourceModule("src/components/resources/resourceCatalog.ts");
const banks = [{id:"b",name:"Sécurité",resourceModifiedAt:20},{id:"a",name:"Éthique",resourceModifiedAt:10},{id:"c",name:"Ancienne banque",resourceModifiedAt:null}];
const original = JSON.stringify(banks);
assert.deepEqual(selectResourceTiles(banks,"SECURITE","name-asc","fr").map(b=>b.id),["b"]);
assert.deepEqual(selectResourceTiles(banks,"","name-asc","fr").map(b=>b.id),["c","a","b"]);
assert.deepEqual(selectResourceTiles(banks,"","name-desc","fr").map(b=>b.id),["b","a","c"]);
assert.deepEqual(selectResourceTiles(banks,"","recent","fr").map(b=>b.id),["b","a","c"]);
assert.deepEqual(selectResourceTiles(banks,"","oldest","fr").map(b=>b.id),["a","b","c"]);
assert.equal(JSON.stringify(banks),original);
const {sortLibraryEntries} = sourceModule("src/app/librarySort.ts");
const lessons = [{archivePath:"a",title:"Leçon 10",updatedAt:"2026-10-05T10:00:00Z"},{archivePath:"b",title:"Leçon 2",updatedAt:"2026-10-06T10:00:00Z"},{archivePath:"c",title:"Autre",updatedAt:""}];
const lessonSnapshot = JSON.stringify(lessons);
for (const [sort, expected] of [["name-asc",["c","b","a"]],["name-desc",["a","b","c"]],["recent",["b","a","c"]],["oldest",["a","b","c"]]]) {
  assert.deepEqual(sortLibraryEntries(lessons,sort,"fr").map(item=>item.archivePath),expected);
  assert.deepEqual(sortLibraryEntries(lessons.filter(item=>item.archivePath!=="c"),sort,"fr").map(item=>item.archivePath),expected.filter(id=>id!=="c"));
}
assert.equal(JSON.stringify(lessons),lessonSnapshot);
assert.equal(sortLibraryEntries(lessons,"recent","fr")[0],lessons[1]);
const {ResourcesScreen} = sourceModule("src/components/resources/ResourcesScreen.tsx");
const {useResourceTiles,ResourceSortControl,ResourceNoResults} = sourceModule("src/components/resources/ResourceCatalogControls.tsx");
function Tiles({items}) {
  const visible = useResourceTiles(items);
  return React.createElement("section",null,React.createElement(ResourceSortControl),...visible.map(item=>React.createElement("article",{key:item.id},item.name)),React.createElement(ResourceNoResults,{count:visible.length}));
}
function Harness() {
  const [section,setSection] = React.useState("questions");
  return React.createElement(ResourcesScreen,{activeSection:section,onSectionChange:setSection},React.createElement(Tiles,{items:section === "questions" ? banks : [{id:"other",name:"Autre ressource",resourceModifiedAt:30}]}));
}
const host = document.createElement("div"); document.body.append(host);
let root = createRoot(host);
await act(async()=>root.render(React.createElement(Harness)));
const titles = ()=>Array.from(host.querySelectorAll("article")).map(item=>item.textContent);
const input = ()=>host.querySelector('input[type="search"]');
assert.ok(input().closest(".resources-sidebar"));
await act(async()=>Simulate.change(input(),{target:{value:"securite"}}));
assert.deepEqual(titles(),["Sécurité"]);
const referenceButton = host.querySelectorAll(".resources-nav-item")[3];
await act(async()=>referenceButton.click());
assert.equal(input().value,"");
assert.deepEqual(titles(),["Autre ressource"],"search is scoped to the active family");
const questionButton = Array.from(host.querySelectorAll(".resources-nav-item")).find(button=>button.textContent === "resources.questions");
await act(async()=>questionButton.click());
assert.equal(input().value,"securite");
await act(async()=>Simulate.change(input(),{target:{value:""}}));
assert.equal(titles().length,3,"clearing search restores all tiles");
await act(async()=>Simulate.change(host.querySelector("select"),{target:{value:"recent"}}));
assert.deepEqual(titles(),["Sécurité","Éthique","Ancienne banque"]);
assert.equal(localStorage.getItem("paideia.resources.sort.questions"),"recent");
assert.equal(localStorage.getItem("paideia.resources.sort.references"),null);
await act(async()=>root.unmount());
root = createRoot(host);
await act(async()=>root.render(React.createElement(Harness)));
assert.equal(host.querySelector("select").value,"recent","sort survives screen recreation");
await act(async()=>Simulate.change(input(),{target:{value:"introuvable"}}));
assert.equal(titles().length,0);
assert.ok(host.querySelector('[role="status"]'));
await act(async()=>root.unmount());
for (const [section,file,component] of [
  ["questions","src/components/resources/QuestionBank/QuestionBankManager.tsx","QuestionBankManager"],
  ["references","src/components/resources/ReferenceBankResourceManager.tsx","ReferenceBankResourceManager"],
  ["assistant","src/components/resources/AssistantResource/AssistantResourceManager.tsx","AssistantResourceManager"],
  ["characters","src/components/resources/CharacterResource/CharacterResourceManager.tsx","CharacterResourceManager"]
]) {
  const Component = sourceModule(file)[component];
  const resources = banks.map(bank=>({...bank,contentLoaded:false,contentCount:25,questions:[],entries:[],poses:[],projectPaths:[],collectionIds:[],lessonIds:[],revision:1}));
  const props = {banks:resources,assistants:resources,characters:resources,collections:[],lessonProjects:[],selectedCharacterId:"",draft:{id:"",name:"",role:"",description:""},resolveTileImageSrc:()=>null,resolveAvatarSrc:()=>null,resolvePreviewUrl:()=>null,formatCount:()=>"",onBanksChange(){},onAssistantsChange(){}};
  root = createRoot(host);
  await act(async()=>root.render(React.createElement(ResourcesScreen,{activeSection:section,onSectionChange(){}},React.createElement(Component,props))));
  assert.equal(host.querySelectorAll(".resource-portal-card").length,3,section);
  if (section === "characters") {
    const row = host.querySelector(".resource-bank-title-row");
    assert.equal(row.lastElementChild.className,"resource-sort-control","character sorting must be the last command, as in other resource families");
    assert.ok(row.querySelector(".resource-bank-select-all").compareDocumentPosition(row.querySelector(".resource-character-transfer-actions")) & Node.DOCUMENT_POSITION_FOLLOWING,"select all precedes transfers");
  }
  await act(async()=>Simulate.change(input(),{target:{value:"securite"}}));
  assert.equal(host.querySelectorAll(".resource-portal-card").length,1,section);
  assert.equal(host.querySelector(".resource-portal-title").textContent,"Sécurité",section);
  await act(async()=>Simulate.change(input(),{target:{value:""}}));
  assert.equal(host.querySelectorAll(".resource-portal-card").length,3,section);
  assert.equal(resources.length,3,"display filter must not alter persistence inputs");
  await act(async()=>root.unmount());
}
await window.happyDOM.close();
console.log("PASS resource catalogue: accent-insensitive search, four sorts, unchanged descriptors, active-family isolation, clear/reset, remembered preferences and empty state.");
