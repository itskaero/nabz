/**
 * Which address should a receptionist actually type into a phone?
 *
 * THE BUG THIS REPLACES
 * ---------------------
 * The station used to print every non-internal IPv4 it could find, in whatever
 * order the OS returned them. On a developer's machine that looked like this:
 *
 *   From a tablet/phone:   http://192.168.56.1:8080     <- VirtualBox, useless
 *   From a tablet/phone:   http://192.168.56.2:8080     <- VirtualBox, useless
 *   From a tablet/phone:   http://192.168.100.2:8080    <- the real one
 *
 * Two of the three cannot work from another device: they belong to virtual
 * adapters that exist only inside that PC. Someone setting a clinic up tries the
 * first address, gets nothing, and concludes the product does not work -- which
 * makes this the most likely first impression of the entire two-station feature.
 *
 * So the station now ranks what it finds and commits to a recommendation, rather
 * than handing over a list and hoping.
 *
 * Plain JavaScript on purpose: the server runs this straight from source and
 * also from inside the packaged .exe, so it must not need a build step.
 */

/**
 * Adapter names that are virtual on some platform or other. Matched
 * case-insensitively against the interface name.
 *
 * These are hypervisors, container bridges and overlay VPNs. Every one of them
 * hands out an address that is real to this machine and unreachable from the
 * next desk.
 */
const VIRTUAL_NAMES =
  /virtualbox|vmware|vmnet|hyper-?v|vethernet|docker|wsl|tailscale|zerotier|utun|tap-?windows|npcap|loopback|bluetooth/i;

/**
 * Ranges that are virtual regardless of what the adapter calls itself.
 *
 * Kept deliberately narrow. `192.168.56.0/24` is VirtualBox's host-only default
 * and `198.18.0.0/15` is a benchmarking range some VPNs borrow -- neither shows
 * up on a real clinic LAN. Docker's `172.17.x` is NOT here even though it is
 * tempting: `172.16.0.0/12` is a legitimate private range that a real network
 * may well use, and demoting a clinic's only real address to "probably not this
 * one" is a worse failure than listing one extra adapter. Docker is caught by
 * name instead.
 */
const VIRTUAL_RANGES = [/^192\.168\.56\./, /^198\.1[89]\./];

/** Windows' "no DHCP answered" fallback. Not an error, but not usable as-is either. */
const LINK_LOCAL = /^169\.254\./;

/**
 * Classify one address.
 *
 * `lan` is what we want; `virtual` cannot be reached from another device;
 * `link-local` means nothing assigned this machine an address, which is the
 * direct-cable case and needs a static IP before it will work.
 */
export function classify(address, iface = '') {
  if (LINK_LOCAL.test(address)) return 'link-local';
  if (VIRTUAL_NAMES.test(iface)) return 'virtual';
  if (VIRTUAL_RANGES.some((re) => re.test(address))) return 'virtual';
  return 'lan';
}

const RANK = { lan: 0, virtual: 1, 'link-local': 2 };

/**
 * Rank every IPv4 this machine has, best first.
 *
 * Takes the shape `os.networkInterfaces()` returns so it can be tested against
 * a captured real-world example rather than only against whatever the test
 * machine happens to have plugged in.
 */
export function rankAddresses(interfaces) {
  const found = [];
  for (const [iface, entries] of Object.entries(interfaces ?? {})) {
    for (const entry of entries ?? []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      found.push({ address: entry.address, iface, kind: classify(entry.address, iface) });
    }
  }
  // Stable within a kind: the OS order is as good a tiebreak as any, and a
  // stable answer across restarts matters more than a clever one.
  return found
    .map((row, i) => ({ row, i }))
    .sort((a, b) => RANK[a.row.kind] - RANK[b.row.kind] || a.i - b.i)
    .map(({ row }) => row);
}

/**
 * The one address to put in front of a human, plus the rest as fallbacks.
 *
 * `best` is null when nothing usable exists -- no network, or every adapter is
 * virtual -- and the caller must say so plainly instead of printing a URL that
 * cannot work.
 */
export function stationAddresses(interfaces) {
  const ranked = rankAddresses(interfaces);
  const best = ranked.find((r) => r.kind === 'lan') ?? null;
  return {
    best,
    others: ranked.filter((r) => r !== best),
    /** true when the only thing on offer is an unconfigured direct cable */
    linkLocalOnly: ranked.length > 0 && ranked.every((r) => r.kind === 'link-local'),
  };
}

/**
 * The address advice, as printable lines.
 *
 * Written once and shared by the packaged station and the `start:clinic`
 * launcher. They used to each build their own list, and each got it wrong the
 * same way -- so the guidance lives here, where fixing it fixes both.
 *
 * ASCII only: the Windows console mangles anything else.
 */
export function addressLines(interfaces, port) {
  const { best, others, linkLocalOnly } = stationAddresses(interfaces);
  const lines = ['  On this computer:      http://localhost:' + port];

  if (best) lines.push('  From a tablet/phone:   http://' + best.address + ':' + port);

  if (others.length) {
    lines.push('');
    lines.push('  If that does not work, these also exist on this PC -- most are');
    lines.push('  virtual adapters and will NOT work from another device:');
    for (const row of others) {
      lines.push(
        '     http://' + row.address + ':' + port +
          (row.kind === 'virtual' ? '  (virtual - probably not this one)' : ''),
      );
    }
  }

  if (!best) {
    lines.push('');
    lines.push('  No usable network address found. This PC can still be used on');
    lines.push('  its own, but no other device can reach the queue yet.');
  }

  if (linkLocalOnly) {
    lines.push('');
    lines.push('  Those addresses start 169.254, which means nothing assigned this');
    lines.push('  PC an address -- the direct-cable case. Set a fixed IP on both');
    lines.push('  machines and restart.');
  }

  return lines;
}
