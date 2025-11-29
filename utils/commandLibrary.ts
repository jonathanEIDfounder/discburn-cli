import AsyncStorage from "@react-native-async-storage/async-storage";

const COMMAND_LIBRARY_KEY = "@discburn/command_library";
const COMMAND_HISTORY_KEY = "@discburn/command_history";

export interface SavedCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}

export interface CommandHistoryEntry {
  id: string;
  input: string;
  result: string;
  success: boolean;
  timestamp: string;
}

export const commandLibrary = {
  async getSavedCommands(): Promise<SavedCommand[]> {
    try {
      const data = await AsyncStorage.getItem(COMMAND_LIBRARY_KEY);
      return data ? JSON.parse(data) : getDefaultCommands();
    } catch (error) {
      return getDefaultCommands();
    }
  },

  async saveCommand(command: Omit<SavedCommand, "id" | "createdAt" | "useCount">): Promise<SavedCommand> {
    const commands = await this.getSavedCommands();
    const newCommand: SavedCommand = {
      ...command,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      useCount: 0,
    };
    commands.push(newCommand);
    await AsyncStorage.setItem(COMMAND_LIBRARY_KEY, JSON.stringify(commands));
    return newCommand;
  },

  async deleteCommand(id: string): Promise<void> {
    const commands = await this.getSavedCommands();
    const filtered = commands.filter((c) => c.id !== id);
    await AsyncStorage.setItem(COMMAND_LIBRARY_KEY, JSON.stringify(filtered));
  },

  async incrementUseCount(id: string): Promise<void> {
    const commands = await this.getSavedCommands();
    const command = commands.find((c) => c.id === id);
    if (command) {
      command.useCount++;
      command.lastUsed = new Date().toISOString();
      await AsyncStorage.setItem(COMMAND_LIBRARY_KEY, JSON.stringify(commands));
    }
  },

  async getCommandHistory(): Promise<CommandHistoryEntry[]> {
    try {
      const data = await AsyncStorage.getItem(COMMAND_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      return [];
    }
  },

  async addToHistory(entry: Omit<CommandHistoryEntry, "id" | "timestamp">): Promise<void> {
    const history = await this.getCommandHistory();
    history.push({
      ...entry,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    });
    const trimmed = history.slice(-100);
    await AsyncStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(trimmed));
  },

  async clearHistory(): Promise<void> {
    await AsyncStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify([]));
  },
};

function getDefaultCommands(): SavedCommand[] {
  return [
    {
      id: "default_1",
      name: "Burn All Projects",
      command: "burn to disc all projects",
      description: "Prepare all project files for disc burning and upload to OneDrive",
      createdAt: new Date().toISOString(),
      useCount: 0,
    },
    {
      id: "default_2",
      name: "Backup Everything",
      command: "backup all files to OneDrive",
      description: "Backup all files to cloud storage",
      createdAt: new Date().toISOString(),
      useCount: 0,
    },
    {
      id: "default_3",
      name: "Check Status",
      command: "status",
      description: "Check device and connection status",
      createdAt: new Date().toISOString(),
      useCount: 0,
    },
    {
      id: "default_4",
      name: "Sync with Cloud",
      command: "sync",
      description: "Synchronize files with OneDrive",
      createdAt: new Date().toISOString(),
      useCount: 0,
    },
  ];
}
