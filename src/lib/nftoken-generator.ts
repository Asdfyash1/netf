/**
 * Netflix NFToken Generator
 * Generates Netflix auto-login tokens from valid cookies
 * 
 * CREDITS: Yash
 */

export interface NFTokenResult {
  success: boolean;
  token?: string;
  link?: string;
  error?: string;
  partial?: boolean; // True if we have NetflixId but missing SecureNetflixId
}

const NETFLIX_API_URL = 'https://android13.prod.ftl.netflix.com/graphql';

const NETFLIX_HEADERS = {
  'User-Agent': 'com.netflix.mediaclient/63884 (Linux; U; Android 13; ro; M2007J3SG; Build/TQ1A.230205.001.A2; Cronet/143.0.7445.0)',
  'Accept': 'multipart/mixed;deferSpec=20220824, application/graphql-response+json, application/json',
  'Content-Type': 'application/json',
  'Origin': 'https://www.netflix.com',
  'Referer': 'https://www.netflix.com/'
};

/**
 * Generate NFToken from Netflix cookies
 * Works with:
 * - Full cookies (NetflixId + SecureNetflixId + nfvdid)
 * - Partial cookies (NetflixId only)
 */
export async function generateNFToken(cookieString: string): Promise<NFTokenResult> {
  try {
    // Parse cookie string into a dict
    const cookieDict: Record<string, string> = {};
    const parts = cookieString.split(';');
    for (const part of parts) {
      const match = part.trim().match(/^([^=]+)=(.*)$/);
      if (match) {
        cookieDict[match[1]] = match[2];
      }
    }

    // Check required cookies (NetflixId, SecureNetflixId, nfvdid)
    const requiredCookies = ['NetflixId', 'SecureNetflixId', 'nfvdid'];
    const missing = requiredCookies.filter(c => !(c in cookieDict));
    
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required cookies: ${missing.join(', ')}`,
        partial: true
      };
    }

    // Build perfect cookie string matching Python's stealth profile
    // Only send the exact cookies the Android API expects
    const allowedKeys = ['NetflixId', 'SecureNetflixId', 'nfvdid', 'OptanonConsent'];
    const finalCookieParts: string[] = [];
    for (const key of allowedKeys) {
      if (cookieDict[key]) {
        finalCookieParts.push(`${key}=${cookieDict[key]}`);
      }
    }
    const finalCookieStr = finalCookieParts.join('; ');

    const payload = {
      operationName: 'CreateAutoLoginToken',
      variables: {
        scope: 'WEBVIEW_MOBILE_STREAMING'
      },
      extensions: {
        persistedQuery: {
          version: 102,
          id: '76e97129-f4b5-41a0-a73c-12e674896849'
        }
      }
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(NETFLIX_API_URL, {
        method: 'POST',
        headers: {
          ...NETFLIX_HEADERS,
          'Cookie': finalCookieStr
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const data = await response.json();
        
        if (data?.data?.createAutoLoginToken) {
          const token = data.data.createAutoLoginToken;
          return {
            success: true,
            token: token,
            link: `https://netflix.com/?nftoken=${token}`
          };
        } else if (data?.errors) {
          return {
            success: false,
            error: `API Error: ${JSON.stringify(data.errors, null, 2)}`
          };
        } else {
          return {
            success: false,
            error: `Unexpected response: ${JSON.stringify(data)}`
          };
        }
      } else {
        const text = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${text.substring(0, 200)}`
        };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout'
        };
      }
      return {
        success: false,
        error: `Request error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Alternative token generation method
 * Uses different API endpoint
 */
async function tryAlternativeTokenGeneration(cookieString: string): Promise<NFTokenResult> {
  try {
    // Try the shakti API
    const response = await fetch('https://www.netflix.com/api/shakti/mre/token', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Cookie': cookieString,
      },
      redirect: 'manual'
    });
    
    if (response.status === 200) {
      const data = await response.json();
      if (data?.token || data?.nftoken) {
        const token = data.token || data.nftoken;
        return {
          success: true,
          token: token,
          link: `https://netflix.com/?nftoken=${token}`
        };
      }
    }
    
    return { success: false, error: 'Alternative method failed' };
  } catch {
    return { success: false, error: 'Alternative method error' };
  }
}

/**
 * Check if a cookie has all required fields for NFToken generation
 */
export function canGenerateNFToken(cookieString: string): { canGenerate: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!cookieString.includes('NetflixId=')) {
    missing.push('NetflixId');
  }
  
  if (!cookieString.includes('SecureNetflixId=')) {
    missing.push('SecureNetflixId');
  }
  
  // nfvdid is optional but recommended
  if (!cookieString.includes('nfvdid=')) {
    // Not counted as missing, but note it
    console.log('Note: nfvdid is missing (optional but recommended)');
  }
  
  return {
    canGenerate: missing.length === 0,
    missing
  };
}

/**
 * Build complete cookie string from parts
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

/**
 * Extract cookie values from a cookie string
 */
export function parseCookieString(cookieString: string): {
  netflixId?: string;
  secureNetflixId?: string;
  nfvdid?: string;
} {
  const result: { netflixId?: string; secureNetflixId?: string; nfvdid?: string } = {};
  
  const netflixIdMatch = cookieString.match(/NetflixId=([^;\s]+)/);
  if (netflixIdMatch) {
    result.netflixId = netflixIdMatch[1];
  }
  
  const secureNetflixIdMatch = cookieString.match(/SecureNetflixId=([^;\s]+)/);
  if (secureNetflixIdMatch) {
    result.secureNetflixId = secureNetflixIdMatch[1];
  }
  
  const nfvdidMatch = cookieString.match(/nfvdid=([^;\s]+)/);
  if (nfvdidMatch) {
    result.nfvdid = nfvdidMatch[1];
  }
  
  return result;
}
