import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { FileBrowser } from './components/FileBrowser';

export interface LayoutContext {
  showFileBrowser: boolean;
  toggleFileBrowser: () => void;
}

export function Layout() {
  const [showFileBrowser, setShowFileBrowser] = useState(() => {
    return localStorage.getItem('file_browser_open') === 'true';
  });

  const toggleFileBrowser = () => {
    setShowFileBrowser((prev) => {
      localStorage.setItem('file_browser_open', String(!prev));
      return !prev;
    });
  };

  const closeBrowser = () => {
    setShowFileBrowser(false);
    localStorage.setItem('file_browser_open', 'false');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <FileBrowser isOpen={showFileBrowser} onClose={closeBrowser} />
      <div className="flex-1 min-w-0 overflow-hidden [transform:translateX(0)]">
        <Outlet context={{ showFileBrowser, toggleFileBrowser } satisfies LayoutContext} />
      </div>
    </div>
  );
}
