<!-- arion:meta {"title":"Menu sandwich et paramètres de PAIDEIA","aliases":["menu sandwich","paramètres application","sauvegarde automatique","emplacement bibliothèque"],"sections":{"Menu sandwich et paramètres de PAIDEIA":{"aliases":[],"keywords":[]},"Leçons et fichiers":{"aliases":[],"keywords":[]},"Préférences":{"aliases":[],"keywords":[]},"Emplacement du dossier utilisateur":{"aliases":["emplacement de la bibliothèque","changer le dossier utilisateur","déplacer la bibliothèque"],"keywords":["dossier","bibliothèque","migration","leçons","ressources"]},"Paramétrer les favoris":{"aliases":["nombre d'activités favorites","raccourcis d'activités","barre des favoris"],"keywords":["favoris","raccourcis","activités","réorganiser"]},"Modules complémentaires":{"aliases":[],"keywords":[]},"Informations et aide":{"aliases":[],"keywords":[]}}} -->

# Menu sandwich et paramètres de PAIDEIA

Le menu sandwich, dans la barre principale de PAIDEIA, regroupe les commandes de l’application. Il ne modifie pas le contenu d’une leçon tant qu’une action précise n’est pas lancée.

## Leçons et fichiers

- **Nouvelle leçon** crée un nouveau projet.
- **Importer une leçon PAIDEIA** ouvre une archive `.paideia`.
- **Importer un SCORM** ouvre un paquet SCORM `.zip` compatible.
- **Leçons récentes** permet de rouvrir rapidement un projet utilisé récemment.

## Préférences

- **Emplacement de la bibliothèque** définit le dossier utilisateur dans lequel PAIDEIA conserve ses leçons et ses ressources locales.
- **Langue** change la langue de l’interface.
- **Sauvegarde automatique** active ou désactive l’enregistrement périodique.
- **Fréquence de sauvegarde** règle l’intervalle lorsqu’elle est active.
- **Nombre d’activités favorites** règle la taille de la barre de raccourcis de création dans l’éditeur.

## Emplacement du dossier utilisateur

Dans `Paramètres de l’application`, la zone **Emplacement de la bibliothèque** affiche le dossier utilisateur actuellement employé par PAIDEIA. Ce dossier regroupe la bibliothèque locale et les ressources qui lui sont associées.

Pour le changer :

1. cliquez sur **Modifier** ;
2. sélectionnez un dossier accessible en écriture ;
3. confirmez la migration de la bibliothèque vers ce nouvel emplacement ;
4. attendez le message **Bibliothèque déplacée** avant de poursuivre.

La sélection d’un nouveau dossier ne crée pas une seconde bibliothèque vide : PAIDEIA propose de déplacer la bibliothèque active. Si vous refusez la confirmation, l’emplacement reste inchangé. Une fois la migration terminée, PAIDEIA revient à l’accueil et recharge les leçons depuis le nouveau dossier.

Ne choisissez pas un dossier situé à l’intérieur de la bibliothèque actuelle, son dossier parent direct ni un dossier interne de l’application. Avant une migration importante, conservez une archive `.paideia` des leçons indispensables.

## Paramétrer les favoris

Le réglage **Nombre d’activités favorites** définit combien de raccourcis peuvent apparaître dans la barre de création rapide d’une leçon. Le curseur accepte une valeur de `0` à `20` : `0` masque tous les favoris, tandis qu’une valeur plus élevée permet d’en conserver davantage.

Si vous réduisez cette limite, les favoris placés au-delà du nouveau nombre sont retirés de la barre. Ils ne réapparaissent pas automatiquement si vous augmentez ensuite la limite.

Pour choisir ou réorganiser les activités affichées, ouvrez une leçon puis utilisez le menu contextuel de la barre des favoris. Le réglage du menu principal fixe uniquement le nombre maximal de raccourcis ; il ne choisit pas leur type ni leur ordre.

## Modules complémentaires

Le menu permet de configurer les outils locaux nécessaires à certaines fonctions média : **FFmpeg** pour le traitement vidéo et **Whisper** pour la transcription locale. PAIDEIA vérifie les chemins sélectionnés et signale les configurations incomplètes.

## Informations et aide

Les entrées d’information donnent accès au guide utilisateur livré avec PAIDEIA, à la version, au changelog, à la licence et au signalement de bug. Le guide s’ouvre dans le lecteur PDF habituel de l’ordinateur et reste disponible hors connexion. Les commandes de configuration peuvent être retirées depuis ce même menu lorsque cela est proposé.
