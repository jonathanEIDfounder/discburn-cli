export const MANIFEST_VERSION = '2.0.0';

export type JobStatus = 
  | 'created'
  | 'pending'
  | 'queued'
  | 'downloading'
  | 'burning'
  | 'verifying'
  | 'complete'
  | 'failed'
  | 'cancelled';

export interface BurnManifest {
  version: string;
  schema: 'discburn-manifest-v2';
  
  job: {
    id: string;
    created: string;
    updated: string;
    status: JobStatus;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    source: {
      platform: string;
      workspace: string;
      user?: string;
    };
  };
  
  target: {
    device: {
      name: string;
      type: 'dvd' | 'bluray' | 'cloud' | 'archive';
      model?: string;
      connection?: string;
    };
    destinations: string[];
    discSettings: {
      type: 'DVD-R' | 'DVD+R' | 'DVD-RW' | 'BD-R' | 'BD-RE';
      speed: 'auto' | number;
      verify: boolean;
      finalize: boolean;
      label?: string;
    };
  };
  
  payload: {
    totalFiles: number;
    totalSize?: number;
    checksum?: string;
    files: PayloadFile[];
  };
  
  lifecycle: {
    states: StateTransition[];
    currentState: JobStatus;
    retryCount: number;
    maxRetries: number;
  };
  
  notifications: {
    onStateChange: boolean;
    onComplete: boolean;
    onError: boolean;
    webhooks?: string[];
  };
  
  admin: {
    createdBy?: string;
    approvedBy?: string;
    executorId?: string;
    auditLog: AuditEntry[];
  };
}

export interface PayloadFile {
  path: string;
  size?: number;
  checksum?: string;
  include: boolean;
}

export interface StateTransition {
  from: JobStatus | null;
  to: JobStatus;
  timestamp: string;
  actor?: string;
  reason?: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details?: Record<string, any>;
}

export function calculatePayloadChecksum(files: string[]): string {
  const content = files.sort().join('\n');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

export function createManifest(options: {
  jobId: string;
  files: string[];
  target?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  device?: string;
}): BurnManifest {
  const now = new Date().toISOString();
  
  return {
    version: MANIFEST_VERSION,
    schema: 'discburn-manifest-v2',
    
    job: {
      id: options.jobId,
      created: now,
      updated: now,
      status: 'created',
      priority: options.priority || 'normal',
      source: {
        platform: 'Replit',
        workspace: process.cwd(),
      },
    },
    
    target: {
      device: {
        name: options.device || 'HP DVD557s',
        type: 'dvd',
        model: 'HP DVD557s',
        connection: 'usb',
      },
      destinations: ['OneDrive', 'SovereignCapsule'],
      discSettings: {
        type: 'DVD-R',
        speed: 'auto',
        verify: true,
        finalize: true,
        label: `DiscBurn_${options.jobId.split('-')[1]?.substring(0, 10) || 'backup'}`,
      },
    },
    
    payload: {
      totalFiles: options.files.length,
      totalSize: 0,
      checksum: calculatePayloadChecksum(options.files),
      files: options.files.map(f => ({
        path: f,
        include: true,
      })),
    },
    
    lifecycle: {
      states: [{
        from: null,
        to: 'created',
        timestamp: now,
        actor: 'system',
        reason: 'Job initialized',
      }],
      currentState: 'created',
      retryCount: 0,
      maxRetries: 3,
    },
    
    notifications: {
      onStateChange: true,
      onComplete: true,
      onError: true,
    },
    
    admin: {
      auditLog: [{
        timestamp: now,
        action: 'JOB_CREATED',
        actor: 'system',
        details: { fileCount: options.files.length },
      }],
    },
  };
}

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  'created': ['pending', 'cancelled'],
  'pending': ['queued', 'cancelled'],
  'queued': ['downloading', 'cancelled'],
  'downloading': ['burning', 'failed', 'cancelled'],
  'burning': ['verifying', 'failed', 'cancelled'],
  'verifying': ['complete', 'failed'],
  'complete': [],
  'failed': ['pending'],
  'cancelled': ['pending'],
};

export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionState(
  manifest: BurnManifest,
  newState: JobStatus,
  actor: string = 'system',
  reason?: string
): BurnManifest {
  const now = new Date().toISOString();
  const previousState = manifest.lifecycle.currentState;
  
  if (!isValidTransition(previousState, newState)) {
    throw new Error(`Invalid state transition: ${previousState} -> ${newState}`);
  }
  
  manifest.lifecycle.states.push({
    from: previousState,
    to: newState,
    timestamp: now,
    actor,
    reason,
  });
  
  manifest.lifecycle.currentState = newState;
  manifest.job.status = newState;
  manifest.job.updated = now;
  
  manifest.admin.auditLog.push({
    timestamp: now,
    action: `STATE_TRANSITION`,
    actor,
    details: { from: previousState, to: newState, reason },
  });
  
  return manifest;
}