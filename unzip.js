const AdmZip = require("adm-zip");
const fs = require("fs");

if (fs.existsSync("app.zip")) {
  console.log("📦 Extracting app.zip into /app...");

  if (!fs.existsSync("app")) {
    fs.mkdirSync("app");
  }

  const zip = new AdmZip("app.zip");
  zip.extractAllTo("./app", true);

  console.log("✅ Extraction complete");
} else {
  console.log("❌ app.zip not found");
}
