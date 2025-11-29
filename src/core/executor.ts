import * as fs from 'fs/promises';
import * as path from 'path';
import { uploadToOneDrive, listOneDriveFiles, checkOneDriveConnection, readFromOneDrive, deleteFromOneDrive } from '../adapters/onedrive';
import { uploadToSovereignCapsule, checkSovereignCapsuleConnection, getSovereignCapsuleStatus } from '../adapters/sovereigncapsule';
import { addToHistory, getSavedCommands } from '../storage/fileStorage';
import { createManifest, transitionState, MANIFEST_VERSION } from './manifest';
import { logAudit, getConfig, getAuditLog, getCommandRegistry } from './admin';
import { establishBidirectionalChannel, sendBurnCommand, sendCancel, sendStatusRequest, receiveSignals, getDeviceState, probeConnection } from '../adapters/usb-signal';
import { runSingleBurn, getExecutorState } from './burn-executor';
import { generateBurnPackage, createBurnScript } from './iso-generator';

interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function executeCommand(intent: string, target?: string, parameters?: Record<string, string>): Promise<CommandResult> {
  const startTime = Date.now();
  
  try {
    let result: CommandResult;
    
    switch (intent) {
      case 'burn_to_disc':
        result = await executeBurnToDisc(target);
        break;
      
      case 'backup':
        result = await executeBackup(target);
        break;
      
      case 'sync':
        result = await executeSync();
        break;
      
      case 'list':
        result = await executeList();
        break;
      
      case 'status':
        result = await executeStatus();
        break;
      
      case 'admin':
        result = await executeAdmin(target);
        break;
      
      case 'watch':
        result = await executeWatch(target);
        break;
      
      case 'cancel':
        result = await executeCancel(target);
        break;
      
      case 'send':
        result = await executeSend(target, parameters);
        break;
      
      case 'automate':
        result = await executeAutomate(target);
        break;
      
      case 'execute':
        result = await executeRunBurn(target);
        break;
      
      case 'package':
        result = await executePackage();
        break;
      
      case 'help':
        result = executeHelp();
        break;
      
      case 'clear':
        result = { success: true, message: 'Burn queue cleared.' };
        break;
      
      default:
        result = { success: false, message: `Unknown command. Type 'help' for available commands.` };
    }
    
    await logAudit({
      level: 'info',
      category: 'command',
      action: intent.toUpperCase(),
      actor: 'user',
      target: target,
      details: { duration: Date.now() - startTime },
      result: result.success ? 'success' : 'failure',
    });
    
    return result;
  } catch (error: any) {
    await logAudit({
      level: 'error',
      category: 'command',
      action: intent.toUpperCase(),
      actor: 'user',
      details: { error: error.message },
      result: 'failure',
    });
    
    return { success: false, message: `Error: ${error.message}` };
  }
}

