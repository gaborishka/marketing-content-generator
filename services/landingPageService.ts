import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { InterviewQuestion } from '../types';

interface LandingPageResponse {
  message: string;
  html: string | null;
  interview: InterviewQuestion[] | null;
}

const generateLandingPageFn = httpsCallable<
  { conversationHistory: { role: string; content: string }[]; currentHtml?: string },
  LandingPageResponse
>(functions, 'generateLandingPage');

export async function generateLandingPage(
  conversationHistory: { role: string; content: string }[],
  currentHtml?: string
): Promise<LandingPageResponse> {
  const result = await generateLandingPageFn({ conversationHistory, currentHtml });
  return result.data;
}
