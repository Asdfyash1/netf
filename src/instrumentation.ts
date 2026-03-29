export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize any services here if needed
    console.log('Netflix Cookie Checker initialized');
    
    // Auto-start Telegram Bot on deployment/restart
    try {
      const { startBot } = await import('./lib/telegram-bot');
      startBot().then(res => {
        console.log('Bot Auto-Start:', res.message);
      }).catch(err => {
        console.error('Failed to auto-start bot:', err);
      });
    } catch (err) {
      console.error('Error importing telegram-bot module:', err);
    }
  }
}
