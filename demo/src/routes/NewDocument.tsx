import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gateApi } from '../storage/gate-api';

const DEFAULT_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
};

export function NewDocument() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createDocument = async () => {
      try {
        const uuid = await gateApi.upload(DEFAULT_DOCUMENT);
        navigate(`/document/${uuid}`, { replace: true });
      } catch (e) {
        console.error('Failed to create document:', e);
        setError(e instanceof Error ? e.message : 'Failed to create document');
      }
    };

    createDocument();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-500">Error: {error}</p>
        <p className="text-sm text-gray-500">
          Make sure the gate server is running at localhost:8080
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Creating new document...</p>
    </div>
  );
}
