import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const SESSION_FILE = path.join(DATA_DIR, 'session.txt');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let client: TelegramClient | null = null;
let phoneCodeHash: string | null = null;

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

interface LocalConfig {
  session?: string;
  apiId?: number;
  apiHash?: string;
}

function loadConfig(): LocalConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.warn('Failed to load local config:', e);
  }
  return {};
}

function saveConfig(update: Partial<LocalConfig>): void {
  try {
    const current = loadConfig();
    const next = { ...current, ...update };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

function clearConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } catch (e) {
    console.error('Failed to clear config:', e);
  }
}

export function getTelegramClient(): TelegramClient | null {
  return client;
}

export async function initClient(apiIdInput?: number, apiHashInput?: string): Promise<TelegramClient> {
  const conf = loadConfig();
  const apiId = apiIdInput || conf.apiId || parseInt(process.env.TELEGRAM_API_ID || '', 10);
  const apiHash = apiHashInput || conf.apiHash || process.env.TELEGRAM_API_HASH || '';

  if (!apiId || !apiHash) {
    throw new Error('Telegram API ID and API Hash are required. Please configure them on the login page.');
  }

  // Save the successfully parsed dynamic API credentials
  if (apiIdInput && apiHashInput) {
    saveConfig({ apiId, apiHash });
  }

  const session = new StringSession(conf.session || '');

  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    deviceModel: 'Telegram Drive Web',
    systemVersion: 'Web Server 1.0',
    appVersion: '1.0.0',
  });

  await client.connect();
  return client;
}

// QR login structures
let qrLoginSession: any = null;

export async function sendQRToken(apiIdInput?: number, apiHashInput?: string): Promise<{ tokenUrl: string; expires: number }> {
  if (!client) {
    await initClient(apiIdInput, apiHashInput);
  }
  
  // Clean disconnect if already logging in
  qrLoginSession = null;
  
  const qr = await (client as any).signIn({
    phoneNumber: async () => "",
    phoneCode: async () => "",
    password: async () => "",
    qrCode: async (token: any) => {
      qrLoginSession = {
        tokenUrl: `tg://login?token=${token.token.toString("base64url")}`,
        expires: Date.now() + (token.expires * 1000),
        status: "pending",
        user: null,
      };
    },
    onError: (err: any) => {
      if (qrLoginSession) {
        qrLoginSession.status = "error";
        qrLoginSession.error = err.message;
      }
    }
  });

  // Wait a maximum of 3s to let the qrCode callback fire and populate qrLoginSession
  let retries = 30;
  while (!qrLoginSession && retries > 0) {
    await new Promise((r) => setTimeout(r, 100));
    retries--;
  }

  if (!qrLoginSession) {
    throw new Error("Failed to initialize Telegram QR code login session");
  }

  // Monitor login execution in the background asynchronously
  (async () => {
    try {
      const user = await qr;
      if (user && qrLoginSession) {
        qrLoginSession.status = "success";
        qrLoginSession.user = user;
        
        // Save session on success
        const sessionStr = (client!.session as StringSession).save();
        saveConfig({ session: sessionStr });
      }
    } catch (err: any) {
      if (qrLoginSession) {
        if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          qrLoginSession.status = "requires2FA";
        } else {
          qrLoginSession.status = "error";
          qrLoginSession.error = err.message || "Authentication rejected";
        }
      }
    }
  })();

  return {
    tokenUrl: qrLoginSession.tokenUrl,
    expires: qrLoginSession.expires,
  };
}

export async function checkQRStatus(): Promise<{ status: string; user?: any; error?: string }> {
  if (!qrLoginSession) {
    return { status: "not_started" };
  }

  // Check if token expired
  if (qrLoginSession.status === "pending" && Date.now() > qrLoginSession.expires) {
    qrLoginSession.status = "expired";
  }

  return {
    status: qrLoginSession.status,
    user: qrLoginSession.user,
    error: qrLoginSession.error,
  };
}

export async function sendCode(phoneNumber: string, apiIdInput?: number, apiHashInput?: string): Promise<{ phoneCodeHash: string }> {
  if (!client) {
    await initClient(apiIdInput, apiHashInput);
  }

  const conf = loadConfig();
  const apiId = apiIdInput || conf.apiId || parseInt(process.env.TELEGRAM_API_ID || '', 10);
  const apiHash = apiHashInput || conf.apiHash || process.env.TELEGRAM_API_HASH || '';

  const result = await client!.invoke(
    new Api.auth.SendCode({
      phoneNumber,
      apiId: apiId,
      apiHash: apiHash,
      settings: new Api.CodeSettings({}),
    })
  );

  phoneCodeHash = (result as Api.auth.SentCode).phoneCodeHash;
  return { phoneCodeHash: phoneCodeHash! };
}

