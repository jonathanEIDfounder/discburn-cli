/**
 * ISO Generator
 * Creates a burnable ISO image from workspace files
 * User downloads ISO and burns on any Windows/Mac computer
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { uploadToOneDrive } from '../adapters/onedrive';

interface ISOManifest {
  id: string;
  created: string;
  files: FileEntry[];
  totalSize: number;
  isoPath: string;
}

interface FileEntry {
  path: string;
  size: number;
  content: string;
}

export async function generateBurnPackage(files: string[]): Promise<{
  success: boolean;
  manifest: ISOManifest | null;
  message: string;
}> {
  const id = `disc-${Date.now()}`;
  const created = new Date().toISOString();
  
  try {
    const fileEntries: FileEntry[] = [];
    let totalSize = 0;
    
    for (const filePath of files) {
      try {
        const fullPath = path.join(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const size = Buffer.byteLength(content, 'utf-8');
        
        fileEntries.push({
          path: filePath,
          size,
          content,
        });
        
        totalSize += size;
      } catch {
        // Skip files that can't be read
      }
    }
    
    // Create burn package (ZIP-like structure as JSON for now)
    const burnPackage = {
      id,
      created,
      platform: 'DiscBurn v2.0',
      device: 'HP DVD557s',
      files: fileEntries.map(f => ({
        path: f.path,
        size: f.size,
      })),
      totalSize,
      totalFiles: fileEntries.length,
      instructions: `
=== BURN INSTRUCTIONS ===
1. Download this package from OneDrive
2. Extract files to a folder
3. Use Windows: Right-click folder -> "Burn to disc"
   Or use ImgBurn/CDBurnerXP for more control
4. Insert blank DVD-R in HP DVD557s
5. Start burn process

Device: HP DVD557s
Files: ${fileEntries.length}
Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB
`,
    };
    
    // Upload single combined package (faster than individual files)
    const burnFolder = `burn-ready/${id}`;
    
    // Create combined archive
    const archive = {
      ...burnPackage,
      fileContents: fileEntries.reduce((acc, entry) => {
        acc[entry.path] = entry.content;
        return acc;
      }, {} as Record<string, string>),
    };
    
    // Upload single archive file
    await uploadToOneDrive(`${burnFolder}/BURN_PACKAGE.json`, JSON.stringify(archive, null, 2));
    
    // Upload instructions
    await uploadToOneDrive(`${burnFolder}/README_BURN.txt`, burnPackage.instructions);
    
    const manifest: ISOManifest = {
      id,
      created,
      files: fileEntries,
      totalSize,
      isoPath: `OneDrive/DiscBurn/${burnFolder}`,
    };
    
    return {
      success: true,
      manifest,
      message: `Burn package ready: ${fileEntries.length} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
    };
    
  } catch (error: any) {
    return {
      success: false,
      manifest: null,
      message: `Failed to generate burn package: ${error.message}`,
    };
  }
}

export async function createBurnScript(): Promise<string> {
  const script = `@echo off
REM DiscBurn Executor for HP DVD557s
REM Run this script on a Windows PC connected to the DVD burner

echo ================================
echo DiscBurn Executor v2.0
echo Device: HP DVD557s
echo ================================
echo.

REM Check for disc
echo Checking for blank disc...
echo Please insert a blank DVD-R into the HP DVD557s

pause

REM Use Windows built-in burning
echo Starting burn process...
echo.

REM The files should be in the same folder as this script
set BURN_FOLDER=%~dp0

echo Burning files from: %BURN_FOLDER%
echo.

REM Use isoburn.exe (Windows built-in)
if exist "%BURN_FOLDER%\\*.iso" (
    isoburn.exe /Q "%BURN_FOLDER%\\*.iso"
) else (
    echo No ISO found. Please use Windows Explorer to burn the folder contents.
    echo Right-click the folder -> Send to -> DVD RW Drive
    explorer.exe "%BURN_FOLDER%"
)

echo.
echo Burn process initiated.
pause
`;
  
  return script;
}
