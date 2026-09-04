import React, { useState, useEffect } from 'react';
import { 
  getApiKey, 
  setStoredApiKey, 
  testApiKey,
  getNvidiaApiKey,
  setStoredNvidiaApiKey,
  testNvidiaConnection,
  getActiveProvider,
  setActiveProvider,
  AiProvider
} from '../services/geminiService';

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
  const [provider, setProvider] = useState<AiProvider>('nvidia');
  const [nvidiaKey, setNvidiaKeyInput] = useState('');
  const [geminiKey, setGeminiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setProvider(getActiveProvider());
      setNvidiaKeyInput(getNvidiaApiKey());
      setGeminiKeyInput(getApiKey());
      setStatus('idle');
      setStatusMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentKey = provider === 'nvidia' ? nvidiaKey : geminiKey;
  const setCurrentKey = (val: string) => {
    if (provider === 'nvidia') {
      setNvidiaKeyInput(val);
      // Auto-detect if user pastes a gemini key by mistake
      if (val.startsWith('AIza') || val.startsWith('AQ.')) {
        setProvider('gemini');
        setGeminiKeyInput(val);
      }
    } else {
      setGeminiKeyInput(val);
      // Auto-detect if user pastes an nvidia key
      if (val.startsWith('nvapi-')) {
        setProvider('nvidia');
        setNvidiaKeyInput(val);
      }
    }
  };

  const handleTest = async () => {
    if (!currentKey.trim()) {
      setStatus('error');
      setStatusMessage(
        provider === 'nvidia' 
          ? 'فضلاً أدخل مفتاح NVIDIA API أولاً (يبدأ بـ nvapi-)' 
          : 'فضلاً أدخل مفتاح Gemini API أولاً'
      );
      return;
    }
    setStatus('testing');
    setStatusMessage(
      provider === 'nvidia' 
        ? 'جاري اختبار الاتصال بنماذج NVIDIA NIM المجانية...' 
        : 'جاري اختبار الاتصال مع Google AI Studio...'
    );

    const result = provider === 'nvidia'
      ? await testNvidiaConnection(currentKey.trim())
      : await testApiKey(currentKey.trim(), 'gemini');

    if (result.success) {
      setStatus('success');
      setStatusMessage(result.message);
    } else {
      setStatus('error');
      setStatusMessage(result.message);
    }
  };

  const handleSave = () => {
    const trimmed = currentKey.trim();
    if (provider === 'nvidia') {
      setStoredNvidiaApiKey(trimmed);
      setActiveProvider('nvidia');
    } else {
      setStoredApiKey(trimmed);
      setActiveProvider('gemini');
    }

    if (onKeyUpdated) {
      onKeyUpdated(Boolean(trimmed));
    }
    setStatus('success');
    setStatusMessage(`تم حفظ مفتاح ${provider === 'nvidia' ? 'NVIDIA' : 'Gemini'} وتفعيله بنجاح!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    if (provider === 'nvidia') {
      setStoredNvidiaApiKey('');
      setNvidiaKeyInput('');
    } else {
      setStoredApiKey('');
      setGeminiKeyInput('');
    }
    setStatus('idle');
    setStatusMessage('تم مسح المفتاح المخزن / Cleared stored key.');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-[rgba(20,20,20,0.95)] text-[var(--color-text-base)] border border-white/10 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${
              provider === 'nvidia' 
                ? 'bg-gradient-to-tr from-emerald-600 to-green-500 shadow-emerald-500/20' 
                : 'bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-blue-500/20'
            }`}>
              {provider === 'nvidia' ? (
                <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                  <path d="M8.94 4.54a5.55 5.55 0 0 0-4.4 2.16A5.55 5.55 0 0 0 3.4 10.9v6.56h4.4v-6.56a1.15 1.15 0 0 1 .91-.45c.49 0 .89.37.89.83v6.18h4.4v-6.18c0-2.85-2.26-5.18-5.06-5.18zm6.12 0a5.55 5.55 0 0 0-4.4 2.16A5.55 5.55 0 0 0 9.52 10.9v6.56h4.4v-6.56a1.15 1.15 0 0 1 .91-.45c.49 0 .89.37.89.83v6.18h4.4v-6.18c0-2.85-2.26-5.18-5.06-5.18z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">إعداد مزود الذكاء الاصطناعي (AI Provider)</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                اختر النماذج المجانية المفضلة لتشغيل أدوات التصميم
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

        {/* Provider Switcher Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
          <button
            onClick={() => { setProvider('nvidia'); setStatus('idle'); setStatusMessage(''); }}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              provider === 'nvidia'
                ? 'bg-[#76B900] text-black shadow-lg shadow-[#76B900]/20 scale-[1.02]'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-950" />
            <span>NVIDIA NIM (Free Models)</span>
          </button>
          <button
            onClick={() => { setProvider('gemini'); setStatus('idle'); setStatusMessage(''); }}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              provider === 'gemini'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-300" />
            <span>Google Gemini</span>
          </button>
        </div>

        {/* NVIDIA Section */}
        {provider === 'nvidia' && (
          <div className="mt-4 p-4 rounded-2xl bg-[#76B900]/10 border border-[#76B900]/20 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#76B900] flex items-center gap-1.5">
                  <span>نماذج NVIDIA المجانية فائقة السرعة</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#76B900]/20 text-[#76B900] uppercase font-mono">Free Tier</span>
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  احصل على مفتاح مجاني لتشغيل LLaMA 3.1 Nemotron 70B & LLaMA 3.2 Vision:
                </p>
              </div>
              <a
                href="https://build.nvidia.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#76B900] hover:bg-[#68a400] text-black text-xs font-black rounded-xl transition-all shadow-md shadow-[#76B900]/20 flex-shrink-0"
              >
                <span>فتح build.nvidia.com</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            <ol className="text-xs text-[var(--color-text-secondary)] space-y-1 list-decimal list-inside pr-1">
              <li>افتح موقع <a href="https://build.nvidia.com/" target="_blank" rel="noopener noreferrer" className="text-[#76B900] underline font-mono">build.nvidia.com</a> وسجل حساباً مجانياً.</li>
              <li>انتقل إلى أي نموذج (مثل LLaMA 3.1 Nemotron) واضغط على <span className="text-white font-semibold">"Get API Key"</span>.</li>
              <li>انسخ المفتاح (يبدأ بـ <span className="font-mono text-emerald-400 font-bold">nvapi-...</span>) والصقه بالأسفل.</li>
            </ol>

            <div className="pt-2 border-t border-[#76B900]/15 flex flex-wrap gap-2 text-[11px] text-white/80">
              <span className="bg-black/30 px-2 py-0.5 rounded-md">⚡ LLaMA 3.1 Nemotron 70B</span>
              <span className="bg-black/30 px-2 py-0.5 rounded-md">👁️ LLaMA 3.2 Vision</span>
              <span className="bg-black/30 px-2 py-0.5 rounded-md">🎨 FLUX.1 & SD 3.5</span>
            </div>
          </div>
        )}

        {/* Gemini Section */}
        {provider === 'gemini' && (
          <div className="mt-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">Google AI Studio</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  احصل على مفتاح Gemini المجاني:
                </p>
              </div>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex-shrink-0"
              >
                <span>فتح AI Studio</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            <ol className="text-xs text-[var(--color-text-secondary)] space-y-1 list-decimal list-inside pr-1">
              <li>افتح <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-mono">aistudio.google.com/apikey</a> وسجل دخول.</li>
              <li>اضغط <span className="text-white font-semibold">"Create API key"</span>.</li>
              <li>انسخ المفتاح والصقه أدناه.</li>
            </ol>
          </div>
        )}

        {/* Key Input */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold text-[var(--color-text-secondary)] block">
            {provider === 'nvidia' ? 'NVIDIA API Key (nvapi-...)' : 'Google Gemini API Key'}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={currentKey}
              onChange={(e) => setCurrentKey(e.target.value)}
              placeholder={provider === 'nvidia' ? 'nvapi-xxxxxxxxxxxxxxxxxxxxxxxx' : 'AIzaSy...'}
              className="w-full bg-black/40 border border-white/10 focus:border-[#76B900] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none transition-all pr-24"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors"
            >
              {showKey ? 'إخفاء' : 'إظهار'}
            </button>
          </div>
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
            {currentKey && (
              <button
                onClick={handleClear}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                مسح المفتاح
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={status === 'testing' || !currentKey.trim()}
              className="px-4 py-2 text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50"
            >
              {status === 'testing' ? 'جاري الاختبار...' : 'اختبار المفتاح'}
            </button>
            <button
              onClick={handleSave}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-lg ${
                provider === 'nvidia'
                  ? 'bg-[#76B900] hover:bg-[#68a400] text-black shadow-[#76B900]/20'
                  : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-white shadow-[var(--color-accent)]/20'
              }`}
            >
              حفظ وتفعيل المزود
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
