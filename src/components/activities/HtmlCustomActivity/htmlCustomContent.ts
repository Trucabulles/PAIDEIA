import { translateActive } from "../../../i18n";

export function defaultCustomHtmlContent(
  title = translateActive("htmlCustom.defaultTitle"),
  content = translateActive("htmlCustom.defaultContent")
) {
  return `<div class="activity">
  <h2>${title}</h2>
  <p>${content}</p>
</div>`;
}

export function isDefaultCustomHtmlContent(value?: string | null) {
  const normalized = (value ?? "").trim();
  return normalized === defaultCustomHtmlContent().trim() || normalized === defaultCustomHtmlContent("Titre", "Contenu HTML personnalisé").trim();
}
