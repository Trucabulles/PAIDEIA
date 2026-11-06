export const PAIDEIA_TABLE_INSERT_SIZE = 8;
export const PAIDEIA_TABLE_MAX_ROWS = 32;
export const PAIDEIA_TABLE_MAX_COLUMNS = 32;

/** Native selections can be anchored on TR/TBODY, not just inside TD text. */
export function tableCellsInRange(editor: HTMLElement, range: Range | null): HTMLTableCellElement[] {
  if (!range || !editor.contains(range.commonAncestorContainer)) return [];
  const element = range.startContainer.nodeType === 1
    ? range.startContainer as Element : range.startContainer.parentElement;
  if (range.collapsed) {
    const cell = element?.closest<HTMLTableCellElement>("td,th");
    return cell && editor.contains(cell) ? [cell] : [];
  }
  return Array.from(editor.querySelectorAll<HTMLTableCellElement>("td,th")).filter((cell) => {
    const contents = editor.ownerDocument.createRange();
    contents.selectNodeContents(cell);
    return range.compareBoundaryPoints(1, contents) > 0 && range.compareBoundaryPoints(3, contents) < 0;
  });
}

export type TableCellSlot = {
  cell: HTMLTableCellElement;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
};

export type TableGrid = {
  rows: number;
  columns: number;
  slots: Array<Array<TableCellSlot | null>>;
  anchors: TableCellSlot[];
};

export const PAIDEIA_TABLE_FORMATTING_BEGIN_EVENT = "paideia:table-formatting-begin";
export const PAIDEIA_TABLE_FORMATTING_COMMIT_EVENT = "paideia:table-formatting-commit";
export const PAIDEIA_TABLE_FORMATTING_ROLLBACK_EVENT = "paideia:table-formatting-rollback";

export type TableFormattingTransactionDetail = {
  before: string;
  after?: string;
};

type TableTopology = Array<{
  table: HTMLTableElement;
  rows: Array<{
    row: HTMLTableRowElement;
    cells: Array<{ cell: HTMLTableCellElement; rowSpan: number; colSpan: number }>;
  }>;
}>;

function cleanTableFormattingSnapshot(editor: HTMLElement) {
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".paideia-rich-table-cell-selected").forEach((cell) => {
    cell.classList.remove("paideia-rich-table-cell-selected");
  });
  clone.querySelectorAll('[class=""]').forEach((node) => node.removeAttribute("class"));
  return clone.innerHTML;
}

function captureTableTopology(editor: HTMLElement): TableTopology {
  return Array.from(editor.querySelectorAll<HTMLTableElement>("table")).map((table) => ({
    table,
    rows: Array.from(table.rows).map((row) => ({
      row,
      cells: Array.from(row.cells).map((cell) => ({
        cell,
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan,
      })),
    })),
  }));
}

function tableTopologyIsUnchanged(before: TableTopology, editor: HTMLElement) {
  const tables = Array.from(editor.querySelectorAll<HTMLTableElement>("table"));
  return before.length === tables.length && before.every((entry, tableIndex) => {
    if (entry.table !== tables[tableIndex]) return false;
    const rows = Array.from(entry.table.rows);
    return entry.rows.length === rows.length && entry.rows.every((rowEntry, rowIndex) => {
      if (rowEntry.row !== rows[rowIndex]) return false;
      const cells = Array.from(rowEntry.row.cells);
      return rowEntry.cells.length === cells.length && rowEntry.cells.every((cellEntry, cellIndex) => (
        cellEntry.cell === cells[cellIndex] &&
        cellEntry.rowSpan === cells[cellIndex].rowSpan &&
        cellEntry.colSpan === cells[cellIndex].colSpan
      ));
    });
  });
}

function dispatchTableFormattingEvent(
  editor: HTMLElement,
  type: string,
  detail: TableFormattingTransactionDetail,
) {
  const EventConstructor = editor.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
  editor.dispatchEvent(new EventConstructor(type, { detail }));
}

