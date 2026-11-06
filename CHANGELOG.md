# Changelog PAIDEIA

## 1.1.26310 - 6 novembre 2026

- PAIDEIA fonctionne en local, sans compte ni service distant. Les fonctions collaboratives ne font pas partie de cette édition.
- Nouvelle licence « PAIDEIA — sources ouvertes », consultable en français et en anglais.
- La fenêtre Informations présente les liens vers le guide, le journal des modifications et les notices de licence.

## 1.0.26308 - 4 novembre 2026

- Partagez une leçon avec ses banques de ressources complètes et leurs images. Le destinataire peut les ajouter à ses Ressources sans écraser ses banques.
- Arrondissez les coins des images intégrées au texte et choisissez lesquelles les apprenants peuvent agrandir.
- Un double-clic sur une archive utilise la fenêtre PAIDEIA déjà ouverte.
- Le choix « Aucun » retire le dégradé du bandeau et reste enregistré.

## 1.0.26283 - 10 octobre 2026

- Ajustements divers sur le circuit labels et mots-clés
- Correction du circuit d'importation des polices personnalisées qui empêchait l'import des polices au format otf, woff et wff2. En cas de police invalide, la police invalide est rejetée avec un message explicite. Les polices personnalisées ne sont plus appliquées par défaut mais peuvent être choisies comme police par défaut du cours. Plusieurs polices personnalisées peuvent exister dans un projet et sont accessibles dans le sélecteur de police de la barre de texte.
- Ajout du lien vers la liste des licences des composants tiers et des polices embarquées pour plus de visibilité. Ce lien est accessible dans la rubrique information du menu principal de PAIDEIA.

## 1.0.26280 - 7 octobre 2026

- La gestion interne des ressources a été optimisée. Les banques existantes sont automatiquement migrées vers le nouveau format, sans changement des imports et exports.
- Les leçons peuvent être triées par nom ou par dernière modification, avec un choix mémorisé.
- Ajout de la recherche par nom dans les Ressources, limitée à la famille affichée, et du tri au choix par nom ou par dernière modification. Le choix de tri est mémorisé séparément pour chaque famille de ressources.
- Corrections et optimisations diverses.


## 1.0.26276 - 3 octobre 2026

- L'ajout de mots-clefs est disponible sur les tuiles des leçons par le menu […]  de chaque tuile. Ces mots-clefs fonctionnent avec la barre de recherche et les filtres accessibles par les […] situés à droite dans la barre de recherche. Un gestionnaire de mots-clefs est disponible. 
- Il est maintenant possible de renommer les labels et de personnaliser leur couleur (clic droit pour éditer, clic pour renommer, double clic pour changer la couleur).
- Ajout de la génération du support PDF pour l'apprenant.
- Ajout de l'export PDF du glossaire.
- Ajout de l'export PDF des balises & renvois.
- L'ajout de questions par catégorie est maintenant possible dans les activités utilisant les banques de questions.
- L'import et l'export de banques de questions au format XML Moodle sont maintenant possibles (les pénalités ne sont pas gérées dans PAIDEIA). 
- Ajout du crédit partiel dans le calcul du résultat des questions (poids de chaque réponse dans une question, par défaut le poids est homogène).
- Ajout des activités Question à choix multiple, Question à choix unique et Vrai ou faux : une question autonome, à saisir ou à importer depuis une banque, avec nombre de tentatives et affichage de la correction et des feedbacks configurables, sans seuil de réussite.
- Ajout de l'activité Questions aléatoires : choix d'une banque, du nombre de questions à tirer et du mélange des questions ou des réponses ; les questions sont présentées l'une après l'autre, sans écran de démarrage ni résultat global.
- L'import d'un SCORM issu d'un logiciel tiers* conserve les banques de questions et les crée dans les ressources. L'importateur ne concatène plus les questions isolées dans un quiz unique.
- Pour plus de lisibilité, la ressource assistant apprenant est renommé en "Glossaire"
- PAIDEIA supporte maintenant une résolution minimale de 1266*768.
- Correction du mode annotation qui empêchait l'accès à certaines de ses commandes (flou..).

