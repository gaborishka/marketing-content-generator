// Firestore read/write helpers for the agent pipeline.

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  CampaignDoc,
  ProductDoc,
  ComplianceRuleDoc,
  ContentDoc,
  JobStatus,
} from "../types/pipeline";

const db = () => getFirestore();

// ── Reads ──────────────────────────────────────────────────────────────────

export async function getCampaign(campaignId: string): Promise<CampaignDoc | null> {
  const doc = await db().collection("campaigns").doc(campaignId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as CampaignDoc;
}

export async function getProduct(productId: string): Promise<ProductDoc | null> {
  const doc = await db().collection("products").doc(productId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ProductDoc;
}

export async function getProducts(productIds: string[]): Promise<ProductDoc[]> {
  if (productIds.length === 0) return [];
  const results = await Promise.all(productIds.map(getProduct));
  return results.filter((p): p is ProductDoc => p !== null);
}

export async function getComplianceRule(ruleId: string): Promise<ComplianceRuleDoc | null> {
  const doc = await db().collection("complianceRules").doc(ruleId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ComplianceRuleDoc;
}

export async function getContentForCampaign(
  campaignId: string,
  userId: string
): Promise<ContentDoc[]> {
  const snap = await db()
    .collection("content")
    .where("campaignId", "==", campaignId)
    .where("userId", "==", userId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentDoc));
}

// ── Writes ─────────────────────────────────────────────────────────────────

export async function writeContentDoc(content: ContentDoc): Promise<void> {
  await db().collection("content").doc(content.id).set(content);
}

export async function updateContentDoc(
  contentId: string,
  fields: Partial<ContentDoc>
): Promise<void> {
  await db().collection("content").doc(contentId).update(fields);
}

export async function createJobDoc(
  jobId: string,
  data: Omit<JobStatus, "createdAt" | "updatedAt">
): Promise<void> {
  await db()
    .collection("generationJobs")
    .doc(jobId)
    .set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function updateJobDoc(
  jobId: string,
  fields: Partial<JobStatus>
): Promise<void> {
  await db()
    .collection("generationJobs")
    .doc(jobId)
    .update({
      ...fields,
      updatedAt: FieldValue.serverTimestamp(),
    });
}
