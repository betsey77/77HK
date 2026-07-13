import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function Footer() {
  const { state } = useContext(AppContext);

  const engineLabel = state.generationEngine === 'self-hosted-cantonese'
    ? 'Qwen3-4B-CV-KD (Modal)'
    : state.generationEngine === 'featherless-cantonese'
    ? 'CantoneseLLMChat 32B (Featherless.ai)'
    : state.generationEngine === 'deepseek'
      ? 'DeepSeek API'
      : state.generationEngine === 'rules'
        ? '快速规则引擎'
      : 'Idle';

  return (
    <footer className="flex items-center justify-between px-4 py-1.5 border-t border-gray-800 light:border-gray-200 bg-gray-950 light:bg-white shrink-0">
      <span className="text-[10px] text-gray-700 light:text-gray-600">
        Powered by {engineLabel}
      </span>
      <span className="text-[10px] text-gray-700 light:text-gray-600">
        v0.3.0
      </span>
    </footer>
  );
}
