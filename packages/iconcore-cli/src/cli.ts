#!/usr/bin/env node

import { buildCommand } from './commands/build';
import { auditCommand } from './commands/audit';
import { createCommand } from './commands/create';
import { inspectCommand } from './commands/inspect';

const args = process.argv.slice(2);
const command = args[0];

const printHelp = () => {
  console.log(`
IconCore CLI v1.0.0

Usage: iconcore <command> [options]

Commands:
  build <project>    Build icons from a .iconcore.json project
  audit <project>    Audit project quality
  create             Create a new project from a preset
  inspect <project>  Inspect project metadata

Options:
  --help, -h         Show help
  --version, -v      Show version

Examples:
  iconcore build ./project.iconcore.json --target pwa --out ./public/
  iconcore audit ./project.iconcore.json
  iconcore create --preset tauri --name "My App"
  iconcore inspect ./project.iconcore.json
`);
};

const main = async () => {
  if (!command || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('1.0.0');
    process.exit(0);
  }

  try {
    switch (command) {
      case 'build':
        await buildCommand(args.slice(1));
        break;
      case 'audit':
        await auditCommand(args.slice(1));
        break;
      case 'create':
        await createCommand(args.slice(1));
        break;
      case 'inspect':
        await inspectCommand(args.slice(1));
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
};

main();