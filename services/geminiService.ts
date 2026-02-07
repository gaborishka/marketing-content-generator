
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { Product, Scene } from "../types";

const generateImageFn = httpsCallable<any, { mimeType: string; data: string }>(functions, 'generateImage');
const generateVideoFn = httpsCallable<any, { videoUrl: string }>(functions, 'generateVideo');

// Build a reference image entry for the Cloud Function.
// Base64 data URLs are parsed client-side; plain URLs are passed through
// for the Cloud Function to fetch server-side (avoids server→client→server round-trip).
const createReferenceImage = (imageData: string) => {
  if (imageData.startsWith('data:')) {
    const mimeMatch = imageData.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const data = imageData.replace(/^data:image\/\w+;base64,/, "");
    return {
      image: { imageBytes: data, mimeType },
      referenceType: 'ASSET' as const,
    };
  }
  // URL — let the Cloud Function resolve it
  return { imageUrl: imageData, referenceType: 'ASSET' as const };
};

export const generateImage = async (product: Product | undefined, contextText: string): Promise<string> => {
  let prompt = '';

  if (product) {
    prompt = `
      Create a high-quality, photorealistic product marketing image.
      Product: ${product.name}
      Brand: ${product.brand}
      Description: ${product.description}
      Context/Scene: ${contextText}
      Style: Professional, commercial photography, 4k resolution, cinematic lighting.
      Ensure the product is the focal point.
    `;
  } else {
     prompt = `
      Create a high-quality, photorealistic marketing concept image.
      Theme/Context: ${contextText}
      Style: Professional, commercial photography, 4k resolution, cinematic lighting.
      Abstract or lifestyle representation of the concept.
    `;
  }

  try {
    const result = await generateImageFn({ prompt });
    const { mimeType, data } = result.data;
    return `data:${mimeType};base64,${data}`;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/400`;
  }
};

export const generateVideoFromStoryboard = async (storyboard: Scene[], contentId: string): Promise<string> => {
  const validScenes = storyboard.filter(s => s.imageUrl);

  if (validScenes.length === 0) {
    throw new Error("No images available in storyboard to generate video.");
  }

  // Prepare reference images (up to 3). URLs are resolved server-side.
  const referenceImages = validScenes.slice(0, 3).map(s => createReferenceImage(s.imageUrl!));

  try {
    const result = await generateVideoFn({
      referenceImages,
      contentId,
      prompt: "A cinematic commercial video. Smooth transitions between scenes. High quality, 4k.",
    });

    return result.data.videoUrl;
  } catch (error) {
    console.error("Video Generation Error:", error);
    throw error;
  }
};

