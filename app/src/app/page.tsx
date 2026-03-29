'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock,
  Mail,
  Globe,
  CreditCard,
  Calendar,
  User,
  Film,
  Trash2,
  Download,
  RefreshCw,
  Key,
  Copy,
  Check,
  Sparkles,
  Zap,
  Users,
  MonitorPlay,
  Phone,
  Settings,
  Cpu,
  Bot,
  Play,
  Send,
  ExternalLink
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface CheckResult {
  cookie: {
    email: string;
    firstName?: string;
    country: string;
    plan: string;
    netflixId: string;
    rawCookie: string;
    paymentMethod?: string;
    cardBrand?: string;
    cardLast4?: string;
    nextBilling?: string;
    profiles?: string[];
    maxStreams?: string;
    videoQuality?: string;
    memberSince?: string;
    phoneNumber?: string;
    extraMemberSlot?: string;
    nftoken?: string;
    phoneLoginUrl?: string;
    pcLoginUrl?: string;
    secureNetflixId?: string;
    nfvdid?: string;
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

interface ApiResponse {
  success: boolean;
  message: string;
  parseErrors: string[];
  results: CheckResult[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    expired: number;
    errors: number;
  };
  concurrency?: number;
}

// Dynamic import for particles
const ParticlesBg = dynamic(() => import('@/components/particles-bg'), { 
  ssr: false,
  loading: () => null
})

export default function NetflixCheckerPage() {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ApiResponse | null>(null)
  const [progress, setProgress] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [animateHeader, setAnimateHeader] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [concurrency, setConcurrency] = useState(15) // Default 15 threads
  const [botStatus, setBotStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown')
  const [tokenInput, setTokenInput] = useState('')
  const [tokenResult, setTokenResult] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const checkBotStatus = async () => {
    try {
      const response = await fetch('/api/telegram')
      const data = await response.json()
      setBotStatus(data.status || 'unknown')
    } catch {
      setBotStatus('unknown')
    }
  }

  const startBot = async () => {
    try {
      const response = await fetch('/api/telegram?action=start')
      const data = await response.json()
      if (data.success) {
        setBotStatus('running')
        toast({
          title: '🤖 Bot Started!',
          description: 'Telegram bot is now running!',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to start Telegram bot',
        variant: 'destructive',
      })
    }
  }

  const generateToken = async () => {
    if (!tokenInput.trim()) {
      toast({
        title: '⚠️ No Cookie',
        description: 'Please enter a Netflix cookie',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setTokenResult(null)

    try {
      const response = await fetch('/api/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: tokenInput }),
      })

      const data = await response.json()

      if (data.success) {
        setTokenResult(data)
        toast({
          title: '🔑 Token Generated!',
          description: 'Netflix token created successfully',
        })
      } else {
        toast({
          title: '❌ Error',
          description: data.error || 'Failed to generate token',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate token',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    setAnimateHeader(true)
    checkBotStatus()
  }, [])

  useEffect(() => {
    if (results) {
      setShowResults(true)
    }
  }, [results])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'text/plain' || file.name.endsWith('.txt') || 
              file.name.endsWith('.zip') || file.name.endsWith('.rar')
    )
    
    if (droppedFiles.length === 0) {
      toast({
        title: '⚠️ Invalid files',
        description: 'Please upload .txt, .zip, or .rar files',
        variant: 'destructive',
      })
      return
    }
    
    setFiles(prev => [...prev, ...droppedFiles])
    toast({
      title: 'Files added',
      description: `${droppedFiles.length} file(s) added`,
    })
  }, [toast])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selectedFiles])
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearFiles = useCallback(() => {
    setFiles([])
    setResults(null)
    setShowResults(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const checkCookies = useCallback(async () => {
    if (files.length === 0) {
      toast({
        title: 'No files',
        description: 'Please add files to check',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    setProgress(0)
    setResults(null)
    setShowResults(false)

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('concurrency', concurrency.toString())

    try {
      // More realistic progress based on file count and concurrency
      const estimatedTime = Math.max(5000, (files.reduce((acc, f) => acc + f.size, 0) / 1024) * 10);
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + (100 - prev) * 0.1, 95))
      }, 500)

      const response = await fetch('/api/check-cookies', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data: ApiResponse = await response.json()
      
      setResults(data)
      
      toast({
        title: 'Check complete!',
        description: `Found ${data.summary.valid} valid, ${data.summary.expired} expired cookies (used ${data.concurrency || concurrency} threads)`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to check cookies. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [files, toast, concurrency])

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast({
      title: 'Copied!',
      description: 'Cookie copied to clipboard',
    })
  }, [toast])

  const exportResults = useCallback(() => {
    if (!results) return

    const validCookies = results.results
      .filter(r => r.status === 'valid')
      .map(r => {
        const lines = [
          `═══════════════════════════════════════════════════════════════`,
          `✅ VALID NETFLIX ACCOUNT`,
          `═══════════════════════════════════════════════════════════════`,
          ``,
          `📧 Email: ${r.cookie.email || 'N/A'}`,
          `🌍 Country: ${r.cookie.country || 'N/A'}`,
          `💎 Plan: ${r.cookie.plan || 'N/A'}`,
          `📺 Quality: ${r.cookie.videoQuality || 'N/A'}`,
          `📱 Max Streams: ${r.cookie.maxStreams || 'N/A'}`,
          `💳 Payment: ${r.cookie.cardBrand ? `${r.cookie.cardBrand} ****${r.cookie.cardLast4 || ''}` : r.cookie.paymentMethod || 'N/A'}`,
          `📆 Next Billing: ${r.cookie.nextBilling || 'N/A'}`,
          `📅 Member Since: ${r.cookie.memberSince || 'N/A'}`,
          `📱 Phone: ${r.cookie.phoneNumber || 'N/A'}`,
          `🔓 Extra Member Slot: ${r.cookie.extraMemberSlot || 'N/A'}`,
          r.cookie.profiles ? `👥 Profiles: ${r.cookie.profiles.join(', ')}` : '',
          ``,
          `───────────────────────────────────────────────────────────────`,
          `🔑 COOKIE:`,
          `───────────────────────────────────────────────────────────────`,
          r.cookie.rawCookie || `NetflixId=${r.cookie.netflixId}`,
          ``,
          `═══════════════════════════════════════════════════════════════`,
          ``,
        ]
        return lines.filter(l => l !== '').join('\n')
      })
      .join('\n')

    const blob = new Blob([validCookies], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'valid_netflix_cookies.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [results])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle2 className="h-5 w-5 text-green-500 animate-bounce-in" />
      case 'invalid':
        return <XCircle className="h-5 w-5 text-red-500 animate-shake" />
      case 'expired':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <Badge className="bg-green-500 hover:bg-green-600 animate-status-pulse">
            <Sparkles className="h-3 w-3 mr-1" />
            VALID
          </Badge>
        )
      case 'invalid':
        return <Badge variant="destructive" className="animate-shake">INVALID</Badge>
      case 'expired':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">EXPIRED</Badge>
      default:
        return <Badge variant="secondary">ERROR</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 md:p-8 relative overflow-hidden">
      {mounted && <ParticlesBg />}
      
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-orange-500/5 animate-gradient-bg pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className={`text-center mb-8 transition-all duration-700 ${animateHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Film className="h-10 w-10 text-red-500 animate-float" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-500 via-red-400 to-orange-400 bg-clip-text text-transparent animate-text-glow">
              Netflix Cookie Checker
            </h1>
            <Zap className="h-8 w-8 text-yellow-500 animate-wiggle" />
          </div>
          <p className="text-gray-400 text-lg animate-fade-in-up">
            Upload cookie files <span className="text-red-400">→</span> Check validity <span className="text-red-400">→</span> Get account details
          </p>
        </div>

        {/* Telegram Bot Card */}
        <Card className={`bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-cyan-900/40 border-blue-500/30 mb-6 overflow-hidden backdrop-blur-sm transition-all duration-500 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 ${animateHeader ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 animate-gradient-bg" />
            <div className="flex items-center justify-between flex-wrap gap-4 relative">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="p-3 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-xl border border-blue-400/30 animate-float">
                    <Bot className="h-8 w-8 text-blue-400" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <span className={`relative flex h-4 w-4 ${botStatus === 'running' ? 'animate-ping' : ''}`}>
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${botStatus === 'running' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-4 w-4 ${botStatus === 'running' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    Telegram Bot
                    <Badge className={`${botStatus === 'running' ? 'bg-green-500' : botStatus === 'stopped' ? 'bg-red-500' : 'bg-gray-500'} border-0`}>
                      {botStatus === 'running' ? '🟢 Online' : botStatus === 'stopped' ? '🔴 Offline' : '⚪ Unknown'}
                    </Badge>
                  </h3>
                  <p className="text-gray-400 mt-1">
                    Check cookies directly from Telegram • Fast & Secure
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={startBot}
                  className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:via-blue-400 hover:to-cyan-400 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Bot
                </Button>
                <a 
                  href="https://t.me/kjhgfdkjhgf_bot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:via-blue-500/30 hover:to-purple-500/30 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300"
                >
                  <Send className="h-4 w-4" />
                  <span className="font-semibold">@kjhgfdkjhgf_bot</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Generator Card */}
        <Card className={`bg-gradient-to-r from-purple-900/40 via-pink-900/40 to-rose-900/40 border-purple-500/30 mb-6 overflow-hidden backdrop-blur-sm transition-all duration-500 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 ${animateHeader ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ animationDelay: '0.15s' }}>
          <CardContent className="p-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-rose-500/10 animate-gradient-bg" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-xl border border-purple-400/30">
                  <Key className="h-8 w-8 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Netflix Token Generator</h3>
                  <p className="text-gray-400 mt-1">
                    Convert cookies to access tokens • Direct login URLs
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 space-y-3 relative">
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your Netflix cookie here (NetflixId=...)..."
                className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
              />
              <Button 
                onClick={generateToken}
                disabled={isGenerating || !tokenInput.trim()}
                className="w-full bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 hover:from-purple-500 hover:via-pink-400 hover:to-rose-400 transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Token
                  </>
                )}
              </Button>
              
              {tokenResult && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400 font-semibold">Generated Token:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(tokenResult.nftoken)
                        toast({ title: '📋 Copied!', description: 'Token copied to clipboard' })
                      }}
                      className="h-7 text-xs hover:bg-purple-500/20"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <code className="block text-xs text-green-400 bg-gray-800 p-2 rounded break-all">
                    {tokenResult.nftoken}
                  </code>
                  
                  {tokenResult.usage && (
                    <div className="pt-2 border-t border-gray-700">
                      <span className="text-gray-400 text-sm">Direct Access URL:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 text-xs text-cyan-400 bg-gray-800 p-2 rounded truncate">
                          {tokenResult.usage.browser}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(tokenResult.usage.browser)
                            toast({ title: '📋 Copied!', description: 'URL copied' })
                          }}
                          className="h-7 text-xs hover:bg-cyan-500/20"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <a
                          href={tokenResult.usage.browser}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-7 px-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card className={`bg-gray-800/50 border-gray-700 mb-6 card-hover-lift backdrop-blur-sm transition-all duration-500 ${animateHeader ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 animate-pulse" />
              Upload Cookie Files
            </CardTitle>
            <CardDescription>
              Drag & drop .txt, .zip, or .rar files • Nested archives supported • Multi-threaded checking
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300
                ${isDragging 
                  ? 'border-red-500 bg-red-500/20 scale-105 shadow-lg shadow-red-500/20' 
                  : 'border-gray-600 hover:border-red-400 hover:bg-gray-700/50 hover:scale-[1.02]'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,text/plain,.zip,.rar"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className={`h-12 w-12 mx-auto mb-4 transition-all duration-300 ${isDragging ? 'text-red-400 animate-bounce' : 'text-gray-500'}`} />
              <p className="text-lg mb-2">
                {isDragging ? '📁 Drop files here!' : 'Drag & drop files or click to browse'}
              </p>
              <p className="text-sm text-gray-500">
                Supports: .txt, .zip, .rar files (nested archives supported!)
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-4 animate-slide-in-bottom">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">
                    {files.length} file(s) selected ({(files.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB total)
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFiles}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
                <ScrollArea className="h-32 custom-scrollbar">
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between bg-gray-700/50 rounded-lg p-2 animate-scale-in hover:bg-gray-700/70 transition-colors"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-400" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Concurrency Settings */}
            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold">Multi-Threading</span>
                </div>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                  {concurrency} Threads
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>1 Thread (Slow)</span>
                  <span>25 Threads (Fast)</span>
                  <span>50 Threads (Max)</span>
                </div>
                <Slider
                  value={[concurrency]}
                  onValueChange={(value) => setConcurrency(value[0])}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 text-center">
                  Higher threads = Faster checking. Default: 15 | Max: 50
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            {isLoading && (
              <div className="mt-4 animate-fade-in-up">
                <div className="relative">
                  <Progress value={progress} className="h-3 bg-gray-700" />
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-orange-500 animate-progress-stripes transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-400 text-center mt-2 typing-dots">
                  Checking with <span className="text-yellow-400">{concurrency}</span> threads... <span className="text-red-400">{Math.round(progress)}%</span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <Button
                onClick={checkCookies}
                disabled={files.length === 0 || isLoading}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all duration-300 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 disabled:opacity-50 disabled:shadow-none btn-ripple"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking ({concurrency} threads)...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Check Cookies ({concurrency} threads)
                  </>
                )}
              </Button>
              {results && results.summary.valid > 0 && (
                <Button
                  onClick={exportResults}
                  variant="outline"
                  className="border-red-500/50 hover:bg-red-500/20 hover:border-red-400 animate-scale-in"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Valid
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results && showResults && (
          <div className="space-y-6 animate-slide-in-bottom">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-animation">
              <Card className="bg-gray-800/50 border-gray-700 card-hover-lift backdrop-blur-sm">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold animate-count-up">{results.summary.total}</p>
                    <p className="text-sm text-gray-400">Total</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700 border-l-4 border-l-green-500 card-hover-lift backdrop-blur-sm glow-border">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-500 animate-count-up">{results.summary.valid}</p>
                    <p className="text-sm text-gray-400">Valid</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700 border-l-4 border-l-yellow-500 card-hover-lift backdrop-blur-sm">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-yellow-500 animate-count-up">{results.summary.expired}</p>
                    <p className="text-sm text-gray-400">Expired</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700 border-l-4 border-l-red-500 card-hover-lift backdrop-blur-sm">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-500 animate-count-up">{results.summary.invalid}</p>
                    <p className="text-sm text-gray-400">Invalid</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700 border-l-4 border-l-gray-500 card-hover-lift backdrop-blur-sm">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-400 animate-count-up">{results.summary.errors}</p>
                    <p className="text-sm text-gray-400">Errors</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results List */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="bg-gray-800/50 border border-gray-700 mb-4">
                <TabsTrigger value="all" className="transition-all duration-300">
                  All ({results.summary.total})
                </TabsTrigger>
                <TabsTrigger value="valid" className="data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all duration-300">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Valid ({results.summary.valid})
                </TabsTrigger>
                <TabsTrigger value="expired" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white transition-all duration-300">
                  Expired ({results.summary.expired})
                </TabsTrigger>
                <TabsTrigger value="invalid" className="data-[state=active]:bg-red-600 data-[state=active]:text-white transition-all duration-300">
                  Invalid ({results.summary.invalid})
                </TabsTrigger>
              </TabsList>

              {['all', 'valid', 'expired', 'invalid'].map(tab => (
                <TabsContent key={tab} value={tab} className="animate-fade-in-up">
                  <ScrollArea className="h-[700px] custom-scrollbar">
                    <div className="space-y-4 pr-4 stagger-animation">
                      {results.results
                        .filter(r => tab === 'all' || r.status === tab)
                        .map((result, index) => (
                          <Card
                            key={index}
                            className={`
                              bg-gray-800/80 border-gray-700 overflow-hidden card-hover-lift backdrop-blur-sm
                              ${result.status === 'valid' ? 'border-l-4 border-l-green-500 ring-1 ring-green-500/20' : ''}
                              ${result.status === 'expired' ? 'border-l-4 border-l-yellow-500' : ''}
                              ${result.status === 'invalid' ? 'border-l-4 border-l-red-500' : ''}
                            `}
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <CardContent className="p-0">
                              {/* Header with Status */}
                              <div className={`
                                p-3 flex items-center justify-between transition-all duration-300
                                ${result.status === 'valid' ? 'bg-green-500/10' : ''}
                                ${result.status === 'expired' ? 'bg-yellow-500/10' : ''}
                                ${result.status === 'invalid' ? 'bg-red-500/10' : ''}
                              `}>
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(result.status)}
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <span className="font-semibold text-lg">
                                      {result.cookie.email || 'Unknown Email'}
                                    </span>
                                  </div>
                                </div>
                                {getStatusBadge(result.status)}
                              </div>

                              <div className="p-4 space-y-4">
                                {/* COPY BUTTON - PROMINENT FOR VALID COOKIES */}
                                {result.status === 'valid' && (
                                  <div className="animate-fade-in-up">
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
                                        <Key className="h-4 w-4" />
                                        COOKIE
                                      </h3>
                                      <Button
                                        onClick={() => copyToClipboard(
                                          result.cookie.rawCookie || `NetflixId=${result.cookie.netflixId}`,
                                          result.cookie.netflixId
                                        )}
                                        className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-lg shadow-green-500/20 transition-all duration-300"
                                      >
                                        {copiedId === result.cookie.netflixId ? (
                                          <>
                                            <Check className="h-4 w-4 mr-2" />
                                            Copied!
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy Cookie
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                    <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto ring-2 ring-green-500/30 hover:ring-green-500/50 transition-all duration-300">
                                      <code className="text-xs text-green-400 break-all whitespace-pre-wrap font-mono">
                                        {result.cookie.rawCookie || `NetflixId=${result.cookie.netflixId}`}
                                      </code>
                                    </div>
                                    
                                    {/* NFTOKEN SECTION */}
                                    {result.cookie.nftoken && (
                                      <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/30 via-pink-900/30 to-rose-900/30 rounded-lg border border-purple-500/30">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                            <Sparkles className="h-4 w-4" />
                                            Netflix Token (nftoken)
                                          </h4>
                                          <div className="flex gap-2">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => copyToClipboard(result.cookie.nftoken!, `${result.cookie.netflixId}-token`)}
                                              className="h-7 text-xs hover:bg-purple-500/20 text-purple-300"
                                            >
                                              {copiedId === `${result.cookie.netflixId}-token` ? (
                                                <>
                                                  <Check className="h-3 w-3 mr-1" />
                                                  Copied!
                                                </>
                                              ) : (
                                                <>
                                                  <Copy className="h-3 w-3 mr-1" />
                                                  Copy Token
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                        <code className="block text-xs text-pink-400 bg-gray-900/50 p-2 rounded break-all">
                                          {result.cookie.nftoken}
                                        </code>
                                        
                                        {/* Login URLs */}
                                        <div className="mt-3 space-y-2">
                                          {result.cookie.phoneLoginUrl && (
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-gray-400">📱 Phone:</span>
                                              <a 
                                                href={result.cookie.phoneLoginUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-xs text-cyan-400 hover:text-cyan-300 truncate flex-1"
                                              >
                                                {result.cookie.phoneLoginUrl.substring(0, 60)}...
                                              </a>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  navigator.clipboard.writeText(result.cookie.phoneLoginUrl!);
                                                  toast({ title: '📋 Copied!', description: 'Phone login URL copied' });
                                                }}
                                                className="h-6 w-6 p-0 hover:bg-cyan-500/20"
                                              >
                                                <Copy className="h-3 w-3 text-cyan-400" />
                                              </Button>
                                              <a
                                                href={result.cookie.phoneLoginUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center h-6 w-6 rounded bg-cyan-500/20 hover:bg-cyan-500/30"
                                              >
                                                <ExternalLink className="h-3 w-3 text-cyan-400" />
                                              </a>
                                            </div>
                                          )}
                                          {result.cookie.pcLoginUrl && (
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-gray-400">💻 PC:</span>
                                              <a 
                                                href={result.cookie.pcLoginUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-xs text-cyan-400 hover:text-cyan-300 truncate flex-1"
                                              >
                                                {result.cookie.pcLoginUrl.substring(0, 60)}...
                                              </a>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  navigator.clipboard.writeText(result.cookie.pcLoginUrl!);
                                                  toast({ title: '📋 Copied!', description: 'PC login URL copied' });
                                                }}
                                                className="h-6 w-6 p-0 hover:bg-cyan-500/20"
                                              >
                                                <Copy className="h-3 w-3 text-cyan-400" />
                                              </Button>
                                              <a
                                                href={result.cookie.pcLoginUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center h-6 w-6 rounded bg-cyan-500/20 hover:bg-cyan-500/30"
                                              >
                                                <ExternalLink className="h-3 w-3 text-cyan-400" />
                                              </a>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Account Details Section */}
                                <div className="animate-fade-in-up">
                                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Account Details
                                  </h3>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-gray-900/50 rounded-lg p-3 hover:bg-gray-900/70 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <Globe className="h-3 w-3" />
                                        Country
                                      </div>
                                      <p className="font-medium">{result.cookie.country || 'N/A'}</p>
                                    </div>
                                    <div className="bg-gray-900/50 rounded-lg p-3 hover:bg-gray-900/70 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <Film className="h-3 w-3" />
                                        Plan
                                      </div>
                                      <p className="font-medium">{result.cookie.plan || 'N/A'}</p>
                                    </div>
                                    <div className="bg-gray-900/50 rounded-lg p-3 hover:bg-gray-900/70 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <CreditCard className="h-3 w-3" />
                                        Payment
                                      </div>
                                      <p className="font-medium">
                                        {result.cookie.cardBrand 
                                          ? `${result.cookie.cardBrand} ****${result.cookie.cardLast4 || ''}`
                                          : result.cookie.paymentMethod || 'N/A'
                                        }
                                      </p>
                                    </div>
                                    <div className="bg-gray-900/50 rounded-lg p-3 hover:bg-gray-900/70 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <Calendar className="h-3 w-3" />
                                        Next Billing
                                      </div>
                                      <p className="font-medium">{result.cookie.nextBilling || 'N/A'}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Additional Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  {result.cookie.videoQuality && (
                                    <div className="bg-gray-900/30 rounded-lg p-2 hover:text-red-400 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <MonitorPlay className="h-3 w-3" />
                                        Quality
                                      </div>
                                      <span className="font-medium">{result.cookie.videoQuality}</span>
                                    </div>
                                  )}
                                  {result.cookie.maxStreams && (
                                    <div className="bg-gray-900/30 rounded-lg p-2 hover:text-red-400 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <MonitorPlay className="h-3 w-3" />
                                        Streams
                                      </div>
                                      <span className="font-medium">{result.cookie.maxStreams}</span>
                                    </div>
                                  )}
                                  {result.cookie.memberSince && (
                                    <div className="bg-gray-900/30 rounded-lg p-2 hover:text-red-400 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <Calendar className="h-3 w-3" />
                                        Member Since
                                      </div>
                                      <span className="font-medium">{result.cookie.memberSince}</span>
                                    </div>
                                  )}
                                  {result.cookie.phoneNumber && (
                                    <div className="bg-gray-900/30 rounded-lg p-2 hover:text-red-400 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <Phone className="h-3 w-3" />
                                        Phone
                                      </div>
                                      <span className="font-medium">{result.cookie.phoneNumber}</span>
                                    </div>
                                  )}
                                  {result.cookie.extraMemberSlot && (
                                    <div className="bg-gray-900/30 rounded-lg p-2 hover:text-red-400 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <Users className="h-3 w-3" />
                                        Extra Slot
                                      </div>
                                      <span className="font-medium">{result.cookie.extraMemberSlot}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Cookie for non-valid cookies */}
                                {result.status !== 'valid' && (
                                  <>
                                    <Separator className="bg-gray-700" />
                                    <div className="animate-fade-in-up">
                                      <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                          <Key className="h-4 w-4" />
                                          Cookie
                                        </h3>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => copyToClipboard(
                                            result.cookie.rawCookie || `NetflixId=${result.cookie.netflixId}`,
                                            result.cookie.netflixId
                                          )}
                                          className="h-7 text-xs hover:bg-gray-700 hover:text-gray-300 transition-all duration-300"
                                        >
                                          {copiedId === result.cookie.netflixId ? (
                                            <>
                                              <Check className="h-3 w-3 mr-1 text-green-500" />
                                              Copied!
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="h-3 w-3 mr-1" />
                                              Copy
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                      <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto hover:ring-2 hover:ring-gray-600 transition-all duration-300">
                                        <code className="text-xs text-gray-400 break-all whitespace-pre-wrap">
                                          {result.cookie.rawCookie || `NetflixId=${result.cookie.netflixId}`}
                                        </code>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      
                      {results.results.filter(r => tab === 'all' || r.status === tab).length === 0 && (
                        <div className="text-center py-12 text-gray-500 animate-bounce-in">
                          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No cookies found in this category</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm animate-fade-in-up">
          <p className="flex items-center justify-center gap-2">
            <Film className="h-4 w-4 text-red-500" />
            Netflix Cookie Checker - Multi-Threaded ({concurrency} threads) - For Educational Purposes Only
          </p>
        </footer>
      </div>
    </div>
  )
}
