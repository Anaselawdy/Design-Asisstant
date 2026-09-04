import { ImageFile } from '../types';

const NVIDIA_BASE_URL = typeof window !== 'undefined' ? '/api/nvidia' : 'https://integrate.api.nvidia.com/v1';

// Default free models available on NVIDIA NIM (build.nvidia.com)
export const NVIDIA_MODELS = {
  text: 'nvidia/llama-3.1-nemotron-70b-instruct',
  reasoning: 'mistralai/mistral-large-2-instruct',
  vision: 'meta/llama-3.2-11b-vision-instruct',
  visionLarge: 'meta/llama-3.2-90b-vision-instruct',
  translate: 'nvidia/riva-translate-4b-instruct-v2',
  image: 'stabilityai/stable-diffusion-3.5-large',
  imageAlt: 'black-forest-labs/flux.1-schnell',
};

export function getNvidiaApiKey(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('nvidia_api_key');
    if (local && local.trim()) return local.trim();
  }
  return (process.env.NVIDIA_API_KEY || '').trim();
}

export function setStoredNvidiaApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem('nvidia_api_key', key.trim());
    } else {
      localStorage.removeItem('nvidia_api_key');
    }
  }
}

export function hasNvidiaApiKey(): boolean {
  return Boolean(getNvidiaApiKey());
}

export function formatNvidiaError(error: unknown): string {
  if (!error) return 'An unexpected error occurred with NVIDIA NIM.';
  let msg = '';
  if (typeof error === 'string') msg = error;
  else if (error instanceof Error) msg = error.message;
  else if (typeof error === 'object' && error !== null) {
    const errObj = error as any;
    msg = errObj.detail || errObj.message || errObj.title || JSON.stringify(error);
  }

  const lower = msg.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('authentication failed')) {
    return 'Invalid or missing NVIDIA API Key (nvapi-...). Please check your key at build.nvidia.com.';
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return 'NVIDIA API Rate Limit reached. Please wait a moment before sending another request.';
  }
  if (lower.includes('404') || lower.includes('not found') || lower.includes('410') || lower.includes('gone')) {
    return 'The requested NVIDIA model is currently unavailable or updating. Please try again.';
  }
  return msg || 'NVIDIA API request failed.';
}

export async function testNvidiaConnection(candidateKey?: string): Promise<{ success: boolean; message: string }> {
  const key = (candidateKey !== undefined ? candidateKey : getNvidiaApiKey()).trim();
  if (!key) {
    return { success: false, message: 'Please provide an NVIDIA API Key (nvapi-...)' };
  }

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODELS.text,
        messages: [{ role: 'user', content: 'Say "OK" to test connection' }],
        max_tokens: 16,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || errData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return { 
        success: true, 
        message: `Successfully connected to NVIDIA NIM (${NVIDIA_MODELS.text})!` 
      };
    }
    return { success: true, message: 'NVIDIA NIM connection verified!' };
  } catch (err: any) {
    return { success: false, message: formatNvidiaError(err) };
  }
}

export async function callNvidiaChat(
  prompt: string,
  systemPrompt?: string,
  options: { model?: string; temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const key = getNvidiaApiKey();
  if (!key) throw new Error('NVIDIA API Key is missing. Please set your nvapi-... key in API Settings.');

  const model = options.model || NVIDIA_MODELS.text;
  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.6,
      max_tokens: options.max_tokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(formatNvidiaError(err.detail || err.message || `HTTP ${response.status}`));
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return text.trim();
}

export async function callNvidiaVision(
  prompt: string,
  images: ImageFile[],
  options: { model?: string; temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const key = getNvidiaApiKey();
  if (!key) throw new Error('NVIDIA API Key is missing. Please set your nvapi-... key in API Settings.');

  const model = options.model || NVIDIA_MODELS.vision;
  const contentArray: any[] = [{ type: 'text', text: prompt }];

  images.forEach(img => {
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    });
  });

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: contentArray }],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 1500,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(formatNvidiaError(err.detail || err.message || `HTTP ${response.status}`));
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return text.trim();
}

// Fallback high-resolution FLUX / SD image generation
async function generateFallbackFluxImage(prompt: string, aspectRatio: string = "1:1"): Promise<ImageFile> {
  let width = 1024;
  let height = 1024;
  if (aspectRatio === '16:9') {
    width = 1280;
    height = 720;
  } else if (aspectRatio === '9:16') {
    width = 720;
    height = 1280;
  } else if (aspectRatio === '4:3') {
    width = 1024;
    height = 768;
  } else if (aspectRatio === '3:4') {
    width = 768;
    height = 1024;
  }

  const cleanPrompt = encodeURIComponent(prompt.slice(0, 450));
  const seed = Math.floor(Math.random() * 1000000);
  const fluxBase = typeof window !== 'undefined' ? '/api/flux' : 'https://image.pollinations.ai';
  const url = `${fluxBase}/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to generate image (status ${resp.status})`);
    }
    const blob = await resp.blob();
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          base64: base64Data,
          mimeType: blob.type || 'image/png',
          name: `flux-${Date.now()}.png`,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err: any) {
    // If proxied fetch fails, retry directly with image.pollinations.ai
    const directUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;
    const directResp = await fetch(directUrl);
    if (!directResp.ok) {
      throw new Error(`Image service error: ${directResp.status}`);
    }
    const blob = await directResp.blob();
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          base64: base64Data,
          mimeType: blob.type || 'image/png',
          name: `flux-${Date.now()}.png`,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export async function generateNvidiaImage(
  prompt: string,
  aspectRatio: string = "1:1"
): Promise<ImageFile> {
  const key = getNvidiaApiKey();
  
  // Attempt NVIDIA NIM Visual Generation if available
  if (key) {
    try {
      const response = await fetch(`${NVIDIA_BASE_URL}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: NVIDIA_MODELS.image,
          prompt,
          n: 1,
          size: aspectRatio === '16:9' ? '1280x720' : '1024x1024',
          response_format: 'b64_json',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const b64 = data.data?.[0]?.b64_json;
        if (b64) {
          return {
            base64: b64,
            mimeType: 'image/png',
            name: `nvidia-gen-${Date.now()}.png`,
          };
        }
      }
    } catch (e) {
      console.warn('[NVIDIA NIM Image] Direct endpoint failed, using high-quality FLUX fallback...', e);
    }
  }

  // Fallback to high-quality FLUX generation
  return generateFallbackFluxImage(prompt, aspectRatio);
}