export async function verifyCode(
  phoneNumber: string,
  code: string,
  hash: string
): Promise<{ success: boolean; requires2FA?: boolean }> {
  if (!client) throw new Error('Client not initialized');

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash: hash,
        phoneCode: code,
      })
    );

    // Save session on success
    const sessionStr = (client.session as StringSession).save();
    saveConfig({ session: sessionStr });

    return { success: true };
  } catch (err: any) {
    if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return { success: false, requires2FA: true };
    }
    throw err;
  }
}

export async function verify2FA(password: string): Promise<{ success: boolean }> {
  if (!client) throw new Error('Client not initialized');

  const passwordInfo = await client.invoke(new Api.account.GetPassword());
  const algo = passwordInfo.currentAlgo;

  if (!algo) throw new Error('No password algorithm found');

  // Compute SRP password hash using the client.computePasswordSRP method, casting client to any
  const result = await client.invoke(
    new Api.auth.CheckPassword({
      password: await (client as any).computePasswordSRP(passwordInfo, password)
    })
  );

  if (result) {
    const sessionStr = (client.session as StringSession).save();
    saveConfig({ session: sessionStr });
    return { success: true };
  }

  throw new Error('2FA verification failed');
}

export async function checkAuth(): Promise<boolean> {
  try {
    if (!client) {
      const conf = loadConfig();
      if (!conf.session) return false;
      await initClient();
    }

    if (!client!.connected) {
      await client!.connect();
    }

    const me = await client!.getMe();
    return !!me;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    if (client && client.connected) {
      await client.invoke(new Api.auth.LogOut());
    }
  } catch {
    // ignore
  } finally {
    client = null;
    clearConfig();
  }
}

export async function getMe(): Promise<Api.User | null> {
  if (!client || !client.connected) return null;
  try {
    const me = await client.getMe() as Api.User;
    return me;
  } catch {
    return null;
  }
}

// Saved Messages entity (self)
export async function getSavedMessages(): Promise<Api.User | null> {
  return getMe();
}

// Get all user-created channels (used as folders)
export async function getUserChannels(): Promise<Api.Channel[]> {
  if (!client || !client.connected) return [];

  try {
    const dialogs = await client.getDialogs({ limit: 500 });
    const channels: Api.Channel[] = [];

    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (entity instanceof Api.Channel && entity.creator) {
        channels.push(entity);
      }
    }

    return channels;
  } catch (e) {
    console.error('Failed to get channels:', e);
    return [];
  }
}

// Get messages (files) from a dialog
export async function getMessages(
  entity: Api.TypeEntityLike,
  options: {
    limit?: number;
    offsetId?: number;
    search?: string;
  } = {}
): Promise<{ messages: Api.Message[]; total: number }> {
  if (!client || !client.connected) return { messages: [], total: 0 };

  const { limit = 50, offsetId = 0, search = '' } = options;

  const result = await client.getMessages(entity, {
    limit,
    offsetId,
    search,
  });

  // Filter to only messages that have media/documents
  const fileMessages = result.filter(
    (msg) => msg instanceof Api.Message && (msg.media || msg.document)
  ) as Api.Message[];

  return { messages: fileMessages, total: result.total || fileMessages.length };
}

// Upload file to entity
export async function uploadFile(
  entity: Api.TypeEntityLike,
  filePath: string,
  fileName: string
): Promise<Api.Message> {
  if (!client || !client.connected) throw new Error('Not connected');

  const result = await client.sendFile(entity, {
    file: filePath,
    caption: '',
    forceDocument: true,
    workers: 4,
  });

  return result as Api.Message;
}

// Download file
export async function downloadFile(
  message: Api.Message,
  outputPath: string,
  progressCallback?: (progress: number) => void
): Promise<string> {
  if (!client || !client.connected) throw new Error('Not connected');

  const buffer = await client.downloadMedia(message, {
    progressCallback: (downloaded, total) => {
      if (progressCallback && total) {
        progressCallback(Math.round((Number(downloaded) / Number(total)) * 100));
      }
    },
  });

  if (buffer) {
    if (Buffer.isBuffer(buffer)) {
      fs.writeFileSync(outputPath, buffer);
    } else if (typeof buffer === 'string') {
      fs.writeFileSync(outputPath, buffer);
    }
  }

  return outputPath;
}

// Download file to buffer (for streaming)
export async function downloadFileToBuffer(
  message: Api.Message
): Promise<Buffer | null> {
  if (!client || !client.connected) throw new Error('Not connected');

  const buffer = await client.downloadMedia(message);
  if (Buffer.isBuffer(buffer)) {
    return buffer;
  }
  if (typeof buffer === 'string') {
    return Buffer.from(buffer);
  }
  return null;
}

// Stream file in chunks (stateless stateless downloading using gram.js iterFile)
export async function* downloadFileStream(
  message: Api.Message,
  fileSize: number
): AsyncGenerator<Buffer, void, unknown> {
  if (!client || !client.connected) throw new Error('Not connected');

  const media = message.media;
  if (!media || !(media instanceof Api.MessageMediaDocument) || !media.document) {
    throw new Error('Message does not contain a valid document');
  }

  // client.iterDownload yields Buffer chunks automatically
  const fileIterator = client.iterDownload({
    file: media,
    requestSize: 512 * 1024, // Required by gram.js types
  });

  for await (const chunk of fileIterator) {
    if (Buffer.isBuffer(chunk)) {
      yield chunk;
    } else if (typeof chunk === 'string') {
      yield Buffer.from(chunk);
    }
  }
}

