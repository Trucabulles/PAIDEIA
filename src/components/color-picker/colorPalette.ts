export type ColorFamily = {
  id: string;
  labelKey: string;
  base: string;
  shades: [string, string, string, string, string];
};

export const SYSTEM_COLOR_PALETTE: ColorFamily[] = [
  { id: "neutral", labelKey: "color.neutral", base: "#FFFFFF", shades: ["#FFFFFF", "#F5F5F5", "#E5E7EB", "#D1D5DB", "#9CA3AF"] },
  { id: "slate", labelKey: "color.slate", base: "#374151", shades: ["#F3F4F6", "#D1D5DB", "#9CA3AF", "#6B7280", "#374151"] },
  { id: "black", labelKey: "color.black", base: "#111111", shades: ["#E5E5E5", "#B3B3B3", "#737373", "#404040", "#111111"] },
  { id: "brown", labelKey: "color.brown", base: "#7B6157", shades: ["#F2EAE7", "#DCCBC3", "#C0A79C", "#9E7F72", "#7B6157"] },
  { id: "cyan", labelKey: "color.cyan", base: "#1F97AE", shades: ["#DFF6FA", "#AEE4ED", "#73CDDC", "#3FB5C6", "#1F97AE"] },
  { id: "blue", labelKey: "color.blue", base: "#1D7DDC", shades: ["#E8F3FF", "#B9DBFF", "#7CB9FF", "#4198F0", "#1D7DDC"] },
  { id: "purple", labelKey: "color.purple", base: "#5E46D9", shades: ["#EEEAFE", "#D0C7FA", "#A998F0", "#8169E6", "#5E46D9"] },
  { id: "magenta", labelKey: "color.magenta", base: "#9B3AB9", shades: ["#F5E8F8", "#E4C4EE", "#CF94DF", "#B962CB", "#9B3AB9"] },
  { id: "pink", labelKey: "color.pink", base: "#D61F63", shades: ["#FCE8EF", "#F7BDD0", "#F084A8", "#E74B82", "#D61F63"] },
  { id: "green", labelKey: "color.green", base: "#35A443", shades: ["#E8F7EA", "#BFE6C5", "#87CF91", "#56B764", "#35A443"] },
  { id: "emerald", labelKey: "color.emerald", base: "#059669", shades: ["#DDF8F0", "#A7E9D2", "#66D0A8", "#2DBB84", "#059669"] },
  { id: "yellow", labelKey: "color.yellow", base: "#F0C419", shades: ["#FFF8DE", "#FDEEB0", "#F9DD6A", "#F5CF35", "#F0C419"] },
  { id: "orange", labelKey: "color.orange", base: "#F08C00", shades: ["#FFF4D6", "#FFE39A", "#FFD14D", "#F8B400", "#F08C00"] },
  { id: "red", labelKey: "color.red", base: "#E53935", shades: ["#FDE7E7", "#F7BBBB", "#EF8381", "#E95552", "#E53935"] }
];
