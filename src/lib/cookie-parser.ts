/**
 * Netflix Cookie Parser - ULTRA DYNAMIC & COMPREHENSIVE
 * Supports ALL cookie formats with multiple extraction strategies
 * Handles: PREMIUM ACCOUNT blocks, pipe format, plain cookies, JSON, and more
 */

export interface ParsedCookie {
  email: string;
  firstName?: string;
  country: string;
  memberSince?: string;
  membershipStatus?: string;
  plan: string;
  maxStreams?: string;
  videoQuality?: string;
  price?: string;
  paymentMethod?: string;
  cardBrand?: string;
  cardLast4?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  profilesCount?: number;
  profiles?: string[];
  nextBilling?: string;
  daysLeft?: string;
  nftoken?: string;
  phoneLoginUrl?: string;
  pcLoginUrl?: string;
  netflixId: string;
  secureNetflixId?: string;
  nfvdid?: string;
  rawCookie: string;
  lineNumber?: number;
  source?: string;
  extraMemberSlot?: string;
  connectedProfiles?: number;
  // Additional fields
  maxStreamsDisplay?: string;
  connectedProfilesDisplay?: string;
}

interface CookieExtractionResult {
  cookies: ParsedCookie[];
  totalFound: number;
  parseErrors: string[];
}

/**
 * MASTER NetflixId Extractor
 * Handles all formats with multiple extraction strategies
 */
function extractAllNetflixIds(text: string): string[] {
  const netflixIds: Set<string> = new Set();
  
  // STRATEGY 1: Extract from "🍪 Cookie:" prefix - FULL cookie string
  // This handles: 🍪 Cookie: NetflixId=...; OtherCookie=...; SecureNetflixId=...
  const cookiePrefixPattern = /🍪\s*Cookie\s*:\s*/gi;
  let match;
  let lastIndex = 0;
  
  while ((match = cookiePrefixPattern.exec(text)) !== null) {
    // Get the full cookie string that follows
    const startIndex = match.index + match[0].length;
    // Find the end of the cookie (next PREMIUM ACCOUNT marker or end of text)
    const nextAccount = text.indexOf('🔹 PREMIUM ACCOUNT', startIndex);
    const nextSeparator = text.indexOf('--------------------------------------------------------------------------------', startIndex);
    
    let endIndex = text.length;
    if (nextAccount > startIndex) endIndex = Math.min(endIndex, nextAccount);
    if (nextSeparator > startIndex) endIndex = Math.min(endIndex, nextSeparator);
    
    const cookieString = text.substring(startIndex, endIndex).trim();
    
    // Now extract NetflixId from this cookie string
    const netflixIdMatch = cookieString.match(/NetflixId=([^;\n\r]+)/i);
    if (netflixIdMatch && netflixIdMatch[1]) {
      const value = netflixIdMatch[1].trim();
      if (value.length > 30 && (value.includes('%') || value.includes('ct'))) {
        netflixIds.add(value);
      }
    }
  }
  
  // STRATEGY 2: Direct NetflixId= extraction with various formats
  // Pattern for NetflixId= followed by URL-encoded value until ; or end
  const directPatterns = [
    // v%3D format
    /NetflixId\s*=\s*(v%3D\d*%26ct%3D[A-Za-z0-9_\-+\/=]+)[;\s\n\r]/gi,
    /NetflixId\s*=\s*(v%3D[A-Za-z0-9%_\-+\/=]+)[;\s\n\r]/gi,
    // ct%3D format
    /NetflixId\s*=\s*(ct%3D[A-Za-z0-9_\-+\/=%]+)[;\s\n\r]/gi,
    // Generic format with pg parameter
    /NetflixId\s*=\s*([A-Za-z0-9%_\-+\/]+%26pg%3D[A-Z0-9]+)[;\s\n\r]/gi,
    // Catch-all for NetflixId= value until semicolon
    /NetflixId\s*=\s*([A-Za-z0-9%_\-+\/=]{30,})[;\s\n\r]/gi,
  ];
  
  for (const pattern of directPatterns) {
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      const value = m[1].trim();
      if (value.length > 30 && value.includes('%')) {
        netflixIds.add(value);
      }
    }
  }
  
  // STRATEGY 3: Extract from pipe format | NetflixId = value |
  const pipePattern = /\|\s*NetflixId\s*[=:]\s*([^|;\n\r]+)/gi;
  let pipeMatch;
  while ((pipeMatch = pipePattern.exec(text)) !== null) {
    const value = pipeMatch[1].trim();
    if (value.length > 30 && value.includes('%')) {
      netflixIds.add(value);
    }
  }
  
  // STRATEGY 4: Extract from "Cookie:" prefix format (without emoji)
  const cookieColonPattern = /Cookie\s*:\s*NetflixId=([^;\n\r]+)/gi;
  let colonMatch;
  while ((colonMatch = cookieColonPattern.exec(text)) !== null) {
    const value = colonMatch[1].trim();
    if (value.length > 30 && value.includes('%')) {
      netflixIds.add(value);
    }
  }
  
  return Array.from(netflixIds);
}

