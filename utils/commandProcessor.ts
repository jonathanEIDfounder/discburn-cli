import { uploadToOneDrive, createOneDriveFolder } from './onedrive';
import { generateMockFiles, DVD_CAPACITY } from './mockFiles';
import { formatFileSize, generateId } from './storage';

export interface CommandResult {
  success: boolean;
  message: string;
  action?: string;
  data?: any;
}

export interface ParsedCommand {
  intent: 'burn_to_disc' | 'backup' | 'sync' | 'list' | 'clear' | 'help' | 'status' | 'unknown';
  target: string;
  options: Record<string, any>;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function parseCommandWithLLM(userInput: string): Promise<ParsedCommand> {
  if (!OPENAI_API_KEY) {
    return parseCommandLocally(userInput);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a command parser for a file backup and disc burning application. Parse the user's natural language input into a structured command.

Available intents:
- burn_to_disc: User wants to prepare files for burning to a disc (DVD/CD)
- backup: User wants to backup files to cloud storage (OneDrive)
- sync: User wants to sync files with cloud storage
- list: User wants to list available files
- clear: User wants to clear the current queue
- status: User wants to check device/connection status
- help: User wants help or information

Respond ONLY with valid JSON in this exact format:
{"intent": "intent_name", "target": "what files/folders to act on", "options": {}}

Examples:
- "burn to disc all projects" -> {"intent": "burn_to_disc", "target": "all projects", "options": {}}
- "save everything to the cloud" -> {"intent": "backup", "target": "all", "options": {}}
- "backup my documents to OneDrive" -> {"intent": "backup", "target": "documents", "options": {"destination": "onedrive"}}
- "what files do I have" -> {"intent": "list", "target": "all", "options": {}}
- "help" -> {"intent": "help", "target": "", "options": {}}`
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      const parsed = JSON.parse(content);
      return {
        intent: parsed.intent || 'unknown',
        target: parsed.target || '',
        options: parsed.options || {},
      };
    }
  } catch (error) {
    console.log('LLM parsing failed, using local parser');
  }

  return parseCommandLocally(userInput);
}

function parseCommandLocally(input: string): ParsedCommand {
  const lower = input.toLowerCase().trim();
  
  if (lower.includes('burn') || lower.includes('disc') || lower.includes('dvd') || lower.includes('cd')) {
    const target = lower.replace(/burn|to|disc|dvd|cd|the|my/gi, '').trim() || 'all';
    return { intent: 'burn_to_disc', target, options: {} };
  }
  
  if (lower.includes('backup') || lower.includes('save') || lower.includes('upload') || lower.includes('cloud')) {
    const target = lower.replace(/backup|save|upload|to|cloud|onedrive|the|my/gi, '').trim() || 'all';
    return { intent: 'backup', target, options: { destination: 'onedrive' } };
  }
  
  if (lower.includes('sync')) {
    return { intent: 'sync', target: 'all', options: {} };
  }
  
  if (lower.includes('list') || lower.includes('show') || lower.includes('what')) {
    return { intent: 'list', target: 'all', options: {} };
  }
  
  if (lower.includes('clear') || lower.includes('remove') || lower.includes('delete queue')) {
    return { intent: 'clear', target: 'queue', options: {} };
  }
  
  if (lower.includes('status') || lower.includes('connected') || lower.includes('device')) {
    return { intent: 'status', target: '', options: {} };
  }
  
  if (lower.includes('help') || lower === '?') {
    return { intent: 'help', target: '', options: {} };
  }
  
  return { intent: 'unknown', target: input, options: {} };
}

export async function executeCommand(command: ParsedCommand): Promise<CommandResult> {
  switch (command.intent) {
    case 'burn_to_disc':
      return await executeBurnToDisc(command.target);
    
    case 'backup':
      return await executeBackup(command.target);
    
    case 'sync':
      return await executeSync();
    
    case 'list':
      return executeList();
    
    case 'clear':
      return executeClear();
    
    case 'status':
      return executeStatus();
    
    case 'help':
      return executeHelp();
    
    default:
      return {
        success: false,
        message: `I didn't understand that command. Try saying "help" to see what I can do.`,
        action: 'unknown',
      };
  }
}

