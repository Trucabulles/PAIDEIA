<!-- arion:meta {"title":"Instantanés et restauration","aliases":["instantané","snapshot","restaurer une version","point de restauration"],"sections":{"Instantanés et restauration":{"aliases":[],"keywords":[]},"Quand l’utiliser":{"aliases":[],"keywords":[]},"Créer et restaurer":{"aliases":[],"keywords":[]},"À retenir":{"aliases":[],"keywords":[]}}} -->

# Instantanés et restauration

Un instantané est un point de restauration du projet à un moment donné. Il permet de revenir à un état antérieur après une modification importante ou une opération difficile à annuler.

## Quand l’utiliser

Créer un instantané avant une transformation importante, un collage complexe, une suppression ou une opération en masse. PAIDEIA en crée aussi automatiquement avant certaines mutations sensibles.

Les instantanés sont conservés dans le projet. Ils ne remplacent pas une archive PAIDEIA : l’archive sert à transporter ou sauvegarder le projet complet, tandis que l’instantané sert à revenir rapidement à un état précédent du projet courant.

## Créer et restaurer

Utiliser la commande des instantanés pour créer un **Instantané manuel**. La liste indique la date, l’heure et la raison de chaque point de restauration.

Choisir un instantané puis **Restaurer**. PAIDEIA présente une confirmation, crée d’abord un point de restauration de l’état courant, puis rétablit le contenu, l’ordre des activités et les fichiers associés : images, sons, vidéos, sous-titres, documents et dossiers HTML personnalisés.

La restauration agit sur le projet courant. Elle ne supprime pas l’archive PAIDEIA déjà exportée et ne constitue pas une publication LMS.

## À retenir

Un projet conserve un nombre limité d’instantanés afin de rester léger. Pour conserver durablement une étape, exporter également une archive PAIDEIA avec un nom explicite.
