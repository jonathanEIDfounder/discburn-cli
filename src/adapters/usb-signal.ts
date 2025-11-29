/**
 * USB Signal Adapter
 * Direct bidirectional communication through USB circuit
 * Phone <-> Anker Hub <-> HP DVD557s
 */

interface SignalPacket {
  type: 'command' | 'status' | 'ack' | 'data';
  direction: 'outbound' | 'inbound';
  timestamp: number;
  payload: any;
  checksum: string;
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
      
      if (newSignals.length > 0) {
        responseBuffer.push(...newSignals);
        state.lastSignal = Math.max(...newSignals.map((s: SignalPacket) => s.timestamp));
      }
      
      return newSignals;
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
