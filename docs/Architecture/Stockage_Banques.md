# Stockage individuel des banques personnelles

Le stockage version 2 concerne les banques de questions, les glossaires des assistants et les banques de balises et renvois. Il conserve les dossiers racines des ressources et les identifiants métier existants.

## Organisation

Dans chaque famille :

- `index.json` : annuaire léger des banques ;
- `banks/<SHA-256 de l’identifiant>/bank.json` : contenu complet d’une banque ;
- `descriptor.json`, dans le même dossier : métadonnées, affectations, vignette et compteur pour reconstruire l’annuaire ;
- les fichiers de vignette ou d’avatar, dans le dossier de leur banque ;
- `bank.previous.json` : version précédente avant une modification du contenu ;
- `deleted/` : banques retirées du catalogue, conservées pour récupération.

L’identifiant original reste dans les documents. Son empreinte sert uniquement au nom du dossier pour éviter les collisions et les traversées de chemins. Les HTML et images base64 des définitions restent dans le JSON individuel. Aucun catalogue actif ne contient ces contenus détaillés.

Les commandes `resource_bank_catalog`, `resource_bank_load`, `resource_bank_save`, `resource_bank_delete` et `resource_bank_image` séparent la présentation des tuiles des opérations portant sur une banque. L’interface charge le contenu lors de l’ouverture, de la duplication, de l’export ou de la sélection depuis un Quiz. Les opérations groupées chargent les seules banques sélectionnées. Les noms, compteurs, affectations et vignettes sont disponibles sans ouvrir leurs contenus.

Les écritures passent par un fichier temporaire vérifié et synchronisé, puis un renommage. La banque fait autorité ; les descripteurs et l’index sont reconstructibles. Une erreur de lecture est signalée et n’autorise pas le remplacement silencieux d’une banque par un contenu vide. Les jonctions et liens internes menant à d’autres emplacements sont refusés.

## Chargement et validation

Les questions et entrées de glossaire sont préparées repliées avant le premier affichage : leurs formulaires détaillés ne sont pas construits puis immédiatement retirés. Les filtres et résumés des questions sont mémorisés tant que leurs données ne changent pas. Le chargement ne déplace pas les tuiles ; la modale de progression habituelle apparaît seulement si l’attente dépasse 350 ms.

Le nettoyage HTML réutilise sa configuration. Les longues séquences base64 des images PNG, JPEG et WebP sont remplacées temporairement par des marqueurs uniques conservant le schéma et le type MIME. Le nettoyage des balises, attributs et liens reste actif. Seuls les marqueurs survivant au nettoyage sont rétablis, sans changer les images stockées. Les données JSON déjà disponibles sont nettoyées directement.

Dans les leçons, la validation d’un titre de chapitre conserve la valeur saisie à l’écran pendant l’enregistrement. Elle attend les validations des champs riches et fusionne uniquement le titre confirmé dans l’état courant. Une réponse ancienne ne remplace pas les autres blocs ni une autre leçon ; un échec est signalé et la dernière valeur confirmée reste disponible. Les sauvegardes évitent les nettoyages et relectures complets redondants, tout en conservant les contrôles d’intégrité et d’accès collaboratif. Les fichiers détaillés et banques de références inchangés ne sont pas réécrits.

## Validation des champs texte et historique

Les validations directes des champs riches conservent leur texte soumis dans un état de session identifié par projet, bloc, élément et champ. Cet état survit au démontage de l'éditeur : un titre d'onglet ou d'accordéon reste visible après validation, et un contenu rouvert avant le retour de sauvegarde reprend sa dernière valeur soumise. Les réponses anciennes ne peuvent pas retirer une validation plus récente. En cas d'échec, le texte reste récupérable pendant la session et l'erreur est signalée ; cela ne constitue pas une sauvegarde sur disque.

Les champs enregistrés directement capturent aussi leur dernière saisie avant un démontage qui précéderait la validation différée de perte de focus, notamment pendant un changement de diapositive. Les champs du formulaire d'activité gardent leur validation locale et leur annulation habituelle. Les valeurs en attente servent à l'affichage et ne sont pas injectées dans l'état persistant utilisé pour comparer les modifications.

La commande `create_inline_snapshot` utilise la même création, protection des médias et rétention que les autres instantanés, mais renvoie seulement la liste des instantanés. Elle évite la relecture complète de la leçon et le transfert de tout son contenu après chaque validation. Les instantanés restent attendus dans la file des validations ; aucune protection de récupération n'est supprimée. Les autres usages de `create_snapshot` conservent leur réponse complète.

`node scripts/verify-editor-state-safety.mjs` couvre les titres d'onglets et d'accordéons fermés puis rouverts, les validations successives et erreurs, les champs retirés avant leur validation différée, l'annulation d'un formulaire et la fusion des réponses d'historique après changement de leçon. Les tests Rust des instantanés vérifient également la restauration des contenus HTML et des médias avec le retour allégé.

## Catalogue des leçons et ouverture

Le catalogue des leçons lit uniquement les métadonnées utiles aux tuiles et la structure nécessaire aux compteurs. Il ne charge ni les banques de références ni les objets riches des activités et ne nettoie pas leurs HTML. Les champs de contenu sont ignorés pendant la lecture du résumé ; les contrôles complets restent dans le chargement normal de la leçon. La découverte reste confinée au dossier `projects` de la bibliothèque active, sans suivre les liens et jonctions ; les contrôles de révocation et de version restent appliqués.

