/**
 * RFC 4180 CSV serialisation for infrastructure export rows.
 */

export interface CsvColumnDef<T> {
  id: string;
  header: string;
  getValue: (row: T) => string | number | boolean | null | undefined;
}

export function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cellToString(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function infrastructureRowsToCsv<T>(rows: T[], columns: CsvColumnDef<T>[]): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = rows.map((row) => columns.map((col) => escapeCsvCell(cellToString(col.getValue(row)))).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, content: string): void {
  downloadTextFile(filename, content, 'text/csv;charset=utf-8');
}