## 1.0.26271 - 28 septembre 2026

- Le nouveau circuit de rendu PDF pour la relecture est utilisé pour un rendu plus proche des activités.
- Le mode collaboratif est masqué par défaut et n'est accessible qu'avec le fichier de configuration managée.

## 1.0.26270 - 27 septembre 2026

- Fiabilisations de divers mécanismes.
- Il est possible d'ajouter des vignettes dans les balises et renvois insérés à depuis les ressources. L'import et l'export xlsx gère ces vignettes (max. 300x300 pixels).

## 1.0.26263 - 20 septembre 2026

- Fiabilisation des instantanés et du mécanisme de restauration.
- L’activité En-tête est maintenant mieux intégrée lorsque l’option « Masquer le bandeau du titre des chapitres » est activée dans les paramètres de la leçon.

## 1.0.26262 - 19 septembre 2026

- Mise à jour du moteur de rendu Webview2
- Amélioration du circuit d'habilitation du mode https (changer son mot passe, changer son application OTP, récupérer son compte...)
- Arion permet maintenant de cibler des chapitres pour les modifications d'activités. Il permet aussi de supprimer en masse des activités dans toute la leçon ou dans un ou plusieurs chapitres.

## 1.0.26261 - 18 septembre 2026

- Ajout de la correction dans l'activité "Texte à Compléter".

## 1.0.26259 - 16 septembre 2026

- Ajout de la banque "balises et renvois" dans les ressources. Il est maintenant possible d'insérer des renvois depuis cette banque.

## 1.0.26256 - 13 septembre 2026

- Ajout de pictogrammes supplémentaires dans l'activité Note.
- Intégration optionnelle de la collaboration HTTPS, sélectionnable à la place du mode UNC/SMB.
- Ajout du partage serveur des projets et des observations, avec authentification FreeOTP, droits, baux d’édition et cache de consultation hors connexion.
- Séparation stricte des rattachements HTTPS et UNC/SMB et possibilité de supprimer localement une ancienne copie collaborative.
- Ajout des procédures versionnées de déploiement et de mise à jour du service HTTPS.
- Ajout d'un protocole web pour la collaboration réseau.

## 1.0.26255 - 12 septembre 2026

- Ajout de la duplication de chapitre.
- Ajout d'un système de notes pour la relecture et le pilotage des projets collaboratifs et individuels. Les notes peuvent être exportées en PDF.
- Arion peut maintenant sortir de la fenêtre principale de l'application (clic droit sur le bouton Arion ou commandes écrites — voir l'aide pour en savoir plus).


## 1.0.26253 - 11 septembre 2026

- Ajout d'un fonction de collaboration réseau en lecture ou écriture avec identification préalable (voir aide collaboration réseau).

## 1.0.26252 - 9 septembre 2026

- L'aide de PAIDEIA est intégralement accessible depuis l'assistant Arion.
- Mise à jour de l’interface d’Arion : panneau de conversation plus lisible, en-tête et saisie toujours accessibles, historique indépendant, aide documentaire structurée et accès discret aux actions fréquentes.
- Arion : échanges plus fluides pour les modifications en masse, conservation des paramètres déjà exprimés, réponses d’annulation naturelles et davantage de variété dans les réponses sociales.

## 1.0.26251 - 8 septembre 2026

