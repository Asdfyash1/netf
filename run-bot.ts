import { startBot } from './src/lib/telegram-bot';

async function main() {
  console.log('Starting bot locally...');
  const result = await startBot();
  console.log('Start result:', result);
}

main().catch(console.error);
