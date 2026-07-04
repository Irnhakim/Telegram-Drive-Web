import { TelegramClient, Api, helpers } from 'telegram';
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
let client = null;
let phoneCodeHash = null;
function loadSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            return fs.readFileSync(SESSION_FILE, 'utf-8').trim();
        }
    }
    catch (e) {
        console.warn('Failed to load session:', e);
    }
    return '';
}
function saveSession(session) {
    try {
        fs.writeFileSync(SESSION_FILE, session, 'utf-8');
    }
    catch (e) {
        console.error('Failed to save session:', e);
    }
}
function clearSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            fs.unlinkSync(SESSION_FILE);
        }
    }
    catch (e) {
        console.error('Failed to clear session:', e);
    }
}
export function getTelegramClient() {
    return client;
}
export async function initClient() {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || '', 10);
    const apiHash = process.env.TELEGRAM_API_HASH || '';
    if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables are required');
    }
    const sessionStr = loadSession();
    const session = new StringSession(sessionStr);
    client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
        deviceModel: 'Telegram Drive Web',
        systemVersion: 'Web Server 1.0',
        appVersion: '1.0.0',
    });
    await client.connect();
    return client;
}
export async function sendCode(phoneNumber) {
    if (!client) {
        await initClient();
    }
    const result = await client.invoke(new Api.auth.SendCode({
        phoneNumber,
        apiId: parseInt(process.env.TELEGRAM_API_ID || '', 10),
        apiHash: process.env.TELEGRAM_API_HASH || '',
        settings: new Api.CodeSettings({}),
    }));
    phoneCodeHash = result.phoneCodeHash;
    return { phoneCodeHash: phoneCodeHash };
}
export async function verifyCode(phoneNumber, code, hash) {
    if (!client)
        throw new Error('Client not initialized');
    try {
        await client.invoke(new Api.auth.SignIn({
            phoneNumber,
            phoneCodeHash: hash,
            phoneCode: code,
        }));
        // Save session on success
        const sessionStr = client.session.save();
        saveSession(sessionStr);
        return { success: true };
    }
    catch (err) {
        if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            return { success: false, requires2FA: true };
        }
        throw err;
    }
}
export async function verify2FA(password) {
    if (!client)
        throw new Error('Client not initialized');
    const passwordInfo = await client.invoke(new Api.account.GetPassword());
    const algo = passwordInfo.currentAlgo;
    if (!algo)
        throw new Error('No password algorithm found');
    // Compute SRP password hash using the helpers.computePasswordSRP method
    const result = await client.invoke(new Api.auth.CheckPassword({
        password: await helpers.computePasswordSRP(passwordInfo, password)
    }));
    if (result) {
        const sessionStr = client.session.save();
        saveSession(sessionStr);
        return { success: true };
    }
    throw new Error('2FA verification failed');
}
export async function checkAuth() {
    try {
        if (!client) {
            const sessionStr = loadSession();
            if (!sessionStr)
                return false;
            await initClient();
        }
        if (!client.connected) {
            await client.connect();
        }
        const me = await client.getMe();
        return !!me;
    }
    catch {
        return false;
    }
}
export async function logout() {
    try {
        if (client && client.connected) {
            await client.invoke(new Api.auth.LogOut());
        }
    }
    catch {
        // ignore
    }
    finally {
        client = null;
        clearSession();
    }
}
export async function getMe() {
    if (!client || !client.connected)
        return null;
    try {
        const me = await client.getMe();
        return me;
    }
    catch {
        return null;
    }
}
// Saved Messages entity (self)
export async function getSavedMessages() {
    return getMe();
}
// Get all user-created channels (used as folders)
export async function getUserChannels() {
    if (!client || !client.connected)
        return [];
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
export async function getMessages(entity, options = {}) {
    if (!client || !client.connected)
        return { messages: [], total: 0 };
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
export async function uploadFile(entity, filePath, fileName) {
    if (!client || !client.connected)
        throw new Error('Not connected');
    const result = await client.sendFile(entity, {
        file: filePath,
        caption: '',
        forceDocument: true,
        workers: 4,
    });
    return result;
}
// Download file
export async function downloadFile(message, outputPath, progressCallback) {
    if (!client || !client.connected)
        throw new Error('Not connected');
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
export async function downloadFileToBuffer(message) {
    if (!client || !client.connected)
        throw new Error('Not connected');
    const buffer = await client.downloadMedia(message);
    if (Buffer.isBuffer(buffer)) {
        return buffer;
    }
    if (typeof buffer === 'string') {
        return Buffer.from(buffer);
    }
    return null;
}
// Download thumbnail
export async function downloadThumbnail(message) {
    if (!client || !client.connected)
        return null;
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
export async function createChannel(title) {
    if (!client || !client.connected)
        return null;
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
export async function renameChannel(channelId, newTitle) {
    if (!client || !client.connected)
        return false;
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
export async function deleteChannel(channelId) {
    if (!client || !client.connected)
        return false;
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
// Delete message(s)
export async function deleteMessages(entity, messageIds) {
    if (!client || !client.connected)
        return false;
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
export async function forwardMessage(fromEntity, toEntity, messageId) {
    if (!client || !client.connected)
        return false;
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
export async function editCaption(entity, messageId, newCaption) {
    if (!client || !client.connected)
        return false;
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