/**
 * Extract SecureNetflixId from text
 */
function extractSecureNetflixId(text: string): string | null {
  const patterns = [
    /SecureNetflixId\s*=\s*(v%3D\d*%26mac%3D[A-Za-z0-9_\-+\/=%]+)[;\s]/gi,
    /SecureNetflixId\s*=\s*([^;\s|]+)/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value.length > 10) return value;
    }
  }
  return null;
}

/**
 * Extract nfvdid from text
 */
function extractNfvdid(text: string): string | null {
  const match = text.match(/nfvdid\s*=\s*([^;\s|]+)/gi);
  return match ? match[1]?.trim() : null;
}

/**
 * Extract NFToken from URLs or direct format
 */
function extractNFToken(text: string): string | null {
  // Try URL format: nftoken=VALUE
  const urlMatch = text.match(/nftoken=([A-Za-z0-9_\-+\/=%]+)[\s\n]/i);
  if (urlMatch) return urlMatch[1].trim();
  
  // Try direct nftoken= format
  const directMatch = text.match(/nftoken=([A-Za-z0-9_\-+\/=%]+)/i);
  if (directMatch) return directMatch[1].trim();
  
  return null;
}

/**
 * Extract Phone Login URL
 */
function extractPhoneLoginUrl(text: string): string | null {
  const match = text.match(/Phone Login URL\s*:\s*(https?:\/\/[^\s\n]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Extract PC Login URL
 */
function extractPcLoginUrl(text: string): string | null {
  const match = text.match(/PC Login URL\s*:\s*(https?:\/\/[^\s\n]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Extract email from text
 */
function extractEmail(text: string): string {
  // First, decode hex-escaped characters like \x40 -> @
  const decodedText = text.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  
  const match = decodedText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Parse key-value pairs from emoji/block format
 */
function parseKeyValueFromBlock(block: string, cookie: ParsedCookie): void {
  const lines = block.split('\n');
  
  // Extract nftoken from URLs in the block
  const phoneLoginUrl = extractPhoneLoginUrl(block);
  const pcLoginUrl = extractPcLoginUrl(block);
  
  if (phoneLoginUrl) cookie.phoneLoginUrl = phoneLoginUrl;
  if (pcLoginUrl) cookie.pcLoginUrl = pcLoginUrl;
  
  // Extract nftoken from the URLs
  if (phoneLoginUrl || pcLoginUrl) {
    const nftoken = extractNFToken(phoneLoginUrl || pcLoginUrl || '');
    if (nftoken) cookie.nftoken = nftoken;
  }
  
  // Also try to extract nftoken directly from block
  if (!cookie.nftoken) {
    const directNftoken = extractNFToken(block);
    if (directNftoken) cookie.nftoken = directNftoken;
  }
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Pattern: emoji + key : value or key = value
    const kvMatch = trimmed.match(/^[📧🌍📅💎📺🎥💳📞📆⏳🔗📁👤🏦🔢✅👥🔓🔹📁📋💰💳📞🎥📺📧🔗]*\s*([^:：\n]+)\s*[:：]\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase().trim();
      const value = kvMatch[2].trim();
      
      switch (key) {
        case 'email':
        case 'e-mail':
          cookie.email = value.toLowerCase();
          break;
        case 'country':
          cookie.country = value.replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, '').trim();
          break;
        case 'plan':
        case 'member plan':
        case '📋 plan':
          cookie.plan = value;
          break;
        case 'member since':
        case '📅 member since':
          cookie.memberSince = value;
          break;
        case 'next billing date':
        case 'next billing':
        case '📅 next billing date':
          cookie.nextBilling = value;
          break;
        case 'payment method':
        case '💳 payment method':
          cookie.paymentMethod = value;
          break;
        case 'card brand':
        case '🏦 card brand':
          cookie.cardBrand = value;
          break;
        case 'last 4 digits':
        case '🔢 last 4 digits':
        case 'card last 4':
          cookie.cardLast4 = value;
          break;
        case 'phone':
        case 'phone number':
        case '📞 phone':
          cookie.phoneNumber = value;
          break;
        case 'phone verified':
        case '✅ phone verified':
          cookie.phoneVerified = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
          break;
        case 'video quality':
        case '🎥 video quality':
          cookie.videoQuality = value;
          break;
        case 'max streams':
        case '📺 max streams':
          cookie.maxStreams = value;
          break;
        case 'connected profiles':
        case '👥 connected profiles':
          cookie.connectedProfiles = parseInt(value) || 0;
          break;
        case 'extra member slot':
        case '🔓 extra member slot':
          cookie.extraMemberSlot = value;
          break;
        case 'profiles':
          if (value.includes(',')) {
            cookie.profiles = value.split(',').map(p => p.trim());
          }
          break;
        case 'name':
        case '👤 name':
          cookie.firstName = value;
          break;
        case 'price':
        case '💰 price':
          cookie.price = value;
          break;
      }
    }
  }
}

/**
 * PARSE PREMIUM ACCOUNT BLOCK FORMAT
 * Handles the detailed emoji block format with all account info
 */
function parsePremiumAccountBlocks(content: string): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];
  
  // Split by PREMIUM ACCOUNT markers
  const accountPattern = /🔹\s*PREMIUM\s*ACCOUNT\s*#?\d+/gi;
  const parts = content.split(accountPattern);
  
  for (const block of parts) {
    if (!block.trim()) continue;
    
    // Extract NetflixId from "🍪 Cookie:" format
    const cookiePrefixMatch = block.match(/🍪\s*Cookie\s*:\s*/i);
    if (!cookiePrefixMatch) continue;
    
    const cookieStartIndex = cookiePrefixMatch.index! + cookiePrefixMatch[0].length;
    
    // Find the end of cookie string - stop at separator or next section
    let cookieEndIndex = block.length;
    const nextSep = block.indexOf('--------------------------------------------------------------------------------', cookieStartIndex);
    if (nextSep > cookieStartIndex) cookieEndIndex = nextSep;
    
    // Also stop at any emoji marker that indicates a new section
    const blockFromStart = block.substring(cookieStartIndex);
    const nextEmojiMatch = blockFromStart.match(/[📧🌍📅💎📺🎥💳📞📆⏳🔗📁👤🏦🔢✅👥🔓🔹]/);
    if (nextEmojiMatch && nextEmojiMatch.index !== undefined) {
      const nextEmoji = cookieStartIndex + nextEmojiMatch.index;
      if (nextEmoji > cookieStartIndex && nextEmoji < cookieEndIndex) {
        cookieEndIndex = nextEmoji;
      }
    }
    
    // Get raw cookie string and clean it
    let cookieString = block.substring(cookieStartIndex, cookieEndIndex).trim();
    
    // Remove any trailing separator lines
    cookieString = cookieString.replace(/\n[-─]+$/g, '').trim();
    
    // Extract NetflixId from the cookie string
    const netflixIdMatch = cookieString.match(/NetflixId=([^;\n\r]+)/i);
    if (!netflixIdMatch || !netflixIdMatch[1]) continue;
    
    const netflixId = netflixIdMatch[1].trim();
    if (netflixId.length < 30 || !netflixId.includes('%')) continue;
    
    // Extract other cookies
    const secureNetflixIdMatch = cookieString.match(/SecureNetflixId=([^;\n\r]+)/i);
    const nfvdidMatch = cookieString.match(/nfvdid=([^;\n\r]+)/i);
    
    const secureNetflixId = secureNetflixIdMatch ? secureNetflixIdMatch[1].trim() : undefined;
    const nfvdid = nfvdidMatch ? nfvdidMatch[1].trim() : undefined;
    
    // Extract nftoken from URLs in the block
    const phoneLoginUrl = extractPhoneLoginUrl(block);
    const pcLoginUrl = extractPcLoginUrl(block);
    let nftoken = extractNFToken(block);
    
    // If no nftoken found directly, try from URLs
    if (!nftoken && (phoneLoginUrl || pcLoginUrl)) {
      nftoken = extractNFToken(phoneLoginUrl || pcLoginUrl || '');
    }
    
    // Build clean raw cookie
    let rawCookie = `NetflixId=${netflixId}`;
    if (secureNetflixId) rawCookie += `; SecureNetflixId=${secureNetflixId}`;
    if (nfvdid) rawCookie += `; nfvdid=${nfvdid}`;
    
    const cookie: ParsedCookie = {
      netflixId,
      secureNetflixId,
      nfvdid,
      nftoken: nftoken || undefined,
      phoneLoginUrl: phoneLoginUrl || undefined,
      pcLoginUrl: pcLoginUrl || undefined,
      email: extractEmail(block),
      country: '',
      plan: '',
      rawCookie,
    };
    
    // Parse key-value pairs from block
    parseKeyValueFromBlock(block, cookie);
    
    cookies.push(cookie);
  }
  
  return cookies;
}

/**
 * PARSE PIPE-SEPARATED FORMAT
 */
function parsePipeFormat(content: string): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (!/netflixid/i.test(line)) continue;
    
    // Find NetflixId value
    const netflixIdMatch = line.match(/NetflixId\s*=\s*([^|;\n\r]+)/i);
    if (!netflixIdMatch) continue;
    
    const netflixId = netflixIdMatch[1].trim();
    if (netflixId.length < 30) continue;
    
    const secureNetflixIdMatch = line.match(/SecureNetflixId\s*=\s*([^|;\n\r]+)/i);
    const nfvdidMatch = line.match(/nfvdid\s*=\s*([^|;\n\r]+)/i);
    
    const secureNetflixId = secureNetflixIdMatch ? secureNetflixIdMatch[1].trim() : undefined;
    const nfvdid = nfvdidMatch ? nfvdidMatch[1].trim() : undefined;
    
    let rawCookie = `NetflixId=${netflixId}`;
    if (secureNetflixId) rawCookie += `; SecureNetflixId=${secureNetflixId}`;
    if (nfvdid) rawCookie += `; nfvdid=${nfvdid}`;
    
    const cookie: ParsedCookie = {
      netflixId,
      secureNetflixId,
      nfvdid,
      email: extractEmail(line),
      country: '',
      plan: '',
      rawCookie,
    };
    
    // Parse pipe-separated values
    const parts = line.split(/[|│]/).map(p => p.trim());
    for (const part of parts) {
      const kvMatch = part.match(/^\s*([^=:\n]+)\s*[=:]\s*(.+)$/i);
      if (!kvMatch) continue;
      
      const key = kvMatch[1].toLowerCase().trim();
      const value = kvMatch[2].trim();
      
      switch (key) {
        case 'country':
          cookie.country = value.replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, '').trim();
          break;
        case 'memberplan':
        case 'plan':
          cookie.plan = value;
          break;
        case 'videoquality':
        case 'video quality':
          cookie.videoQuality = value;
          break;
        case 'maxstreams':
        case 'max streams':
          cookie.maxStreams = value;
          break;
        case 'membersince':
        case 'member since':
          cookie.memberSince = value;
          break;
        case 'nextbilling':
        case 'next billing':
          cookie.nextBilling = value;
          break;
      }
    }
    
    cookies.push(cookie);
  }
  
  return cookies;
}

