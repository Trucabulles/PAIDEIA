<!-- arion:meta {"sections":{"Paramètres de la leçon":{"aliases":["réglages de la leçon","personnalisation de la leçon","apparence de la leçon"],"keywords":["espacement","coins arrondis","ombres","couleur du texte","titre de chapitre"]},"Bandeau de leçon":{"aliases":["bandeau","couverture de la leçon","image du cours","header de la leçon"],"keywords":["hauteur","dégradé","titre","bouton","image"]},"Police de la leçon":{"aliases":["police globale","typographie de la leçon","font"],"keywords":["police","importer","banque"]},"SCORM et LMS":{"aliases":["suivi LMS","suivi SCORM","complétion"],"keywords":["quiz","seuil","certification","consultation"]},"Paramètres de la leçon et bandeau":{"aliases":[],"keywords":[]},"Ouvrir les paramètres":{"aliases":[],"keywords":[]},"Apparence de la leçon":{"aliases":[],"keywords":[]},"SCORM / LMS":{"aliases":[],"keywords":[]},"Vérifier le résultat":{"aliases":[],"keywords":[]},"En cas de problème":{"aliases":[],"keywords":[]}}} -->

# Paramètres de la leçon et bandeau

Les **Paramètres de la leçon** regroupent les réglages qui s’appliquent à la
leçon dans son ensemble. Ils permettent notamment de personnaliser le bandeau,
l’espacement entre les activités, la typographie et certains comportements
SCORM/LMS.

## Ouvrir les paramètres

Dans l’éditeur de leçon, cliquez sur le bouton représentant un engrenage. Le
panneau s’ouvre à côté du contenu et présente plusieurs sections repliables.

Les réglages sont enregistrés dans le projet de la leçon. Un réglage défini
directement dans une activité reste prioritaire lorsqu’il existe.

## Bandeau de leçon

La section `Bandeau de leçon` concerne le bandeau affiché dans le menu des
chapitres et dans les rendus de la leçon.

### Image du bandeau

Cliquez sur `Choisir` pour sélectionner une image de cours. L’image est copiée
dans le projet PAIDEIA ; le fichier original n’est pas modifié.

Pour retirer l’image, utilisez la commande de suppression affichée à côté de sa
vignette.

### Hauteur

La hauteur du bandeau peut être réglée sur :

- `Petite · 300 px` ;
- `Moyenne · 400 px` ;
- `Grande · 500 px`.

Choisissez une hauteur adaptée au volume du titre et au bouton de démarrage.
Un titre sur plusieurs lignes ou une police importante nécessite davantage de
place.

### Position de l’image

Lorsque l’image est disponible dans le menu des chapitres, double-cliquez
dessus pour activer son ajustement vertical, puis faites-la glisser. La touche
`Échap`, un clic extérieur ou un second double-clic termine le réglage.

La commande de réinitialisation replace l’image sur son cadrage par défaut.
Ce réglage ne modifie ni le titre, ni le bouton, ni la hauteur du bandeau.

### Dégradé

Le dégradé améliore la lisibilité du contenu placé sur l’image. Vous pouvez
choisir :

- sa couleur ;
- son opacité ;
- sa position : `Gauche`, `Bas vers haut`, `Droite` ou `Complet` ;
- sa diffusion : `Compacte`, `Normale` ou `Large`.

Dans le sélecteur de couleur du dégradé, choisissez **Aucun** pour le désactiver. Ce choix est conservé après réouverture et dans le SCORM.

Adaptez l’opacité et la position au contraste de l’image. Un dégradé trop
opaque peut masquer inutilement le visuel.

### Texte et bouton

Le titre et le bouton de démarrage peuvent être positionnés à `Gauche`, au
`Centre` ou à `Droite`.

Pour renforcer la lisibilité du texte, choisissez un contour `Sans`, `Fin`,
`Moyen` ou `Épais`, puis une couleur de contour `Claire` ou `Sombre`.

Le titre conserve sa mise en forme Rich Text. Le bandeau grandit avec son
contenu dans les limites de la hauteur choisie ; le texte ne doit pas recouvrir
le bouton ni sortir de la surface du bandeau.

