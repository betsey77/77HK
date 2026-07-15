interface BrandLoaderProps {
  label?: string;
  fullPage?: boolean;
}

export default function BrandLoader({ label = '正在准备…', fullPage = false }: BrandLoaderProps) {
  return (
    <div className={`brand-loader-wrap${fullPage ? ' brand-loader-full' : ''}`} role="status" aria-live="polite">
      <div className="brand-loader" aria-hidden="true">
        <span className="brand-loader-orbit brand-loader-orbit-outer" />
        <span className="brand-loader-orbit brand-loader-orbit-inner" />
        <strong>77</strong>
      </div>
      <span className="brand-loader-label text-emerald-400 light:text-orange-500">{label}</span>
    </div>
  );
}
