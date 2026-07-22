import { pathToFileURL } from 'node:url';
import { inspectEfestoBootstrap, writeLauncherConfig } from './efesto-bootstrap.mjs';
import { openEfestoLauncher, repairEfestoLauncher, shutdownEfestoLauncher } from './efesto-launcher-core.mjs';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printStatus(status) {
  console.log(`Efesto Launcher: ${status.overall.toUpperCase()}`);
  console.log(status.message);
  console.log('');
  console.log(`Kernel:   ${status.kernel}`);
  console.log(`Hermes:   ${status.hermes}`);
  console.log(`Obsidian: ${status.obsidian}`);
  console.log(`Pairing:  ${status.pairing}`);
  console.log('');
  console.log(`Actions: ${status.actions.map((action) => action.label).join(', ') || 'none'}`);
  console.log('');
  console.log('Technical diagnostics:');
  console.log(JSON.stringify(status.diagnostics, null, 2));
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] ?? 'repair';
  const obsidianDir = arg('--obsidian-dir');
  if (obsidianDir) await writeLauncherConfig({ obsidianDir });

  if (command === 'status') {
    return printStatus(await inspectEfestoBootstrap());
  }
  if (command === 'repair' || command === 'start') {
    const result = await repairEfestoLauncher();
    printStatus(result.status);
    if (result.status.overall === 'ready') {
      console.log('Ready for daily use: open the extension and press the central Efesto orb.');
    }
    if (result.status.overall === 'failed') process.exitCode = 1;
    return;
  }
  if (command === 'open') {
    const result = await openEfestoLauncher();
    printStatus(result.status);
    if (!result.opened) process.exitCode = 1;
    return;
  }
  if (command === 'shutdown') {
    const result = await shutdownEfestoLauncher();
    printStatus(result.status);
    console.log(result.stopped ? 'Shutdown requested for the owned Efesto Kernel process.' : 'No owned Efesto Kernel process was stopped.');
    return;
  }
  if (command === 'help' || command === '--help') return printHelp();
  console.error(`Unknown Efesto Launcher command: ${command}`);
  printHelp();
  process.exitCode = 2;
}

function printHelp() {
  console.log(`Efesto Launcher for Windows\n\nUsage:\n  pnpm efesto:launcher [repair|status|open|shutdown] [--obsidian-dir <path>]\n\nDaily use:\n  1. Run repair/start once from the launcher.\n  2. Pair the extension if requested.\n  3. Press the central Efesto orb in the extension.\n\nSecurity:\n  Tokens are stored privately by the Kernel and are never printed by this launcher.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
