// Helper to save and retrieve individual compliance check results from Firestore

import { collection, doc, setDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import { ComplianceCheckResult } from './orchestrationService';

export interface ComplianceCheckDoc {
  id: string;
  userId: string;
  ruleId: string;
  ruleName: string;
  checkType: 'campaign' | 'content';
  campaignId?: string;
  campaignName?: string;
  contentIds?: string[];
  total: number;
  passed: number;
  failed: number;
  results: ComplianceCheckResult[];
  checkedAt: string;
  createdAt: string;
}

export async function saveComplianceCheck(
  ruleId: string,
  ruleName: string,
  checkType: 'campaign' | 'content',
  options: {
    campaignId?: string;
    campaignName?: string;
    contentIds?: string[];
  },
  results: ComplianceCheckResult[]
): Promise<string> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  // Create a unique document ID
  const docId = `check_${ruleId}_${Date.now()}`;
  const checkRef = doc(collection(db, 'complianceChecks'), docId);

  const checkDoc: Record<string, unknown> = {
    userId,
    ruleId,
    ruleName,
    checkType,
    total: results.length,
    passed,
    failed,
    results,
    checkedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  // Only include optional fields if defined (Firestore rejects undefined values)
  if (options.campaignId !== undefined) checkDoc.campaignId = options.campaignId;
  if (options.campaignName !== undefined) checkDoc.campaignName = options.campaignName;
  if (options.contentIds !== undefined) checkDoc.contentIds = options.contentIds;

  await setDoc(checkRef, checkDoc);
  return docId;
}

export async function getComplianceChecksForRule(
  ruleId: string
): Promise<ComplianceCheckDoc[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const checksRef = collection(db, 'complianceChecks');
  const q = query(
    checksRef,
    where('userId', '==', userId),
    where('ruleId', '==', ruleId),
    orderBy('checkedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ComplianceCheckDoc[];
}

export async function getComplianceChecksForCampaign(
  campaignId: string
): Promise<ComplianceCheckDoc[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const checksRef = collection(db, 'complianceChecks');
  const q = query(
    checksRef,
    where('userId', '==', userId),
    where('campaignId', '==', campaignId),
    orderBy('checkedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ComplianceCheckDoc[];
}

export async function getAllComplianceChecks(): Promise<ComplianceCheckDoc[]> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const checksRef = collection(db, 'complianceChecks');
  const q = query(
    checksRef,
    where('userId', '==', userId),
    orderBy('checkedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ComplianceCheckDoc[];
}

