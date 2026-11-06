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
