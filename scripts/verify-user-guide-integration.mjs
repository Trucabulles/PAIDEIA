import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const guideResource = "../docs/Guide_Utilisateur/PAIDEIA_Guide_utilisateur.pdf";
const guideResourcePath = "$RESOURCE/_up_/docs/Guide_Utilisateur/PAIDEIA_Guide_utilisateur.pdf";

const [tauriConfigText, capabilityText, appChrome, appSource, frenchLocaleText, pdf, docx] = await Promise.all([
  readFile("src-tauri/tauri.conf.json", "utf8"),
  readFile("src-tauri/capabilities/default.json", "utf8"),
  readFile("src/components/app/AppChrome.tsx", "utf8"),
  readFile("src/App.tsx", "utf8"),
  readFile("src/locales/fr.json", "utf8"),
  readFile("docs/Guide_Utilisateur/PAIDEIA_Guide_utilisateur.pdf"),
  readFile("Dev_Documentation/10_Guide_Utilisateur/PAIDEIA_Guide_utilisateur.docx")
    .catch((error) => error.code === "ENOENT" ? null : Promise.reject(error))
]);

const tauriConfig = JSON.parse(tauriConfigText);
const capability = JSON.parse(capabilityText);
const frenchLocale = JSON.parse(frenchLocaleText);
assert.ok(tauriConfig.bundle.resources.includes(guideResource), "Le PDF doit être embarqué depuis la documentation.");

const openPathPermission = capability.permissions.find(
  (permission) => typeof permission === "object" && permission.identifier === "opener:allow-open-path"
);
assert.ok(openPathPermission, "L’ouverture du PDF doit disposer d’une permission dédiée.");
assert.deepEqual(openPathPermission.allow, [{ path: guideResourcePath }], "La permission doit rester limitée au guide embarqué.");

assert.ok(appChrome.includes('t("menu.userGuide")'), "Le panneau Informations doit exposer le libellé traduit du guide.");
assert.equal(frenchLocale["menu.userGuide"], "Consulter le guide utilisateur", "Le libellé français du guide doit rester explicite.");
assert.ok(appChrome.includes("onUserGuideOpen"), "Le panneau Informations doit déléguer l’ouverture du guide.");
assert.ok(appSource.includes(`resolveResource("_up_/docs/Guide_Utilisateur/PAIDEIA_Guide_utilisateur.pdf")`));
assert.ok(appSource.includes("await openPath(guidePath)"));

assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-", "L’édition publiée doit être un PDF valide.");
assert.ok(pdf.length > 100_000, "Le PDF embarqué semble incomplet.");
if (docx) {
  assert.equal(docx.subarray(0, 2).toString("ascii"), "PK", "La source éditoriale locale doit être un DOCX valide.");
  assert.ok(docx.length > 100_000, "Le DOCX documentaire local semble incomplet.");
}

console.log("Guide utilisateur : PDF embarqué, menu Informations et permission dédiée vérifiés ; source DOCX locale contrôlée si présente.");
