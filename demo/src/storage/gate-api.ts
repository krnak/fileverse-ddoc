import { JSONContent } from '@tiptap/react';

const GATE_BASE_URL = import.meta.env.VITE_GATE_BASE_URL || 'https://liqk.local.dev';

// UUID of the /upload folder in the filesystem
const UPLOAD_FOLDER_UUID = 'urn:uuid:72cec723-a40d-4f37-af4a-e664e66ecbe3';

interface UploadResponse {
  success: boolean;
  files: { filename: string; uuid: string }[];
}

export const gateApi = {
  /**
   * Add a file to the upload folder via SPARQL UPDATE
   */
  async addToUploadFolder(fileUuid: string): Promise<void> {
    const sparqlUpdate = `
      PREFIX posix: <http://www.w3.org/ns/posix/stat#>
      INSERT DATA {
        GRAPH <http://liqk.org/graph/filesystem> {
          <${UPLOAD_FOLDER_UUID}> posix:includes <urn:uuid:${fileUuid}> .
        }
      }
    `;

    const response = await fetch(`${GATE_BASE_URL}/update`, {
      method: 'POST',
      body: sparqlUpdate,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/sparql-update',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to add file to upload folder: ${response.status} ${response.statusText}`);
    }
  },

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
    formData.append('files', file);

    const response = await fetch(`${GATE_BASE_URL}/res`, {
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

    const uuid = data.files[0].uuid;

    // Add the new file to the upload folder
    await this.addToUploadFolder(uuid);

    return uuid;
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
