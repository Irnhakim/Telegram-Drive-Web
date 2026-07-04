import { useState, useEffect, useCallback } from 'react';
import { foldersApi, filesApi } from '../../api/client';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { FileExplorer } from './FileExplorer';
import { UploadProgress } from './UploadProgress';
import type { UserInfo, TelegramFolder, TelegramFile, ViewMode, SortField, SortOrder, UploadItem } from '../../types';

interface DashboardProps {
  user: UserInfo | null;
  onLogout: () => void;
  onAccessLogout?: () => void;
}

export function Dashboard({ user, onLogout, onAccessLogout }: DashboardProps) {
  const [folders, setFolders] = useState<TelegramFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState('me');
  const [files, setFiles] = useState<TelegramFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);

  // Load folders
  useEffect(() => {
    const loadFolders = async () => {
      setLoadingFolders(true);
      try {
        const result = await foldersApi.list();
        setFolders(result.folders);
      } catch (err) {
        console.error('Failed to load folders:', err);
      } finally {
        setLoadingFolders(false);
      }
    };
    loadFolders();
  }, []);

  // Load files when folder/search/sort changes
  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await filesApi.list({
        folderId: currentFolderId,
        limit: 100,
        search: searchQuery,
        sort: sortField,
        order: sortOrder,
      });
      setFiles(result.files);
      setTotalFiles(result.total);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, searchQuery, sortField, sortOrder]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Handle file upload
  const handleUpload = useCallback(async (fileList: FileList) => {
    const newUploads: UploadItem[] = Array.from(fileList).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      file,
      progress: 0,
      status: 'pending' as const,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    for (const upload of newUploads) {
      setUploads((prev) =>
        prev.map((u) => u.id === upload.id ? { ...u, status: 'uploading' } : u)
      );

      try {
        await filesApi.upload(upload.file, currentFolderId, (progress) => {
          setUploads((prev) =>
            prev.map((u) => u.id === upload.id ? { ...u, progress } : u)
          );
        });

        setUploads((prev) =>
          prev.map((u) => u.id === upload.id ? { ...u, status: 'success', progress: 100 } : u)
        );
      } catch (err: any) {
        setUploads((prev) =>
          prev.map((u) => u.id === upload.id ? { ...u, status: 'error', error: err.message } : u)
        );
      }
    }

    // Refresh file list
    loadFiles();

    // Auto-clear completed uploads after 3s
    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status !== 'success'));
    }, 3000);
  }, [currentFolderId, loadFiles]);

  // Handle file delete
  const handleDelete = useCallback(async (fileId: number) => {
    try {
      await filesApi.delete(fileId, currentFolderId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [currentFolderId]);

  // Handle file rename
  const handleRename = useCallback(async (fileId: number, newName: string) => {
    try {
      await filesApi.rename(fileId, newName, currentFolderId);
      loadFiles();
    } catch (err) {
      console.error('Rename failed:', err);
    }
  }, [currentFolderId, loadFiles]);

  // Handle folder creation
  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      const result = await foldersApi.create(name);
      setFolders((prev) => [...prev, result.folder]);
    } catch (err) {
      console.error('Create folder failed:', err);
    }
  }, []);

  // Dismiss upload
  const handleDismissUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  const currentFolder = folders.find((f) => f.id === currentFolderId);

  return (
    <div className="app-layout">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        folders={folders}
        currentFolderId={currentFolderId}
        loading={loadingFolders}
        user={user}
        open={sidebarOpen}
        onSelectFolder={(id) => { setCurrentFolderId(id); setSidebarOpen(false); }}
        onCreateFolder={handleCreateFolder}
        onLogout={onLogout}
        onAccessLogout={onAccessLogout}
      />

      <div className="main-content">
        <TopBar
          currentFolder={currentFolder}
          viewMode={viewMode}
          searchQuery={searchQuery}
          sortField={sortField}
          sortOrder={sortOrder}
          totalFiles={totalFiles}
          onViewModeChange={setViewMode}
          onSearchChange={setSearchQuery}
          onSortFieldChange={setSortField}
          onSortOrderChange={setSortOrder}
          onUpload={handleUpload}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onRefresh={loadFiles}
        />

        <FileExplorer
          files={files}
          loading={loading}
          viewMode={viewMode}
          currentFolderId={currentFolderId}
          folders={folders}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onRename={handleRename}
          onRefresh={loadFiles}
        />
      </div>

      {uploads.length > 0 && (
        <UploadProgress uploads={uploads} onDismiss={handleDismissUpload} />
      )}
    </div>
  );
}
