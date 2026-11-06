<!-- arion:meta {"sections":{"Estimation de durée":{"aliases":["temps estimé","durée de la leçon","calcul de durée","durée pédagogique"],"keywords":["minutes","rapport","calcul","consultation"]},"Comprendre le calcul":{"aliases":["méthode d’estimation","base de consultation","coefficient pédagogique"],"keywords":["mots","vidéo","audio","interaction"]},"Consulter le rapport":{"aliases":["rapport de durée","diagnostic de durée","métrique"],"keywords":["rapport","médias","chapitre","références"]},"Estimation de durée d’une leçon":{"aliases":[],"keywords":[]},"Lancer un calcul":{"aliases":[],"keywords":[]},"Ce qui est pris en compte":{"aliases":[],"keywords":[]},"Méthode de calcul":{"aliases":[],"keywords":[]},"Lire le rapport détaillé":{"aliases":[],"keywords":[]},"Interpréter le résultat":{"aliases":[],"keywords":[]},"Sources documentaires citées dans le rapport":{"aliases":[],"keywords":[]},"Limites à garder en tête":{"aliases":[],"keywords":[]}}} -->

# Estimation de durée d’une leçon

PAIDEIA propose une estimation indicative du temps nécessaire pour parcourir
une leçon. Elle aide à dimensionner un parcours et à communiquer un ordre de
grandeur aux concepteurs et aux apprenants.

Cette valeur n’est ni une durée obligatoire, ni une prédiction exacte du temps
passé par chaque apprenant.

## Lancer un calcul

Depuis la page des chapitres, cliquez sur `Temps estimé — Cliquer pour
calculer`. Une fois le calcul terminé, PAIDEIA affiche une durée arrondie et
propose :

- `Recalculer` pour produire une nouvelle estimation ;
- `Consulter le rapport` pour ouvrir le détail du calcul.

L’estimation enregistrée est restaurée à la réouverture de la leçon tant que le
contenu mesuré n’a pas changé. Une modification du texte visible, d’un média,
d’une interaction ou de la structure des activités rend le calcul à refaire.
Une modification purement visuelle ne l’invalide pas.

## Ce qui est pris en compte

Le calcul distingue :

- le texte réellement présenté à l’apprenant ;
- la durée réelle des vidéos et des fichiers audio ;
- la quantité et la nature des interactions ;
- une marge pédagogique pour la compréhension et la manipulation.

Les sous-titres et les transcriptions ne sont pas ajoutés une seconde fois
lorsqu’ils accompagnent un média.

Les activités HTML personnalisé sont signalées dans le rapport mais exclues du
calcul, car leur contenu et leurs interactions peuvent être entièrement
spécifiques. Lorsqu’elles sont présentes, l’estimation concerne donc uniquement
la partie quantifiable de la leçon.

## Méthode de calcul

### Lecture du texte

Le texte visible est estimé à **150 mots par minute** :

```text
temps de lecture = nombre de mots / 150 × 60
```

Les libellés de l’éditeur, les métadonnées, les styles, les scripts, les textes
invisibles et les contenus réservés à l’édition ne sont pas comptés.

### Médias temporels

Les vidéos et fichiers audio utilisent leur durée réelle lorsqu’elle est
disponible. Un média dont la durée ne peut pas être lue est signalé dans le
rapport et n’est pas compté dans la base calculée.

### Interactions

Le rapport recense les éléments interactifs afin de rendre la charge du
parcours compréhensible. Les valeurs nominales initiales sont :

| Type d’interaction | Valeur indicative |
| --- | ---: |
| Révélation, accordéon ou carte simple | 4 s par interaction |
| Question ou QCM | 15 s par question |
| Association, classement ou tri | 10 s par élément |
| Recherche ou observation visuelle | 25 s par élément |
| Décision dans une mise en situation | 25 s par décision |

Ces indicateurs décrivent la charge d’interaction. Ils ne sont pas additionnés
une seconde fois comme s’ils constituaient une durée exacte indépendante.

### Marge pédagogique

La durée pédagogique estimée applique actuellement une pondération globale de
**×1,5** à la base de consultation. Cette marge couvre notamment la
compréhension, l’observation, la réflexion, les retours en arrière et
l’appropriation.

Le résultat est arrondi par paliers pratiques, généralement à cinq minutes pour
les durées suffisamment longues. PAIDEIA n’affiche donc pas une précision
artificielle à la seconde près.

## Lire le rapport détaillé

Le rapport présente séparément :

1. les données observées : mots, durées des médias et éléments interactifs ;
2. les conventions : vitesse de lecture et coefficients indicatifs ;
3. la base de consultation calculée ;
4. la pondération pédagogique ;
5. la durée estimée et son arrondi ;
6. les limites du modèle ;
7. un détail par chapitre et par média ;
8. les références méthodologiques.

Le rapport courant est conservé dans le dossier `metrics` du projet :

```text
metrics/lesson-duration-current.txt
metrics/lesson-duration-current.json
```

La version TXT peut être consultée dans PAIDEIA et téléchargée au format RTF.
Les rapports associés à un export PDF peuvent également être horodatés afin de
conserver le contexte exact de l’export.

## Interpréter le résultat

La durée estimée correspond à une enveloppe prudente pour un apprenant qui
découvre le contenu et le parcourt attentivement. Elle peut être plus courte
pour une personne qui connaît déjà le sujet et plus longue pour une personne
qui a besoin de davantage de temps pour lire, observer ou manipuler.

Utilisez-la pour comparer des leçons, équilibrer un module et annoncer une
charge approximative. Pour une activité très atypique, notamment HTML
personnalisé, complétez l’estimation avec une vérification humaine.

## Sources documentaires citées dans le rapport

La méthode s’appuie sur des travaux consacrés à la vitesse de lecture, à la
charge de travail et aux limites de la mesure du temps passé (*time-on-task*).
Le rapport cite notamment :

- Brysbaert (2019), sur la vitesse de lecture et le nombre de mots lus par
  minute ;
- le **Course Workload Estimator** de Rice University, développé par Barre et
  Esarey, pour l’estimation de charge de cours ;
- Carver (1982, 1992), sur les vitesses et les stratégies de lecture ;
- Carroll (1963), sur le temps d’apprentissage et les conditions de réussite ;
- Lee (2018), sur l’estimation du temps de travail dans les parcours
  d’apprentissage ;
- Kovanović et al. (2015/2016), sur l’analyse de l’engagement et du temps dans
  les environnements d’apprentissage en ligne ;
- Godwin et al. (2021), sur la mesure du temps d’apprentissage et ses limites.

Ces références éclairent les conventions utilisées. Elles ne constituent pas
la validation scientifique d’un coefficient universel : le **×1,5** reste une
convention empirique de conception, à confronter aux retours d’expérience sur
des parcours réels.

## Limites à garder en tête

- Les tentatives ne sont pas multipliées automatiquement.
- La durée des interactions est une indication, pas une mesure au chronomètre.
- Le modèle ne connaît pas le niveau préalable de l’apprenant.
- La difficulté réelle d’un texte n’est pas proportionnelle au seul nombre de
  mots.
- Une estimation à jour n’est pas invalidée par un simple changement de
  couleur, de fond ou d’apparence.
