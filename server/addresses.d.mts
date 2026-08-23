/**
 * Types for the address ranking, which is authored in plain JavaScript so the
 * server can run it from source and from inside the packaged .exe without a
 * TypeScript build step. These declarations exist for the tests, which are the
 * only TypeScript that touches it.
 */

export type AddressKind = 'lan' | 'virtual' | 'link-local';

export interface RankedAddress {
  address: string;
  /** the OS's name for the adapter, e.g. "Wi-Fi", "VirtualBox Host-Only Network" */
  iface: string;
  kind: AddressKind;
}

/** Shaped like the entries `os.networkInterfaces()` returns. */
export interface InterfaceEntry {
  address: string;
  family: string;
  internal: boolean;
}

export type InterfaceMap = Record<string, InterfaceEntry[] | undefined>;

export function classify(address: string, iface?: string): AddressKind;

export function rankAddresses(interfaces: InterfaceMap | undefined): RankedAddress[];

export function stationAddresses(interfaces: InterfaceMap | undefined): {
  /** the one to put in front of a human; null when nothing usable exists */
  best: RankedAddress | null;
  others: RankedAddress[];
  /** the only addresses on offer are an unconfigured direct cable */
  linkLocalOnly: boolean;
};

/** The address advice as printable ASCII lines, shared by every launcher. */
export function addressLines(
  interfaces: InterfaceMap | undefined,
  port: string | number,
): string[];
