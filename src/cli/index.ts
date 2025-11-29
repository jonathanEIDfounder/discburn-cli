import * as readline from 'readline';
import { parseNaturalLanguage } from '../adapters/openai';
import { executeCommand } from '../core/executor';

const VERSION = '1.0.0';

function printBanner() {
  console.log(`
╔═══════════════════════════════════════╗
║           DiscBurn CLI v${VERSION}          ║
║   Universal File Backup & Burning     ║
╚═══════════════════════════════════════╝
`);
  console.log('Type commands in plain English. Type "help" for available commands.\n');
}

async function processInput(input: string): Promise<boolean> {
  const trimmed = input.trim();
  
  if (!trimmed) return true;
  
  if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
    console.log('\nGoodbye!\n');
    return false;
  }
  
  console.log('\nProcessing...');
  
  const parsed = await parseNaturalLanguage(trimmed);
  const result = await executeCommand(parsed.intent, parsed.target, parsed.parameters);
  
  if (result.success) {
    console.log('\n' + result.message);
  } else {
    console.log('\n[Error] ' + result.message);
  }
  
  console.log('');
  return true;
}

async function runInteractive() {
  printBanner();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const prompt = () => {
    rl.question('discburn> ', async (input) => {
      const shouldContinue = await processInput(input);
      if (shouldContinue) {
        prompt();
      } else {
        rl.close();
        process.exit(0);
      }
    });
  };
  
  prompt();
}

async function runCommand(command: string) {
  const parsed = await parseNaturalLanguage(command);
  const result = await executeCommand(parsed.intent, parsed.target, parsed.parameters);
  
  if (result.success) {
    console.log(result.message);
  } else {
    console.error('[Error]', result.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    if (args[0] === '--run' || args[0] === '-r') {
      const command = args.slice(1).join(' ');
      if (command) {
        await runCommand(command);
      } else {
        console.error('Usage: discburn --run "command"');
        process.exit(1);
      }
    } else {
      await runCommand(args.join(' '));
    }
  } else {
    await runInteractive();
  }
}

main().catch(console.error);
