<!-- arion:meta {"sections":{"Mise en situation":{"aliases":["situation","scénario","dialogue","jeu de rôle"],"keywords":["personnage","séquence","choix","feedback"]},"Banque de personnages":{"aliases":["personnages","poses","avatar"],"keywords":["importer","image","rôle","métier"]},"Introduction et conclusion":{"aliases":["texte d’introduction","feedback général","fin du scénario"],"keywords":["début","fin","présenter","résumer"]},"Séquences et choix":{"aliases":["question","réponses","propositions","feedback"],"keywords":["situation","dialogue","valider","continuer"]},"Arrière-plan":{"aliases":["fond","décor","image de fond"],"keywords":["couleur","voile","flou","position"]},"Utilisation par l’apprenant":{"aliases":["jouer la situation","répondre au scénario"],"keywords":["choisir","réponse","corriger","recommencer"]},"Activité Mise en situation":{"aliases":[],"keywords":[]},"Structure de l’activité":{"aliases":[],"keywords":[]},"Préparer les personnages":{"aliases":[],"keywords":[]},"Configurer l’introduction":{"aliases":[],"keywords":[]},"Créer une séquence":{"aliases":[],"keywords":[]},"Configurer la conclusion":{"aliases":[],"keywords":[]},"Personnage et poses utilisés dans le parcours":{"aliases":[],"keywords":[]},"Personnaliser l’arrière-plan":{"aliases":[],"keywords":[]},"Conseils de conception":{"aliases":[],"keywords":[]},"Aperçu, SCORM et PDF":{"aliases":[],"keywords":[]},"En cas de problème":{"aliases":[],"keywords":[]},"Choisir un modèle et personnaliser le rendu":{"aliases":["mise en page","thème de scénario","portrait compact","réponses en bas","cadrage du personnage"],"keywords":["panoramique","bandeau","couleur","pose","zoom","pleine largeur"]}}} -->

# Activité Mise en situation

L’activité **Mise en situation** permet de construire un dialogue ou un
scénario à choix. L’apprenant découvre une situation, sélectionne une réponse,
reçoit un feedback, puis poursuit le parcours ou réessaie selon le résultat.

Elle peut utiliser des personnages, plusieurs poses, un décor et du texte
riche pour rendre la scène plus claire et plus immersive.

## Structure de l’activité

Une mise en situation comprend généralement :

- une `Introduction` pour présenter le contexte ;
- une ou plusieurs `Séquences` contenant une situation et des choix ;
- une `Conclusion` pour donner un feedback général ou terminer le scénario.

L’introduction et la conclusion sont facultatives. Une activité vide peut donc
être complétée progressivement dans l’éditeur.

Les séquences sont parcourues dans leur ordre. Cliquez sur `Ajouter une
séquence` pour insérer une nouvelle étape après la dernière séquence.

## Préparer les personnages

Dans la `Banque de personnages`, vous pouvez utiliser un personnage proposé par
PAIDEIA, importer un personnage disponible dans la banque ou ajouter un
personnage personnel. Noor et Véronique sont disponibles dans la banque par défaut.

Pour chaque personnage, vous pouvez renseigner :

- son nom ;
- son rôle ou son métier ;
- une description utile pour l’accessibilité ;
- l’affichage du nom, du rôle ou des deux dans le cartouche au bord de la bulle.

Le cartouche apparaît si la bulle est affichée et que le nom ou le rôle est renseigné.

Une pose correspond à une image du personnage dans un état donné. Les états
peuvent notamment être `Introduction`, `Question / situation`, `Neutre`,
`Réponse positive`, `Réponse négative` ou `Conclusion`.

Pour ajouter une pose personnelle, utilisez `Ajouter une pose question` ou
`Ajouter une pose réponse`, puis choisissez son état et importez son image.
Les formats PNG, JPEG et WebP sont acceptés.

Vous pouvez modifier le libellé d’une pose, remplacer son image ou la supprimer.
La suppression d’un personnage supprime également les poses qui lui sont
associées, après confirmation.

## Configurer l’introduction

Ouvrez la carte `Introduction`, puis :

1. choisissez le personnage de la banque ;
2. choisissez sa pose d’introduction si plusieurs poses sont disponibles ;
3. saisissez le `Texte d’introduction`.

L’apprenant voit ce texte avant de commencer. Le bouton `Commencer` lance la
première séquence du scénario.

Le texte d’introduction accepte la mise en forme proposée par l’éditeur de
texte riche.

## Créer une séquence

Dans une séquence, renseignez :

- le nom du personnage affiché dans cette étape ;
- son rôle ou son métier, si nécessaire ;
- le personnage utilisé depuis la banque ;
- une pose pour la question ou la situation ;
- éventuellement une pose pour une réponse positive et une réponse négative ;
- le `Texte de situation / dialogue`.

Le texte présente le contexte ou la question à laquelle l’apprenant doit
répondre.

### Ajouter les choix

Dans `Choix et feedbacks`, cliquez sur `Ajouter un choix` pour chaque réponse
possible.

Pour chaque choix, saisissez :

- le texte de la réponse proposée ;
- le feedback affiché après la sélection ;
- l’action qui suit ce feedback.

L’action peut être :

