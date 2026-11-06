<!-- arion:meta {"sections":{"Arion — Aidant de PAIDEIA":{"aliases":[],"keywords":[]},"Ouvrir Arion":{"aliases":[],"keywords":[]},"Formuler une demande":{"aliases":[],"keywords":[]},"Changer de contexte par une commande":{"aliases":["commandes de base d'Arion","contexte d'Arion"],"keywords":["aide","help","actions en masse","commandes","modifications"]},"Suggestions et validation":{"aliases":[],"keywords":[]},"Enchaîner plusieurs actions":{"aliases":[],"keywords":[]},"Annuler une modification":{"aliases":[],"keywords":[]},"Demander de l’aide":{"aliases":[],"keywords":[]},"Actions fréquentes":{"aliases":[],"keywords":[]},"Échanges simples avec Arion":{"aliases":[],"keywords":[]},"En cas de demande non reconnue":{"aliases":[],"keywords":[]},"Résumé du fonctionnement":{"aliases":[],"keywords":[]}}} -->

# Arion — Aidant de PAIDEIA

Arion vous accompagne dans l'ensemble de PAIDEIA. Vous pouvez échanger avec
lui, lui demander de l'aide sur l'écran que vous consultez et, lorsqu'une
leçon est ouverte, lui décrire des modifications de conception en langage
naturel.

Arion reste un assistant déterministe : il agit uniquement sur les
fonctionnalités qu’il sait gérer. Ses actions de conception sont disponibles
seulement dans une leçon ouverte et passent toujours par une prévisualisation.

## Ouvrir Arion

Cliquez sur la figure d’Arion placée en bas à droite de PAIDEIA. Elle est
accessible depuis l'accueil, les banques de leçons et de ressources, les
paramètres et l'éditeur d'une leçon. Arion n'apparaît ni dans l'aperçu LMS ni
dans les contenus SCORM exportés.

La fenêtre comporte trois zones :

- un en-tête fixe avec le nom d’Arion, la leçon courante, une commande pour
  commencer une nouvelle conversation et une commande de découverte ;
- une zone centrale qui contient l’historique de la conversation et dispose de
  son propre défilement ;
- un composeur fixé en bas, toujours disponible pour saisir la prochaine
  demande.

La fermeture avec la croix ou avec la figure d’Arion masque la fenêtre sans
effacer la conversation. Lorsque vous la rouvrez ou que vous naviguez vers un
autre écran, l’échange est conservé.

Si vous quittez une leçon alors qu'une modification est encore en préparation,
Arion abandonne cette modification afin qu'elle ne puisse pas être appliquée
ultérieurement à la mauvaise leçon. Le reste de la conversation demeure
disponible.

`Nouvelle conversation` efface uniquement l’échange affiché afin de repartir
sur une demande indépendante.

## Formuler une demande

Les demandes de modification décrites ci-dessous nécessitent qu'une leçon soit
ouverte. Depuis un autre écran, Arion vous indique d'ouvrir une leçon mais
reste disponible pour échanger et fournir de l'aide.

Écrivez ce que vous souhaitez modifier, en indiquant si possible :

1. l’action à effectuer ;
2. l’élément concerné ;
3. la portée souhaitée ;
4. la valeur à appliquer.

Par exemple :

```text
Mets la hauteur de toutes les activités vidéo sur minimale.
```

Vous pouvez préciser un chapitre ou un type d’activité :

```text
Change la couleur des sous-titres des vidéos du chapitre 2 en bleu.
Mets le fond des activités Texte en blanc dans les chapitres 1, 3 et Conclusion.
```

Une modification peut viser plusieurs chapitres, indiqués par leur numéro ou
leur libellé. Avant l'application, Arion affiche la liste des chapitres qu'il a
résolus. Si un numéro ou un libellé est introuvable ou ambigu, aucune
modification n'est préparée.

Si une information manque, Arion ne modifie rien et vous pose une question
ciblée. Répondez simplement, par exemple : `bleu`, `les vidéos`, `ce
chapitre` ou `toutes les activités`.

Vous pouvez employer `tu` ou `vous` dans vos demandes. Arion répond avec un
vouvoiement constant afin de conserver un échange cohérent.

## Changer de contexte par une commande

Le contexte d'Arion se choisit directement par une commande écrite, sans
sélecteur dans l'interface.

