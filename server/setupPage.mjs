/**
 * The page a phone lands on before it can trust this station.
 *
 * WHY THE PLAIN PORT SERVES A PAGE AT ALL
 * ---------------------------------------
 * A device that has not trusted the station's CA cannot usefully load the
 * HTTPS site: it gets a certificate warning, and clicking through does NOT
 * restore a secure context (see `tls.mjs`). So the http:// address is where
 * people land to install the certificate, rather than a second copy of the
 * app.
 *
 * WHAT CHANGED, AND WHY
 * ---------------------
 * Connecting a device used to mean reading an IP address off a terminal
 * window, typing it in, getting past the warning, reading a six-digit code
 * off the same terminal and typing that in too. A receptionist should never
 * be asked to read a terminal, and two of those steps look to a non-technical
 * person exactly like the things they have been taught to be afraid of.
 *
 * So the address and the pairing code are HERE, large enough to read across a
 * desk, and the last step is a QR that carries both.
 *
 * ORDER MATTERS. The certificate comes before the QR, not after: scanning
 * first lands on an https:// address the device does not trust yet, which is
 * the warning this page exists to avoid.
 *
 * The iOS two-step is spelled out because everybody misses the second half
 * and then reports that it did not work.
 *
 * Deliberately styled with literal hexes rather than the app's tokens: this
 * page is served before the app's stylesheet is reachable, by a process that
 * does not import the app.
 */
import { qrSvg } from './qr.mjs';

const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/**
 * @param {object} station
 * @param {string} station.httpsUrl   the address to open once the CA is trusted
 * @param {string} station.pairing    the six-digit code
 * @param {string} station.fingerprint the CA's SHA-256, as the browser shows it
 * @param {string[]} [station.addresses] every LAN address the cert covers
 */
export function setupPage({ httpsUrl, pairing, fingerprint, addresses = [] }) {
  const deepLink = `${httpsUrl}/#pair=${pairing}`;
  /*
    A QR that fails to render must not take the page with it. The page is the
    only route onto this station for a device that cannot read a terminal, and
    the address below the code still works by hand.
  */
  let qr = '';
  try {
    qr = qrSvg(deepLink, { size: 232 });
  } catch {
    qr = '';
  }

  const alternatives = addresses
    .filter((a) => !httpsUrl.includes(a))
    .map((a) => `<li><code>https://${escape(a)}${escape(new URL(httpsUrl).port ? ':' + new URL(httpsUrl).port : '')}</code></li>`)
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Set up this device &mdash; Nabz</title>
<style>
  body{font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;margin:0;
       background:#eff5f1;color:#14201f}
  main{max-width:34rem;margin:0 auto;padding:20px 18px 60px}
  h1{font-size:20px;margin:18px 0 4px} h2{font-size:15px;margin:22px 0 6px}
  .card{background:#fff;border:1px solid #dde7e2;border-radius:12px;padding:16px;margin:14px 0}
  a.btn{display:block;text-align:center;background:#0f766e;color:#fff;
        text-decoration:none;padding:13px;border-radius:9px;font-weight:600}
  ol{padding-left:20px;margin:6px 0} li{margin:4px 0}
  ul{padding-left:20px;margin:6px 0}
  code{background:#eff5f1;padding:1px 5px;border-radius:4px;font-size:14px;
       word-break:break-all}
  .why{color:#55635f;font-size:14px}
  .qr{text-align:center;margin:4px 0 10px}
  .qr svg{border:1px solid #dde7e2;border-radius:9px}
  .big{font:600 30px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
       letter-spacing:0.12em;text-align:center;margin:6px 0}
  .fp{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
      word-break:break-all;color:#14201f;background:#eff5f1;
      padding:8px 10px;border-radius:6px;margin:6px 0}
</style></head><body><main>
<h1>Set up this device</h1>
<p class="why">This clinic&rsquo;s computer issues its own certificate. Installing
it once lets your phone use Nabz securely &mdash; which is what allows encrypted
backups, the PIN, and working offline. Without it the browser switches all three off.</p>

<div class="card">
  <h2>Step 1 &mdash; download the certificate</h2>
  <p><a class="btn" href="/ca.crt" download="nabz-clinic.crt">Download certificate</a></p>
</div>

<div class="card">
  <h2>Step 2 &mdash; trust it</h2>
  <p><strong>iPhone / iPad &mdash; this is two steps and the second is easy to miss:</strong></p>
  <ol>
    <li>Settings &rarr; <em>Profile Downloaded</em> &rarr; Install</li>
    <li>Settings &rarr; General &rarr; About &rarr; <strong>Certificate Trust
        Settings</strong> &rarr; switch on <em>Nabz Clinic Station CA</em></li>
  </ol>
  <p><strong>Android:</strong> Settings &rarr; Security &rarr; Encryption &amp;
     credentials &rarr; Install a certificate &rarr; <strong>CA certificate</strong>.</p>
  <p><strong>Windows:</strong> double-click the file &rarr; Install Certificate
     &rarr; Local Machine &rarr; Place in <em>Trusted Root Certification Authorities</em>.</p>
  <p class="why">Whatever the device shows you, it should say this fingerprint.
     If it says anything else, stop &mdash; you are not talking to this computer.</p>
  <div class="fp">${escape(fingerprint)}</div>
</div>

<div class="card">
  <h2>Step 3 &mdash; open Nabz</h2>
  ${qr ? `<div class="qr">${qr}</div>
  <p class="why" style="text-align:center">Point the camera at this. It opens the
     app and pairs this device in one step &mdash; no code to type.</p>` : ''}
  <p><a class="btn" href="${escape(deepLink)}">${escape(httpsUrl)}</a></p>
  <p class="why">Or open that address by hand, and enter this pairing code when
     the app asks:</p>
  <div class="big">${escape(pairing)}</div>
  ${alternatives ? `<p class="why">If that address does not reach this computer,
     one of these will:</p><ul>${alternatives}</ul>` : ''}
  <p class="why">Add it to your home screen from there, so it opens like an app
     and keeps working when this computer is off.</p>
</div>

<p class="why">Installing a certificate authority is a real decision: this one can
vouch for any site to this device. It was generated on the clinic&rsquo;s own
computer and its private key never leaves it. To undo this, remove
&ldquo;Nabz Clinic Station CA&rdquo; from the same settings screen.</p>
</main></body></html>`;
}
