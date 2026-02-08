// Helper to update content documents in Firestore

import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { GeneratedContent } from '../types';

export async function updateContentDoc(
  contentId: string,
  fields: Partial<GeneratedContent>
): Promise<void> {
  const contentRef = doc(db, 'content', contentId);
  await updateDoc(contentRef, fields as any);
}

