interface SpinnerProps {
  label?: string;
}

export default function Spinner({ label = '生成中...' }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-gray-700 light:border-gray-200" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 light:border-t-orange-500 animate-spin" />
      </div>
      <span className="text-sm text-gray-400 light:text-gray-600">{label}</span>
    </div>
  );
}
