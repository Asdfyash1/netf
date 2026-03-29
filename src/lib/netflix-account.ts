/**
 * Netflix Account Info Fetcher
 * Fetches account details using Netflix endpoints
 * 
 * CREDITS: Yash
 */

export interface NetflixAccountInfo {
  success: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  country?: string;
  countryCode?: string;
  language?: string;
  plan?: string;
  planName?: string;
  planPrice?: string;
  planCurrency?: string;
  maxStreams?: number;
  videoQuality?: string;
  membershipStatus?: string;
  memberSince?: string;
  nextBillingDate?: string;
  paymentMethod?: string;
  profilesCount?: number;
  profiles?: string[];
  isKidsProfile?: boolean;
  error?: string;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Decode Netflix's escaped strings (e.g., \x20 -> space, \x40 -> @)
 */
function decodeNetflixString(str: string): string {
  if (!str) return '';
  
  // Decode \xNN hex escapes
  let decoded = str.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  
  // Decode \uNNNN unicode escapes
  decoded = decoded.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  
  // Decode \\uNNNN unicode escapes (double escaped)
  decoded = decoded.replace(/\\\\u([0-9A-Fa-f]{4})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  
  return decoded;
}

/**
 * Extract value from JSON-like string in HTML
 */
function extractJsonValue(html: string, key: string): string | null {
  // Try various patterns to find the value
  const patterns = [
    new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 'i'),
    new RegExp(`"${key}"\\s*:\\s*([^,}\\]]+)`, 'i'),
    new RegExp(`'${key}'\\s*:\\s*'([^']*)'`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
      }
      return value;
    }
  }
  return null;
}

/**
 * Fetch all account info from Netflix endpoints
 */
