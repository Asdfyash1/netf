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
      
      // Check if this is a nested ZIP archive
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
      const textExtensions = ['.txt', '.json', '.csv', '.log', '.xml', '.html', '.htm', '.text', '.cookie', '.cookies'];
      const isTextFile = textExtensions.some(ext => fileName.endsWith(ext)) || 
                         fileName.indexOf('.') === -1; // Files without extension might be text
      
      if (isTextFile) {
        try {
          const content = entry.getData().toString('utf-8');
          files.push({
            name: `${originalName}/${fullFileName}`,
            content: content
          });
        } catch (e) {
          console.error(`Failed to read ${fullFileName}:`, e);
        }
      }
    }
  } catch (error) {
    console.error('ZIP extraction error:', error);
    throw new Error(`Failed to extract ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return files;
}

/**
 * Detect file type based on magic bytes
 */
function detectFileType(buffer: Buffer): 'zip' | 'rar' | 'unknown' {
  // RAR magic bytes: RAR!\x1a\x07
  if (buffer.length >= 7 && 
      buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && 
      buffer[3] === 0x21 && buffer[4] === 0x1a && buffer[5] === 0x07) {
    return 'rar';
  }
  
  // ZIP magic bytes: PK\x03\x04 or PK\x05\x06 (empty) or PK\x07\x08
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
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
  
  // RAR not supported on Vercel
  if (lowerName.endsWith('.rar') || detectedType === 'rar') {
    console.log(`RAR extraction not supported on serverless: ${fileName}`);
    return [{
      name: `${fileName}/error.txt`,
      content: `RAR files are not supported on this deployment. Please extract the RAR file on your computer and upload the contents as a ZIP file.`
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
