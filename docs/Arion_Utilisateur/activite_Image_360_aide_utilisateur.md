<!-- arion:meta {"sections":{"Image 360":{"aliases":["360","image panoramique","panorama","vue 360"],"keywords":["immersive","panoramique","équirectangulaire"]},"Ajouter une image 360":{"aliases":["importer une image 360","choisir une image 360"],"keywords":["image","fichier","JPG","PNG","WebP"]},"Régler la vue de départ":{"aliases":["orientation initiale","point de départ","vue initiale"],"keywords":["orientation","horizontal","vertical"]},"Points interactifs":{"aliases":["hotspots","repères","points cliquables"],"keywords":["point","repère","titre","contenu"]},"Utilisation par l’apprenant":{"aliases":["naviguer dans une image 360","explorer le panorama"],"keywords":["déplacer","cliquer","zoom","plein écran"]},"Activité Image 360":{"aliases":[],"keywords":[]},"Autoriser le zoom":{"aliases":[],"keywords":[]},"Ajouter des points interactifs":{"aliases":[],"keywords":[]},"Plein écran":{"aliases":[],"keywords":[]},"Apparence de l’activité":{"aliases":[],"keywords":[]},"Accessibilité et contenu":{"aliases":[],"keywords":[]},"Export et relecture":{"aliases":[],"keywords":[]},"En cas de problème":{"aliases":[],"keywords":[]}}} -->

# Activité Image 360

L’activité **Image 360** permet de présenter une vue panoramique immersive.
L’apprenant peut explorer l’image en déplaçant son point de vue et consulter,
si vous en ajoutez, des points interactifs contenant un titre et un contenu.

## Ajouter une image 360

Dans l’éditeur de l’activité, cliquez sur `Sélectionner une image 360`, puis
choisissez l’image panoramique à intégrer.

Une image équirectangulaire au format **2:1** est recommandée : sa largeur est
environ deux fois supérieure à sa hauteur. Les formats JPG/JPEG, WebP et PNG
sont acceptés. Si les proportions sont très éloignées du format 2:1, PAIDEIA
affiche un avertissement ; l’image peut toutefois rester utilisable.

L’image est copiée dans le projet PAIDEIA. Le fichier original présent sur
l’ordinateur n’est pas modifié.

Pour remplacer l’image, sélectionnez simplement un nouveau fichier. Pour
retirer l’image, utilisez `Supprimer`.

## Régler la vue de départ

La vue de départ correspond à l’orientation affichée lorsque l’activité est
ouverte.

1. Orientez l’image dans l’aperçu en faisant glisser la souris.
2. Cliquez sur `Définir la vue actuelle`.

Vous pouvez aussi régler directement les coordonnées :

- `Horizontal` ou coordonnées horizontales de départ : direction autour de
  l’image ;
- `Vertical` ou coordonnées verticales de départ : inclinaison vers le haut ou
  vers le bas.

La vue choisie est utilisée dans l’éditeur, l’aperçu LMS et le module SCORM.

## Autoriser le zoom

Activez `Autoriser le zoom` pour permettre à l’apprenant de modifier le niveau
de rapprochement avec la molette de la souris ou le geste équivalent sur son
appareil.

Le zoom est désactivé lorsqu’il n’est pas nécessaire à l’activité. La vue reste
alors navigable sans changement de niveau de rapprochement.

## Ajouter des points interactifs

Les points interactifs permettent d’attacher une information à un endroit
précis du panorama.

1. Cliquez sur `Ajouter un point`.
2. Faites un clic droit dans l’aperçu à l’endroit souhaité.
3. Saisissez le `Titre du point`.
4. Saisissez son `Contenu`.

Le point est placé selon l’orientation choisie dans l’image. Vous pouvez
affiner sa position avec les coordonnées `Horizontal` et `Vertical`.

Les points existants apparaissent dans la liste située sous l’aperçu. Cliquez
sur un point pour le sélectionner et modifier son contenu. Utilisez
`Supprimer le point` pour le retirer.

Le titre et le contenu acceptent le texte riche disponible dans PAIDEIA. Le
contenu peut donc comporter une mise en forme, des listes ou des liens selon
les outils proposés par l’éditeur.

## Utilisation par l’apprenant

Dans le rendu final :

- faites glisser l’image pour regarder autour de vous ;
- cliquez sur un repère pour ouvrir son panneau d’information ;
- cliquez à nouveau sur le repère ou dans la scène pour fermer le panneau ;
- utilisez le bouton de plein écran lorsque cette option est autorisée.

Les repères visibles sont numérotés afin de pouvoir être retrouvés facilement.
Le panneau ouvert affiche le titre et le contenu du point sélectionné.

## Plein écran

Lorsque le plein écran est disponible dans le rendu, son bouton agrandit la
scène sans modifier l’image, la vue de départ ni les points interactifs.

Le plein écran dépend également des droits du navigateur ou de la plateforme
LMS. Si le navigateur refuse cette fonction, l’activité reste consultable dans
son affichage normal.

## Apparence de l’activité

Les réglages de l’onglet `Activité` concernent le contenu 360 : image, vue,
zoom, plein écran et points interactifs.

Les réglages de l’onglet `Apparence` concernent le cadre extérieur de
l’activité, notamment son fond, sa bordure, ses coins et son ombre. Ils ne
modifient pas la scène panoramique ni le fonctionnement des points
interactifs.

## Accessibilité et contenu

Ajoutez une description utile de l’image lorsqu’elle apporte une information
nécessaire à la compréhension de la leçon. Les titres des points doivent être
courts et explicites ; leur contenu doit préciser l’information que l’apprenant
doit découvrir à cet endroit.

Une image 360 très détaillée ou très lourde peut ralentir son chargement.
Préférez une image suffisamment nette pour l’exploration, mais optimisée pour
le poids lorsque cela est possible.

## Export et relecture

L’activité conserve son exploration panoramique dans l’aperçu LMS et dans le
SCORM.

Dans le PDF de relecture, la scène est représentée par une vue panoramique à
plat avec les points numérotés. Les titres et contenus des points sont ensuite
repris dans l’ordre afin de rendre l’information consultable sur papier.

## En cas de problème

Si l’image est déformée, vérifiez qu’elle est bien panoramique et proche du
ratio 2:1.

Si un point n’est pas à la bonne place, sélectionnez-le puis modifiez ses
coordonnées ou recréez-le avec un clic droit dans l’aperçu.

Si aucun point n’est défini, l’activité fonctionne simplement comme une image
360 navigable.
