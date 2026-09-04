import { GoogleGenAI, Modality, Part, GenerateContentResponse, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";
import { ImageFile, AudioFile } from '../types';

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";

const ai = new GoogleGenAI({ 
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/**
 * Parses and formats any Gemini API error into a friendly, readable message.
 * Specially handles 429 quota exhaustion and rate limit errors.
 */
export function formatGeminiError(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';

  let rawMsg = '';
  let statusCode: number | null = null;
  let statusStr = '';

  if (typeof error === 'string') {
    rawMsg = error;
  } else if (error instanceof Error) {
    rawMsg = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, any>;
    if (errObj.message) rawMsg = String(errObj.message);
    else if (errObj.statusText) rawMsg = String(errObj.statusText);
    else rawMsg = JSON.stringify(error);
  }

  // If rawMsg contains a JSON structure (like {"error":{"code":429,...}}), parse it
  try {
    const jsonMatch = rawMsg.match(/\{[\s\S]*"error"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) {
        if (parsed.error.code) statusCode = Number(parsed.error.code);
        if (parsed.error.status) statusStr = String(parsed.error.status);
        if (parsed.error.message) rawMsg = String(parsed.error.message);
      }
    }
  } catch {
    // Continue with string analysis
  }

  const lower = rawMsg.toLowerCase();

  // Detect 429 / Quota / Rate Limits
  if (
    statusCode === 429 ||
    statusStr === 'RESOURCE_EXHAUSTED' ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate-limit') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return 'Rate Limit / Quota Reached (429): You exceeded your current Gemini API quota. Please wait a moment before trying again, or configure a paid API key in Google AI Studio to increase your limits.';
  }

  // Detect Safety Blocks
  if (lower.includes('safety') || lower.includes('harm_category') || lower.includes('blocked')) {
    return 'The request was stopped by safety filters. Please adjust the prompt or reference image.';
  }

  // Detect Invalid or Missing API Keys
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || statusCode === 401 || statusCode === 403) {
    return 'Invalid or missing Gemini API Key. Please verify your API key in Google AI Studio Settings.';
  }

  return rawMsg.trim() || 'Request failed. Please try again.';
}

/**
 * Retries an asynchronous API call with exponential backoff on 429 rate limit errors.
 */
async function callWithRetry<T>(
  apiCall: () => Promise<T>,
  retries = 2,
  baseDelay = 2000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiCall();
    } catch (err: any) {
      lastError = err;
      const formatted = formatGeminiError(err);
      const isRateLimit =
        formatted.includes('429') ||
        formatted.includes('Rate Limit') ||
        formatted.includes('Quota');

      if (isRateLimit && attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[Gemini API] Quota/Rate limit encountered. Retrying in ${Math.round(delay)}ms (Attempt ${attempt + 1}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }
  throw new Error(formatGeminiError(lastError));
}

/**
 * Sequential queue for image generation to prevent bursting the API rate limiter.
 */
let imageGenerationQueue = Promise.resolve();

function queueImageOperation<T>(operation: () => Promise<T>): Promise<T> {
  const execute = async () => {
    return await callWithRetry(operation, 2, 2500);
  };

  const resultPromise = imageGenerationQueue.then(execute, execute);
  // Add a 600ms buffer after each image operation to avoid rate limit spikes
  imageGenerationQueue = resultPromise.then(
    () => new Promise((resolve) => setTimeout(resolve, 600)),
    () => new Promise((resolve) => setTimeout(resolve, 600))
  );

  return resultPromise;
}

const handleApiResponse = (response: GenerateContentResponse): ImageFile => {
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
        name: 'generated-image.png',
      };
    }
  }

  const safetyText = response.candidates?.[0]?.finishReason;
  if (safetyText && safetyText !== 'STOP') {
    throw new Error(`Image generation stopped by safety settings: ${safetyText}`);
  }

  throw new Error('No image was generated by the model.');
};

export async function generateImage(
  productImages: ImageFile[],
  prompt: string,
  styleImages: ImageFile[] | null,
  aspectRatio: string = "1:1"
): Promise<ImageFile> {
  const model = 'gemini-3.1-flash-lite-image';
  const parts: Part[] = [];

  // Add product references if they exist
  if (productImages && productImages.length > 0) {
    productImages.forEach((productImage) => {
      parts.push({
        inlineData: {
          data: productImage.base64,
          mimeType: productImage.mimeType,
        },
      });
    });
  }

  parts.push({ text: prompt });

  if (styleImages && styleImages.length > 0) {
    styleImages.forEach((styleImage) => {
      parts.push({
        inlineData: {
          data: styleImage.base64,
          mimeType: styleImage.mimeType,
        },
      });
    });
  }

  return queueImageOperation(async () => {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: {
        imageConfig: { aspectRatio: aspectRatio as any },
        safetySettings: safetySettings,
      },
    });

    return handleApiResponse(response);
  });
}

