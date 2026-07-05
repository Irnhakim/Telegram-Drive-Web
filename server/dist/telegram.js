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
let client = null;
let phoneCodeHash = null;
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    }
    catch (e) {
        console.warn('Failed to load local config:', e);
    }
    return {};
}
function saveConfig(update) {
    try {
        const current = loadConfig();
        const next = { ...current, ...update };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
    }
    catch (e) {
        console.error('Failed to save config:', e);
    }
}
function clearConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            fs.unlinkSync(CONFIG_FILE);
        }
    }
    catch (e) {
        console.error('Failed to clear config:', e);
    }
}
export function getTelegramClient() {
    return client;
}
export async function initClient(apiIdInput, apiHashInput) {
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
let qrLoginSession = null;
export async function sendQRToken(apiIdInput, apiHashInput) {
    if (!client) {
        await initClient(apiIdInput, apiHashInput);
    }
    // Clean disconnect if already logging in
    qrLoginSession = null;
    const qr = await client.signIn({
        phoneNumber: async () => "",
        phoneCode: async () => "",
        password: async () => "",
        qrCode: async (token) => {
            qrLoginSession = {
                tokenUrl: `tg://login?token=${token.token.toString("base64url")}`,
                expires: Date.now() + (token.expires * 1000),
                status: "pending",
                user: null,
            };
        },
        onError: (err) => {
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
                const sessionStr = client.session.save();
                saveConfig({ session: sessionStr });
            }
        }
        catch (err) {
            if (qrLoginSession) {
                if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
                    qrLoginSession.status = "requires2FA";
                }
                else {
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
export async function checkQRStatus() {
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
export async function sendCode(phoneNumber, apiIdInput, apiHashInput) {
    if (!client) {
        await initClient(apiIdInput, apiHashInput);
    }
    const conf = loadConfig();
    const apiId = apiIdInput || conf.apiId || parseInt(process.env.TELEGRAM_API_ID || '', 10);
    const apiHash = apiHashInput || conf.apiHash || process.env.TELEGRAM_API_HASH || '';
    const result = await client.invoke(new Api.auth.SendCode({
        phoneNumber,
        apiId: apiId,
        apiHash: apiHash,
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
        saveConfig({ session: sessionStr });
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
    // Compute SRP password hash using the client.computePasswordSRP method, casting client to any
    const result = await client.invoke(new Api.auth.CheckPassword({
        password: await client.computePasswordSRP(passwordInfo, password)
    }));
    if (result) {
        const sessionStr = client.session.save();
        saveConfig({ session: sessionStr });
        return { success: true };
    }
    throw new Error('2FA verification failed');
}
export async function checkAuth() {
    try {
        if (!client) {
            const conf = loadConfig();
            if (!conf.session)
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
        clearConfig();
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
// Stream file in chunks (stateless stateless downloading)
export async function* downloadFileStream(message, fileSize) {
    if (!client || !client.connected)
        throw new Error('Not connected');
    const media = message.media;
    if (!media || !(media instanceof Api.MessageMediaDocument) || !media.document) {
        throw new Error('Message does not contain a valid document');
    }
    const document = media.document;
    const inputDocument = new Api.InputDocumentFileLocation({
        id: document.id,
        accessHash: document.accessHash,
        fileReference: document.fileReference,
        thumbSize: '',
    });
    const chunkSize = 512 * 1024; // 512 KB chunks
    let offset = 0;
    while (offset < fileSize) {
        const limit = Math.min(chunkSize, fileSize - offset);
        const result = await client.invoke(new Api.upload.GetFile({
            location: inputDocument,
            offset: BigInt(offset),
            limit: limit,
        }));
        if (result instanceof Api.upload.File) {
            yield result.bytes;
        }
        else {
            break;
        }
        offset += limit;
    }
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
// Toggle channel publicity (Make Public / Private)
export async function updateChannelPublicity(channelId, isPublic, username) {
    if (!client || !client.connected)
        return false;
    try {
        if (isPublic) {
            if (!username)
                throw new Error("Username is required to make a channel public");
            // Update channel username to make it public
            await client.invoke(new Api.channels.UpdateUsername({
                channel: channelId,
                username: username,
            }));
        }
        else {
            // Set username to empty to make it private
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
export async function getChannelInviteLink(channelId) {
    if (!client || !client.connected)
        return null;
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
        // Create new invite link if none exists
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