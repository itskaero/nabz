/**
 * A certificate the clinic's own devices trust.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * A doctor's phone opens the station's LAN address. `http://192.168.0.159:8080`
 * is not a *secure context*, so the browser withholds `crypto.subtle` — and with
 * it the encrypted backup, the PIN, and the service worker. On a device holding
 * the only copy of every clinical record, with the export as the sole recovery
 * path. Serving HTTPS is what restores all three.
 *
 * A SELF-SIGNED CERT IS NOT ENOUGH ON ITS OWN
 * -------------------------------------------
 * A certificate error disqualifies the origin exactly as plain HTTP does, so
 * clicking through a browser warning does NOT give a secure context. The device
 * has to actually trust the issuer. Hence a small local CA: installed once per
 * device, and thereafter every certificate this station issues is trusted.
 *
 * WHY THE CA AND THE LEAF ARE SEPARATE
 * ------------------------------------
 * The leaf must name the station's IP addresses in its SANs — browsers ignore
 * CN entirely and match on SAN — and those addresses change. Observed three
 * times in one afternoon on a real clinic network: 192.168.100.2 (ONT), then
 * 192.168.0.159, then 192.168.0.15, then back to .159 once a DHCP reservation
 * took hold. If the address were baked into a self-signed cert, every change
 * would mean re-trusting on every device.
 *
 * So the CA is long-lived and trusted once; the leaf is reissued from it
 * whenever the address set changes, and no device has to do anything.
 *
 * node-forge rather than OpenSSL: stock Windows has no `openssl`, and this has
 * to work inside the packaged .exe where there is no shell to call out to.
 * `node:crypto` can generate keypairs but cannot sign X.509.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
// A static import on purpose. `createRequire(process.execPath)` resolves from
// Node's own install directory, which finds builtins like node:sea but not a
// package in node_modules; esbuild bundles this one into the .exe build.
import forge from 'node-forge';

/** Ten years. Re-trusting a CA is the one step that annoys a whole clinic. */
const CA_YEARS = 10;
/** Leaves are cheap to reissue, and a short life limits a stolen key's value. */
const LEAF_DAYS = 397;

function certNames(common, org) {
  return [
    { name: 'commonName', value: common },
    { name: 'organizationName', value: org },
    { shortName: 'OU', value: 'Nabz clinic station' },
  ];
}

/** Serial numbers must be positive; a leading zero byte keeps them so. */
function serial() {
  return '00' + forge.util.bytesToHex(forge.random.getBytesSync(16));
}

function makeCa() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + CA_YEARS);

  const attrs = certNames('Nabz Clinic Station CA', 'Nabz');
  cert.setSubject(attrs);
  cert.setIssuer(attrs); // self-signed: this IS the root
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

/**
 * A leaf for exactly these addresses.
 *
 * `localhost` and `127.0.0.1` are always included: the station's own browser
 * uses them, and they are a secure context anyway, so the cert must not break
 * the one path that already worked.
 */
function makeLeaf(ca, addresses) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + LEAF_DAYS);

  cert.setSubject(certNames(addresses[0] ?? 'localhost', 'Nabz'));
  cert.setIssuer(ca.cert.subject.attributes);

  // type 2 = DNS name, type 7 = IP address. Browsers match on these and
  // ignore commonName entirely, so a cert without IP SANs fails outright.
  const altNames = [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }];
  for (const address of addresses) {
    if (address === '127.0.0.1') continue;
    altNames.push({ type: 7, ip: address });
  }

  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());
  return { cert, key: keys.privateKey, addresses };
}

/** The IP SANs currently baked into a certificate. */
function sansOf(cert) {
  const ext = cert.extensions.find((e) => e.name === 'subjectAltName');
  return (ext?.altNames ?? [])
    .filter((a) => a.type === 7)
    .map((a) => a.ip)
    .filter((ip) => ip && ip !== '127.0.0.1')
    .sort();
}

/**
 * Load the station's CA and leaf, creating or reissuing as needed.
 *
 * Returns `{ key, cert, caPem, reissued, created }` — the PEMs `node:https`
 * wants, plus the CA for the setup page to hand out.
 */
export async function ensureCertificates(dir, addresses) {
  await mkdir(dir, { recursive: true });
  const paths = {
    caKey: join(dir, 'ca.key'),
    caCert: join(dir, 'ca.crt'),
    key: join(dir, 'station.key'),
    cert: join(dir, 'station.crt'),
  };

  let created = false;
  let ca;
  if (existsSync(paths.caKey) && existsSync(paths.caCert)) {
    ca = {
      key: forge.pki.privateKeyFromPem(await readFile(paths.caKey, 'utf8')),
      cert: forge.pki.certificateFromPem(await readFile(paths.caCert, 'utf8')),
    };
  } else {
    ca = makeCa();
    await writeFile(paths.caKey, forge.pki.privateKeyToPem(ca.key), 'utf8');
    await writeFile(paths.caCert, forge.pki.certificateToPem(ca.cert), 'utf8');
    created = true;
  }

  const wanted = [...new Set(addresses)].filter(Boolean).sort();

  let leaf = null;
  let reissued = false;
  if (!created && existsSync(paths.key) && existsSync(paths.cert)) {
    const cert = forge.pki.certificateFromPem(await readFile(paths.cert, 'utf8'));
    const have = sansOf(cert);
    const expired = cert.validity.notAfter.getTime() < Date.now();
    // Reissue when the machine's addresses have moved, which on a DHCP network
    // they will. The CA is untouched, so trusted devices stay trusted.
    if (!expired && have.join(',') === wanted.join(',')) {
      leaf = { pem: await readFile(paths.cert, 'utf8'), keyPem: await readFile(paths.key, 'utf8') };
    }
  }

  if (!leaf) {
    const made = makeLeaf(ca, wanted);
    leaf = {
      pem: forge.pki.certificateToPem(made.cert),
      keyPem: forge.pki.privateKeyToPem(made.key),
    };
    await writeFile(paths.cert, leaf.pem, 'utf8');
    await writeFile(paths.key, leaf.keyPem, 'utf8');
    reissued = !created;
  }

  return {
    key: leaf.keyPem,
    cert: leaf.pem,
    caPem: forge.pki.certificateToPem(ca.cert),
    addresses: wanted,
    created,
    reissued,
  };
}
