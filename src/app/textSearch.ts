import type { GlossaryAssistantResource } from "../types/project";

export function formatDateTime(value: string, locale?: string) {
  try {
    return new Intl.DateTimeFormat(locale || navigator.language || "fr-FR", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatLibraryDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(value)) + " à " + new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeAssistantQueryValue(value: string, assistant: GlossaryAssistantResource) {
  let next = value.trim();
  if (assistant.caseInsensitive) {
    next = next.toLocaleLowerCase("fr-FR");
  }
  if (assistant.ignoreAccents) {
    next = next.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }
  return next;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assistantQueryContainsValue(query: string, value: string) {
  if (!query || !value) {
    return false;
  }
  if (query === value) {
    return true;
  }
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(value)}([^\\p{L}\\p{N}]|$)`, "u").test(query);
}

function assistantDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1).fill(0);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }
  return previous[right.length];
}

function assistantWords(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function findAssistantEntries(assistant: GlossaryAssistantResource, query: string) {
  const normalizedQuery = normalizeAssistantQueryValue(query, assistant);
  if (!normalizedQuery) {
    return [];
  }
  const candidates = assistant.entries.map((entry) => {
    const term = normalizeAssistantQueryValue(entry.term, assistant);
    const aliases = entry.aliases.map((value) => normalizeAssistantQueryValue(value, assistant)).filter(Boolean);
    const values = [term, ...aliases].filter(Boolean);
    return { entry, values };
  });

  const byId = new Map<string, { entry: GlossaryAssistantResource["entries"][number]; score: number }>();
  const addMatch = (entry: GlossaryAssistantResource["entries"][number], score: number) => {
    const current = byId.get(entry.id);
    if (!current || score < current.score) {
      byId.set(entry.id, { entry, score });
    }
  };

  for (const candidate of candidates) {
    if (candidate.values.includes(normalizedQuery)) {
      addMatch(candidate.entry, 1);
    }
  }

  for (const candidate of candidates) {
    if (candidate.values.some((value) => assistantQueryContainsValue(normalizedQuery, value))) {
      addMatch(candidate.entry, 2);
    }
  }

  const queryWords = assistantWords(normalizedQuery);
  for (const candidate of candidates) {
    if (
      candidate.values.some((value) => {
        const valueWords = assistantWords(value);
        return queryWords.some((queryWord) => valueWords.includes(queryWord));
      })
    ) {
      addMatch(candidate.entry, 3);
    }
  }

  if (assistant.fuzzyEnabled) {
    const threshold = Math.max(0, assistant.fuzzyThreshold || 1);
    const fuzzyQueryWords = queryWords.filter((word) => word.length >= 4);
    for (const candidate of candidates) {
      if (!candidate.entry.fuzzy) {
        continue;
      }
      if (
        candidate.values.some((value) => {
          const valueWords = assistantWords(value).filter((word) => word.length >= 4);
          return fuzzyQueryWords.some((queryWord) =>
            valueWords.some(
              (valueWord) =>
                Math.abs(valueWord.length - queryWord.length) <= threshold &&
                assistantDistance(valueWord, queryWord) <= threshold
            )
          );
        })
      ) {
        addMatch(candidate.entry, 4);
      }
    }
  }

  return Array.from(byId.values())
    .sort((left, right) => left.score - right.score || left.entry.term.localeCompare(right.entry.term, "fr"))
    .map((match) => match.entry);
}
