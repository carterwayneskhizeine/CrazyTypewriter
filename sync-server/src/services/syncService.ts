import { userDocumentModel, UserDocument } from '../models/UserDocument';
import { documentHistoryModel } from '../models/DocumentHistory';
import { saveDatabase as saveDb } from '../config/database';

export interface SyncResult {
  success: boolean;
  document?: UserDocument;
  conflict?: boolean;
  serverVersion?: number;
  serverContent?: string;
}

export function updateDocument(
  userId: number,
  username: string,
  content: string,
  clientVersion: number
): SyncResult {
  try {
    // Get current document before updating (for history)
    const current = userDocumentModel.findByUserId(userId);

    // Try to update with version check
    const updated = userDocumentModel.updateWithVersion(userId, content, clientVersion);

    if (updated === null) {
      // Version mismatch - conflict detected
      return {
        success: false,
        conflict: true,
        serverVersion: current?.version,
        serverContent: current?.content
      };
    }

    // Save snapshot to history (before the update)
    if (current) {
      documentHistoryModel.saveHistory(userId, username, current.content, current.version);
    }

    return {
      success: true,
      document: updated
    };
  } catch (error) {
    console.error('Error updating document:', error);
    return {
      success: false,
      conflict: false
    };
  }
}

export function getDocument(userId: number, username: string): UserDocument {
  return userDocumentModel.getOrCreate(userId, username);
}

export function deleteDocument(userId: number): boolean {
  return userDocumentModel.delete(userId);
}

export function undoDocument(userId: number, username: string): { success: boolean; document?: UserDocument; message?: string } {
  try {
    // Get the most recent history entry
    const lastHistory = documentHistoryModel.getLastHistory(userId);

    if (!lastHistory) {
      return {
        success: false,
        message: 'No history available to undo'
      };
    }

    // Force update document with the historical content (no version check)
    const updated = userDocumentModel.forceUpdate(userId, lastHistory.content, true);

    if (updated === null) {
      return {
        success: false,
        message: 'Failed to undo: document not found'
      };
    }

    // Remove the used history entry
    const db = userDocumentModel['db']; // Access the database through the model
    db.exec(`DELETE FROM document_history WHERE id = ${lastHistory.id}`);
    saveDb();

    return {
      success: true,
      document: updated
    };
  } catch (error) {
    console.error('Error undoing document:', error);
    return {
      success: false,
      message: 'Failed to undo document'
    };
  }
}
