import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, ExternalLink } from 'lucide-react';

export interface BotDefaults {
  ignorePortnums?: string | null;
  hopLimit?: number | null;
}

interface BotSetupInstructionsProps {
  apiKey: string;
  apiBaseUrl: string;
  nodeShortName?: string;
  botDefaults?: BotDefaults;
}

function deriveWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
}

function buildBotEnvVars(botDefaults?: BotDefaults): string[] {
  const lines: string[] = [];
  if (botDefaults?.ignorePortnums?.trim()) {
    lines.push(`      - IGNORE_PORTNUMS=${botDefaults.ignorePortnums.trim()}`);
  }
  const hopLimit = botDefaults?.hopLimit;
  if (typeof hopLimit === 'number' && hopLimit >= 1 && hopLimit <= 7) {
    lines.push(`      - TR_HOPS_LIMIT=${hopLimit}`);
    lines.push(`      - TEXT_MESSAGE_MAX_HOPS=${hopLimit}`);
  }
  return lines;
}

function buildBotEnvVarsForEnvFile(botDefaults?: BotDefaults): string[] {
  const lines: string[] = [];
  if (botDefaults?.ignorePortnums?.trim()) {
    lines.push(`IGNORE_PORTNUMS=${botDefaults.ignorePortnums.trim()}`);
  }
  const hopLimit = botDefaults?.hopLimit;
  if (typeof hopLimit === 'number' && hopLimit >= 1 && hopLimit <= 7) {
    lines.push(`TR_HOPS_LIMIT=${hopLimit}`);
    lines.push(`TEXT_MESSAGE_MAX_HOPS=${hopLimit}`);
  }
  return lines;
}

function generateDockerComposeEmbedded(apiBaseUrl: string, apiKey: string, botDefaults?: BotDefaults): string {
  const wsUrl = deriveWsUrl(apiBaseUrl);
  const botEnvLines = buildBotEnvVars(botDefaults);
  const botEnvBlock = botEnvLines.length > 0 ? '\n' + botEnvLines.join('\n') : '';
  return `---
services:
  meshflow-bot:
    image: ghcr.io/pskillen/meshflow-bot:latest
    container_name: meshflow-bot
    restart: unless-stopped
    environment:
      - MESHTASTIC_IP=meshtastic.local   # Use hostname (e.g. meshtastic.local) or IP if your node has WiFi
      - ADMIN_NODES='!xxxxxxxx'          # Your admin node ID(s) - find in Meshtastic app or node details
      - STORAGE_API_ROOT=${apiBaseUrl}
      - STORAGE_API_TOKEN=${apiKey}
      - STORAGE_API_VERSION=2
      - MESHFLOW_WS_URL=${wsUrl}${botEnvBlock}
    volumes:
      - ./data:/app/data
    depends_on:
      - watchtower

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 3600 meshflow-bot
`;
}

function generateDockerComposeSeparate(): string {
  return `---
# Place .env in this directory with STORAGE_API_ROOT, STORAGE_API_TOKEN, etc.
services:
  meshflow-bot:
    image: ghcr.io/pskillen/meshflow-bot:latest
    container_name: meshflow-bot
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
    depends_on:
      - watchtower

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 3600 meshflow-bot
`;
}

function generateEnvFile(apiBaseUrl: string, apiKey: string, botDefaults?: BotDefaults): string {
  const wsUrl = deriveWsUrl(apiBaseUrl);
  const botEnvLines = buildBotEnvVarsForEnvFile(botDefaults);
  const botEnvBlock = botEnvLines.length > 0 ? '\n\n' + botEnvLines.join('\n') : '';
  return `# Meshflow Bot configuration
# Copy this file to .env in the same directory as docker-compose.yaml

MESHTASTIC_IP=meshtastic.local
ADMIN_NODES='!xxxxxxxx'

STORAGE_API_ROOT=${apiBaseUrl}
STORAGE_API_TOKEN=${apiKey}
STORAGE_API_VERSION=2
MESHFLOW_WS_URL=${wsUrl}${botEnvBlock}
`;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BotSetupInstructions({ apiKey, apiBaseUrl, botDefaults }: BotSetupInstructionsProps) {
  const [format, setFormat] = useState<'embedded' | 'separate'>('embedded');
  const [copied, setCopied] = useState<'compose' | 'env' | null>(null);

  const dockerComposeEmbedded = generateDockerComposeEmbedded(apiBaseUrl, apiKey, botDefaults);
  const dockerComposeSeparate = generateDockerComposeSeparate();
  const envContent = generateEnvFile(apiBaseUrl, apiKey, botDefaults);

  const handleCopy = (text: string, type: 'compose' | 'env') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>
          Create a project directory and <code className="rounded bg-muted px-1">cd</code> into it
        </li>
        <li>
          Save the docker-compose file below as <code className="rounded bg-muted px-1">docker-compose.yaml</code>
        </li>
        {format === 'separate' && (
          <li>
            Save the .env file and place it in the same directory as{' '}
            <code className="rounded bg-muted px-1">docker-compose.yaml</code>
          </li>
        )}
        <li>
          Edit <code className="rounded bg-muted px-1">MESHTASTIC_IP</code> and{' '}
          <code className="rounded bg-muted px-1">ADMIN_NODES</code> for your setup
        </li>
        <li>
          Run <code className="rounded bg-muted px-1">docker compose up -d</code>
        </li>
      </ol>

      <Tabs value={format} onValueChange={(v) => setFormat(v as 'embedded' | 'separate')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="embedded">Embedded API key</TabsTrigger>
          <TabsTrigger value="separate">Separate .env file</TabsTrigger>
        </TabsList>

        <TabsContent value="embedded" className="mt-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">docker-compose.yaml</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleCopy(dockerComposeEmbedded, 'compose')}>
                  <Copy className="h-4 w-4 mr-1" />
                  {copied === 'compose' ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile('docker-compose.yaml', dockerComposeEmbedded)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-64 overflow-y-auto">
              <code>{dockerComposeEmbedded}</code>
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="separate" className="mt-3">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">docker-compose.yaml</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(dockerComposeSeparate, 'compose')}>
                    <Copy className="h-4 w-4 mr-1" />
                    {copied === 'compose' ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile('docker-compose.yaml', dockerComposeSeparate)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-48 overflow-y-auto">
                <code>{dockerComposeSeparate}</code>
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">.env</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(envContent, 'env')}>
                    <Copy className="h-4 w-4 mr-1" />
                    {copied === 'env' ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadFile('.env', envContent)}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-32 overflow-y-auto">
                <code>{envContent}</code>
              </pre>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="pt-2">
        <a
          href="https://github.com/pskillen/meshflow-bot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Meshflow Bot on GitHub
        </a>
      </div>
    </div>
  );
}
