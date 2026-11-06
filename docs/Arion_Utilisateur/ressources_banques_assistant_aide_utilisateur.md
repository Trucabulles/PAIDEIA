<!-- arion:meta {"sections":{"Banque de personnages":{"aliases":["personnages réutilisables","banque d’avatars","poses"],"keywords":["pose","image","mise en situation"]},"Banque de questions":{"aliases":["questions réutilisables","questions de quiz","banque quiz"],"keywords":["QCU","QCM","vrai faux","XLSX"]},"Balises & renvois":{"id":"ressources-banques-et-assistant-balises-renvois","aliases":["banque de balises","banque de définitions","balises et renvois","matrice de balises","mise à jour des définitions"],"keywords":["balise","renvoi","définition","XLSX","matrice","chef de projet","propriétaire","verrou","en attente","fermeture","reprise"]},"Ressources : banques et assistant":{"aliases":[],"keywords":[]},"Conseils communs":{"id":"ressources-banques-et-assistant-5","aliases":[],"keywords":[]},"En cas de problème":{"id":"ressources-banques-et-assistant-6","aliases":[],"keywords":[]},"Glossaire":{"aliases":["glossaire","assistant pédagogique","aide apprenant","assistant et glossaire"],"keywords":["terme","définition","alias","recherche"]}},"title":"Ressources : banques et glossaire"} -->

# Ressources : banques et glossaire

L’onglet **Ressources** regroupe des éléments réutilisables entre plusieurs
leçons. Il évite de recréer les mêmes personnages, questions ou définitions
dans chaque projet.

Le bouton **+** placé à côté du compteur de banques permet d’en créer une, sans tuile d’ajout séparée. Cette présentation est commune aux banques et au Glossaire.

Le champ **Rechercher une ressource…**, dans la colonne de gauche comme dans la vue Leçons, filtre les noms de la famille affichée uniquement : personnages, questions, Glossaire ou Balises & renvois. La recherche s’applique pendant la saisie, sans distinction de majuscules ou d’accents. Vider le champ réaffiche toutes les tuiles de cette famille.

Au-dessus des tuiles, **Trier par** propose **Nom A → Z**, **Nom Z → A**, **Dernière modification — plus récentes** ou **Dernière modification — plus anciennes**. Le choix est conservé séparément pour chaque famille, y compris après fermeture de PAIDEIA. Les ressources sans date connue restent en fin de liste. La recherche et le tri n’ouvrent pas les banques et ne changent pas leurs affectations.

Pour rechercher une question ou une définition à l’intérieur d’une banque, ouvrez cette banque et utilisez ses propres outils de recherche. Le champ de la colonne de gauche sert à retrouver la ressource par son nom.

Dans les vues **Banque de questions**, **Glossaire** et **Balises & renvois**, les boutons **Importer** et **Exporter** se trouvent au-dessus des tuiles. Vous pouvez cocher plusieurs banques ou utiliser **Tout sélectionner** pour exporter un ZIP contenant un classeur XLSX par banque. Chaque classeur peut aussi être réimporté seul. L’import accepte un fichier seul au format de la ressource ou un ZIP de fichiers compatibles ; il crée de nouvelles banques sans remplacer les banques présentes. En cas de noms identiques, un suffixe « (2) », « (3) » est ajouté. Une archive contenant un fichier invalide est refusée entière. Les images des tuiles et les associations aux leçons ou collections ne sont pas transférées.

Pour les **Banques de questions**, un fichier XML Moodle peut aussi être importé seul ou dans un ZIP. L’export groupé produit des XLSX ; l’export XML Moodle se choisit dans le menu d’une banque. **Personnages** conserve son propre format ZIP, avec ses images et ses règles de reprise des identifiants.

Les ressources globales sont gérées séparément du contenu d’une leçon, puis
associées ou copiées dans les projets selon le type de ressource.