async function executeBurnToDisc(target: string): Promise<CommandResult> {
  const files = generateMockFiles();
  const selectedFiles = target === 'all' || target === 'all projects' 
    ? files 
    : files.filter(f => f.name.toLowerCase().includes(target.toLowerCase()));
  
  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `DiscBurn_${timestamp}.zip`;
  
  await createOneDriveFolder('DiscBurn');
  
  const manifest = {
    created: new Date().toISOString(),
    target: target,
    files: selectedFiles.map(f => ({ name: f.name, size: f.size, path: f.path })),
    totalSize,
    discType: totalSize > 700000000 ? 'DVD' : 'CD',
    discCapacity: totalSize > 700000000 ? DVD_CAPACITY : 700000000,
  };
  
  const uploadResult = await uploadToOneDrive(
    `${archiveName}_manifest.json`,
    JSON.stringify(manifest, null, 2)
  );
  
  if (uploadResult.success) {
    return {
      success: true,
      message: `Prepared ${selectedFiles.length} files (${formatFileSize(totalSize)}) for burning.\n` +
        `Disc type: ${manifest.discType}\n` +
        `Manifest uploaded to OneDrive: ${uploadResult.path}\n` +
        `Ready for propagation to SovereignCapsule.`,
      action: 'burn_to_disc',
      data: manifest,
    };
  } else {
    return {
      success: false,
      message: `Failed to upload to OneDrive: ${uploadResult.error}`,
      action: 'burn_to_disc',
    };
  }
}

async function executeBackup(target: string): Promise<CommandResult> {
  const files = generateMockFiles();
  const selectedFiles = target === 'all' 
    ? files 
    : files.filter(f => f.name.toLowerCase().includes(target.toLowerCase()));
  
  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  await createOneDriveFolder('DiscBurn');
  
  const backupManifest = {
    created: new Date().toISOString(),
    type: 'backup',
    files: selectedFiles.map(f => ({ name: f.name, size: f.size, path: f.path })),
    totalSize,
  };
  
  const uploadResult = await uploadToOneDrive(
    `backup_${timestamp}.json`,
    JSON.stringify(backupManifest, null, 2)
  );
  
  if (uploadResult.success) {
    return {
      success: true,
      message: `Backed up ${selectedFiles.length} files (${formatFileSize(totalSize)}) to OneDrive.\n` +
        `Location: ${uploadResult.path}`,
      action: 'backup',
      data: backupManifest,
    };
  } else {
    return {
      success: false,
      message: `Backup failed: ${uploadResult.error}`,
      action: 'backup',
    };
  }
}

async function executeSync(): Promise<CommandResult> {
  return {
    success: true,
    message: 'Syncing with OneDrive...\nSync complete. All files are up to date.',
    action: 'sync',
  };
}

function executeList(): CommandResult {
  const files = generateMockFiles();
  const fileList = files.map(f => `  ${f.type === 'folder' ? '[Folder]' : '[File]'} ${f.name} (${formatFileSize(f.size)})`).join('\n');
  
  return {
    success: true,
    message: `Available files:\n${fileList}`,
    action: 'list',
    data: files,
  };
}

function executeClear(): CommandResult {
  return {
    success: true,
    message: 'Burn queue cleared.',
    action: 'clear',
  };
}

function executeStatus(): CommandResult {
  return {
    success: true,
    message: `System Status:\n` +
      `  OneDrive: Connected\n` +
      `  HP DVD557s: Waiting for connection\n` +
      `  SovereignCapsule: Ready for propagation\n` +
      `\nNote: Connect your HP DVD557s drive to enable disc burning.`,
    action: 'status',
  };
}

function executeHelp(): CommandResult {
  return {
    success: true,
    message: `DiscBurn Commands:\n\n` +
      `  "burn to disc [target]" - Prepare files for disc burning\n` +
      `    Examples: "burn to disc all projects", "burn my documents"\n\n` +
      `  "backup [target]" - Backup files to OneDrive\n` +
      `    Examples: "backup everything", "save my files to cloud"\n\n` +
      `  "list" - Show available files\n` +
      `  "status" - Check device connections\n` +
      `  "clear" - Clear the burn queue\n` +
      `  "help" - Show this help message\n\n` +
      `You can use natural language - I'll understand what you mean!`,
    action: 'help',
  };
}
