import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BotSetupInstructions } from './BotSetupInstructions';

function getEmbeddedDockerComposeContent(container: HTMLElement): string {
  const pres = container.querySelectorAll('pre');
  for (const pre of pres) {
    const text = pre.textContent || '';
    if (text.includes('STORAGE_API_TOKEN=test-key') && text.includes('meshflow-bot:')) {
      return text;
    }
  }
  return '';
}

describe('BotSetupInstructions', () => {
  it('renders docker-compose without bot env vars when botDefaults not provided', () => {
    const { container } = render(
      <BotSetupInstructions apiKey="test-key" apiBaseUrl="https://api.example.com" />
    );

    const embeddedContent = getEmbeddedDockerComposeContent(container);
    expect(embeddedContent).toBeTruthy();
    expect(embeddedContent).not.toContain('IGNORE_PORTNUMS');
    expect(embeddedContent).not.toContain('TR_HOPS_LIMIT');
    expect(embeddedContent).not.toContain('TEXT_MESSAGE_MAX_HOPS');
  });

  it('includes IGNORE_PORTNUMS in docker-compose when botDefaults.ignorePortnums provided', () => {
    const { container } = render(
      <BotSetupInstructions
        apiKey="test-key"
        apiBaseUrl="https://api.example.com"
        botDefaults={{ ignorePortnums: '345,ROUTING_APP' }}
      />
    );

    const embeddedContent = getEmbeddedDockerComposeContent(container);
    expect(embeddedContent).toContain('IGNORE_PORTNUMS=345,ROUTING_APP');
  });

  it('includes TR_HOPS_LIMIT and TEXT_MESSAGE_MAX_HOPS when botDefaults.hopLimit provided', () => {
    const { container } = render(
      <BotSetupInstructions
        apiKey="test-key"
        apiBaseUrl="https://api.example.com"
        botDefaults={{ hopLimit: 5 }}
      />
    );

    const embeddedContent = getEmbeddedDockerComposeContent(container);
    expect(embeddedContent).toContain('TR_HOPS_LIMIT=5');
    expect(embeddedContent).toContain('TEXT_MESSAGE_MAX_HOPS=5');
  });

  it('includes all bot env vars when full botDefaults provided', () => {
    const { container } = render(
      <BotSetupInstructions
        apiKey="test-key"
        apiBaseUrl="https://api.example.com"
        botDefaults={{
          ignorePortnums: '345,ROUTING_APP',
          hopLimit: 7,
        }}
      />
    );

    const embeddedContent = getEmbeddedDockerComposeContent(container);
    expect(embeddedContent).toContain('IGNORE_PORTNUMS=345,ROUTING_APP');
    expect(embeddedContent).toContain('TR_HOPS_LIMIT=7');
    expect(embeddedContent).toContain('TEXT_MESSAGE_MAX_HOPS=7');
  });

  it('uses STORAGE_API_VERSION=3 for Meshtastic compose', () => {
    const { container } = render(
      <BotSetupInstructions apiKey="test-key" apiBaseUrl="https://api.example.com" protocol="meshtastic" />
    );
    const embeddedContent = getEmbeddedDockerComposeContent(container);
    expect(embeddedContent).toContain('STORAGE_API_VERSION=3');
    expect(embeddedContent).not.toContain('STORAGE_API_VERSION=2');
  });

  it('renders MeshCore compose with RADIO_PROTOCOL=meshcore', () => {
    const { container } = render(
      <BotSetupInstructions apiKey="test-key" apiBaseUrl="https://api.example.com" protocol="meshcore" />
    );
    const pres = container.querySelectorAll('pre');
    const meshcoreCompose = Array.from(pres).find((pre) => (pre.textContent || '').includes('RADIO_PROTOCOL=meshcore'));
    expect(meshcoreCompose).toBeTruthy();
    expect(meshcoreCompose?.textContent).toContain('MESHCORE_UPLOAD_ENABLED=true');
    expect(meshcoreCompose?.textContent).toContain('STORAGE_API_VERSION=3');
  });

  it('omits hop limit env vars when hopLimit is out of range', () => {
    const { container } = render(
      <BotSetupInstructions
        apiKey="test-key"
        apiBaseUrl="https://api.example.com"
        botDefaults={{ hopLimit: 0 }}
      />
    );

    const embeddedContent = getEmbeddedDockerComposeContent(container);
    expect(embeddedContent).not.toContain('TR_HOPS_LIMIT');
    expect(embeddedContent).not.toContain('TEXT_MESSAGE_MAX_HOPS');
  });
});
