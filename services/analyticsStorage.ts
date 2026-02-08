// Helper to save and retrieve campaign compliance analytics from Firestore

import { collection, doc, setDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { CampaignAnalysisResult } from './orchestrationService';

export interface AnalyticsDoc {
  id: string;
  userId: string;
  campaignId: string;
  campaignName: string;
  ruleId: string;
  ruleName: string;
  totalContent: number;
  passed: number;
  failed: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  results: any[];
  analyzedAt: string;
  createdAt: string;
}

export async function saveAnalyticsResult(
  result: CampaignAnalysisResult
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Create a unique document ID: campaignId_ruleId_timestamp
  const docId = `${result.campaignId}_${result.ruleId}_${Date.now()}`;
  const analyticsRef = doc(collection(db, 'campaignComplianceAnalytics'), docId);

  await setDoc(analyticsRef, {
    userId,
    ...result,
    createdAt: new Date().toISOString(),
  });
}

export async function getAnalyticsForCampaign(
  campaignId: string
): Promise<AnalyticsDoc[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const analyticsRef = collection(db, 'campaignComplianceAnalytics');
  const q = query(
    analyticsRef,
    where('userId', '==', userId),
    where('campaignId', '==', campaignId),
    orderBy('analyzedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AnalyticsDoc[];
}

export async function getAnalyticsForRule(
  ruleId: string
): Promise<AnalyticsDoc[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const analyticsRef = collection(db, 'campaignComplianceAnalytics');
  const q = query(
    analyticsRef,
    where('userId', '==', userId),
    where('ruleId', '==', ruleId),
    orderBy('analyzedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AnalyticsDoc[];
}

export async function getAllAnalytics(): Promise<AnalyticsDoc[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const analyticsRef = collection(db, 'campaignComplianceAnalytics');
  const q = query(
    analyticsRef,
    where('userId', '==', userId),
    orderBy('analyzedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AnalyticsDoc[];
}