/**
 * PARSE PLAIN COOKIE STRING FORMAT
 */
function parsePlainFormat(content: string): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and separators
    if (!line || /^(---+|═══+|===+|\.\.\.+|─+)/.test(line)) continue;
    
    // Must contain NetflixId
    if (!/netflixid/i.test(line)) continue;
    
    // Extract NetflixId
    const netflixIdMatch = line.match(/NetflixId\s*=\s*([^;\n\r]+)/i);
    if (!netflixIdMatch || !netflixIdMatch[1]) continue;
    
    const netflixId = netflixIdMatch[1].trim();
    if (netflixId.length < 30) continue;
    
    const secureNetflixIdMatch = line.match(/SecureNetflixId\s*=\s*([^;\n\r]+)/i);
    const nfvdidMatch = line.match(/nfvdid\s*=\s*([^;\n\r]+)/i);
    
    const secureNetflixId = secureNetflixIdMatch ? secureNetflixIdMatch[1].trim() : undefined;
    const nfvdid = nfvdidMatch ? nfvdidMatch[1].trim() : undefined;
    
    let rawCookie = `NetflixId=${netflixId}`;
    if (secureNetflixId) rawCookie += `; SecureNetflixId=${secureNetflixId}`;
    if (nfvdid) rawCookie += `; nfvdid=${nfvdid}`;
    
    cookies.push({
      netflixId,
      secureNetflixId,
      nfvdid,
      email: extractEmail(line),
      country: '',
      plan: '',
      rawCookie,
      lineNumber: i + 1,
    });
  }
  
  return cookies;
}

