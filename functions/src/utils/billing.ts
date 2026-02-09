// Billing and user profile utilities for quota management and Stripe integration.

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { UserProfileDoc, DailyUsageDoc, UserTier, TIER_LIMITS } from "../types/pipeline";

export const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const db = () => getFirestore();

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── User Profile ──────────────────────────────────────────────────────────

export async function getOrCreateUserProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfileDoc> {
  const ref = db().collection("users").doc(uid);

  // Try atomic create first — fails if doc already exists, preventing
  // race conditions that could overwrite concurrent tier updates.
  try {
    const now = FieldValue.serverTimestamp();
    await ref.create({
      uid,
      email,
      displayName,
      tier: "free" as UserTier,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: any) {
    if (err.code !== 6 /* ALREADY_EXISTS */) {
      throw err;
    }
    // Document already exists — fall through to read
  }

  const snap = await ref.get();
  return snap.data() as UserProfileDoc;
}

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const snap = await db().collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() as UserProfileDoc;
}

export async function updateUserProfile(
  uid: string,
  fields: Partial<Omit<UserProfileDoc, "uid" | "createdAt">>
): Promise<void> {
  await db()
    .collection("users")
    .doc(uid)
    .update({
      ...fields,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

// ── Daily Usage ───────────────────────────────────────────────────────────

export async function getDailyUsage(uid: string): Promise<DailyUsageDoc | null> {
  const date = todayDateString();
  const snap = await db().collection("users").doc(uid).collection("usage").doc(date).get();
  if (!snap.exists) return null;
  return snap.data() as DailyUsageDoc;
}

// Non-transactional increment — used only for testing.
// Production code should use checkAndIncrementQuota() instead.
export async function incrementUsage(uid: string): Promise<number> {
  const date = todayDateString();
  const ref = db().collection("users").doc(uid).collection("usage").doc(date);

  await ref.set(
    {
      uid,
      date,
      generationCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Read back the current count
  const snap = await ref.get();
  return (snap.data() as DailyUsageDoc).generationCount;
}

// ── Quota Check ───────────────────────────────────────────────────────────

export interface QuotaResult {
  allowed: boolean;
  current: number;
  limit: number;
  tier: UserTier;
}

// Non-transactional quota check — used only for testing.
// Production code should use checkAndIncrementQuota() instead.
export async function checkQuota(uid: string): Promise<QuotaResult> {
  const profile = await getUserProfile(uid);
  const tier: UserTier = profile?.tier ?? "free";
  const limit = TIER_LIMITS[tier];

  const usage = await getDailyUsage(uid);
  const current = usage?.generationCount ?? 0;

  return {
    allowed: current < limit,
    current,
    limit,
    tier,
  };
}

// ── Atomic Quota Check + Increment ────────────────────────────────────────
// Uses a Firestore transaction to atomically read the usage count, verify
// the quota, and increment — preventing concurrent requests from exceeding
// the daily limit.

export async function checkAndIncrementQuota(uid: string): Promise<QuotaResult> {
  const firestore = db();
  const profileRef = firestore.collection("users").doc(uid);
  const date = todayDateString();
  const usageRef = profileRef.collection("usage").doc(date);

  return firestore.runTransaction(async (tx) => {
    const profileSnap = await tx.get(profileRef);
    const tier: UserTier = (profileSnap.data()?.tier as UserTier) ?? "free";
    const limit = TIER_LIMITS[tier];

    const usageSnap = await tx.get(usageRef);
    const current = (usageSnap.data() as DailyUsageDoc | undefined)?.generationCount ?? 0;

    if (current >= limit) {
      return { allowed: false, current, limit, tier };
    }

    // Increment within the same transaction
    if (usageSnap.exists) {
      tx.update(usageRef, {
        generationCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(usageRef, {
        uid,
        date,
        generationCount: 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { allowed: true, current: current + 1, limit, tier };
  });
}

// ── Stripe Customer Lookup ────────────────────────────────────────────────

export async function findUidByCustomerId(customerId: string): Promise<string | null> {
  const snap = await db()
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].id;
}
