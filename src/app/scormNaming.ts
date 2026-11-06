const WINDOWS_RESERVED_FILE_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9"
]);

export function sanitizeScormBatchFileStem(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u2500+/g, " ")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .trim()
    .replace(/[-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 90)
    .replace(/-+$/g, "");
  const fallback = normalized || "lecon";
  return WINDOWS_RESERVED_FILE_NAMES.has(fallback.toLowerCase()) ? `${fallback}-lecon` : fallback;
}

export function timestampForScormName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}${pad(date.getMonth() + 1)}${date.getFullYear()}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function scormArchiveFileName(title: string, date = new Date()) {
  return `${sanitizeScormBatchFileStem(title)}_${timestampForScormName(date)}.zip`;
}

export function timestampForPaideiaArchiveName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function paideiaArchiveFileName(title: string, date = new Date()) {
  return `${sanitizeScormBatchFileStem(title)}_${timestampForPaideiaArchiveName(date)}.paideia`;
}