export async function editImage(
  baseImage: ImageFile,
  prompt: string,
): Promise<ImageFile> {
  const model = 'gemini-3.1-flash-lite-image';

  const parts: Part[] = [
    {
      inlineData: {
        data: baseImage.base64,
        mimeType: baseImage.mimeType,
      },
    },
    { text: prompt },
  ];

  return queueImageOperation(async () => {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: { safetySettings: safetySettings },
    });

    return handleApiResponse(response);
  });
}

export async function expandImage(
  image: ImageFile,
  prompt: string
): Promise<ImageFile> {
  return editImage(image, prompt);
}

export async function analyzeImageForPrompt(
  images: ImageFile[],
  instructions: string
): Promise<string> {
  const model = 'gemini-3.8-flash';
  const parts: Part[] = [];

  images.forEach((image) => {
    parts.push({
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    });
  });

  const textPrompt = `Analyze the provided image(s) in detail. Craft a descriptive prompt for an AI model. Instruction: ${instructions}`;
  parts.push({ text: textPrompt });

  return callWithRetry(async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: { safetySettings: safetySettings },
    });
    return response.text?.trim() || '';
  });
}

export async function analyzeStyleImage(images: ImageFile[]): Promise<string> {
  const model = 'gemini-3.8-flash';
  const parts: Part[] = images.map((img) => ({
    inlineData: {
      data: img.base64,
      mimeType: img.mimeType,
    },
  }));
  parts.push({
    text: "Analyze the visual style of these images. Describe the lighting, color palette, mood, and aesthetic in detail for a text-to-image prompt.",
  });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: { safetySettings: safetySettings },
    });
    return response.text?.trim() || '';
  });
}

export async function analyzeLogoForBranding(images: ImageFile[]): Promise<{ colors: string[] }> {
  const model = 'gemini-3.8-flash';
  const parts: Part[] = images.map((img) => ({
    inlineData: {
      data: img.base64,
      mimeType: img.mimeType,
    },
  }));
  parts.push({
    text: "Analyze this logo and extract the primary brand colors. Return them as a JSON object with a 'colors' key containing a string array of hex codes.",
  });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Hex color codes representing the logo palette",
            },
          },
          required: ["colors"],
        },
      },
    });
    const text = response.text || '{"colors": []}';
    return JSON.parse(text);
  });
}

export async function generatePromptFromText(instructions: string): Promise<string> {
  const model = 'gemini-3.8-flash';
  const prompt = `Expand this idea into a detailed text-to-image prompt: "${instructions}"`;

  return callWithRetry(async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { safetySettings: safetySettings },
    });
    return response.text?.trim() || '';
  });
}

export async function translateText(text: string): Promise<string> {
  const model = 'gemini-3.8-flash';
  const prompt = `Translate the following text to English, preserving any technical or descriptive nuances: "${text}"`;

  return callWithRetry(async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text?.trim() || '';
  });
}

export async function generateSpeech(text: string, styleInstructions: string, voiceName: string): Promise<AudioFile> {
  const model = "gemini-3.1-flash-tts-preview";
  const prompt = `Speak the following text ${styleInstructions ? '(' + styleInstructions + ')' : ''}: ${text}`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio data returned from the model.');
    }

    return {
      base64: base64Audio,
      name: `voiceover-${Date.now()}.wav`,
    };
  });
}

