/**
 * Start the server in CLINIC mode — the reception-station launcher.
 *
 * Exists so a clinic never has to set an environment variable by hand, and so
 * the thing it prints on startup is the LAN address a doctor's tablet should
 * open. Sets the variable in JavaScript rather than shell syntax, because
 * `FOO=bar cmd` is a bash-ism that fails in PowerShell.
 */
import { spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT ?? '8080';

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => n.address);

console.log('');
console.log('  Nabz — clinic mode');
console.log('  This machine holds the queue: names, ages, tokens and fees.');
console.log('  It holds NO prescriptions, examinations or growth records —');
console.log('  those stay on the doctor\'s own device.');
console.log('');
console.log('  Open on this machine:  http://localhost:' + port);
for (const address of addresses) {
  console.log('  From another device:   http://' + address + ':' + port);
}
console.log('');

const result = spawnSync(process.execPath, [join(root, 'server', 'index.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NABZ_MODE: 'clinic', PORT: port },
});
process.exit(result.status ?? 1);
