import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import gearOffIcon from "../../assets/gear-off.png";
import gearOnIcon from "../../assets/gear-on.png";
import { useI18n } from "../../i18n/react";
import { ColorPickerField } from "../color-picker/ColorPickerPopover";
import { normalizeHex, rgbToHex } from "../color-picker/colorUtils";
import {
  PAIDEIA_TABLE_MAX_ROWS,
  PAIDEIA_TABLE_MAX_COLUMNS,
  addTableColumn,
  addTableRow,
  insertSelectedTableTracks,
  deleteSelectedTableTracks,
  allTableCells,
  clipboardDataRepresentsTableMatrix,
  deleteTableColumn,
  deleteTableRow,
  ensureTableBorderEdges,
  ensureTableCaretParagraphs,
  expandedTableSelection,
  mergeTableCells,
  PAIDEIA_TABLE_FORMATTING_BEGIN_EVENT,
  PAIDEIA_TABLE_FORMATTING_COMMIT_EVENT,
  PAIDEIA_TABLE_FORMATTING_ROLLBACK_EVENT,
  setTableHeaderColumn,
  setTableHeaderRow,
  splitTableCells,
  splitTableCellsAlong,
  syncTableBorderEdges,
  tableColumnCells,
  tableGrid,
  tableRowCells,
  type TableFormattingTransactionDetail,
} from "./tableDom";
import "./RichTextTable.css";
import { anchoredTableResize } from "./tableResize";

const PAIDEIA_TABLE_MATRIX_CLIPBOARD_TYPE = "application/x-paideia-rich-table-matrix";

type RichTextTableControllerProps = {
  getEditor: () => HTMLDivElement | null;
  onChange: () => void;
};

type MenuState = { x: number; y: number; table: HTMLTableElement; cell: HTMLTableCellElement } | null;
type ActiveTableTarget = { table: HTMLTableElement; cell: HTMLTableCellElement } | null;
type TableLauncherPosition = { table: HTMLTableElement; x: number; y: number; visible: boolean };
type TableSubmenu = "select" | "insert" | "delete" | "headers" | "format";
type Snapshot = { before: string; after: string };
type ResizeSession = {
  axis: "column" | "row" | "table-left" | "table-right" | "table-bottom";
  table: HTMLTableElement;
  index: number;
  startPointer: number;
  startSize: number;
  startTableWidth?: number;
  startTableOffset?: number;
  wrapperWidth?: number;
  columnWidths?: number[];
  before: string;
};
type CellDragSession = {
  table: HTMLTableElement;
  anchor: HTMLTableCellElement;
  pointerId: number;
  active: boolean;
};

function cleanTableSnapshot(editor: HTMLElement) {
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".paideia-rich-table-cell-selected").forEach((cell) => {
    cell.classList.remove("paideia-rich-table-cell-selected");
  });
  clone.querySelectorAll('[class=""]').forEach((node) => node.removeAttribute("class"));
  return clone.innerHTML;
}

function cssColorAsHex(value: string, fallback: string) {
  const normalized = normalizeHex(value);
  if (normalized) return normalized;
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return fallback;
  return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3])) ?? fallback;
}

function sanitizedTableCellHtml(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,style,iframe,object,embed,table,form,input,button,textarea,select").forEach((node) => node.remove());
  template.content.querySelectorAll<HTMLElement>("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith("on") || attribute.name === "contenteditable") {
        element.removeAttribute(attribute.name);
      }
    });
    if (element instanceof HTMLAnchorElement && /^\s*javascript:/i.test(element.getAttribute("href") ?? "")) {
      element.removeAttribute("href");
    }
  });
  return template.innerHTML || "<p><br></p>";
}

function clipboardTableMatrix(clipboard: DataTransfer) {
  const html = clipboard.getData("text/html");
  const text = clipboard.getData("text/plain");
  const hasExplicitPaideiaMarker = clipboard.getData(PAIDEIA_TABLE_MATRIX_CLIPBOARD_TYPE) === "1";
  if (html && clipboardDataRepresentsTableMatrix(html, text, hasExplicitPaideiaMarker)) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const table = template.content.querySelector("table");
    if (table) {
      return Array.from(table.rows).map((row) =>
        Array.from(row.cells).map((cell) => sanitizedTableCellHtml(cell.innerHTML))
      );
    }
  }
  // A simple multiline text is rich text for one cell, not a spreadsheet
  // matrix. Only tabular plain text (tabs) is distributed across cells.
  if (!text || !text.includes("\t")) return null;
  return text.replace(/\r\n?/g, "\n").split("\n").filter((line, index, lines) => line || index < lines.length - 1)
    .map((line) => line.split("\t").map((value) => `<p>${value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`));
}

