import { JSONContent } from '@tiptap/react';

const STORAGE_KEY = 'ddoc-document';
const DEFAULT_DOC_PATH = '/document.json';

export const documentStore = {
  /**
   * Load document from localStorage, or fall back to default file
   */
  async load(): Promise<JSONContent | null> {
    // First try localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved document:', e);
      }
    }

    // Fall back to default document file
    try {
      const response = await fetch(DEFAULT_DOC_PATH);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Failed to load default document:', e);
    }

    return null;
  },

  /**
   * Save document to localStorage
   */
  save(content: JSONContent): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
    } catch (e) {
      console.error('Failed to save document:', e);
    }
  },

  /**
   * Export document to a downloadable JSON file
   */
  exportToFile(content: JSONContent, filename = 'document.json'): void {
    const blob = new Blob([JSON.stringify(content, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Import document from a file picker
   */
  async importFromFile(): Promise<JSONContent | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const text = await file.text();
          const content = JSON.parse(text);
          resolve(content);
        } catch (err) {
          console.error('Failed to import file:', err);
          resolve(null);
        }
      };
      input.click();
    });
  },

  /**
   * Clear saved document from localStorage
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
