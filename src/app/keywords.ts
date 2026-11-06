export function keywordKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
}

export function keywordSimilarityKey(value: string): string {
  return keywordKey(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function cleanKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}

export function uniqueKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  return values.map(cleanKeyword).filter((value) => {
    const key = keywordKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rememberKeywords(recent: string[], used: string[]): string[] {
  return uniqueKeywords([...used, ...recent]);
}

export function sidebarKeywords(catalog: string[], pinned: string[], recent: string[], usedFallback: string[]): string[] {
  const available = new Map(catalog.map((keyword) => [keywordKey(keyword), keyword]));
  const resolve = (values: string[]) => uniqueKeywords(values).flatMap((keyword) => {
    const value = available.get(keywordKey(keyword));
    return value ? [value] : [];
  });
  const anchors = resolve(pinned);
  const anchorKeys = new Set(anchors.map(keywordKey));
  const latest = resolve([...recent, ...usedFallback]).filter((keyword) => !anchorKeys.has(keywordKey(keyword))).slice(0, 10);
  const alphabetical = (a: string, b: string) => a.localeCompare(b, "fr-FR");
  return [...anchors.sort(alphabetical), ...latest.sort(alphabetical)];
}
