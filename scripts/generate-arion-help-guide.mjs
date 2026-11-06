import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const vite = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });
try {
  const { PAIDEIA_ACTIVITY_CATALOG, PAIDEIA_HELP_PROCEDURES } = await vite.ssrLoadModule("/src/features/designer-actions/designerKnowledgeCatalog.ts");
  const sections = PAIDEIA_ACTIVITY_CATALOG.map((entry) => [
    `## ${entry.name}`,
    "",
    entry.purpose,
    "",
    `**Usages adaptés :** ${entry.whenToUse.join(", ")}.`,
    "",
    `**Fonctionnement :** ${entry.howItWorks}`,
    ...(entry.howTo?.length ? ["", "**Procédure :**", "", ...entry.howTo.map((step, index) => `${index + 1}. ${step}`)] : []),
    ...(entry.cautions?.length ? ["", "**Points de vigilance :**", "", ...entry.cautions.map((item) => `- ${item}`)] : [])
  ].join("\n"));
  const procedures = PAIDEIA_HELP_PROCEDURES.map((entry) => [
    `## ${entry.name}`,
    "",
    entry.summary,
    "",
    ...entry.steps.map((step, index) => `${index + 1}. ${step}`)
  ].join("\n"));
  const content = [
    "# PAIDEIA — Aide structurée d’Arion",
    "",
    "> Fichier généré depuis `designerKnowledgeCatalog.ts`. Ne pas modifier directement.",
    "",
    "Cette documentation est la restitution lisible de la même source structurée que celle utilisée par Arion pour répondre aux questions sur les activités et les procédures.",
    "",
    "# Activités",
    "",
    ...sections,
    "",
    "# Procédures",
    "",
    ...procedures,
    ""
  ].join("\n");
  const output = path.resolve("Dev_Documentation/02_Fonctionnel/Arion_Aide_Generee.md");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, content, "utf8");
} finally {
  await vite.close();
}
