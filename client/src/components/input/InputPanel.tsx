import { useContext, useState, type ReactNode } from 'react';
import {
  RefreshCw,
  ChevronDown,
  Building2,
  SlidersHorizontal,
  Users,
  FolderCog,
  type LucideIcon,
} from 'lucide-react';
import { useGenerate } from '../../hooks/useGenerate';
import { AppContext } from '../../context/AppContext';
import SourceEditor from './SourceEditor';
import LanguageToggle from './LanguageToggle';
import BrandInput from './BrandInput';
import BrandRedLinesInput from './BrandRedLinesInput';
import ProductSellingPointsInput from './ProductSellingPointsInput';
import StructuredBriefToggle from './StructuredBriefToggle';
import CreativitySliderComponent from './CreativitySlider';
import PlatformSelector from './PlatformSelector';
import CopyTypeSelector from './CopyTypeSelector';
import LengthControl from './LengthControl';
import ToneSelector from './ToneSelector';
import CantoneseSlider from './CantoneseSlider';
import EnglishMixingSlider from './EnglishMixingSlider';
import PersonaManager from './PersonaManager';
import TargetDatePicker from './TargetDatePicker';
import CompetitorSearchInput from './CompetitorSearchInput';
import ReferenceCaseSelector from './ReferenceCaseSelector';
import CaseLibraryPanel from './CaseLibraryPanel';
import ConfigManager from './ConfigManager';
import ConfirmDialog from '../shared/ConfirmDialog';

/**
 * Collapsible group for the left workbench column.
 * Content stays mounted when collapsed (hidden) so drafts / case library / configs keep state.
 */
function InputAccordion({
  id,
  title,
  summary,
  icon: Icon,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `input-accordion-panel-${id}`;
  const headerId = `input-accordion-header-${id}`;

  return (
    <section
      data-accordion
      data-testid={`input-accordion-${id}`}
      className="rounded-lg border border-gray-800/60 bg-gray-900/30 light:border-gray-200 light:bg-white/60"
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:hover:bg-gray-50 light:focus-visible:ring-orange-500"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 light:bg-orange-50 light:text-orange-600">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-gray-100 light:text-gray-900">
            {title}
          </span>
          <span className="block truncate text-[10px] text-gray-500 light:text-gray-500">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-emerald-400 transition-transform duration-200 light:text-orange-500 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        data-testid={panelId}
        aria-hidden={!open}
        className={open ? 'flex flex-col gap-4 px-3 pb-3' : 'hidden'}
      >
        {children}
      </div>
    </section>
  );
}

export default function InputPanel() {
  const { generate, isLoading, canGenerate, quotaDialogOpen, closeQuotaDialog } = useGenerate();
  const { state } = useContext(AppContext);
  const hasResults = state.variants !== null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div data-testid="input-section-source" className="flex flex-col gap-4">
        <SourceEditor />
        <LanguageToggle />
      </div>

      <InputAccordion
        id="brand"
        title="品牌与内容场景"
        summary="类型 · 品牌 · 红线 · 发布日 · 竞品"
        icon={Building2}
        defaultOpen={false}
      >
        <CopyTypeSelector />
        <BrandInput />
        <BrandRedLinesInput />
        <ProductSellingPointsInput />
        <TargetDatePicker />
        <CompetitorSearchInput />
      </InputAccordion>

      <InputAccordion
        id="params"
        title="文案参数"
        summary="Brief · 创意 · 平台 · 篇幅 · 语气 · 港味"
        icon={SlidersHorizontal}
        defaultOpen={false}
      >
        <StructuredBriefToggle />
        <CreativitySliderComponent />
        <PlatformSelector />
        <LengthControl />
        <ToneSelector />
        <CantoneseSlider />
        <EnglishMixingSlider />
      </InputAccordion>

      <InputAccordion
        id="audience"
        title="目标受众与参考"
        summary="画像 · 参考收藏 · 正反例库"
        icon={Users}
        defaultOpen={false}
      >
        <PersonaManager />
        <ReferenceCaseSelector />
        <CaseLibraryPanel />
      </InputAccordion>

      <InputAccordion
        id="config"
        title="配置管理"
        summary="保存与载入工作台参数"
        icon={FolderCog}
        defaultOpen={false}
      >
        <ConfigManager />
      </InputAccordion>

      <div className="flex gap-2">
        <button
          onClick={() => generate()}
          disabled={!canGenerate}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
            canGenerate
              ? 'cursor-pointer bg-emerald-500 text-gray-950 hover:bg-emerald-400 active:scale-[0.98] light:bg-orange-500 light:text-white light:hover:bg-orange-600'
              : 'cursor-not-allowed bg-gray-800 text-gray-600 light:bg-gray-100 light:text-gray-500'
          }`}
        >
          {isLoading ? '生成中...' : '🚀 生成文案'}
        </button>
        {hasResults && (
          <button
            onClick={() => generate(true)}
            disabled={isLoading}
            title="同参数换一种写法，产出不同的版本"
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
              !isLoading
                ? 'cursor-pointer border border-amber-500/30 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 light:text-amber-600'
                : 'cursor-not-allowed border border-gray-700/30 bg-gray-800/20 text-gray-500'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex animate-pulse items-center justify-center gap-2 text-xs text-gray-500 light:text-gray-500">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 light:bg-orange-500" />
          正在调用粤语模型生成中，请稍候...
        </div>
      )}

      {/* Free quota exhausted — only opened when API returns HTTP 402 */}
      <ConfirmDialog
        open={quotaDialogOpen}
        title="账户配额不足"
        message="当前 Free 套餐的生成额度已用完。升级 Pro 后可继续生成，并解锁完整收藏与历史访问。"
        cancelLabel="暂不充值"
        confirmLabel="充值 Pro"
        onCancel={closeQuotaDialog}
        onConfirm={() => {
          closeQuotaDialog();
          window.location.assign('/app/billing');
        }}
      />
    </div>
  );
}
