// Service for tracking content change history
import { collection, doc, setDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { GeneratedContent } from '../types';

export type ChangeType = 'generated' | 'pasted' | 'imported' | 'ai_modified' | 'manual_edit' | 'deleted' | 'moved';

export interface ContentChange {
  id: string;
  contentId: string;
  campaignId: string;
  userId: string;
  changeType: ChangeType;
  timestamp: Date;
  previousVersion?: GeneratedContent;
  newVersion: GeneratedContent;
  description: string;
  metadata?: {
    aiPrompt?: string;
    source?: string;
    position?: { x: number; y: number };
  };
}

export interface ContentHistory {
  contentId: string;
  changes: ContentChange[];
}

// Save a change to history
export async function saveContentChange(change: Omit<ContentChange, 'id' | 'timestamp' | 'userId'>): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const changeId = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const changeDoc: ContentChange = {
    ...change,
    id: changeId,
    userId,
    timestamp: new Date(),
  };

  await setDoc(doc(db, 'contentHistory', changeId), {
    contentId: changeDoc.contentId,
    campaignId: changeDoc.campaignId,
    userId: changeDoc.userId,
    changeType: changeDoc.changeType,
    timestamp: changeDoc.timestamp.toISOString(),
    previousVersion: changeDoc.previousVersion ? JSON.stringify(changeDoc.previousVersion) : null,
    newVersion: JSON.stringify(changeDoc.newVersion),
    description: changeDoc.description,
    metadata: changeDoc.metadata ? JSON.stringify(changeDoc.metadata) : null,
  });
}

// Get history for a specific content item
export async function getContentHistory(contentId: string): Promise<ContentChange[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const q = query(
    collection(db, 'contentHistory'),
    where('contentId', '==', contentId),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(100)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      contentId: data.contentId,
      campaignId: data.campaignId,
      userId: data.userId,
      changeType: data.changeType,
      timestamp: new Date(data.timestamp),
      previousVersion: data.previousVersion ? JSON.parse(data.previousVersion) : undefined,
      newVersion: JSON.parse(data.newVersion),
      description: data.description,
      metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
    } as ContentChange;
  });
}

// Get history for all content in a campaign
export async function getCampaignHistory(campaignId: string): Promise<ContentChange[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const q = query(
    collection(db, 'contentHistory'),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(500)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      contentId: data.contentId,
      campaignId: data.campaignId,
      userId: data.userId,
      changeType: data.changeType,
      timestamp: new Date(data.timestamp),
      previousVersion: data.previousVersion ? JSON.parse(data.previousVersion) : undefined,
      newVersion: JSON.parse(data.newVersion),
      description: data.description,
      metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
    } as ContentChange;
  });
}

// Group history by content item
export function groupHistoryByContent(changes: ContentChange[]): Map<string, ContentChange[]> {
  const grouped = new Map<string, ContentChange[]>();
  
  changes.forEach(change => {
    if (!grouped.has(change.contentId)) {
      grouped.set(change.contentId, []);
    }
    grouped.get(change.contentId)!.push(change);
  });

  // Sort each group by timestamp (newest first)
  grouped.forEach((changes, contentId) => {
    changes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  });

  return grouped;
}