/** Run a RichBar multi-cell mutation atomically and reject any table-topology change. */
export function runTableFormattingTransaction(editor: HTMLElement, operation: () => void) {
  const rawBefore = editor.innerHTML;
  const before = cleanTableFormattingSnapshot(editor);
  const topology = captureTableTopology(editor);
  dispatchTableFormattingEvent(editor, PAIDEIA_TABLE_FORMATTING_BEGIN_EVENT, { before });
  try {
    operation();
    if (!tableTopologyIsUnchanged(topology, editor)) {
      editor.innerHTML = rawBefore;
      dispatchTableFormattingEvent(editor, PAIDEIA_TABLE_FORMATTING_ROLLBACK_EVENT, { before });
      return false;
    }
    const after = cleanTableFormattingSnapshot(editor);
    dispatchTableFormattingEvent(editor, PAIDEIA_TABLE_FORMATTING_COMMIT_EVENT, { before, after });
    return true;
  } catch (error) {
    editor.innerHTML = rawBefore;
    dispatchTableFormattingEvent(editor, PAIDEIA_TABLE_FORMATTING_ROLLBACK_EVENT, { before });
    throw error;
  }
}

export function createPaideiaTable(rows: number, columns: number) {
  const safeRows = Math.max(1, Math.min(PAIDEIA_TABLE_INSERT_SIZE, rows));
  const safeColumns = Math.max(1, Math.min(PAIDEIA_TABLE_INSERT_SIZE, columns));
  const wrapper = document.createElement("div");
  wrapper.className = "paideia-rich-table-wrapper";
  wrapper.setAttribute("data-paideia-rich-table-wrapper", "true");
  const table = document.createElement("table");
  table.className = "paideia-rich-table paideia-rich-table--simple";
  table.setAttribute("data-paideia-rich-table", "true");
  table.setAttribute("data-paideia-table-width", "75");
  table.setAttribute("data-paideia-table-border-mode", "grid");
  table.setAttribute("data-paideia-table-border-width", "1");
  const colgroup = document.createElement("colgroup");
  for (let column = 0; column < safeColumns; column += 1) colgroup.append(document.createElement("col"));
  const body = document.createElement("tbody");
  for (let row = 0; row < safeRows; row += 1) {
    const tr = document.createElement("tr");
    for (let column = 0; column < safeColumns; column += 1) {
      const cell = document.createElement("td");
      cell.innerHTML = "<p><br></p>";
      tr.append(cell);
    }
    body.append(tr);
  }
  table.append(colgroup, body);
  syncTableBorderEdges(table);
  wrapper.append(table);
  return { wrapper, table };
}

export function tableGrid(table: HTMLTableElement): TableGrid {
  const rows = Array.from(table.rows);
  const slots: Array<Array<TableCellSlot | null>> = [];
  const anchors: TableCellSlot[] = [];
  let columnCount = 0;
  rows.forEach((row, rowIndex) => {
    slots[rowIndex] ??= [];
    let columnIndex = 0;
    Array.from(row.cells).forEach((cell) => {
      while (slots[rowIndex][columnIndex]) columnIndex += 1;
      const rowSpan = Math.max(1, cell.rowSpan || 1);
      const columnSpan = Math.max(1, cell.colSpan || 1);
      const slot = { cell, row: rowIndex, column: columnIndex, rowSpan, columnSpan };
      anchors.push(slot);
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        slots[rowIndex + rowOffset] ??= [];
        for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
          slots[rowIndex + rowOffset][columnIndex + columnOffset] = slot;
        }
      }
      columnIndex += columnSpan;
      columnCount = Math.max(columnCount, columnIndex);
    });
  });
  return { rows: rows.length, columns: columnCount, slots, anchors };
}

export function syncTableBorderEdges(table: HTMLTableElement) {
  const grid = tableGrid(table);
  let changed = false;
  grid.anchors.forEach((slot) => {
    const expected = {
      top: slot.row === 0,
      right: slot.column + slot.columnSpan === grid.columns,
      bottom: slot.row + slot.rowSpan === grid.rows,
      left: slot.column === 0,
    };
    (Object.entries(expected) as Array<[keyof typeof expected, boolean]>).forEach(([edge, enabled]) => {
      const attribute = `data-paideia-table-edge-${edge}`;
      const present = slot.cell.hasAttribute(attribute);
      if (enabled && !present) {
        slot.cell.setAttribute(attribute, "true");
        changed = true;
      } else if (!enabled && present) {
        slot.cell.removeAttribute(attribute);
        changed = true;
      }
    });
  });
  return changed;
}

