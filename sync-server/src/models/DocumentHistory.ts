import { getDatabase, saveDatabase } from '../config/database';

export interface DocumentHistory {
  id?: number;
  user_id: number;
  username: string;
  content: string;
  version: number;
  created_at?: string;
}

const MAX_HISTORY_SIZE = 50; // Keep only last 50 versions

export class DocumentHistoryModel {
  // Get database instance on demand (not during module load)
  private get db() {
    return getDatabase();
  }

  // Get current timestamp in ISO format (local time)
  private getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  // Save a snapshot to history
  saveHistory(userId: number, username: string, content: string, version: number): void {
    const escapedContent = this.escapeString(content);
    const escapedUsername = this.escapeString(username);
    const now = this.getCurrentTimestamp();

    this.db.exec(`
      INSERT INTO document_history (user_id, username, content, version, created_at)
      VALUES (${userId}, '${escapedUsername}', '${escapedContent}', ${version}, '${now}')
    `);

    // Clean up old history (keep only MAX_HISTORY_SIZE most recent)
    this.cleanupOldHistory(userId);

    saveDatabase();
  }

  // Get all history entries for a user (most recent first)
  getHistory(userId: number): DocumentHistory[] {
    const results = this.db.exec(`
      SELECT * FROM document_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${MAX_HISTORY_SIZE}
    `);

    if (results.length === 0 || results[0].values.length === 0) {
      return [];
    }

    return results[0].values.map((row: any[]) => ({
      id: row[0] as number,
      user_id: row[1] as number,
      username: row[2] as string,
      content: row[3] as string,
      version: row[4] as number,
      created_at: row[5] as string
    }));
  }

  // Get the most recent history entry (for undo)
  getLastHistory(userId: number): DocumentHistory | null {
    const history = this.getHistory(userId);
    return history.length > 0 ? history[0] : null;
  }

  // Delete history for a user
  clearHistory(userId: number): void {
    this.db.exec(`DELETE FROM document_history WHERE user_id = ${userId}`);
    saveDatabase();
  }

  // Keep only the most recent MAX_HISTORY_SIZE entries
  private cleanupOldHistory(userId: number): void {
    this.db.exec(`
      DELETE FROM document_history
      WHERE user_id = ${userId}
      AND id NOT IN (
        SELECT id FROM document_history
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${MAX_HISTORY_SIZE}
      )
    `);
  }

  // Simple SQL escape function
  private escapeString(str: string): string {
    return str.replace(/'/g, "''");
  }
}

export const documentHistoryModel = new DocumentHistoryModel();