export async function fetchNetflixAccountInfo(cookieString: string): Promise<NetflixAccountInfo> {
  try {
    // Fetch from multiple endpoints in parallel
    const [accountPage, membershipPage, profilesPage, paymentPage, securityPage] = await Promise.all([
      fetchPage('https://www.netflix.com/account', cookieString),
      fetchPage('https://www.netflix.com/account/membership', cookieString),
      fetchPage('https://www.netflix.com/account/profiles', cookieString),
      fetchPage('https://www.netflix.com/simplemember/managepaymentinfo', cookieString),
      fetchPage('https://www.netflix.com/account/security', cookieString),
    ]);

    // Extract data from each page
    const accountData = extractAccountData(accountPage);
    const membershipData = extractMembershipData(membershipPage || accountPage);
    const profilesData = extractProfilesData(profilesPage || accountPage);
    const paymentData = extractPaymentData(paymentPage || accountPage);
    const securityData = extractSecurityData(securityPage || accountPage);

    // Combine all extracted data
    return {
      success: true,
      email: accountData.email || membershipData.email,
      firstName: accountData.firstName,
      lastName: accountData.lastName,
      fullName: accountData.fullName,
      phone: securityData.phone || accountData.phone,
      country: accountData.country || membershipData.country,
      countryCode: accountData.countryCode,
      language: accountData.language,
      plan: membershipData.plan,
      planName: membershipData.planName,
      planPrice: membershipData.planPrice,
      planCurrency: membershipData.planCurrency,
      maxStreams: membershipData.maxStreams,
      videoQuality: membershipData.videoQuality,
      membershipStatus: membershipData.status || accountData.membershipStatus || 'CURRENT_MEMBER',
      memberSince: membershipData.memberSince || accountData.memberSince,
      nextBillingDate: membershipData.nextBillingDate,
      paymentMethod: paymentData.paymentMethod,
      profilesCount: profilesData.count,
      profiles: profilesData.names,
      isKidsProfile: profilesData.hasKids
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Quick account check using account page
 */
export async function quickAccountCheck(cookieString: string): Promise<NetflixAccountInfo> {
  try {
    // Fetch account page only
    const accountPage = await fetchPage('https://www.netflix.com/account', cookieString);

    const accountData = extractAccountData(accountPage);
    const membershipData = extractMembershipData(accountPage);
    const profilesData = extractProfilesData(accountPage);

    return {
      success: true,
      email: accountData.email || membershipData.email,
      fullName: accountData.fullName,
      phone: accountData.phone,
      country: accountData.country || membershipData.country,
      plan: membershipData.plan,
      planName: membershipData.planName,
      planPrice: membershipData.planPrice,
      planCurrency: membershipData.planCurrency,
      maxStreams: membershipData.maxStreams,
      videoQuality: membershipData.videoQuality,
      memberSince: membershipData.memberSince || accountData.memberSince,
      nextBillingDate: membershipData.nextBillingDate,
      membershipStatus: membershipData.status || accountData.membershipStatus || 'CURRENT_MEMBER',
      profilesCount: profilesData.count,
      profiles: profilesData.names,
      isKidsProfile: profilesData.hasKids
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch a page from Netflix
 */
async function fetchPage(url: string, cookieString: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...BROWSER_HEADERS,
        'Cookie': cookieString
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 200) {
      return await response.text();
    }
    return '';
  } catch (error) {
    clearTimeout(timeoutId);
    return '';
  }
}

/**
 * Extract account data from /account page
 * Netflix stores user info in a userInfo object in the HTML
 */
function extractAccountData(html: string): Partial<NetflixAccountInfo> {
  const result: Partial<NetflixAccountInfo> = {};

  if (!html) return result;

  try {
    // Look for userInfo object - this contains the main account data
    // Pattern: "userInfo":{"name":"...","emailAddress":"...","membershipStatus":"..."}
    const userInfoMatch = html.match(/"userInfo"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]*)"[^}]*"emailAddress"\s*:\s*"([^"]*)"/);
    if (userInfoMatch) {
      result.fullName = decodeNetflixString(userInfoMatch[1]);
      result.email = decodeNetflixString(userInfoMatch[2]);
    }
    
    // Also try the userInfo with data wrapper
    const userInfoDataMatch = html.match(/"userInfo"\s*:\s*\{\s*"data"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]*)"[^}]*"emailAddress"\s*:\s*"([^"]*)"/);
    if (userInfoDataMatch && !result.email) {
      result.fullName = decodeNetflixString(userInfoDataMatch[1]);
      result.email = decodeNetflixString(userInfoDataMatch[2]);
    }

    // Extract email from profileEmailAddress if not found
    if (!result.email) {
      const emailMatch = html.match(/"profileEmailAddress"\s*:\s*"([^"]*)"/);
      if (emailMatch) {
        result.email = decodeNetflixString(emailMatch[1]);
      }
    }

    // Extract email from emailAddress field
    if (!result.email) {
      const emailMatch = html.match(/"emailAddress"\s*:\s*"([^"]*)"/);
      if (emailMatch) {
        result.email = decodeNetflixString(emailMatch[1]);
      }
    }

    // Extract name from name field
    if (!result.fullName) {
      const nameMatch = html.match(/"name"\s*:\s*"([^"]*)"/);
      if (nameMatch) {
        result.fullName = decodeNetflixString(nameMatch[1]);
      }
    }

    // Extract phone number
    const phoneMatch = html.match(/"phoneNumber"\s*:\s*"([^"]*)"/);
    if (phoneMatch) {
      result.phone = phoneMatch[1] ? decodeNetflixString(phoneMatch[1]) : undefined;
    }

    // Extract country
    const countryMatch = html.match(/"country"\s*:\s*"([^"]*)"/);
    if (countryMatch) {
      result.country = countryMatch[1];
    }

    // Extract countryOfSignup
    const countrySignupMatch = html.match(/"countryOfSignup"\s*:\s*"([^"]*)"/);
    if (countrySignupMatch && !result.country) {
      result.country = countrySignupMatch[1];
    }

    // Extract currentCountry
    const currentCountryMatch = html.match(/"currentCountry"\s*:\s*"([^"]*)"/);
    if (currentCountryMatch && !result.country) {
      result.country = currentCountryMatch[1];
    }

    // Extract member since
    const memberSinceMatch = html.match(/"memberSince"\s*:\s*"([^"]*)"/);
    if (memberSinceMatch) {
      result.memberSince = decodeNetflixString(memberSinceMatch[1]);
    }

    // Extract membership status
    const statusMatch = html.match(/"membershipStatus"\s*:\s*"([^"]*)"/);
    if (statusMatch) {
      result.membershipStatus = statusMatch[1];
    }

    // Try to extract from reactContext
    const reactContextMatch = html.match(/window\.netflix\.reactContext\s*=\s*(\{.+?\});\s*<\/script>/);
    if (reactContextMatch) {
      try {
        // Find userInfo within reactContext
        const contextStr = reactContextMatch[1];
        
        // Extract geo info
        const geoMatch = contextStr.match(/"geo"\s*:\s*\{[^}]*"country"\s*:\s*"([^"]*)"/);
        if (geoMatch && !result.country) {
          result.country = geoMatch[1];
        }
        
        const countryCodeMatch = contextStr.match(/"countryCode"\s*:\s*"([^"]*)"/);
        if (countryCodeMatch) {
          result.countryCode = countryCodeMatch[1];
        }
      } catch (e) {
        // Continue with other extraction
      }
    }

  } catch (error) {
    console.error('Error extracting account data:', error);
  }

  return result;
}

/**
 * Extract membership data from /account/membership page
 */