## Apparence de la leçon

La section `Apparence de la leçon` regroupe les réglages généraux qui ne
concernent pas uniquement le bandeau.

### Espacement entre activités

Le curseur `Espacement entre activités` règle l’espace vertical entre les
activités. La valeur par défaut est de **30 px** et la plage disponible va de
**15 à 60 px**.

Augmentez cet espacement pour aérer une leçon dense ; réduisez-le lorsque les
activités doivent être plus rapprochées.

### Aspect des activités

Vous pouvez activer ou désactiver :

- `Coins arrondis` pour les activités qui prennent en charge ce réglage ;
- `Ombres` pour les activités compatibles.

Certaines activités disposent d’un contrat visuel particulier et peuvent ne
pas reprendre l’un de ces réglages généraux.

### Bandeau du titre des chapitres

L’option `Masquer le bandeau du titre des chapitres` retire le bandeau standard
dans l’aperçu LMS et dans le SCORM. Elle est désactivée par défaut et peut être
réactivée à tout moment sans perte du titre ni des données du chapitre.

Le titre reste visible dans l’éditeur, le menu des chapitres, la navigation et
les informations accessibles. Le PDF reste inchangé. Vous pouvez ainsi placer
une activité `En-tête` au début du chapitre pour composer un bandeau
personnalisé ; PAIDEIA ne crée et ne transforme aucune activité automatiquement.

### Couleur du texte et fond de la leçon

La couleur du texte peut rester sur `Couleur par défaut` ou être remplacée par
une `Couleur personnalisée`. Vous pouvez également choisir la couleur de fond
de la leçon.

Une couleur explicitement choisie dans une activité ou dans son contenu Rich
Text reste prioritaire sur la couleur générale.

## Police de la leçon

La section `Police de la leçon` affiche les polices disponibles sous forme de
cartes de prévisualisation. Cliquez sur une carte pour appliquer la police à la
leçon.

Vous pouvez aussi :

- `Importer pour ce projet` afin d’utiliser une police uniquement dans le
  projet courant ;
- `Ajouter à mes polices` afin de la conserver dans votre banque personnelle.

Une police importée doit disposer d’une licence autorisant son utilisation, sa
conversion et son intégration dans les exports. Vous êtes responsable du
respect de cette licence.

## SCORM / LMS

La section `SCORM / LMS` règle le comportement de suivi du chapitre actif.

Le mode `Consultation simple` suit la consultation de la leçon sans exiger un
quiz validant.

Les modes `Quiz validant`, `Quiz certificatif` et `Avancé` nécessitent qu’une
activité quiz soit configurée pour envoyer son score au LMS. Ils permettent de
lier la réussite du chapitre au seuil défini par le quiz.

Dans le mode `Avancé`, vous pouvez choisir le statut envoyé lorsque le seuil est
atteint et celui envoyé lorsqu’il ne l’est pas. Le panneau affiche le couple de
statuts actuellement appliqué.

Ces réglages concernent le suivi LMS du chapitre actif. Vérifiez-les chapitre
par chapitre lorsque les exigences de certification diffèrent.

## Vérifier le résultat

Après toute modification importante, contrôlez :

- le bandeau dans le menu des chapitres ;
- le titre et le bouton de démarrage ;
- l’image et son cadrage ;
- le contraste du texte ;
- l’espacement entre les activités ;
- la police et les couleurs ;
- l’aperçu LMS et l’export SCORM.

Les rendus doivent rester lisibles sur un écran large comme sur un écran
étroit. Un réglage du bandeau ne doit pas déplacer ou déformer les activités de
la leçon.

## En cas de problème

Si l’image du bandeau n’apparaît pas, vérifiez qu’elle est toujours associée au
projet et rechargez la leçon.

Si le titre manque de contraste, utilisez le dégradé ou le contour du texte.
Une image très claire ou très détaillée peut nécessiter une opacité plus forte.

Si un réglage général ne semble pas s’appliquer à une activité, vérifiez si
cette activité possède un réglage local ou un contrat d’apparence spécifique.

Si un mode quiz LMS est indisponible, activez d’abord `Envoyer le score au LMS`
dans une activité quiz compatible.
