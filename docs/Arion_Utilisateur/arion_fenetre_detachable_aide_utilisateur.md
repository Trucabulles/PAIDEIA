# Détacher Arion dans une fenêtre séparée

Statut : `Implémenté et validé sur écran unique — test bi-écran / DPI à réaliser`.

Arion peut être placé dans une fenêtre Windows séparée, notamment sur un second écran. La conversation, la question en cours et une éventuelle prévisualisation sont conservées : il s'agit de la même session Arion, présentée sur une seule surface à la fois.

Le déplacement et le redimensionnement de cette fenêtre, les changements de contexte et les actions Arion ont été validés sur une configuration mono-écran. Le comportement entre deux écrans utilisant éventuellement des facteurs d'échelle DPI différents reste à tester.

Lorsque la fenêtre détachée est agrandie sur une grande surface, la typographie augmente progressivement et de façon plafonnée pour améliorer la lecture. Cette adaptation concerne uniquement Arion détaché ; elle ne modifie ni le panneau ancré ni l'échelle générale de PAIDEIA.

## Détacher Arion

Écrire dans la conversation l'une des commandes suivantes :

- `Détache-toi` ;
- `Détacher Arion` ;
- `Ouvre Arion dans une fenêtre séparée` ;
- `Mets Arion sur le second écran`.

Les alias courts `undock`, `undock arion` et `/undock` sont également reconnus.

Un clic droit sur la trombine d'Arion dans PAIDEIA détache aussi directement la fenêtre, sans ouvrir de menu. Toutes les commandes écrites restent disponibles.

PAIDEIA conserve le panneau ancré tant que la nouvelle fenêtre n'a pas confirmé son initialisation. Si elle ne répond pas dans les cinq secondes, elle est fermée et un message explique l'échec dans Arion.

## Réintégrer Arion

Dans la fenêtre détachée, écrire l'une des commandes suivantes :

- `Réintègre-toi` ;
- `Reviens dans PAIDEIA` ;
- `Ancrer Arion`.

Les alias `dock`, `dock arion` et `/dock` sont également reconnus. Fermer la fenêtre Arion avec sa croix réintègre aussi le panneau dans PAIDEIA.

Lorsque la fenêtre est détachée, la trombine reste accessible dans PAIDEIA : un clic gauche ramène Arion au premier plan et un clic droit le réintègre directement, sans menu intermédiaire.

La fenêtre détachée possède les trois commandes de fenêtre habituelles : **Réduire**, **Agrandir/Restaurer** et **Fermer**. Agrandir occupe la zone de travail de l'écran tout en laissant la barre des tâches disponible ; Restaurer revient aux dimensions précédentes. Un double-clic dans une zone libre de l'en-tête produit la même bascule. Fermer réintègre Arion dans PAIDEIA au lieu de quitter l'application. Si Arion est réduit, un clic gauche sur sa trombine dans PAIDEIA le restaure et le ramène au premier plan.

Fermer la fenêtre principale de PAIDEIA ferme également la fenêtre Arion détachée et quitte complètement le programme. Fermer seulement la fenêtre Arion ne quitte pas PAIDEIA.

## Sélection d'un fichier

Une fenêtre WebView ne transmet pas directement un fichier à l'autre. Si une action Arion demande de sélectionner une image, Arion est automatiquement réintégré dans PAIDEIA avant l'ouverture du sélecteur. La demande en cours est conservée.

## Garanties

- une seule fenêtre Arion peut exister ; une nouvelle demande de détachement ramène la fenêtre existante au premier plan ;
- la fenêtre principale reste seule autorisée à appliquer une modification au projet ;
- un changement de leçon ou de droit d'écriture invalide les intentions devenues périmées ;
- Arion reste absent de l'aperçu LMS, du SCORM et des exports PDF.
