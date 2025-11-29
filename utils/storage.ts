import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  BURN_QUEUE: "@discburn/burn_queue",
  SETTINGS: "@discburn/settings",
  USER_PROFILE: "@discburn/user_profile",
};

export interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  size: number;
  modifiedDate: string;
  path: string;
}

export interface QueueItem extends FileItem {
  addedAt: string;
  status: "pending" | "burning" | "completed" | "error";
}

export interface UserSettings {
  burnSpeed: "4x" | "6x" | "8x";
  autoSync: boolean;
  syncFrequency: "hourly" | "daily" | "weekly";
  notificationsEnabled: boolean;
}

export interface UserProfile {
  displayName: string;
  avatarType: "disc" | "file" | "cloud";
}

const defaultSettings: UserSettings = {
  burnSpeed: "8x",
  autoSync: false,
  syncFrequency: "daily",
  notificationsEnabled: true,
};

const defaultProfile: UserProfile = {
  displayName: "User",
  avatarType: "disc",
};

export const storage = {
  async getBurnQueue(): Promise<QueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BURN_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error reading burn queue:", error);
      return [];
    }
  },

  async saveBurnQueue(queue: QueueItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BURN_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error("Error saving burn queue:", error);
    }
  },

  async addToQueue(item: FileItem): Promise<QueueItem[]> {
    const queue = await this.getBurnQueue();
    const queueItem: QueueItem = {
      ...item,
      addedAt: new Date().toISOString(),
      status: "pending",
    };
    const newQueue = [...queue, queueItem];
    await this.saveBurnQueue(newQueue);
    return newQueue;
  },

  async removeFromQueue(id: string): Promise<QueueItem[]> {
    const queue = await this.getBurnQueue();
    const newQueue = queue.filter((item) => item.id !== id);
    await this.saveBurnQueue(newQueue);
    return newQueue;
  },

  async clearQueue(): Promise<void> {
    await this.saveBurnQueue([]);
  },

  async getSettings(): Promise<UserSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch (error) {
      console.error("Error reading settings:", error);
      return defaultSettings;
    }
  },

  async saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error("Error saving settings:", error);
      return defaultSettings;
    }
  },

  async getProfile(): Promise<UserProfile> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? { ...defaultProfile, ...JSON.parse(data) } : defaultProfile;
    } catch (error) {
      console.error("Error reading profile:", error);
      return defaultProfile;
    }
  },

  async saveProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const current = await this.getProfile();
      const updated = { ...current, ...profile };
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error("Error saving profile:", error);
      return defaultProfile;
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  },
};

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
