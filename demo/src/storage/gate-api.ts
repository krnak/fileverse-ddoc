import { JSONContent } from '@tiptap/react';

const GATE_BASE_URL = 'https://local.dev';

interface UploadResponse {
  success: boolean;
  files: { filename: string; uuid: string }[];
}

export const gateApi = {
  /**
   * Upload a new document and get its UUID
   */
  async upload(content: JSONContent): Promise<string> {
    const blob = new Blob([JSON.stringify(content)], {
      type: 'application/json',
    });
    const file = new File([blob], 'document.json', {
      type: 'application/json',
    });

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${GATE_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include', // Include cookies for auth
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const data: UploadResponse = await response.json();
    if (!data.success || !data.files.length) {
      throw new Error('Upload failed: No file returned');
    }

    return data.files[0].uuid;
  },

  /**
   * Load document content by UUID
   */
  async load(uuid: string): Promise<JSONContent | null> {
    try {
      const response = await fetch(`${GATE_BASE_URL}/res/${uuid}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Load failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (e) {
      console.error('Failed to load document:', e);
      return null;
    }
  },

  /**
   * Save/update document content by UUID
   */
  async save(uuid: string, content: JSONContent): Promise<boolean> {
    try {
      const response = await fetch(`${GATE_BASE_URL}/res/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify(content),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (e) {
      console.error('Failed to save document:', e);
      return false;
    }
  },
};