function extractMembershipData(html: string): Partial<NetflixAccountInfo> {
  const result: Partial<NetflixAccountInfo> = {};

  if (!html) return result;

  try {
    // Extract membership status
    const statusMatch = html.match(/"membershipStatus"\s*:\s*"([^"]*)"/);
    if (statusMatch) {
      result.status = statusMatch[1];
    }

    // Extract member since
    const memberSinceMatch = html.match(/"memberSince"\s*:\s*"([^"]*)"/);
    if (memberSinceMatch) {
      result.memberSince = decodeNetflixString(memberSinceMatch[1]);
    }

    // Extract next billing date
    const nextBillingMatch = html.match(/"nextBillingDate"\s*:\s*([^,}\]]+)/);
    if (nextBillingMatch) {
      const value = nextBillingMatch[1].trim();
      if (value && value !== 'null') {
        result.nextBillingDate = value.replace(/"/g, '');
      }
    }

    // Extract max streams
    const maxStreamsMatch = html.match(/"maxStreams"\s*:\s*(\d+)/);
    if (maxStreamsMatch) {
      result.maxStreams = parseInt(maxStreamsMatch[1]);
    }

    // Extract plan name from various patterns
    const planPatterns = [
      /"planName"\s*:\s*"([^"]*)"/,
      /"plan"\s*:\s*\{\s*"name"\s*:\s*"([^"]*)"/,
      /"offerName"\s*:\s*"([^"]*)"/,
    ];

    for (const pattern of planPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        result.plan = decodeNetflixString(match[1]);
        result.planName = result.plan;
        break;
      }
    }

    // Look for plan descriptions in the HTML content
    // Netflix often shows "Standard", "Premium", "Basic" as text
    if (!result.plan) {
      // Check for plan change message which might indicate current plan
      if (html.includes('Standard with ads')) {
        result.plan = 'Standard with ads';
        result.planName = 'Standard with ads';
      } else if (html.includes('Standard') && html.includes('HD')) {
        result.plan = 'Standard';
        result.planName = 'Standard';
      } else if (html.includes('Premium') && (html.includes('4K') || html.includes('Ultra'))) {
        result.plan = 'Premium';
        result.planName = 'Premium';
      } else if (html.includes('Basic')) {
        result.plan = 'Basic';
        result.planName = 'Basic';
      }
    }

    // Extract video quality - prioritize maxStreams over HTML keywords
    // maxStreams is more reliable: 4=Premium/4K, 2=Standard/HD, 1=Basic/SD
    if (result.maxStreams === 4) {
      result.videoQuality = '4K/UHD';
    } else if (result.maxStreams === 2) {
      result.videoQuality = 'HD';
    } else if (result.maxStreams === 1) {
      result.videoQuality = 'SD';
    } else if (html.includes('4K') || html.includes('Ultra HD') || html.includes('UHD')) {
      // Only use HTML matching if maxStreams not found
      result.videoQuality = '4K/UHD';
    } else if (html.includes('1080p') || html.includes('Full HD')) {
      result.videoQuality = 'HD';
    } else if (html.includes('720p')) {
      result.videoQuality = 'HD';
    }

    // Extract price - look for specific patterns (be more careful to avoid false matches)
    const pricePatterns = [
      /"monthlyPrice"\s*:\s*([\d.]+)/,
      /"planPrice"\s*:\s*([\d.]+)/,
      /\$([\d.]+)\s*\/\s*month/i,
      /([\d.]+)\s*(USD|EUR|GBP|CAD|AUD)\s*\/\s*month/i,
    ];

    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const price = parseFloat(match[1]);
        // Sanity check - Netflix prices are typically between $5 and $30
        if (price >= 5 && price <= 30) {
          result.planPrice = match[1];
          if (match[2]) result.planCurrency = match[2];
          break;
        }
      }
    }

    // Extract currency
    const currencyMatch = html.match(/"currency"\s*:\s*"([^"]*)"/);
    if (currencyMatch) {
      result.planCurrency = currencyMatch[1];
    }

    // Check for currentPlan
    const currentPlanMatch = html.match(/"currentPlan"\s*:\s*(\{[^}]+\}|null)/);
    if (currentPlanMatch && currentPlanMatch[1] !== 'null') {
      try {
        const planData = currentPlanMatch[1];
        const nameMatch = planData.match(/"name"\s*:\s*"([^"]*)"/);
        if (nameMatch) {
          result.plan = decodeNetflixString(nameMatch[1]);
          result.planName = result.plan;
        }
      } catch (e) {
        // Continue
      }
    }

  } catch (error) {
    console.error('Error extracting membership data:', error);
  }

  return result;
}

/**
 * Extract profiles data from /account/profiles page
 */
