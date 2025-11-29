import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

interface SavedCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  createdAt: string;
  useCount: number;
}

interface HistoryEntry {
  id: string;
  input: string;
  result: string;
  success: boolean;
  timestamp: string;
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

export async function getSavedCommands(): Promise<SavedCommand[]> {
  return readJsonFile(COMMANDS_FILE, getDefaultCommands());
}

export async function saveCommand(command: Omit<SavedCommand, 'id' | 'createdAt' | 'useCount'>): Promise<SavedCommand> {
  const commands = await getSavedCommands();
  const newCommand: SavedCommand = {
    ...command,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    useCount: 0
  };
  commands.push(newCommand);
  await writeJsonFile(COMMANDS_FILE, commands);
  return newCommand;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return readJsonFile(HISTORY_FILE, []);
}

export async function addToHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
  const history = await getHistory();
  history.push({
    ...entry,
    id: Date.now().toString(),
    timestamp: new Date().toISOString()
  });
  const trimmed = history.slice(-100);
  await writeJsonFile(HISTORY_FILE, trimmed);
}

export async function clearHistory() {
  await writeJsonFile(HISTORY_FILE, []);
}

function getDefaultCommands(): SavedCommand[] {
  return [
    {
      id: 'default_1',
      name: 'Burn All Projects',
      command: 'burn to disc all projects',
      description: 'Package all project files and upload to OneDrive',
      createdAt: new Date().toISOString(),
      useCount: 0
    },
    {
      id: 'default_2',
      name: 'Full Backup',
      command: 'backup everything to OneDrive',
      description: 'Backup all files to cloud storage',
      createdAt: new Date().toISOString(),
      useCount: 0
    },
    {
      id: 'default_3',
      name: 'Check Status',
      command: 'status',
      description: 'Check device and connection status',
      createdAt: new Date().toISOString(),
      useCount: 0
    }
  ];
}
