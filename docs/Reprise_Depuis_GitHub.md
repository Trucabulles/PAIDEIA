# Reprendre le développement et les builds de PAIDEIA

Ce guide permet de retrouver un environnement de développement et de construction sur un nouveau PC Windows, à partir du dépôt public des sources. Les données des utilisateurs et la documentation de travail privée se sauvegardent séparément.

## 1. Préparer le poste

PAIDEIA est une application de bureau Tauri 2 avec une interface React/Vite et un cœur Rust. Les scripts de construction fournis ciblent Windows et PowerShell.

Installer les outils suivants, puis ouvrir un nouveau terminal PowerShell pour vérifier qu'ils sont disponibles :

- Git et Git LFS, pour récupérer le dépôt et le runtime WebView2 fixe suivi par LFS ;
- Node.js avec npm (le projet a été construit avec Node.js 24) ;
- Rust via rustup, avec la chaîne `stable-x86_64-pc-windows-msvc` ;
- Visual Studio Build Tools 2022, avec la charge « Développement Desktop en C++ », MSVC et un SDK Windows 10 ou 11.

Prévoir de l'espace disque pour les dépendances npm, la compilation Rust et les installateurs. Les répertoires `node_modules/`, `dist/` et `src-tauri/target/` sont générés localement et ne sont pas à copier d'un ancien PC.

```powershell
git --version
git lfs version
node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
```

## 2. Récupérer les sources

Choisir un dossier de travail dont le chemin est court et sans synchronisation concurrente pendant les builds.

```powershell
git lfs install
git clone https://github.com/Trucabulles/PAIDEIA.git
cd PAIDEIA
git lfs pull
```

Vérifier que `src-tauri/webview2-fixed-runtime/msedgewebview2.exe` est bien un exécutable récupéré, et non un simple pointeur LFS. Le script Tauri et le build portable ont besoin de ce runtime fixe.

```powershell
(Get-Item .\src-tauri\webview2-fixed-runtime\msedgewebview2.exe).Length -gt 1MB
git status --short
```

Le contrôle de taille doit retourner `True` : un pointeur LFS non téléchargé est bien plus petit que l'exécutable. Un clone propre donne un `git status --short` vide.

## 3. Installer et contrôler

Depuis la racine du dépôt :

```powershell
npm ci
.\scripts\bootstrap-dev.cmd -RunChecks
```

`npm ci` installe les versions verrouillées par `package-lock.json`. Le script de contrôle vérifie les outils et les fichiers critiques, construit le frontend, teste le modèle PDF et lance `cargo check`. Sans option, `.\scripts\bootstrap-dev.cmd` se limite au diagnostic ; l'option `-Install` lance `npm install` si une installation guidée est souhaitée.

Les contrôles peuvent aussi se lancer séparément :

```powershell
npm run build
npm run test:pdf-model
Push-Location .\src-tauri
cargo check
Pop-Location
```

Le build frontend prépare le code PDF dans `src-tauri/target/pdf-a4/print.js`, intégré à l’exécutable lors de la compilation Rust, et réutilise les polices déjà intégrées aux ressources de PAIDEIA ; aucun dossier PDF runtime supplémentaire n’est livré. Exécuter `npm run build` avant le premier `cargo check` ou `cargo build` d’un nouveau clone. Node.js sert à la compilation ; aucun `node.exe` n’est livré pour l’export PDF. Le guide utilisateur PDF dans `docs/Guide_Utilisateur/` est une ressource du bundle ; sa source DOCX privée n'est pas requise pour compiler.

## 4. Développer

```powershell
npm run tauri:dev
```

Cette commande démarre Vite sur `http://localhost:1420`, puis l'application Tauri avec le runtime WebView2 fixe du dépôt. Pour travailler seulement sur l'interface dans un navigateur, `npm run dev` lance Vite, mais les fonctions propres à Tauri exigent l'application de bureau.

Les commandes npm disponibles et les vérifications ciblées sont déclarées dans `package.json`. Le code de l'interface est dans `src/`, celui du bureau dans `src-tauri/`, et les scripts de build et de vérification dans `scripts/`.

## 5. Construire une livraison

Pour construire les installateurs Windows :

```powershell
./build-paideia-exe.bat
./build-paideia-msi.bat
```

Les résultats sont placés sous `src-tauri/target/release/bundle/` (notamment `nsis/` ou `msi/`, selon les outils de packaging disponibles). La configuration du bundle se trouve dans `src-tauri/tauri.conf.json`.

Pour construire l'édition portable et son archive :

```powershell
npm run tauri:build:portable
```

Le résultat est placé dans `artifacts/portable/`. Cette commande compile d'abord l'exécutable ; l'option interne `-SkipBuild` du script PowerShell n'est adaptée que si la release et toutes ses ressources ont déjà été produites pour le même état des sources. Le fichier `build-paideia-portable.cmd` à la racine appelle le même script et garde la fenêtre ouverte à la fin.

## 6. Reprendre sur un autre PC

Le dépôt ne contient ni les projets et ressources des utilisateurs, ni les sorties de build, ni `Dev_Documentation/` (documentation de travail privée). Pour migrer ces éléments, conserver une sauvegarde séparée et les restaurer selon leur emplacement d'origine. Le contenu suivi dans `docs/` est la documentation livrée avec les sources ; `docs/README.md` en donne l'index.

Sur le nouveau PC, refaire le clone et l'installation des dépendances, puis lancer les contrôles avant de restaurer des données personnelles ou de produire une livraison. Vérifier enfin `git status --short` et la version du projet dans `package.json` et `src-tauri/Cargo.toml`.

## Dépannage rapide

- Si `npm ci` échoue, contrôler Node/npm, la connexion au registre npm et `package-lock.json` ; relancer dans un terminal neuf après installation de Node.
- Si `cargo check` échoue sur MSVC ou le SDK, vérifier les composants Visual Studio Build Tools et la chaîne Rust MSVC.
- Si le script Tauri ne trouve pas WebView2, vérifier Git LFS et relancer `git lfs pull` ; ne pas supprimer `src-tauri/webview2-fixed-runtime/`.
- Si le développement ne démarre pas, vérifier que le port `1420` est libre et que `npm ci` a réussi.
- Après le déplacement manuel d'un ancien dossier de compilation Rust, des chemins absolus périmés peuvent subsister dans `src-tauri/target/` : reconstruire dans le nouveau clone plutôt que réutiliser ce dossier.
- Si le bundle échoue sur une ressource, vérifier les chemins dans `src-tauri/tauri.conf.json`, notamment le guide PDF.
