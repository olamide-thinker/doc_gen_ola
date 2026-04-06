import { getFirestore } from '../config/firebase';

// This is our central data abstraction layer.
// Right now it wraps Firebase, but later it can wrap Postgres, MongoDB, etc.
// The rest of the application ONLY talks to dbUtil.

export const dbUtil = {
  /**
   * Fetch a single document by ID
   */
  fetchOne: async (collectionName: string, id: string): Promise<any | null> => {
    try {
      // Mocked out version for now to prevent crashes before Firebase is ready
      console.log(`[dbUtil.fetchOne] Fetching ${collectionName}/${id}`);
      return null;

      /*
      const db = getFirestore();
      const doc = await db.collection(collectionName).doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
      */
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
      console.log(`[dbUtil.fetchAll] Fetching ${params.collectionName}`);
      return [];

      /*
      const db = getFirestore();
      let query: FirebaseFirestore.Query = db.collection(params.collectionName);
      
      if (params.sort) query = query.orderBy(params.sort);
      if (params.limit) query = query.limit(params.limit);
      if (params.offset) query = query.offset(params.offset);

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      */
    } catch (error) {
      console.error(`Error in dbUtil.fetchAll for ${params.collectionName}:`, error);
      throw error;
    }
  },

  /**
   * Save or Update a single document
   */
  saveOne: async (collectionName: string, id: string, payload: any): Promise<void> => {
    try {
      console.log(`[dbUtil.saveOne] Saving to ${collectionName}/${id}`);
      
      /*
      const db = getFirestore();
      await db.collection(collectionName).doc(id).set(payload, { merge: true });
      */
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
      console.log(`[dbUtil.deleteOne] Deleting ${collectionName}/${id}`);
      
      /*
      const db = getFirestore();
      await db.collection(collectionName).doc(id).delete();
      */
    } catch (error) {
      console.error(`Error in dbUtil.deleteOne for ${collectionName}/${id}:`, error);
      throw error;
    }
  }
};
