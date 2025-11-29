import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Replit token not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=onedrive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('OneDrive not connected');
  }
  return accessToken;
}

export async function getOneDriveClient(): Promise<Client> {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export async function uploadToOneDrive(fileName: string, content: string | Buffer): Promise<{ success: boolean; path: string; error?: string }> {
  try {
    const client = await getOneDriveClient();
    const path = `/DiscBurn/${fileName}`;
    
    await client.api(`/me/drive/root:${path}:/content`)
      .put(content);
    
    return { success: true, path };
  } catch (error: any) {
    return { success: false, path: '', error: error.message };
  }
}

export async function listOneDriveFiles(folderPath: string = '/DiscBurn'): Promise<any[]> {
  try {
    const client = await getOneDriveClient();
    const result = await client.api(`/me/drive/root:${folderPath}:/children`).get();
    return result.value || [];
  } catch (error) {
    return [];
  }
}

export async function createOneDriveFolder(folderName: string): Promise<boolean> {
  try {
    const client = await getOneDriveClient();
    await client.api('/me/drive/root/children').post({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'replace'
    });
    return true;
  } catch (error) {
    return false;
  }
}
