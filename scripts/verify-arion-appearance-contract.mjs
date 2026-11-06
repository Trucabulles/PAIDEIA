import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const catalog = JSON.parse(await readFile(path.join(root, "src/features/designer-actions/designerKnowledge.data.json"), "utf8"));
const capabilities = await readFile(path.join(root, "src/app/activityAppearanceCapabilities.ts"), "utf8");

function stringArray(name) {
  const source = capabilities.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`))?.[1];
  assert.ok(source, `Registre d’apparence Arion introuvable : ${name}`);
  return [...source.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

const managed = stringArray("ACTIVITY_BACKGROUND_BLOCK_TYPES");
const special = stringArray("ARION_SPECIAL_APPEARANCE_BLOCK_TYPES");
const withoutAppearance = stringArray("REVIEWED_WITHOUT_ACTIVITY_APPEARANCE_BLOCK_TYPES");
const catalogTypes = catalog.activities.map((activity) => activity.blockType);
const reviewed = [...managed, ...special, ...withoutAppearance];

assert.equal(new Set(catalogTypes).size, catalogTypes.length, "Le catalogue Arion contient un type d’activité en double.");
assert.equal(new Set(reviewed).size, reviewed.length, "Le contrat d’apparence Arion classe un type d’activité plusieurs fois.");
assert.deepEqual(
  [...new Set(reviewed)].sort(),
  [...new Set(catalogTypes)].sort(),
  "Toute nouvelle activité doit rejoindre l’apparence Arion ou être explicitement déclarée sans paramètre d’apparence."
);

console.log(`Contrat d’apparence Arion vérifié : ${managed.length + special.length} types pris en charge, ${withoutAppearance.length} types explicitement sans apparence.`);
