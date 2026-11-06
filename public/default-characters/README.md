Banque par défaut des personnages `Mise en situation`.

Convention actuelle :

- les assets embarqués vivent sous `public/default-characters/`
- une pose utilisée dans un scénario référence un chemin relatif de la forme :
  `default-characters/<personnage>/<fichier>.png`
- au rendu application / preview, ce chemin devient :
  `/default-characters/<personnage>/<fichier>.png`
- à l’export SCORM, seuls les fichiers effectivement utilisés sont copiés dans :
  `assets/default-characters/<personnage>/<fichier>.png`

Modèle recommandé pour un personnage :
- `introduction`
- `question`
- `neutral`
- `positive`
- `negative`
- `conclusion`

Le classement visuel peut être libre sur disque ; la vérité fonctionnelle est portée
par le modèle de pose dans l’activité (`state`, `usage`, `emotion`), pas par
l’arborescence seule.

Exemple minimal :
`public/default-characters/axel/introduction.png`
`public/default-characters/axel/question.png`
`public/default-characters/axel/positive.png`
`public/default-characters/axel/negative.png`
`public/default-characters/axel/conclusion.png`

Fallback runtime :

- `positive` absent -> `neutral`
- `negative` absent -> `neutral`
- `question` absent -> `neutral`