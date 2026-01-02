import { getDatabase, saveDatabase } from '../config/database';

export interface UserDocument {
  id?: number;
  user_id: number;
  username: string;
  content: string;
  version: number;
  last_modified?: string;
  created_at?: string;
  updated_at?: string;
}

export class UserDocumentModel {
  // Get database instance on demand (not during module load)
  private get db() {
    return getDatabase();
  }

  // Find document by user ID
  findByUserId(userId: number): UserDocument | undefined {
    const results = this.db.exec(`SELECT * FROM user_documents WHERE user_id = ${userId}`);
    if (results.length === 0 || results[0].values.length === 0) {
      return undefined;
    }

    const row = results[0].values[0] as any[];
    return {
      id: row[0] as number,
      user_id: row[1] as number,
      username: row[2] as string,
      content: row[3] as string,
      version: row[4] as number,
      last_modified: row[5] as string,
      created_at: row[6] as string,
      updated_at: row[7] as string
    };
  }

  // Create new document
  create(doc: Omit<UserDocument, 'id' | 'created_at' | 'updated_at' | 'last_modified'>): UserDocument {
    const escapedContent = this.escapeString(doc.content);
    const escapedUsername = this.escapeString(doc.username);

    this.db.exec(`
      INSERT INTO user_documents (user_id, username, content, version)
      VALUES (${doc.user_id}, '${escapedUsername}', '${escapedContent}', ${doc.version})
    `);

    saveDatabase();

    const created = this.findByUserId(doc.user_id);
    if (!created) throw new Error('Failed to create document');
    return created;
  }

  // Update document with version check (optimistic locking)
  updateWithVersion(userId: number, content: string, clientVersion: number): UserDocument | null {
    // Check current version
    const current = this.findByUserId(userId);
    if (!current) return null;

    // Version mismatch - conflict
    if (current.version !== clientVersion) {
      return null; // Indicates conflict
    }

    // Update document
    const escapedContent = this.escapeString(content);
    this.db.exec(`
      UPDATE user_documents
      SET content = '${escapedContent}',
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP,
          last_modified = CURRENT_TIMESTAMP
      WHERE user_id = ${userId} AND version = ${clientVersion}
    `);

    saveDatabase();

    return this.findByUserId(userId) || null;
  }

  // Delete document
  delete(userId: number): boolean {
    this.db.exec(`DELETE FROM user_documents WHERE user_id = ${userId}`);
    saveDatabase();

    // Check if deleted
    const results = this.db.exec(`SELECT changes() as changes`);
    const changes = results[0]?.values[0]?.[0] as number || 0;
    return changes > 0;
  }

  // Get or create document
  getOrCreate(userId: number, username: string): UserDocument {
    let doc = this.findByUserId(userId);
    if (!doc) {
      doc = this.create({
        user_id: userId,
        username,
        content: '',
        version: 1
      });
    }
    return doc;
  }

  // Simple SQL escape function (for demo - use parameterized queries in production)
  private escapeString(str: string): string {
    return str.replace(/'/g, "''");
  }
}

export const userDocumentModel = new UserDocumentModel();