Le menu présente les ressources par ordre alphabétique selon la langue active.
La banque **Balises & renvois** centralise les définitions utilisées dans les
renvois des leçons.

## Banque de personnages

La banque de personnages est utilisée notamment par l’activité `Mise en
situation`.

Un personnage peut comprendre :

- un nom ;
- une image ou un aperçu ;
- un rôle ou un métier ;
- une description ;
- plusieurs poses ;
- une pose par défaut.

Les poses peuvent représenter une introduction, une question, une réponse
positive, une réponse négative, une conclusion ou un état neutre.

### Utiliser un personnage

Dans une activité Mise en situation, choisissez le personnage disponible dans la
banque puis associez-le à l’introduction, aux séquences ou à la conclusion.
Vous pouvez choisir une pose différente selon l’étape du scénario.

Un personnage importé dans une activité devient une copie utilisable dans ce
contexte. Les modifications apportées à cette copie n’ont pas nécessairement
d’effet sur les autres activités déjà configurées.

### Gérer les poses

Ajoutez une pose, choisissez son état et importez son image. Les formats PNG,
JPEG et WebP sont acceptés pour les poses personnelles.

Utilisez des images transparentes lorsque le personnage doit se détacher du
décor. Une description utile doit être fournie lorsque l’image apporte une
information importante.

### Partager des personnages avec un autre utilisateur

Dans les tuiles de votre banque personnelle :

1. cochez un ou plusieurs personnages, ou utilisez **Tout sélectionner** ;
2. choisissez **Exporter** et enregistrez le paquet ZIP ;
3. transmettez ce paquet à son destinataire.

Pour recevoir des personnages, choisissez **Importer** puis sélectionnez le ZIP. L'import ajoute les personnages à votre banque sans remplacer les autres. Si un personnage provenant du même export est déjà présent, PAIDEIA affiche obligatoirement trois choix avant de modifier la banque :

- **Mettre à jour** remplace les informations et les images du personnage reconnu par son identifiant unique ;
- **Importer comme copies** ajoute des personnages indépendants avec de nouveaux identifiants ;
- **Annuler** ferme la fenêtre sans importer ni modifier la banque.

Deux personnages portant le même nom mais issus de sources différentes sont conservés séparément : la détection repose sur identifiant technique unique, pas sur le nom.

Les personnages déjà utilisés dans vos leçons ne sont pas modifiés : leur contenu a été copié dans la leçon au moment de leur insertion.

## Banque de questions

La banque de questions permet de préparer des questions réutilisables dans les
quiz, les questions autonomes et l'activité Questions aléatoires. Elle prend en charge les formats suivants :

- QCU ;
- QCM ;
- vrai/faux.

Une question peut comprendre ses réponses, la ou les réponses correctes, un
feedback par réponse, des feedbacks correct et incorrect, un nombre de points,
une catégorie et des tags. Dans la banque, la recherche peut filtrer les
questions par catégorie, tag ou libellé.

Pour un QCM, la notation **Tout ou rien** reste disponible. Le **Crédit
partiel** répartit automatiquement les points entre les bonnes réponses ;
vous pouvez ajuster le pourcentage d’une réponse et les autres sont
rééquilibrés, avec au plus quatre décimales affichées. Une valeur négative,
si vous la saisissez, retire des points lorsqu’elle est choisie. Les points de
la question restent le poids maximal de cette question dans l’évaluation.
Les pénalités Moodle ne sont pas appliquées par PAIDEIA.

### Importer et exporter

L’import d’une banque accepte **XLSX** ou **XML Moodle**. L’export d’une banque propose XLSX ou XML Moodle ; l’export de plusieurs banques produit un ZIP de XLSX. L’ancien format CSV n’est plus utilisé.

Pour importer une banque :

1. ouvrez l’outil de banque de questions ;
2. choisissez le classeur XLSX ou le fichier XML Moodle ;
3. vérifiez les questions et les réponses détectées ;
4. validez l’import.

