# Whisper pour PAIDEIA

Téléchargez le moteur Windows x64 et l’un des deux modèles multilingues sur la [page de téléchargement Whisper pour PAIDEIA](https://github.com/Trucabulles/PAIDEIA/releases/tag/whisper-v1.9.1).

| Fichier | Usage |
| --- | --- |
| `whisper-bin-x64.zip` | Moteur whisper.cpp 1.9.1 pour Windows x64 |
| `ggml-small.bin` | Modèle Small, 488 Mo environ |
| `ggml-medium.bin` | Modèle Medium, 1,53 Go environ |

1. Décompressez entièrement l’archive du moteur et conservez les DLL avec `whisper-cli.exe`.
2. Dans **Modules complémentaires**, sélectionnez le dossier décompressé pour le **Moteur Whisper**, puis le fichier du modèle dans le champ **Small** ou **Medium**.
3. Configurez aussi FFmpeg pour l’extraction audio. [Téléchargements FFmpeg](../ffmpeg/FFmpeg.txt)

La transcription s’exécute sur votre ordinateur.

## Provenance et licences

- L’archive du moteur est celle de la [release officielle de whisper.cpp 1.9.1](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.1). [Licence MIT du moteur](LICENSE-whisper.cpp.txt)
- Les modèles multilingues d’OpenAI sont convertis au format GGML par le projet whisper.cpp. [Modèles amont](https://huggingface.co/ggerganov/whisper.cpp/tree/13ce9e800d8d6aeab537db9f6d1aa62d3e540c4c) · [Licence MIT des modèles](LICENSE-OpenAI-Whisper.txt)
- L’archive amont contient aussi SDL 2.28.5. [Licence SDL](LICENSE-SDL2.txt)
- [Empreintes SHA-256 des trois fichiers](SHA256SUMS.txt)
