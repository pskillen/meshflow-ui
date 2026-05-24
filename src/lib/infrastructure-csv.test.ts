import { describe, expect, it } from 'vitest';
import { escapeCsvCell, infrastructureRowsToCsv, type CsvColumnDef } from './infrastructure-csv';

type Row = { name: string; count: number | null };

const columns: CsvColumnDef<Row>[] = [
  { id: 'name', header: 'Name', getValue: (r) => r.name },
  { id: 'count', header: 'Count', getValue: (r) => r.count },
];

describe('escapeCsvCell', () => {
  it('quotes fields with commas', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('escapes double quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes multiline values', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('leaves simple strings unquoted', () => {
    expect(escapeCsvCell('router-1')).toBe('router-1');
  });
});

describe('infrastructureRowsToCsv', () => {
  it('includes header and one row per input', () => {
    const csv = infrastructureRowsToCsv(
      [
        { name: 'Alpha', count: 1 },
        { name: 'Beta', count: null },
      ],
      columns
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Name,Count');
    expect(lines[1]).toBe('Alpha,1');
    expect(lines[2]).toBe('Beta,');
  });

  it('quotes node names containing commas', () => {
    const csv = infrastructureRowsToCsv([{ name: 'East, Router', count: 2 }], columns);
    expect(csv).toContain('"East, Router"');
  });
});
