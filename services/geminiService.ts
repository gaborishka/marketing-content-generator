import { GoogleGenAI, Type } from "@google/genai";
import { Product, Campaign, GeneratedContent } from "../types";

const MARKETING_MODEL = "gemini-3-flash-preview";
const IMAGE_MODEL = "gemini-3-pro-image-preview";

// Helper to get client with current key
// We must instantiate this inside functions to ensure we get the latest key from process.env
const getAiClient = () => {
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
}

export const generateImage = async (product: Product, contextText: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  // Fallback if no key is present (though App.tsx should enforce it)
  if (!apiKey) return `https://picsum.photos/seed/${Date.now()}/800/400`;

  const ai = getAiClient();

  const prompt = `
    Create a high-quality, photorealistic product marketing image.
    
    Product: ${product.name}
    Brand: ${product.brand}
    Description: ${product.description}
    
    Marketing Context: ${contextText}
    
    Style: Professional, commercial photography, 4k resolution, cinematic lighting.
    Ensure the product is the focal point.
  `;

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [{ text: prompt }]
      },
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

export const generateMarketingContent = async (
  campaign: Campaign,
  product: Product
): Promise<GeneratedContent[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("No API Key provided. Returning mock data.");
    return mockGeneration(campaign, product);
  }

  const ai = getAiClient();

  const prompt = `
    You are an expert marketing copywriter and compliance officer.
    
    Product: ${product.name}
    Description: ${product.description}
    Features: ${product.features.join(", ")}
    Brand: ${product.brand}
    
    Campaign Goal: ${campaign.description}
    Key Message: ${campaign.keyMessage}
    Target Audiences: ${campaign.targetAudiences.join(", ")}
    Channels: ${campaign.channels.join(", ")}
    
    Task: Generate marketing content for each combination of Channel and Audience.
    For each piece of content, also calculate a hypothetical compliance score (0-100) and risk level based on FDA/FTC general guidelines (avoiding unproven medical claims if applicable).
    
    Return the response as a JSON array.
  `;

  try {
    // 1. Generate Text Variants
    const response = await ai.models.generateContent({
      model: MARKETING_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
            },
            required: ["channel", "audience", "text", "complianceScore", "riskLevel"]
          }
        }
      }
    });

    const rawData = JSON.parse(response.text || "[]");
    
    // 2. Generate Images for each variant in parallel
    // This allows us to use the specific text context for the image generation
    const enrichedDataPromises = rawData.map(async (item: any, index: number) => {
      // Generate image specifically for this variant
      const imageUrl = await generateImage(product, item.text);

      return {
        id: `gen-${Date.now()}-${index}`,
        campaignId: campaign.id,
        channel: item.channel,
        audience: item.audience,
        text: item.text,
        complianceScore: item.complianceScore,
        riskLevel: item.riskLevel,
        status: 'draft',
        imageUrl: imageUrl,
        x: 0,
        y: 0
      };
    });

    return await Promise.all(enrichedDataPromises);

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return mockGeneration(campaign, product);
  }
};

// Fallback mock generation if API fails or no key
const mockGeneration = (campaign: Campaign, product: Product): GeneratedContent[] => {
  const generated: GeneratedContent[] = [];
  let count = 0;

  campaign.channels.forEach(channel => {
    campaign.targetAudiences.forEach(audience => {
      count++;
      generated.push({
        id: `mock-${Date.now()}-${count}`,
        campaignId: campaign.id,
        channel,
        audience,
        text: `[${channel}] Attention ${audience}: Experience the power of ${product.name}. ${campaign.keyMessage}. ${product.features[0]} makes all the difference. #Ad`,
        complianceScore: Math.floor(Math.random() * 20) + 80, // 80-100
        riskLevel: 'low',
        status: 'draft',
        imageUrl: `https://picsum.photos/seed/${count}/800/400`,
        x: 0,
        y: 0
      });
    });
  });
  
  return generated;
};