- Mise à jour de l’interface d’Arion : panneau de conversation plus lisible, en-tête et saisie toujours accessibles, historique indépendant, aide documentaire structurée et accès discret aux actions fréquentes.
- Arion : échanges plus fluides pour les modifications en masse, conservation des paramètres déjà exprimés, réponses d’annulation naturelles et davantage de variété dans les réponses sociales.
- Aperçu LMS et SCORM : navigation des chapitres sous forme de capsule affichant le chapitre courant et sa progression, dépliable vers le bas sans déplacer le contenu.
- Tableaux : création jusqu’à 8 × 8, ajouts jusqu’à 32 lignes et 32 colonnes, et scission horizontale ou verticale des cellules. Conservation du positionnement indépendant des bords et fiabilisation de l’annulation dans les cellules vides.
- Amélioration de l'interface des Banques de questions, Assistants et Personnages

## 1.0.26249 - 6 septembre 2026

- Ajout de palettes de couleurs personnalisées pouvant être créées et renommées.
- Ajout d’un sélecteur de couleur TSV, en complément des modes déjà disponibles.
- Amélioration de l’interface du gestionnaire de couleurs.
- Harmonisation de l’onglet Apparence et du fond externe sur davantage d’activités.
- Consolidation de l’éditeur de texte enrichi, notamment des tableaux.
- Ajout de compositions associant un texte enrichi au bouton Sortir de la leçon.
- Les banques de questions et de l’Assistant utilisent désormais un format XLSX plus clair et plus simple à compléter.
- La navigation dans les longues pages est accélérée dans l’éditeur et les Ressources : clic direct dans la piste de défilement et double-clic sur les flèches pour atteindre le haut ou le bas.

## 1.0.26248 - 5 septembre 2026

- Le journal des modifications est désormais accessible directement depuis les informations de PAIDEIA, avec indication de la version et du commit exacts.
- Renforcement de la gestion de l’interligne et de la cohérence du Rich Text entre l’éditeur, l’aperçu LMS et le SCORM.
- Ajout d’un contrôle d’intégrité SHA-256 des archives `.paideia` à l’export et à l’import.
- Amélioration des messages d’erreur d’import SCORM et poursuite de la localisation dans les 30 langues.
- Édition inline étendue et harmonisée pour plusieurs activités, notamment Onglets et Accordéon.
- Renforcement du contrôle des fichiers image importés et amélioration de l’outil d’annotation.

## 1.0.26245 - 2 septembre 2026

- Consolidation importante des tableaux Rich Text : sélection de cellules, lignes, colonnes ou tableau entier, copie multicellule et mise en forme ciblée.
- Amélioration de l’annulation/rétablissement et du collage dans les tableaux.
- Correction du comportement des listes, puces et numéros lors de la mise en forme.

## 1.0.26244 - 1 septembre 2026

- Correction de la progression entre activités et chapitres dans les exports SCORM.
- Le panneau des chapitres SCORM s’ouvre désormais en superposition sans déplacer le contenu.
- Amélioration de l’espacement des activités et du comportement de l’En-tête.
- Ajout de l’interligne compact `0,75` dans la RichBar.
- Amélioration du rematching SCORM, notamment des séparateurs et graphiques.
- Rapport d’import et rapport de durée rendus plus lisibles et structurés.

## 1.0.26243 - 31 août 2026

- Ajout d’une transcription facultative pour les pistes audio et les médias audio des Points d’intérêt.
- Génération locale possible avec Whisper, ou import de transcriptions depuis plusieurs formats de documents.
- Consultation accessible au clavier et compatible avec les lecteurs d’écran.
- Possibilité d’autoriser le téléchargement d’une transcription validée au format RTF.

## 1.0.26242 - 30 août 2026

- Ajout de plusieurs polices décoratives dans la RichBar.
- L’assistant de conception peut modifier les polices des contenus Rich Text ciblés.
- Les activités Séparateur et Séparateur repéré disposent désormais des réglages d’apparence communs.
- Amélioration du rendu et de la typographie de l’activité Citation.
- Les imports SCORM utilisent désormais Inter comme police de leçon lorsque cela est nécessaire.

## 1.0.26239 - 28 août 2026

