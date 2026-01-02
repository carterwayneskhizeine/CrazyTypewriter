import { userDocumentModel, UserDocument } from '../models/UserDocument';

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
    // Try to update with version check
    const updated = userDocumentModel.updateWithVersion(userId, content, clientVersion);

    if (updated === null) {
      // Version mismatch - conflict detected
      const current = userDocumentModel.findByUserId(userId);
      return {
        success: false,
        conflict: true,
        serverVersion: current?.version,
        serverContent: current?.content
      };
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
