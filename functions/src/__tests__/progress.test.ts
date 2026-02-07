import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: mockCollection }),
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
  },
}));

import { ProgressWriter } from "../utils/progress";

describe("ProgressWriter", () => {
  const JOB_ID = "test-job-123";
  let writer: ProgressWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    writer = new ProgressWriter(JOB_ID);
  });

  it("update writes to the correct job document", async () => {
    await writer.update({ status: "generating", progress: 30 });

    expect(mockCollection).toHaveBeenCalledWith("generationJobs");
    expect(mockDoc).toHaveBeenCalledWith(JOB_ID);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "generating",
      progress: 30,
      updatedAt: "SERVER_TIMESTAMP",
    });
  });

  it("setPhase updates status, phase, and progress", async () => {
    await writer.setPhase("planning", "Gathering context...", 10);

    expect(mockUpdate).toHaveBeenCalledWith({
      status: "planning",
      phase: "Gathering context...",
      progress: 10,
      updatedAt: "SERVER_TIMESTAMP",
    });
  });

  it("complete sets status to completed with content IDs", async () => {
    await writer.complete(["c1", "c2"]);

    expect(mockUpdate).toHaveBeenCalledWith({
      status: "completed",
      phase: "Done",
      progress: 100,
      contentIds: ["c1", "c2"],
      completedAt: "SERVER_TIMESTAMP",
      updatedAt: "SERVER_TIMESTAMP",
    });
  });

  it("fail sets status to failed with error message", async () => {
    await writer.fail("Gemini API timeout");

    expect(mockUpdate).toHaveBeenCalledWith({
      status: "failed",
      phase: "Failed",
      error: "Gemini API timeout",
      updatedAt: "SERVER_TIMESTAMP",
    });
  });
});
