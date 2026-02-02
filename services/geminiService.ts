import { GoogleGenAI, Type } from "@google/genai";
import { Product, Campaign, GeneratedContent } from "../types";

// Initialize Gemini Client
// Note: In a real environment, allow the user to input key if env is missing, 
// but per instructions we assume process.env.API_KEY is available or handled.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

const MARKETING_MODEL = "gemini-3-flash-preview";

export const generateMarketingContent = async (
  campaign: Campaign,
  product: Product
): Promise<GeneratedContent[]> => {
  if (!apiKey) {
    console.warn("No API Key provided. Returning mock data.");
    return mockGeneration(campaign, product);
  }

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
    
    return rawData.map((item: any, index: number) => ({
      id: `gen-${Date.now()}-${index}`,
      campaignId: campaign.id,
      channel: item.channel,
      audience: item.audience,
      text: item.text,
      complianceScore: item.complianceScore,
      riskLevel: item.riskLevel,
      status: 'draft',
      imageUrl: `https://picsum.photos/seed/${index}/800/400`,
      x: 0,
      y: 0
    }));

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