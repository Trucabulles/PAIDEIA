# Flux de données

## Ouverture et sauvegarde

```mermaid
sequenceDiagram
  participant U as Auteur
  participant A as React
  participant T as Tauri
  participant R as Repository
  U->>A: Ouvrir une leçon
  A->>T: load_workspace_state(path)
  T->>R: Lire project.json + audit récent + snapshots
  R-->>T: PaideiaWorkspaceState
  T-->>A: état sérialisé
  A-->>U: éditeur chargé
  U->>A: Enregistrer une activité
  A->>T: update_block(...)
  T->>R: snapshot préalable si requis
  T->>R: écriture atomique + append audit
  T->>T: supprimer les assets devenus orphelins
  R-->>A: nouvel état
```

## Asset média

```mermaid
flowchart LR
  FILE[Fichier choisi] --> CMD[Commande upload]
  CMD --> COPY[Copie dans le dossier projet]
  COPY --> REF[Référence relative dans le modèle]
  REF --> URL[convertFileSrc dans React]
  REF --> SCORM[Copie vers le package SCORM]
  REF --> PRUNE[Nettoyage après mutation confirmée]
  PRUNE --> KEEP[Conserver toute référence encore partagée]
```

## Copier-coller d'un chapitre

```mermaid
sequenceDiagram
  participant U as Auteur
  participant R as React
  participant T as Tauri
  participant F as Système de fichiers
  U->>R: Clic droit sur l'icône de duplication
  R->>R: Mémoriser une copie du chapitre
  U->>R: Coller ici dans une leçon modifiable
  R->>T: inspect_chapter_asset_duplicates
  T-->>R: Doublons binaires éventuels
  R->>U: Choix média par média
  R->>T: paste_chapter
  T->>T: Régénérer et contrôler les identifiants
  T->>F: Réutiliser ou copier les médias
  T->>F: Persister le chapitre complet
  T-->>R: Nouvel état du projet
  R->>R: Consommer le tampon
```

## Annotation

```mermaid
flowchart TD
  SRC[Image source] --> TOOL[Outil annotation]
  STATE[JSON WIP] --> TOOL
  TOOL --> FLAT[Image aplatie]
  TOOL --> STATE
  FLAT --> BLOCK[Référence normale de l'activité]
  BLOCK --> PREVIEW[Aperçu LMS]
  BLOCK --> EXPORT[SCORM]
```

## Export SCORM

```mermaid
sequenceDiagram
  participant A as React
  participant T as Rust
  participant F as Filesystem
  A->>A: afficher la modale de progression
  A->>T: export_scorm_12_to(project, destination)
  T->>F: lire modèle et assets
  T->>T: générer manifeste, HTML, CSS et JS
  T->>T: embarquer snapshot PAIDEIA
  T->>F: écrire le ZIP
  T-->>A: chemin du package
```

### Styles et scripts propres à l’export

Dans [`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs), `write_scorm_archive` assemble le ZIP. Rust génère le HTML et y fournit les données, les classes, les attributs et les variables CSS. Les fichiers ci-dessous séparent les règles de présentation et les interactions du code Rust. `include_str!` en lit le contenu à la compilation de PAIDEIA.

| Fichier source actuel | Intégration par l’exporteur | Contrat avec le HTML généré |
| --- | --- | --- |
| [`scorm_situational_dialogue.css`](../../src-tauri/src/scorm_situational_dialogue.css) | `build_scorm_index` l’insère dans un bloc `<style>` d’`index.html`, avec [`dialogueBanner.css`](../../src/components/activities/SituationalDialogueActivity/dialogueBanner.css), partagé avec l’interface. | Les styles ciblent notamment `.block.situational-dialogue` et utilisent des variables comme `--dialogue-action-bg` et `--situational-dialogue-radius`. |
| [`scorm_rich_references.js`](../../src-tauri/src/scorm_rich_references.js) | `build_scorm_index` intègre le script dans `index.html`. `build_scorm_runtime` l’intègre également dans `js/runtime.js` à partir de la balise de substitution `__PAIDEIA_RICH_REFERENCES__`. Les styles de défilement viennent de [`referenceScroll.css`](../../src/components/rich-text-toolbar/referenceScroll.css). | `setupRichReferences` lit les déclencheurs `data-paideia-reference-id`, les définitions et les cibles de renvoi (`data-paideia-reference-definition`, `data-paideia-bookmark-target` et `data-paideia-bookmark-id`). |

Une modification purement visuelle du SCORM se fait dans le CSS concerné. Une modification de l’ouverture, de la fermeture ou du défilement des fenêtres de renvoi se fait dans le JS et les styles concernés. Si une classe, une variable ou un attribut change, vérifier aussi le HTML produit par Rust. L’éditeur et l’aperçu LMS ont leurs propres styles et partagent certains fichiers avec l’export.

Lors d’un prochain changement sur ces fichiers, les regrouper dans `src-tauri/src/scorm/` et actualiser les trois chemins `include_str!` dans `commands.rs`. Après un déplacement ou une modification, générer et ouvrir un ZIP SCORM. Vérifier le rendu des trois modèles de « Mise en situation » aux largeurs prévues et tester les renvois (ouverture, fermeture et défilement d’un contenu long). Pour un style partagé, vérifier aussi l’aperçu LMS.

## Export PDF A4

La commande `generate_pdf_a4` lit la leçon ou extrait son archive dans un dossier temporaire. Elle lance le même exécutable PAIDEIA en mode `--pdf-a4-native`, sans démarrer l’éditeur. Rust lit les ressources du projet, la WebView invisible prépare le modèle et les médias, puis le WebView2 fixe imprime le HTML. Le pilotage utilise l’API native du moteur, sans port de débogage. La capture d’une activité HTML peut employer un serveur de fichiers temporaire limité à `127.0.0.1` et au paquet concerné.

Le PDF est écrit atomiquement à la destination choisie ; les fichiers temporaires sont supprimés ensuite. Le projet, ses journaux et ses observations ne sont pas modifiés. Node.js reste nécessaire à la compilation sur le poste de développement et n’est pas livré avec le générateur PDF.

## Import SCORM

```mermaid
flowchart TD
  ZIP[ZIP sélectionné] --> DETECT[Détection signature]
  DETECT -->|PAIDEIA| NATIVE[Validation snapshot natif]
  DETECT -->|Format tiers reconnu| PARSE[Analyse et rematching]
  NATIVE --> PROJECT[Dossier projet]
  PARSE --> REPORT[Rapports d'import]
  REPORT --> PROJECT
  DETECT -->|Erreur| ERROR[Erreur explicite + journal dev]
```
