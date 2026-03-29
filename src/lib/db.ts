import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Default to a local SQLite file if DATABASE_URL is not provided
const datasourceUrl = process.env.DATABASE_URL || 'file:./dev.db'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasourceUrl: datasourceUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
