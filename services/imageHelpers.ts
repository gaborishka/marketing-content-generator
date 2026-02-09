// Helper to get aspect ratio for a channel
export function getAspectRatioForChannel(channel: string): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" {
  const CHANNEL_ASPECT_RATIOS: Record<string, "1:1" | "3:4" | "4:3" | "9:16" | "16:9"> = {
    "Instagram Post": "1:1",
    "Instagram Story": "9:16",
    "Instagram Reel": "9:16",
    "Instagram Carousel": "1:1",
    "Tweet": "16:9",
    "Twitter Thread": "16:9",
    "LinkedIn Post": "4:3",
    "LinkedIn Article": "16:9",
    "Email Newsletter": "16:9",
    "Web Banner": "16:9",
    "Blog Post": "16:9",
    "Facebook Post": "4:3",
    "Facebook Ad": "1:1",
    "Pinterest Pin": "3:4",
    "TikTok Video": "9:16",
    "YouTube Video": "16:9",
    "YouTube Short": "9:16",
    "Video Storyboard": "16:9",
  };
  
  return CHANNEL_ASPECT_RATIOS[channel] ?? "16:9";
}