- Ajout du voile sombre/clair pour les fonds d’activités et l’En-tête.
- Les Points d’intérêt peuvent désormais contenir image, vidéo ou audio dans leurs panneaux.
- Amélioration importante de l’import SCORM des médias et de leur conservation.
- Évolution majeure de l’assistant de conception Arion : commandes en masse, demandes de précisions, prévisualisation, annulation et aide locale déterministe.
- Ajout de commandes Arion pour l’apparence, l’espacement, les couleurs, la vidéo, les fonds et la taille de police.
- Amélioration du comportement responsive des vidéos et sous-titres entre éditeur, aperçu LMS et SCORM.
- Consolidation générale du Rich Text et de la localisation dans les 30 langues.
- Amélioration de l’En-tête, du bandeau de leçon, de Chercher dans l’image et de plusieurs réglages d’apparence.

## 1.0.26238 - 26 août 2026

- Amélioration de l’activité Tri de cartes : empilement visuel, catégories Rich Text, couleurs de contour et feedbacks.
- Renforcement visuel de la RichBar.
- Ajustements de l’interface auteur de Chercher dans l’image.

## 1.0.26237 - 25 août 2026

- Réorganisation des chapitres par glisser-déposer.
- Suppression de l’activité redondante Chapitre suivant au profit de Continuer.
- Amélioration des activités Points d’intérêt et Chercher dans l’image.
- Correction du contraste de certains contenus Rich Text.

## 1.0.26235 - 23 août 2026

- Les blocs Rise de type texte à compléter sont désormais rematchés vers l’activité native Texte à compléter lorsque leur structure le permet.

## 1.0.26234 - 22 août 2026

- Ajout de l’activité bêta Tri de cartes avec catégories, score, tentatives, feedbacks et interactions souris/clavier.
- Prise en charge du Rich Text, des images et de l’apparence des cartes.
- Amélioration responsive de Texte à compléter et de Chercher dans l’image.
- Renforcement de la cohérence entre éditeur, aperçu LMS, SCORM et PDF.

## 1.0.26232 - 21 août 2026

- Stabilisation de l’activité Texte à compléter autour d’un document Rich Text paginé.
- Deux types de réponses peuvent coexister : mot à saisir et liste de choix.
- Gestion des tentatives, du score, de la relecture et de la progression.
- Parité fonctionnelle entre aperçu LMS et export SCORM.
- Localisation complète de l’activité dans les 30 langues.

## 1.0.26231 - 20 août 2026

- Ajout de l’activité native Chercher dans l’image avec zones rectangulaires ou polygonales, score, tentatives et relecture.
- Chaque zone peut contenir titre, gravité, description, risque et correction.
- Amélioration des Flipcards : texte ou image sur chaque face, recadrage, ALT et apparence indépendante.
- Ajout et consolidation de plusieurs fonctions Rich Text : effacement du formatage, styles de paragraphe, fond de champ et gestion des couleurs.
- Ajout d’un sélecteur de polices dans la RichBar, avec polices PAIDEIA, du projet et personnelles.
- Amélioration du gestionnaire de couleurs et de son comportement dans la RichBar.

## 1.0.26230 - 19 août 2026

- Amélioration de la sélection et du caret dans le Rich Text lors des changements de mise en forme.
- La RichBar reflète désormais plus fidèlement les styles réellement appliqués au caret ou à la sélection.
- Les formats de paragraphe et titres H1 à H5 peuvent coexister dans un même champ.
- Les couleurs HEX/RGB personnalisées sont ajoutées automatiquement à la palette.
- Réorganisation visuelle et fonctionnelle de la RichBar.
- Le collage direct d’images externes dans le Rich Text est bloqué afin de préserver la gestion des ressources PAIDEIA.
- Amélioration de la commande Effacer le formatage.

## 1.0.26230 - 18 août 2026

- Correction de l’auto-contraste des Points d’intérêt.
- Correction des identifiants lors de l’import SCORM afin d’éviter qu’une activité importée puisse affecter une autre activité.

