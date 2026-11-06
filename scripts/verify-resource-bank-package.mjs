import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import {
  bankNameFromFile,
  exportBankPackage,
  importBankFiles,
  uniqueBankName
} from "../src/components/resources/resourceBankPackage.ts";

const names = new Set(["banque"]);
assert.equal(uniqueBankName("Banque", names), "Banque (2)");
assert.equal(uniqueBankName("Banque", names), "Banque (3)");
assert.equal(bankNameFromFile("Banque (2).xlsx"), "Banque (2)");

const packageBytes = await exportBankPackage([
  { name: "Banque", bytes: strToU8("première") },
  { name: "Banque", bytes: strToU8("seconde") }
]);
const files = await importBankFiles(new File([Uint8Array.from(packageBytes)], "banques.zip"), ["xlsx"]);
assert.deepEqual(files.map((file) => file.name), ["Banque.xlsx", "Banque (2).xlsx"]);
assert.deepEqual(await Promise.all(files.map((file) => file.text())), ["première", "seconde"]);

for (const badName of ["../intrus.xlsx", "intrus.exe", "dossier/intrus.xlsx"]) {
  const zip = zipSync({ "Banque.xlsx": strToU8("valide"), [badName]: strToU8("invalide") });
  await assert.rejects(importBankFiles(new File([zip], "banques.zip"), ["xlsx"]));
}
await assert.rejects(importBankFiles(new File([strToU8("texte")], "banques.zip"), ["xlsx"]));
await assert.rejects(importBankFiles(new File([strToU8("texte")], "banque.xml"), ["xlsx"]));
console.log("Paquets de banques : échanges et refus des archives invalides vérifiés.");