function extractProfilesData(html: string): { count: number; names: string[]; hasKids: boolean } {
  const result = { count: 0, names: [] as string[], hasKids: false };

  if (!html) return result;

  try {
    // Extract profile names
    const profileNameMatches = html.matchAll(/"profileName"\s*:\s*"([^"]*)"/g);
    const foundNames = new Set<string>();
    
    for (const match of profileNameMatches) {
      if (match[1]) {
        foundNames.add(decodeNetflixString(match[1]));
      }
    }

    // Also try data-profile-name attribute
    const dataProfileMatches = html.matchAll(/data-profile-name="([^"]*)"/g);
    for (const match of dataProfileMatches) {
      if (match[1]) {
        foundNames.add(decodeNetflixString(match[1]));
      }
    }

    result.names = Array.from(foundNames);
    result.count = result.names.length || 1; // At least 1 profile (the main one)

    // Check for kids profile
    result.hasKids = html.includes('"isKids":true') || 
                     html.includes('isKidsProfile') || 
                     html.includes('KIDS') ||
                     html.includes('kids-profile') ||
                     /"profileType"\s*:\s*"KIDS"/i.test(html);

    // Try to extract from profiles array
    const profilesArrayMatch = html.match(/"profiles"\s*:\s*\[([^\]]+)\]/);
    if (profilesArrayMatch) {
      try {
        // Count profile objects
        const profileObjects = profilesArrayMatch[1].match(/\{[^}]+\}/g);
        if (profileObjects) {
          result.count = profileObjects.length;
        }
      } catch (e) {
        // Continue
      }
    }

  } catch (error) {
    console.error('Error extracting profiles data:', error);
  }

  return result;
}

/**
 * Extract payment data from payment page
 */
function extractPaymentData(html: string): Partial<NetflixAccountInfo> {
  const result: Partial<NetflixAccountInfo> = {};

  if (!html) return result;

  try {
    // Extract payment method
    const paymentPatterns = [
      /"paymentMethod"\s*:\s*"([^"]*)"/,
      /"billingMethod"\s*:\s*"([^"]*)"/,
      /"paymentType"\s*:\s*"([^"]*)"/,
    ];

    for (const pattern of paymentPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        result.paymentMethod = decodeNetflixString(match[1]);
        break;
      }
    }

    // Extract card brand
    const cardBrandMatch = html.match(/"cardBrand"\s*:\s*"([^"]*)"/);
    if (cardBrandMatch && cardBrandMatch[1]) {
      result.paymentMethod = decodeNetflixString(cardBrandMatch[1]);
    }

    // Extract last 4 digits
    const last4Match = html.match(/"lastFourDigits"\s*:\s*"(\d{4})"/);
    if (last4Match) {
      const cardType = result.paymentMethod || 'Card';
      result.paymentMethod = `${cardType} ****${last4Match[1]}`;
    }

    // Look for partner billing
    const partnerMatch = html.match(/"billingPartner"\s*:\s*"([^"]*)"/);
    if (partnerMatch && partnerMatch[1]) {
      result.paymentMethod = `Billed through ${decodeNetflixString(partnerMatch[1])}`;
    }

    // Check for common payment method text in HTML
    if (!result.paymentMethod) {
      if (html.includes('PayPal')) {
        result.paymentMethod = 'PayPal';
      } else if (html.includes('iTunes') || html.includes('Apple')) {
        result.paymentMethod = 'iTunes/Apple';
      } else if (html.includes('Google Play')) {
        result.paymentMethod = 'Google Play';
      } else if (html.includes('Gift Card') || html.includes('Gift Code')) {
        result.paymentMethod = 'Gift Card';
      } else if (html.includes('Credit Card') || html.includes('Debit Card')) {
        result.paymentMethod = 'Credit/Debit Card';
      }
    }

  } catch (error) {
    console.error('Error extracting payment data:', error);
  }

  return result;
}

/**
 * Extract security data from security page
 */
function extractSecurityData(html: string): Partial<NetflixAccountInfo> {
  const result: Partial<NetflixAccountInfo> = {};

  if (!html) return result;

  try {
    // Extract phone number
    const phoneMatch = html.match(/"phoneNumber"\s*:\s*"([^"]*)"/);
    if (phoneMatch && phoneMatch[1]) {
      result.phone = decodeNetflixString(phoneMatch[1]);
    }

  } catch (error) {
    console.error('Error extracting security data:', error);
  }

  return result;
}

/**
 * Build cookie string helper
 */
export function buildCookieString(parts: {
  netflixId: string;
  secureNetflixId?: string;
  nfvdid?: string;
}): string {
  let cookie = `NetflixId=${parts.netflixId}`;
  
  if (parts.secureNetflixId) {
    cookie += `; SecureNetflixId=${parts.secureNetflixId}`;
  }
  
  if (parts.nfvdid) {
    cookie += `; nfvdid=${parts.nfvdid}`;
  }
  
  return cookie;
}
