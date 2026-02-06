
import { httpsCallable } from 'firebase/functions';
import { Type } from '@google/genai';
import { functions } from './firebase';
import { Product, Campaign, GeneratedContent, Scene, ComplianceRule } from "../types";

const generateContentFn = httpsCallable<any, { text: string }>(functions, 'generateContent');
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

export const generateMarketingContent = async (
  campaign: Campaign,
  allProducts: Product[],
  complianceRule?: ComplianceRule,
  onImageUpdate?: (updatedContent: GeneratedContent) => void
): Promise<GeneratedContent[]> => {

  // Resolve Products
  const primaryProduct = allProducts.find(p => p.id === campaign.primaryProductId);
  const secondaryProducts = allProducts.filter(p => campaign.secondaryProductIds.includes(p.id));

  // Construct Context String
  let productContext = '';
  if (primaryProduct) {
    productContext += `Primary Product: ${primaryProduct.name} (${primaryProduct.brand}) - ${primaryProduct.description}. \n`;
  } else {
    productContext += `Type: Brand/Idea Campaign (No specific primary product). \n`;
  }

  if (secondaryProducts.length > 0) {
    productContext += `Secondary Products to mention: ${secondaryProducts.map(p => p.name).join(', ')}. \n`;
  }

  let complianceBlock = '';
  if (complianceRule) {
    complianceBlock = `
    COMPLIANCE RULES (MANDATORY):
    Rule Name: ${complianceRule.name}
    Rule Description: ${complianceRule.description}
    Full Rule Text: ${complianceRule.ruleText}

    You MUST evaluate all generated content against these compliance rules. Reflect adherence in the complianceScore field.
    `;
  }

  // Build channel × audience combinations (channels are already sub-format names)
  const combinations: { channel: string; audience: string }[] = [];
  for (const channel of campaign.channels) {
    for (const audience of campaign.targetAudiences) {
      combinations.push({ channel, audience });
    }
  }
  const cappedCombinations = combinations.slice(0, 6);

  const combinationList = cappedCombinations.map((c, i) =>
    `${i + 1}. Channel: "${c.channel}", Audience: "${c.audience}"`
  ).join('\n    ');

  const prompt = `
    You are an expert marketing copywriter.

    ${productContext}
    ${complianceBlock}
    Campaign Context: ${campaign.context}
    ${campaign.attachments.length > 0 ? `Attached Documents (Reference only): ${campaign.attachments.join(', ')}` : ''}

    Campaign Goal: ${campaign.description}
    Key Message: ${campaign.keyMessage}

    Task: Generate exactly ${cappedCombinations.length} marketing content items for these combinations:
    ${combinationList}

    IMPORTANT: The "channel" field in your output must EXACTLY match the channel names listed above.

    IMPORTANT for 'Video Storyboard' channel:
    - Instead of simple text, generate a 'storyboard' array with exactly 3 scenes.
    - Each scene must have: sceneNumber, imagePrompt (visual description), voiceover (script).
    - The top-level 'text' field should correspond to the full voiceover script.

    Return JSON array.
  `;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        channel: { type: Type.STRING },
        audience: { type: Type.STRING },
        text: { type: Type.STRING },
        complianceScore: { type: Type.NUMBER },
        riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
        storyboard: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER },
              imagePrompt: { type: Type.STRING },
              voiceover: { type: Type.STRING }
            }
          }
        }
      },
      required: ["channel", "audience", "text", "complianceScore", "riskLevel"]
    }
  };

  try {
    const result = await generateContentFn({ prompt, responseSchema });
    const cleanText = (result.data.text || "[]").replace(/```json\n?|```/g, '').trim();

    let rawData: any[] = [];
    try {
      rawData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("JSON Parse Error on GenAI response:", parseError);
      return mockGeneration(campaign, allProducts);
    }

    if (!Array.isArray(rawData)) {
      return mockGeneration(campaign, allProducts);
    }

    const initialContent: GeneratedContent[] = rawData.map((item: any, index: number) => {
      let storyboard: Scene[] | undefined = undefined;
      if (item.channel === 'Video Storyboard' && item.storyboard) {
        storyboard = item.storyboard.map((scene: any) => ({
          ...scene,
          imageUrl: ''
        }));
      }

      return {
        id: `gen-${Date.now()}-${index}`,
        campaignId: campaign.id,
        channel: item.channel,
        audience: item.audience,
        text: item.text,
        complianceScore: item.complianceScore,
        riskLevel: item.riskLevel,
        status: 'draft',
        imageUrl: '',
        storyboard: storyboard,
        x: 0,
        y: 0
      };
    });

    // Start Async Image Generation
    (async () => {
      for (const contentItem of initialContent) {
        try {
          if (contentItem.channel === 'Video Storyboard' && contentItem.storyboard) {
            const updatedStoryboard = [...contentItem.storyboard];
            await Promise.all(updatedStoryboard.map(async (scene, idx) => {
              try {
                // Pass primary product if available, otherwise just use prompt text
                const img = await generateImage(primaryProduct, scene.imagePrompt);
                updatedStoryboard[idx] = { ...updatedStoryboard[idx], imageUrl: img };

                if (onImageUpdate) {
                  onImageUpdate({
                    ...contentItem,
                    storyboard: [...updatedStoryboard]
                  });
                }
              } catch (e) {
                console.error(`Error generating scene ${idx} image`, e);
              }
            }));

          } else {
            const img = await generateImage(primaryProduct, contentItem.text);
            if (onImageUpdate) {
              onImageUpdate({ ...contentItem, imageUrl: img });
            }
          }
        } catch (e) {
          console.error("Background image generation error", e);
        }
      }
    })();

    return initialContent;

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return mockGeneration(campaign, allProducts);
  }
};

const mockGeneration = (campaign: Campaign, allProducts: Product[]): GeneratedContent[] => {
  const generated: GeneratedContent[] = [];
  let count = 0;
  const maxItems = 6;
  const primary = allProducts.find(p => p.id === campaign.primaryProductId);

  for (const channel of campaign.channels) {
    for (const audience of campaign.targetAudiences) {
      if (count >= maxItems) break;
      count++;
      generated.push({
        id: `mock-${Date.now()}-${count}`,
        campaignId: campaign.id,
        channel,
        audience,
        text: `Mock content for ${primary ? primary.name : 'Brand Idea'} - ${campaign.context}`,
        complianceScore: 90,
        riskLevel: 'low',
        status: 'draft',
        imageUrl: `https://picsum.photos/seed/${count}/800/400`,
        x: 0, y: 0
      });
    }
  }
  return generated;
};
