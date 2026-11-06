const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAX_PACKAGE_ENTRIES = 500;
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

export function bankFileName(name: string): string {
  return name.replace(/[\\/?%*:|"<>\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").trim() || "banque";
}

export function uniqueBankName(name: string, existing: Set<string>): string {
  const base = name.trim() || "Banque";
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate.toLocaleLowerCase("fr"))) candidate = `${base} (${suffix++})`;
  existing.add(candidate.toLocaleLowerCase("fr"));
  return candidate;
}

export function bankNameFromFile(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Banque";
}

export async function importBankFiles(file: File, extensions: readonly string[]): Promise<File[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "zip") {
    if (!extension || !extensions.includes(extension)) throw new Error(`Format non pris en charge : ${file.name}`);
    if (file.size > MAX_ENTRY_BYTES) throw new Error(`Fichier trop volumineux : ${file.name}`);
    return [file];
  }
  if (file.size > MAX_PACKAGE_BYTES) throw new Error("Archive trop volumineuse.");
  const data = new Uint8Array(await file.arrayBuffer());
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b ||
      !((data[2] === 3 && data[3] === 4) || (data[2] === 5 && data[3] === 6))) {
    throw new Error("Le fichier n’est pas une archive ZIP valide.");
  }
  const { unzipSync } = await import("fflate");
  const names = new Set<string>();
  let expanded = 0;
  let count = 0;
  let contents: Record<string, Uint8Array>;
  try {
    contents = unzipSync(data, { filter: (entry) => {
      const name = entry.name;
      if (!name || name.includes("/") || name.includes("\\") || name === "." || name === ".." ||
          /^[a-z]:/i.test(name) || /[\u0000-\u001f]/.test(name)) {
        throw new Error(`Chemin interdit dans l’archive : ${name}`);
      }
      const lower = name.toLocaleLowerCase("fr");
      if (names.has(lower)) throw new Error(`Fichier en double dans l’archive : ${name}`);
      names.add(lower);
      if (++count > MAX_PACKAGE_ENTRIES) throw new Error("L’archive contient trop de fichiers.");
      const ext = name.split(".").pop()?.toLowerCase();
      if (!ext || !extensions.includes(ext)) throw new Error(`Format non autorisé dans l’archive : ${name}`);
      if (entry.compression !== 0 && entry.compression !== 8) throw new Error(`Compression non prise en charge : ${name}`);
      if (entry.originalSize > MAX_ENTRY_BYTES || entry.originalSize < 0) throw new Error(`Fichier trop volumineux : ${name}`);
      expanded += entry.originalSize;
      if (expanded > MAX_EXPANDED_BYTES) throw new Error("Archive décompressée trop volumineuse.");
      return true;
    } });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Archive ZIP invalide.");
  }
  if (!count) throw new Error("L’archive ne contient aucune banque.");
  let actualExpanded = 0;
  return Object.entries(contents).map(([name, bytes]) => {
    if (bytes.length > MAX_ENTRY_BYTES) throw new Error(`Fichier trop volumineux : ${name}`);
    actualExpanded += bytes.length;
    if (actualExpanded > MAX_EXPANDED_BYTES) throw new Error("Archive décompressée trop volumineuse.");
    return new File([Uint8Array.from(bytes)], name);
  });
}

export async function exportBankPackage(
  banks: readonly { name: string; bytes: Uint8Array }[]
): Promise<number[]> {
  if (!banks.length) throw new Error("Aucune banque sélectionnée.");
  if (banks.length > MAX_PACKAGE_ENTRIES) throw new Error("Trop de banques sélectionnées.");
  const { zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  let total = 0;
  for (const bank of banks) {
    if (bank.bytes.length > MAX_ENTRY_BYTES) throw new Error(`Banque trop volumineuse : ${bank.name}`);
    total += bank.bytes.length;
    if (total > MAX_EXPANDED_BYTES) throw new Error("Export trop volumineux.");
    const name = uniqueBankName(bankFileName(bank.name), used);
    files[`${name}.xlsx`] = bank.bytes;
  }
  const bytes = zipSync(files, { level: 6 });
  if (bytes.length > MAX_PACKAGE_BYTES) throw new Error("Archive produite trop volumineuse.");
  return Array.from(bytes);
}
