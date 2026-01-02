import { Router, Request, Response } from 'express';
import { validateSession } from '../middleware/authMiddleware';
import { getDocument, updateDocument, deleteDocument as deleteDoc } from '../services/syncService';

const router = Router();

// Get user's document
router.get('/', validateSession, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const doc = getDocument(user.id, user.username);

    res.json({
      content: doc.content,
      version: doc.version,
      lastModified: doc.last_modified,
      createdAt: doc.created_at
    });
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

// Update user's document
router.put('/', validateSession, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { content, version } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    if (typeof version !== 'number') {
      return res.status(400).json({ error: 'Version must be a number' });
    }

    const result = updateDocument(user.id, user.username, content, version);

    if (result.success && result.document) {
      res.json({
        content: result.document.content,
        version: result.document.version,
        lastModified: result.document.last_modified
      });
    } else if (result.conflict) {
      res.status(409).json({
        error: 'Version conflict',
        serverVersion: result.serverVersion,
        serverContent: result.serverContent
      });
    } else {
      res.status(500).json({ error: 'Failed to update document' });
    }
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete user's document
router.delete('/', validateSession, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const success = deleteDoc(user.id);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
