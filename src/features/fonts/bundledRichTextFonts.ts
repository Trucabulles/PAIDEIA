/**
 * Polices PAIDEIA réservées à la mise en forme locale depuis la RichBar.
 * Elles ne doivent jamais alimenter le sélecteur de police globale de leçon.
 */
export const BUNDLED_RICH_TEXT_ONLY_FONTS = [
  { id: "annie-use-your-telescope", family: "Annie Use Your Telescope" },
  { id: "cormorant-garamond", family: "Cormorant Garamond" },
  { id: "permanent-marker", family: "Permanent Marker" },
  { id: "spectral", family: "Spectral" }
] as const;
