<!-- arion:meta {"title":"Imports et exports PAIDEIA","aliases":["export SCORM","archive PAIDEIA","import .paideia","import SCORM Rise","export PDF","support apprenant PDF","PDF apprenant","PDF de relecture"],"sections":{"Imports et exports":{"aliases":[],"keywords":[]},"Exporter en SCORM":{"aliases":[],"keywords":[]},"Exporter une archive PAIDEIA":{"aliases":[],"keywords":[]},"Importer une archive `.paideia`":{"aliases":[],"keywords":[]},"Importer un SCORM Rise":{"aliases":[],"keywords":[]},"Importer un SCORM PAIDEIA":{"aliases":[],"keywords":[]},"Limites et bonnes pratiques":{"aliases":[],"keywords":[]},"Générer un PDF":{"aliases":[],"keywords":["relecture","apprenant","notes","renvois","glossaire","balises"]}}} -->

# Imports et exports

PAIDEIA distingue le projet de travail local, l’archive d’échange PAIDEIA, le paquet SCORM destiné à un LMS et les PDF de relecture ou de support apprenant.

## Exporter en SCORM

Depuis le menu d’une tuile, choisir **Exporter SCORM 1.2**. Une collection peut également être exportée en un seul paquet. Le fichier produit est destiné à être chargé dans un LMS ; tester le paquet dans l’environnement LMS prévu, notamment la navigation, les quiz, les médias et la reprise de progression.

## Exporter une archive PAIDEIA

**Exporter PAIDEIA** crée un fichier `.paideia` contenant le projet et ses éléments nécessaires à un échange ou à une sauvegarde. Ce fichier n’est pas le dossier de travail lui-même. Le nom proposé reprend celui de la leçon suivi de la date et de l’heure (`nom-lecon_aaaammjj_hhmmss.paideia`) afin de limiter les écrasements accidentels. Une archive contient un contrôle d’intégrité ; conserver le fichier complet et ne pas le modifier manuellement.

À l’export d’une leçon, choisissez **Inclure les banques** pour joindre les banques complètes de questions, de balises et renvois et de glossaire associées à la leçon, avec leurs images. **Leçon seule** produit une archive sans cet ajout.

## Importer une archive `.paideia`

Dans le menu sandwich, choisir **Importer une leçon PAIDEIA**, puis sélectionner le fichier `.paideia`. PAIDEIA vérifie l’archive avant de la restaurer. Une archive sans manifeste d’intégrité, incomplète ou invalide est refusée explicitement ; elle n’est pas interprétée comme un paquet Rise.

Un double-clic sur le fichier dans l’Explorateur lance l’import. Si PAIDEIA est déjà ouvert, l’import se fait dans cette instance. Si l’archive contient des banques, PAIDEIA propose de les ajouter à vos Ressources. Une banque identique déjà présente est ignorée ; une version différente est ajoutée sans écraser l’existante.

## Importer un SCORM Rise

Choisir **Importer un SCORM** et sélectionner le paquet `.zip` exporté depuis Rise. PAIDEIA analyse le paquet, remappe les activités reconnues et produit un journal d’importation avec les décisions et les éléments à vérifier.

Lorsque le paquet contient une banque de questions reconnue, PAIDEIA crée
aussi cette banque dans **Ressources**. Les questions QCM, QCU et vrai/faux
isolées restent des activités autonomes ; elles ne sont pas réunies
automatiquement dans un Quiz. Vérifiez les questions, leurs réponses et
feedbacks ainsi que la banque créée après l’import.

L’import n’est pas une compatibilité universelle ni une garantie de rendu pixel par pixel. Les activités propriétaires, certains styles, médias ou interactions peuvent être convertis, simplifiés ou nécessiter une reprise manuelle. Relire la leçon importée et vérifier l’aperçu LMS avant publication.

## Importer un SCORM PAIDEIA

Un paquet SCORM PAIDEIA contenant les données natives de PAIDEIA peut être reconnu comme un paquet de reprise et restauré avec ses éléments natifs. Cette détection est prioritaire. Si les données natives sont absentes ou invalides, le paquet n’est pas silencieusement traité comme un import Rise.

## Exporter en PDF

Depuis le menu d’une tuile de leçon, choisir **Générer PDF**, puis **Relecture** ou **Apprenant** dans la fenêtre de choix. Le PDF de relecture conserve les repères utiles au contrôle : activités numérotées, noms et identifiants techniques, évaluations et contenus interactifs développés.

Le support apprenant porte la date de génération et une mention rappelant que les informations sont valables à cette date. Il conserve les chapitres et leurs contenus de lecture, sans évaluations, boutons de navigation, noms ou identifiants techniques des activités. Les activités de lecture comme les points d’intérêt, les cartes à retourner, les accordéons et les onglets restent présentées sur les pages A4. Pour une vidéo sous-titrée ou un audio transcrit, seul le texte disponible figure dans ce support. Les renvois vers des définitions mènent à des notes numérotées à la fin du document ; plusieurs occurrences d’un même renvoi partagent une note.

Les glossaires et les banques **Balises & renvois** disposent séparément de la commande **Générer un PDF** dans leur menu de ressource. Leur PDF peut être ajouté à la leçon comme fichier téléchargeable si nécessaire.

Le PDF est un livrable de lecture et de contrôle, pas une copie éditable du projet. Vérifier les pages, les tableaux, les images et les activités interactives après génération.

## Limites et bonnes pratiques

Conserver le projet original avant import ou conversion, lire le rapport d’importation, puis tester l’ensemble du parcours dans l’aperçu LMS. Pour une sauvegarde fidèle du projet PAIDEIA, privilégier l’archive `.paideia` plutôt qu’un export SCORM ou PDF.
