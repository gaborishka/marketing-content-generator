// Firestore progress writer for job status updates.

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { JobPhase } from "../types/pipeline";

const db = () => getFirestore();

export class ProgressWriter {
  constructor(private readonly jobId: string) {}

  async update(fields: {
    status?: JobPhase;
    progress?: number;
    phase?: string;
    contentIds?: string[];
    itemsCompleted?: number;
    itemsTotal?: number;
    retryCount?: number;
    error?: string;
    completedAt?: FirebaseFirestore.Timestamp;
  }): Promise<void> {
    await db()
      .collection("generationJobs")
      .doc(this.jobId)
      .update({
        ...fields,
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  async setPhase(status: JobPhase, phase: string, progress: number): Promise<void> {
    await this.update({ status, phase, progress });
  }

  async complete(contentIds: string[]): Promise<void> {
    await this.update({
      status: "completed",
      phase: "Done",
      progress: 100,
      contentIds,
      completedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    });
  }

  async fail(error: string): Promise<void> {
    await this.update({
      status: "failed",
      phase: "Failed",
      error,
    });
  }
}
