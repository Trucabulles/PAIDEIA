export type VttCue = {
  id: string;
  identifier: string;
  start: string;
  end: string;
  settings: string;
  text: string;
};

export type VttDocument = {
  header: string;
  metadataBlocks: string[];
  cues: VttCue[];
};

const TIMING_LINE = /^(\S+)\s+-->\s+(\S+)(?:\s+(.*))?$/;
const TIMESTAMP = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/;

export function parseVttTimestamp(value: string): number | null {
  const match = value.trim().match(TIMESTAMP);
  if (!match) {
    return null;
  }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  return (((hours * 60 + minutes) * 60 + seconds) * 1000) + milliseconds;
}

export function formatVttTimestamp(milliseconds: number): string {
  const safeValue = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safeValue / 3_600_000);
  const minutes = Math.floor((safeValue % 3_600_000) / 60_000);
  const seconds = Math.floor((safeValue % 60_000) / 1000);
  const fraction = safeValue % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(3, "0")}`;
}

export function parseVtt(source: string): VttDocument {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const firstBlock = blocks.shift() ?? "";
  const firstLines = firstBlock.split("\n");
  if (!firstLines[0]?.startsWith("WEBVTT")) {
    throw new Error("INVALID_HEADER");
  }

  const header = firstLines[0].slice("WEBVTT".length).trim();
  const metadataBlocks: string[] = [];
  if (firstLines.length > 1) {
    metadataBlocks.push(firstLines.slice(1).join("\n"));
  }
  const cues: VttCue[] = [];

  blocks.forEach((block, index) => {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => TIMING_LINE.test(line.trim()));
    if (timingIndex < 0 || timingIndex > 1) {
      metadataBlocks.push(block);
      return;
    }
    const timing = lines[timingIndex].trim().match(TIMING_LINE);
    if (!timing) {
      metadataBlocks.push(block);
      return;
    }
    cues.push({
      id: `cue-${index}-${Math.random().toString(36).slice(2, 9)}`,
      identifier: timingIndex === 1 ? lines[0].trim() : "",
      start: timing[1],
      end: timing[2],
      settings: timing[3]?.trim() ?? "",
      text: lines.slice(timingIndex + 1).join("\n")
    });
  });

  return { header, metadataBlocks, cues };
}

export function serializeVtt(document: VttDocument): string {
  const blocks = [
    `WEBVTT${document.header ? ` ${document.header}` : ""}`,
    ...document.metadataBlocks.filter(Boolean),
    ...document.cues.map((cue) => {
      const timing = `${cue.start.trim()} --> ${cue.end.trim()}${cue.settings.trim() ? ` ${cue.settings.trim()}` : ""}`;
      return [cue.identifier.trim(), timing, cue.text].filter((line, index) => index !== 0 || Boolean(line)).join("\n");
    })
  ];
  return `${blocks.join("\n\n")}\n`;
}

export function createEmptyVttCue(index: number, previousEnd?: string): VttCue {
  const previousEndMs = previousEnd ? parseVttTimestamp(previousEnd) : null;
  const startMs = previousEndMs ?? index * 3_000;
  return {
    id: `cue-new-${Date.now()}-${index}`,
    identifier: "",
    start: formatVttTimestamp(startMs),
    end: formatVttTimestamp(startMs + 3_000),
    settings: "",
    text: ""
  };
}
