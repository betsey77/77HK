import { useContext } from 'react';
import { RefreshCw } from 'lucide-react';
import { useGenerate } from '../../hooks/useGenerate';
import { AppContext } from '../../context/AppContext';
import SourceEditor from './SourceEditor';
import LanguageToggle from './LanguageToggle';
import BrandInput from './BrandInput';
import BrandRedLinesInput from './BrandRedLinesInput';
import StructuredBriefToggle from './StructuredBriefToggle';
import CreativitySliderComponent from './CreativitySlider';
import PlatformSelector from './PlatformSelector';
import ToneSelector from './ToneSelector';
import CantoneseSlider from './CantoneseSlider';
import EnglishMixingSlider from './EnglishMixingSlider';
import PersonaManager from './PersonaManager';
import TargetDatePicker from './TargetDatePicker';
import CompetitorSearchInput from './CompetitorSearchInput';
import ReferenceCaseSelector from './ReferenceCaseSelector';
import ConfigManager from './ConfigManager';

export default function InputPanel() {
  const { generate, isLoading, canGenerate } = useGenerate();
  const { state } = useContext(AppContext);
  const hasResults = state.variants !== null;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-4">
      <SourceEditor />

      <LanguageToggle />

      <BrandInput />

      <BrandRedLinesInput />

      <TargetDatePicker />

      <CompetitorSearchInput />

      <StructuredBriefToggle />

      <CreativitySliderComponent />

      <PlatformSelector />

      <ToneSelector />

      <CantoneseSlider />

      <EnglishMixingSlider />

      <PersonaManager />

      <ConfigManager />

      <ReferenceCaseSelector />

      <div className="flex gap-2">
        <button
          onClick={() => generate()}
          disabled={!canGenerate}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            canGenerate
              ? 'bg-emerald-500 light:bg-orange-500 text-gray-950 light:text-white hover:bg-emerald-400 light:hover:bg-orange-600 active:scale-[0.98] cursor-pointer'
              : 'bg-gray-800 light:bg-gray-100 text-gray-600 light:text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? '生成中...' : '🚀 生成文案'}
        </button>
        {hasResults && (
          <button
            onClick={() => generate(true)}
            disabled={isLoading}
            title="同参数换一种写法，产出不同的版本"
            className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
              !isLoading
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 light:text-amber-600 hover:bg-amber-500/30 cursor-pointer'
                : 'bg-gray-800/20 border border-gray-700/30 text-gray-500 cursor-not-allowed'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 light:text-gray-500 animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 light:bg-orange-500" />
          正在调用粤语模型生成中，请稍候...
        </div>
      )}
    </div>
  );
}
