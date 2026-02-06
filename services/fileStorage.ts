import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { GeneratedContent } from '../types';

export const isBase64DataUrl = (url: string): boolean => url.startsWith('data:');

export const uploadBase64Image = async (base64: string, storagePath: string): Promise<string> => {
  if (!isBase64DataUrl(base64)) return base64;

  const storage = getStorage();
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, base64, 'data_url');
  return getDownloadURL(storageRef);
};

export const uploadContentImages = async (item: GeneratedContent): Promise<GeneratedContent> => {
  let updated = { ...item };

  // Upload hero image
  if (updated.imageUrl && isBase64DataUrl(updated.imageUrl)) {
    try {
      updated.imageUrl = await uploadBase64Image(
        updated.imageUrl,
        `content/${item.id}/hero.png`
      );
    } catch (e) {
      console.error(`Failed to upload hero image for ${item.id}`, e);
    }
  }

  // Upload storyboard scene images
  if (updated.storyboard) {
    const uploadedScenes = await Promise.all(
      updated.storyboard.map(async (scene, idx) => {
        if (scene.imageUrl && isBase64DataUrl(scene.imageUrl)) {
          try {
            const url = await uploadBase64Image(
              scene.imageUrl,
              `content/${item.id}/scene-${scene.sceneNumber || idx + 1}.png`
            );
            return { ...scene, imageUrl: url };
          } catch (e) {
            console.error(`Failed to upload scene ${idx + 1} image for ${item.id}`, e);
            return scene;
          }
        }
        return scene;
      })
    );
    updated = { ...updated, storyboard: uploadedScenes };
  }

  return updated;
};
