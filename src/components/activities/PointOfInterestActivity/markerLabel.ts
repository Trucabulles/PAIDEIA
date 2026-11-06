const KEYCAP_EMOJI_PATTERN = /[#*0-9]\uFE0F?\u20E3/gu;
const EMOJI_CODE_POINT_PATTERN = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier})/gu;
const EMOJI_JOINER_PATTERN = /[\u200D\uFE0F\u20E3]/gu;

export function sanitizePointOfInterestMarkerLabel(value: string, maxLength = 2) {
  const withoutEmoji = value
    .normalize("NFC")
    .replace(KEYCAP_EMOJI_PATTERN, "")
    .replace(EMOJI_CODE_POINT_PATTERN, "")
    .replace(EMOJI_JOINER_PATTERN, "");

  return Array.from(withoutEmoji).slice(0, maxLength).join("");
}
