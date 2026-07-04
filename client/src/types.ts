// ── File & Folder Types ──────────────────────────────

export interface TelegramFile {
  id: number;
  name: string;
  size: number;
  sizeStr: string;
  mimeType: string;
  category: string;
  hasThumb: boolean;
  createdAt: string;
  folderId: string;
}

export interface TelegramFolder {
  id: string;
  name: string;
  type: 'saved' | 'channel';
  username?: string;
}

export interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
}

// ── API Response Types ───────────────────────────────

export interface AuthStatusResponse {
  authenticated: boolean;
  user: UserInfo | null;
}

export interface SendCodeResponse {
  success: boolean;
  phoneCodeHash: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  requires2FA?: boolean;
  user?: UserInfo | null;
}

export interface FoldersResponse {
  folders: TelegramFolder[];
}

export interface FilesResponse {
  files: TelegramFile[];
  total: number;
  page: number;
  limit: number;
}

export interface StorageStats {
  total_storage_used_bytes: number;
  total_storage_used: string;
  total_file_count: number;
  folders: Array<{
    id: string;
    name: string;
    file_count: number;
    size_bytes: number;
    size: string;
  }>;
  mime_types: Array<{
    mime_type: string;
    file_count: number;
    size_bytes: number;
    size: string;
  }>;
}

// ── UI State Types ───────────────────────────────────

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'size' | 'created_at';
export type SortOrder = 'asc' | 'desc';

export type AuthStep = 'phone' | 'code' | '2fa' | 'loading';

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}
