import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReplacedTag } from './ReplacedTag';

const target = { internal_id: 'n2', protocol: 1 as const, meshtastic_node_id: 2304338203, node_id_str: '!8959691b' };

const renderTag = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ReplacedTag', () => {
  it('shows "Replaced → id" linking the new node', () => {
    renderTag(<ReplacedTag replacedBy={target} />);
    expect(screen.getByTestId('replaced-tag')).toHaveTextContent('Replaced → !8959691b');
    expect(screen.getByRole('link', { name: /!8959691b/ })).toHaveAttribute('href', '/nodes/!8959691b');
  });

  it('supports the "Replaced by" wording', () => {
    renderTag(<ReplacedTag replacedBy={target} label="Replaced by" />);
    expect(screen.getByTestId('replaced-tag')).toHaveTextContent('Replaced by !8959691b');
  });

  it('links MeshCore ids', () => {
    renderTag(
      <ReplacedTag
        replacedBy={{ internal_id: 'm', protocol: 2, meshtastic_node_id: null, node_id_str: 'mc:aabbccddeeff' }}
      />
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/nodes/mc%3Aaabbccddeeff');
  });

  it.each([[null], [undefined]])('renders nothing for %s', (v) => {
    const { container } = renderTag(<ReplacedTag replacedBy={v} />);
    expect(container).toBeEmptyDOMElement();
  });
});
