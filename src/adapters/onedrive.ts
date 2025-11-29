import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
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
    throw new Error('OneDrive authentication not available');
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

async function getClient() {
  const accessToken = await getAccessToken();
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export async function uploadToOneDrive(fileName: string, content: Buffer | string): Promise<string> {
  const client = await getClient();
  const path = `/me/drive/root:/DiscBurn/${fileName}:/content`;
  
  await client.api(path).put(content);
  return `Uploaded to OneDrive: DiscBurn/${fileName}`;
}

export async function listOneDriveFiles(folderPath: string = '/DiscBurn'): Promise<any[]> {
  try {
    const client = await getClient();
    const response = await client.api(`/me/drive/root:${folderPath}:/children`).get();
    return response.value || [];
  } catch (error: any) {
    if (error.statusCode === 404) {
      return [];
    }
    throw error;
  }
}

export async function checkOneDriveConnection(): Promise<boolean> {
  try {
    const client = await getClient();
    await client.api('/me').get();
    return true;
  } catch {
    return false;
  }
}

export async function readFromOneDrive(fileName: string): Promise<string | null> {
  try {
    const client = await getClient();
    const response = await client.api(`/me/drive/root:/DiscBurn/${fileName}:/content`).get();
    return typeof response === 'string' ? response : JSON.stringify(response);
  } catch {
    return null;
  }
}

export async function deleteFromOneDrive(fileName: string): Promise<boolean> {
  try {
    const client = await getClient();
    await client.api(`/me/drive/root:/DiscBurn/${fileName}`).delete();
    return true;
  } catch {
    return false;
  }
}
