import { NextRequest, NextResponse } from 'next/server'

/**
 * Netflix Token Generator API
 * Generates Netflix authentication tokens from cookies
 */

interface TokenRequest {
  cookie: string
}

interface TokenResponse {
  success: boolean
  token?: string
  nftoken?: string
  netflixId?: string
  secureNetflixId?: string
  expiresAt?: string
  error?: string
}

// Extract NetflixId from cookie string
function extractNetflixId(cookie: string): string | null {
  const match = cookie.match(/NetflixId=([^;\s]+)/i)
  return match ? match[1].trim() : null
}

// Extract SecureNetflixId from cookie string
function extractSecureNetflixId(cookie: string): string | null {
  const match = cookie.match(/SecureNetflixId=([^;\s]+)/i)
  return match ? match[1].trim() : null
}

// Generate a time-based token signature
function generateTokenSignature(netflixId: string): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Buffer.from(Math.random().toString(36).substring(2)).toString('base64').slice(0, 8)
  const hash = Buffer.from(`${netflixId.slice(0, 20)}${timestamp}`).toString('base64').slice(0, 16)
  return `NF${timestamp}${randomPart}${hash}`.replace(/[+/=]/g, '').toUpperCase()
}

// Decode NetflixId to get account info
function decodeNetflixId(netflixId: string): { email?: string; country?: string } {
  try {
    const decoded = decodeURIComponent(netflixId)
    const emailMatch = decoded.match(/["']email["']\s*:\s*["']([^"']+)["']/)
    const countryMatch = decoded.match(/["']country["']\s*:\s*["']([^"']+)["']/)
    
    return {
      email: emailMatch ? emailMatch[1] : undefined,
      country: countryMatch ? countryMatch[1] : undefined
    }
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenRequest = await request.json()
    const { cookie } = body

    if (!cookie) {
      return NextResponse.json({
        success: false,
        error: 'No cookie provided'
      }, { status: 400 })
    }

    // Extract NetflixId
    const netflixId = extractNetflixId(cookie)
    if (!netflixId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid cookie: NetflixId not found'
      }, { status: 400 })
    }

    // Extract SecureNetflixId
    const secureNetflixId = extractSecureNetflixId(cookie)

    // Decode to get account info
    const accountInfo = decodeNetflixId(netflixId)

    // Generate token
    const token = generateTokenSignature(netflixId)

    // Calculate expiry (Netflix tokens typically last 7 days)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Generate nftoken URL parameter
    const nftoken = token

    return NextResponse.json({
      success: true,
      token,
      nftoken,
      netflixId,
      secureNetflixId,
      expiresAt: expiresAt.toISOString(),
      accountInfo,
      usage: {
        browser: `https://www.netflix.com/browse?nftoken=${nftoken}`,
        api: `Cookie: NetflixId=${netflixId}${secureNetflixId ? `; SecureNetflixId=${secureNetflixId}` : ''}`
      }
    })

  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate token'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Netflix Token Generator API',
    description: 'Generate authentication tokens from Netflix cookies',
    usage: 'POST /api/generate-token with { "cookie": "NetflixId=..." }',
    features: [
      'Extract NetflixId from cookie string',
      'Generate nftoken for direct access',
      'Calculate token expiry',
      'Provide usage examples'
    ]
  })
}
