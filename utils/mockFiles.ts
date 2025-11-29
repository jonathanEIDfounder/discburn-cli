import { FileItem, generateId } from "./storage";

export function generateMockFiles(): FileItem[] {
  const now = new Date();
  
  return [
    {
      id: generateId(),
      name: "Project Files",
      type: "folder",
      size: 256000000,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      path: "/Project Files",
    },
    {
      id: generateId(),
      name: "Documents",
      type: "folder",
      size: 128000000,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      path: "/Documents",
    },
    {
      id: generateId(),
      name: "Backup_2024.zip",
      type: "file",
      size: 524288000,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      path: "/Backup_2024.zip",
    },
    {
      id: generateId(),
      name: "Photos",
      type: "folder",
      size: 1073741824,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
      path: "/Photos",
    },
    {
      id: generateId(),
      name: "presentation.pdf",
      type: "file",
      size: 5242880,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      path: "/presentation.pdf",
    },
    {
      id: generateId(),
      name: "video_archive.mp4",
      type: "file",
      size: 2147483648,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 96).toISOString(),
      path: "/video_archive.mp4",
    },
    {
      id: generateId(),
      name: "Music Collection",
      type: "folder",
      size: 3221225472,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 120).toISOString(),
      path: "/Music Collection",
    },
    {
      id: generateId(),
      name: "spreadsheet.xlsx",
      type: "file",
      size: 1048576,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
      path: "/spreadsheet.xlsx",
    },
    {
      id: generateId(),
      name: "code_backup.tar.gz",
      type: "file",
      size: 104857600,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 168).toISOString(),
      path: "/code_backup.tar.gz",
    },
    {
      id: generateId(),
      name: "Reports",
      type: "folder",
      size: 52428800,
      modifiedDate: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      path: "/Reports",
    },
  ];
}

export const DVD_CAPACITY = 4700000000;
export const CD_CAPACITY = 700000000;
