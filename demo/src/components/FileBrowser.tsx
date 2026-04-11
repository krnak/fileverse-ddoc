import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, toast } from '@fileverse/ui';
import { gateApi, FileSystemEntry } from '../storage/gate-api';
import { useAuth } from './AuthOverlay';

const GATE_BASE_URL =
  import.meta.env.VITE_GATE_BASE_URL || 'https://liqk.local.dev';

interface TreeNode {
  entry: FileSystemEntry;
  children: TreeNode[] | null;
  isExpanded: boolean;
  isLoading: boolean;
  parentUri: string | null;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
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
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  onDragEnd,
  dragOverUri,
}: {
  node: TreeNode;
  depth: number;
  onToggle: (uri: string) => void;
  onFileClick: (entry: FileSystemEntry) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onDragStart: (e: React.DragEvent, node: TreeNode) => void;
  onDragOver: (e: React.DragEvent, node: TreeNode) => void;
  onDrop: (e: React.DragEvent, node: TreeNode) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
  dragOverUri: string | null;
}) {
  const isDir = node.entry.type === 'directory';
  const canDrag = node.parentUri !== null;
  const isDragOver = dragOverUri === node.entry.uri;

  return (
    <>
      <button
        className={`flex items-center gap-1.5 w-full px-2 py-1.5 text-sm rounded hover:color-bg-default-hover text-left color-text-default transition-colors ${isDragOver ? 'ring-2 ring-blue-400' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => (isDir ? onToggle(node.entry.uri) : onFileClick(node.entry))}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={canDrag}
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={(e) => onDragOver(e, node)}
        onDrop={(e) => onDrop(e, node)}
        onDragLeave={onDragLeave}
        onDragEnd={onDragEnd}
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
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragLeave={onDragLeave}
              onDragEnd={onDragEnd}
              dragOverUri={dragOverUri}
            />
          ))}
          {node.children.length === 0 && (
            <div
              className="text-xs color-text-secondary italic py-1"
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
  const [dragOverUri, setDragOverUri] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('file_browser_width');
    return saved ? Number(saved) : 288;
  });
  const navigate = useNavigate();
  const { tokenHash } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ entryUri: string; parentUri: string } | null>(null);
  const isResizing = useRef(false);

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
          parentUri: null,
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
    loadRoot();
  }, [loadRoot]);

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
        parentUri: uri,
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
      if (entry.mimeType === 'application/json' || entry.mimeType === 'text/markdown' || entry.label.endsWith('.md')) {
        navigate(`/document/${uuid}`);
      } else {
        window.open(`${GATE_BASE_URL}/res/${uuid}`, '_blank');
      }
    },
    [navigate],
  );

  const handleDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
    if (node.parentUri === null) {
      e.preventDefault();
      return;
    }
    dragRef.current = { entryUri: node.entry.uri, parentUri: node.parentUri };
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, node: TreeNode) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (node.entry.type !== 'directory') return;
    if (node.entry.uri === drag.entryUri) return;
    if (node.entry.uri === drag.parentUri) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverUri(node.entry.uri);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetNode: TreeNode) => {
    e.preventDefault();
    setDragOverUri(null);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    const { entryUri, parentUri: fromDirUri } = drag;
    const toDirUri = targetNode.entry.uri;

    if (fromDirUri === toDirUri) return;
    if (entryUri === toDirUri) return;
    if (isDescendantOf(tree, entryUri, toDirUri)) return;

    // Optimistic UI update
    setTree((prev) => {
      // Find the node being moved
      const movedNode = findNode(prev, entryUri);
      if (!movedNode) return prev;

      // Remove from old parent
      let updated = updateNode(prev, fromDirUri, (n) => ({
        ...n,
        children: n.children ? n.children.filter((c) => c.entry.uri !== entryUri) : null,
      }));

      // Add to new parent if its children are loaded
      updated = updateNode(updated, toDirUri, (n) => ({
        ...n,
        children: n.children
          ? [...n.children, { ...movedNode, parentUri: toDirUri }]
          : null,
      }));

      return updated;
    });

    try {
      await gateApi.moveEntry(entryUri, fromDirUri, toDirUri);
    } catch (err) {
      console.error('Failed to move entry:', err);
      // Revert by re-fetching both directories
      try {
        const [fromEntries, toEntries] = await Promise.all([
          gateApi.listDirectory(fromDirUri),
          gateApi.listDirectory(toDirUri),
        ]);
        setTree((prev) => {
          let updated = updateNode(prev, fromDirUri, (n) => ({
            ...n,
            children: fromEntries.map((entry) => ({
              entry,
              children: null,
              isExpanded: false,
              isLoading: false,
              parentUri: fromDirUri,
            })),
          }));
          updated = updateNode(updated, toDirUri, (n) => ({
            ...n,
            children: toEntries.map((entry) => ({
              entry,
              children: null,
              isExpanded: false,
              isLoading: false,
              parentUri: toDirUri,
            })),
          }));
          return updated;
        });
      } catch {
        // If revert also fails, reload root
        loadRoot();
      }
    }
  }, [tree, loadRoot]);

  const handleDragLeave = useCallback(() => {
    setDragOverUri(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    setDragOverUri(null);
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(500, Math.max(200, e.clientX));
      setPanelWidth(newWidth);
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setPanelWidth((w) => {
        localStorage.setItem('file_browser_width', String(w));
        return w;
      });
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRemove = useCallback(async (node: TreeNode) => {
    closeContextMenu();
    if (!node.parentUri) return;

    const parentUri = node.parentUri;

    // Optimistic: remove from tree
    setTree((prev) =>
      updateNode(prev, parentUri, (n) => ({
        ...n,
        children: n.children ? n.children.filter((c) => c.entry.uri !== node.entry.uri) : null,
      })),
    );

    try {
      await gateApi.removeFromDirectory(node.entry.uri, parentUri);
    } catch (err) {
      console.error('Failed to remove entry:', err);
      // Rollback by re-fetching directory
      try {
        const entries = await gateApi.listDirectory(parentUri);
        setTree((prev) =>
          updateNode(prev, parentUri, (n) => ({
            ...n,
            children: entries.map((entry) => ({
              entry,
              children: null,
              isExpanded: false,
              isLoading: false,
              parentUri,
            })),
          })),
        );
      } catch {
        loadRoot();
      }
      toast({ title: 'Failed to remove entry', variant: 'danger', hasIcon: true });
    }
  }, [closeContextMenu, loadRoot]);

  const DEFAULT_DOCUMENT = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  };

  const handleNewFile = useCallback(async (
    dirNode: TreeNode,
    fileName: string,
    content: string | object,
    contentType: string,
  ) => {
    closeContextMenu();

    try {
      const uuid = await gateApi.createFileInDirectory(
        dirNode.entry.uri,
        content,
        fileName,
        contentType,
      );

      const newFileNode: TreeNode = {
        entry: {
          uri: `urn:uuid:${uuid}`,
          label: fileName,
          type: 'file',
          mimeType: contentType,
        },
        children: null,
        isExpanded: false,
        isLoading: false,
        parentUri: dirNode.entry.uri,
      };

      setTree((prev) =>
        updateNode(prev, dirNode.entry.uri, (n) => ({
          ...n,
          isExpanded: true,
          children: n.children ? [...n.children, newFileNode] : [newFileNode],
        })),
      );

      navigate(`/document/${uuid}`);
    } catch (err) {
      console.error('Failed to create file:', err);
      toast({ title: 'Failed to create file', variant: 'danger', hasIcon: true });
    }
  }, [closeContextMenu, navigate]);

  // Close context menu on scroll/resize
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [contextMenu]);

  return (
    <div
      ref={panelRef}
      className={`relative shrink-0 border-r color-border-default color-bg-secondary h-full overflow-hidden transition-[width] duration-200 flex flex-col ${!isOpen ? 'w-0 !border-r-0' : ''}`}
      style={isOpen ? { width: panelWidth } : undefined}
    >
      <div className="flex items-center justify-between p-4 pb-2">
        <h3 className="text-lg font-semibold color-text-default whitespace-nowrap">
          Files
        </h3>
        <button
          onClick={onClose}
          className="color-text-secondary hover:color-text-default transition-colors p-1 rounded-full hover:color-bg-default-hover"
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
          onClick={() => navigate('/document/new')}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium color-text-link rounded-lg border border-dashed color-border-default hover:brightness-95 transition-colors whitespace-nowrap"
        >
          <LucideIcon name="Plus" size="sm" />
          New Document
        </button>
      </div>

      <div className="flex-1 custom-scrollbar px-2 pb-4">
        {rootLoading && (
          <div className="flex items-center justify-center py-8">
            <LucideIcon name="Loader2" size="md" className="animate-spin color-text-secondary" />
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
          <div className="px-2 py-4 text-sm color-text-secondary text-center italic">
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
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            dragOverUri={dragOverUri}
          />
        ))}
      </div>

      {/* Drag handle for resizing */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:color-bg-default-selected transition-colors"
        onMouseDown={handleResizeMouseDown}
      />

      {contextMenu && (contextMenu.node.entry.type === 'directory' || contextMenu.node.parentUri !== null) && createPortal(
        <ContextMenuPopup
          state={contextMenu}
          onClose={closeContextMenu}
          onRemove={handleRemove}
          onNewDdoc={(node) => handleNewFile(node, 'Untitled.json', DEFAULT_DOCUMENT, 'application/json')}
          onNewMarkdown={(node) => handleNewFile(node, 'Untitled.md', '', 'text/markdown')}
        />,
        document.body,
      )}
    </div>
  );
}

function ContextMenuPopup({
  state,
  onClose,
  onRemove,
  onNewDdoc,
  onNewMarkdown,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onRemove: (node: TreeNode) => void;
  onNewDdoc: (node: TreeNode) => void;
  onNewMarkdown: (node: TreeNode) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { node, x, y } = state;
  const isDir = node.entry.type === 'directory';
  const canRemove = node.parentUri !== null;

  // Clamp position to viewport
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : x,
      y: y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 4 : y,
    });
  }, [x, y]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[180px] py-1 rounded-lg border color-border-default color-bg-secondary shadow-lg"
        style={{ left: pos.x, top: pos.y }}
      >
        {isDir && (
          <>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm color-text-default hover:color-bg-default-hover text-left"
              onClick={() => onNewDdoc(node)}
            >
              <LucideIcon name="FilePlus" size="sm" />
              New DDoc
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm color-text-default hover:color-bg-default-hover text-left"
              onClick={() => onNewMarkdown(node)}
            >
              <LucideIcon name="FileCode" size="sm" />
              New Markdown
            </button>
          </>
        )}
        {isDir && canRemove && (
          <div className="my-1 border-t color-border-default" />
        )}
        {canRemove && (
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-500 hover:color-bg-default-hover text-left"
            onClick={() => onRemove(node)}
          >
            <LucideIcon name="Trash2" size="sm" />
            Remove
          </button>
        )}
      </div>
    </>
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

function isDescendantOf(nodes: TreeNode[], ancestorUri: string, targetUri: string): boolean {
  const ancestor = findNode(nodes, ancestorUri);
  if (!ancestor || !ancestor.children) return false;
  for (const child of ancestor.children) {
    if (child.entry.uri === targetUri) return true;
    if (child.children && isDescendantOf([child], child.entry.uri, targetUri)) return true;
  }
  return false;
}
