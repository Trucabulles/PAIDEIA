<!-- arion:meta {"sections":{"Texte à compléter":{"aliases":["texte à trous","texte lacunaire","compléter un texte","fill in the blanks"],"keywords":["réponse","mot","liste","exercice"]},"Créer un texte à compléter":{"aliases":["ajouter un trou","créer une réponse"],"keywords":["sélection","Utiliser comme réponse","Utiliser comme liste"]},"Configurer les réponses":{"aliases":["réponses attendues","bonne réponse","choix proposés"],"keywords":["variante","casse","distracteur"]},"Répondre à l’exercice":{"aliases":["remplir le texte","saisir une réponse","faire l’exercice"],"keywords":["champ","sélectionner","valider"]},"Résultat et tentatives":{"aliases":["score","correction","relecture","essais"],"keywords":["résultat","réussite","recommencer","continuer"]},"Couverture et page de fin":{"aliases":["écran de début","message de réussite","message d’échec"],"keywords":["couverture","fin","message"]},"Activité Texte à compléter":{"aliases":[],"keywords":[]},"Préparer le document":{"aliases":[],"keywords":[]},"Choisir entre Mot et Liste":{"aliases":[],"keywords":[]},"Configurer les réponses attendues":{"aliases":[],"keywords":[]},"Règles de correction":{"aliases":[],"keywords":[]},"Couverture et paramètres de l’activité":{"aliases":[],"keywords":[]},"Personnaliser la page de fin":{"aliases":[],"keywords":[]},"Résultat, relecture et score":{"aliases":[],"keywords":[]},"Tentatives illimitées ou limitées":{"aliases":[],"keywords":[]},"Navigation et progression de la leçon":{"aliases":[],"keywords":[]},"Conseils de conception":{"aliases":[],"keywords":[]},"En cas de problème":{"aliases":[],"keywords":[]}}} -->

# Activité Texte à compléter

L’activité **Texte à compléter** permet de transformer un texte en exercice.
L’apprenant lit le document puis renseigne les réponses directement dans le
texte, soit dans un champ libre, soit en choisissant une proposition dans une
liste.

L’activité peut contenir plusieurs réponses de types différents dans un même
document. Les réponses sont corrigées ensemble et participent au même score.

## Préparer le document

Dans l’éditeur, rédigez d’abord le texte complet avec l’éditeur Rich Text. La
mise en page, les titres, les listes, les tableaux et les autres styles du
document peuvent être utilisés selon les outils disponibles.

Pour créer une réponse :

1. sélectionnez une portion contiguë du texte ;
2. cliquez sur `Mot manquant` pour créer un champ libre ;
3. ou cliquez sur `Liste` pour créer une liste de choix.

La portion sélectionnée devient une réponse dans le document. Une réponse peut
être un mot, plusieurs mots, un nombre, une expression, une commande ou une
syntaxe technique.

Exemples :

```text
Le raccourci pour enregistrer est Ctrl+S.
Le dossier à utiliser est C:\Windows\Temp.
```

Les pages ne sont pas créées manuellement dans l’éditeur. Le document reste un
flux continu ; PAIDEIA le répartit automatiquement en pages dans le rendu
apprenant.

## Choisir entre Mot et Liste

### Réponse libre

`Mot manquant` crée un champ dans lequel l’apprenant saisit lui-même
la réponse.

Ce mode convient lorsque vous souhaitez vérifier la mémorisation d’un terme,
d’une valeur ou d’une expression.

### Liste de choix

`Liste` crée une liste dans laquelle l’apprenant sélectionne une
proposition.

Ce mode convient lorsque la saisie libre serait trop difficile, lorsque les
réponses doivent être comparées rapidement ou lorsque vous souhaitez proposer
des distracteurs.

Vous pouvez mélanger les deux modes dans un même texte. L’ordre des réponses
est celui de leur apparition dans le document.

## Configurer les réponses attendues

