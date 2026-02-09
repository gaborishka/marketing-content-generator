// Firebase Storage upload helpers for the agent pipeline.
// Extracted from functions/src/index.ts:236-251

import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

// Check if we're using the Storage emulator
const isUsingEmulator = (): boolean => {
  return !!process.env.STORAGE_EMULATOR_HOST || !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
};

const getStorageEmulatorHost = (): string => {
  return process.env.STORAGE_EMULATOR_HOST || 
         process.env.FIREBASE_STORAGE_EMULATOR_HOST || 
         '127.0.0.1:9199';
};

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
  
  // Use emulator URL if running in emulator mode, otherwise use production URL
  let downloadUrl: string;
  if (isUsingEmulator()) {
    const emulatorHost = getStorageEmulatorHost();
    downloadUrl = `http://${emulatorHost}/${bucket.name}/${encodedPath}?alt=media&token=${downloadToken}`;
  } else {
    downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
  }

  return { downloadUrl, storagePath: filePath };
}
