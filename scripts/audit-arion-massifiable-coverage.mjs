import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";
import writeXlsxFile from "write-excel-file/node";

const repositoryRoot = process.cwd();
const sourceRoot = path.join(repositoryRoot, "src");
const outputRoot = path.join(repositoryRoot, "Dev_Documentation", "07_Qualite");
const projectTypesFile = path.join(sourceRoot, "types", "project.ts");
const appStateTypesFile = path.join(sourceRoot, "app", "appStateTypes.ts");
const capabilityFile = path.join(sourceRoot, "features", "designer-actions", "designerCapabilityRegistry.ts");
const intentFile = path.join(sourceRoot, "features", "designer-actions", "designerIntentRegistry.ts");
const engineFile = path.join(sourceRoot, "features", "designer-actions", "designerActionEngine.ts");
const verificationFile = path.join(repositoryRoot, "scripts", "verify-designer-actions.mjs");
const markdownOutput = path.join(outputRoot, "Audit_Couverture_Massifiable_Arion.md");
const jsonOutput = path.join(outputRoot, "Audit_Couverture_Massifiable_Arion.json");
const xlsxOutput = path.join(outputRoot, "Audit_Couverture_Massifiable_Arion.xlsx");

const ROOT_TYPES = [
  { alias: "PaideiaBlock", prefix: "block" },
  { alias: "CourseAppearance", prefix: "project.courseAppearance" },
  { alias: "CourseTitleStyle", prefix: "project.titleStyle" },
  { alias: "CourseCoverStyle", prefix: "project.courseCoverStyle" }
];

const EXTRA_PROJECT_FIELDS = [
  { path: "project.activitySpacingPx", type: "number | null", source: "PaideiaProject" }
];

const TARGET_TO_MODEL_PATHS = {
  courseTextColor: ["project.courseAppearance.textColor", "project.courseAppearance.textColorMode"],
  textActivityContentHtml: ["block.contentHtml"],
  activityRichTextBlockJson: ["block.contentHtml", "block.quoteAuthorHtml", "block.activityItems[].contentHtml", "block.activityItems[].cardFeedbackHtml", "block.activityItems[].cardFeedbackCorrectHtml", "block.activityItems[].cardFeedbackIncorrectHtml"],
  continueButtonBackgroundColor: ["block.buttonBackgroundColor"],
  continueButtonTextColor: ["block.buttonTextColor"],
  continueButtonLabel: ["block.summary"]
};

const OPERATION_PATH_OVERRIDES = {
  "set-activity-frame-background-color": ["block.panelBackgroundColor", "block.matching.labelAppearance.backgroundColor", "block.slidesActivityBackgroundColor"],
  "set-activity-frame-rounded": ["block.panelRounded", "block.matching.labelAppearance.rounded", "block.findElements.imageAppearance.rounded", "block.slidesActivityRounded", "block.cardSort.cardAppearance.rounded"],
  "set-activity-frame-shadow": ["block.panelShadow", "block.findElements.imageAppearance.shadow", "block.slidesActivityShadow"],
  "set-activity-frame-accent-color": ["block.buttonTextColor", "block.buttonBackgroundColor", "block.panelBorderColor"],
  "reset-activity-frame-appearance": ["block.panelBackgroundColor", "block.panelBorderColor", "block.panelBorderWidth", "block.panelBorderStyle", "block.panelRounded", "block.panelShadow", "block.buttonTextColor", "block.buttonBackgroundColor", "block.matching.labelAppearance.backgroundColor", "block.matching.labelAppearance.rounded", "block.findElements.imageAppearance.rounded", "block.findElements.imageAppearance.shadow", "block.slidesActivityBackgroundColor", "block.slidesActivityRounded", "block.slidesActivityShadow", "block.cardSort.cardAppearance.rounded"],
  "reset-divider-appearance": ["block.dividerColor", "block.dividerWidth", "block.dividerStyle"],
  "reset-section-marker-appearance": ["block.dividerColor", "block.dividerWidth", "block.dividerStyle", "block.markerScheme", "block.markerType", "block.markerTextColor"],
  "reset-header-appearance": ["block.headerBackgroundColor", "block.headerTextColor", "block.sectionBackgroundBlur", "block.sectionBackgroundOpacity", "block.sectionBackgroundOverlayDark", "block.contentAlign", "block.headerTextOutline", "block.headerTextOutlineColor"],
  "copy-continue-button-style-to-course-exit": ["block.buttonBackgroundColor", "block.buttonTextColor"],
  "copy-course-exit-button-style-to-continue": ["block.buttonBackgroundColor", "block.buttonTextColor"],
  "set-activity-background-rounded": ["block.sectionBackgroundRounded", "block.panelRounded"],
  "reset-activity-background": [
    "block.sectionBackgroundColor", "block.sectionBackgroundImageRef", "block.sectionBackgroundOpacity",
    "block.sectionBackgroundOverlayDark", "block.sectionBackgroundBlur", "block.sectionBackgroundRounded",
    "block.sectionBackgroundWide", "block.sectionBackgroundHeight"
  ],
  "reset-continue-button": ["block.buttonBackgroundColor", "block.buttonTextColor", "block.summary"],
  "set-lesson-text-color": ["project.courseAppearance.textColor", "project.courseAppearance.textColorMode"],
  "reset-lesson-text-color": ["project.courseAppearance.textColor", "project.courseAppearance.textColorMode"]
};

