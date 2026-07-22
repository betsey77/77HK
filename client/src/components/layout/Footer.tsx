import { APP_DISPLAY_VERSION } from '../../constants/releaseNotes';

export default function Footer() {
  return (
    <footer className="flex items-center justify-between px-4 py-1.5 border-t border-gray-800 light:border-gray-200 bg-gray-950 light:bg-white shrink-0">
      <span className="text-[10px] text-gray-700 light:text-gray-600">
        Powered by CANTONESE API
      </span>
      <span className="text-[10px] text-gray-700 light:text-gray-600">
        v{APP_DISPLAY_VERSION}
      </span>
    </footer>
  );
}