export async function generateCampaignPlan(
  productImages: ImageFile[],
  userPrompt: string,
  targetMarket: string = "Global",
  dialect: string = "English"
): Promise<any[]> {
  const model = 'gemini-3.8-flash';
  const parts: Part[] = [];

  if (productImages && productImages.length > 0) {
    productImages.forEach((img) => parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
  }

  const instruction = `Act as a professional Creative Director and Marketing Strategist. 
Target Market: ${targetMarket}. Requested Content Dialect/Language: ${dialect}.
Goal: "${userPrompt}". 

Task: Generate 9 unique campaign post ideas tailored for the specified market and written in the requested dialect.
Return a JSON array where each object has:
- id: string
- scenario: highly descriptive visual prompt for AI image generation (English). If no product image was provided, describe the subject/product from the user's goal.
- caption: engaging social media caption written STRICTLY in the specified dialect (${dialect})
- tov: a short, catchy text suggestion or hook (max 5-7 words) derived from the caption, intended to be written directly on the design/visual itself.
- schedule: recommended posting day/time for the ${targetMarket} market.
Return ONLY the raw JSON array.`;

  parts.push({ text: instruction });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              scenario: { type: Type.STRING },
              caption: { type: Type.STRING },
              tov: { type: Type.STRING },
              schedule: { type: Type.STRING },
            },
            required: ["id", "scenario", "caption", "tov", "schedule"],
          },
        },
      },
    });
    const text = response.text || '[]';
    return JSON.parse(text.trim());
  });
}

export async function analyzeProductForCampaign(productImages: ImageFile[]): Promise<string> {
  const model = 'gemini-3.8-flash';
  const parts: Part[] = [];
  productImages.forEach((img) => parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));

  const prompt = `Analyze these image(s) to identify the product/service category and its market positioning. 
Return a concise analysis including:
1. Identified Category (e.g. Luxury Watches, Organic Skincare, Tech Services).
2. Best Market Fit: Describe the ideal setting and audience for this product based on current market trends.
Format as a clear, professional summary.`;

  parts.push({ text: prompt });

  return callWithRetry(async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: { parts },
    });
    return response.text?.trim() || '';
  });
}

export async function generateStoryboardPlan(
  subjectImages: ImageFile[],
  customInstructions: string
): Promise<any[]> {
  const model = 'gemini-3.8-flash';
  const parts: Part[] = [];

  if (subjectImages && subjectImages.length > 0) {
    subjectImages.forEach((img) => parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
  }

  const instruction = `Act as a cinematic Storyboard Director and Scriptwriter. 
Context/Prompt: "${customInstructions}".

Task: Create a professional 9-scene storyboard sequence. 
Maintain strict visual consistency for the subject/character from provided images.
Each scene must have a unique camera angle to build a cinematic narrative.

Return a JSON array of 9 objects:
- sequence: number (1 to 9)
- description: what is happening in the scene (Arabic)
- cameraAngle: specific technical camera angle (e.g. Extreme Close-up, Low Angle, Wide Shot)
- visualPrompt: extremely detailed English prompt for an AI image generator to create THIS scene. Include lighting, mood, and reference to the subject.
Return ONLY JSON.`;

  parts.push({ text: instruction });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sequence: { type: Type.INTEGER },
              description: { type: Type.STRING },
              cameraAngle: { type: Type.STRING },
              visualPrompt: { type: Type.STRING },
            },
            required: ["sequence", "description", "cameraAngle", "visualPrompt"],
          },
        },
      },
    });
    return JSON.parse(response.text || '[]');
  });
}

export async function generateMarketingAnalysis(
  brandData: { type: 'new' | 'existing'; name?: string; specialty?: string; brief?: string; link?: string },
  language: 'ar' | 'en'
): Promise<string> {
  let context = '';
  if (brandData.type === 'existing') {
    context = `Analyze the brand from this link: ${brandData.link}. Use Google Search to find its real current position, competitors, and audience feedback.`;
  } else {
    context = `Strategic analysis for a NEW brand. Name: ${brandData.name}. Specialty: ${brandData.specialty}. Brief: ${brandData.brief}. Use market trends for this niche.`;
  }

  const prompt = `Act as a world-class CMO and Marketing Strategist. 
${context}

Task: Provide a detailed, professional marketing strategy report.
Language: ${language === 'ar' ? 'Arabic' : 'English'}.

The report MUST include:
1. SWOT Analysis (Strengths, Weaknesses, Opportunities, Threats).
2. Detailed Buyer Persona (Demographics, Psychographics, Buying Behavior).
3. Competitor Analysis & Market Gaps.
4. Value Proposition (USP).
5. Integrated Go-To-Market (GTM) Strategy.
6. Smart Pricing Strategy Recommendation.
7. 30-60-90 Day Execution Roadmap.
8. Growth KPI Dashboard (Metric recommendations).

Format the output with professional headers, bullet points, and a tone of high-level business consultation.
Use Markdown for formatting.`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [{ text: prompt }] },
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text || '';
  });
}
