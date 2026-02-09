// Helper functions to read from Firestore (frontend)
// Used for compliance checking and analysis

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { GeneratedContent } from '../types';

export async function getContentForCampaign(
  campaignId: string
): Promise<GeneratedContent[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const contentRef = collection(db, 'content');
  const q = query(
    contentRef,
    where('campaignId', '==', campaignId),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GeneratedContent[];
}

export async function getContentByIds(
  contentIds: string[]
): Promise<GeneratedContent[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const contentRef = collection(db, 'content');
  const results: GeneratedContent[] = [];

  // Fetch documents individually and verify userId
  for (const contentId of contentIds) {
    try {
      const docRef = doc(contentRef, contentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.userId === userId) {
          results.push({
            id: docSnap.id,
            ...data,
          } as GeneratedContent);
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch content ${contentId}:`, error);
    }
  }

  return results;
}

