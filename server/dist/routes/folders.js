import { Router } from 'express';
import { getSavedMessages, getUserChannels, createChannel, renameChannel, deleteChannel, updateChannelPublicity, getChannelInviteLink, } from '../telegram.js';
import { cacheFolders } from '../db.js';
export const foldersRouter = Router();
// List all folders (Saved Messages + Channels)
foldersRouter.get('/', async (_req, res) => {
    try {
        const me = await getSavedMessages();
        const channels = await getUserChannels();
        const folders = [];
        // Saved Messages always first
        if (me) {
            folders.push({
                id: 'me',
                name: 'Saved Messages',
                type: 'saved',
            });
        }
        for (const ch of channels) {
            folders.push({
                id: ch.id.toString(),
                name: ch.title,
                type: 'channel',
                username: ch.username || undefined,
            });
        }
        // Cache folders
        cacheFolders(folders.map((f) => ({
            id: f.id,
            name: f.name,
            isSavedMessages: f.type === 'saved',
        })));
        res.json({ folders });
    }
    catch (err) {
        console.error('List folders error:', err);
        res.status(500).json({
            error: { code: 'LIST_FOLDERS_FAILED', message: err.message },
        });
    }
});
// Create folder (private channel)
foldersRouter.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({
                error: { code: 'BAD_REQUEST', message: 'Folder name is required' },
            });
            return;
        }
        const channel = await createChannel(name);
        if (!channel) {
            res.status(500).json({
                error: { code: 'CREATE_FAILED', message: 'Failed to create folder' },
            });
            return;
        }
        res.json({
            folder: {
                id: channel.id.toString(),
                name: channel.title,
                type: 'channel',
            },
        });
    }
    catch (err) {
        console.error('Create folder error:', err);
        res.status(500).json({
            error: { code: 'CREATE_FAILED', message: err.message },
        });
    }
});
// Rename folder
foldersRouter.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) {
            res.status(400).json({
                error: { code: 'BAD_REQUEST', message: 'New name is required' },
            });
            return;
        }
        if (id === 'me') {
            res.status(400).json({
                error: { code: 'BAD_REQUEST', message: 'Cannot rename Saved Messages' },
            });
            return;
        }
        const success = await renameChannel(BigInt(id), name);
        if (!success) {
            res.status(500).json({
                error: { code: 'RENAME_FAILED', message: 'Failed to rename folder' },
            });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        console.error('Rename folder error:', err);
        res.status(500).json({
            error: { code: 'RENAME_FAILED', message: err.message },
        });
    }
});
// Delete folder
foldersRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (id === 'me') {
            res.status(400).json({
                error: { code: 'BAD_REQUEST', message: 'Cannot delete Saved Messages' },
            });
            return;
        }
        const success = await deleteChannel(BigInt(id));
        if (!success) {
            res.status(500).json({
                error: { code: 'DELETE_FAILED', message: 'Failed to delete folder' },
            });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        console.error('Delete folder error:', err);
        res.status(500).json({
            error: { code: 'DELETE_FAILED', message: err.message },
        });
    }
});
// Update folder publicity (Make Public/Private)
foldersRouter.put('/:id/publicity', async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublic, username } = req.body;
        if (id === 'me') {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot modify Saved Messages publicity' } });
            return;
        }
        const success = await updateChannelPublicity(BigInt(id), isPublic, username);
        if (!success) {
            res.status(500).json({ error: { code: 'PUBLICITY_UPDATE_FAILED', message: 'Failed to update folder publicity' } });
            return;
        }
        res.json({ success: true });
    }
    catch (err) {
        console.error('Publicity update error:', err);
        res.status(500).json({ error: { code: 'PUBLICITY_UPDATE_FAILED', message: err.message } });
    }
});
// Get folder invite link
foldersRouter.get('/:id/invite-link', async (req, res) => {
    try {
        const { id } = req.params;
        if (id === 'me') {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Saved Messages does not have an invite link' } });
            return;
        }
        const inviteLink = await getChannelInviteLink(BigInt(id));
        if (!inviteLink) {
            res.status(500).json({ error: { code: 'INVITE_LINK_FAILED', message: 'Failed to retrieve folder invite link' } });
            return;
        }
        res.json({ inviteLink });
    }
    catch (err) {
        console.error('Invite link error:', err);
        res.status(500).json({ error: { code: 'INVITE_LINK_FAILED', message: err.message } });
    }
});
//# sourceMappingURL=folders.js.map