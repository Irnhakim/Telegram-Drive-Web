import { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { foldersApi, filesApi } from '../../api/client';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { FileExplorer } from './FileExplorer';
import { UploadProgress } from './UploadProgress';
import type { UserInfo, TelegramFolder, TelegramFile, ViewMode, UploadItem } from '../../types';

interface DashboardProps {
  user: UserInfo | null;
  onLogout: () => void;
  onAccessLogout?: () => void;
}

export function Dashboard({ user, onLogout, onAccessLogout }: DashboardProps) {
  const [folders, setFolders] = useState<TelegramFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState('me');
  const [files, setFiles] = useState<TelegramFile[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleToggleSidebar = useCallback(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, []);

  // Theme support
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  // Apply theme class to :root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Load folders
  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const result = await foldersApi.list();
      setFolders(result.folders);
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Load files when folder/search changes
  const loadFiles = useCallback(async () => {
    try {
      const result = await filesApi.list({
        folderId: currentFolderId,
        limit: 100,
        search: searchQuery,
      });
      setFiles(result.files);
      setTotalFiles(result.total);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  }, [currentFolderId, searchQuery]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Handle file upload
  const handleUpload = useCallback(async (fileList: FileList) => {
    // 1. Group files by top-level folder name (if any have webkitRelativePath)
    const filesToUpload: File[] = [];
    const folderGroups: Record<string, File[]> = {};

    for (const file of Array.from(fileList)) {
      if (file.webkitRelativePath && file.webkitRelativePath.includes('/')) {
        const folderName = file.webkitRelativePath.split('/')[0];
        if (!folderGroups[folderName]) {
          folderGroups[folderName] = [];
        }
        folderGroups[folderName].push(file);
      } else {
        filesToUpload.push(file);
      }
    }

    // 2. Zip each folder group
    for (const [folderName, folderFiles] of Object.entries(folderGroups)) {
      try {
        const zip = new JSZip();
        for (const file of folderFiles) {
          // Add file to zip using its full relative path
          zip.file(file.webkitRelativePath, file);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const zippedFile = new File([blob], `${folderName}.zip`, {
          type: 'application/zip',
          lastModified: Date.now()
        });
        filesToUpload.push(zippedFile);
      } catch (err) {
        console.error(`Failed to zip folder "${folderName}":`, err);
        // Fallback: upload files individually if zip creation fails
        filesToUpload.push(...folderFiles);
      }
    }

    // 3. Create upload queue items
    const newUploads: UploadItem[] = filesToUpload.map((file) => ({
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

  // Handle selection toggles
  const handleToggleSelectFile = useCallback((fileId: number) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedFileIds([]);
  }, []);

  // Handle Bulk Delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedFileIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedFileIds.length} selected files?`)) return;

    try {
      await filesApi.bulkDelete(selectedFileIds, currentFolderId);
      setFiles((prev) => prev.filter((f) => !selectedFileIds.includes(f.id)));
      setSelectedFileIds([]);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  }, [selectedFileIds, currentFolderId]);

  // Handle Bulk Move
  const handleBulkMove = useCallback(async () => {
    if (selectedFileIds.length === 0) return;
    
    // Find target folders
    const availableFolders = folders.filter((f) => f.id !== currentFolderId);
    if (availableFolders.length === 0) {
      alert('No other folders available to move files to.');
      return;
    }

    const folderNamesStr = availableFolders.map((f, index) => `${index + 1}. ${f.name}`).join('\n');
    const choice = prompt(`Select target folder number to move files to:\n\n${folderNamesStr}`);
    
    if (choice) {
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < availableFolders.length) {
        const target = availableFolders[idx];
        try {
          await filesApi.bulkMove(selectedFileIds, currentFolderId, target.id);
          setFiles((prev) => prev.filter((f) => !selectedFileIds.includes(f.id)));
          setSelectedFileIds([]);
          alert(`Successfully moved ${selectedFileIds.length} files to "${target.name}"!`);
        } catch (err: any) {
          alert('Bulk move failed: ' + err.message);
        }
      } else {
        alert('Invalid selection.');
      }
    }
  }, [selectedFileIds, currentFolderId, folders]);

  // Handle Bulk Download (Single ZIP stream)
  const handleBulkDownload = useCallback(async () => {
    if (selectedFileIds.length === 0) return;

    try {
      const token = localStorage.getItem('access_token') || '';
      const response = await fetch(filesApi.bulkDownloadUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Token': token
        },
        body: JSON.stringify({
          file_ids: selectedFileIds,
          folder_id: currentFolderId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate ZIP download');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telegram-drive-selected-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Clear selection after successful download
      setSelectedFileIds([]);
    } catch (err: any) {
      alert('Bulk download failed: ' + err.message);
    }
  }, [selectedFileIds, currentFolderId]);

  // Handle Bulk Share (Generate public link for each selected file)
  const handleBulkShare = useCallback(async () => {
    if (selectedFileIds.length === 0) return;
    alert(`To share multiple files, you can share them one by one using the right-click menu, or download selected.`);
  }, [selectedFileIds]);

  // Handle folder creation
  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      const result = await foldersApi.create(name);
      setFolders((prev) => [...prev, result.folder]);
    } catch (err) {
      console.error('Create folder failed:', err);
    }
  }, []);

  // Handle folder rename
  const handleRenameFolder = useCallback(async (id: string, name: string) => {
    try {
      await foldersApi.rename(id, name);
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name } : f))
      );
    } catch (err) {
      console.error('Rename folder failed:', err);
    }
  }, []);

  // Handle folder delete
  const handleDeleteFolder = useCallback(async (id: string) => {
    try {
      await foldersApi.delete(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      if (currentFolderId === id) {
        setCurrentFolderId('me');
      }
    } catch (err) {
      console.error('Delete folder failed:', err);
    }
  }, [currentFolderId]);

  // Handle publicity toggle
  const handleUpdateFolderPublicity = useCallback(async (id: string, isPublic: boolean, username?: string) => {
    try {
      await foldersApi.updatePublicity(id, isPublic, username);
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, username: isPublic ? username : undefined } : f))
      );
    } catch (err: any) {
      alert('Failed to change publicity: ' + err.message);
    }
  }, []);

  // Dismiss upload
  const handleDismissUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  const currentFolder = folders.find((f) => f.id === currentFolderId);

  return (
    <div className={`app-layout animate-fade-in ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
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
        theme={theme}
        onSelectFolder={(id) => { setCurrentFolderId(id); setSidebarOpen(false); }}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onUpdateFolderPublicity={handleUpdateFolderPublicity}
        onToggleTheme={handleToggleTheme}
        onLogout={onLogout}
        onAccessLogout={onAccessLogout}
        onToggleCollapse={handleToggleSidebar}
      />

      <div className="main-content">
        <TopBar
          currentFolder={currentFolder}
          viewMode={viewMode}
          searchQuery={searchQuery}
          totalFiles={totalFiles}
          onViewModeChange={setViewMode}
          onSearchChange={setSearchQuery}
          onToggleSidebar={handleToggleSidebar}
          selectedCount={selectedFileIds.length}
          onClearSelection={handleClearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkDownload={handleBulkDownload}
          onBulkMove={handleBulkMove}
          onBulkShare={handleBulkShare}
          sidebarCollapsed={sidebarCollapsed}
        />

        <FileExplorer
          files={files}
          viewMode={viewMode}
          currentFolderId={currentFolderId}
          folders={folders}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onRename={handleRename}
          selectedFileIds={selectedFileIds}
          onToggleSelectFile={handleToggleSelectFile}
        />
      </div>

      {uploads.length > 0 && (
        <UploadProgress uploads={uploads} onDismiss={handleDismissUpload} />
      )}
    </div>
  );
}
