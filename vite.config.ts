import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    const nvidiaApiKey = env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || '';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/nvidia': {
            target: 'https://integrate.api.nvidia.com/v1',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
          },
          '/api/flux': {
            target: 'https://image.pollinations.ai',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/api\/flux/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'process.env.NVIDIA_API_KEY': JSON.stringify(nvidiaApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
