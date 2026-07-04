import { Router } from 'express';
import crypto from 'crypto';
import { createGroup, getGroups, deleteGroup, updateFolderGroup } from '../db.js';

export const groupsRouter = Router();

// GET all groups
groupsRouter.get('/', (req, res) => {
  try {
    const list = getGroups();
    res.json({ success: true, groups: list });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: err.message } });
  }
});

// CREATE group
groupsRouter.post('/', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !color) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Name and color are required' } });
      return;
    }

    const groupId = crypto.randomBytes(8).toString('hex');
    createGroup(groupId, name, color);

    res.json({
      success: true,
      group: { id: groupId, name, color }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: err.message } });
  }
});

// DELETE group
groupsRouter.delete('/:groupId', (req, res) => {
  try {
    const { groupId } = req.params;
    deleteGroup(groupId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: err.message } });
  }
});

// ASSIGN folder to group
groupsRouter.post('/folders/:folderId', (req, res) => {
  try {
    const { folderId } = req.params;
    const { groupId } = req.body; // can be null to unassign

    updateFolderGroup(folderId, groupId || null);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: err.message } });
  }
});