Les résumés de compteurs sont conservés uniquement en mémoire, avec une limite de 256 projets. Ils sont invalidés par la taille ou la date de modification de `content/course.json`. Les métadonnées sont relues, afin de refléter immédiatement un renommage, les mots-clés et la vignette. Aucun index supplémentaire n'est enregistré dans les projets. Les commandes de catalogue s'exécutent hors de la boucle native de l'interface pour éviter de retarder les images et les autres réponses.

L'ouverture d'une leçon ne relit plus le catalogue lors de la mise à jour des onglets et des accès récents. L'arrivée dans Leçons et les opérations qui changent réellement la bibliothèque continuent de l'actualiser. Le chargement des chapitres reste inchangé. La localisation partage les objets inchangés plutôt que de copier les banques et de sérialiser deux fois le projet complet. Les demandes de liste de polices sont dédupliquées pendant leur exécution ; les réponses périmées d'une autre leçon sont ignorées. La modale reste affichée jusqu'à la disponibilité des polices de la leçon active.

Le lanceur dev transmet une configuration temporaire dans `target/debug/dev-webview-runtime.json`, qui référence le runtime fixe du dossier source par son chemin absolu. Cela évite la résolution de son chemin relatif depuis l'exécutable debug. La configuration de release conserve son chemin de runtime embarqué.

Les tests `library_catalog` vérifient l'actualisation des compteurs, les formats de chapitres historiques, les métadonnées, les restrictions de version et la révocation. Le test de mesure optionnel `benchmark_library_readonly` compare les compteurs sur une bibliothèque existante sans modifier ses fichiers. `npm run test:project-language` vérifie la conservation des données auteur, le partage des banques inchangées, les demandes de polices dédupliquées et les réponses arrivant après un changement de leçon.

## Migration des formats version 1

Les anciens fichiers `question-bank.json`, `assistant-bank.json` et `reference-bank.json` sont reconnus directement. Aucun export XLSX n’est nécessaire. La conversion conserve les identifiants des banques, questions et entrées, les HTML, réglages, révisions et affectations. Les vignettes et avatars sont copiés et contrôlés dans leurs dossiers individuels ; les anciennes ressources sont conservées pour la reprise.

La conversion prépare et vérifie tous les documents avant la bascule. Un lancement interrompu peut être repris sans duplication. Le fichier source est conservé, octet pour octet, sous un nom `<nom-original>.<identifiant>.legacy` après conversion complète. `migration-v1.json` contient uniquement les identifiants et empreintes nécessaires à la reconnaissance des sources converties.

Un ancien catalogue restauré est encore détecté après une migration antérieure. Une banque identique ou dont seule l’ancienne source a évolué peut être reprise. En cas de conflit avec une banque modifiée depuis la conversion, l’opération s’arrête, conserve les deux versions et signale le conflit. Elle n’écrase pas automatiquement le travail récent.

**Le convertisseur version 1 doit rester disponible sur plusieurs versions successives.** Aucun retrait n’est programmé : sa suppression exige une décision explicite sur les formats encore pris en charge et les utilisateurs qui sautent des mises à jour.

## Projets et sauvegardes

Les formats des copies déjà intégrées aux projets ne changent pas. Les banques de balises et renvois des projets restent dans `resources/reference-banks/` ; les copies de questions et de glossaires déjà présentes dans les projets restent lisibles. Les affectations chargent les banques concernées et copient leurs ressources nécessaires au projet. Un projet partagé ne dépend pas du catalogue personnel de son auteur pour afficher ses contenus.

La sauvegarde d’un catalogue doit inclure le dossier entier de chaque famille : annuaire, banques, images, versions précédentes et fichiers de migration. Copier seulement `index.json` ne sauvegarde pas les contenus. Les instantanés et exports des projets continuent de transporter leurs propres copies.

Avant une récupération ou un retour à une ancienne version, conserver une copie complète du catalogue. Restaurer une source `.legacy` sous son nom original permet de retrouver l’état antérieur dans une ancienne application ; cela ne convertit pas à rebours les modifications réalisées ensuite dans les fichiers individuels. Ces fichiers doivent être conservés pour reprendre le travail récent avec la nouvelle version.

## Vérifications

`npm run test:individual-banks` vérifie les lectures à la demande, les enregistrements individuels et la conservation des brouillons indépendants. Les tests Rust `resource_bank_store::tests` vérifient les trois migrations, les images, la reprise après interruption, les conflits de restauration, la récupération de l’index, l’isolement des fichiers corrompus et le confinement des chemins. Les tests existants de formats XLSX, paquets ZIP et affectations collaboratives complètent ces contrôles.

`npm run test:resource-performance` vérifie le premier affichage replié de grandes banques et l’ouverture individuelle des formulaires. Les tests du nettoyage HTML comparent le résultat optimisé au nettoyage complet, y compris avec des attributs dangereux et de grandes images. Les tests de stabilité des éditeurs couvrent les validations de titres en attente, les réponses tardives, les erreurs et les changements de leçon.
