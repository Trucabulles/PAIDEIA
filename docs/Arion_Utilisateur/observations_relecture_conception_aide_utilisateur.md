<!-- arion:meta {"title":"Observations de relecture et de conception","aliases":["ajouter une observation","note de relecture","notes de conception","post it","demande de correction","commenter une activité","supprimer une note","purger les notes","rechercher une observation","exporter les notes en PDF"],"sections":{"Afficher les observations":{"aliases":["voir les observations"],"keywords":["aperçu LMS","marqueur","compteur","revue globale","recherche","PDF"]},"Créer un fil":{"aliases":["ajouter une note","laisser un commentaire"],"keywords":["activité","idée","correction","chapitre","numéro"]},"Répondre sans écraser":{"aliases":["échanger dans un fil"],"keywords":["conversation","auteur","réponse","suppression horodatée"]},"Traiter une observation":{"aliases":["résoudre une observation","purger toutes les notes"],"keywords":["rouvrir","éditeur","propriétaire","historique technique"]}}} -->

# Observations de relecture et de conception

Les observations servent à noter une idée ou à échanger sur une activité sans modifier la leçon elle-même.

## Afficher les observations

Dans l'éditeur, le petit bouton rond situé à droite de **Chapitres** ouvre la revue globale. Il reste sur la même ligne que la barre des favoris. La page des chapitres propose aussi une pilule **Observations**, au-dessus des actions de chapitre : elle ouvre toutes les notes de tous les chapitres et son compteur indique les fils restant à traiter. Dans l'aperçu LMS, choisir **Observations** : aucun marqueur n'est affiché avant cette activation volontaire. Les marqueurs apparaissent à droite des activités et leur nombre indique les observations encore à traiter.

Une ouverture depuis une activité affiche uniquement les observations de cette activité. Choisir **Voir toutes les observations** pour retrouver la revue globale et son champ de recherche. La recherche porte sur le texte des observations et des réponses, les auteurs et les références d'activité.

## Créer un fil

Dans l'éditeur, choisir l'icône de note dans le groupe d'actions de l'activité. Dans l'aperçu LMS, choisir son marqueur. Le cartouche placé au-dessus de la saisie indique le chapitre, le numéro courant et le type de l'activité, par exemple `Chapitre 2 · Activité 4 · Citation`. Sélectionner ce cartouche ramène directement à l'activité. Écrire ensuite une idée, une correction ou un retour, puis sélectionner **Ajouter**. Le texte reste une note simple et ne fait pas partie du contenu présenté à l'apprenant.

Dans une leçon personnelle, ces notes peuvent servir au travail de conception. Aucun nom d’auteur n’est nécessaire dans cette vue locale.

Les observations locales sont conservées lorsque la leçon est partagée. En HTTPS, leur import est indépendant de la publication pédagogique : une erreur d’import ne rend pas le projet indisponible. PAIDEIA conserve une copie locale et une reprise persistante isolée par service et utilisateur, réessayée lors des actualisations ordinaires. Une route serveur absente doit être corrigée par l’organisation ; supprimer les notes n’est pas nécessaire.

## Répondre sans écraser

Chaque réponse est ajoutée à la suite du fil avec le nom de son auteur et sa date. Répondre ne remplace jamais le message d'une autre personne.

L'auteur d'une note peut supprimer sa propre contribution avec l'icône corbeille affichée dans son en-tête, puis confirmer dans la modale. Dans la revue globale, son texte est remplacé par deux lignes compactes : la référence de l'activité, puis la mention horodatée complète. Si le fil ne contient plus aucun message actif, le champ de réponse et les commandes de traitement disparaissent.

## Traiter une observation

Choisissez **Marquer comme traitée**, puis **Rouvrir** pour reprendre le fil.

Une observation traitée se replie automatiquement. Son résumé conserve l'activité, l'auteur, l'état **Traitée** et le début du texte ; sélectionner ce résumé redéploie tout le fil.

Le propriétaire de la leçon peut également ouvrir le menu hamburger placé à gauche du libellé **Relecture**, puis choisir **Purger toutes les notes**. Cette opération remet les observations visibles à zéro après confirmation dans une modale. Un historique technique reste dans le dossier `notes/history` du projet, mais il n'est ni consultable ni restaurable dans PAIDEIA.

Ce même menu permet de générer volontairement un PDF consacré aux observations de toute la leçon. Il contient les références de chapitre et d'activité, les états, les auteurs, les dates, les contributions et les traces de suppression. Il reste distinct du PDF pédagogique : les observations ne sont jamais ajoutées au document de leçon ordinaire.

Le dossier `notes` est conservé dans le projet et dans son fichier `.paideia`. Les observations et leur historique ne sont jamais embarqués dans un SCORM.
