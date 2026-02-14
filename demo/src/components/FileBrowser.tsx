import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon } from '@fileverse/ui';
import { useOnClickOutside } from 'usehooks-ts';
import { gateApi, FileSystemEntry } from '../storage/gate-api';
import { useAuth } from './AuthOverlay';

const GATE_BASE_URL =
  import.meta.env.VITE_GATE_BASE_URL || 'https://liqk.local.dev';

interface TreeNode {
  entry: FileSystemEntry;
  children: TreeNode[] | null;
  isExpanded: boolean;
  isLoading: boolean;
}

interface FileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

function updateNode(
  nodes: TreeNode[],
  uri: string,
  updater: (node: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.entry.uri === uri) return updater(node);
    if (node.children) {
      return { ...node, children: updateNode(node.children, uri, updater) };
    }
    return node;
  });
}

function TreeItem({
  node,
  depth,
  onToggle,
  onFileClick,
}: {
  node: TreeNode;
  depth: number;
  onToggle: (uri: string) => void;
  onFileClick: (entry: FileSystemEntry) => void;
}) {
  const isDir = node.entry.type === 'directory';

  return (
    <>
      <button
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-slate-700 dark:text-slate-200 transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => (isDir ? onToggle(node.entry.uri) : onFileClick(node.entry))}
      >
        {isDir ? (
          node.isLoading ? (
            <LucideIcon name="Loader2" size="sm" className="animate-spin shrink-0" />
          ) : (
            <LucideIcon
              name={node.isExpanded ? 'ChevronDown' : 'ChevronRight'}
              size="sm"
              className="shrink-0"
            />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <LucideIcon
          name={isDir ? 'Folder' : 'FileText'}
          size="sm"
          className="shrink-0"
        />
        <span className="truncate">{node.entry.label}</span>
      </button>
      {isDir && node.isExpanded && node.children && (
        <>
          {node.children.map((child) => (
            <TreeItem
              key={child.entry.uri}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onFileClick={onFileClick}
            />
          ))}
          {node.children.length === 0 && (
            <div
              className="text-xs text-slate-400 dark:text-slate-500 italic py-1"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              Empty
            </div>
          )}
        </>
      )}
    </>
  );
}

export function FileBrowser({ isOpen, onClose }: FileBrowserProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { tokenHash } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(panelRef as React.RefObject<HTMLElement>, onClose);

  const loadRoot = useCallback(async () => {
    setRootLoading(true);
    setError(null);
    try {
      const entries = await gateApi.listAccessibleRoots(tokenHash);
      setTree(
        entries.map((entry) => ({
          entry,
          children: null,
          isExpanded: false,
          isLoading: false,
        })),
      );
    } catch (e) {
      console.error('Failed to load root directory:', e);
      setError('Failed to load filesystem');
    } finally {
      setRootLoading(false);
    }
  }, [tokenHash]);

  useEffect(() => {
    if (isOpen) loadRoot();
  }, [isOpen, loadRoot]);

  const handleToggle = useCallback(async (uri: string) => {
    setTree((prev) => {
      const node = findNode(prev, uri);
      if (!node) return prev;

      // If already loaded, just toggle
      if (node.children !== null) {
        return updateNode(prev, uri, (n) => ({
          ...n,
          isExpanded: !n.isExpanded,
        }));
      }

      // Mark as loading
      return updateNode(prev, uri, (n) => ({ ...n, isLoading: true }));
    });

    // Check if we need to fetch
    const node = findNode(tree, uri);
    if (node?.children !== null) return;

    try {
      const entries = await gateApi.listDirectory(uri);
      const children: TreeNode[] = entries.map((entry) => ({
        entry,
        children: null,
        isExpanded: false,
        isLoading: false,
      }));
      setTree((prev) =>
        updateNode(prev, uri, (n) => ({
          ...n,
          children,
          isExpanded: true,
          isLoading: false,
        })),
      );
    } catch (e) {
      console.error('Failed to load directory:', e);
      setTree((prev) =>
        updateNode(prev, uri, (n) => ({ ...n, isLoading: false })),
      );
    }
  }, [tree]);

  const handleFileClick = useCallback(
    (entry: FileSystemEntry) => {
      const uuid = entry.uri.replace('urn:uuid:', '');
      if (entry.mimeType === 'application/json') {
        navigate(`/document/${uuid}`);
        onClose();
      } else {
        window.open(`${GATE_BASE_URL}/res/${uuid}`, '_blank');
      }
    },
    [navigate, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed top-[108px] left-4 z-50 w-72 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl backdrop-blur-sm max-h-[calc(100vh-120px)] flex flex-col"
    >
      <div className="flex items-center justify-between p-4 pb-2">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Files
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Close panel"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-2">
        <button
          onClick={() => {
            navigate('/document/new');
            onClose();
          }}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg border border-dashed border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <LucideIcon name="Plus" size="sm" />
          New Document
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {rootLoading && (
          <div className="flex items-center justify-center py-8">
            <LucideIcon name="Loader2" size="md" className="animate-spin text-slate-400" />
          </div>
        )}
        {error && (
          <div className="px-2 py-4 text-sm text-red-500 text-center">
            {error}
            <button
              onClick={loadRoot}
              className="block mx-auto mt-2 text-xs text-blue-500 hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {!rootLoading && !error && tree.length === 0 && (
          <div className="px-2 py-4 text-sm text-slate-400 text-center italic">
            No files found
          </div>
        )}
        {tree.map((node) => (
          <TreeItem
            key={node.entry.uri}
            node={node}
            depth={0}
            onToggle={handleToggle}
            onFileClick={handleFileClick}
          />
        ))}
      </div>
    </div>
  );
}

function findNode(nodes: TreeNode[], uri: string): TreeNode | null {
  for (const node of nodes) {
    if (node.entry.uri === uri) return node;
    if (node.children) {
      const found = findNode(node.children, uri);
      if (found) return found;
    }
  }
  return null;
}
