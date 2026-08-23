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
import { addressLines } from '../server/addresses.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT ?? '8080';

console.log('');
console.log('  Nabz - clinic mode');
console.log('  This machine holds the queue: names, ages, tokens and fees.');
console.log('  It holds NO prescriptions, examinations or growth records -');
console.log("  those stay on the doctor's own device.");
console.log('');
// Shared with the packaged station so the advice cannot drift apart. Both used
// to build their own list and both got it wrong the same way.
for (const line of addressLines(networkInterfaces(), port)) console.log(line);
console.log('');

const result = spawnSync(process.execPath, [join(root, 'server', 'index.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NABZ_MODE: 'clinic', PORT: port },
});
process.exit(result.status ?? 1);