const PRODUCT_EXCLUDED_PATHS = new Map([
  ["block.sectionBackgroundPositionY", "Repositionnement manuel de l’image de fond, sans réglage d’apparence massifiable."],
  ["block.imageRounded", "Propriété partagée par des usages d’image hétérogènes ; exclue tant que chaque usage n’est pas séparé."],
  ["block.markerPopupWidth", "Dimension propre à la fenêtre d’un Point d’intérêt, exclue par décision produit."],
  ["block.markerPopupHeight", "Dimension propre à la fenêtre d’un Point d’intérêt, exclue par décision produit."],
  ["block.panelPadding", "Réglage interne non exposé dans l’éditeur."],
  ["block.headerHeight", "Hauteur calculée automatiquement selon le texte ; aucun réglage n’est exposé."],
  ["block.headerImagePositionY", "Repositionnement manuel de l’image d’en-tête, exclu de la massification."]
]);

const PROBABLE_NAME = /(backgroundcolor|sectionbackground|panelbackground|panelborder|dividercolor|dividerwidth|dividerstyle|markertextcolor|markertype|markerscheme|outlinecolor|textoutline|rounded|shadow|opacity|blur|contentalign|paddingoffset|fontfamily)/i;
const BEHAVIOR_NAME = /(attempt|threshold|shuffle|feedback|retry|review|score|gate|mode|enabled|show|allow|decorative|openmode|casesensitive|interaction)/i;
const INSTANCE_CONTENT_NAME = /(^|\.)(id|type|family|variant|title|summary|label|contenthtml|descriptionhtml|introhtml|afterhtml|questionhtml|texthtml|answer|answers|variants|url|term|aliases|related|role|emotion|action|name|fileName)$/i;
const ASSET_OR_SOURCE_NAME = /(?:assetrefs?|assetref|filename|storedname|entryfile|packagename|rawdestination|sourcerawhtml|sourceformat|sourceblocktype|originalref|optimizedref|subtitlerefs?|transcript|annotation|crop|backgroundref|imageref|license|videooptimizationprofile)/i;
const ACCESSIBILITY_PATH = /Accessibility\.(?:altText|decorative)$/i;
const GEOMETRY_NAME = /(^|\.)(x|y|x1|x2|y1|y2|yaw|pitch|points|order)$/i;
const TECHNICAL_NAME = /(tracking|created|updated|rootcourse|locale|status|version|slug)/i;
const SHARED_SETTING_PATH = /(\.settings\.|Appearance\.|courseAppearance\.|titleStyle\.|courseCoverStyle\.|\.labels\.|\.ending\.)/i;
const SHARED_TEXT_SETTING = /(feedback.*html$|label.*html$)/i;
const CARD_BACKGROUND_PATH = /(?:activityItems\[\]\.cardBackgroundColor|cardSort\.cardAppearance\.backgroundColor|flipCard(?:Front|Back)BackgroundColor)$/i;