Pour donner la priorité à la documentation, saisissez par exemple :

```text
Aide
Aide-moi
Help
Au secours
J'ai besoin d'assistance
```

Pour donner la priorité aux commandes qui modifient plusieurs éléments,
saisissez par exemple :

```text
Actions en masse
Commandes
Modifications
```

Une demande commençant directement par un verbe d'action comme `modifie`,
`change`, `applique`, `mets`, `supprime`, `active` ou `désactive` place aussi
Arion dans le contexte des actions. Vous pouvez donc écrire immédiatement la
demande complète sans activer le contexte au préalable.

## Suggestions et validation

Quand votre saisie correspond à une ou plusieurs demandes connues, Arion peut
afficher des propositions sous la zone de saisie.

- À l’apparition de la liste, aucune proposition n’est sélectionnée.
- `Entrée` envoie donc votre texte tel quel à Arion.
- Utilisez les flèches ou `Tab` pour sélectionner explicitement une proposition ; `Maj + Tab` parcourt la liste dans l’autre sens.
- Une fois une proposition sélectionnée, `Entrée` l’envoie.

Avant toute modification, Arion affiche un aperçu : nombre d’activités
concernées et, lorsque c’est possible, valeur actuelle puis nouvelle valeur.

Exemple :

```text
18 activités vidéo seront modifiées.
Hauteur : normale → minimale.
```

La modification n’est effectuée qu’après votre confirmation avec `Appliquer`.
Une demande, une question de précision ou un aperçu ne change donc pas la
leçon.

### Supprimer plusieurs activités

Arion peut préparer une suppression explicite telle que :

```text
Supprime les activités Vidéo.
Supprime toutes les activités du chapitre 3.
Supprime les activités Texte dans le chapitre nommé Introduction.
Supprime les activités Vidéo dans les chapitres 1, 3 et Conclusion.
```

Cette destruction suit un parcours distinct. Le bouton **Examiner la
suppression** ne supprime rien. Arion recalcule ensuite le nombre exact
d'activités et les chapitres concernés, puis affiche leurs libellés, le nombre
d'activités par chapitre et un second bouton portant le nombre total à
supprimer. Tous les chapitres demandés doivent être résolus : Arion ne réalise
jamais une suppression partielle. Les mots `oui`, `confirme` ou `vas-y` saisis dans le champ
ne valident jamais cette opération.

Après la confirmation finale, PAIDEIA crée et vérifie d'abord une entrée
**Avant action Arion — suppression de …** dans Restaurations. La suppression
n'est lancée que si ce point existe. L'annulation immédiate reste disponible
dans Arion ; l'entrée de restauration demeure utilisable après la fermeture de
la conversation. Si la leçon ou le périmètre change entre l'examen et la
confirmation, aucune activité n'est supprimée.

Une formulation ambiguë comme `Supprime les vidéos` ne désigne pas une
suppression d'activités. Une commande mêlant destruction et autre modification
est refusée et doit être séparée.

## Enchaîner plusieurs actions

Vous pouvez regrouper des actions dans une même demande :

```text
Mets les activités vidéo sur hauteur minimale puis autorise le plein écran.
```

Arion vérifie chaque étape et présente le résultat avant application. Si un
enchaînement est incomplet ou ambigu, il demande uniquement la précision
nécessaire.

Pour éviter une modification trop large, indiquez explicitement la portée :
`dans ce chapitre`, `dans toute la leçon`, `toutes les vidéos` ou `toutes les
activités compatibles`.

## Annuler une modification

Après une action appliquée, vous pouvez demander :

```text
Annule.
Annule ce qu’on vient de faire.
Reviens en arrière.
```

Arion propose alors l’annulation de la dernière opération. Vous pouvez aussi
préciser ce qui doit être annulé lorsqu’il s’agissait d’un ensemble d’actions.
L’annulation est vérifiée avant d’être appliquée afin de ne pas écraser une
modification manuelle réalisée entre-temps.

## Demander de l’aide

Pour demander de l’aide, utilisez naturellement une formulation telle que :

```text
Aide
Aide-moi
Peux-tu m’aider ?
J’ai besoin d’aide pour les vidéos.
```

