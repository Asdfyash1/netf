import { NextRequest, NextResponse } from 'next/server'
import { startBot, stopBot, getBotStatus } from '@/lib/telegram-bot'

export async function GET(request: NextRequest) {
  const status = getBotStatus()
  
  const action = request.nextUrl.searchParams.get('action')
  
  if (action === 'start') {
    const result = await startBot()
    return NextResponse.json({
      status: getBotStatus(),
      ...result
    })
  }
  
  if (action === 'stop') {
    const result = stopBot()
    return NextResponse.json({
      status: getBotStatus(),
      ...result
    })
  }
  
  return NextResponse.json({
    status,
    bot: '@kjhgfdkjhgf_bot',
    message: status === 'running' 
      ? 'Bot is running and polling for messages'
      : 'Bot is stopped. Use ?action=start to start the bot.'
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body
  
  if (action === 'start') {
    const result = await startBot()
    return NextResponse.json({
      status: getBotStatus(),
      ...result
    })
  }
  
  if (action === 'stop') {
    const result = stopBot()
    return NextResponse.json({
      status: getBotStatus(),
      ...result
    })
  }
  
  return NextResponse.json({
    status: getBotStatus(),
    bot: '@kjhgfdkjhgf_bot'
  })
}
