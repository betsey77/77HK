/**
 * Loading skeleton card for inspiration panel tabs.
 * Renders a pulsing placeholder while data is being fetched.
 */
export default function SkeletonCard() {
  return (
    <div className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/20 light:border-gray-200 rounded-lg p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-12 h-3 bg-gray-700/30 light:bg-gray-300 rounded" />
        <div className="w-16 h-3 bg-gray-700/30 light:bg-gray-300 rounded" />
      </div>
      <div className="space-y-1.5">
        <div className="w-full h-2.5 bg-gray-700/20 light:bg-gray-200 rounded" />
        <div className="w-3/4 h-2.5 bg-gray-700/20 light:bg-gray-200 rounded" />
        <div className="w-1/2 h-2.5 bg-gray-700/20 light:bg-gray-200 rounded" />
      </div>
      <div className="flex gap-1.5 mt-2">
        <div className="w-14 h-5 bg-gray-700/20 light:bg-gray-200 rounded" />
        <div className="w-14 h-5 bg-gray-700/20 light:bg-gray-200 rounded" />
      </div>
    </div>
  );
}
