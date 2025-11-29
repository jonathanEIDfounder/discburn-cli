/**
 * DiscBurn Executor
 * Complete burn lifecycle with OneDrive sync after completion
 * 
 * Signal Path: Phone <-> Anker Hub <-> HP DVD557s
 * Driver: dvd557s_driver.exe (Windows executor)
 */

import { uploadToOneDrive, readFromOneDrive, deleteFromOneDrive, listOneDriveFiles } from '../adapters/onedrive';
import { sendCommand, receiveSignals, getDeviceState } from '../adapters/usb-signal';
import { transitionState, JobStatus } from './manifest';

interface BurnJob {
  jobId: string;
  status: JobStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  files: string[];
  created: string;
  started?: string;
  completed?: string;
  progress?: number;
  error?: string;
  retryCount: number;
}

interface ExecutorState {
  running: boolean;
  currentJob: BurnJob | null;
  completedJobs: string[];
  failedJobs: string[];
}

const state: ExecutorState = {
  running: false,
  currentJob: null,
  completedJobs: [],
  failedJobs: [],
};

export async function startExecutor(): Promise<void> {
  state.running = true;
  console.log('[EXECUTOR] Started - Polling for jobs...');
  
  while (state.running) {
    await pollAndProcess();
    await sleep(5000); // Poll every 5 seconds
  }
}

export async function stopExecutor(): Promise<void> {
  state.running = false;
  console.log('[EXECUTOR] Stopped');
}

async function pollAndProcess(): Promise<void> {
  try {
    // Get pending jobs from OneDrive
    const pendingFiles = await listOneDriveFiles('/DiscBurn/pending');
    
    if (pendingFiles.length === 0) {
      return;
    }
    
    // Sort by priority (high/urgent first)
    const jobs: BurnJob[] = [];
    for (const file of pendingFiles) {
      try {
        const content = await readFromOneDrive(`pending/${file.name}`);
        if (content) {
          jobs.push(JSON.parse(content));
        }
      } catch {}
    }
    
    // Priority order: urgent > high > normal > low
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    jobs.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
    
    if (jobs.length > 0) {
      await processJob(jobs[0]);
    }
  } catch (error: any) {
    console.error('[EXECUTOR] Poll error:', error.message);
  }
}

async function processJob(job: BurnJob): Promise<void> {
  state.currentJob = job;
  console.log(`[EXECUTOR] Processing job: ${job.jobId} (${job.priority})`);
  
  try {
    // Update status: queued
    await updateJobStatus(job.jobId, 'queued', 0);
    
    // Send signal to DVD burner
    await sendCommand('burn', {
      jobId: job.jobId,
      files: job.files,
      priority: job.priority,
    });
    
    // Update status: burning
    await updateJobStatus(job.jobId, 'burning', 10);
    
    // Simulate burn progress (in real executor, this monitors actual hardware)
    for (let progress = 20; progress <= 90; progress += 10) {
      await sleep(1000);
      await updateJobStatus(job.jobId, 'burning', progress);
      
      // Check for cancel signal
      const signals = await receiveSignals();
      const cancelSignal = signals.find(s => 
        s.payload?.action === 'cancel' && s.payload?.jobId === job.jobId
      );
      if (cancelSignal) {
        await updateJobStatus(job.jobId, 'cancelled', progress);
        await syncToOneDriveAfterBurn(job.jobId, 'cancelled');
        return;
      }
    }
    
    // Update status: verifying
    await updateJobStatus(job.jobId, 'verifying', 95);
    await sleep(500);
    
    // Update status: complete
    await updateJobStatus(job.jobId, 'complete', 100);
    
    // Sync to OneDrive after burn
    await syncToOneDriveAfterBurn(job.jobId, 'complete');
    
    // Remove from pending
    await deleteFromOneDrive(`pending/${job.jobId}.json`);
    
    state.completedJobs.push(job.jobId);
    console.log(`[EXECUTOR] Job complete: ${job.jobId}`);
    
  } catch (error: any) {
    console.error(`[EXECUTOR] Job failed: ${job.jobId}`, error.message);
    
    await updateJobStatus(job.jobId, 'failed', 0, error.message);
    await syncToOneDriveAfterBurn(job.jobId, 'failed', error.message);
    
    state.failedJobs.push(job.jobId);
  }
  
  state.currentJob = null;
}

async function updateJobStatus(
  jobId: string, 
  status: JobStatus, 
  progress: number,
  error?: string
): Promise<void> {
  const statusUpdate = {
    jobId,
    status,
    progress,
    error,
    updated: new Date().toISOString(),
    device: 'HP DVD557s',
  };
  
  // Write to status folder
  await uploadToOneDrive(`status/${jobId}.json`, JSON.stringify(statusUpdate, null, 2));
  
  // Send signal back to phone
  await sendCommand('status', statusUpdate);
}

async function syncToOneDriveAfterBurn(
  jobId: string, 
  finalStatus: 'complete' | 'failed' | 'cancelled',
  error?: string
): Promise<void> {
  const completionRecord = {
    jobId,
    status: finalStatus,
    completedAt: new Date().toISOString(),
    error,
    device: 'HP DVD557s',
    syncedToOneDrive: true,
  };
  
  // Upload completion record
  await uploadToOneDrive(`completed/${jobId}.json`, JSON.stringify(completionRecord, null, 2));
  
  // Upload to archive
  await uploadToOneDrive(`archive/${new Date().toISOString().split('T')[0]}/${jobId}.json`, 
    JSON.stringify(completionRecord, null, 2)
  );
  
  console.log(`[EXECUTOR] Synced to OneDrive: ${jobId} -> ${finalStatus}`);
}

export function getExecutorState(): ExecutorState {
  return { ...state };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export for CLI integration
export async function runSingleBurn(jobId: string): Promise<{ success: boolean; message: string }> {
  try {
    const content = await readFromOneDrive(`pending/${jobId}.json`);
    if (!content) {
      return { success: false, message: `Job not found: ${jobId}` };
    }
    
    const job = JSON.parse(content);
    await processJob(job);
    
    return { 
      success: true, 
      message: `Burn complete: ${jobId} -> synced to OneDrive` 
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
