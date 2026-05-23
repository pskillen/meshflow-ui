import type { InfrastructureExportRow } from './infrastructure-export-rows';

export interface BuildSetFavoriteNodeCommandsOptions {
  /** e.g. "-b MyRadio" or "--host meshtastic.local" */
  connectionArgs?: string;
  /** Remote NodeDB to update, e.g. "!a5592387" */
  destNodeId?: string;
  /** Include comment header with count and date */
  includeHeader?: boolean;
}

const MESHTASTIC_NODE_ID_RE = /^![0-9a-fA-F]{8}$/;

function normalizeNodeId(id: string): string | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const withBang = trimmed.startsWith('!') ? trimmed : `!${trimmed}`;
  return MESHTASTIC_NODE_ID_RE.test(withBang) ? withBang : null;
}

function buildCommandLine(favoriteNodeId: string, connectionArgs?: string, destNodeId?: string): string {
  const parts = ['meshtastic'];
  if (connectionArgs?.trim()) {
    parts.push(connectionArgs.trim());
  }
  const dest = destNodeId ? normalizeNodeId(destNodeId) : null;
  if (dest) {
    parts.push(`--dest '${dest}'`);
  }
  parts.push(`--set-favorite-node '${favoriteNodeId}'`);
  return parts.join(' ');
}

/**
 * Build meshtastic CLI commands to set each row as a favorite node.
 * @see https://wiki.mbug.com.au/meshtastic-python-cli (--set-favorite-node)
 */
export function buildSetFavoriteNodeCommands(
  rows: InfrastructureExportRow[],
  options?: BuildSetFavoriteNodeCommandsOptions
): string {
  const connectionArgs = options?.connectionArgs;
  const dest = options?.destNodeId ? normalizeNodeId(options.destNodeId) : null;
  if (options?.destNodeId && !dest) {
    return '';
  }

  const lines: string[] = [];
  for (const row of rows) {
    const nodeId = normalizeNodeId(row.node_id_str);
    if (!nodeId) continue;
    lines.push(buildCommandLine(nodeId, connectionArgs, dest ?? undefined));
  }

  if (lines.length === 0) return '';

  if (options?.includeHeader !== false) {
    const date = new Date().toISOString().slice(0, 10);
    const header = [
      `# Meshflow infrastructure export — ${lines.length} favorite command${lines.length === 1 ? '' : 's'}`,
      `# Generated ${date} — review before running`,
      '',
    ];
    return [...header, ...lines].join('\n');
  }

  return lines.join('\n');
}

export function countSetFavoriteNodeCommands(
  rows: InfrastructureExportRow[],
  options?: BuildSetFavoriteNodeCommandsOptions
): number {
  const text = buildSetFavoriteNodeCommands(rows, { ...options, includeHeader: false });
  if (!text) return 0;
  return text.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
}
