import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { CustomFile } from 'telegram/client/uploads.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { updateUserTelegramSession, getUserById, deleteUser, disconnectUserTelegram } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');

// Active clients map: userId -> TelegramClient
const activeClients = new Map<string, TelegramClient>();

// Pending auth sessions: authSessionId -> pending client state
interface PendingAuth {
  client: TelegramClient;
  phoneCodeHash?: string;
  qrLoginPromise?: Promise<any>;
  qrSessionStatus?: {
    tokenUrl: string;
    expires: number;
    status: string;
    user: any;
    error?: string;
  };
  apiId: number;
  apiHash: string;
  userId: string; // The TeleDrive User ID this session belongs to
}
const pendingAuths = new Map<string, PendingAuth>();

export function getActiveClient(userId: string): TelegramClient | null {
  return activeClients.get(userId) || null;
}

export async function getClientForUser(userId: string): Promise<TelegramClient | null> {
  let client = activeClients.get(userId);
  if (client) {
    if (!client.connected) {
      await client.connect();
    }
    return client;
  }

  // Try loading from database
  const user = getUserById(userId);
  if (!user || !user.session) return null;

  const apiId = user.apiId || parseInt(process.env.TELEGRAM_API_ID || '', 10);
  const apiHash = user.apiHash || process.env.TELEGRAM_API_HASH || '';

  if (!apiId || !apiHash) {
    throw new Error('Telegram API credentials missing for user');
  }

  const session = new StringSession(user.session);
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    deviceModel: 'Telegram Drive Web',
    systemVersion: 'Web Server 1.0',
    appVersion: '1.0.0',
  });

  await client.connect();
  activeClients.set(userId, client);
  return client;
}

// Helper to create a new client for auth flow
function createAuthClient(apiIdInput?: number, apiHashInput?: string): { client: TelegramClient; apiId: number; apiHash: string } {
  const apiId = apiIdInput || parseInt(process.env.TELEGRAM_API_ID || '', 10);
  const apiHash = apiHashInput || process.env.TELEGRAM_API_HASH || '';

  if (!apiId || !apiHash) {
    throw new Error('Telegram API ID and API Hash are required to connect.');
  }

  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    deviceModel: 'Telegram Drive Web',
    systemVersion: 'Web Server 1.0',
    appVersion: '1.0.0',
  });

  return { client, apiId, apiHash };
}

// QR Login Auth Flow
export async function sendQRToken(
  userId: string,
  authSessionIdInput?: string,
  apiIdInput?: number,
  apiHashInput?: string
): Promise<{ authSessionId: string; tokenUrl: string; expires: number }> {
  const authSessionId = authSessionIdInput || crypto.randomBytes(16).toString('hex');
  
  let pending = pendingAuths.get(authSessionId);
  if (pending) {
    try { await pending.client.disconnect(); } catch {}
  }

  const { client, apiId, apiHash } = createAuthClient(apiIdInput, apiHashInput);
  await client.connect();

  pending = {
    client,
    apiId,
    apiHash,
    userId,
  };
  pendingAuths.set(authSessionId, pending);

  const qrPromise = (client as any).signIn({
    phoneNumber: async () => "",
    phoneCode: async () => "",
    password: async () => "",
    qrCode: async (token: any) => {
      pending!.qrSessionStatus = {
        tokenUrl: `tg://login?token=${token.token.toString("base64url")}`,
        expires: Date.now() + (token.expires * 1000),
        status: "pending",
        user: null,
      };
    },
    onError: (err: any) => {
      if (pending && pending.qrSessionStatus) {
        pending.qrSessionStatus.status = "error";
        pending.qrSessionStatus.error = err.message;
      }
    }
  });

  pending.qrLoginPromise = qrPromise;

  // Wait briefly for the callback to fire
  let retries = 30;
  while (!pending.qrSessionStatus && retries > 0) {
    await new Promise((r) => setTimeout(r, 100));
    retries--;
  }

  if (!pending.qrSessionStatus) {
    throw new Error("Failed to initialize Telegram QR code login session");
  }

  // Handle completion in the background
  (async () => {
    try {
      const user = await qrPromise;
      if (user && pending) {
        pending.qrSessionStatus!.status = "success";
        pending.qrSessionStatus!.user = user;

        // Save Telegram session to the user's account
        const sessionStr = (client.session as StringSession).save();
        const me = await client.getMe() as Api.User;

        updateUserTelegramSession(pending.userId, {
          telegramId: me.id.toString(),
          telegramUsername: me.username,
          telegramFirstName: me.firstName,
          telegramLastName: me.lastName,
          telegramPhone: me.phone,
          session: sessionStr,
          apiId: pending.apiId,
          apiHash: pending.apiHash,
        });

        activeClients.set(pending.userId, client);
      }
    } catch (err: any) {
      if (pending && pending.qrSessionStatus) {
        if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          pending.qrSessionStatus.status = "requires2FA";
        } else {
          pending.qrSessionStatus.status = "error";
          pending.qrSessionStatus.error = err.message || "Authentication rejected";
        }
      }
    }
  })();

  return {
    authSessionId,
    tokenUrl: pending.qrSessionStatus.tokenUrl,
    expires: pending.qrSessionStatus.expires,
  };
}

