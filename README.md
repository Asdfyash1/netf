# Netflix Cookie Checker

A Next.js application for checking Netflix cookies validity with multi-threading support.

## Features

- ✅ Check Netflix cookies validity (multi-threaded)
- ✅ ZIP archive extraction support
- ✅ Netscape cookies.txt format support
- ✅ Extract cookies from any text format (NetflixId= in any text)
- ✅ Netflix token (nftoken) generation for valid cookies
- ✅ Telegram bot integration
- ✅ Beautiful UI with real-time progress

## Deployment to Vercel (FREE)

### Step 1: Create GitHub Repository
1. Go to [GitHub](https://github.com) and create a new repository
2. Upload all files from this folder
3. Make sure the folder structure is correct:
   ```
   ├── src/
   │   ├── app/
   │   │   ├── api/
   │   │   │   ├── check-cookies/route.ts
   │   │   │   ├── telegram/route.ts
   │   │   │   └── generate-token/route.ts
   │   │   ├── page.tsx
   │   │   ├── layout.tsx
   │   │   └── globals.css
   │   ├── lib/
   │   │   ├── cookie-parser.ts
   │   │   ├── archive-extractor.ts
   │   │   ├── nftoken-generator.ts
   │   │   └── telegram-bot.ts
   │   └── components/ui/
   ├── prisma/schema.prisma
   ├── package.json
   ├── next.config.ts
   └── tailwind.config.ts
   ```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Set **Environment Variables**:
   - `TELEGRAM_BOT_TOKEN` = `8581865451:AAGu-28cZ-F2uOCmY0hR0qhM5gPl2doTyMg`
   - `TELEGRAM_CHAT_ID` = `6738343341`
   - `DATABASE_URL` = `file:./dev.db`
5. Click "Deploy"
6. Wait for deployment to complete

### Step 3: Test Your Deployment
- Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
- Upload a cookie file to test

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=8581865451:AAGu-28cZ-F2uOCmY0hR0qhM5gPl2doTyMg
TELEGRAM_CHAT_ID=6738343341
DATABASE_URL=file:./dev.db
```

## Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev

# Open http://localhost:3000
```

## Supported Cookie Formats

The parser automatically detects and extracts cookies from:

1. **Netscape cookies.txt format** (tab-separated)
   ```
   .netflix.com	TRUE	/	FALSE	1803517598	NetflixId	ct%3DBgjHl...
   ```

2. **NetflixId= in any text**
   ```
   NetflixId=v%3D3%26ct%3DBgjHl...; SecureNetflixId=...
   ```

3. **PREMIUM ACCOUNT block format** (with emojis)
   ```
   🔹 PREMIUM ACCOUNT #1
   📧 Email: user@example.com
   🍪 Cookie: NetflixId=...
   ```

4. **Pipe-separated format**
   ```
   | NetflixId = v%3D... | Country = US | Plan = Premium |
   ```

5. **JSON format**
   ```json
   {"netflixId": "v%3D...", "email": "user@example.com"}
   ```

## API Endpoints

### POST /api/check-cookies
Upload cookie files for checking:
- `files`: Cookie files (ZIP, TXT, JSON)
- `concurrency`: Number of threads (1-50, default 15)

### GET /api/telegram?action=start
Start the Telegram bot

## Telegram Bot

- **Bot**: @kjhgfdkjhgf_bot
- Send `/start` to begin
- Send cookie files to check

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **Prisma** - Database ORM
- **Telegram Bot API** - Bot integration

## License

MIT