// Download thumbnail
export async function downloadThumbnail(
  message: Api.Message
): Promise<Buffer | null> {
  if (!client || !client.connected) return null;

  try {
    const media = message.media;
    if (!media) return null;

    const thumb = await client.downloadMedia(message, {
      thumb: 0, // smallest thumb
    });

    if (Buffer.isBuffer(thumb)) return thumb;
    if (typeof thumb === 'string') return Buffer.from(thumb);
    return null;
  } catch {
    return null;
  }
}

// Create a new private channel (folder)
export async function createChannel(title: string): Promise<Api.Channel | null> {
  if (!client || !client.connected) return null;

  try {
    const result = await client.invoke(
      new Api.channels.CreateChannel({
        title,
        about: 'Telegram Drive Folder',
        megagroup: false,
      })
    );

    const updates = result as Api.Updates;
    if (updates.chats && updates.chats.length > 0) {
      return updates.chats[0] as Api.Channel;
    }
    return null;
  } catch (e) {
    console.error('Failed to create channel:', e);
    return null;
  }
}

// Rename a channel
export async function renameChannel(channelId: bigint, newTitle: string): Promise<boolean> {
  if (!client || !client.connected) return false;

  try {
    await client.invoke(
      new Api.channels.EditTitle({
        channel: channelId as any,
        title: newTitle,
      })
    );
    return true;
  } catch (e) {
    console.error('Failed to rename channel:', e);
    return false;
  }
}

// Delete a channel
export async function deleteChannel(channelId: bigint): Promise<boolean> {
  if (!client || !client.connected) return false;

  try {
    await client.invoke(
      new Api.channels.DeleteChannel({
        channel: channelId as any,
      })
    );
    return true;
  } catch (e) {
    console.error('Failed to delete channel:', e);
    return false;
  }
}

// Toggle channel publicity (Make Public / Private)
export async function updateChannelPublicity(channelId: bigint, isPublic: boolean, username?: string): Promise<boolean> {
  if (!client || !client.connected) return false;

  try {
    if (isPublic) {
      if (!username) throw new Error("Username is required to make a channel public");
      
      // Update channel username to make it public
      await client.invoke(
        new Api.channels.UpdateUsername({
          channel: channelId as any,
          username: username,
        })
      );
    } else {
      // Set username to empty to make it private
      await client.invoke(
        new Api.channels.UpdateUsername({
          channel: channelId as any,
          username: "",
        })
      );
    }
    return true;
  } catch (e) {
    console.error('Failed to update channel publicity:', e);
    return false;
  }
}

// Get channel invite link
export async function getChannelInviteLink(channelId: bigint): Promise<string | null> {
  if (!client || !client.connected) return null;

  try {
    const result = await client.invoke(
      new Api.channels.GetFullChannel({
        channel: channelId as any,
      })
    );

    const fullChat = result.fullChat as Api.ChannelFull;
    if (fullChat.exportedInvite) {
      if (fullChat.exportedInvite instanceof Api.ChatInviteExported) {
        return fullChat.exportedInvite.link;
      }
    }
    
    // Create new invite link if none exists
    const invite = await client.invoke(
      new Api.messages.ExportChatInvite({
        peer: channelId as any,
      })
    );
    
    if (invite instanceof Api.ChatInviteExported) {
      return invite.link;
    }
    return null;
  } catch (e) {
    console.error('Failed to get invite link:', e);
    return null;
  }
}

// Delete message(s)
export async function deleteMessages(
  entity: Api.TypeEntityLike,
  messageIds: number[]
): Promise<boolean> {
  if (!client || !client.connected) return false;

  try {
    await client.deleteMessages(entity, messageIds, { revoke: true });
    return true;
  } catch (e) {
    console.error('Failed to delete messages:', e);
    return false;
  }
}

// Forward message (copy file to another folder)
export async function forwardMessage(
  fromEntity: Api.TypeEntityLike,
  toEntity: Api.TypeEntityLike,
  messageId: number
): Promise<boolean> {
  if (!client || !client.connected) return false;

  try {
    await client.forwardMessages(toEntity, {
      messages: [messageId],
      fromPeer: fromEntity,
    });
    return true;
  } catch (e) {
    console.error('Failed to forward message:', e);
    return false;
  }
}

// Edit message caption (rename file)
export async function editCaption(
  entity: Api.TypeEntityLike,
  messageId: number,
  newCaption: string
): Promise<boolean> {
  if (!client || !client.connected) return false;

  try {
    await client.invoke(
      new Api.messages.EditMessage({
        peer: entity,
        id: messageId,
        message: newCaption,
      })
    );
    return true;
  } catch (e) {
    console.error('Failed to edit caption:', e);
    return false;
  }
}