export function ensureTableBorderEdges(root: ParentNode) {
  let changed = false;
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    if (syncTableBorderEdges(table)) changed = true;
  });
  return changed;
}

export function expandedTableSelection(table: HTMLTableElement, start: HTMLTableCellElement, end: HTMLTableCellElement) {
  const grid = tableGrid(table);
  const startSlot = grid.anchors.find((slot) => slot.cell === start);
  const endSlot = grid.anchors.find((slot) => slot.cell === end);
  if (!startSlot || !endSlot) return [];
  let top = Math.min(startSlot.row, endSlot.row);
  let left = Math.min(startSlot.column, endSlot.column);
  let bottom = Math.max(startSlot.row + startSlot.rowSpan - 1, endSlot.row + endSlot.rowSpan - 1);
  let right = Math.max(startSlot.column + startSlot.columnSpan - 1, endSlot.column + endSlot.columnSpan - 1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let row = top; row <= bottom; row += 1) {
      for (let column = left; column <= right; column += 1) {
        const slot = grid.slots[row]?.[column];
        if (!slot) continue;
        const nextTop = Math.min(top, slot.row);
        const nextLeft = Math.min(left, slot.column);
        const nextBottom = Math.max(bottom, slot.row + slot.rowSpan - 1);
        const nextRight = Math.max(right, slot.column + slot.columnSpan - 1);
        if (nextTop !== top || nextLeft !== left || nextBottom !== bottom || nextRight !== right) {
          top = nextTop; left = nextLeft; bottom = nextBottom; right = nextRight; changed = true;
        }
      }
    }
  }
  return grid.anchors.filter((slot) =>
    slot.row >= top && slot.column >= left &&
    slot.row + slot.rowSpan - 1 <= bottom && slot.column + slot.columnSpan - 1 <= right
  ).map((slot) => slot.cell);
}

export function tableRowCells(table: HTMLTableElement, cell: HTMLTableCellElement) {
  const grid = tableGrid(table);
  const anchor = grid.anchors.find((slot) => slot.cell === cell);
  if (!anchor) return [];
  return Array.from(new Set(
    Array.from({ length: grid.columns }, (_, column) => grid.slots[anchor.row]?.[column]?.cell)
      .filter((candidate): candidate is HTMLTableCellElement => Boolean(candidate))
  ));
}

export function tableColumnCells(table: HTMLTableElement, cell: HTMLTableCellElement) {
  const grid = tableGrid(table);
  const anchor = grid.anchors.find((slot) => slot.cell === cell);
  if (!anchor) return [];
  return Array.from(new Set(
    Array.from({ length: grid.rows }, (_, row) => grid.slots[row]?.[anchor.column]?.cell)
      .filter((candidate): candidate is HTMLTableCellElement => Boolean(candidate))
  ));
}

export function allTableCells(table: HTMLTableElement) {
  return tableGrid(table).anchors.map((slot) => slot.cell);
}

export function mergeTableCells(table: HTMLTableElement, cells: HTMLTableCellElement[]) {
  if (cells.length < 2) return false;
  const grid = tableGrid(table);
  const selected = grid.anchors.filter((slot) => cells.includes(slot.cell));
  if (!selected.length) return false;
  const top = Math.min(...selected.map((slot) => slot.row));
  const left = Math.min(...selected.map((slot) => slot.column));
  const bottom = Math.max(...selected.map((slot) => slot.row + slot.rowSpan - 1));
  const right = Math.max(...selected.map((slot) => slot.column + slot.columnSpan - 1));
  const expanded = expandedTableSelection(table, selected[0].cell, selected[selected.length - 1].cell);
  if (expanded.length !== cells.length || !expanded.every((cell) => cells.includes(cell))) return false;
  const owner = grid.slots[top]?.[left]?.cell;
  if (!owner) return false;
  const extraHtml = selected.filter((slot) => slot.cell !== owner)
    .map((slot) => slot.cell.innerHTML)
    .filter((html) => html.replace(/<br\s*\/?\s*>|<p>|<\/p>|&nbsp;/gi, "").trim())
    .join("<p><br></p>");
  if (extraHtml) owner.insertAdjacentHTML("beforeend", extraHtml);
  selected.forEach((slot) => { if (slot.cell !== owner) slot.cell.remove(); });
  owner.rowSpan = bottom - top + 1;
  owner.colSpan = right - left + 1;
  return true;
}

