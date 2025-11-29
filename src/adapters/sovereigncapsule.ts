export interface SovereignCapsuleConfig {
  endpoint?: string;
  apiKey?: string;
  enabled: boolean;
}

let config: SovereignCapsuleConfig = {
  enabled: false,
};

export function configureSovereignCapsule(newConfig: Partial<SovereignCapsuleConfig>) {
  config = { ...config, ...newConfig };
}

export async function uploadToSovereignCapsule(fileName: string, content: Buffer | string): Promise<string> {
  if (!config.enabled) {
    return 'SovereignCapsule: Pending configuration';
  }
  
  if (!config.endpoint || !config.apiKey) {
    return 'SovereignCapsule: Missing endpoint or API key';
  }
  
  try {
    const response = await fetch(`${config.endpoint}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/octet-stream',
        'X-Filename': fileName,
      },
      body: content,
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    return `Uploaded to SovereignCapsule: ${fileName}`;
  } catch (error: any) {
    throw new Error(`SovereignCapsule upload failed: ${error.message}`);
  }
}

export async function checkSovereignCapsuleConnection(): Promise<boolean> {
  if (!config.enabled || !config.endpoint) {
    return false;
  }
  
  try {
    const response = await fetch(`${config.endpoint}/health`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listSovereignCapsuleFiles(folder: string = '/DiscBurn'): Promise<any[]> {
  if (!config.enabled || !config.endpoint) {
    return [];
  }
  
  try {
    const response = await fetch(`${config.endpoint}/list?folder=${encodeURIComponent(folder)}`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.files || [];
  } catch {
    return [];
  }
}

export function getSovereignCapsuleStatus(): { enabled: boolean; configured: boolean } {
  return {
    enabled: config.enabled,
    configured: !!(config.endpoint && config.apiKey),
  };
}
