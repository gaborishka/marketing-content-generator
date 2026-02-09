// Firestore read/write helpers for the agent pipeline.

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  CampaignDoc,
  ProductDoc,
  ComplianceRuleDoc,
  ContentDoc,
  JobStatus,
  ShopifyConnectionDoc,
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

const ACTIVE_STATUSES = ["pending", "planning", "generating", "compliance_check", "retrying", "generating_images"];

/**
 * Atomically checks for active jobs and creates a new one using a
 * deterministic lock document to prevent phantom-read races.
 *
 * Firestore transactions with queries that return empty results don't lock
 * any documents, so two concurrent transactions could both see "no active
 * jobs" and both create one.  Instead, we use a deterministic lock document
 * at `generationJobLocks/{campaignId}_{userId}` — both transactions read
 * the same doc ref, giving Firestore a concrete document to enforce
 * serializable isolation on.
 *
 * Throws if an active job already exists for this campaign+user.
 */
export async function createJobIfNoActive(
  jobId: string,
  data: Omit<JobStatus, "createdAt" | "updatedAt">
): Promise<void> {
  const lockDocId = `${data.campaignId}_${data.userId}`;
  const lockRef = db().collection("generationJobLocks").doc(lockDocId);
  const jobRef = db().collection("generationJobs").doc(jobId);

  await db().runTransaction(async (tx) => {
    const lockSnap = await tx.get(lockRef);

    if (lockSnap.exists) {
      const lockData = lockSnap.data();
      if (lockData?.activeJobId) {
        // Verify the referenced job is actually still active
        const jobSnap = await tx.get(
          db().collection("generationJobs").doc(lockData.activeJobId)
        );
        if (jobSnap.exists) {
          const jobStatus = jobSnap.data()?.status;
          if (ACTIVE_STATUSES.includes(jobStatus)) {
            throw new Error("ACTIVE_JOB_EXISTS");
          }
        }
        // Referenced job is gone or terminal — lock is stale, proceed
      }
    }

    // Write lock and job atomically
    tx.set(lockRef, {
      activeJobId: jobId,
      campaignId: data.campaignId,
      userId: data.userId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(jobRef, {
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Clears the active-job lock for a campaign+user, but ONLY if the lock
 * still belongs to the given jobId.  This prevents a finishing job from
 * accidentally clearing a lock that a newer job has already claimed.
 */
export async function clearJobLock(
  campaignId: string,
  userId: string,
  jobId: string
): Promise<void> {
  const lockDocId = `${campaignId}_${userId}`;
  const lockRef = db().collection("generationJobLocks").doc(lockDocId);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    if (!snap.exists) return;

    const data = snap.data();
    // Only clear if this job still owns the lock
    if (data?.activeJobId !== jobId) return;

    tx.set(lockRef, {
      activeJobId: null,
      campaignId,
      userId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
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

// ── Shopify helpers ─────────────────────────────────────────────────────

export async function getShopifyConnection(
  userId: string
): Promise<ShopifyConnectionDoc | null> {
  const doc = await db().collection("shopifyConnections").doc(userId).get();
  if (!doc.exists) return null;
  return doc.data() as ShopifyConnectionDoc;
}

export async function setShopifyConnection(
  userId: string,
  data: ShopifyConnectionDoc
): Promise<void> {
  await db().collection("shopifyConnections").doc(userId).set(data);
}

export async function deleteShopifyConnection(userId: string): Promise<void> {
  await db().collection("shopifyConnections").doc(userId).delete();
}

export async function getShopifyProducts(
  userId: string
): Promise<ProductDoc[]> {
  const snap = await db()
    .collection("products")
    .where("userId", "==", userId)
    .where("source", "==", "shopify")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductDoc));
}

export async function setProductDoc(product: ProductDoc): Promise<void> {
  await db().collection("products").doc(product.id).set(product);
}

export async function deleteProductDoc(productId: string): Promise<void> {
  await db().collection("products").doc(productId).delete();
}
