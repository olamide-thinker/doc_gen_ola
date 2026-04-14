import { db } from './index';
import * as schema from './schema';
import { eq, sql } from 'drizzle-orm';

// Helper to get table from name
const getTable = (collectionName: string) => {
  const table = (schema as any)[collectionName];
  if (!table) throw new Error(`Table ${collectionName} not found in schema`);
  return table;
};

export const dbUtil = {
  /**
   * Fetch a single document by ID
   */
  fetchOne: async (collectionName: string, id: string): Promise<any | null> => {
    try {
      const table = getTable(collectionName);
      const result = await db.select().from(table).where(eq(table.id, id)).limit(1);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error(`Error in dbUtil.fetchOne for ${collectionName}/${id}:`, error);
      throw error;
    }
  },

  /**
   * Fetch multiple documents from a collection
   */
  fetchAll: async (params: {
    collectionName: string,
    sort?: string,
    limit?: number,
    offset?: number
  }): Promise<any[]> => {
    try {
      const table = getTable(params.collectionName);
      let query = db.select().from(table);

      // Simple implementation for sort, limit, offset
      // Note: sort is hardcoded to desc for now if provided
      const finalQuery = (params.limit ? (params.offset ? query.limit(params.limit).offset(params.offset) : query.limit(params.limit)) : query);
      
      return await finalQuery;
    } catch (error) {
      console.error(`Error in dbUtil.fetchAll for ${params.collectionName}:`, error);
      throw error;
    }
  },

  /**
   * Save or Update a single document (Upsert)
   */
  saveOne: async (collectionName: string, id: string, payload: any): Promise<void> => {
    try {
      const table = getTable(collectionName);
      const values = { id, ...payload };
      
      // Upsert logic for Drizzle
      await db.insert(table)
        .values(values)
        .onConflictDoUpdate({
          target: table.id,
          set: payload
        });
    } catch (error) {
      console.error(`Error in dbUtil.saveOne for ${collectionName}/${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a single document
   */
  deleteOne: async (collectionName: string, id: string): Promise<void> => {
    try {
      const table = getTable(collectionName);
      await db.delete(table).where(eq(table.id, id));
    } catch (error) {
      console.error(`Error in dbUtil.deleteOne for ${collectionName}/${id}:`, error);
      throw error;
    }
  }
};
