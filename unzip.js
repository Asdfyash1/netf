const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");

if (fs.existsSync("app.zip")) {
  console.log("📦 Extracting app.zip into /app...");

  if (!fs.existsSync("app")) {
    fs.mkdirSync("app");
  }

  const zip = new AdmZip("app.zip");
  zip.extractAllTo("./app", true);

  console.log("✅ Extraction complete");

  // ── Prisma 7 migration patches ────────────────────────────────────────────
  // Prisma 7 no longer supports `url` in schema.prisma datasource blocks.
  // Connection URLs must be configured in prisma.config.ts instead.

  // 1. Patch prisma/schema.prisma — remove the `url` line from datasource block
  const schemaPath = path.join("app", "prisma", "schema.prisma");
  if (fs.existsSync(schemaPath)) {
    console.log("🔧 Patching prisma/schema.prisma for Prisma 7...");
    let schema = fs.readFileSync(schemaPath, "utf8");
    // Remove any `url = ...` line inside the datasource block
    schema = schema.replace(/^[ \t]*url\s*=\s*.+\r?\n/m, "");
    fs.writeFileSync(schemaPath, schema, "utf8");
    console.log("✅ schema.prisma patched");
  } else {
    console.warn("⚠️  prisma/schema.prisma not found — skipping schema patch");
  }

  // 2. Create prisma.config.ts — Prisma 7 datasource configuration for SQLite
  const prismaConfigPath = path.join("app", "prisma.config.ts");
  if (!fs.existsSync(prismaConfigPath)) {
    console.log("🔧 Creating prisma.config.ts for Prisma 7...");
    // For SQLite with better-sqlite3, DATABASE_URL is a file path like "file:./dev.db"
    // Strip the "file:" prefix to get the raw filesystem path for the Database constructor.
    const prismaConfigContent = `import path from "path";
import { defineConfig } from "prisma/config";
import Database from "better-sqlite3";
import { PrismaLibSQL } from "@prisma/adapter-better-sqlite3";

// Prisma 7: datasource URL is configured here instead of schema.prisma
export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrate: {
    adapter: () => {
      const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
      // Strip the "file:" prefix that SQLite URLs use
      const dbPath = url.startsWith("file:") ? url.slice(5) : url;
      return new PrismaLibSQL(new Database(dbPath));
    },
  },
});
`;
    fs.writeFileSync(prismaConfigPath, prismaConfigContent, "utf8");
    console.log("✅ prisma.config.ts created");
  } else {
    console.log("ℹ️  prisma.config.ts already exists — skipping creation");
  }

  // 3. Patch PrismaClient instantiation to pass the adapter
  //    Search common locations for the Prisma client singleton
  const candidatePrismaClientFiles = [
    path.join("app", "src", "lib", "prisma.ts"),
    path.join("app", "src", "lib", "db.ts"),
    path.join("app", "lib", "prisma.ts"),
    path.join("app", "lib", "db.ts"),
    path.join("app", "src", "db.ts"),
    path.join("app", "db.ts"),
  ];

  let prismaClientFile = null;
  for (const candidate of candidatePrismaClientFiles) {
    if (fs.existsSync(candidate)) {
      prismaClientFile = candidate;
      break;
    }
  }

  if (prismaClientFile) {
    console.log(`🔧 Patching PrismaClient in ${prismaClientFile} for Prisma 7...`);
    let clientSrc = fs.readFileSync(prismaClientFile, "utf8");

    // Only patch if it hasn't been patched already
    if (!clientSrc.includes("adapter-better-sqlite3") && !clientSrc.includes("adapter")) {
      // Build the adapter preamble to prepend
      const adapterPreamble =
        `import Database from "better-sqlite3";\n` +
        `import { PrismaLibSQL } from "@prisma/adapter-better-sqlite3";\n` +
        `const _dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";\n` +
        `const _dbPath = _dbUrl.startsWith("file:") ? _dbUrl.slice(5) : _dbUrl;\n` +
        `const _adapter = new PrismaLibSQL(new Database(_dbPath));\n`;

      clientSrc = adapterPreamble + clientSrc;

      // Replace `new PrismaClient()` or `new PrismaClient({...})` with adapter-aware version
      clientSrc = clientSrc.replace(
        /new PrismaClient\(\s*\)/g,
        `new PrismaClient({ adapter: _adapter })`
      );
      clientSrc = clientSrc.replace(
        /new PrismaClient\(\s*\{/g,
        `new PrismaClient({ adapter: _adapter,`
      );

      fs.writeFileSync(prismaClientFile, clientSrc, "utf8");
      console.log("✅ PrismaClient patched");
    } else {
      console.log("ℹ️  PrismaClient already has adapter config — skipping patch");
    }
  } else {
    console.warn("⚠️  PrismaClient file not found in common locations — skipping client patch");
  }
  // ── End Prisma 7 migration patches ────────────────────────────────────────
} else {
  console.log("❌ app.zip not found");
}