La section `Réponses attendues` liste les réponses créées. Chaque fiche indique
son type (`Mot` ou `Liste`) et affiche un aperçu de la bonne réponse.

Cliquez sur une fiche pour l’ouvrir, puis renseignez :

- `Bonne réponse` : la réponse considérée comme correcte ;
- `Autres réponses acceptées` pour un champ Mot ;
- `Choix proposés` pour une Liste ;
- `Respecter la casse`, si les majuscules et minuscules doivent être
  distinguées.

Pour une réponse de type Mot, chaque ligne des autres réponses acceptées
correspond à une variante valide. Par exemple, vous pouvez accepter plusieurs
formes explicitement prévues, sans correction automatique.

Pour une réponse de type Liste, chaque ligne des choix proposés correspond à
une proposition complète. La bonne réponse est ajoutée aux choix et reste la
seule proposition correcte ; les autres sont des distracteurs.

Pour supprimer une réponse, utilisez la commande de suppression de sa fiche.
Le texte redevient alors un texte normal à cet endroit.

## Règles de correction

Pour un champ Mot :

- les espaces au début et à la fin sont ignorés ;
- la casse est ignorée par défaut ;
- les espaces à l’intérieur de la réponse restent significatifs ;
- les accents, la ponctuation et les caractères spéciaux restent significatifs ;
- aucune correction orthographique automatique n’est appliquée ;
- aucune réponse approchante n’est acceptée automatiquement.

Ajoutez donc explicitement les variantes que vous souhaitez accepter. Une
réponse qui n’est pas indiquée dans la bonne réponse ou dans les variantes
acceptées sera considérée comme incorrecte.

Pour une Liste, seule la valeur configurée dans `Bonne réponse` est correcte.
Les autres choix servent à tester la compréhension et ne sont pas des variantes
acceptées.

## Couverture et paramètres de l’activité

La section `Couverture` permet de choisir si une page de présentation doit être
affichée et de renseigner :

- le titre de la couverture ;
- le texte explicatif ;
- la couleur de fond ;
- une image de couverture, si le média est disponible.

Dans `Paramètres de l’activité`, vous pouvez choisir :

- `Tentatives illimitées` ;
- le `Nombre maximal d’essais` lorsque les tentatives sont limitées ;
- le `Seuil de réussite (%)`.

Le nombre maximal d’essais est compris entre 1 et 10 lorsque les tentatives
illimitées ne sont pas activées.

## Personnaliser la page de fin

Dans `Page de fin`, saisissez les messages affichés selon le résultat :

- `Message en cas de réussite` ;
- `Message en cas d’échec`.

Ces messages utilisent l’éditeur Rich Text et peuvent donc être adaptés au ton
de la leçon.

## Répondre à l’exercice

Dans le rendu apprenant :

1. lisez le texte et complétez les champs Mot ;
2. sélectionnez une proposition dans chaque Liste ;
3. utilisez `Suivant` pour parcourir les pages ;
4. cliquez sur `Valider vos réponses` sur la dernière page.

Les champs et listes restent intégrés dans le texte. La pagination s’adapte
automatiquement à la largeur disponible ; un document plus étroit peut donc
occuper davantage de pages.

## Résultat, relecture et score

Après la validation, PAIDEIA affiche le résultat de la tentative et le score :

```text
nombre de réponses correctes / nombre total de réponses × 100
```

Cliquez sur `Suivant` pour accéder à la relecture. La relecture restitue les
réponses saisies en lecture seule et signale les réponses correctes et
incorrectes.

Une nouvelle validation ne peut pas modifier rétroactivement le score d’une
tentative précédente. Lorsque les essais sont limités, le meilleur score est
conservé séparément du score du dernier essai.

Après la relecture, la page de fin affiche le score bilan et le message
correspondant. Selon la configuration, vous pouvez `Recommencer` ou
`Continuer` pour poursuivre la leçon.

### Dévoiler les réponses à la dernière relecture