export async function checkQRStatus(
  authSessionId: string
): Promise<{ status: string; user?: any; error?: string }> {
  const pending = pendingAuths.get(authSessionId);
  if (!pending || !pending.qrSessionStatus) {
    return { status: "not_started" };
  }

  if (pending.qrSessionStatus.status === "pending" && Date.now() > pending.qrSessionStatus.expires) {
    pending.qrSessionStatus.status = "expired";
  }

  const result: any = {
    status: pending.qrSessionStatus.status,
    error: pending.qrSessionStatus.error,
  };

  if (pending.qrSessionStatus.status === "success" && pending.qrSessionStatus.user) {
    const me = await pending.client.getMe() as Api.User;
    result.user = {
      id: me.id.toString(),
      firstName: me.firstName,
      lastName: me.lastName || '',
      username: me.username || '',
      phone: me.phone || '',
    };
    pendingAuths.delete(authSessionId);
  }

  return result;
}

// SMS Login Flow
export async function sendCode(
  userId: string,
  authSessionIdInput: string | undefined,
  phoneNumber: string,
  apiIdInput?: number,
  apiHashInput?: string
): Promise<{ authSessionId: string; phoneCodeHash: string }> {
  const authSessionId = authSessionIdInput || crypto.randomBytes(16).toString('hex');
  
  let pending = pendingAuths.get(authSessionId);
  if (pending) {
    try { await pending.client.disconnect(); } catch {}
  }

  const { client, apiId, apiHash } = createAuthClient(apiIdInput, apiHashInput);
  await client.connect();

  const result = await client.invoke(
    new Api.auth.SendCode({
      phoneNumber,
      apiId,
      apiHash,
      settings: new Api.CodeSettings({}),
    })
  );

  const phoneCodeHash = (result as Api.auth.SentCode).phoneCodeHash;
  pendingAuths.set(authSessionId, {
    client,
    phoneCodeHash,
    apiId,
    apiHash,
    userId,
  });

  return { authSessionId, phoneCodeHash };
}

export async function verifyCode(
  userId: string,
  authSessionId: string,
  phoneNumber: string,
  code: string,
  hash: string
): Promise<{ success: boolean; requires2FA?: boolean; user?: any }> {
  const pending = pendingAuths.get(authSessionId);
  if (!pending) throw new Error('Auth session not found or expired');
  if (pending.userId !== userId) throw new Error('Unauthorized session context');

  try {
    await pending.client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash: hash,
        phoneCode: code,
      })
    );

    // Success! Save Telegram session details to existing TeleDrive user
    const sessionStr = (pending.client.session as StringSession).save();
    const me = await pending.client.getMe() as Api.User;

    updateUserTelegramSession(userId, {
      telegramId: me.id.toString(),
      telegramUsername: me.username,
      telegramFirstName: me.firstName,
      telegramLastName: me.lastName,
      telegramPhone: me.phone,
      session: sessionStr,
      apiId: pending.apiId,
      apiHash: pending.apiHash,
    });

    activeClients.set(userId, pending.client);
    pendingAuths.delete(authSessionId);

    return {
      success: true,
      user: {
        id: me.id.toString(),
        firstName: me.firstName,
        lastName: me.lastName || '',
        username: me.username || '',
        phone: me.phone || '',
      },
    };
  } catch (err: any) {
    if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return { success: false, requires2FA: true };
    }
    throw err;
  }
}

export async function verify2FA(
  userId: string,
  authSessionId: string,
  password: string
): Promise<{ success: boolean; user?: any }> {
  const pending = pendingAuths.get(authSessionId);
  if (!pending) throw new Error('Auth session not found or expired');
  if (pending.userId !== userId) throw new Error('Unauthorized session context');

  const passwordInfo = await pending.client.invoke(new Api.account.GetPassword());
  const algo = passwordInfo.currentAlgo;

  if (!algo) throw new Error('No password algorithm found');

  const result = await pending.client.invoke(
    new Api.auth.CheckPassword({
      password: await (pending.client as any).computePasswordSRP(passwordInfo, password)
    })
  );

  if (result) {
    const sessionStr = (pending.client.session as StringSession).save();
    const me = await pending.client.getMe() as Api.User;

    updateUserTelegramSession(userId, {
      telegramId: me.id.toString(),
      telegramUsername: me.username,
      telegramFirstName: me.firstName,
      telegramLastName: me.lastName,
      telegramPhone: me.phone,
      session: sessionStr,
      apiId: pending.apiId,
      apiHash: pending.apiHash,
    });

    activeClients.set(userId, pending.client);
    pendingAuths.delete(authSessionId);

    return {
      success: true,
      user: {
        id: me.id.toString(),
        firstName: me.firstName,
        lastName: me.lastName || '',
        username: me.username || '',
        phone: me.phone || '',
      },
    };
  }

  throw new Error('2FA verification failed');
}