const FAMILY_RULES = [
  [/^project\.courseAppearance\./, "Leçon · Apparence générale"],
  [/^project\.titleStyle\./, "Leçon · Titre"],
  [/^project\.courseCoverStyle\./, "Leçon · Couverture"],
  [/^project\./, "Leçon · Mise en page"],
  [/^block\.quiz\./, "Quiz"],
  [/^block\.matching\./, "Association"],
  [/^block\.cardSort\./, "Tri de cartes"],
  [/^block\.findElements\./, "Chercher dans l’image"],
  [/^block\.complete\./, "Texte à trous"],
  [/^block\.activityItems\[\]\./, "Éléments internes d’activité"],
  [/^block\.image360/, "Image 360°"],
  [/^block\.pointOfInterest/, "Points d’intérêt"],
  [/^block\.situationalDialogue/, "Mise en situation"],
  [/^block\.audio/, "Audio"],
  [/^block\.slides/, "Diaporama"],
  [/^block\.(?:button|summary)/, "Bouton Continuer"],
  [/^block\.sectionBackground/, "Fond d’activité"],
  [/^block\.panel/, "Panneau d’activité"],
  [/^block\.(?:header|divider)/, "Structure visuelle"],
  [/^block\.(?:content|padding|verticalAlign)/, "Texte et mise en page"],
  [/^block\.image/, "Image"],
  [/^block\.marker/, "Marqueurs"],
  [/^block\.flipCard/, "Cartes à retourner"]
];