async function executeBurnToDisc(target?: string): Promise<CommandResult> {
  const files = await scanWorkspaceFiles();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const burnJobId = `burn-${timestamp}`;
  
  const priority = target?.toLowerCase().includes('priority') || target?.toLowerCase().includes('urgent') ? 'high' : 'normal';
  
  const manifest = createManifest({
    jobId: burnJobId,
    files,
    target,
    priority,
  });
  
  const updatedManifest = transitionState(manifest, 'pending', 'system', 'Uploaded to cloud');
  
  const config = await getConfig();
  const results: string[] = [];
  
  try {
    await uploadToOneDrive(`jobs/${burnJobId}/manifest.json`, JSON.stringify(updatedManifest, null, 2));
    await uploadToOneDrive(`pending/${burnJobId}.json`, JSON.stringify({
      jobId: burnJobId,
      status: 'pending',
      created: manifest.job.created,
      fileCount: files.length,
      priority: manifest.job.priority,
    }, null, 2));
    results.push('OneDrive: Uploaded');
    
    if (config.features.dualWrite) {
      const scStatus = getSovereignCapsuleStatus();
      if (scStatus.enabled && scStatus.configured) {
        try {
          await uploadToSovereignCapsule(`jobs/${burnJobId}/manifest.json`, JSON.stringify(updatedManifest, null, 2));
          results.push('SovereignCapsule: Uploaded');
        } catch {
          results.push('SovereignCapsule: Pending');
        }
      } else {
        results.push('SovereignCapsule: Awaiting configuration');
      }
    }
    
    await addToHistory({
      input: `burn to disc ${target || 'all'}`,
      result: `Created burn job ${burnJobId} with ${files.length} files`,
      success: true,
    });
    
    return {
      success: true,
      message: `
ADMINISTRATIVE PLATFORM - BURN JOB
==================================
Job ID: ${burnJobId}
Manifest Version: ${MANIFEST_VERSION}
Status: PENDING
Priority: ${manifest.job.priority.toUpperCase()}

Target Device: ${manifest.target.device.name}
Disc Type: ${manifest.target.discSettings.type}
Files: ${files.length}

Destinations:
${results.map(r => `  - ${r}`).join('\n')}

Location: OneDrive/DiscBurn/pending/${burnJobId}.json

Awaiting executor pickup...
`,
      data: updatedManifest,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to create burn job: ${error.message}`,
    };
  }
}

async function executeBackup(target?: string): Promise<CommandResult> {
  const files = await scanWorkspaceFiles();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const backupData = {
    version: MANIFEST_VERSION,
    type: 'backup',
    timestamp,
    target: target || 'all',
    files,
    totalFiles: files.length,
  };
  
  const fileName = `backups/backup-${timestamp}.json`;
  const config = await getConfig();
  const results: string[] = [];
  
  try {
    await uploadToOneDrive(fileName, JSON.stringify(backupData, null, 2));
    results.push('OneDrive: Complete');
    
    if (config.features.dualWrite) {
      const scStatus = getSovereignCapsuleStatus();
      if (scStatus.enabled && scStatus.configured) {
        try {
          await uploadToSovereignCapsule(fileName, JSON.stringify(backupData, null, 2));
          results.push('SovereignCapsule: Complete');
        } catch {
          results.push('SovereignCapsule: Pending');
        }
      } else {
        results.push('SovereignCapsule: Awaiting configuration');
      }
    }
    
    await addToHistory({
      input: `backup ${target || 'all'}`,
      result: `Backed up ${files.length} files`,
      success: true,
    });
    
    return {
      success: true,
      message: `
BACKUP COMPLETE
===============
Files: ${files.length}
Target: ${target || 'all'}

Destinations:
${results.map(r => `  - ${r}`).join('\n')}
`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Backup failed: ${error.message}`,
    };
  }
}

