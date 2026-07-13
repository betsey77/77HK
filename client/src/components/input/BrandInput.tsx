import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function BrandInput() {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-400 light:text-gray-600 font-medium">🏷️ 品牌 / 产品名称（可选）</label>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={state.settings.brandName}
          onChange={(e) => dispatch({ type: 'SET_BRAND_NAME', payload: e.target.value })}
          placeholder="品牌名，如：小米"
          className="w-full bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-200 light:text-gray-800
            placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/50 light:focus:border-orange-500/50 focus:ring-1 focus:ring-emerald-500/20 light:focus:ring-orange-500/20
            transition-colors"
        />
        <input
          type="text"
          value={state.settings.productName}
          onChange={(e) => dispatch({ type: 'SET_PRODUCT_NAME', payload: e.target.value })}
          placeholder="产品名，如：SU7"
          className="w-full bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-200 light:text-gray-800
            placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/50 light:focus:border-orange-500/50 focus:ring-1 focus:ring-emerald-500/20 light:focus:ring-orange-500/20
            transition-colors"
        />
      </div>
      <p className="text-[10px] text-gray-600 light:text-gray-500 leading-tight">
        输入品牌和产品名，避免模型错误翻译或改写
      </p>
    </div>
  );
}