function familyForPath(propertyPath) {
  return FAMILY_RULES.find(([pattern]) => pattern.test(propertyPath))?.[1] ?? "Autres réglages d’activité";
}

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function propertyName(node) {
  if (!node) return "";
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return node.getText().replace(/^['"]|['"]$/g, "");
}

function sourceFile(program, fileName) {
  const normalized = normalizePath(path.resolve(fileName)).toLocaleLowerCase("en-US");
  const found = program.getSourceFiles().find((candidate) => normalizePath(path.resolve(candidate.fileName)).toLocaleLowerCase("en-US") === normalized);
  if (!found) throw new Error(`Source TypeScript introuvable : ${fileName}`);
  return found;
}

function findTypeAlias(program, fileName, aliasName) {
  const file = sourceFile(program, fileName);
  const declaration = file.statements.find((statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === aliasName);
  if (!declaration) throw new Error(`Type ${aliasName} introuvable dans ${fileName}`);
  return declaration;
}

function nonNullableMembers(type) {
  return type.isUnion() ? type.types.filter((member) => !(member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))) : [type];
}

function isLeafType(checker, type) {
  const members = nonNullableMembers(type);
  return members.every((member) => Boolean(member.flags & (
    ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike |
    ts.TypeFlags.BigIntLike | ts.TypeFlags.ESSymbolLike | ts.TypeFlags.Any |
    ts.TypeFlags.Unknown | ts.TypeFlags.Never | ts.TypeFlags.TypeParameter
  ))) || members.length > 1 && members.every((member) => !member.getProperties().length);
}

function flattenType(checker, type, currentPath, source, depth = 0, ancestors = new Set()) {
  const value = checker.getNonNullableType(type);
  const typeText = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
  if (depth >= 6 || isLeafType(checker, value)) return [{ path: currentPath, type: typeText, source }];

  if (checker.isArrayType(value) || checker.isTupleType(value)) {
    const elementType = checker.getTypeArguments(value)[0];
    if (!elementType) return [{ path: `${currentPath}[]`, type: typeText, source }];
    return flattenType(checker, elementType, `${currentPath}[]`, source, depth + 1, ancestors);
  }

  const identity = value.id ?? checker.typeToString(value);
  if (ancestors.has(identity)) return [{ path: currentPath, type: typeText, source }];
  const nextAncestors = new Set(ancestors).add(identity);
  const properties = value.getProperties();
  if (!properties.length) return [{ path: currentPath, type: typeText, source }];

  return properties.flatMap((property) => {
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    if (!declaration) return [];
    const childType = checker.getTypeOfSymbolAtLocation(property, declaration);
    return flattenType(checker, childType, `${currentPath}.${property.getName()}`, source, depth + 1, nextAncestors);
  });
}

function extractCapabilities(file) {
  const capabilities = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText() === "DESIGNER_CAPABILITIES" && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue;
        const fields = Object.fromEntries(element.properties.filter(ts.isPropertyAssignment).map((entry) => [propertyName(entry.name), entry.initializer]));
        const stringValue = (name) => fields[name] && ts.isStringLiteralLike(fields[name]) ? fields[name].text : "";
        const stringArray = (name) => fields[name] && ts.isArrayLiteralExpression(fields[name])
          ? fields[name].elements.filter(ts.isStringLiteralLike).map((entry) => entry.text)
          : [];
        capabilities.push({ id: stringValue("id"), command: stringValue("command"), operationKinds: stringArray("operationKinds"), blockTypes: stringArray("blockTypes") });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return capabilities;
}

function extractOperationTargets(file) {
  const result = new Map();
  function visit(node) {
    if (ts.isSwitchStatement(node) && node.expression.getText() === "operation.kind") {
      for (const clause of node.caseBlock.clauses) {
        if (!ts.isCaseClause(clause) || !ts.isStringLiteralLike(clause.expression)) continue;
        const operation = clause.expression.text;
        const targets = new Set();
        function inspect(candidate) {
          if (ts.isPropertyAssignment(candidate) && propertyName(candidate.name) === "property" && ts.isStringLiteralLike(candidate.initializer)) targets.add(candidate.initializer.text);
          ts.forEachChild(candidate, inspect);
        }
        clause.statements.forEach(inspect);
        if (targets.size) result.set(operation, [...targets]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return result;
}

function extractResolverCapabilities(file) {
  const resolved = new Set();
  function visit(node) {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === "capabilityIds" && ts.isArrayLiteralExpression(node.initializer)) {
      node.initializer.elements.filter(ts.isStringLiteralLike).forEach((entry) => resolved.add(entry.text));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return resolved;
}

async function walkFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(fullPath));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function classifyCandidate(propertyPath, arionAccess) {
  const leaf = propertyPath.split(".").pop().replace(/\[\]$/, "");
  if (arionAccess === "oui") return { proposal: "déjà massifiable", reason: "La propriété est reliée à une opération Arion exécutable." };
  if (arionAccess === "partiel") return { proposal: "couverture partielle", reason: "Arion transforme une partie de ce contenu ou de cette structure, sans exposer toute la propriété." };
  if (PRODUCT_EXCLUDED_PATHS.has(propertyPath)) return { proposal: "à exclure", reason: PRODUCT_EXCLUDED_PATHS.get(propertyPath) };
  if (TECHNICAL_NAME.test(propertyPath)) return { proposal: "à exclure", reason: "Métadonnée technique, de suivi ou de compatibilité." };
  if (propertyPath.startsWith("project.")) return { proposal: "à exclure", reason: "Réglage unique à la leçon : il ne relève pas d’une opération de masse sur plusieurs activités." };
  if (ASSET_OR_SOURCE_NAME.test(propertyPath)) return { proposal: "à arbitrer", reason: "Média ou source : massification admise seulement sur demande explicite, avec confirmation et restauration complète des fichiers." };
  if (ACCESSIBILITY_PATH.test(propertyPath)) return { proposal: "à exclure", reason: "Information d’accessibilité éditoriale propre à chaque média." };
  if (CARD_BACKGROUND_PATH.test(propertyPath)) return { proposal: "à exclure", reason: "Fond propre à la composition visuelle des cartes, exclu du périmètre de massification Arion." };
  if (GEOMETRY_NAME.test(propertyPath) || /\[\]\.(?:width|height)$/.test(propertyPath)) return { proposal: "à exclure", reason: "Coordonnée, dimension ou ordre propre à une occurrence." };
  if (INSTANCE_CONTENT_NAME.test(propertyPath)) return { proposal: "à exclure", reason: "Contenu éditorial propre à une occurrence." };
  if (propertyPath.includes("[]")) return { proposal: "à arbitrer", reason: "Valeur portée par une occurrence interne : une commande de masse devrait préciser si elle vise toutes les occurrences ou seulement une sélection." };
  if (BEHAVIOR_NAME.test(leaf) || SHARED_TEXT_SETTING.test(leaf) || propertyPath === "block.quoteShowAuthor") {
    return { proposal: "à exclure", reason: "Réglage porteur de sens pédagogique, de progression, de feedback ou de contenu propre à chaque activité." };
  }
  if (PROBABLE_NAME.test(leaf) || /^(block\.(?:header|divider|marker|panel|sectionBackground))/.test(propertyPath)) {
    return { proposal: "probablement massifiable", reason: "Réglage transversal d’apparence à faible risque sémantique." };
  }
  return { proposal: "à arbitrer", reason: "Propriété éditable sans classification automatique suffisamment sûre." };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function spreadsheetCell(value, options = {}) {
  return { value: value ?? "", ...options };
}

const compilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  skipLibCheck: true
};
const program = ts.createProgram([projectTypesFile, appStateTypesFile, capabilityFile, intentFile, engineFile], compilerOptions);
const checker = program.getTypeChecker();
const projectTypesSource = sourceFile(program, projectTypesFile);
const rows = [];

for (const root of ROOT_TYPES) {
  const declaration = findTypeAlias(program, projectTypesFile, root.alias);
  const type = checker.getTypeAtLocation(declaration);
  rows.push(...flattenType(checker, type, root.prefix, root.alias));
}
rows.push(...EXTRA_PROJECT_FIELDS);

const capabilities = extractCapabilities(sourceFile(program, capabilityFile));
const operationTargets = extractOperationTargets(sourceFile(program, engineFile));
const resolverCapabilities = extractResolverCapabilities(sourceFile(program, intentFile));
const verificationSource = await readFile(verificationFile, "utf8");

const operationPaths = new Map();
for (const capability of capabilities) {
  for (const operation of capability.operationKinds) {
    const targets = operationTargets.get(operation) ?? [];
    const paths = new Set(OPERATION_PATH_OVERRIDES[operation] ?? []);
    for (const target of targets) {
      const mapped = TARGET_TO_MODEL_PATHS[target] ?? [`block.${target}`];
      mapped.forEach((entry) => paths.add(entry));
    }
    operationPaths.set(operation, [...paths]);
  }
}

const editorFiles = (await walkFiles(sourceRoot)).filter((file) => {
  const normalized = normalizePath(file);
  return normalized.includes("/components/activities/") || normalized.includes("/components/lesson-editor/") || file.endsWith(`${path.sep}App.tsx`);
});
const editorSources = await Promise.all(editorFiles.map(async (file) => ({ file, source: await readFile(file, "utf8") })));
const uniqueRows = [...new Map(rows.map((row) => [row.path, row])).values()].sort((left, right) => left.path.localeCompare(right.path, "fr"));

function editorEvidenceFor(propertyPath) {
  const segments = propertyPath.split(".").slice(1).map((segment) => segment.replace(/\[\]$/, ""));
  const leaf = segments.at(-1) ?? "";
  const escapedLeaf = leaf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const leafPattern = new RegExp(`\\b${escapedLeaf}\\b`, "i");
  const anchors = [...new Set(segments.slice(0, -1).filter((segment) => segment.length >= 4 && !/^(settings|appearance|labels|media)$/i.test(segment)))];
  return editorSources.filter(({ file, source }) => {
    if (!leafPattern.test(source)) return false;
    if (!anchors.length) return true;
    const haystack = `${normalizePath(path.relative(repositoryRoot, file))}\n${source}`.toLocaleLowerCase("en-US");
    return anchors.some((anchor) => haystack.includes(anchor.toLocaleLowerCase("en-US")));
  }).map(({ file }) => normalizePath(path.relative(repositoryRoot, file))).slice(0, 3);
}

const decisionsFile = path.join(repositoryRoot, 'tools/arion-registry-editor/data/massifiable-decisions.json');
const savedDecisions = await readFile(decisionsFile, 'utf8').then(value => JSON.parse(value).decisions ?? {}).catch(error => { if (error.code === 'ENOENT') return {}; throw error; });
const matrix = uniqueRows.map((row) => {
  const matchingCapabilities = capabilities.filter((capability) => capability.operationKinds.some((operation) => (operationPaths.get(operation) ?? []).includes(row.path)));
  const matchingOperations = [...new Set(matchingCapabilities.flatMap((capability) => capability.operationKinds.filter((operation) => (operationPaths.get(operation) ?? []).includes(row.path))))];
  const partial = row.path === "block.contentHtml" || row.path.includes(".contentHtml") || row.path.includes("FeedbackHtml");
  const arionAccess = matchingCapabilities.length ? partial ? "partiel" : "oui" : "non";
  const evidence = editorEvidenceFor(row.path);
  const candidate = classifyCandidate(row.path, arionAccess);
  const resolverOk = matchingCapabilities.length > 0 && matchingCapabilities.every((capability) => resolverCapabilities.has(capability.id));
  const testedOperations = matchingOperations.filter((operation) => verificationSource.includes(`"${operation}"`));
  return {
    scope: row.path.startsWith("project.") ? "Leçon" : "Activité",
    family: familyForPath(row.path),
    property: row.path,
    type: row.type,
    editorEvidence: evidence,
    proposal: candidate.proposal,
    arionAccess,
    capabilities: matchingCapabilities.map((capability) => capability.id),
    operations: matchingOperations,
    resolver: matchingCapabilities.length ? resolverOk ? "oui" : "incomplet" : "—",
    tests: matchingOperations.length ? testedOperations.length === matchingOperations.length ? "oui" : "partiel" : "—",
    reason: candidate.reason,
    humanDecision: savedDecisions[row.path]?.decision ?? "",
    notes: savedDecisions[row.path]?.notes ?? ""
  };
});

const proposalOrder = new Map([
  ["couverture partielle", 0],
  ["probablement massifiable", 1],
  ["déjà massifiable", 2],
  ["à arbitrer", 3],
  ["à exclure", 4]
]);
matrix.sort((left, right) =>
  (proposalOrder.get(left.proposal) ?? 9) - (proposalOrder.get(right.proposal) ?? 9)
  || left.family.localeCompare(right.family, "fr")
  || left.property.localeCompare(right.property, "fr")
);

const executableCapabilities = capabilities.filter((capability) => capability.operationKinds.length);
const unmappedOperations = [...new Set(executableCapabilities.flatMap((capability) => capability.operationKinds))].filter((operation) => !(operationPaths.get(operation) ?? []).length);
if (unmappedOperations.length) throw new Error(`Opérations Arion sans propriété auditée : ${unmappedOperations.join(", ")}`);

const summary = {
  generatedFrom: ["PaideiaBlock", "CourseAppearance", "CourseTitleStyle", "CourseCoverStyle", "DesignerCapabilityRegistry", "DesignerActionEngine"],
  properties: matrix.length,
  executableCapabilities: executableCapabilities.length,
  operationKinds: new Set(executableCapabilities.flatMap((capability) => capability.operationKinds)).size,
  accessible: matrix.filter((row) => row.arionAccess === "oui").length,
  partial: matrix.filter((row) => row.arionAccess === "partiel").length,
  probableMissing: matrix.filter((row) => row.proposal === "probablement massifiable" && row.arionAccess === "non").length,
  needsDecision: matrix.filter((row) => row.proposal === "à arbitrer").length,
  excluded: matrix.filter((row) => row.proposal === "à exclure").length
};

const json = { version: 1, summary, rows: matrix };
await mkdir(outputRoot, { recursive: true });
await writeFile(jsonOutput, `${JSON.stringify(json, null, 2)}\n`, "utf8");

const csvHeaders = ["Périmètre", "Famille", "Propriété", "Type", "Présence éditeur", "Proposition automatique", "Accessible dans Arion", "Capacités", "Opérations", "Résolveur", "Tests", "Justification", "Décision métier", "Notes"];
const csvRows = matrix.map((row) => [row.scope, row.family, row.property, row.type, row.editorEvidence.join("\n"), row.proposal, row.arionAccess, row.capabilities.join("\n"), row.operations.join("\n"), row.resolver, row.tests, row.reason, row.humanDecision, row.notes]);

const sheetHeaderStyle = { fontWeight: "bold", color: "#FFFFFF", backgroundColor: "#234A8C", align: "center", verticalAlign: "center", wrap: true };
const statusColor = (value) => value === "oui" || value === "déjà massifiable" ? "#DFF2E4" : value === "partiel" || value === "couverture partielle" ? "#FFF1C7" : value === "probablement massifiable" ? "#FFE2C6" : value === "à arbitrer" ? "#E8EDFA" : "#F1F3F6";
const matrixSheet = [
  csvHeaders.map((header) => spreadsheetCell(header, sheetHeaderStyle)),
  ...matrix.map((row) => [
    spreadsheetCell(row.scope), spreadsheetCell(row.family), spreadsheetCell(row.property), spreadsheetCell(row.type), spreadsheetCell(row.editorEvidence.join("\n"), { wrap: true }),
    spreadsheetCell(row.proposal, { backgroundColor: statusColor(row.proposal) }), spreadsheetCell(row.arionAccess, { backgroundColor: statusColor(row.arionAccess), align: "center" }),
    spreadsheetCell(row.capabilities.join("\n"), { wrap: true }), spreadsheetCell(row.operations.join("\n"), { wrap: true }), spreadsheetCell(row.resolver, { align: "center" }),
    spreadsheetCell(row.tests, { align: "center" }), spreadsheetCell(row.reason, { wrap: true }), spreadsheetCell(row.humanDecision, { backgroundColor: "#FFF8D8" }), spreadsheetCell(row.notes, { backgroundColor: "#FFF8D8" })
  ])
];
const summarySheet = [
  [spreadsheetCell("Audit de couverture massifiable Arion", { fontWeight: "bold", fontSize: 18, color: "#173A75" })],
  [spreadsheetCell("Cette matrice est générée depuis le modèle et les registres exécutables. Les propositions automatiques doivent être validées humainement.", { wrap: true })],
  [],
  [spreadsheetCell("Indicateur", sheetHeaderStyle), spreadsheetCell("Valeur", sheetHeaderStyle)],
  [spreadsheetCell("Propriétés inspectées"), spreadsheetCell(summary.properties)],
  [spreadsheetCell("Capacités Arion exécutables"), spreadsheetCell(summary.executableCapabilities)],
  [spreadsheetCell("Opérations techniques"), spreadsheetCell(summary.operationKinds)],
  [spreadsheetCell("Propriétés techniques distinctes pilotables"), spreadsheetCell(summary.accessible)],
  [spreadsheetCell("Couvertures partielles"), spreadsheetCell(summary.partial)],
  [spreadsheetCell("Propriétés visuelles plausibles encore absentes"), spreadsheetCell(summary.probableMissing)],
  [spreadsheetCell("Propriétés à arbitrer"), spreadsheetCell(summary.needsDecision)],
  [spreadsheetCell("Propriétés automatiquement écartées"), spreadsheetCell(summary.excluded)],
  [],
  [spreadsheetCell("Lecture", { fontWeight: "bold" })],
  [spreadsheetCell("Les propriétés techniques sont dédupliquées : une même propriété peut être pilotée dans de nombreux types d’activités, chapitres et formulations. Oui : raccordement détecté jusqu’à une capacité exécutable. Partiel : transformation ciblée d’un contenu. Non : aucun raccordement détecté. Les colonnes jaunes sont réservées à la validation métier.", { wrap: true })]
];

const priorityRows = matrix.filter((row) => row.proposal === "probablement massifiable" && row.arionAccess === "non");
const prioritySheet = [
  ["Famille", "Propriété", "Type", "Présence éditeur", "Pourquoi", "Décision métier", "Notes"].map((header) => spreadsheetCell(header, sheetHeaderStyle)),
  ...priorityRows.map((row) => [
    spreadsheetCell(row.family), spreadsheetCell(row.property), spreadsheetCell(row.type), spreadsheetCell(row.editorEvidence.join("\n"), { wrap: true }),
    spreadsheetCell(row.reason, { wrap: true }), spreadsheetCell(row.humanDecision, { backgroundColor: "#FFF8D8" }), spreadsheetCell(row.notes, { backgroundColor: "#FFF8D8" })
  ])
];

const workbookSheets = [
  { data: summarySheet, sheet: "Synthèse", columns: [{ width: 42 }, { width: 20 }], showGridLines: false, zoomScale: 0.95 },
  ...(priorityRows.length ? [{ data: prioritySheet, sheet: "Écarts prioritaires", columns: [{ width: 27 }, { width: 46 }, { width: 28 }, { width: 42 }, { width: 48 }, { width: 22 }, { width: 30 }], stickyRowsCount: 1, showGridLines: false, zoomScale: 0.85 }] : []),
  { data: matrixSheet, sheet: "Matrice complète", columns: [{ width: 12 }, { width: 27 }, { width: 42 }, { width: 28 }, { width: 42 }, { width: 25 }, { width: 18 }, { width: 34 }, { width: 34 }, { width: 12 }, { width: 10 }, { width: 46 }, { width: 22 }, { width: 30 }], stickyRowsCount: 1, showGridLines: false, zoomScale: 0.8 }
];
await writeXlsxFile(workbookSheets, { fontFamily: "Arial", fontSize: 10 }).toFile(xlsxOutput);

const probableRows = matrix.filter((row) => row.proposal === "probablement massifiable" && row.arionAccess === "non");
const activeRows = matrix.filter((row) => row.arionAccess === "oui");
const markdown = `# Audit de couverture massifiable d’Arion

Ce document est généré par \`npm run audit:arion-massifiable\`. Il ne déclare pas automatiquement une propriété massifiable : il confronte le modèle éditable aux capacités réellement exécutables et prépare la validation métier.

## Synthèse

| Indicateur | Valeur |
|---|---:|
| Propriétés inspectées | ${summary.properties} |
| Capacités Arion exécutables | ${summary.executableCapabilities} |
| Opérations techniques | ${summary.operationKinds} |
| Propriétés techniques distinctes pilotables | ${summary.accessible} |
| Couvertures partielles | ${summary.partial} |
| Propriétés visuelles plausibles encore absentes | ${summary.probableMissing} |
| Propriétés à arbitrer | ${summary.needsDecision} |
| Propriétés automatiquement écartées | ${summary.excluded} |

## Garanties et limite

- Le nombre de propriétés techniques est dédupliqué. Une seule propriété peut alimenter de nombreux types d’activités, ciblages par chapitre et formulations utilisateur ; ce nombre ne représente donc pas le nombre de commandes comprises par Arion.
- Une capacité déclarée est vérifiée jusqu’à son résolveur et son opération.
- La colonne **Accessible dans Arion** décrit le code actuel, pas une intention produit.
- La proposition **probablement massifiable** est heuristique et doit être validée.
- Les contenus, fichiers, coordonnées et métadonnées techniques sont écartés par défaut.
- Une ligne absente de l’audit signale un défaut du générateur ; elle ne doit pas être ajoutée manuellement au rapport généré.

## Propriétés techniques actuellement pilotables

| Propriété | Capacités | Opérations | Tests |
|---|---|---|---|
${activeRows.map((row) => `| ${markdownCell(row.property)} | ${markdownCell(row.capabilities.join(", "))} | ${markdownCell(row.operations.join(", "))} | ${row.tests} |`).join("\n")}

## Propriétés visuelles plausibles encore absentes

${probableRows.length ? `
| Propriété | Type | Présence observée dans l’éditeur | Décision métier |
|---|---|---|---|
${probableRows.map((row) => `| ${markdownCell(row.property)} | ${markdownCell(row.type)} | ${markdownCell(row.editorEvidence.join(", ") || "non détectée")} | À valider |`).join("\n")}
` : "Aucune. Les arbitrages produit sont terminés : chaque propriété recensée est soit couverte, soit explicitement classée."}

## Matrice de validation

La matrice complète, avec les propriétés à arbitrer et à exclure, se trouve dans [Audit_Couverture_Massifiable_Arion.xlsx](Audit_Couverture_Massifiable_Arion.xlsx). Une version JSON est également produite pour les contrôles automatisés futurs.
`;
await writeFile(markdownOutput, markdown, "utf8");

console.log(`Audit Arion généré : ${summary.executableCapabilities} capacités, ${summary.operationKinds} opérations, ${summary.accessible} propriétés techniques distinctes pilotables, ${summary.probableMissing} propriétés visuelles plausibles encore absentes.`);
console.log(normalizePath(path.relative(repositoryRoot, xlsxOutput)));