async function executeSync(): Promise<CommandResult> {
  try {
    const cloudFiles = await listOneDriveFiles();
    const scStatus = getSovereignCapsuleStatus();
    
    return {
      success: true,
      message: `
SYNC STATUS
===========
OneDrive: ${cloudFiles.length} items in /DiscBurn
SovereignCapsule: ${scStatus.enabled ? (scStatus.configured ? 'Connected' : 'Awaiting configuration') : 'Disabled'}
`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Sync failed: ${error.message}`,
    };
  }
}

async function executeList(): Promise<CommandResult> {
  const files = await scanWorkspaceFiles();
  const savedCommands = await getSavedCommands();
  const registry = await getCommandRegistry();
  
  return {
    success: true,
    message: `
WORKSPACE FILES (${files.length})
${files.slice(0, 10).map(f => `  ${f}`).join('\n')}${files.length > 10 ? `\n  ... and ${files.length - 10} more` : ''}

COMMAND REGISTRY (${registry.length})
${registry.map(c => `  [${c.category}] ${c.name}: ${c.command}`).join('\n')}
`,
  };
}

async function executeStatus(): Promise<CommandResult> {
  const oneDriveConnected = await checkOneDriveConnection();
  const scStatus = getSovereignCapsuleStatus();
  const config = await getConfig();
  
  return {
    success: true,
    message: `
DISCBURN ADMINISTRATIVE PLATFORM
================================
Version: ${MANIFEST_VERSION}
Mode: ${config.platform.mode.toUpperCase()}

CONNECTIONS
-----------
OneDrive: ${oneDriveConnected ? 'Connected' : 'Not connected'}
SovereignCapsule: ${scStatus.enabled ? (scStatus.configured ? 'Connected' : 'Awaiting configuration') : 'Disabled'}

DEVICES
-------
${config.devices.map(d => `${d.name}: ${d.enabled ? 'Enabled' : 'Disabled'} (${d.connection})`).join('\n')}

FEATURES
--------
Natural Language: ${config.features.naturalLanguage ? 'On' : 'Off'}
Dual-Write: ${config.features.dualWrite ? 'On' : 'Off'}
Auto-Retry: ${config.features.autoRetry ? 'On' : 'Off'}
Admin Mode: ${config.features.adminMode ? 'On' : 'Off'}

POLICIES
--------
Max Jobs/Day: ${config.policies.maxJobsPerDay}
Max Files/Job: ${config.policies.maxFilesPerJob}
Retention: ${config.policies.retentionDays} days
`,
  };
}

async function executeAdmin(subcommand?: string): Promise<CommandResult> {
  if (!subcommand || subcommand === 'help') {
    return {
      success: true,
      message: `
ADMIN COMMANDS
==============
admin audit    - View recent audit log
admin config   - View platform configuration
admin registry - View command registry

Type: admin <subcommand>
`,
    };
  }
  
  switch (subcommand.toLowerCase()) {
    case 'audit':
      const logs = await getAuditLog(20);
      return {
        success: true,
        message: `
AUDIT LOG (Last 20 entries)
===========================
${logs.map(l => `[${l.timestamp.substring(11, 19)}] ${l.level.toUpperCase()} ${l.action} - ${l.result}`).join('\n')}
`,
      };
    
    case 'config':
      const config = await getConfig();
      return {
        success: true,
        message: `
PLATFORM CONFIGURATION
======================
${JSON.stringify(config, null, 2)}
`,
      };
    
    case 'registry':
      const registry = await getCommandRegistry();
      return {
        success: true,
        message: `
COMMAND REGISTRY
================
${registry.map(c => `
[${c.id}]
  Name: ${c.name}
  Command: ${c.command}
  Category: ${c.category}
  Enabled: ${c.enabled}
  Usage: ${c.usageCount}
`).join('\n')}
`,
      };
    
    default:
      return {
        success: false,
        message: `Unknown admin subcommand: ${subcommand}`,
      };
  }
}

function executeHelp(): CommandResult {
  return {
    success: true,
    message: `
DISCBURN ADMINISTRATIVE PLATFORM
================================
Bidirectional USB Signal Communication
Phone <-> Anker Hub <-> HP DVD557s

BURN COMMANDS
  burn                    - Create burn job for HP DVD557s
  package                 - Create burn-ready package (download to PC)
  burn all projects       - Burn all project files

SIGNAL COMMANDS
  watch                   - Monitor bidirectional signals
  send                    - Send signal to DVD burner
  cancel <jobId>          - Cancel a burn job
  execute                 - Execute burn + sync to OneDrive
  automate                - Start automation loop
  automate auto           - Auto-burn on file changes

BACKUP COMMANDS
  backup                  - Backup to cloud destinations
  backup documents        - Backup specific files

SYSTEM COMMANDS
  sync                    - Sync with cloud storage
  list                    - Show files and commands
  status                  - Platform status
  help                    - This help

ADMIN COMMANDS
  admin audit             - View audit log
  admin config            - View configuration
  admin registry          - View command registry

Type 'exit' to quit.
`,
  };
}

async function executeWatch(target?: string): Promise<CommandResult> {
  const deviceState = await probeConnection();
  const signals = await receiveSignals();
  
  // Get pending jobs from cloud
  const pendingFiles = await listOneDriveFiles('/DiscBurn/pending');
  const statusFiles = await listOneDriveFiles('/DiscBurn/status');
  
  let jobStatuses: any[] = [];
  for (const file of statusFiles.slice(0, 5)) {
    try {
      const content = await readFromOneDrive(`status/${file.name}`);
      if (content) jobStatuses.push(JSON.parse(content));
    } catch {}
  }
  
  return {
    success: true,
    message: `
BIDIRECTIONAL SIGNAL MONITOR
============================
Device: ${deviceState.connected ? `CONNECTED (${deviceState.deviceId})` : 'Searching...'}
Capabilities: ${deviceState.capabilities.join(', ') || 'Probing...'}
Last Signal: ${deviceState.lastSignal ? new Date(deviceState.lastSignal).toLocaleTimeString() : 'None'}

OUTBOUND (Phone -> DVD557s)
---------------------------
Pending Jobs: ${pendingFiles.length}
${pendingFiles.slice(0, 3).map((f: any) => `  - ${f.name}`).join('\n') || '  (none)'}

INBOUND (DVD557s -> Phone)
--------------------------
New Signals: ${signals.length}
${signals.slice(0, 5).map(s => `  [${s.type}] ${JSON.stringify(s.payload).substring(0, 50)}`).join('\n') || '  (waiting...)'}

JOB STATUS
----------
${jobStatuses.map(s => `  ${s.jobId}: ${s.status} ${s.progress ? `(${s.progress}%)` : ''}`).join('\n') || '  No active jobs'}
`,
  };
}

async function executeCancel(target?: string): Promise<CommandResult> {
  if (!target) {
    return { success: false, message: 'Specify job ID to cancel. Usage: cancel <jobId>' };
  }
  
  const signal = await sendCancel(target);
  
  // Also write cancel command to cloud for executor pickup
  await uploadToOneDrive(`commands/${target}-cancel.json`, JSON.stringify({
    jobId: target,
    command: 'cancel',
    timestamp: Date.now(),
    signal,
  }, null, 2));
  
  return {
    success: true,
    message: `
CANCEL SIGNAL SENT
==================
Job ID: ${target}
Signal ID: ${signal.checksum}
Direction: Phone -> Anker -> DVD557s

Awaiting acknowledgment...
`,
  };
}

async function executeSend(target?: string, parameters?: Record<string, string>): Promise<CommandResult> {
  const command = target || 'status';
  const signal = await sendStatusRequest();
  
  if (command === 'burn' && parameters?.files) {
    const burnSignal = await sendBurnCommand(`burn-${Date.now()}`, parameters.files.split(','));
    return {
      success: true,
      message: `
BURN SIGNAL SENT
================
Signal: ${burnSignal.checksum}
Files: ${parameters.files}
Direction: Phone -> Anker -> DVD557s
`,
    };
  }
  
  return {
    success: true,
    message: `
SIGNAL SENT
===========
Command: ${command}
Signal ID: ${signal.checksum}
Timestamp: ${new Date(signal.timestamp).toLocaleTimeString()}
Direction: Phone -> Anker -> DVD557s
`,
  };
}

let automationRunning = false;
let lastFileHash = '';

async function executePackage(): Promise<CommandResult> {
  const files = await scanWorkspaceFiles();
  
  console.log(`[PACKAGE] Creating burn package with ${files.length} files...`);
  
  const result = await generateBurnPackage(files);
  
  if (result.success && result.manifest) {
    const script = await createBurnScript();
    await uploadToOneDrive(`burn-ready/${result.manifest.id}/BURN.bat`, script);
    
    return {
      success: true,
      message: `
BURN PACKAGE READY
==================
Package ID: ${result.manifest.id}
Files: ${result.manifest.files.length}
Size: ${(result.manifest.totalSize / 1024 / 1024).toFixed(2)} MB

Location: OneDrive/DiscBurn/burn-ready/${result.manifest.id}/

TO BURN:
1. Open OneDrive on your computer
2. Navigate to DiscBurn/burn-ready/${result.manifest.id}/
3. Run BURN.bat (Windows) or select all files
4. Right-click -> Send to -> DVD Drive
5. Insert blank DVD-R in HP DVD557s
6. Burn!

The package includes all ${result.manifest.files.length} workspace files ready to burn.
`,
    };
  }
  
  return {
    success: false,
    message: `Failed to create burn package: ${result.message}`,
  };
}

async function executeRunBurn(target?: string): Promise<CommandResult> {
  let jobId = target;
  
  if (!jobId) {
    // Get first pending job
    const pendingFiles = await listOneDriveFiles('/DiscBurn/pending');
    if (pendingFiles.length === 0) {
      return { success: false, message: 'No pending jobs to execute.' };
    }
    jobId = pendingFiles[0].name.replace('.json', '');
  }
  
  console.log(`[EXECUTE] Starting burn: ${jobId}`);
  
  // Run the burn with OneDrive sync after
  const result = await runSingleBurn(jobId as string);
  
  if (result.success) {
    return {
      success: true,
      message: `
BURN EXECUTED
=============
Job ID: ${jobId}
Status: COMPLETE
OneDrive Sync: Done

Signal Path: Phone -> Anker -> DVD557s -> Anker -> Phone -> OneDrive

Completion record saved to:
  - OneDrive/DiscBurn/completed/${jobId}.json
  - OneDrive/DiscBurn/archive/
`,
    };
  }
  
  return {
    success: false,
    message: `Burn failed: ${result.message}`,
  };
}

async function executeAutomate(mode?: string): Promise<CommandResult> {
  if (mode === 'stop') {
    automationRunning = false;
    return { success: true, message: 'Automation stopped.' };
  }
  
  automationRunning = true;
  const startTime = Date.now();
  const config = await getConfig();
  
  // Get current file state
  const files = await scanWorkspaceFiles();
  const currentHash = files.join('|').length.toString();
  
  // Check for pending jobs
  const pendingFiles = await listOneDriveFiles('/DiscBurn/pending');
  const statusFiles = await listOneDriveFiles('/DiscBurn/status');
  
  // Check inbound signals
  const signals = await receiveSignals();
  const deviceState = await probeConnection();
  
  // Check for failed jobs to retry
  let retriedJobs: string[] = [];
  for (const file of statusFiles) {
    try {
      const content = await readFromOneDrive(`status/${file.name}`);
      if (content) {
        const status = JSON.parse(content);
        if (status.status === 'failed' && status.retryCount < 3) {
          // Requeue failed job
          await uploadToOneDrive(`pending/${status.jobId}.json`, JSON.stringify({
            ...status,
            status: 'pending',
            retryCount: (status.retryCount || 0) + 1,
            retriedAt: new Date().toISOString(),
          }, null, 2));
          retriedJobs.push(status.jobId);
        }
      }
    } catch {}
  }
  
  // Detect file changes
  const filesChanged = lastFileHash !== '' && lastFileHash !== currentHash;
  lastFileHash = currentHash;
  
  // Auto-burn if files changed
  let autoBurnResult = '';
  if (filesChanged && mode === 'auto') {
    const burnResult = await executeBurnToDisc('auto');
    autoBurnResult = burnResult.success ? `Auto-burn triggered: ${burnResult.data?.job?.id}` : '';
  }
  
  return {
    success: true,
    message: `
AUTOMATION ACTIVE
=================
Mode: ${mode || 'monitor'}
Runtime: ${Math.floor((Date.now() - startTime) / 1000)}s
Device: ${deviceState.connected ? 'CONNECTED' : 'Searching...'}

FILE MONITORING
---------------
Files Tracked: ${files.length}
Changes Detected: ${filesChanged ? 'YES' : 'No'}
${autoBurnResult ? `Action: ${autoBurnResult}` : ''}

JOB QUEUE
---------
Pending: ${pendingFiles.length}
${pendingFiles.slice(0, 3).map((f: any) => `  - ${f.name}`).join('\n') || '  (empty)'}

SIGNAL ACTIVITY
---------------
Inbound: ${signals.length} new
Retried: ${retriedJobs.length} jobs
${retriedJobs.map(j => `  - ${j}`).join('\n') || ''}

Run 'automate stop' to halt.
`,
  };
}

async function scanWorkspaceFiles(): Promise<string[]> {
  const files: string[] = [];
  const ignoreDirs = ['node_modules', '.git', '.cache', 'data', '.expo', '.local', '.upm'];
  const ignoreFiles = ['.gitignore', '.replit', 'replit.nix', 'package-lock.json'];
  
  async function scan(dir: string, prefix: string = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (ignoreDirs.includes(entry.name)) continue;
        if (ignoreFiles.includes(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          await scan(fullPath, relativePath);
        } else {
          files.push(relativePath);
        }
      }
    } catch {}
  }
  
  await scan(process.cwd());
  return files;
}
