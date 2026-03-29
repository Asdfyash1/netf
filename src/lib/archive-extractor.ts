/**
 * Archive Extractor - Handles ZIP file extraction with NESTED archive support
 * Uses adm-zip for ZIP files
 * Note: RAR support is disabled on Vercel (requires system unrar)
 */

import AdmZip from 'adm-zip';

export interface ExtractedFile {
  name: string;
  content: string;
}

/**
 * Extract text files from a ZIP archive (including nested archives)
 */
function extractFromZip(buffer: Buffer, originalName: string, depth: number = 0): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const maxDepth = 10; // Prevent infinite recursion
  
  if (depth > maxDepth) {
    console.log(`Max depth ${maxDepth} reached, stopping nested extraction`);
    return files;
  }
  
  try {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      
      const fileName = entry.entryName.toLowerCase();
      const fullFileName = entry.entryName;
      
      // Check if this is a nested archive (ZIP, RAR - RAR will just be skipped as we can't extract it)
      if (fileName.endsWith('.zip')) {
        console.log(`Found nested ZIP: ${fullFileName}`);
        try {
          const nestedBuffer = entry.getData();
          const nestedFiles = extractFromZip(nestedBuffer, fullFileName, depth + 1);
          for (const nf of nestedFiles) {
            files.push({
              name: `${originalName}/${nf.name}`,
              content: nf.content
            });
          }
        } catch (e) {
          console.error(`Failed to extract nested ZIP ${fullFileName}:`, e);
        }
        continue;
      }
      
      // Extract text files - expanded list of extensions
      const textExtensions = [
        '.txt', '.json', '.csv', '.log', '.xml', '.html', '.htm', 
        '.text', '.cookie', '.cookies', '.ini', '.cfg', '.data',
        '.md', '.yaml', '.yml', '.js', '.ts', '.py', '.css', '.sql',
        '.env', '.gitignore', '.sh', '.bat', '.ps1'
      ];
      
      const isTextFile = textExtensions.some(ext => fileName.endsWith(ext)) || 
                         fileName.indexOf('.') === -1 || // Files without extension might be text
                         fileName === 'cookies' ||
                         fileName.includes('cookie') ||
                         fileName.includes('config');
      
      if (isTextFile) {
        try {
          const content = entry.getData().toString('utf-8');
          // Basic check to see if it's actually readable text and not binary
          // Check for null bytes which usually indicate binary
          if (!content.includes('\0')) {
            console.log(`Extracted text file: ${fullFileName}`);
            files.push({
              name: `${originalName}/${fullFileName}`,
              content: content
            });
          }
        } catch (e) {
          console.error(`Failed to read ${fullFileName}:`, e);
        }
      }
    }
  } catch (error) {
    console.error('ZIP extraction error:', error);
    // Don't throw for nested files, just skip and return what we found
    if (depth === 0) {
      throw new Error(`Failed to extract ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return files;
}

/**
 * Detect file type based on magic bytes
 */
function detectFileType(buffer: Buffer): 'zip' | 'rar' | 'unknown' {
  if (!buffer || buffer.length < 4) return 'unknown';

  // RAR magic bytes: RAR!\x1a\x07 (v1.5) or RAR!\x1a\x07\x00 (v5.0)
  if (buffer.length >= 7 && 
      buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && 
      buffer[3] === 0x21 && buffer[4] === 0x1a && buffer[5] === 0x07) {
    return 'rar';
  }
  
  // ZIP magic bytes: PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'zip';
  }
  
  return 'unknown';
}

/**
 * Main extraction function - handles ZIP with nested archive support
 * Note: RAR files will return an error message on Vercel
 */
export function extractArchive(buffer: Buffer, fileName: string): ExtractedFile[] {
  const lowerName = fileName.toLowerCase();
  const detectedType = detectFileType(buffer);
  
  console.log(`extractArchive called: fileName=${fileName}, detectedType=${detectedType}, bufferSize=${buffer.length}`);
  
  // RAR not supported on serverless generally without native binaries
  if (lowerName.endsWith('.rar') || detectedType === 'rar') {
    console.log(`RAR extraction not supported: ${fileName}`);
    return [{
      name: `${fileName}/error.txt`,
      content: `⚠️ RAR files cannot be extracted directly by the bot. \n\n💡 TIP: Please extract the RAR on your device and send the .txt files or zip them into a .zip file and send again.`
    }];
  }
  
  if (lowerName.endsWith('.zip') || detectedType === 'zip') {
    console.log(`Extracting ZIP archive (with nested support): ${fileName}`);
    return extractFromZip(buffer, fileName, 0);
  }
  
  // Not an archive
  console.log(`Not an archive: ${fileName}`);
  return [];
}

/**
 * Check if a file is an archive
 */
export function isArchive(fileName: string, buffer?: Buffer): boolean {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.endsWith('.zip') || lowerName.endsWith('.rar')) {
    return true;
  }
  
  if (buffer) {
    const type = detectFileType(buffer);
    return type !== 'unknown';
  }
  
  return false;
}
