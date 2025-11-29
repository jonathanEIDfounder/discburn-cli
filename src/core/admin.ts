import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ADMIN_LOG_FILE = path.join(DATA_DIR, 'audit.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'command_registry.json');

export interface AuditLog {
  entries: AuditEntry[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'admin';
  category: string;
  action: string;
  actor: string;
  target?: string;
  details?: Record<string, any>;
  result: 'success' | 'failure';
}

export interface PlatformConfig {
  version: string;
  platform: {
    name: string;
    mode: 'development' | 'production';
  };
  devices: DeviceConfig[];
  destinations: DestinationConfig[];
  policies: PolicyConfig;
  features: FeatureFlags;
}

export interface DeviceConfig {
  id: string;
  name: string;
  type: 'dvd' | 'bluray' | 'cloud';
  enabled: boolean;
  connection: string;
  capabilities: string[];
}

export interface DestinationConfig {
  id: string;
  name: string;
  type: 'onedrive' | 'sovereigncapsule' | 'local';
  enabled: boolean;
  priority: number;
  settings: Record<string, any>;
}

export interface PolicyConfig {
  maxJobsPerDay: number;
  maxFilesPerJob: number;
  maxJobSizeMB: number;
  requireApproval: boolean;
  retentionDays: number;
}

export interface FeatureFlags {
  naturalLanguage: boolean;
  dualWrite: boolean;
  autoRetry: boolean;
  notifications: boolean;
  adminMode: boolean;
}

export interface CommandRegistryEntry {
  id: string;
  name: string;
  command: string;
  intent: string;
  description: string;
  category: 'burn' | 'backup' | 'system' | 'admin';
  enabled: boolean;
  createdAt: string;
  usageCount: number;
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile(filePath: string, data: any) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  const log = await readJsonFile<AuditLog>(ADMIN_LOG_FILE, { entries: [] });
  
  log.entries.push({
    ...entry,
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
  });
  
  const trimmed = { entries: log.entries.slice(-500) };
  await writeJsonFile(ADMIN_LOG_FILE, trimmed);
}

export async function getAuditLog(limit: number = 50): Promise<AuditEntry[]> {
  const log = await readJsonFile<AuditLog>(ADMIN_LOG_FILE, { entries: [] });
  return log.entries.slice(-limit);
}

export async function getConfig(): Promise<PlatformConfig> {
  return readJsonFile<PlatformConfig>(CONFIG_FILE, getDefaultConfig());
}

export async function updateConfig(updates: Partial<PlatformConfig>): Promise<PlatformConfig> {
  const config = await getConfig();
  const updated = { ...config, ...updates };
  await writeJsonFile(CONFIG_FILE, updated);
  
  await logAudit({
    level: 'admin',
    category: 'config',
    action: 'CONFIG_UPDATED',
    actor: 'admin',
    details: { updates },
    result: 'success',
  });
  
  return updated;
}

export async function getCommandRegistry(): Promise<CommandRegistryEntry[]> {
  return readJsonFile<CommandRegistryEntry[]>(REGISTRY_FILE, getDefaultRegistry());
}

export async function registerCommand(entry: Omit<CommandRegistryEntry, 'id' | 'createdAt' | 'usageCount'>): Promise<CommandRegistryEntry> {
  const registry = await getCommandRegistry();
  
  const newEntry: CommandRegistryEntry = {
    ...entry,
    id: `cmd-${Date.now()}`,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  };
  
  registry.push(newEntry);
  await writeJsonFile(REGISTRY_FILE, registry);
  
  await logAudit({
    level: 'admin',
    category: 'registry',
    action: 'COMMAND_REGISTERED',
    actor: 'admin',
    target: newEntry.name,
    result: 'success',
  });
  
  return newEntry;
}

function getDefaultConfig(): PlatformConfig {
  return {
    version: '2.0.0',
    platform: {
      name: 'DiscBurn Administrative Platform',
      mode: 'development',
    },
    devices: [
      {
        id: 'dev-hp-dvd557s',
        name: 'HP DVD557s',
        type: 'dvd',
        enabled: true,
        connection: 'usb',
        capabilities: ['dvd-r', 'dvd+r', 'dvd-rw', 'cd-r', 'cd-rw'],
      },
    ],
    destinations: [
      {
        id: 'dest-onedrive',
        name: 'OneDrive',
        type: 'onedrive',
        enabled: true,
        priority: 1,
        settings: { folder: '/DiscBurn' },
      },
      {
        id: 'dest-sovereign',
        name: 'SovereignCapsule',
        type: 'sovereigncapsule',
        enabled: false,
        priority: 2,
        settings: {},
      },
    ],
    policies: {
      maxJobsPerDay: 100,
      maxFilesPerJob: 10000,
      maxJobSizeMB: 4700,
      requireApproval: false,
      retentionDays: 30,
    },
    features: {
      naturalLanguage: true,
      dualWrite: true,
      autoRetry: true,
      notifications: true,
      adminMode: true,
    },
  };
}

function getDefaultRegistry(): CommandRegistryEntry[] {
  return [
    {
      id: 'cmd-burn',
      name: 'Burn to Disc',
      command: 'burn',
      intent: 'burn_to_disc',
      description: 'Package files and send burn command to HP DVD557s',
      category: 'burn',
      enabled: true,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    },
    {
      id: 'cmd-backup',
      name: 'Backup',
      command: 'backup',
      intent: 'backup',
      description: 'Backup files to cloud storage',
      category: 'backup',
      enabled: true,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    },
    {
      id: 'cmd-sync',
      name: 'Sync',
      command: 'sync',
      intent: 'sync',
      description: 'Synchronize with cloud destinations',
      category: 'system',
      enabled: true,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    },
    {
      id: 'cmd-status',
      name: 'Status',
      command: 'status',
      intent: 'status',
      description: 'Check platform and device status',
      category: 'system',
      enabled: true,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    },
    {
      id: 'cmd-admin',
      name: 'Admin',
      command: 'admin',
      intent: 'admin',
      description: 'Access administrative functions',
      category: 'admin',
      enabled: true,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    },
  ];
}