export async function disconnectTelegram(userId: string): Promise<void> {
  const client = activeClients.get(userId);
  try {
    if (client && client.connected) {
      await client.invoke(new Api.auth.LogOut());
    }
  } catch {
    // ignore
  } finally {
    activeClients.delete(userId);
    disconnectUserTelegram(userId);
  }
}

export async function deactivateClient(userId: string): Promise<void> {
  const client = activeClients.get(userId);
  if (client) {
    try {
      await client.disconnect();
    } catch {
      // ignore
    } finally {
      activeClients.delete(userId);
    }
  }
}

// Saved Messages entity (self)
export async function getSavedMessages(client: TelegramClient): Promise<Api.User | null> {
  try {
    return (await client.getMe()) as Api.User;
  } catch {
    return null;
  }
}

// Get all user-created channels (used as folders)
export async function getUserChannels(client: TelegramClient): Promise<Api.Channel[]> {
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
  client: TelegramClient,
  entity: Api.TypeEntityLike,
  options: {
    limit?: number;
    offsetId?: number;
    search?: string;
  } = {}
): Promise<{ messages: Api.Message[]; total: number }> {
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
  client: TelegramClient,
  entity: Api.TypeEntityLike,
  filePath: string,
  fileName: string
): Promise<Api.Message> {
  const size = fs.statSync(filePath).size;
  const customFile = new CustomFile(fileName, size, filePath);

  const result = await client.sendFile(entity, {
    file: customFile,
    caption: '',
    forceDocument: true,
    workers: 4,
  });

  return result as Api.Message;
}

// Download file to local path
export async function downloadFile(
  client: TelegramClient,
  message: Api.Message,
  outputPath: string,
  progressCallback?: (progress: number) => void
): Promise<string> {
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
  client: TelegramClient,
  message: Api.Message
): Promise<Buffer | null> {
  const buffer = await client.downloadMedia(message);
  if (Buffer.isBuffer(buffer)) {
    return buffer;
  }
  if (typeof buffer === 'string') {
    return Buffer.from(buffer);
  }
  return null;
}

// Stream file in chunks
export async function* downloadFileStream(
  client: TelegramClient,
  message: Api.Message,
  fileSize: number
): AsyncGenerator<Buffer, void, unknown> {
  const media = message.media;
  if (!media || !(media instanceof Api.MessageMediaDocument) || !media.document) {
    throw new Error('Message does not contain a valid document');
  }

  try {
    const fileIterator = client.iterDownload({
      file: media,
      requestSize: 512 * 1024,
    });

    for await (const chunk of fileIterator) {
      if (Buffer.isBuffer(chunk)) {
        yield chunk;
      } else if (typeof chunk === 'string') {
        yield Buffer.from(chunk);
      }
    }
  } catch (err) {
    console.warn('iterDownload failed, falling back to downloadMedia buffer:', err);
    const buffer = await client.downloadMedia(message);
    if (Buffer.isBuffer(buffer)) {
      yield buffer;
    } else if (typeof buffer === 'string') {
      yield Buffer.from(buffer);
    }
  }
}

// Download thumbnail
export async function downloadThumbnail(
  client: TelegramClient,
  message: Api.Message
): Promise<Buffer | null> {
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
export async function createChannel(client: TelegramClient, title: string): Promise<Api.Channel | null> {
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
export async function renameChannel(client: TelegramClient, channelId: bigint, newTitle: string): Promise<boolean> {
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
export async function deleteChannel(client: TelegramClient, channelId: bigint): Promise<boolean> {
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

// Toggle channel publicity
export async function updateChannelPublicity(
  client: TelegramClient,
  channelId: bigint,
  isPublic: boolean,
  username?: string
): Promise<boolean> {
  try {
    if (isPublic) {
      if (!username) throw new Error("Username is required to make a channel public");
      await client.invoke(
        new Api.channels.UpdateUsername({
          channel: channelId as any,
          username: username,
        })
      );
    } else {
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
export async function getChannelInviteLink(client: TelegramClient, channelId: bigint): Promise<string | null> {
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
  client: TelegramClient,
  entity: Api.TypeEntityLike,
  messageIds: number[]
): Promise<boolean> {
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
  client: TelegramClient,
  fromEntity: Api.TypeEntityLike,
  toEntity: Api.TypeEntityLike,
  messageId: number
): Promise<boolean> {
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
  client: TelegramClient,
  entity: Api.TypeEntityLike,
  messageId: number,
  newCaption: string
): Promise<boolean> {
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