Arion vous demande alors le sujet qui vous intéresse. Vous pouvez répondre
avec un mot ou une expression, par exemple `vidéo`, `sous-titres`, `activité
Texte` ou `fond de l’activité`.

Arion recherche les contenus d’aide disponibles et propose les rubriques
correspondantes, même si vous ne connaissez pas leur titre exact. Une
recherche sur `sous-titres` peut ainsi faire remonter une aide consacrée au
contrat ou à l’éditeur des sous-titres.

Arion distingue trois intentions dans une saisie : une **action** qui modifie
la leçon, une **navigation** qui ouvre ou rejoint une zone de PAIDEIA, et une
demande d’**aide**. La documentation indexée est la source utilisée pour
répondre aux demandes d’aide ; elle ne constitue pas une quatrième intention
concurrente. Les termes `éditer`, `édition`, `modifier`, `modification` et
`changer` donnent la priorité aux propositions d’action.

Les réponses documentaires sont présentées pour faciliter la lecture : titres
mis en évidence, texte courant normal et listes conservées. Selon le contenu,
Arion peut proposer plusieurs résultats à consulter.

Lorsqu’une rubrique appartient à un document composé de plusieurs parties,
Arion propose directement les autres rubriques associées après la réponse.
Cliquez sur une rubrique pour la consulter sans recommencer la recherche. Vous
pouvez répondre `oui` pour faire réapparaître cette liste, choisir `Autre
sujet` pour lancer une nouvelle recherche ou répondre `non merci` pour terminer
la consultation.

Les contenus d’aide disponibles proviennent de la documentation intégrée à
PAIDEIA. Arion tient compte de l'écran affiché pour présenter le contexte de
l'échange. Si aucun résultat ne correspond, reformulez avec un autre mot ou
demandez une aide plus générale.

## Actions fréquentes

Arion peut mémoriser localement des formulations d’actions que vous utilisez
souvent. Elles apparaissent dans `Vos actions fréquentes`, sous le composeur.
Cette zone est affichée uniquement lorsqu'une leçon est ouverte : elle est
masquée sur l'accueil, dans les banques, les ressources et les paramètres.

Cette section est repliée par défaut pour laisser la conversation au premier
plan. Cliquez dessus pour afficher les propositions et choisissez-en une pour
la réutiliser.

Les actions fréquentes servent de raccourcis : elles ne sont pas exécutées
automatiquement et passent toujours par l’aperçu et la confirmation habituels.

## Échanges simples avec Arion

Arion comprend également les échanges courants : salutations, remerciements,
présentation, prise de congé et fin de conversation. Plusieurs réponses
peuvent être utilisées afin que l’échange ne donne pas l’impression d’une
réponse répétée mécaniquement.

Ces échanges ne modifient jamais la leçon.

Ils restent disponibles sur tous les écrans et peuvent s'insérer dans une
conversation en cours. Par exemple, un remerciement pendant qu'Arion attend une
couleur reçoit une réponse sociale sans supprimer la question ni les éléments
déjà compris. Pendant cet échange, les choix guidés et la prévisualisation de la
demande interrompue sont temporairement masqués afin de conserver un fil naturel.
Ils ne réapparaissent que lorsque vous reprenez la demande ; les suggestions
d'aide ne sont proposées que si vous sollicitez effectivement l'aide d'Arion.

## En cas de demande non reconnue

Si Arion ne comprend pas suffisamment la demande, il vous invite à la préciser
ou vous indique le type d’information manquante. Reformulez en ajoutant :

- le type d’activité (`vidéo`, `Texte`, etc.) ;
- la propriété à modifier (`hauteur`, `couleur`, `police`, etc.) ;
- la valeur souhaitée ;
- la portée (`ce chapitre` ou `toute la leçon`).

La formulation de cette invitation peut varier afin de conserver un échange
naturel ; Arion évite de répéter immédiatement la même réponse.

Arion ne prétend pas avoir exécuté une action qu’il ne reconnaît pas. Pour une
modification qui n’est pas proposée, utilisez directement l’éditeur de
l’activité concernée.

## Résumé du fonctionnement

```text
Décrire une demande
        ↓
Préciser si nécessaire
        ↓
Vérifier l’aperçu
        ↓
Appliquer ou annuler
```

La conversation aide à formuler et à contrôler l’action ; la décision finale
reste toujours entre vos mains
