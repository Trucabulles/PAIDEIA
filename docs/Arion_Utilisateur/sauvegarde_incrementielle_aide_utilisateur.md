<!-- arion:meta {"title":"Sauvegarde incrémentielle automatique","aliases":["sauvegarde incrémentielle","sauvegarde automatique","copies automatiques","backups"],"sections":{"Sauvegarde incrémentielle automatique":{"aliases":["à quoi sert la sauvegarde incrémentielle"],"keywords":["archive","sécurité","paideia"]},"Activer et régler la sauvegarde":{"aliases":["fréquence incrémentielle","intervalle de sauvegarde"],"keywords":["15 minutes","60 minutes","paramètres"]},"Emplacement et nom des sauvegardes":{"aliases":["où sont les sauvegardes","dossier backups"],"keywords":["bibliothèque","numéro","horodatage"]},"Restaurer une sauvegarde incrémentielle":{"aliases":["récupérer une sauvegarde automatique","ouvrir un backup"],"keywords":["importer","archive paideia","restauration"]},"Limites à connaître":{"aliases":["sauvegarde non déclenchée"],"keywords":["lecture seule","leçon ouverte","opération en cours"]}}} -->

# Sauvegarde incrémentielle automatique

La sauvegarde incrémentielle crée périodiquement une nouvelle archive complète `.paideia` de la leçon ouverte. Malgré son nom, chaque fichier est autonome : il n’est pas nécessaire de posséder les sauvegardes précédentes pour le réimporter.

Ces copies de sécurité n’écrasent pas les précédentes et ne remplacent pas une archive volontairement conservée avant une opération importante.

## Activer et régler la sauvegarde

Dans **Paramètres de l’application** :

1. activez **Sauvegarde incrémentielle automatique** ;
2. réglez **Fréquence incrémentielle** avec le curseur ;
3. choisissez un intervalle compris entre 15 et 60 minutes.

Le délai est compté pendant qu’une leçon modifiable reste ouverte. Si PAIDEIA exécute déjà une autre opération au moment prévu, cette occurrence est ignorée afin d’éviter deux traitements concurrents.

## Emplacement et nom des sauvegardes

Les fichiers sont enregistrés dans le sous-dossier `backups` du dossier utilisateur actif :

```text
<dossier utilisateur>\backups
```

Le nom contient le titre de la leçon, un numéro croissant et un horodatage. Par exemple :

```text
ma-lecon_03_20260911_143500.paideia
```

Changer l’emplacement du dossier utilisateur déplace également ce dossier avec la bibliothèque.

## Restaurer une sauvegarde incrémentielle

Une sauvegarde n’apparaît pas comme une leçon ordinaire dans **Toutes les leçons**. Pour la récupérer :

1. ouvrez le menu principal ;
2. choisissez **Importer une leçon PAIDEIA** ;
3. ouvrez le dossier `backups` de votre dossier utilisateur ;
4. sélectionnez l’archive correspondant à la date souhaitée ;
5. vérifiez la leçon importée avant de reprendre le travail.

L’import crée une leçon éditable à partir de l’archive ; il ne remplace pas silencieusement la leçon actuellement ouverte.

## Limites à connaître

La sauvegarde incrémentielle ne s’exécute pas :

- sur l’accueil, dans **Toutes les leçons** ou dans **Ressources** ;
- lorsqu’aucune leçon n’est ouverte ;
- sur une leçon ouverte en lecture seule ;
- pendant une autre opération occupante de PAIDEIA.

Les archives restent dans `backups` tant qu’elles ne sont pas supprimées. Surveillez donc périodiquement l’espace disque disponible.
