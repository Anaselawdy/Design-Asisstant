import React, { useState, useEffect } from 'react';
import { getApiKey, setStoredApiKey, testApiKey } from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: (hasKey: boolean) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyUpdated,
}) => {
  const [apiKey, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [hasEnvKey, setHasEnvKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getApiKey();
      setApiKeyInput(current);
      // Check if defined via process.env
      const envKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
      setHasEnvKey(Boolean(envKey));
      setStatus('idle');
      setStatusMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setStatus('error');
      setStatusMessage('فضلاً أدخل مفتاح API أولاً / Please enter an API key first.');
      return;
    }
    setStatus('testing');
    setStatusMessage('جاري اختبار الاتصال مع Google AI Studio...');
    const result = await testApiKey(apiKey.trim());
    if (result.success) {
      setStatus('success');
      setStatusMessage(result.message);
    } else {
      setStatus('error');
      setStatusMessage(result.message);
    }
  };

  const handleSave = () => {
    const trimmed = apiKey.trim();
    setStoredApiKey(trimmed);
    if (onKeyUpdated) {
      onKeyUpdated(Boolean(trimmed || hasEnvKey));
    }
    setStatus('success');
    setStatusMessage('تم حفظ المفتاح بنجاح! / API Key saved successfully!');
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleClear = () => {
    setStoredApiKey('');
    setApiKeyInput('');
    if (onKeyUpdated) {
      onKeyUpdated(hasEnvKey);
    }
    setStatus('idle');
    setStatusMessage('تم مسح المفتاح المخزن / Cleared stored key.');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-[rgba(20,20,20,0.92)] text-[var(--color-text-base)] border border-white/10 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Gemini API Key</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                إعداد مفتاح الذكاء الاصطناعي من Google AI Studio
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Instructions Box */}
        <div className="mt-5 p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">كيف تحصل على مفتاح API مجاني؟</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                How to get your free Gemini API key:
              </p>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex-shrink-0"
            >
              <span>فتح AI Studio</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          <ol className="text-xs text-[var(--color-text-secondary)] space-y-1 list-decimal list-inside pr-1">
            <li>افتح رابط <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-mono">aistudio.google.com/apikey</a> وسجل دخول بحساب Google.</li>
            <li>اضغط على زر <span className="text-white font-semibold">"Create API key"</span> أو "Get API key".</li>
            <li>انسخ المفتاح (يبدأ عادة بـ <span className="font-mono text-emerald-400">AIzaSy...</span>) والصقه في الخانة أدناه.</li>
          </ol>
        </div>

        {/* Input */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold text-[var(--color-text-secondary)] block">
            Google Gemini API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-black/40 border border-white/10 focus:border-[var(--color-accent)] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none transition-all pr-24"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors"
            >
              {showKey ? 'إخفاء' : 'إظهار'}
            </button>
          </div>
          {hasEnvKey && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              تم اكتشاف مفتاح محدد مسبقاً في ملف البيئة (.env)
            </p>
          )}
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-medium border ${
            status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
            status === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
            'bg-blue-500/10 border-blue-500/30 text-blue-300'
          }`}>
            {statusMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div>
            {apiKey && (
              <button
                onClick={handleClear}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                مسح المفتاح المخزن
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={status === 'testing' || !apiKey.trim()}
              className="px-4 py-2 text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50"
            >
              {status === 'testing' ? 'جاري الاختبار...' : 'اختبار المفتاح'}
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] rounded-xl transition-all shadow-lg shadow-[var(--color-accent)]/20"
            >
              حفظ المفتاح
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
