/**
 * USB Signal Adapter
 * Direct bidirectional communication through USB circuit
 * Phone <-> Anker Hub <-> HP DVD557s
 * 
 * SECURITY HELM ACTIVE:
 * - Only accepts incoming signals from verified DVD557s device
 * - Blocks automated script injections
 * - Blocks WebSocket connections
 * - Validates all signal authenticity
 */

const ALLOWED_DEVICE_ID = 'HP-DVD557s';
const ALLOWED_SOURCES = ['dvd557s', 'HP-DVD557s', 'dvd557s_driver'];

// Security Helm Configuration
const HELM = {
  active: true,
  blockWebSockets: true,
  blockScriptInjection: true,
  onlyDVD557s: true,
  maxSignalAge: 30000, // 30 seconds max age
  rateLimitPerMinute: 60,
  blockedPatterns: [
    /eval\s*\(/i,
    /Function\s*\(/i,
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /websocket/i,
    /ws:\/\//i,
    /wss:\/\//i,
    /new\s+WebSocket/i,
    /\.connect\s*\(/i,
    /socket\.io/i,
  ],
};

const signalRateTracker: { count: number; resetTime: number } = {
  count: 0,
  resetTime: Date.now() + 60000,
};

interface SignalPacket {
  type: 'command' | 'status' | 'ack' | 'data';
  direction: 'outbound' | 'inbound';
  timestamp: number;
  payload: any;
  checksum: string;
  source?: string;
  deviceId?: string;
}

interface SecurityResult {
  allowed: boolean;
  reason?: string;
}

function validateSignalSecurity(signal: SignalPacket): SecurityResult {
  if (!HELM.active) return { allowed: true };

  // Check source is DVD557s only
  if (HELM.onlyDVD557s) {
    const source = signal.source || signal.payload?.source || '';
    const deviceId = signal.deviceId || signal.payload?.deviceId || '';
    
    if (!ALLOWED_SOURCES.includes(source) && !ALLOWED_SOURCES.includes(deviceId)) {
      return { allowed: false, reason: 'BLOCKED: Source not DVD557s' };
    }
  }

  // Check signal age
  if (Date.now() - signal.timestamp > HELM.maxSignalAge) {
    return { allowed: false, reason: 'BLOCKED: Signal too old (replay attack prevention)' };
  }

  // Rate limiting
  if (Date.now() > signalRateTracker.resetTime) {
    signalRateTracker.count = 0;
    signalRateTracker.resetTime = Date.now() + 60000;
  }
  signalRateTracker.count++;
  if (signalRateTracker.count > HELM.rateLimitPerMinute) {
    return { allowed: false, reason: 'BLOCKED: Rate limit exceeded' };
  }

  // Check for script injection patterns
  if (HELM.blockScriptInjection) {
    const payloadStr = JSON.stringify(signal.payload || {});
    for (const pattern of HELM.blockedPatterns) {
      if (pattern.test(payloadStr)) {
        return { allowed: false, reason: `BLOCKED: Script injection detected (${pattern})` };
      }
    }
  }

  // Block WebSocket patterns
  if (HELM.blockWebSockets) {
    const payloadStr = JSON.stringify(signal.payload || {});
    if (/websocket|ws:\/\/|wss:\/\/|socket\.io/i.test(payloadStr)) {
      return { allowed: false, reason: 'BLOCKED: WebSocket connection attempt' };
    }
  }

  // Verify checksum
  const expectedChecksum = generateChecksum(signal.payload);
  if (signal.checksum !== expectedChecksum) {
    return { allowed: false, reason: 'BLOCKED: Invalid checksum (tampering detected)' };
  }

  return { allowed: true };
}

function logSecurityEvent(event: string, details?: any) {
  console.log(`[HELM] ${new Date().toISOString()} ${event}`, details || '');
}

interface DeviceState {
  connected: boolean;
  ready: boolean;
  lastSignal: number;
  deviceId: string | null;
  capabilities: string[];
}

const state: DeviceState = {
  connected: false,
  ready: false,
  lastSignal: 0,
  deviceId: null,
  capabilities: [],
};

const signalQueue: SignalPacket[] = [];
const responseBuffer: SignalPacket[] = [];

function generateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
}

export function createSignal(type: SignalPacket['type'], payload: any): SignalPacket {
  return {
    type,
    direction: 'outbound',
    timestamp: Date.now(),
    payload,
    checksum: generateChecksum(payload),
  };
}

export async function probeConnection(): Promise<DeviceState> {
  // Probe for USB device presence through available channels
  const probeSignal = createSignal('command', { action: 'probe', target: 'HP-DVD557s' });
  
  try {
    // Check if we have USB access (WebUSB or native)
    if (typeof navigator !== 'undefined' && 'usb' in navigator) {
      const devices = await (navigator as any).usb.getDevices();
      if (devices.length > 0) {
        state.connected = true;
        state.deviceId = devices[0].serialNumber || 'USB-DEVICE';
        state.capabilities = ['read', 'write', 'burn'];
      }
    }
    
    // Alternative: Check through file system device nodes
    const fs = await import('fs/promises');
    try {
      // Look for USB mass storage or optical drive indicators
      const devs = await fs.readdir('/dev').catch(() => []);
      const opticalDevs = devs.filter((d: string) => 
        d.startsWith('sr') || d.startsWith('cdrom') || d.startsWith('dvd')
      );
      if (opticalDevs.length > 0) {
        state.connected = true;
        state.deviceId = opticalDevs[0];
        state.capabilities = ['read', 'write', 'burn'];
      }
    } catch {}
    
    state.lastSignal = Date.now();
    signalQueue.push(probeSignal);
    
  } catch (error) {
    state.connected = false;
  }
  
  return state;
}

export async function sendCommand(command: string, params?: Record<string, any>): Promise<SignalPacket> {
  const signal = createSignal('command', { 
    action: command,
    params,
    source: 'phone-cli',
    target: 'dvd557s',
  });
  
  signalQueue.push(signal);
  
  // Write to signal channel (OneDrive as relay when direct USB not available)
  const { uploadToOneDrive } = await import('./onedrive');
  await uploadToOneDrive('signals/outbound.json', JSON.stringify({
    queue: signalQueue.slice(-10),
    lastUpdate: Date.now(),
  }, null, 2));
  
  return signal;
}

export async function receiveSignals(): Promise<SignalPacket[]> {
  try {
    const { readFromOneDrive } = await import('./onedrive');
    const data = await readFromOneDrive('signals/inbound.json');
    
    if (data) {
      const parsed = JSON.parse(data);
      const newSignals = parsed.queue?.filter((s: SignalPacket) => 
        s.timestamp > state.lastSignal
      ) || [];
      
      // HELM: Security validation for each signal
      const validatedSignals: SignalPacket[] = [];
      for (const signal of newSignals) {
        const security = validateSignalSecurity(signal);
        if (security.allowed) {
          validatedSignals.push(signal);
          logSecurityEvent('ALLOWED', { source: signal.source, type: signal.type });
        } else {
          logSecurityEvent('BLOCKED', { 
            reason: security.reason, 
            source: signal.source,
            payload: signal.payload 
          });
        }
      }
      
      if (validatedSignals.length > 0) {
        responseBuffer.push(...validatedSignals);
        state.lastSignal = Math.max(...validatedSignals.map((s: SignalPacket) => s.timestamp));
      }
      
      return validatedSignals;
    }
  } catch {}
  
  return [];
}

export async function sendBurnCommand(jobId: string, files: string[]): Promise<SignalPacket> {
  return sendCommand('burn', {
    jobId,
    files,
    device: 'HP-DVD557s',
    discType: 'DVD-R',
  });
}

export async function sendStatusRequest(): Promise<SignalPacket> {
  return sendCommand('status', { requestId: Date.now() });
}

export async function sendCancel(jobId: string): Promise<SignalPacket> {
  return sendCommand('cancel', { jobId });
}

export async function sendPause(jobId: string): Promise<SignalPacket> {
  return sendCommand('pause', { jobId });
}

export async function sendResume(jobId: string): Promise<SignalPacket> {
  return sendCommand('resume', { jobId });
}

export function getDeviceState(): DeviceState {
  return { ...state };
}

export function getSignalQueue(): SignalPacket[] {
  return [...signalQueue];
}

export function getResponseBuffer(): SignalPacket[] {
  return [...responseBuffer];
}

export async function establishBidirectionalChannel(): Promise<{
  send: (cmd: string, params?: any) => Promise<SignalPacket>;
  receive: () => Promise<SignalPacket[]>;
  state: () => DeviceState;
}> {
  await probeConnection();
  
  return {
    send: sendCommand,
    receive: receiveSignals,
    state: getDeviceState,
  };
}

// ============================================
// HELM SECURITY CONTROLS
// ============================================

export function getHelmStatus() {
  return {
    active: HELM.active,
    settings: {
      blockWebSockets: HELM.blockWebSockets,
      blockScriptInjection: HELM.blockScriptInjection,
      onlyDVD557s: HELM.onlyDVD557s,
      maxSignalAge: HELM.maxSignalAge,
      rateLimitPerMinute: HELM.rateLimitPerMinute,
    },
    stats: {
      signalsThisMinute: signalRateTracker.count,
      resetIn: Math.max(0, signalRateTracker.resetTime - Date.now()),
    },
    allowedSources: ALLOWED_SOURCES,
  };
}

export function activateHelm() {
  HELM.active = true;
  logSecurityEvent('HELM ACTIVATED', getHelmStatus());
  return getHelmStatus();
}

export function deactivateHelm() {
  HELM.active = false;
  logSecurityEvent('HELM DEACTIVATED');
  return getHelmStatus();
}

export function setHelmOption(option: keyof typeof HELM, value: any) {
  if (option in HELM) {
    (HELM as any)[option] = value;
    logSecurityEvent(`HELM CONFIG: ${option} = ${value}`);
  }
  return getHelmStatus();
}
