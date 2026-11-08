import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FirmwareBadge, FeederFirmware } from './FirmwareBadge';

describe('FirmwareBadge', () => {
  it('renders nothing for MeshCore', () => {
    const { container } = render(
      <FirmwareBadge node={{ protocol: 2, inferred_firmware: '2.8', inferred_firmware_basis: 'key_identity' }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the API omits the field', () => {
    const { container } = render(<FirmwareBadge node={{ protocol: 1 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Unknown for null', () => {
    render(<FirmwareBadge node={{ protocol: 1, inferred_firmware: null, inferred_firmware_basis: null }} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows 2.7 or earlier (inferred)', () => {
    render(<FirmwareBadge node={{ protocol: 1, inferred_firmware: '2.7', inferred_firmware_basis: 'predicted_id' }} />);
    expect(screen.getByText('2.7 or earlier (inferred)')).toBeInTheDocument();
  });

  it.each(['key_identity', 'predicted_id'])('shows 2.8+ (inferred) for basis %s', (basis) => {
    render(<FirmwareBadge node={{ protocol: 1, inferred_firmware: '2.8', inferred_firmware_basis: basis }} />);
    expect(screen.getByText('2.8+ (inferred)')).toBeInTheDocument();
  });

  it('shows 2.8+ (reported) for feeder_report', () => {
    render(<FirmwareBadge node={{ protocol: 1, inferred_firmware: '2.8', inferred_firmware_basis: 'feeder_report' }} />);
    expect(screen.getByText('2.8+ (reported)')).toBeInTheDocument();
  });

  it('shows 2.7 (reported) for feeder_report', () => {
    render(<FirmwareBadge node={{ protocol: 1, inferred_firmware: '2.7', inferred_firmware_basis: 'feeder_report' }} />);
    expect(screen.getByText('2.7 (reported)')).toBeInTheDocument();
    expect(screen.queryByText(/earlier/i)).not.toBeInTheDocument();
  });

  it('shows Unknown for an empty string', () => {
    render(<FirmwareBadge node={{ protocol: 1, inferred_firmware: '', inferred_firmware_basis: null }} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows a later generation as inferred', () => {
    render(<FirmwareBadge node={{ protocol: 1, inferred_firmware: '2.9', inferred_firmware_basis: 'key_identity' }} />);
    expect(screen.getByText('2.9+ (inferred)')).toBeInTheDocument();
  });

  it('treats an unrecognised basis as inferred, never assumed', () => {
    render(<FirmwareBadge node={{ protocol: 1, inferred_firmware: '2.9', inferred_firmware_basis: 'new_rule' }} />);
    expect(screen.getByText('2.9+ (inferred)')).toBeInTheDocument();
    expect(screen.queryByText(/assumed/i)).not.toBeInTheDocument();
  });
});

describe('FeederFirmware', () => {
  it('shows a dash when not reported', () => {
    render(<FeederFirmware node={{ reported_firmware_version: null, firmware_reported_at: null }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows a dash when the API omits the fields', () => {
    render(<FeederFirmware node={{}} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the version when reported without a time', () => {
    const { container } = render(
      <FeederFirmware node={{ reported_firmware_version: '2.8.2.d5f1619', firmware_reported_at: null }} />
    );
    expect(screen.getByText('2.8.2.d5f1619')).toBeInTheDocument();
    expect(container.querySelector('time')).toBeNull();
  });

  it('shows the version with the reported time', () => {
    const at = new Date(Date.now() - 60_000).toISOString();
    const { container } = render(
      <FeederFirmware node={{ reported_firmware_version: '2.8.2.d5f1619', firmware_reported_at: at }} />
    );
    expect(screen.getByText('2.8.2.d5f1619')).toBeInTheDocument();
    expect(container.querySelector('time')).not.toBeNull();
  });
});