function insertCellAt(row: HTMLTableRowElement, logicalColumn: number, cell: HTMLTableCellElement) {
  const table = row.closest("table");
  if (!(table instanceof HTMLTableElement)) return;
  const grid = tableGrid(table);
  const rowIndex = row.rowIndex;
  const next = grid.anchors.find((slot) => slot.row === rowIndex && slot.column >= logicalColumn)?.cell;
  row.insertBefore(cell, next ?? null);
}

export function splitTableCell(table: HTMLTableElement, cell: HTMLTableCellElement) {
  const grid = tableGrid(table);
  const slot = grid.anchors.find((entry) => entry.cell === cell);
  if (!slot || (slot.rowSpan === 1 && slot.columnSpan === 1)) return false;
  const tag = cell.tagName.toLowerCase();
  cell.rowSpan = 1;
  cell.colSpan = 1;
  for (let row = slot.row; row < slot.row + slot.rowSpan; row += 1) {
    const targetRow = table.rows[row];
    if (!targetRow) continue;
    for (let column = slot.column; column < slot.column + slot.columnSpan; column += 1) {
      if (row === slot.row && column === slot.column) continue;
      const next = document.createElement(tag) as HTMLTableCellElement;
      next.innerHTML = "<p><br></p>";
      const following = grid.anchors.find((entry) => entry.row === row && entry.column > column)?.cell;
      targetRow.insertBefore(next, following ?? null);
    }
  }
  return true;
}

export function canSplitTableCell(table: HTMLTableElement, cell: HTMLTableCellElement, axis: "horizontal" | "vertical") {
  const grid = tableGrid(table);
  const slot = grid.anchors.find((entry) => entry.cell === cell);
  return Boolean(slot && (axis === "vertical"
    ? slot.columnSpan > 1 || grid.columns < PAIDEIA_TABLE_MAX_COLUMNS
    : slot.rowSpan > 1 || grid.rows < PAIDEIA_TABLE_MAX_ROWS));
}

/** Refine one logical track, spanning its neighbours so only the chosen cell splits. */
export function splitTableCellAlong(table: HTMLTableElement, cell: HTMLTableCellElement, axis: "horizontal" | "vertical") {
  if (!canSplitTableCell(table, cell, axis)) return false;
  const grid = tableGrid(table);
  const target = grid.anchors.find((entry) => entry.cell === cell)!;
  const vertical = axis === "vertical";
  const position = vertical ? "column" : "row";
  const span = vertical ? "columnSpan" : "rowSpan";
  const refine = target[span] === 1;
  if (refine) {
    const boundary = target[position] + 1;
    if (vertical) {
      const group = table.querySelector("colgroup") ?? table.insertBefore(document.createElement("colgroup"), table.firstChild);
      // Preserve authored track proportions; otherwise initialise equal tracks.
      if (group.children.length !== grid.columns || Array.from(group.children).some((col) => !(col as HTMLElement).style.width)) {
        group.replaceChildren(...Array.from({ length: grid.columns }, () => {
          const col = document.createElement("col"); col.style.width = `${100 / grid.columns}%`; return col;
        }));
      }
      const col = group.children[target.column] as HTMLElement;
      const copy = col.cloneNode(true) as HTMLElement;
      const width = col.style.width;
      const match = width.match(/^([\d.]+)(%|px)$/);
      if (match) col.style.width = copy.style.width = `${Number(match[1]) / 2}${match[2]}`;
      else col.style.width = copy.style.width = `calc((${width}) / 2)`;
      group.insertBefore(copy, col.nextSibling);
    } else {
      const row = table.rows[target.row];
      const height = row.getBoundingClientRect().height;
      const next = document.createElement("tr");
      row.parentNode!.insertBefore(next, row.nextSibling);
      if (height > 0) row.style.height = next.style.height = `${height / 2}px`;
    }
    grid.anchors.forEach((entry) => {
      if (entry[position] >= boundary) entry[position] += 1;
      else if (entry[position] + entry[span] >= boundary) entry[span] += 1;
    });
  }
  const firstSpan = Math.floor(target[span] / 2);
  const next = cell.cloneNode(false) as HTMLTableCellElement;
  next.removeAttribute("id");
  next.classList.remove("paideia-rich-table-cell-selected");
  next.innerHTML = "<p><br></p>";
  const second = { ...target, cell: next, [position]: target[position] + firstSpan, [span]: target[span] - firstSpan };
  target[span] = firstSpan;
  grid.anchors.push(second);
  grid.anchors.sort((a, b) => a.row - b.row || a.column - b.column).forEach((entry) => {
    entry.cell.rowSpan = entry.rowSpan;
    entry.cell.colSpan = entry.columnSpan;
    table.rows[entry.row].append(entry.cell);
  });
  syncTableBorderEdges(table);
  return true;
}