Pour exporter, utilisez la commande d’export XLSX puis vérifiez le fichier
produit avant de le transmettre ou de le réimporter.

Lors d’un import XML Moodle, les catégories, points, fractions de crédit et
feedbacks attachés aux réponses sont conservés lorsque le type de question
est pris en charge. L’export XML Moodle conserve ces données avec une pénalité
fixée à zéro ; les médias intégrés aux contenus ne sont pas pris en charge.
Pour les QCM **Tout ou rien**, la fenêtre d’export demande de choisir entre
la répartition équitable compatible avec Moodle standard et le type nécessitant
le plugin *All-or-Nothing Multiple Choice* sur Moodle.

Les colonnes répétables des réponses, mots-clés et indications de correction
sont séparées dans la matrice. Les virgules et le caractère `|` peuvent donc
rester du contenu normal.

Les lignes d’exemple identifiées comme telles sont ignorées lors de l’import.
Une question vaut au minimum un point ; une valeur vide, négative ou invalide
est ramenée à 1 point.

### Insérer une question dans un quiz

Depuis l’éditeur du quiz, choisissez une banque, puis éventuellement une
catégorie pour limiter la liste des questions. Sélectionnez les questions à
ajouter. Vérifiez ensuite le texte, les réponses, les feedbacks et le barème
dans le quiz lui-même. Les activités QCM, QCU et Vrai ou faux importent une
seule question ; **Questions aléatoires** utilise la banque ou la catégorie
choisie comme ensemble de tirage.

La question utilisée conserve sa provenance lorsque le projet le permet, mais
elle doit être vérifiée comme un contenu de la leçon avant publication.

## Glossaire

Le **Glossaire** est une ressource destinée à accompagner l’apprenant. Il peut
présenter des définitions ou des explications lorsqu’un terme est recherché.
Son contenu est organisé sous forme de glossaire.

Un glossaire peut comprendre :

- un nom ;
- un avatar ;
- des entrées de glossaire ;
- des alias et termes associés ;
- des réponses de repli ;
- des règles de recherche sur la casse et les accents.

### Préparer une entrée

Pour chaque terme, rédigez une définition claire et autonome. Ajoutez les
formes alternatives, synonymes ou termes associés dans les champs prévus afin
que l’apprenant puisse retrouver l’information sans connaître exactement le
terme canonique.

Une bonne entrée répond à une question courte et renvoie, si nécessaire, vers
une notion ou une activité de la leçon.

### Importer et exporter le glossaire

Les entrées de glossaire sont importées et exportées au format **XLSX**. Les
colonnes des synonymes et termes associés sont distinctes ; il n’est pas
nécessaire d’apprendre un séparateur particulier.

L’export restitue le contenu documentaire en texte lisible. Lors d’une
réimportation, le texte est reconstruit dans des paragraphes Rich Text propres.
Les couleurs, polices et autres mises en forme enrichies ne sont pas conservées
par cette opération.

La commande **Générer un PDF**, dans le menu de la ressource ou dans son éditeur,
produit une version de lecture du glossaire. Ce fichier peut ensuite être ajouté
à une leçon comme document téléchargeable. La génération PDF ne modifie pas la
ressource et ne remplace pas l’export XLSX destiné aux échanges de données.

### Associer un glossaire à une leçon

Associez le glossaire depuis les réglages de ressources de la leçon lorsque ce
choix est disponible. Testez ensuite une recherche avec le terme exact, un
alias, une variation de casse et une variation d’accent.

Le glossaire apprenant reste une fonctionnalité expérimentale : vérifiez ses
réponses, ses dimensions et son comportement dans l’aperçu LMS et le SCORM
avant de le diffuser.

Dans une activité Quiz, le glossaire est désactivé pendant l’évaluation afin de
ne pas fournir une aide non prévue au moment de la notation.

## Balises & renvois

La banque **Balises & renvois** permet de définir un terme une seule fois et de
le réutiliser dans plusieurs leçons. Un renvoi affiche sa définition dans une
infobulle au survol, au focus clavier, au clic ou au toucher.

