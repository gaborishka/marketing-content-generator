// Firebase Storage upload helpers for the agent pipeline.
// Extracted from functions/src/index.ts:236-251

import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

export async function uploadImageToStorage(
  userId: string,
  contentId: string,
  imageData: Buffer,
  mimeType: string,
  filename: string = "hero.png"
): Promise<UploadResult> {
  const filePath = `users/${userId}/content/${contentId}/${filename}`;
  const bucket = getStorage().bucket();
  const file = bucket.file(filePath);
  const downloadToken = randomUUID();

  await file.save(imageData, {
    metadata: {
      contentType: mimeType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  const encodedPath = encodeURIComponent(filePath);
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

  return { downloadUrl, storagePath: filePath };
}