function splitTableCellSelection(
  table: HTMLTableElement,
  cells: HTMLTableCellElement[],
  split: (cell: HTMLTableCellElement) => boolean,
) {
  const targets = [...new Set(cells)].filter((cell) => table.contains(cell));
  const results: HTMLTableCellElement[] = [];
  targets.forEach((cell) => {
    if (!table.contains(cell)) return;
    const before = new Set(tableGrid(table).anchors.map((entry) => entry.cell));
    if (!split(cell)) return;
    results.push(cell);
    tableGrid(table).anchors.forEach((entry) => {
      if (!before.has(entry.cell)) results.push(entry.cell);
    });
  });
  return [...new Set(results)];
}

export function splitTableCellsAlong(
  table: HTMLTableElement,
  cells: HTMLTableCellElement[],
  axis: "horizontal" | "vertical",
) {
  // Simulate the complete selection first, since one split can refine tracks
  // shared by later targets. Never leave a partially split live table.
  const anchors = tableGrid(table).anchors.map((entry) => entry.cell);
  const targets = [...new Set(cells)].filter((cell) => anchors.includes(cell));
  const probe = table.cloneNode(true) as HTMLTableElement;
  const probeCells = tableGrid(probe).anchors.map((entry) => entry.cell);
  for (const cell of targets) {
    if (!splitTableCellAlong(probe, probeCells[anchors.indexOf(cell)], axis)) return [];
  }
  return splitTableCellSelection(table, cells, (cell) => splitTableCellAlong(table, cell, axis));
}

export function splitTableCells(table: HTMLTableElement, cells: HTMLTableCellElement[]) {
  return splitTableCellSelection(table, cells, (cell) => splitTableCell(table, cell));
}

export function setTableHeaderRow(table: HTMLTableElement, enabled: boolean) {
  const row = table.rows[0];
  if (!row) return false;
  if (enabled && row.parentElement !== table.tHead) {
    const head = table.tHead ?? table.createTHead();
    head.append(row);
  } else if (!enabled && row.parentElement === table.tHead) {
    const body = table.tBodies[0] ?? table.createTBody();
    body.prepend(row);
    if (!table.tHead?.rows.length) table.tHead?.remove();
  }
  Array.from(row.cells).forEach((cell) => {
    const replacement = document.createElement(enabled ? "th" : "td");
    Array.from(cell.attributes).forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
    replacement.innerHTML = cell.innerHTML;
    if (enabled) replacement.scope = "col";
    else replacement.removeAttribute("scope");
    cell.replaceWith(replacement);
  });
  return true;
}

export function setTableHeaderColumn(table: HTMLTableElement, enabled: boolean) {
  const grid = tableGrid(table);
  grid.anchors.filter((slot) => slot.column === 0).forEach((slot) => {
    const replacement = document.createElement(enabled ? "th" : "td");
    Array.from(slot.cell.attributes).forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
    replacement.innerHTML = slot.cell.innerHTML;
    if (enabled) replacement.scope = "row";
    else replacement.removeAttribute("scope");
    slot.cell.replaceWith(replacement);
  });
  return true;
}

