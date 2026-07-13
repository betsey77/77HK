import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all duration-150 ${
        copied
          ? 'bg-emerald-500/20 text-emerald-300 light:text-emerald-700'
          : 'bg-gray-800 light:bg-gray-100 text-gray-400 light:text-gray-600 hover:text-gray-200 light:hover:text-gray-800 hover:bg-gray-700 light:hover:bg-gray-200'
      }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? '已复制' : '复制'}
    </button>
  );
}
