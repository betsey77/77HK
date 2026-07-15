import BrandLoader from './BrandLoader';

interface SpinnerProps {
  label?: string;
}

export default function Spinner({ label = '生成中...' }: SpinnerProps) {
  return <BrandLoader label={label} />;
}