## 1.0.26227 - 17 août 2026

- Simplification de l’En-tête grâce à l’auto-height.
- Corrections de l’activité Images multiples, notamment lors de l’ajout et de la suppression de tuiles.

## 1.0.26227 - 14-15 août 2026

- Clarification des formes et libellés de recadrage.
- Amélioration de la bibliothèque des leçons avec distinction entre labels et collections.
- Enrichissement du Rich Text avec balises, renvois internes, accessibilité clavier et meilleure gestion des listes.
- Amélioration de l’En-tête : positionnement du texte, flou, voile et hauteur automatique.
- Ajustements de mise en page de plusieurs activités et harmonisation avec l’aperçu LMS et le SCORM.
- Amélioration de l’import SCORM des listes.

## 1.0.26224 - 12-13 août 2026

- Évolution importante des activités Présentation, Onglets et Images multiples.
- Ajout et harmonisation des réglages d’apparence des activités : couleur ou image de fond, voile, flou, hauteur, fond large et coins.
- Séparation du fond du champ Rich Text et du fond de l’activité Texte.
- Amélioration de la visionneuse d’image, du cadrage des En-têtes et du bandeau de leçon.
- Fusion de l’ancienne activité Image pleine largeur dans l’activité Image avec plusieurs modes de largeur.
- Amélioration de l’import Rise pour les listes, images, notes et présentations.
- Ajout d’une pastille « Sans » dans le sélecteur de couleurs pour retirer explicitement un remplissage ou surlignage.

## 1.0.26222 - 10 août 2026

- Simplification de l’activité Présentation : toutes les diapositives deviennent réordonnables et supprimables.
- Amélioration du rematching des étapes Rise vers Présentation.
- Ajout des réglages d’apparence complets pour Présentation.
- Amélioration du comportement des fonds larges.

## 1.0.26221 - 9-10 août 2026

- Mise en place d’une cascade cohérente entre apparence par défaut, réglages de leçon et réglages locaux d’activité.
- Amélioration du contraste des activités à surface blanche fixe.
- Amélioration du rendu de Note, Quiz, Liens & ressources et plusieurs imports SCORM.
- Amélioration du PDF et de l’aperçu LMS.
- Le fond de l’activité Texte est désormais contrôlé depuis la RichBar.

## 1.0.215 - 3 août 2026

- Ajout d’un journal d’import SCORM détaillé, localisé et consultable après import.
- Ajout de l’activité Liens & ressources.
- Rematching des boutons Rise vers Liens & ressources.
- Ajout d’une couleur de fond globale pour la leçon.
- Ajout de l’activité Images multiples.
- Extension du rematching SCORM aux grilles d’images, accordéons, listes, colonnes de texte et contrôles de connaissances.

## 1.0.26202 - 21 juillet 2026

- Amélioration des préférences de l’application et de la gestion des modules complémentaires.
- Ajout de la génération locale de sous-titres WebVTT avec Whisper.
- Refonte de l’éditeur vidéo et amélioration de l’optimisation via FFmpeg.
- Ajout de profils d’encodage vidéo jusqu’à 2160p, sans agrandissement ni déformation des sources.
- Amélioration de la gestion des sous-titres, du lecteur média et des polices associées.
- Renforcement de l’installeur Windows et des mentions de licences tierces.

## 1.0.26201 - 20 juillet 2026

- Refonte du rendu des sous-titres vidéo et ajout de réglages de fond et de contour.
- Ajout d’un éditeur WebVTT intégré.
- Import des vidéos lourdes rendu plus sûr et plus efficace.
- Ajout d’un optimiseur vidéo facultatif reposant sur FFmpeg externe.
- Ajout de Liberation Sans à la banque de polices.
- Premiers cadrages dédiés aux options d’accessibilité apprenant et à l’audit SCORM 1.2.

## 1.0.26200 - 19 juillet 2026