export function addTableRow(table: HTMLTableElement, reference: HTMLTableCellElement, after: boolean, index?: number) {
  const grid = tableGrid(table);
  if (grid.rows >= PAIDEIA_TABLE_MAX_ROWS) return false;
  const slot = grid.anchors.find((entry) => entry.cell === reference);
  if (!slot) return false;
  const insertion = index ?? (after ? slot.row + slot.rowSpan : slot.row);
  const row = table.insertRow(insertion);
  for (let column = 0; column < grid.columns; column += 1) {
    const crossing = grid.slots[insertion]?.[column];
    if (crossing && crossing.row < insertion && crossing.row + crossing.rowSpan > insertion) {
      if (column === crossing.column) crossing.cell.rowSpan += 1;
      continue;
    }
    const cell = document.createElement(row.parentElement === table.tHead ? "th" : "td");
    if (cell.tagName === "TH") cell.scope = "col";
    cell.innerHTML = "<p><br></p>";
    row.append(cell);
  }
  return true;
}

export function addTableColumn(table: HTMLTableElement, reference: HTMLTableCellElement, after: boolean, index?: number) {
  const grid = tableGrid(table);
  if (grid.columns >= PAIDEIA_TABLE_MAX_COLUMNS) return false;
  const slot = grid.anchors.find((entry) => entry.cell === reference);
  if (!slot) return false;
  const insertion = index ?? (after ? slot.column + slot.columnSpan : slot.column);
  for (let row = 0; row < grid.rows; row += 1) {
    const crossing = grid.slots[row]?.[insertion];
    if (crossing && crossing.column < insertion && crossing.column + crossing.columnSpan > insertion) {
      if (row === crossing.row) crossing.cell.colSpan += 1;
      continue;
    }
    const targetRow = table.rows[row];
    const cell = document.createElement(targetRow.parentElement === table.tHead ? "th" : "td");
    if (cell instanceof HTMLTableCellElement && cell.tagName === "TH") cell.scope = "col";
    cell.innerHTML = "<p><br></p>";
    insertCellAt(targetRow, insertion, cell);
  }
  const colgroup = table.querySelector("colgroup");
  if (colgroup) colgroup.insertBefore(document.createElement("col"), colgroup.children[insertion] ?? null);
  return true;
}

export function deleteTableRow(table: HTMLTableElement, reference: HTMLTableCellElement, index?: number) {
  const grid = tableGrid(table);
  if (grid.rows <= 1) return false;
  const slot = grid.anchors.find((entry) => entry.cell === reference);
  if (!slot) return false;
  const target = index ?? slot.row;
  grid.anchors.forEach((entry) => {
    const end = entry.row + entry.rowSpan - 1;
    if (entry.row < target && end >= target) entry.cell.rowSpan -= 1;
    else if (entry.row === target && entry.rowSpan > 1) {
      entry.cell.rowSpan -= 1;
      const nextRow = table.rows[target + 1];
      if (nextRow) insertCellAt(nextRow, entry.column, entry.cell);
    }
  });
  table.deleteRow(target);
  if (!table.tHead?.rows.length) table.tHead?.remove();
  return true;
}

export function deleteTableColumn(table: HTMLTableElement, reference: HTMLTableCellElement, index?: number) {
  const grid = tableGrid(table);
  if (grid.columns <= 1) return false;
  const slot = grid.anchors.find((entry) => entry.cell === reference);
  if (!slot) return false;
  const target = index ?? slot.column;
  grid.anchors.forEach((entry) => {
    const end = entry.column + entry.columnSpan - 1;
    if (entry.column < target && end >= target) entry.cell.colSpan -= 1;
    else if (entry.column === target) {
      if (entry.columnSpan > 1) entry.cell.colSpan -= 1;
      else entry.cell.remove();
    }
  });
  const cols = table.querySelectorAll("colgroup col");
  cols[target]?.remove();
  return true;
}

export function selectedTableTracks(table: HTMLTableElement, cells: HTMLTableCellElement[], axis: "row" | "column") {
  const selected = new Set(cells);
  const tracks = new Set<number>();
  tableGrid(table).anchors.filter((entry) => selected.has(entry.cell)).forEach((entry) => {
    const span = axis === "row" ? entry.rowSpan : entry.columnSpan;
    for (let offset = 0; offset < span; offset++) tracks.add(entry[axis] + offset);
  });
  return [...tracks].sort((a, b) => a - b);
}

