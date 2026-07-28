import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { CustomFile } from 'telegram/client/uploads.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { updateUserTelegramSession, getUserById, deleteUser } from './db.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
// Active clients map: userId -> TelegramClient
const activeClients = new Map();
const pendingAuths = new Map();
export function getActiveClient(userId) {
    return activeClients.get(userId) || null;
}
export async function getClientForUser(userId) {
    let client = activeClients.get(userId);
    if (client) {
        if (!client.connected) {
            await client.connect();
        }
        return client;
    }
    // Try loading from database
    const user = getUserById(userId);
    if (!user || !user.session)
        return null;
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
function createAuthClient(apiIdInput, apiHashInput) {
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
export async function sendQRToken(userId, authSessionIdInput, apiIdInput, apiHashInput) {
    const authSessionId = authSessionIdInput || crypto.randomBytes(16).toString('hex');
    let pending = pendingAuths.get(authSessionId);
    if (pending) {
        try {
            await pending.client.disconnect();
        }
        catch { }
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
    const qrPromise = client.signIn({
        phoneNumber: async () => "",
        phoneCode: async () => "",
        password: async () => "",
        qrCode: async (token) => {
            pending.qrSessionStatus = {
                tokenUrl: `tg://login?token=${token.token.toString("base64url")}`,
                expires: Date.now() + (token.expires * 1000),
                status: "pending",
                user: null,
            };
        },
        onError: (err) => {
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
                pending.qrSessionStatus.status = "success";
                pending.qrSessionStatus.user = user;
                // Save Telegram session to the user's account
                const sessionStr = client.session.save();
                const me = await client.getMe();
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
        }
        catch (err) {
            if (pending && pending.qrSessionStatus) {
                if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
                    pending.qrSessionStatus.status = "requires2FA";
                }
                else {
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
export async function checkQRStatus(authSessionId) {
    const pending = pendingAuths.get(authSessionId);
    if (!pending || !pending.qrSessionStatus) {
        return { status: "not_started" };
    }
    if (pending.qrSessionStatus.status === "pending" && Date.now() > pending.qrSessionStatus.expires) {
        pending.qrSessionStatus.status = "expired";
    }
    const result = {
        status: pending.qrSessionStatus.status,
        error: pending.qrSessionStatus.error,
    };
    if (pending.qrSessionStatus.status === "success" && pending.qrSessionStatus.user) {
        const me = await pending.client.getMe();
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
export async function sendCode(userId, authSessionIdInput, phoneNumber, apiIdInput, apiHashInput) {
    const authSessionId = authSessionIdInput || crypto.randomBytes(16).toString('hex');
    let pending = pendingAuths.get(authSessionId);
    if (pending) {
        try {
            await pending.client.disconnect();
        }
        catch { }
    }
    const { client, apiId, apiHash } = createAuthClient(apiIdInput, apiHashInput);
    await client.connect();
    const result = await client.invoke(new Api.auth.SendCode({
        phoneNumber,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({}),
    }));
    const phoneCodeHash = result.phoneCodeHash;
    pendingAuths.set(authSessionId, {
        client,
        phoneCodeHash,
        apiId,
        apiHash,
        userId,
    });
    return { authSessionId, phoneCodeHash };
}
export async function verifyCode(userId, authSessionId, phoneNumber, code, hash) {
    const pending = pendingAuths.get(authSessionId);
    if (!pending)
        throw new Error('Auth session not found or expired');
    if (pending.userId !== userId)
        throw new Error('Unauthorized session context');
    try {
        await pending.client.invoke(new Api.auth.SignIn({
            phoneNumber,
            phoneCodeHash: hash,
            phoneCode: code,
        }));
        // Success! Save Telegram session details to existing TeleDrive user
        const sessionStr = pending.client.session.save();
        const me = await pending.client.getMe();
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
    catch (err) {
        if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            return { success: false, requires2FA: true };
        }
        throw err;
    }
}
export async function verify2FA(userId, authSessionId, password) {
    const pending = pendingAuths.get(authSessionId);
    if (!pending)
        throw new Error('Auth session not found or expired');
    if (pending.userId !== userId)
        throw new Error('Unauthorized session context');
    const passwordInfo = await pending.client.invoke(new Api.account.GetPassword());
    const algo = passwordInfo.currentAlgo;
    if (!algo)
        throw new Error('No password algorithm found');
    const result = await pending.client.invoke(new Api.auth.CheckPassword({
        password: await pending.client.computePasswordSRP(passwordInfo, password)
    }));
    if (result) {
        const sessionStr = pending.client.session.save();
        const me = await pending.client.getMe();
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
export async function logout(userId) {
    const client = activeClients.get(userId);
    try {
        if (client && client.connected) {
            await client.invoke(new Api.auth.LogOut());
        }
    }
    catch {
        // ignore
    }
    finally {
        activeClients.delete(userId);
        deleteUser(userId);
    }
}
// Saved Messages entity (self)
export async function getSavedMessages(client) {
    try {
        return (await client.getMe());
    }
    catch {
        return null;
    }
}
// Get all user-created channels (used as folders)
export async function getUserChannels(client) {
    try {
        const dialogs = await client.getDialogs({ limit: 500 });
        const channels = [];
        for (const dialog of dialogs) {
            const entity = dialog.entity;
            if (entity instanceof Api.Channel && entity.creator) {
                channels.push(entity);
            }
        }
        return channels;
    }
    catch (e) {
        console.error('Failed to get channels:', e);
        return [];
    }
}
// Get messages (files) from a dialog
export async function getMessages(client, entity, options = {}) {
    const { limit = 50, offsetId = 0, search = '' } = options;
    const result = await client.getMessages(entity, {
        limit,
        offsetId,
        search,
    });
    // Filter to only messages that have media/documents
    const fileMessages = result.filter((msg) => msg instanceof Api.Message && (msg.media || msg.document));
    return { messages: fileMessages, total: result.total || fileMessages.length };
}
// Upload file to entity
export async function uploadFile(client, entity, filePath, fileName) {
    const size = fs.statSync(filePath).size;
    const customFile = new CustomFile(fileName, size, filePath);
    const result = await client.sendFile(entity, {
        file: customFile,
        caption: '',
        forceDocument: true,
        workers: 4,
    });
    return result;
}
// Download file to local path
export async function downloadFile(client, message, outputPath, progressCallback) {
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
        }
        else if (typeof buffer === 'string') {
            fs.writeFileSync(outputPath, buffer);
        }
    }
    return outputPath;
}
// Download file to buffer (for streaming)
export async function downloadFileToBuffer(client, message) {
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
export async function* downloadFileStream(client, message, fileSize) {
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
            }
            else if (typeof chunk === 'string') {
                yield Buffer.from(chunk);
            }
        }
    }
    catch (err) {
        console.warn('iterDownload failed, falling back to downloadMedia buffer:', err);
        const buffer = await client.downloadMedia(message);
        if (Buffer.isBuffer(buffer)) {
            yield buffer;
        }
        else if (typeof buffer === 'string') {
            yield Buffer.from(buffer);
        }
    }
}
// Download thumbnail
export async function downloadThumbnail(client, message) {
    try {
        const media = message.media;
        if (!media)
            return null;
        const thumb = await client.downloadMedia(message, {
            thumb: 0, // smallest thumb
        });
        if (Buffer.isBuffer(thumb))
            return thumb;
        if (typeof thumb === 'string')
            return Buffer.from(thumb);
        return null;
    }
    catch {
        return null;
    }
}
// Create a new private channel (folder)
export async function createChannel(client, title) {
    try {
        const result = await client.invoke(new Api.channels.CreateChannel({
            title,
            about: 'Telegram Drive Folder',
            megagroup: false,
        }));
        const updates = result;
        if (updates.chats && updates.chats.length > 0) {
            return updates.chats[0];
        }
        return null;
    }
    catch (e) {
        console.error('Failed to create channel:', e);
        return null;
    }
}
// Rename a channel
export async function renameChannel(client, channelId, newTitle) {
    try {
        await client.invoke(new Api.channels.EditTitle({
            channel: channelId,
            title: newTitle,
        }));
        return true;
    }
    catch (e) {
        console.error('Failed to rename channel:', e);
        return false;
    }
}
// Delete a channel
export async function deleteChannel(client, channelId) {
    try {
        await client.invoke(new Api.channels.DeleteChannel({
            channel: channelId,
        }));
        return true;
    }
    catch (e) {
        console.error('Failed to delete channel:', e);
        return false;
    }
}
// Toggle channel publicity
export async function updateChannelPublicity(client, channelId, isPublic, username) {
    try {
        if (isPublic) {
            if (!username)
                throw new Error("Username is required to make a channel public");
            await client.invoke(new Api.channels.UpdateUsername({
                channel: channelId,
                username: username,
            }));
        }
        else {
            await client.invoke(new Api.channels.UpdateUsername({
                channel: channelId,
                username: "",
            }));
        }
        return true;
    }
    catch (e) {
        console.error('Failed to update channel publicity:', e);
        return false;
    }
}
// Get channel invite link
export async function getChannelInviteLink(client, channelId) {
    try {
        const result = await client.invoke(new Api.channels.GetFullChannel({
            channel: channelId,
        }));
        const fullChat = result.fullChat;
        if (fullChat.exportedInvite) {
            if (fullChat.exportedInvite instanceof Api.ChatInviteExported) {
                return fullChat.exportedInvite.link;
            }
        }
        const invite = await client.invoke(new Api.messages.ExportChatInvite({
            peer: channelId,
        }));
        if (invite instanceof Api.ChatInviteExported) {
            return invite.link;
        }
        return null;
    }
    catch (e) {
        console.error('Failed to get invite link:', e);
        return null;
    }
}
// Delete message(s)
export async function deleteMessages(client, entity, messageIds) {
    try {
        await client.deleteMessages(entity, messageIds, { revoke: true });
        return true;
    }
    catch (e) {
        console.error('Failed to delete messages:', e);
        return false;
    }
}
// Forward message (copy file to another folder)
export async function forwardMessage(client, fromEntity, toEntity, messageId) {
    try {
        await client.forwardMessages(toEntity, {
            messages: [messageId],
            fromPeer: fromEntity,
        });
        return true;
    }
    catch (e) {
        console.error('Failed to forward message:', e);
        return false;
    }
}
// Edit message caption (rename file)
export async function editCaption(client, entity, messageId, newCaption) {
    try {
        await client.invoke(new Api.messages.EditMessage({
            peer: entity,
            id: messageId,
            message: newCaption,
        }));
        return true;
    }
    catch (e) {
        console.error('Failed to edit caption:', e);
        return false;
    }
}
//# sourceMappingURL=telegram.js.map