/**
 * PARSE JSON FORMAT
 */
function parseJsonFormat(content: string): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];
  
  try {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : [data];
    
    for (const item of items) {
      if (!item.netflixId && !item.NetflixId && !item.cookie) continue;
      
      const netflixId = item.netflixId || item.NetflixId || extractAllNetflixIds(item.cookie || '')[0];
      if (!netflixId) continue;
      
      cookies.push({
        netflixId,
        secureNetflixId: item.secureNetflixId || item.SecureNetflixId,
        nfvdid: item.nfvdid,
        email: item.email || item.Email || '',
        country: item.country || item.Country || '',
        plan: item.plan || item.Plan || '',
        rawCookie: item.cookie || item.rawCookie || `NetflixId=${netflixId}`,
      });
    }
  } catch {
    // Not valid JSON
  }
  
  return cookies;
}

/**
 * Clean HTML content
 */
function cleanHtmlContent(content: string): string {
  return content
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * PARSE NETSCAPE COOKIES.TXT FORMAT
 * Format: domain       flag    path    secure  expiration      name    value
 * Example: .netflix.com        TRUE    /       FALSE   1803517598      NetflixId       ct%3DBgjHl...
 */
function parseNetscapeCookiesFormat(content: string): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];
  const lines = content.split('\n');
  
  // Track all Netflix cookies found (group by file)
  const netflixIdMap = new Map<string, { netflixId: string; secureNetflixId?: string; nfvdid?: string }>();
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Split by tabs (Netscape format is tab-separated)
    const parts = trimmed.split('\t');
    
    // Netscape format: domain, flag, path, secure, expiration, name, value
    if (parts.length >= 7) {
      const domain = parts[0];
      const name = parts[5];
      const value = parts[6];
      
      // Only process netflix.com cookies
      if (!domain.includes('netflix.com')) continue;
      
      if (name.toLowerCase() === 'netflixid' && value && value.length > 30) {
        // Found NetflixId
        const existing = netflixIdMap.get('primary') || { netflixId: '' };
        existing.netflixId = value;
        netflixIdMap.set('primary', existing);
      } else if (name.toLowerCase() === 'securenetflixid' && value) {
        const existing = netflixIdMap.get('primary') || { netflixId: '' };
        existing.secureNetflixId = value;
        netflixIdMap.set('primary', existing);
      } else if (name.toLowerCase() === 'nfvdid' && value) {
        const existing = netflixIdMap.get('primary') || { netflixId: '' };
        existing.nfvdid = value;
        netflixIdMap.set('primary', existing);
      }
    }
  }
  
  // Convert to ParsedCookie format
  for (const [, cookieData] of netflixIdMap) {
    if (!cookieData.netflixId) continue;
    
    let rawCookie = `NetflixId=${cookieData.netflixId}`;
    if (cookieData.secureNetflixId) rawCookie += `; SecureNetflixId=${cookieData.secureNetflixId}`;
    if (cookieData.nfvdid) rawCookie += `; nfvdid=${cookieData.nfvdid}`;
    
    cookies.push({
      netflixId: cookieData.netflixId,
      secureNetflixId: cookieData.secureNetflixId,
      nfvdid: cookieData.nfvdid,
      email: '', // Will be extracted from file name or content
      country: '',
      plan: '',
      rawCookie,
    });
  }
  
  return cookies;
}