- Ajout de réglages globaux d’apparence de la leçon : coins, ombres et couleur du texte.
- Amélioration de l’accessibilité et de la typographie du Quiz.
- Amélioration de l’activité Citation.
- Clarification des règles de tentatives et de progression du Quiz.
- Ajout de l’activité Accompagnement pédagogique conditionnée par le résultat d’un Quiz.
- Amélioration de la bibliothèque, des leçons récentes et de la navigation auteur.

## 1.0.26199 - 18 juillet 2026

- Évolution majeure de l’activité Présentation : navigation interne, réorganisation des diapositives, personnalisation et gestion harmonisée des médias.
- Rematching des étapes Rise vers Présentation.
- Harmonisation du rendu de Mise en situation entre éditeur, aperçu LMS et SCORM.
- Amélioration du comportement de l’image pleine largeur et de plusieurs éléments d’interface.
- Adoption d’une couleur neutre pour le texte pédagogique par défaut.

## 1.0.26197 - 16 juillet 2026

- Ajout de l’activité Séparateur repéré avec numérotation arabe, romaine ou alphabétique et rematching des séparateurs numérotés Rise.

## 1.0.26196 - 15 juillet 2026

- Ajout d’un export PDF de relecture avec couverture, sommaire, chapitres, activités et annexes.
- Amélioration de la fidélité du PDF pour le Rich Text, les tableaux, citations, cartes et contenus interactifs.
- Ajout de la gestion des textes alternatifs des images.
- Nettoyage automatique des médias devenus orphelins après remplacement ou suppression.
- Amélioration de l’import Rise des personnages de scénario.

## 1.0.26195 - 14 juillet 2026

- Amélioration des performances d’ouverture et de manipulation des projets.
- Mise en place de limites de rétention pour les instantanés et l’historique d’audit.
- Amélioration du glisser-déposer auteur et du nommage des exports SCORM.
- Amélioration de la création et de l’import de leçons portant des titres identiques.
- Ajout d’une banque de polices de leçon avec import et conversion WOFF2.
- Ajout de l’espacement global et d’un réglage local par activité.
- Poursuite du travail d’accessibilité avec NVDA et formalisation des contrôles à effectuer.

## 0.4.0a - 3 juillet 2026

- Consolidation de l’interface de la leçon, du bandeau et du panneau de paramètres.
- Ajustement des largeurs de plusieurs activités.
- Préparation du suivi LMS/SCORM et du rematching des QCM/QCU Rise vers Quiz.

## 0.4.0a - 4 juin 2026

- Stabilisation continue de l’export SCORM 1.2.
- Renforcement de la cohérence entre aperçu LMS et export SCORM.
- Amélioration du rematching des SCORM Rise, notamment pour les cartes à retourner.

## 0.4.0a - 2 juin 2026

- Passage de la version affichée à `0.4.0a`.
- Poursuite de la structuration du support SCORM 1.2 et du packaging Windows.

## 0.2.0a - 1er juin 2026

- Ajout d’une navigation latérale escamotable dans l’aperçu LMS et le SCORM.
- Première phase de suivi apprenant selon le type d’activité.
- Transmission de l’état SCORM 1.2 avec progression et reprise de session.
- Amélioration de l’import Rise, notamment pour les tailles de police.
- Rapprochement du rendu de l’aperçu LMS et de l’export SCORM.

## 0.2.0a - 31 mai 2026

- Adoption du modèle « dossier projet = travail courant » et `.paideia = archive d’échange`.
- Mise en place de la bibliothèque des projets basée sur les dossiers actifs.
- Les archives `.paideia` sont restaurées dans un dossier projet avant édition.

## 0.1a - 26 mai 2026

- Première alpha fonctionnelle de PAIDEIA : création de contenus linéaires, premières activités, médias, bibliothèque de projets, instantanés, import SCORM, aperçu LMS et export SCORM 1.2.