export function RichTextTableController({ getEditor: readEditor, onChange: notifyChange }: RichTextTableControllerProps) {
  const callbacks = useRef({ readEditor, notifyChange });
  callbacks.current = { readEditor, notifyChange };
  const getEditor = useCallback(() => callbacks.current.readEditor(), []);
  const onChange = useCallback(() => callbacks.current.notifyChange(), []);
  const { t } = useI18n();
  const [menu, setMenu] = useState<MenuState>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<TableSubmenu | null>(null);
  const [selectedCells, setSelectedCells] = useState<HTMLTableCellElement[]>([]);
  const [operationError, setOperationError] = useState("");
  const [activeTableTarget, setActiveTableTarget] = useState<ActiveTableTarget>(null);
  const [tableLauncherPositions, setTableLauncherPositions] = useState<TableLauncherPosition[]>([]);
  const anchorRef = useRef<HTMLTableCellElement | null>(null);
  const lastActiveCellRef = useRef<HTMLTableCellElement | null>(null);
  const cellDragRef = useRef<CellDragSession | null>(null);
  const clipboardMatrixRef = useRef<string[][] | null>(null);
  const historyRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const resizeRef = useRef<ResizeSession | null>(null);
  const currentSnapshotRef = useRef("");
  useEffect(() => { setOperationError(""); }, [menu?.table]);

  const activeTable = menu?.table ?? selectedCells[0]?.closest("table") ?? null;
  const activeCell = menu?.cell ?? selectedCells[0] ?? null;
  const grid = useMemo(() => activeTable instanceof HTMLTableElement ? tableGrid(activeTable) : null, [activeTable, selectedCells]);

  const clearSelection = () => {
    getEditor()?.querySelectorAll(".paideia-rich-table-cell-selected").forEach((cell) => cell.classList.remove("paideia-rich-table-cell-selected"));
    setSelectedCells([]);
    anchorRef.current = null;
  };

  const selectCells = (cells: HTMLTableCellElement[]) => {
    selectedCells.forEach((cell) => cell.classList.remove("paideia-rich-table-cell-selected"));
    cells.forEach((cell) => cell.classList.add("paideia-rich-table-cell-selected"));
    setSelectedCells(cells);
  };

  const rememberActiveTableCell = (table: HTMLTableElement, cell: HTMLTableCellElement) => {
    setActiveTableTarget((current) => current?.table === table && current.cell === cell ? current : { table, cell });
  };

  const openTableMenuBesideTable = (table: HTMLTableElement, cell: HTMLTableCellElement) => {
    const editor = getEditor();
    if (!editor || !editor.contains(table) || !table.contains(cell)) return;
    if (!selectedCells.includes(cell)) selectCells([cell]);
    anchorRef.current = cell;
    lastActiveCellRef.current = cell;
    rememberActiveTableCell(table, cell);
    const rect = table.getBoundingClientRect();
    const menuWidth = 320;
    const menuGap = 12;
    const right = rect.right + menuGap;
    const left = rect.left - menuWidth - menuGap;
    const x = right + menuWidth <= window.innerWidth - 12 ? right : Math.max(12, left);
    setMenu({ x, y: rect.top, table, cell });
    setActiveSubmenu(null);
  };

  useEffect(() => {
    const editor = getEditor();
    if (!editor) return;

    const updatePosition = () => {
      const tables = Array.from(editor.querySelectorAll<HTMLTableElement>("table.paideia-rich-table"));
      setTableLauncherPositions(tables.map((table) => {
        const rect = table.getBoundingClientRect();
        return {
          table,
          x: rect.right,
          y: rect.top,
          visible: rect.right >= 0 && rect.left <= window.innerWidth && rect.bottom >= 0 && rect.top <= window.innerHeight
        };
      }));
      setActiveTableTarget((current) => current && editor.contains(current.table) && current.table.contains(current.cell) ? current : null);
    };

    updatePosition();
    const resizeObserver = new ResizeObserver(updatePosition);
    const observedTables = new Set<HTMLTableElement>();
    const observeTables = () => {
      editor.querySelectorAll<HTMLTableElement>("table.paideia-rich-table").forEach((table) => {
        if (observedTables.has(table)) return;
        observedTables.add(table);
        resizeObserver.observe(table);
      });
    };
    observeTables();
    const mutationObserver = new MutationObserver(() => {
      observeTables();
      updatePosition();
    });
    mutationObserver.observe(editor, { attributes: true, childList: true, subtree: true });
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [getEditor]);

  const transact = (operation: () => boolean | void, keepMenuOpen = true) => {
    setOperationError("");
    const editor = getEditor();
    if (!editor) return;
    const openMenu = menu;
    const before = cleanTableSnapshot(editor);
    const changed = operation();
    editor.querySelectorAll<HTMLTableElement>("table").forEach(syncTableBorderEdges);
    const after = cleanTableSnapshot(editor);
    if (changed === false || after === before) return;
    historyRef.current.push({ before, after });
    if (historyRef.current.length > 50) historyRef.current.shift();
    redoRef.current = [];
    currentSnapshotRef.current = after;
    if (keepMenuOpen && openMenu && editor.contains(openMenu.table)) {
      const liveSelectedCells = Array.from(openMenu.table.querySelectorAll<HTMLTableCellElement>(
        "td.paideia-rich-table-cell-selected, th.paideia-rich-table-cell-selected",
      ));
      const nextCell = openMenu.table.contains(openMenu.cell)
        ? openMenu.cell
        : liveSelectedCells[0] ?? tableGrid(openMenu.table).anchors[0]?.cell;
      if (nextCell) {
        const nextSelection = liveSelectedCells.length ? liveSelectedCells : [nextCell];
        selectCells(nextSelection);
        anchorRef.current = nextCell;
        lastActiveCellRef.current = nextCell;
        rememberActiveTableCell(openMenu.table, nextCell);
        setMenu((current) => current ? { ...current, table: openMenu.table, cell: nextCell } : current);
      }
    } else {
      clearSelection();
      setMenu(null);
      setActiveSubmenu(null);
    }
    onChange();
  };

  const restoreSnapshot = (html: string) => {
    const editor = getEditor();
    if (!editor) return;
    const tables = Array.from(editor.querySelectorAll("table"));
    const tableIndex = menu ? tables.indexOf(menu.table) : -1;
    const oldGrid = menu ? tableGrid(menu.table) : null;
    const coordinates = (selectedCells.length ? selectedCells : menu ? [menu.cell] : [])
      .map((cell) => oldGrid?.anchors.find((entry) => entry.cell === cell))
      .filter((entry) => entry !== undefined);
    editor.innerHTML = html;
    currentSnapshotRef.current = html;
    clearSelection();
    const restoredTables = Array.from(editor.querySelectorAll("table"));
    const restoredTable = restoredTables.length === tables.length ? restoredTables[tableIndex] : undefined;
    if (menu && restoredTable) {
      const restoredGrid = tableGrid(restoredTable);
      const cells = [...new Set(coordinates.map((entry) => restoredGrid.slots[Math.min(entry.row, restoredGrid.rows - 1)]?.[Math.min(entry.column, restoredGrid.columns - 1)]?.cell)
        .filter((cell): cell is HTMLTableCellElement => Boolean(cell)))];
      const cell = cells[0] ?? restoredGrid.anchors[0]?.cell;
      if (cell) {
        selectCells(cells.length ? cells : [cell]);
        anchorRef.current = cell;
        lastActiveCellRef.current = cell;
        rememberActiveTableCell(restoredTable, cell);
        setMenu({ ...menu, table: restoredTable, cell });
      } else setMenu(null);
    } else {
      setMenu(null);
      setActiveSubmenu(null);
    }
    setOperationError("");
    onChange();
  };

  const undo = () => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    redoRef.current.push(snapshot);
    restoreSnapshot(snapshot.before);
  };

  const redo = () => {
    const snapshot = redoRef.current.pop();
    if (!snapshot) return;
    historyRef.current.push(snapshot);
    restoreSnapshot(snapshot.after);
  };

  useEffect(() => {
    const editor = getEditor();
    if (!editor) return;
    const caretChanged = ensureTableCaretParagraphs(editor);
    const borderEdgesChanged = ensureTableBorderEdges(editor);
    if (caretChanged || borderEdgesChanged) onChange();
    currentSnapshotRef.current = cleanTableSnapshot(editor);
  }, [getEditor, onChange]);

  useEffect(() => {
    const editor = getEditor();
    if (!editor) return;
    currentSnapshotRef.current = cleanTableSnapshot(editor);
    let formattingTransactionActive = false;
    const handleFormattingBegin = (event: Event) => {
      formattingTransactionActive = true;
      const detail = (event as CustomEvent<TableFormattingTransactionDetail>).detail;
      if (detail?.before) currentSnapshotRef.current = detail.before;
    };
    const handleFormattingCommit = (event: Event) => {
      const cells = Array.from(editor.querySelectorAll<HTMLTableCellElement>("td.paideia-rich-table-cell-selected,th.paideia-rich-table-cell-selected"));
      setSelectedCells(cells);
      anchorRef.current = cells[0] ?? null;
      const detail = (event as CustomEvent<TableFormattingTransactionDetail>).detail;
      const before = detail?.before ?? currentSnapshotRef.current;
      const after = detail?.after ?? cleanTableSnapshot(editor);
      formattingTransactionActive = false;
      if (before && before !== after) {
        historyRef.current.push({ before, after });
        if (historyRef.current.length > 50) historyRef.current.shift();
        redoRef.current = [];
      }
      currentSnapshotRef.current = after;
    };
    const handleFormattingRollback = () => {
      formattingTransactionActive = false;
      currentSnapshotRef.current = cleanTableSnapshot(editor);
      const restoredSelection = Array.from(
        editor.querySelectorAll<HTMLTableCellElement>("td.paideia-rich-table-cell-selected, th.paideia-rich-table-cell-selected")
      );
      setSelectedCells(restoredSelection);
      anchorRef.current = restoredSelection[0] ?? null;
    };
    const observer = new MutationObserver(() => {
      if (formattingTransactionActive) return;
      const after = cleanTableSnapshot(editor);
      const before = currentSnapshotRef.current;
      if (!before || before === after) return;
      historyRef.current.push({ before, after });
      if (historyRef.current.length > 50) historyRef.current.shift();
      redoRef.current = [];
      currentSnapshotRef.current = after;
    });
    editor.addEventListener(PAIDEIA_TABLE_FORMATTING_BEGIN_EVENT, handleFormattingBegin);
    editor.addEventListener(PAIDEIA_TABLE_FORMATTING_COMMIT_EVENT, handleFormattingCommit);
    editor.addEventListener(PAIDEIA_TABLE_FORMATTING_ROLLBACK_EVENT, handleFormattingRollback);
    observer.observe(editor, { attributes: true, characterData: true, childList: true, subtree: true });
    return () => {
      observer.disconnect();
      editor.removeEventListener(PAIDEIA_TABLE_FORMATTING_BEGIN_EVENT, handleFormattingBegin);
      editor.removeEventListener(PAIDEIA_TABLE_FORMATTING_COMMIT_EVENT, handleFormattingCommit);
      editor.removeEventListener(PAIDEIA_TABLE_FORMATTING_ROLLBACK_EVENT, handleFormattingRollback);
    };
  }, [getEditor]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const editor = getEditor();
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-rich-table-menu='true']")) return;
      if (target?.closest("[data-paideia-color-popover='true']")) return;
      // A RichBar command may target the current visual cell selection. Keep
      // that selection alive while the author operates the toolbar; the
      // command itself will format each cell independently.
      if (target?.closest("[data-rich-text-toolbar='true'], [data-rich-text-dialog='true']")) return;
      if (!editor || !target || !editor.contains(target)) {
        setMenu(null);
        setActiveSubmenu(null);
        clearSelection();
        setActiveTableTarget(null);
        return;
      }
      const cell = target.closest("td,th");
      if (!(cell instanceof HTMLTableCellElement)) {
        setMenu(null);
        setActiveSubmenu(null);
        clearSelection();
        setActiveTableTarget(null);
        return;
      }
      const table = cell.closest("table");
      lastActiveCellRef.current = cell;
      if (table instanceof HTMLTableElement) rememberActiveTableCell(table, cell);
      if (table instanceof HTMLTableElement && event.button === 0) {
        const rect = cell.getBoundingClientRect();
        const currentGrid = tableGrid(table);
        const logical = currentGrid.anchors.find((entry) => entry.cell === cell);
        const nearLeftTableEdge = Boolean(logical?.column === 0 && Math.abs(event.clientX - rect.left) <= 6);
        const nearRightEdge = Math.abs(event.clientX - rect.right) <= 6;
        const nearBottomEdge = Math.abs(event.clientY - rect.bottom) <= 6;
        const nearRightTableEdge = Boolean(logical && logical.column + logical.columnSpan === currentGrid.columns && nearRightEdge);
        const nearBottomTableEdge = Boolean(logical && logical.row + logical.rowSpan === currentGrid.rows && nearBottomEdge);
        if (logical && (nearLeftTableEdge || nearRightEdge || nearBottomEdge)) {
          const axis = nearLeftTableEdge
            ? "table-left"
            : nearRightTableEdge
              ? "table-right"
              : nearBottomTableEdge
                ? "table-bottom"
                : nearRightEdge ? "column" : "row";
          const index = axis === "table-left" ? 0 : axis === "table-right" ? currentGrid.columns - 1 : axis === "table-bottom" ? currentGrid.rows - 1 : axis === "column"
            ? logical.column + logical.columnSpan - 1
            : logical.row + logical.rowSpan - 1;
          if (axis === "column" || axis === "table-left" || axis === "table-right") {
            let colgroup = table.querySelector("colgroup");
            if (!colgroup) {
              colgroup = document.createElement("colgroup");
              table.prepend(colgroup);
            }
            while (colgroup.children.length < currentGrid.columns) colgroup.append(document.createElement("col"));
          }
          const resizeTarget = axis === "column" || axis === "table-left" || axis === "table-right"
            ? table.querySelectorAll("colgroup col")[index]
            : table.rows[index];
          const startSize = axis === "column" || axis === "table-left" || axis === "table-right"
            ? rect.width / Math.max(1, logical.columnSpan)
            : table.rows[index]?.getBoundingClientRect().height ?? rect.height;
          if (resizeTarget instanceof HTMLElement) {
            event.preventDefault();
            event.stopPropagation();
            const tableRect = table.getBoundingClientRect();
            const wrapper = table.closest(".paideia-rich-table-wrapper") ?? table.parentElement;
            const wrapperRect = wrapper?.getBoundingClientRect();
            const columns = Array.from(table.querySelectorAll<HTMLElement>("colgroup col"));
            const columnWidths = columns.map((column) => column.getBoundingClientRect().width || tableRect.width / currentGrid.columns);
            const before = cleanTableSnapshot(editor);
            if (axis === "column" || axis === "table-left" || axis === "table-right") {
              columns.forEach((column, columnIndex) => column.style.width = `${columnWidths[columnIndex]}px`);
            }
            resizeRef.current = {
              axis,
              table,
              index,
              startPointer: axis === "column" || axis === "table-left" || axis === "table-right" ? event.clientX : event.clientY,
              startSize,
              startTableWidth: tableRect.width,
              startTableOffset: wrapperRect ? tableRect.left - wrapperRect.left : 0,
              wrapperWidth: wrapperRect?.width ?? tableRect.width,
              columnWidths,
              before,
            };
            if (axis === "row") resizeTarget.style.setProperty("height", `${Math.round(startSize)}px`);
            editor.style.cursor = axis === "column" || axis === "table-left" || axis === "table-right"
              ? "var(--paideia-table-column-resize-cursor), col-resize"
              : "var(--paideia-table-row-resize-cursor), row-resize";
            return;
          }
        }
      }
      if (event.shiftKey && anchorRef.current) {
        if (table instanceof HTMLTableElement && table === anchorRef.current.closest("table")) {
          event.preventDefault();
          selectCells(expandedTableSelection(table, anchorRef.current, cell));
        }
      } else {
        clearSelection();
        anchorRef.current = cell;
        if (table instanceof HTMLTableElement && event.button === 0) {
          cellDragRef.current = { table, anchor: cell, pointerId: event.pointerId, active: false };
        }
      }
    };
    const handlePointerMove = (event: PointerEvent) => {
      const editor = getEditor();
      if (!editor) return;
      const resize = resizeRef.current;
      if (resize) {
        if (resize.axis === "table-left" || resize.axis === "table-right") {
          const isLeft = resize.axis === "table-left";
          const edgeIndex = isLeft ? 0 : Math.max(0, (resize.columnWidths?.length ?? 1) - 1);
          const edgeWidth = resize.columnWidths?.[edgeIndex] ?? resize.startSize;
          const wrapperWidth = Math.max(1, resize.wrapperWidth ?? resize.startTableWidth ?? edgeWidth);
          const dimensions = anchoredTableResize(
            resize.axis, event.clientX - resize.startPointer,
            resize.startTableWidth ?? edgeWidth, edgeWidth, wrapperWidth,
            resize.startTableOffset,
          );
          resize.table.dataset.paideiaTableCustomSize = "true";
          resize.table.style.setProperty("--paideia-table-custom-width", `${dimensions.tableWidth / wrapperWidth * 100}%`);
          resize.table.style.setProperty("--paideia-table-custom-offset", `${dimensions.offset / wrapperWidth * 100}%`);
          const edgeColumn = resize.table.querySelectorAll<HTMLElement>("colgroup col")[edgeIndex];
          if (edgeColumn) edgeColumn.style.width = `${dimensions.edgeWidth}px`;
          return;
        }
        if (resize.axis === "column") {
          const columns = resize.table.querySelectorAll<HTMLElement>("colgroup col");
          const leftColumn = columns[resize.index];
          const rightColumn = columns[resize.index + 1];
          const leftWidth = resize.columnWidths?.[resize.index] ?? leftColumn?.getBoundingClientRect().width ?? resize.startSize;
          const rightWidth = resize.columnWidths?.[resize.index + 1] ?? rightColumn?.getBoundingClientRect().width ?? resize.startSize;
          const rawDelta = event.clientX - resize.startPointer;
          const minimumWidth = Math.min(72, (leftWidth + rightWidth) / 2);
          const delta = Math.max(minimumWidth - leftWidth, Math.min(rightWidth - minimumWidth, rawDelta));
          if (leftColumn && rightColumn) {
            leftColumn.style.width = `${leftWidth + delta}px`;
            rightColumn.style.width = `${rightWidth - delta}px`;
          }
          return;
        }
        const delta = event.clientY - resize.startPointer;
        const size = Math.max(42, Math.round(resize.startSize + delta));
        const target = resize.table.rows[resize.index];
        if (target instanceof HTMLElement) target.style.setProperty("height", `${size}px`);
        return;
      }
      const cellDrag = cellDragRef.current;
      if (cellDrag && cellDrag.pointerId === event.pointerId) {
        const pointed = document.elementFromPoint(event.clientX, event.clientY)?.closest("td,th");
        if (pointed instanceof HTMLTableCellElement && pointed.closest("table") === cellDrag.table) {
          if (pointed !== cellDrag.anchor || cellDrag.active) {
            cellDrag.active = true;
            event.preventDefault();
            window.getSelection()?.removeAllRanges();
            selectCells(expandedTableSelection(cellDrag.table, cellDrag.anchor, pointed));
          }
          return;
        }
      }
      const target = event.target instanceof Element ? event.target : null;
      const cell = target?.closest("td,th");
      if (!(cell instanceof HTMLTableCellElement) || !editor.contains(cell)) {
        editor.style.removeProperty("cursor");
        return;
      }
      const rect = cell.getBoundingClientRect();
      const table = cell.closest("table");
      const logical = table instanceof HTMLTableElement ? tableGrid(table).anchors.find((entry) => entry.cell === cell) : null;
      if (logical?.column === 0 && Math.abs(event.clientX - rect.left) <= 6) editor.style.cursor = "var(--paideia-table-column-resize-cursor), col-resize";
      else if (Math.abs(event.clientX - rect.right) <= 6) editor.style.cursor = "var(--paideia-table-column-resize-cursor), col-resize";
      else if (Math.abs(event.clientY - rect.bottom) <= 6) editor.style.cursor = "var(--paideia-table-row-resize-cursor), row-resize";
      else editor.style.removeProperty("cursor");
    };
    const handlePointerUp = (event: PointerEvent) => {
      const editor = getEditor();
      const resize = resizeRef.current;
      const cellDrag = cellDragRef.current;
      if (cellDrag?.pointerId === event.pointerId) {
        if (cellDrag.active) {
          const pointed = document.elementFromPoint(event.clientX, event.clientY)?.closest("td,th");
          if (pointed instanceof HTMLTableCellElement && pointed.closest("table") === cellDrag.table) {
            selectCells(expandedTableSelection(cellDrag.table, cellDrag.anchor, pointed));
          }
          event.preventDefault();
        }
        cellDragRef.current = null;
      }
      if (!editor || !resize) return;
      resizeRef.current = null;
      editor.style.removeProperty("cursor");
      if (resize.axis === "column" || resize.axis === "table-left" || resize.axis === "table-right") {
        const tableWidth = Math.max(1, resize.table.getBoundingClientRect().width);
        resize.table.querySelectorAll<HTMLElement>("colgroup col").forEach((column) => {
          column.style.width = `${column.getBoundingClientRect().width / tableWidth * 100}%`;
        });
      }
      const after = cleanTableSnapshot(editor);
      if (after !== resize.before) {
        historyRef.current.push({ before: resize.before, after });
        if (historyRef.current.length > 50) historyRef.current.shift();
        redoRef.current = [];
        currentSnapshotRef.current = after;
        onChange();
      }
    };
    const handleOpenTableMenu = (event: Event) => {
      const editor = getEditor();
      const detail = (event as CustomEvent<{ x?: number; y?: number }>).detail;
      const selection = window.getSelection();
      const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
      const selectionElement = node instanceof Element ? node : node?.parentElement;
      const selectionCell = selectionElement?.closest("td,th");
      const candidate = selectionCell instanceof HTMLTableCellElement && editor?.contains(selectionCell)
        ? selectionCell
        : lastActiveCellRef.current;
      const table = candidate?.closest("table");
      if (!editor || !(candidate instanceof HTMLTableCellElement) || !(table instanceof HTMLTableElement) || !editor.contains(table)) return;
      if (detail?.x !== undefined || detail?.y !== undefined) {
        if (!selectedCells.includes(candidate)) selectCells([candidate]);
        anchorRef.current = candidate;
        lastActiveCellRef.current = candidate;
        rememberActiveTableCell(table, candidate);
        const rect = candidate.getBoundingClientRect();
        setMenu({ x: detail?.x ?? rect.left + 20, y: detail?.y ?? rect.top + 20, table, cell: candidate });
        setActiveSubmenu(null);
      } else {
        openTableMenuBesideTable(table, candidate);
      }
    };
    const handleSelectionChange = () => {
      const editor = getEditor();
      const selection = window.getSelection();
      const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
      const element = node instanceof Element ? node : node?.parentElement;
      const cell = element?.closest("td,th");
      const table = cell?.closest("table");
      if (editor && cell instanceof HTMLTableCellElement && table instanceof HTMLTableElement && editor.contains(table)) {
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const endNode = range?.endContainer ?? null;
        const endElement = endNode instanceof Element ? endNode : endNode?.parentElement;
        const endCell = endElement?.closest("td,th");
        // A real text selection takes precedence over a previous visual cell
        // selection, notably the one left after a matrix paste.
        if (range && !range.collapsed && endCell === cell && selectedCells.length) {
          clearSelection();
        }
        lastActiveCellRef.current = cell;
        rememberActiveTableCell(table, cell);
      } else if (editor && node && editor.contains(node)) {
        setActiveTableTarget(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const editor = getEditor();
      if (!editor) return;
      const selection = window.getSelection();
      const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
      // Empty/narrow cells can leave Chromium's selection on TR or TBODY.
      // History belongs to the editor, not only to a text caret inside TD.
      if (node && editor.contains(node) && (event.ctrlKey || event.metaKey)) {
        if (!event.shiftKey && event.key.toLowerCase() === "z" && historyRef.current.length) {
          event.preventDefault(); undo(); return;
        }
        if ((event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z")) && redoRef.current.length) {
          event.preventDefault(); redo(); return;
        }
      }
      const element = node instanceof Element ? node : node?.parentElement;
      const cell = element?.closest("td,th");
      const table = cell?.closest("table");
      if (!(cell instanceof HTMLTableCellElement) || !(table instanceof HTMLTableElement) || !editor.contains(table)) return;
      lastActiveCellRef.current = cell;
      if ((event.key === "F10" && event.shiftKey) || event.key === "ContextMenu") {
        event.preventDefault();
        const rect = cell.getBoundingClientRect();
        selectCells([cell]);
        anchorRef.current = cell;
        setMenu({ x: rect.left + 20, y: rect.top + 20, table, cell });
        return;
      }
      if (event.key === "Escape") {
        setMenu(null); setActiveSubmenu(null); clearSelection(); return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedCells.length > 0) {
        event.preventDefault();
        transact(() => {
          selectedCells.forEach((selectedCell) => { selectedCell.innerHTML = "<p><br></p>"; });
          return true;
        });
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selection?.isCollapsed && selection.rangeCount) {
        const caret = selection.getRangeAt(0);
        const beforeCaret = caret.cloneRange();
        beforeCaret.selectNodeContents(cell);
        beforeCaret.setEnd(caret.startContainer, caret.startOffset);
        const afterCaret = caret.cloneRange();
        afterCaret.selectNodeContents(cell);
        afterCaret.setStart(caret.endContainer, caret.endOffset);
        const atProtectedEdge = event.key === "Backspace"
          ? beforeCaret.toString().length === 0
          : afterCaret.toString().length === 0;
        if (atProtectedEdge) {
          event.preventDefault();
          return;
        }
      }
      if (event.key === "Tab") {
        const currentGrid = tableGrid(table);
        const slot = currentGrid.anchors.find((entry) => entry.cell === cell);
        if (!slot) return;
        const ordered = currentGrid.anchors.map((entry) => entry.cell);
        const currentIndex = ordered.indexOf(cell);
        let next: HTMLTableCellElement | undefined = ordered[currentIndex + (event.shiftKey ? -1 : 1)];
        if (!next && !event.shiftKey && currentGrid.rows < PAIDEIA_TABLE_MAX_ROWS) {
          event.preventDefault();
          transact(() => addTableRow(table, cell, true));
          const updated = tableGrid(table);
          next = updated.anchors.find((entry) => entry.row === currentGrid.rows && entry.column === 0)?.cell;
        }
        if (next) {
          event.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(next); range.collapse(true);
          selection?.removeAllRanges(); selection?.addRange(range);
        }
      }
    };
    const handleCopy = (event: ClipboardEvent) => {
      const editor = getEditor();
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const startNode = range?.startContainer ?? null;
      const endNode = range?.endContainer ?? null;
      const startElement = startNode instanceof Element ? startNode : startNode?.parentElement;
      const endElement = endNode instanceof Element ? endNode : endNode?.parentElement;
      const startCell = startElement?.closest("td,th");
      const endCell = endElement?.closest("td,th");
      if (
        editor && range && !range.collapsed &&
        startCell instanceof HTMLTableCellElement && startCell === endCell && editor.contains(startCell)
      ) {
        clipboardMatrixRef.current = null;
        return;
      }
      if (!event.clipboardData || selectedCells.length < 2) {
        clipboardMatrixRef.current = null;
        return;
      }
      const table = selectedCells[0]?.closest("table");
      if (!(table instanceof HTMLTableElement)) return;
      const grid = tableGrid(table);
      const selectedSlots = grid.anchors.filter((slot) => selectedCells.includes(slot.cell));
      if (!selectedSlots.length) return;
      const top = Math.min(...selectedSlots.map((slot) => slot.row));
      const left = Math.min(...selectedSlots.map((slot) => slot.column));
      const bottom = Math.max(...selectedSlots.map((slot) => slot.row + slot.rowSpan - 1));
      const right = Math.max(...selectedSlots.map((slot) => slot.column + slot.columnSpan - 1));
      const copyTable = document.createElement("table");
      const body = copyTable.createTBody();
      const plainRows: string[] = [];
      const copiedMatrix: string[][] = [];
      for (let row = top; row <= bottom; row += 1) {
        const tr = body.insertRow();
        const plainCells: string[] = [];
        const copiedRow: string[] = [];
        for (let column = left; column <= right; column += 1) {
          const source = grid.slots[row]?.[column];
          const td = tr.insertCell();
          if (source && source.row === row && source.column === column) td.innerHTML = source.cell.innerHTML;
          copiedRow.push(source && source.row === row && source.column === column ? sanitizedTableCellHtml(source.cell.innerHTML) : "<p><br></p>");
          plainCells.push(source?.cell.innerText ?? "");
        }
        plainRows.push(plainCells.join("\t"));
        copiedMatrix.push(copiedRow);
      }
      clipboardMatrixRef.current = copiedMatrix;
      event.preventDefault();
      event.clipboardData.setData("text/html", copyTable.outerHTML);
      event.clipboardData.setData("text/plain", plainRows.join("\n"));
      event.clipboardData.setData(PAIDEIA_TABLE_MATRIX_CLIPBOARD_TYPE, "1");
    };
    const handlePaste = (event: ClipboardEvent) => {
      const editor = getEditor();
      const hasExplicitPaideiaMarker = event.clipboardData?.getData(PAIDEIA_TABLE_MATRIX_CLIPBOARD_TYPE) === "1";
      const matrix = (event.clipboardData ? clipboardTableMatrix(event.clipboardData) : null)
        ?? (hasExplicitPaideiaMarker ? clipboardMatrixRef.current : null);
      if (!editor || !matrix?.length) return;
      const selection = window.getSelection();
      const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
      const element = node instanceof Element ? node : node?.parentElement;
      const cell = element?.closest("td,th");
      const table = cell?.closest("table");
      if (!(cell instanceof HTMLTableCellElement) || !(table instanceof HTMLTableElement) || !editor.contains(table)) return;
      event.preventDefault();
      let pastedCells: HTMLTableCellElement[] = [];
      transact(() => {
        let grid = tableGrid(table);
        const anchor = grid.anchors.find((slot) => slot.cell === cell);
        if (!anchor) return false;
        const neededRows = Math.min(PAIDEIA_TABLE_MAX_ROWS, anchor.row + matrix.length);
        const neededColumns = Math.min(PAIDEIA_TABLE_MAX_COLUMNS, anchor.column + Math.max(...matrix.map((row) => row.length)));
        while (grid.rows < neededRows) {
          const reference = grid.anchors[grid.anchors.length - 1]?.cell;
          if (!reference || !addTableRow(table, reference, true)) break;
          grid = tableGrid(table);
        }
        while (grid.columns < neededColumns) {
          const reference = grid.anchors.find((slot) => slot.column + slot.columnSpan === grid.columns)?.cell;
          if (!reference || !addTableColumn(table, reference, true)) break;
          grid = tableGrid(table);
        }
        matrix.slice(0, PAIDEIA_TABLE_MAX_ROWS - anchor.row).forEach((sourceRow, rowOffset) => {
          sourceRow.slice(0, PAIDEIA_TABLE_MAX_COLUMNS - anchor.column).forEach((html, columnOffset) => {
            const target = grid.slots[anchor.row + rowOffset]?.[anchor.column + columnOffset]?.cell;
            if (target) {
              target.innerHTML = sanitizedTableCellHtml(html);
              pastedCells.push(target);
            }
          });
        });
        return true;
      }, true);
      if (pastedCells.length) {
        selectCells([...new Set(pastedCells)]);
        anchorRef.current = pastedCells[0];
        lastActiveCellRef.current = pastedCells[0];
        const caret = document.createRange();
        caret.selectNodeContents(pastedCells[0]);
        caret.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(caret);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointercancel", handlePointerUp, true);
    document.addEventListener("paideia:open-rich-table-menu", handleOpenTableMenu);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("paste", handlePaste, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", handlePointerUp, true);
      document.removeEventListener("paideia:open-rich-table-menu", handleOpenTableMenu);
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("paste", handlePaste, true);
    };
  }, [getEditor, selectedCells]);

  const tableLaunchers = tableLauncherPositions.filter((position) => position.visible).map((position, index) => (
    <button
      aria-expanded={menu?.table === position.table}
      aria-label={t("richText.table.actions", undefined, "Commandes du tableau")}
      className="rich-table-menu-launcher"
      data-rich-table-menu="true"
      key={index}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (menu?.table === position.table) {
          setMenu(null);
          setActiveSubmenu(null);
          clearSelection();
          return;
        }
        const selection = window.getSelection();
        const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
        const element = node instanceof Element ? node : node?.parentElement;
        const selectionCell = element?.closest("td,th");
        const rememberedCell = activeTableTarget?.table === position.table ? activeTableTarget.cell : null;
        const cell = selectionCell instanceof HTMLTableCellElement && selectionCell.closest("table") === position.table
          ? selectionCell
          : rememberedCell ?? tableGrid(position.table).anchors[0]?.cell;
        if (cell) openTableMenuBesideTable(position.table, cell);
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={{ left: position.x, top: position.y }}
      title={t("richText.table.actions", undefined, "Commandes du tableau")}
      type="button"
    >
      <img alt="" className="rich-table-menu-launcher-icon off" src={gearOffIcon} />
      <img alt="" className="rich-table-menu-launcher-icon on" src={gearOnIcon} />
    </button>
  ));

  if (!menu || !(activeTable instanceof HTMLTableElement) || !(activeCell instanceof HTMLTableCellElement)) {
    return tableLaunchers.length ? createPortal(<>{tableLaunchers}</>, document.body) : null;
  }
  const allSelected = selectedCells.length ? selectedCells : [activeCell];
  const limitMessage = t("richText.table.limitExceeded", undefined, "Cette opération dépasserait la limite de 32 lignes ou de 32 colonnes. Le tableau n’a pas été modifié.");
  const mixedLabel = t("richText.table.mixed", undefined, "Mixte");
  const sharedValue = (read: (cell: HTMLTableCellElement) => string) => {
    const values = new Set(allSelected.map(read));
    return values.size === 1 ? [...values][0] : "mixed";
  };
  const horizontalAlign = sharedValue((cell) => {
    const style = getComputedStyle(cell);
    const value = cell.style.textAlign || style.textAlign || "left";
    return value === "start" ? (style.direction === "rtl" ? "right" : "left")
      : value === "end" ? (style.direction === "rtl" ? "left" : "right") : value;
  });
  const verticalAlign = sharedValue((cell) => cell.style.verticalAlign || getComputedStyle(cell).verticalAlign || "middle");
  const tablePreset = ["simple", "striped", "accent", "borderless"].find((value) => activeTable.classList.contains(`paideia-rich-table--${value}`)) ?? "simple";
  const applyTracks = (axis: "row" | "column", after?: boolean) => {
    setOperationError("");
    transact(() => {
      const changed = after === undefined ? deleteSelectedTableTracks(activeTable, allSelected, axis)
        : insertSelectedTableTracks(activeTable, allSelected, axis, after);
      if (!changed && after !== undefined) setOperationError(limitMessage);
      return changed;
    });
  };
  const applySplitToSelection = (split: () => HTMLTableCellElement[]) => transact(() => {
    setOperationError("");
    const nextSelection = split();
    if (!nextSelection.length) { setOperationError(limitMessage); return false; }
    activeTable.querySelectorAll(".paideia-rich-table-cell-selected").forEach((cell) => {
      cell.classList.remove("paideia-rich-table-cell-selected");
    });
    nextSelection.forEach((cell) => cell.classList.add("paideia-rich-table-cell-selected"));
    return true;
  });
  const readCellFill = (cell: HTMLTableCellElement) => {
    const value = cell.style.backgroundColor || getComputedStyle(cell).backgroundColor || "transparent";
    return value === "transparent" || /^rgba\([^)]*,\s*0\s*\)$/.test(value)
      ? "transparent" : cssColorAsHex(value, "#FFFFFF");
  };
  const mixedCellFill = sharedValue(readCellFill) === "mixed";
  const cellFillColor = readCellFill(allSelected[0]);
  const borderColor = cssColorAsHex(activeTable.style.getPropertyValue("--paideia-table-border-color"), "#C9D4E8");
  const menuMaxHeight = Math.min(620, window.innerHeight - 24);
  const menuLeft = Math.max(12, Math.min(menu.x, window.innerWidth - 332));
  const menuTop = Math.max(12, Math.min(menu.y, window.innerHeight - menuMaxHeight - 12));
  const menuStyle = {
    left: menuLeft,
    top: menuTop
  };

  const submenuWidth = activeSubmenu === "format" ? 360 : 280;
  const submenuHeight = activeSubmenu === "format"
    ? 520
    : activeSubmenu === "select"
      ? 240
      : activeSubmenu === "insert"
        ? 205
        : activeSubmenu === "delete"
          ? 165
          : 115;
  const submenuLeft = menuLeft + 328 + submenuWidth <= window.innerWidth - 12
    ? menuLeft + 328
    : Math.max(12, menuLeft - submenuWidth - 8);
  const submenuTop = Math.max(12, Math.min(menuTop, window.innerHeight - submenuHeight - 12));
  const submenuStyle = { left: submenuLeft, top: submenuTop, width: submenuWidth };

  const toggleSubmenu = (submenu: TableSubmenu) => {
    setActiveSubmenu((current) => current === submenu ? null : submenu);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setMenu(null);
      setActiveSubmenu(null);
      clearSelection();
      return;
    }
    if (event.key === "ArrowRight") {
      const trigger = (event.target as Element | null)?.closest<HTMLElement>("[data-table-submenu-trigger]");
      const submenu = trigger?.dataset.tableSubmenuTrigger as TableSubmenu | undefined;
      if (!submenu) return;
      event.preventDefault();
      setActiveSubmenu(submenu);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-table-submenu-panel="${submenu}"] button:not(:disabled), [data-table-submenu-panel="${submenu}"] select`)?.focus();
      });
      return;
    }
    if (event.key === "ArrowLeft" && activeSubmenu) {
      event.preventDefault();
      const submenu = activeSubmenu;
      setActiveSubmenu(null);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-table-submenu-trigger="${submenu}"]`)?.focus();
      });
    }
  };

  return createPortal(
    <>
      {tableLaunchers}
      <div className="rich-table-context-menu" data-rich-table-menu="true" data-rich-text-dialog="true" onKeyDown={handleMenuKeyDown} style={menuStyle}>
        {operationError ? <p role="alert">{operationError}</p> : null}
        <div className="rich-table-context-menu-scroll">
          <div className="rich-table-menu-heading">
            <strong>{t("richText.table.actions", undefined, "Tableau")}</strong>
            <span>{grid?.rows ?? 0} × {grid?.columns ?? 0}</span>
          </div>
          <div className="rich-table-menu-command-list" role="menu">
            {(["select", "insert", "delete"] as const).map((submenu) => (
              <button
                aria-expanded={activeSubmenu === submenu}
                aria-haspopup="menu"
                className="rich-table-menu-submenu-trigger"
                data-table-submenu-trigger={submenu}
                key={submenu}
                onClick={() => toggleSubmenu(submenu)}
                role="menuitem"
                type="button"
              >
                <span>{t(`richText.table.menu.${submenu}`, undefined, submenu === "select" ? "Sélectionner" : submenu === "insert" ? "Insérer" : "Supprimer")}</span>
                <span aria-hidden="true" className="rich-table-menu-chevron">›</span>
              </button>
            ))}
            <div className="rich-table-menu-separator" role="separator" />
            <button disabled={allSelected.length < 2} onClick={() => transact(() => mergeTableCells(activeTable, allSelected))} role="menuitem" type="button">{t("richText.table.merge", undefined, "Fusionner les cellules")}</button>
            <button onClick={() => applySplitToSelection(() => splitTableCellsAlong(activeTable, allSelected, "horizontal"))} role="menuitem" type="button">{t("richText.table.splitHorizontal", undefined, "Scinder horizontalement")}</button>
            <button onClick={() => applySplitToSelection(() => splitTableCellsAlong(activeTable, allSelected, "vertical"))} role="menuitem" type="button">{t("richText.table.splitVertical", undefined, "Scinder verticalement")}</button>
            <button disabled={!allSelected.some((cell) => cell.rowSpan > 1 || cell.colSpan > 1)} onClick={() => applySplitToSelection(() => splitTableCells(activeTable, allSelected))} role="menuitem" type="button">{allSelected.length > 1 ? t("richText.table.splitPlural", undefined, "Scinder les cellules") : t("richText.table.split", undefined, "Scinder la cellule")}</button>
            <div className="rich-table-menu-separator" role="separator" />
            <button
              aria-expanded={activeSubmenu === "headers"}
              aria-haspopup="menu"
              className="rich-table-menu-submenu-trigger"
              data-table-submenu-trigger="headers"
              onClick={() => toggleSubmenu("headers")}
              role="menuitem"
              type="button"
            >
              <span>{t("richText.table.menu.headers", undefined, "En-têtes")}</span>
              <span aria-hidden="true" className="rich-table-menu-chevron">›</span>
            </button>
            <button
              aria-expanded={activeSubmenu === "format"}
              aria-haspopup="dialog"
              className="rich-table-menu-submenu-trigger rich-table-menu-format-toggle"
              data-table-submenu-trigger="format"
              onClick={() => toggleSubmenu("format")}
              role="menuitem"
              type="button"
            >
              <span>{t("richText.table.format", undefined, "Mise en forme")}</span>
              <span aria-hidden="true" className="rich-table-menu-chevron">›</span>
            </button>
          </div>
          <div className="rich-table-menu-footer">
            <button disabled={!historyRef.current.length} onClick={undo} type="button">{t("richText.table.undo", undefined, "Annuler")}</button>
            <button disabled={!redoRef.current.length} onClick={redo} type="button">{t("richText.table.redo", undefined, "Rétablir")}</button>
          </div>
        </div>
      </div>
      {activeSubmenu ? (
        <div
          aria-label={activeSubmenu === "format" ? t("richText.table.format", undefined, "Mise en forme") : undefined}
          className={`rich-table-submenu${activeSubmenu === "format" ? " rich-table-submenu--format" : ""}`}
          data-rich-table-menu="true"
          data-rich-text-dialog="true"
          data-table-submenu-panel={activeSubmenu}
          onKeyDown={handleMenuKeyDown}
          role={activeSubmenu === "format" ? "dialog" : "menu"}
          style={submenuStyle}
        >
          {activeSubmenu === "select" ? (
            <>
              <button onClick={() => selectCells([activeCell])} role="menuitem" type="button">{t("richText.table.menu.cell", undefined, "Cellule")}</button>
              <button onClick={() => selectCells(tableRowCells(activeTable, activeCell))} role="menuitem" type="button">{t("richText.table.selectRow", undefined, "Sélectionner la ligne")}</button>
              <button onClick={() => selectCells(tableColumnCells(activeTable, activeCell))} role="menuitem" type="button">{t("richText.table.selectColumn", undefined, "Sélectionner la colonne")}</button>
              <button onClick={() => selectCells(allTableCells(activeTable))} role="menuitem" type="button">{t("richText.table.selectTable", undefined, "Sélectionner le tableau")}</button>
              <button onClick={() => { clearSelection(); setMenu(null); setActiveSubmenu(null); }} role="menuitem" type="button">{t("richText.table.clearSelection", undefined, "Annuler la sélection")}</button>
            </>
          ) : null}
          {activeSubmenu === "insert" ? (
            <>
              <button onClick={() => applyTracks("row", false)} role="menuitem" type="button">{t("richText.table.rowAbove", undefined, "Ajouter une ligne au-dessus")}</button>
              <button onClick={() => applyTracks("row", true)} role="menuitem" type="button">{t("richText.table.rowBelow", undefined, "Ajouter une ligne en dessous")}</button>
              <button onClick={() => applyTracks("column", false)} role="menuitem" type="button">{t("richText.table.columnLeft", undefined, "Ajouter une colonne à gauche")}</button>
              <button onClick={() => applyTracks("column", true)} role="menuitem" type="button">{t("richText.table.columnRight", undefined, "Ajouter une colonne à droite")}</button>
            </>
          ) : null}
          {activeSubmenu === "delete" ? (
            <>
              <button onClick={() => applyTracks("row")} role="menuitem" type="button">{t("richText.table.deleteRow", undefined, "Supprimer la ligne")}</button>
              <button onClick={() => applyTracks("column")} role="menuitem" type="button">{t("richText.table.deleteColumn", undefined, "Supprimer la colonne")}</button>
              <button className="danger-pill" onClick={() => transact(() => {
                const wrapper = activeTable.closest(".paideia-rich-table-wrapper");
                if (wrapper) wrapper.remove(); else activeTable.remove();
                return true;
              }, false)} role="menuitem" type="button">{t("richText.table.deleteTable", undefined, "Supprimer le tableau")}</button>
            </>
          ) : null}
          {activeSubmenu === "headers" ? (
            <>
              <button onClick={() => transact(() => setTableHeaderRow(activeTable, activeTable.rows[0]?.cells[0]?.tagName !== "TH"))} role="menuitem" type="button">{t("richText.table.headerRow", undefined, "Ligne d’en-tête")}</button>
              <button onClick={() => transact(() => setTableHeaderColumn(activeTable, activeTable.rows[0]?.cells[0]?.scope !== "row"))} role="menuitem" type="button">{t("richText.table.headerColumn", undefined, "Colonne d’en-tête")}</button>
            </>
          ) : null}
          {activeSubmenu === "format" ? (
            <div className="rich-table-format-panel">
          <label>{t("richText.table.preset", undefined, "Style")}
            <select onChange={(event) => transact(() => {
              activeTable.classList.remove("paideia-rich-table--simple", "paideia-rich-table--accent", "paideia-rich-table--striped", "paideia-rich-table--borderless");
              activeTable.classList.add(`paideia-rich-table--${event.target.value}`); return true;
            }, true)} value={tablePreset}>
              {tablePreset === "accent" || tablePreset === "borderless" ? <option value={tablePreset}>{t("richText.table.currentStyle", undefined, "Style actuel")}</option> : null}
              <option value="simple">{t("richText.table.presetSimple", undefined, "Simple")}</option>
              <option value="striped">{t("richText.table.presetStriped", undefined, "Lignes alternées")}</option>
            </select>
          </label>
          <label>{t("richText.table.width", undefined, "Largeur")}
            <select value={activeTable.dataset.paideiaTableWidth || "75"} onChange={(event) => transact(() => {
              activeTable.dataset.paideiaTableWidth = event.target.value;
              delete activeTable.dataset.paideiaTableCustomSize;
              activeTable.style.removeProperty("--paideia-table-custom-width");
              activeTable.style.removeProperty("--paideia-table-custom-offset");
              return true;
            }, true)}>
              <option value="auto">{t("richText.table.widthAuto", undefined, "Automatique")}</option>
              <option value="100">100 %</option><option value="75">75 %</option><option value="50">50 %</option>
            </select>
          </label>
          <label>{t("richText.table.cellFill", undefined, "Fond des cellules")}{mixedCellFill ? ` (${mixedLabel})` : ""}
            <ColorPickerField
              className={mixedCellFill ? "rich-table-mixed-color" : ""}
              allowTransparent
              ariaLabel={t("richText.table.cellFill", undefined, "Fond des cellules")}
              exclusiveGroup="rich-table-format-colors"
              onChange={(value) => transact(() => {
                allSelected.forEach((cell) => { cell.style.backgroundColor = value; });
                return true;
              }, true)}
              value={cellFillColor}
            />
          </label>
          <label>{t("richText.table.borderColor", undefined, "Couleur des bordures")}
            <ColorPickerField
              ariaLabel={t("richText.table.borderColor", undefined, "Couleur des bordures")}
              exclusiveGroup="rich-table-format-colors"
              onChange={(value) => transact(() => {
                activeTable.style.setProperty("--paideia-table-border-color", value);
                return true;
              }, true)}
              value={borderColor}
            />
          </label>
          <label>{t("editor.borderWidth", undefined, "Épaisseur")}
            <select value={activeTable.dataset.paideiaTableBorderWidth || "1"} onChange={(event) => transact(() => {
              activeTable.dataset.paideiaTableBorderWidth = event.target.value;
              return true;
            }, true)}>
              <option value="1">1 px</option><option value="2">2 px</option><option value="3">3 px</option><option value="4">4 px</option>
            </select>
          </label>
          <label>{t("richText.table.borderMode", undefined, "Bordures")}
            <select value={activeTable.dataset.paideiaTableBorderMode || (activeTable.classList.contains("paideia-rich-table--borderless") ? "none" : "grid")} onChange={(event) => transact(() => {
              activeTable.dataset.paideiaTableBorderMode = event.target.value;
              activeTable.classList.remove("paideia-rich-table--borderless");
              return true;
            }, true)}>
              <option value="grid">{t("richText.table.borderGrid", undefined, "Toutes")}</option>
              <option value="inner">{t("richText.table.borderInner", undefined, "Intérieures")}</option>
              <option value="outer">{t("richText.table.borderOuter", undefined, "Extérieures")}</option>
              <option value="none">{t("richText.table.borderNone", undefined, "Aucune")}</option>
            </select>
          </label>
          <label>{t("richText.table.horizontalAlign", undefined, "Alignement horizontal")}
            <select value={horizontalAlign} onChange={(event) => transact(() => { allSelected.forEach((cell) => cell.style.textAlign = event.target.value); return true; }, true)}>{horizontalAlign === "mixed" ? <option value="mixed" disabled>{mixedLabel}</option> : null}<option value="left">{t("richText.table.alignLeft", undefined, "À gauche")}</option><option value="center">{t("richText.table.alignCenter", undefined, "Centre")}</option><option value="right">{t("richText.table.alignRight", undefined, "À droite")}</option></select>
          </label>
          <label>{t("richText.table.verticalAlign", undefined, "Alignement vertical")}
            <select value={verticalAlign} onChange={(event) => transact(() => { allSelected.forEach((cell) => cell.style.verticalAlign = event.target.value); return true; }, true)}>{verticalAlign === "mixed" ? <option value="mixed" disabled>{mixedLabel}</option> : null}<option value="top">{t("richText.table.top", undefined, "Haut")}</option><option value="middle">{t("richText.table.middle", undefined, "Milieu")}</option><option value="bottom">{t("richText.table.bottom", undefined, "Bas")}</option></select>
          </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </>,
    document.body
  );
}
