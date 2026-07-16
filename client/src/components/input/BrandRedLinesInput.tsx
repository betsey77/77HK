import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function BrandRedLinesInput() {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div>
      <label className="text-xs font-medium text-emerald-400 light:text-orange-600">
        🚫 品牌表达红线
      </label>
      <p className="text-[10px] text-gray-500 light:text-gray-500 mt-0.5 mb-1.5">
        禁止模型生成触及红线嘅文案，消费者反馈亦会避开
      </p>
      <textarea
        rows={3}
        className="w-full bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300
          rounded-lg px-3 py-2 text-sm text-gray-200 light:text-gray-800
          placeholder-gray-500 light:placeholder-gray-400 resize-y
          focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20
          transition-colors"
        placeholder="例如：&#10;• 禁用「最强」、「第一」、「独家」等夸大词汇&#10;• 不可使用竞争对手名称&#10;• 避免政治敏感隐喻"
        value={state.settings.brandRedLines}
        onChange={(e) => dispatch({ type: 'SET_BRAND_RED_LINES', payload: e.target.value })}
      />
    </div>
  );
}
