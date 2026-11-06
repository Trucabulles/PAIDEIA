<!-- arion:meta {"sections":{"Vidéo":{"aliases":[],"keywords":[]},"Fond de l'activité":{"aliases":[],"keywords":[]},"Contrat des sous-titres":{"aliases":[],"keywords":[]},"Éditeur de sous-titres":{"aliases":[],"keywords":[]},"Génération locale facultative des sous-titres":{"aliases":[],"keywords":[]},"Import des vidéos":{"aliases":[],"keywords":[]},"Rendu et proportions":{"aliases":[],"keywords":[]},"Éditeur d'activité":{"aliases":[],"keywords":[]},"Optimisation facultative":{"aliases":[],"keywords":[]},"Affichage des sous-titres":{"aliases":[],"keywords":[]}}} -->

# Vidéo

L’activité **Vidéo** permet d’intégrer une vidéo dans une leçon, d’y associer une vignette et des sous-titres, puis d’en personnaliser l’apparence.

Un texte peut également être ajouté sous la vidéo.

## Fond de l'activité

L’onglet `Apparence` permet de personnaliser le fond de l’activité :

- couleur de fond ;
- image de fond ;
- voile ;
- flou ;
- fond large ;
- coins arrondis ;
- hauteur du fond.

Lorsqu’une image de fond est ajoutée pour la première fois, le mode `Fond large` est activé par défaut et aucun voile n’est appliqué. Les réglages effectués ensuite sont conservés si l’image est remplacée.

Le même rendu est utilisé dans l’éditeur, l’aperçu LMS et le module SCORM.

Le fond de l’activité n’est pas repris dans le PDF de relecture.

## Affichage des sous-titres

Les sous-titres sont affichés dans un cartouche commun, centré sous la vidéo.

Leur taille et leur position sont adaptées automatiquement à la taille réelle de la vidéo et au mode d’affichage. Il n’est donc pas nécessaire de régler manuellement leur taille ou leur position.

Lorsque les contrôles du lecteur apparaissent, les sous-titres se déplacent automatiquement afin de rester lisibles.

L’activité permet de régler :

- la couleur du texte ;
- l’affichage ou non d’un fond de sous-titre ;
- le contour de la police : `Aucun`, `Fin` ou `Épais`.

Le fond de sous-titre est activé par défaut. Le contour est désactivé par défaut.

La couleur du contour est choisie automatiquement afin de conserver un contraste suffisant avec le texte.

Le rendu des sous-titres est identique dans l’éditeur, l’aperçu LMS, le SCORM et en plein écran.

## Éditeur de sous-titres

Lorsqu’une piste de sous-titres est associée à la vidéo, le bouton `Éditer les sous-titres` permet de la modifier directement dans PAIDEIA.

Chaque segment affiche :

- son heure de début ;
- son heure de fin ;
- son texte ;
- une commande `Lire` pour vérifier immédiatement le passage concerné.

Le début, la fin et le texte d’un segment peuvent être modifiés.

Les horaires invalides empêchent l’enregistrement. Les chevauchements entre deux sous-titres sont signalés, mais restent autorisés lorsqu’ils sont volontaires.

`Annuler` ferme l’éditeur sans enregistrer les modifications.

`Restaurer la version chargée` permet de revenir à la piste de sous-titres initialement importée dans le projet.

Seul le bouton `Enregistrer` crée une nouvelle version des sous-titres utilisés par l’activité.

Le fichier original choisi sur l’ordinateur n’est jamais modifié.

## Génération locale facultative des sous-titres

Si une vidéo est chargée et qu’aucune piste de sous-titres n’est encore associée, PAIDEIA peut proposer `Générer les sous-titres` lorsque le module de transcription locale est configuré.

La configuration s’effectue dans :

`Modules complémentaires > Transcription locale Whisper`

La transcription s’effectue entièrement sur l’ordinateur, sans envoi de la vidéo ou de l’audio vers un service en ligne.

Le concepteur peut choisir :

- la langue parlée ;
- la détection automatique de la langue ;
- l’un des modèles de transcription installés.

Pendant la transcription, PAIDEIA affiche l’étape en cours, le temps écoulé et une commande d’annulation.

Le résultat est ouvert comme brouillon dans l’éditeur de sous-titres. Il n’est ajouté à l’activité qu’après validation avec `Enregistrer`.

Si des sous-titres existent déjà, l’action principale reste `Éditer les sous-titres`.

## Import des vidéos

Une vidéo est ajoutée à partir du sélecteur de fichiers de l’application.

PAIDEIA travaille sur une copie intégrée au projet : le fichier original conservé sur l’ordinateur n’est jamais modifié.

L’import accepte également les vidéos très volumineuses, y compris les sources 4K ou 8K.

Si une copie est interrompue, elle n’est pas enregistrée comme vidéo active.

## Rendu et proportions

PAIDEIA respecte automatiquement les proportions de la vidéo.

Une vidéo n’est ni étirée ni rognée pour être forcée dans un format prédéfini.

En affichage normal, le lecteur s’adapte au format réel du média.

En plein écran, des bandes noires peuvent apparaître lorsque le format de l’écran est différent de celui de la vidéo. Cela est normal et ne modifie pas les proportions du média.

Le comportement est identique dans l’éditeur de leçon, l’aperçu LMS et le SCORM.

## Éditeur d'activité

Dans l’éditeur, l’aperçu de la vidéo reste visible à gauche pendant que les réglages sont accessibles dans la colonne de droite.

Lorsqu’une vidéo est déjà chargée :

- son nom est affiché ;
- une commande permet de la supprimer ;
- les noms trop longs sont raccourcis visuellement, mais leur nom complet reste disponible au survol.

Lorsqu’une piste de sous-titres est chargée :

- `Éditer les sous-titres` remplace la commande de sélection ;
- une commande permet de supprimer la piste.

Dans `Apparence des sous-titres`, les réglages de couleur, de contour et de fond sont regroupés sur une même ligne.

La taille et la position des sous-titres sont gérées automatiquement et ne sont pas proposées comme réglages.

Les zones de texte de l’éditeur de sous-titres utilisent la correction orthographique disponible selon la langue de transcription ou, à défaut, la langue de l’application.

Supprimer une vidéo ou une piste de sous-titres de l’activité ne modifie jamais le fichier original conservé sur l’ordinateur.

## Optimisation facultative

Le bouton `Optimiser la vidéo` est disponible lorsque les outils vidéo nécessaires ont été configurés dans :

`Modules complémentaires > Outils vidéo FFmpeg`

L’optimisation permet de réduire le poids d’une vidéo tout en conservant ses proportions.

Plusieurs profils sont proposés, ainsi qu’un mode personnalisé.

Après traitement, PAIDEIA présente un bilan comprenant notamment :

- le poids du fichier ;
- le gain obtenu ;
- le format ;
- le codec ;
- les dimensions ;
- la fréquence d’images ;
- le débit audio.

Deux choix sont alors possibles :

- `Utiliser le fichier original` : la version optimisée est abandonnée ;
- `Utiliser la version optimisée` : la nouvelle version devient la vidéo utilisée par l’activité.

L’original reste disponible afin de pouvoir être restauré ultérieurement.

Seule la vidéo actuellement utilisée par l’activité est incluse dans le SCORM.

Lorsque PAIDEIA détecte qu’une vidéo gagnerait à être allégée, un message `Optimiser` peut être affiché en rouge.
