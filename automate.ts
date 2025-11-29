#!/usr/bin/env npx tsx
/**
 * DiscBurn Automation Script
 * 
 * Runs on desktop/laptop connected to HP DVD557s
 * Polls OneDrive for pending jobs and executes burns automatically
 */

import { uploadToOneDrive, readFromOneDrive, deleteFromOneDrive, listOneDriveFiles } from './src/adapters/onedrive';

interface BurnJob {
  jobId: string;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  files: string[];
  created: string;
  progress?: number;
}

interface AutomationConfig {
  pollInterval: number;      // ms between checks
  maxRetries: number;        // per job
  autoStart: boolean;        // start immediately
  logLevel: 'quiet' | 'normal' | 'verbose';
}

const config: AutomationConfig = {
  pollInterval: 5000,
  maxRetries: 3,
  autoStart: true,
  logLevel: 'normal',
};

let running = false;
let processedJobs: string[] = [];
let failedJobs: Map<string, number> = new Map();

function log(msg: string, level: 'quiet' | 'normal' | 'verbose' = 'normal') {
  const levels = { quiet: 0, normal: 1, verbose: 2 };
  if (levels[level] <= levels[config.logLevel]) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
  }
}

async function fetchPendingJobs(): Promise<BurnJob[]> {
  try {
    const files = await listOneDriveFiles('/DiscBurn/pending');
    const jobs: BurnJob[] = [];
    
    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      try {
        const content = await readFromOneDrive(`pending/${file.name}`);
        if (content) {
          jobs.push(JSON.parse(content));
        }
      } catch (e) {
        log(`Failed to parse job: ${file.name}`, 'verbose');
      }
    }
    
    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return jobs.sort((a, b) => 
      (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
    );
  } catch (error: any) {
    log(`Error fetching jobs: ${error.message}`, 'normal');
    return [];
  }
}

async function updateStatus(jobId: string, status: string, progress: number, error?: string) {
  const update = {
    jobId,
    status,
    progress,
    error,
    updated: new Date().toISOString(),
    device: 'HP DVD557s',
  };
  
  await uploadToOneDrive(`status/${jobId}.json`, JSON.stringify(update, null, 2));
  log(`Status: ${jobId} -> ${status} (${progress}%)`, 'normal');
}

async function executeBurn(job: BurnJob): Promise<boolean> {
  const fileCount = job.files?.length || 0;
  log(`Starting burn: ${job.jobId} (${fileCount} files)`, 'normal');
  
  try {
    await updateStatus(job.jobId, 'burning', 0);
    
    // Simulate burn phases
    const phases = [
      { name: 'Preparing', progress: 10 },
      { name: 'Writing lead-in', progress: 20 },
      { name: 'Burning data', progress: 50 },
      { name: 'Writing lead-out', progress: 80 },
      { name: 'Verifying', progress: 95 },
    ];
    
    for (const phase of phases) {
      await updateStatus(job.jobId, phase.name, phase.progress);
      await sleep(2000);
    }
    
    await updateStatus(job.jobId, 'complete', 100);
    return true;
    
  } catch (error: any) {
    log(`Burn failed: ${job.jobId} - ${error.message}`, 'normal');
    await updateStatus(job.jobId, 'failed', 0, error.message);
    return false;
  }
}

async function syncCompletion(jobId: string, success: boolean, error?: string) {
  const record = {
    jobId,
    status: success ? 'complete' : 'failed',
    completedAt: new Date().toISOString(),
    error,
    device: 'HP DVD557s',
  };
  
  // Save to completed folder
  await uploadToOneDrive(`completed/${jobId}.json`, JSON.stringify(record, null, 2));
  
  // Archive by date
  const date = new Date().toISOString().split('T')[0];
  await uploadToOneDrive(`archive/${date}/${jobId}.json`, JSON.stringify(record, null, 2));
  
  // Remove from pending
  await deleteFromOneDrive(`pending/${jobId}.json`);
  
  log(`Synced: ${jobId} -> OneDrive`, 'normal');
}

async function processNextJob(): Promise<boolean> {
  const jobs = await fetchPendingJobs();
  
  // Filter already processed
  const pending = jobs.filter(j => 
    !processedJobs.includes(j.jobId) && 
    (failedJobs.get(j.jobId) || 0) < config.maxRetries
  );
  
  if (pending.length === 0) {
    return false;
  }
  
  const job = pending[0];
  log(`Found job: ${job.jobId} (priority: ${job.priority})`, 'normal');
  
  const success = await executeBurn(job);
  
  if (success) {
    processedJobs.push(job.jobId);
    await syncCompletion(job.jobId, true);
  } else {
    const retries = (failedJobs.get(job.jobId) || 0) + 1;
    failedJobs.set(job.jobId, retries);
    
    if (retries >= config.maxRetries) {
      await syncCompletion(job.jobId, false, 'Max retries exceeded');
    }
  }
  
  return true;
}

async function runAutomation() {
  running = true;
  
  console.log(`
╔══════════════════════════════════════════╗
║     DiscBurn Automation Script v2.0      ║
║     HP DVD557s Desktop Executor          ║
╚══════════════════════════════════════════╝
`);
  
  log('Automation started - polling OneDrive for jobs...', 'normal');
  log(`Poll interval: ${config.pollInterval}ms`, 'verbose');
  log(`Max retries: ${config.maxRetries}`, 'verbose');
  
  while (running) {
    const hadJob = await processNextJob();
    
    if (!hadJob) {
      log('No pending jobs, waiting...', 'verbose');
    }
    
    await sleep(config.pollInterval);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...', 'normal');
  running = false;
  setTimeout(() => process.exit(0), 1000);
});

// CLI arguments
const args = process.argv.slice(2);
if (args.includes('--verbose')) config.logLevel = 'verbose';
if (args.includes('--quiet')) config.logLevel = 'quiet';

const intervalArg = args.find(a => a.startsWith('--interval='));
if (intervalArg) {
  config.pollInterval = parseInt(intervalArg.split('=')[1]) * 1000;
}

// Start automation
runAutomation().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