/**
 * Extract account info from filename pattern
 * Pattern: [Name]-[Country 🇮🇳]-[Plan]-[Quality]-[Date]-[CC]-@Owner
 */
function extractInfoFromFilename(filename: string): { name?: string; country?: string; plan?: string } {
  const match = filename.match(/\[([^\]]+)\]-\[([^\]]+)\]-\[([^\]]+)\]/);
  if (match) {
    return {
      name: match[1],
      country: match[2].replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, '').trim(),
      plan: match[3],
    };
  }
  return {};
}

/**
 * MAIN PARSER - ULTRA DYNAMIC
 */
export function parseCookieFile(content: string, filename?: string): CookieExtractionResult {
  const allCookies: ParsedCookie[] = [];
  const parseErrors: string[] = [];
  
  // Clean HTML if present
  let cleanContent = content;
  if (content.includes('<div>') || content.includes('<body>')) {
    cleanContent = cleanHtmlContent(content);
  }
  
  // Extract filename info for later use
  const filenameInfo = filename ? extractInfoFromFilename(filename) : {};
  
  // STRATEGY 0: Netscape cookies.txt format (tab-separated) - CHECK FIRST
  // This is the most common format for browser cookie exports
  if (cleanContent.includes('.netflix.com') && cleanContent.includes('\t')) {
    try {
      const parsed = parseNetscapeCookiesFormat(cleanContent);
      if (parsed.length > 0) {
        // Apply filename info if available
        for (const cookie of parsed) {
          if (filenameInfo.name && !cookie.firstName) cookie.firstName = filenameInfo.name;
          if (filenameInfo.country && !cookie.country) cookie.country = filenameInfo.country;
          if (filenameInfo.plan && !cookie.plan) cookie.plan = filenameInfo.plan;
        }
        allCookies.push(...parsed);
      }
    } catch (e) {
      parseErrors.push(`Netscape format parse error: ${e}`);
    }
  }
  
  // STRATEGY 1: PREMIUM ACCOUNT blocks (most detailed)
  if (/🔹\s*PREMIUM\s*ACCOUNT/i.test(cleanContent)) {
    try {
      const parsed = parsePremiumAccountBlocks(cleanContent);
      for (const cookie of parsed) {
        if (!allCookies.find(c => c.netflixId === cookie.netflixId)) {
          allCookies.push(cookie);
        }
      }
    } catch (e) {
      parseErrors.push(`Premium account parse error: ${e}`);
    }
  }
  
  // STRATEGY 2: Pipe-separated format
  if (/[|│]/.test(cleanContent)) {
    try {
      const parsed = parsePipeFormat(cleanContent);
      for (const cookie of parsed) {
        if (!allCookies.find(c => c.netflixId === cookie.netflixId)) {
          allCookies.push(cookie);
        }
      }
    } catch (e) {
      parseErrors.push(`Pipe format parse error: ${e}`);
    }
  }
  
  // STRATEGY 3: JSON format
  try {
    const parsed = parseJsonFormat(cleanContent);
    for (const cookie of parsed) {
      if (!allCookies.find(c => c.netflixId === cookie.netflixId)) {
        allCookies.push(cookie);
      }
    }
  } catch {
    // JSON parsing is optional
  }
  
  // STRATEGY 4: Plain format (catch-all)
  if (allCookies.length === 0) {
    try {
      const parsed = parsePlainFormat(cleanContent);
      // Apply filename info if available
      for (const cookie of parsed) {
        if (filenameInfo.name && !cookie.firstName) cookie.firstName = filenameInfo.name;
        if (filenameInfo.country && !cookie.country) cookie.country = filenameInfo.country;
        if (filenameInfo.plan && !cookie.plan) cookie.plan = filenameInfo.plan;
      }
      allCookies.push(...parsed);
    } catch (e) {
      parseErrors.push(`Plain format parse error: ${e}`);
    }
  }
  
  // Try to extract email from content if not found
  for (const cookie of allCookies) {
    if (!cookie.email) {
      // Decode hex-escaped characters like \x40 -> @
      const decodedContent = cleanContent.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => 
        String.fromCharCode(parseInt(hex, 16))
      );
      const emailMatch = decodedContent.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
      if (emailMatch) cookie.email = emailMatch[0].toLowerCase();
    }
  }
  
  // Add line numbers if not present
  allCookies.forEach((cookie, index) => {
    if (!cookie.lineNumber) {
      cookie.lineNumber = index + 1;
    }
  });
  
  return {
    cookies: allCookies,
    totalFound: allCookies.length,
    parseErrors,
  };
}