export function insertSelectedTableTracks(table: HTMLTableElement, cells: HTMLTableCellElement[], axis: "row" | "column", after: boolean) {
  const tracks = selectedTableTracks(table, cells, axis);
  const grid = tableGrid(table);
  const size = axis === "row" ? grid.rows : grid.columns;
  const limit = axis === "row" ? PAIDEIA_TABLE_MAX_ROWS : PAIDEIA_TABLE_MAX_COLUMNS;
  if (!tracks.length || size + tracks.length > limit) return false;
  const boundary = after ? tracks[tracks.length - 1] + 1 : tracks[0];
  for (let offset = 0; offset < tracks.length; offset++) {
    const reference = tableGrid(table).anchors[0].cell;
    if (axis === "row") addTableRow(table, reference, after, boundary + offset);
    else addTableColumn(table, reference, after, boundary + offset);
  }
  return true;
}

export function deleteSelectedTableTracks(table: HTMLTableElement, cells: HTMLTableCellElement[], axis: "row" | "column") {
  const tracks = selectedTableTracks(table, cells, axis);
  if (!tracks.length) return false;
  const grid = tableGrid(table);
  if (tracks.length === (axis === "row" ? grid.rows : grid.columns)) {
    (table.closest(".paideia-rich-table-wrapper") ?? table).remove();
    return true;
  }
  for (const index of tracks.reverse()) {
    const reference = tableGrid(table).anchors[0].cell;
    if (axis === "row") deleteTableRow(table, reference, index);
    else deleteTableColumn(table, reference, index);
  }
  return true;
}

export function ensureTableCaretParagraphs(root: HTMLElement) {
  let changed = false;
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    const wrapper = table.closest<HTMLElement>(".paideia-rich-table-wrapper");
    const host = wrapper && root.contains(wrapper) ? wrapper : table;
    const parent = host.parentNode;
    if (!parent) return;
    const isTableBoundary = (node: Element | null) => Boolean(
      node?.matches("table, .paideia-rich-table-wrapper")
    );
    if (!host.previousElementSibling || isTableBoundary(host.previousElementSibling)) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      parent.insertBefore(paragraph, host);
      changed = true;
    }
    if (!host.nextElementSibling || isTableBoundary(host.nextElementSibling)) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      parent.insertBefore(paragraph, host.nextSibling);
      changed = true;
    }
  });
  return changed;
}

const TABLE_CELL_BLOCK_BOUNDARY_SELECTOR =
  "p, div, h1, h2, h3, h4, h5, blockquote, ul, ol, table, hr";

/** Give direct text/inline runs in legacy or imported cells a real Rich Text block. */
export function ensureTableCellTextBlocks(cell: HTMLTableCellElement) {
  let changed = false;
  let inlineRun: Node[] = [];

  const flushInlineRun = () => {
    if (!inlineRun.length) return;
    const hasContent = inlineRun.some((node) =>
      Boolean(node.textContent?.replace(/[\u200B\u00A0]/g, "").trim()) ||
      (node instanceof Element && node.matches("br, img, video, audio, svg, canvas"))
    );
    if (hasContent) {
      const block = document.createElement("div");
      cell.insertBefore(block, inlineRun[0]);
      inlineRun.forEach((node) => block.appendChild(node));
      changed = true;
    }
    inlineRun = [];
  };

  Array.from(cell.childNodes).forEach((node) => {
    if (node instanceof Element && node.matches(TABLE_CELL_BLOCK_BOUNDARY_SELECTOR)) {
      flushInlineRun();
      return;
    }
    inlineRun.push(node);
  });
  flushInlineRun();
  return changed;
}

export function clipboardDataRepresentsTableMatrix(
  html: string,
  plainText: string,
  hasExplicitPaideiaMarker: boolean
) {
  if (hasExplicitPaideiaMarker) return /<table(?:\s|>)/i.test(html);
  return plainText.includes("\t");
}

export function cleanRichTableEditorState(root: ParentNode) {
  root.querySelectorAll(".paideia-rich-table-cell-selected").forEach((cell) => cell.classList.remove("paideia-rich-table-cell-selected"));
  root.querySelectorAll("[data-paideia-table-editor-only]").forEach((node) => node.remove());
}