Cette option des paramètres est désactivée par défaut. Lorsqu’elle est activée,
la dernière relecture conserve vos réponses et ajoute `Réponse attendue : …`
pour chaque réponse incorrecte. Les réponses correctes ne sont pas répétées.

En essais limités, les solutions apparaissent dès qu’une réussite est acquise
ou que toutes les tentatives sont consommées. Les relectures intermédiaires
ne dévoilent aucune solution.

En essais illimités, `↻` permet de poursuivre l’entraînement sans solutions.
Depuis la page de fin, `Continuer` ouvre d’abord une relecture finale avec les
solutions ; le dernier `Continuer` termine ensuite l’activité et libère la
progression. Le score et l’historique des tentatives restent inchangés.

## Tentatives illimitées ou limitées

Avec `Tentatives illimitées`, l’activité fonctionne comme un entraînement :

- l’apprenant peut recommencer pour s’exercer ;
- le score est affiché comme feedback ;
- `Continuer` permet de sortir de l’activité et de poursuivre la leçon.

Avec un nombre d’essais limité :

- chaque validation consomme une tentative ;
- `Recommencer` ouvre une nouvelle tentative tant qu’il en reste ;
- le meilleur score est conservé ;
- après la dernière tentative, l’apprenant ne peut plus recommencer ;
- une réussite peut permettre de continuer avant l’épuisement du quota.

## Navigation et progression de la leçon

Texte à compléter utilise une pagination avec les commandes `Précédent` et
`Suivant`. Les activités placées après elle restent masquées jusqu’à la sortie
effective de l’activité.

La réussite, l’échec ou l’épuisement du quota ne libère pas automatiquement la
suite. L’apprenant doit cliquer sur `Continuer` lorsque cette commande est
proposée.

## Conseils de conception

- Ne transformez en réponse que les éléments réellement évalués.
- Donnez suffisamment de contexte pour qu’un champ Mot soit compréhensible.
- Utilisez une Liste lorsque plusieurs réponses sont plausibles ou lorsque la
  saisie exacte n’est pas l’objectif pédagogique.
- Vérifiez les accents, espaces, signes et variantes que vous voulez accepter.
- Pour une Liste, proposez des distracteurs crédibles mais clairement
  différents de la bonne réponse.
- Testez chaque page, chaque réponse et chaque chemin de tentatives dans
  l’aperçu LMS.

## En cas de problème

Si un champ n’apparaît pas, vérifiez qu’une sélection de texte a bien été faite
avant d’utiliser `Mot manquant` ou `Liste`.

Si une réponse est marquée incorrecte malgré une formulation attendue, vérifiez
la `Bonne réponse`, les variantes acceptées et l’option `Respecter la casse`.

Si une Liste ne propose pas la bonne valeur, ajoutez-la dans `Bonne réponse` :
elle sera intégrée automatiquement aux choix proposés.

Si le texte s’étend sur plusieurs pages, utilisez les commandes de navigation du
folio. Les pages sont calculées automatiquement et ne constituent pas des
blocs séparés dans l’éditeur.

Lors de la correction finale, les champs montrent les bonnes réponses en vert. Un une croix rouge à cheval sur le coin supérieur droit du champ signale les réponses initialement erronées : le survol montre `Votre réponse : …`, le clic garde cette information ouverte, et un clic en dehors la ferme. Échap permet également de la fermer.

La correction est précédée du libellé « Le corrigé vous montre en vert les réponses attendues. Le symbole (croix rouge) indique vos erreurs et vous permet de consulter votre réponse. », avec le pictogramme rouge réel inséré dans la phrase.

En relecture, les listes ne montrent plus de chevron. Les réponses initialement justes portent une coche verte dans un rond blanc à liseré vert soutenu ; les erreurs corrigées conservent le symbole rouge consultable.

Le copier-coller de texte contenant des champs Mot/Liste conserve le texte formaté sans dupliquer les champs : recréez les marqueurs sur le texte collé. Supprimer un marqueur conserve son formatage. La barre riche du document s’ouvre développée.