Par exemple, une banque peut contenir le terme `DGPN` et sa définition. Les
leçons associées peuvent ensuite afficher cette définition depuis un passage
de leur texte. Les balises locales propres à une leçon restent disponibles en
parallèle.

### Créer et préparer une banque

1. Ouvrez **Ressources**, puis **Balises & renvois**.
2. Choisissez **Ajouter une banque** et donnez-lui un nom explicite.
3. Ajoutez vos entrées ou importez une matrice XLSX.
4. Vérifiez chaque mot et sa définition, puis choisissez **Enregistrer**.

Le menu de la tuile permet aussi de choisir une image, de dupliquer la banque
ou de la supprimer après confirmation. Une duplication crée une banque
indépendante.

La commande **Générer un PDF**, également accessible dans l’éditeur, rassemble
les mots et leurs définitions dans un document de lecture. Vous pouvez joindre
ce PDF à une leçon comme fichier téléchargeable ; la matrice XLSX reste le
format à utiliser pour mettre à jour la banque.

### Ajouter ou corriger des entrées par la matrice XLSX

La matrice présente deux colonnes visibles : **Mot** et **Définition**. Une
ligne correspond à une entrée.

Pour mettre à jour une banque existante :

1. Ouvrez la banque concernée et choisissez **Exporter XLSX**.
2. Conservez une copie du classeur avant de le modifier.
3. Corrigez les définitions et ajoutez les nouvelles entrées dans la matrice.
4. Depuis cette même banque, choisissez **Importer XLSX** et sélectionnez le
   classeur corrigé.
5. Vérifiez la liste et la mise en forme, puis choisissez **Enregistrer** pour
   appliquer les modifications aux leçons associées.

L’import remplace la liste d’entrées de la banque sélectionnée par celle du
classeur : conservez les lignes que vous souhaitez garder. Un mot et une
définition sont obligatoires pour chaque entrée.

Conservez la structure du classeur exporté, y compris ses colonnes masquées.
Elles permettent de reconnaître les entrées existantes et de conserver la mise
en forme sauvegardée lorsque le texte visible n’a pas changé. Les mises en
forme ajoutées dans Excel, notamment le gras, l’italique et le soulignement,
sont importées sur les passages concernés ; le reste du texte reste normal.

### Associer la banque et utiliser un renvoi

Dans la banque, cochez les leçons ou les collections concernées, puis
enregistrez. Les leçons associées embarquent leurs définitions : un autre poste
peut utiliser les renvois sans posséder votre banque personnelle.

Dans un champ disposant de la barre Rich Text complète :

1. sélectionnez le passage qui doit porter le renvoi ;
2. choisissez **Insérer un renvoi** ;
3. choisissez l’entrée dans le groupe portant le nom de la banque ;
4. validez, puis vérifiez la définition dans l’aperçu apprenant.

Si plusieurs banques proposent le même terme, vérifiez le nom de la banque et
l’aperçu de la définition avant de choisir la cible. La touche **Échap** ferme
l’infobulle. Un renvoi ne modifie pas la progression LMS.

## Conseils communs

- Donnez des noms explicites aux ressources.
- Préparez une description alternative pour les images informatives.
- Vérifiez une ressource après son import avant de l’utiliser dans une leçon.
- Conservez une copie de vos classeurs XLSX sources.
- Testez les ressources dans le contexte réel de l’activité, pas uniquement dans
  la banque.

## En cas de problème

Si une ressource n’apparaît pas dans un éditeur, vérifiez qu’elle a bien été
importée ou associée au projet courant, puis rechargez la liste.

Si une question importée est incomplète, vérifiez les colonnes du classeur XLSX
et la présence d’une réponse correcte.

Si l’assistant ne retrouve pas un terme, ajoutez son alias ou reformulez
l’entrée avec des mots-clés réellement utilisés par les apprenants.
