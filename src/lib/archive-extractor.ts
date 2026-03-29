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

import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, readFileSync, readdirSync, statSync, rmSync, mkdirSync } from 'fs';

function extractRar(buffer: Buffer, originalName: string, depth = 0): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  if (depth > 5) return files;
  
  const tempId = `rar_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tempDir = join(tmpdir(), tempId);
  const rarPath = join(tempDir, 'temp.rar');
  const extractDir = join(tempDir, 'extracted');
  
  try {
    mkdirSync(extractDir, { recursive: true });
    writeFileSync(rarPath, buffer);
    
    // Commands to try (Linux, Mac, Windows)
    const commands = [
      `unrar x -y "${rarPath}" "${extractDir}"`,
      `7z x -y "${rarPath}" -o"${extractDir}"`,
      `"C:\\Program Files\\WinRAR\\UnRAR.exe" x -y "${rarPath}" "${extractDir}"`,
      `"C:\\Program Files\\7-Zip\\7z.exe" x -y "${rarPath}" -o"${extractDir}"`
    ];
    
    let success = false;
    for (const cmd of commands) {
      try {
        execSync(cmd, { stdio: 'ignore' });
        success = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!success) {
      console.log('Failed to extract RAR. No suitable unrar tool found on system.');
      return [{
        name: `${originalName}/error.txt`,
        content: `⚠️ System missing UnRAR tool. \n\nIf you are on Railway, please add a nixpacks.toml file with ['unrar', 'p7zip-full'] packages.`
      }];
    }
    
    // Walk extracted folder
    const walkDir = (dir: string, prefix: string = '') => {
      const items = readdirSync(dir);
      for (const item of items) {
        if (item === 'temp.rar') continue;
        const fullPath = join(dir, item);
        if (statSync(fullPath).isDirectory()) {
          walkDir(fullPath, `${prefix}${item}/`);
        } else {
          try {
            const fileName = item.toLowerCase();
            const textExtensions = ['.txt', '.json', '.csv', '.log', '.xml', '.html', '.htm', '.text', '.cookie', '.cookies', '.ini', '.cfg', '.data', '.md', '.yaml', '.yml', '.js', '.ts', '.py', '.css', '.sql', '.env', '.gitignore', '.sh', '.bat', '.ps1'];
            
            const contentBuffer = readFileSync(fullPath);
            
            if (fileName.endsWith('.rar')) {
              files.push(...extractRar(contentBuffer, `${originalName}/${prefix}${item}`, depth + 1));
            } else if (fileName.endsWith('.zip')) {
              files.push(...extractFromZip(contentBuffer, `${originalName}/${prefix}${item}`, depth + 1));
            } else {
              const isTextFile = textExtensions.some(ext => fileName.endsWith(ext)) || fileName.indexOf('.') === -1;
              if (isTextFile) {
                const content = contentBuffer.toString('utf-8');
                if (!content.includes('\0')) {
                  files.push({ name: `${originalName}/${prefix}${item}`, content });
                }
              }
            }
          } catch(e) {
            console.error(`Error reading nested file inside RAR:`, e);
          }
        }
      }
    };
    
    walkDir(extractDir);
    
  } catch (error) {
    console.error('RAR extraction error:', error);
  } finally {
    try {
      if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    } catch(e) {}
  }
  
  return files;
}

/**
 * Main extraction function - handles ZIP with nested archive support
 * Note: RAR files will execute using system binaries
 */
export function extractArchive(buffer: Buffer, fileName: string): ExtractedFile[] {
  const lowerName = fileName.toLowerCase();
  const detectedType = detectFileType(buffer);
  
  console.log(`extractArchive called: fileName=${fileName}, detectedType=${detectedType}, bufferSize=${buffer.length}`);
  
  // RAR supported using child_process and terminal tools
  if (lowerName.endsWith('.rar') || detectedType === 'rar') {
    console.log(`Extracting RAR archive: ${fileName}`);
    return extractRar(buffer, fileName, 0);
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
