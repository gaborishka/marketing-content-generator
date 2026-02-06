
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Campaign, GeneratedContent, Scene } from "../types";

const MARKETING_MODEL = "gemini-3-flash-preview";
const IMAGE_MODEL = "gemini-3-pro-image-preview";
const VIDEO_MODEL = "veo-3.1-generate-preview";

// Helper to get client with current key
const getAiClient = () => {
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
}

// Helper to convert base64 to video reference object
const createReferenceImage = (base64Data: string) => {
  if (!base64Data.startsWith('data:')) {
    throw new Error("Invalid image format. Real generated images are required for video creation.");
  }

  // Extract real mime type from data URL
  const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  // Strip prefix
  const data = base64Data.replace(/^data:image\/\w+;base64,/, "");
  
  return {
    image: {
      imageBytes: data,
      mimeType: mimeType,
    },
    referenceType: 'ASSET' as const
  };
};

export const generateImage = async (product: Product | undefined, contextText: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return `https://picsum.photos/seed/${Date.now()}/800/400`;

  const ai = getAiClient();

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
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/400`;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/400`;
  }
};

export const generateVideoFromStoryboard = async (storyboard: Scene[]): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key required for video generation");

  const ai = getAiClient();
  const validScenes = storyboard.filter(s => s.imageUrl);
  
  if (validScenes.length === 0) {
    throw new Error("No images available in storyboard to generate video.");
  }

  // Prepare reference images (Up to 3)
  // Ensure we only use valid base64 images
  let referenceImages;
  try {
    referenceImages = validScenes.slice(0, 3).map(s => createReferenceImage(s.imageUrl!));
  } catch (e: any) {
    throw new Error(e.message || "Failed to process storyboard images. Ensure they are fully generated.");
  }

  try {
    let operation = await ai.models.generateVideos({
      model: VIDEO_MODEL,
      prompt: "A cinematic commercial video. Smooth transitions between scenes. High quality, 4k.",
      config: {
        numberOfVideos: 1,
        referenceImages: referenceImages as any, // Cast to any to avoid strict type issues
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
      console.error("Video Generation Operation Error:", operation.error);
      throw new Error(`Video generation failed: ${operation.error.message || 'Unknown error'}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      console.error("Operation completed but no video URI found.", JSON.stringify(operation, null, 2));
      throw new Error("No video URI returned. Check console for operation details.");
    }

    // Fetch the actual video bytes using the API key
    const videoRes = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!videoRes.ok) {
       throw new Error(`Failed to download video: ${videoRes.statusText}`);
    }
    const videoBlob = await videoRes.blob();
    return URL.createObjectURL(videoBlob);

  } catch (error) {
    console.error("Video Generation Error:", error);
    throw error;
  }
};

export const generateMarketingContent = async (
  campaign: Campaign,
  allProducts: Product[],
  onImageUpdate?: (updatedContent: GeneratedContent) => void
): Promise<GeneratedContent[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return mockGeneration(campaign, allProducts);

  const ai = getAiClient();

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

  const prompt = `
    You are an expert marketing copywriter.
    
    ${productContext}
    
    Campaign Context: ${campaign.context}
    ${campaign.attachments.length > 0 ? `Attached Documents (Reference only): ${campaign.attachments.join(', ')}` : ''}

    Campaign Goal: ${campaign.description}
    Target Audiences: ${campaign.targetAudiences.join(", ")}
    Channels: ${campaign.channels.join(", ")}
    Key Message: ${campaign.keyMessage}
    
    Task: Generate marketing content variants.
    Constraint: Generate a maximum of 6 high-quality distinct variants covering different audience/channel combinations to ensure valid JSON output.
    
    IMPORTANT for 'Video Storyboard' channel:
    - Instead of simple text, generate a 'storyboard' array with exactly 3 scenes.
    - Each scene must have: sceneNumber, imagePrompt (visual description), voiceover (script).
    - The top-level 'text' field should correspond to the full voiceover script.
    
    Return JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MARKETING_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
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
        }
      }
    });

    const cleanText = (response.text || "[]").replace(/```json\n?|```/g, '').trim();
    
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
  const maxItems = 5;
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
