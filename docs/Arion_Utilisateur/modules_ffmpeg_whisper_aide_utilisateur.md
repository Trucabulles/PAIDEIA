<!-- arion:meta {"title":"Installer et configurer FFmpeg et Whisper","aliases":["installer Whisper","installer FFmpeg","où télécharger FFmpeg","où télécharger Whisper","modules complémentaires","outils vidéo","transcription locale"],"sections":{"Installer et configurer FFmpeg et Whisper":{"aliases":["configurer les modules complémentaires"],"keywords":["installation","Windows","local"]},"Installer et configurer FFmpeg":{"aliases":["FFmpeg non configuré","installation FFmpeg incomplète","ffmpeg.exe","ffprobe.exe"],"keywords":["télécharger","archive","bin","libx264","optimisation vidéo"]},"Installer le moteur Whisper":{"aliases":["moteur Whisper","whisper-cli.exe","paquet Whisper"],"keywords":["whisper.cpp","zip","DLL","CPU x64"]},"Installer un modèle Whisper":{"aliases":["modèle ggml","ggml-small.bin","ggml-medium.bin","modèle Small","modèle Medium"],"keywords":["Hugging Face","multilingue","transcription"]},"Terminer la configuration dans PAIDEIA":{"aliases":["transcription non configurée","Whisper non configuré","module non configuré"],"keywords":["Parcourir","Prêt","vérification"]},"En cas de problème":{"aliases":["module incompatible","erreur FFmpeg","erreur Whisper"],"keywords":["diagnostic","chemin","DLL","modèle"]}}} -->

# Installer et configurer FFmpeg et Whisper

PAIDEIA utilise deux composants facultatifs installés sur l’ordinateur :

- **FFmpeg** traite et optimise les vidéos et extrait l’audio nécessaire aux transcriptions ;
- **Whisper** produit localement un brouillon de transcription.

PAIDEIA ne télécharge ni ces programmes ni les modèles et ne les envoie pas dans une leçon ou un SCORM. Leur installation et leur configuration restent propres à l’ordinateur.

## Installer et configurer FFmpeg

La branche recommandée par PAIDEIA est **FFmpeg 8.1.x** ; la version **8.1.2** a été validée. La [page de téléchargement de FFmpeg](https://ffmpeg.org/download.html) renvoie vers des compilations Windows prêtes à l’emploi. Choisissez une archive Windows 64 bits contenant au minimum `ffmpeg.exe`, `ffprobe.exe` et l’encodeur `libx264`.

1. téléchargez l’archive depuis l’un des fournisseurs Windows référencés par FFmpeg ;
2. décompressez-la entièrement dans un dossier durable, par exemple `C:\ffmpeg` ;
3. vérifiez que `ffmpeg.exe` et `ffprobe.exe` se trouvent ensemble dans le sous-dossier `bin` ;
4. dans PAIDEIA, ouvrez **Modules complémentaires > Outils vidéo FFmpeg** ;
5. cliquez sur **Parcourir** et sélectionnez `ffmpeg.exe`.

PAIDEIA recherche et vérifie automatiquement `ffprobe.exe` dans le même dossier. Le module affiche **Prêt** lorsque les deux exécutables et les capacités nécessaires à l’optimisation sont valides.

Ne déplacez pas le dossier après sa sélection. Le bouton **Supprimer FFMPEG** efface uniquement la configuration de PAIDEIA ; il ne supprime pas les fichiers installés sur l’ordinateur.

## Installer le moteur Whisper

La version de référence validée par PAIDEIA est **whisper.cpp 1.9.1 pour Windows x64**.

1. téléchargez [`whisper-bin-x64.zip` depuis la version whisper.cpp 1.9.1](https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-x64.zip) ;
2. décompressez entièrement l’archive dans un dossier durable ;
3. conservez `whisper-cli.exe` avec toutes les DLL fournies dans l’archive ;
4. ne copiez pas `whisper-cli.exe` seul dans un autre dossier.

Dans PAIDEIA, le bouton **Parcourir** du **Moteur Whisper** demande le dossier décompressé. PAIDEIA recherche `whisper-cli.exe` à la racine, dans `Release` ou dans `bin`.

## Installer un modèle Whisper

Le moteur ne suffit pas : au moins un modèle multilingue `.bin` est nécessaire.

- [`ggml-small.bin`](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin?download=true), environ 488 Mo : choix conseillé pour commencer et pour les postes modestes ;
- [`ggml-medium.bin`](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin?download=true), environ 1,53 Go : plus exigeant en mémoire et en temps de calcul.

Les modèles dont le nom se termine par `.en` sont réservés à l’anglais. Pour les contenus français ou multilingues, utilisez les fichiers sans suffixe `.en`. Les autres modèles convertis sont consultables dans le [dépôt officiel des modèles whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp/tree/main).

## Terminer la configuration dans PAIDEIA

Ouvrez **Modules complémentaires > Transcription locale Whisper**, puis :

1. sélectionnez le dossier du moteur avec **Moteur Whisper > Parcourir** ;
2. sélectionnez `ggml-small.bin` avec **Modèle Small > Parcourir** ;
3. sélectionnez éventuellement `ggml-medium.bin` avec **Modèle Medium > Parcourir** ;
4. vérifiez que chaque composant sélectionné porte une coche verte ;
5. vérifiez que l’état général indique **Prêt**.

FFmpeg doit également être configuré pour extraire la piste audio des vidéos. Un moteur Whisper valide sans modèle, ou un modèle valide sans moteur, laisse donc la configuration incomplète.

Le bouton **Supprimer Whisper** retire les chemins enregistrés dans PAIDEIA sans supprimer le moteur ni les modèles présents sur le disque.

## En cas de problème

- **Installation FFmpeg incomplète** : vérifiez que `ffprobe.exe` est placé à côté de `ffmpeg.exe`.
- **FFmpeg incompatible** : utilisez une compilation Windows 64 bits récente comprenant `libx264`.
- **Moteur Whisper invalide** : sélectionnez le dossier complet décompressé et vérifiez la présence des DLL.
- **Modèle refusé** : sélectionnez directement le fichier `.bin` correspondant à Small ou Medium et vérifiez que son téléchargement est terminé.
- **Transcription non configurée** : contrôlez successivement FFmpeg, le moteur Whisper et au moins un modèle.
- **Chemin devenu invalide** : replacez les fichiers à leur emplacement précédent ou sélectionnez leur nouvel emplacement avec **Parcourir**.

Tous les traitements restent locaux. PAIDEIA ne transmet ni la vidéo, ni l’audio, ni la transcription à un service en ligne.