/**
 * Parse multiple files
 */
export function parseMultipleFiles(files: { name: string; content: string }[]): CookieExtractionResult {
  const allCookies: ParsedCookie[] = [];
  const allErrors: string[] = [];
  
  for (const file of files) {
    try {
      // Pass filename to parseCookieFile for better extraction
      const result = parseCookieFile(file.content, file.name);
      
      // Add source file name to each cookie
      for (const cookie of result.cookies) {
        cookie.source = file.name;
      }
      
      allCookies.push(...result.cookies);
      
      if (result.parseErrors.length > 0) {
        allErrors.push(`${file.name}: ${result.parseErrors.join(', ')}`);
      }
    } catch (error) {
      allErrors.push(`${file.name}: Failed to parse - ${error}`);
    }
  }
  
  // Remove duplicates based on NetflixId
  const uniqueCookies = allCookies.filter((cookie, index, self) =>
    index === self.findIndex(c => c.netflixId === cookie.netflixId)
  );
  
  return {
    cookies: uniqueCookies,
    totalFound: uniqueCookies.length,
    parseErrors: allErrors,
  };
}

export function parseMultipleFilesWrapper(files: { name: string; content: string }[]): {
  cookies: ParsedCookie[];
  parseErrors: string[];
} {
  const result = parseMultipleFiles(files);
  return {
    cookies: result.cookies,
    parseErrors: result.parseErrors,
  };
}