- `Continuer` : l’apprenant passe à l’étape suivante ;
- `Essayer encore` : l’apprenant revient à la question pour tenter une autre
  réponse.

Prévoyez un feedback explicatif, y compris pour une bonne réponse. Il permet à
l’apprenant de comprendre pourquoi une réponse est pertinente ou ce qui doit
être corrigé.

## Configurer la conclusion

Dans la carte `Conclusion`, choisissez si nécessaire le personnage et sa pose,
puis saisissez le `Feedback général`.

Après la conclusion, l’apprenant peut utiliser `Recommencer` pour reprendre le
scénario depuis son introduction.

## Personnage et poses utilisés dans le parcours

Pour chaque introduction, séquence ou conclusion, le personnage de la banque
peut être sélectionné séparément. La pose affichée peut également varier selon
l’étape et le résultat du choix.

Si aucune pose spécifique n’est choisie pour une étape, PAIDEIA utilise la
pose compatible disponible dans la banque. Si aucun personnage n’est associé,
la scène peut être affichée sans personnage.

## Choisir un modèle et personnaliser le rendu

Dans **Apparence**, choisissez un modèle à l’aide des vignettes.

- **Classique** place le personnage en pied à gauche, avec la bulle et les réponses à droite.
- **Réponses en bas** cadre le personnage à la taille. Le décor s’arrête au bord de la scène et les réponses apparaissent dessous, sur un fond neutre. Les cartes s’empilent si la largeur manque.
- **Portrait compact** affiche un portrait rond à côté de la bulle, puis les réponses empilées.

Changer de modèle conserve le contenu et les embranchements. Une nouvelle activité commence en largeur normale. Dans **Activité**, le champ **Titre du bandeau**, au-dessus de la banque de personnages, utilise la barre de mise en forme habituelle et reste sur une seule ligne. Le compteur et les points incluent l’introduction et la conclusion.

Dans **Apparence**, réglez séparément la couleur du bandeau et celle des boutons et du cartouche. Le texte et les icônes s’adaptent au contraste du fond. **Couleur par défaut** rétablit les couleurs du thème.

Pour ajuster le cadrage en **Réponses en bas** ou **Portrait compact**, double-cliquez sur le personnage dans l’éditeur, puis faites glisser l’image horizontalement ou verticalement. En **Portrait compact**, utilisez aussi la molette pour zoomer ou dézoomer. Le réglage est mémorisé pour la pose et le modèle.

## Personnaliser l’arrière-plan

Dans l’onglet `Apparence`, vous pouvez régler :

- la couleur de fond ;
- une image de fond ;
- le voile ;
- le flou ;
- le mode `Fond large` ;
- les coins arrondis.

Avec une couleur de fond, PAIDEIA peut afficher un décor graphique derrière le
personnage. Lorsqu’une image de fond est utilisée, ce décor est masqué afin de
laisser l’image s’exprimer pleinement.

Pour ajuster la position verticale d’une image de fond, double-cliquez sur la
scène puis faites-la glisser. Un clic extérieur, la touche `Échap` ou un second
double-clic termine le réglage.

Le déplacement du fond ne modifie ni la position du personnage, ni la largeur
des bulles, ni celle des boutons.

## Utilisation par l’apprenant

L’apprenant suit le scénario étape par étape :

1. il lit l’introduction et clique sur `Commencer` ;
2. il lit la situation ou le dialogue ;
3. il sélectionne une réponse ;
4. il clique sur `Valider` ;
5. il lit le feedback ;
6. il clique sur `Continuer` ou `Essayer encore` selon le résultat.

Une réponse sélectionnée est signalée par un tick vert. Le bouton `Valider`
reste inactif tant qu’aucune réponse n’est sélectionnée.

Le feedback reste visible avant le passage à la suite. Une réponse configurée
avec `Essayer encore` ne fait donc pas avancer le parcours ; elle permet de
relire la situation et de choisir une autre proposition.

## Conseils de conception

- Donnez un objectif clair dès l’introduction.
- Gardez une situation assez courte pour que le choix soit compréhensible.
- Rédigez des réponses de longueur comparable.
- Expliquez le résultat dans chaque feedback plutôt que de vous limiter à
  `Correct` ou `Incorrect`.
- Utilisez des poses cohérentes avec l’état de la scène.
- Décrivez les personnages lorsque leur apparence apporte une information
  utile.
- Vérifiez le parcours dans l’aperçu LMS avant de distribuer la leçon.

## Aperçu, SCORM et PDF

Le personnage, le décor, les bulles, les choix et les feedbacks doivent être
vérifiés dans l’éditeur, l’aperçu LMS et le SCORM.

Dans le PDF de relecture, une pose du personnage est représentée avec
l’introduction, les séquences, les choix, les feedbacks et la conclusion. Les
contenus longs peuvent se poursuivre sur plusieurs pages.

## En cas de problème

Si le personnage n’apparaît pas, vérifiez qu’un personnage est lié à l’étape et
qu’une pose dispose bien d’une image.

Si un choix ne permet pas de poursuivre, vérifiez qu’il possède un feedback et
que son action après feedback est bien réglée.

Si aucune réponse n’est proposée, ajoutez au moins un choix dans la séquence.
Si aucune séquence n’est présente, ajoutez-en une avant la conclusion.
