/**
 * Which address the station tells a receptionist to type.
 *
 * This is a first-impression bug, not a correctness bug, and those are easy to
 * dismiss. It is here because the failure mode is silent and total: someone sets
 * a clinic up, types the first address the station printed, gets nothing, and
 * concludes the two-station feature does not work. The station has to commit to
 * a recommendation rather than hand over a list.
 *
 * The fixture in the first test is real output captured from the packaged .exe
 * on the development machine, virtual adapters and all.
 */
import { describe, expect, it } from 'vitest';
import { classify, rankAddresses, stationAddresses } from '../server/addresses.mjs';

/** Shaped like os.networkInterfaces(), trimmed to the fields we read. */
const iface = (address: string, internal = false) => ({
  address,
  family: 'IPv4' as const,
  internal,
});

describe('the real machine that exposed this', () => {
  // Captured verbatim: the station printed all three as "From a tablet/phone",
  // and only the last one could possibly work.
  const real = {
    'VirtualBox Host-Only Network': [iface('192.168.56.1')],
    'VirtualBox Host-Only Network #2': [iface('192.168.56.2')],
    'Wi-Fi': [iface('192.168.100.2')],
    'Loopback Pseudo-Interface 1': [iface('127.0.0.1', true)],
  };

  it('recommends the one address a phone can actually reach', () => {
    const { best, others } = stationAddresses(real);
    expect(best?.address).toBe('192.168.100.2');
    // The VirtualBox pair is still offered as a fallback -- someone's setup may
    // genuinely differ -- but it is never the headline.
    expect(others.map((o) => o.address)).toEqual(['192.168.56.1', '192.168.56.2']);
    expect(others.every((o) => o.kind === 'virtual')).toBe(true);
  });

  it('never puts a virtual adapter first', () => {
    expect(rankAddresses(real)[0]!.address).toBe('192.168.100.2');
  });

  it('leaves loopback out entirely', () => {
    expect(rankAddresses(real).map((r) => r.address)).not.toContain('127.0.0.1');
  });
});

describe('classify', () => {
  it('knows the hypervisors and container bridges by name', () => {
    expect(classify('10.0.0.5', 'vEthernet (WSL)')).toBe('virtual');
    expect(classify('172.17.0.1', 'docker0')).toBe('virtual');
    expect(classify('192.168.230.1', 'VMware Network Adapter VMnet8')).toBe('virtual');
    expect(classify('100.64.0.1', 'Tailscale')).toBe('virtual');
  });

  it('catches VirtualBox by range even when the name is unhelpful', () => {
    // Some setups rename the adapter; the range is the more reliable signal.
    expect(classify('192.168.56.1', 'Ethernet 3')).toBe('virtual');
  });

  it('calls a real LAN address a real LAN address', () => {
    expect(classify('192.168.100.2', 'Wi-Fi')).toBe('lan');
    expect(classify('192.168.1.44', 'Ethernet')).toBe('lan');
    expect(classify('10.20.30.40', 'Ethernet')).toBe('lan');
  });

  it('spots the no-DHCP fallback', () => {
    expect(classify('169.254.12.9', 'Ethernet')).toBe('link-local');
  });

  it('does not demote a real network that happens to use 172.16/12', () => {
    // Docker's default bridge lives at 172.17.x, but 172.16.0.0/12 is a
    // legitimate private range a real clinic may be on. Demoting a clinic's
    // ONLY real address to "probably not this one" is worse than listing one
    // extra adapter, so this is matched by adapter name, not by range.
    expect(classify('172.17.4.9', 'Ethernet')).toBe('lan');
    expect(classify('172.17.0.1', 'docker0')).toBe('virtual');
  });
});

describe('when there is nothing good to offer', () => {
  it('recommends nothing rather than something that cannot work', () => {
    const onlyVirtual = { 'VirtualBox Host-Only Network': [iface('192.168.56.1')] };
    const { best, others } = stationAddresses(onlyVirtual);
    // A confident wrong answer is worse than no answer: the caller prints
    // "no usable network address" instead of a URL that will never load.
    expect(best).toBeNull();
    expect(others).toHaveLength(1);
  });

  it('flags a direct cable with no router', () => {
    const cable = { Ethernet: [iface('169.254.7.7')] };
    expect(stationAddresses(cable).linkLocalOnly).toBe(true);
    expect(stationAddresses(cable).best).toBeNull();
  });

  it('survives a machine with no network at all', () => {
    expect(stationAddresses({}).best).toBeNull();
    expect(stationAddresses({}).linkLocalOnly).toBe(false);
    expect(rankAddresses(undefined)).toEqual([]);
  });
});
