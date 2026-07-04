const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

export function setAccessToken(token: string): void {
  localStorage.setItem('access_token', token);
}

export function clearAccessToken(): void {
  localStorage.removeItem('access_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['x-access-token'] = token;
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 403) {
    clearAccessToken();
    window.location.reload();
    throw new Error('Access denied');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Access (web password) ─────────────────────────────
export const accessApi = {
  check: () => request<{ passwordRequired: boolean }>('/api/access/check'),

  login: (password: string) =>
    request<{ success: boolean; token: string }>('/api/access/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/api/access/logout', {
      method: 'POST',
    }),
};

// ── Auth (Telegram) ───────────────────────────────────
export const authApi = {
  status: () => request<{ authenticated: boolean; user: any }>('/api/auth/status'),

  sendCode: (phoneNumber: string, apiId?: string, apiHash?: string) =>
    request<{ success: boolean; phoneCodeHash: string }>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, apiId, apiHash }),
    }),

  verifyCode: (phoneNumber: string, code: string, phoneCodeHash: string) =>
    request<{ success: boolean; requires2FA?: boolean; user?: any }>('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, code, phoneCodeHash }),
    }),

  startQR: (apiId?: string, apiHash?: string) =>
    request<{ tokenUrl: string; expires: number }>('/api/auth/qr/start', {
      method: 'POST',
      body: JSON.stringify({ apiId, apiHash }),
    }),

  pollQRStatus: () =>
    request<{ status: string; user?: any; error?: string }>('/api/auth/qr/status'),

  verify2FA: (password: string) =>
    request<{ success: boolean; user?: any }>('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
};

// ── Folders ───────────────────────────────────────────
export const foldersApi = {
  list: () => request<{ folders: any[] }>('/api/folders'),

  create: (name: string) =>
    request<{ folder: any }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  rename: (id: string, name: string) =>
    request<{ success: boolean }>(`/api/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/folders/${id}`, {
      method: 'DELETE',
    }),

  updatePublicity: (id: string, isPublic: boolean, username?: string) =>
    request<{ success: boolean }>(`/api/folders/${id}/publicity`, {
      method: 'PUT',
      body: JSON.stringify({ isPublic, username }),
    }),

  getInviteLink: (id: string) =>
    request<{ inviteLink: string }>(`/api/folders/${id}/invite-link`),
};

// ── Files ─────────────────────────────────────────────
export const filesApi = {
  list: (params: {
    folderId?: string;
    limit?: number;
    offsetId?: number;
    search?: string;
    sort?: string;
    order?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.folderId) query.set('folder_id', params.folderId);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offsetId) query.set('offset_id', params.offsetId.toString());
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);
    return request<{ files: any[]; total: number }>(`/api/files?${query}`);
  },

  getDetails: (messageId: number, folderId?: string) => {
    const query = folderId ? `?folder_id=${folderId}` : '';
    return request<any>(`/api/files/${messageId}${query}`);
  },

  getDownloadUrl: (messageId: number, folderId?: string) => {
    const token = getAccessToken();
    const query = new URLSearchParams();
    if (folderId) query.set('folder_id', folderId);
    if (token) query.set('token', token);
    return `${API_BASE}/api/files/${messageId}/download?${query}`;
  },

  getThumbnailUrl: (messageId: number, folderId?: string) => {
    const token = getAccessToken();
    const query = new URLSearchParams();
    if (folderId) query.set('folder_id', folderId);
    if (token) query.set('token', token);
    return `${API_BASE}/api/files/${messageId}/thumbnail?${query}`;
  },

  upload: async (
    file: File,
    folderId: string,
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder_id', folderId);

    // Use XMLHttpRequest for progress tracking
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/files/upload`);

      const token = getAccessToken();
      if (token) {
        xhr.setRequestHeader('x-access-token', token);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  },

  delete: (messageId: number, folderId?: string) => {
    const query = folderId ? `?folder_id=${folderId}` : '';
    return request<{ success: boolean }>(`/api/files/${messageId}${query}`, {
      method: 'DELETE',
    });
  },

  rename: (messageId: number, name: string, folderId?: string) => {
    const query = folderId ? `?folder_id=${folderId}` : '';
    return request<{ success: boolean }>(`/api/files/${messageId}${query}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  copy: (messageId: number, targetFolderId: string, sourceFolderId?: string) =>
    request<{ success: boolean }>(`/api/files/${messageId}/copy`, {
      method: 'POST',
      body: JSON.stringify({
        folder_id: targetFolderId,
        source_folder_id: sourceFolderId,
      }),
    }),

  bulkDelete: (fileIds: number[], folderId: string) =>
    request<{ success: boolean }>('/api/files/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', file_ids: fileIds, folder_id: folderId }),
    }),

  bulkMove: (fileIds: number[], sourceFolderId: string, targetFolderId: string) =>
    request<{ success: boolean }>('/api/files/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'move',
        file_ids: fileIds,
        folder_id: sourceFolderId,
        payload: { folder_id: targetFolderId },
      }),
    }),
};

// ── Storage ───────────────────────────────────────────
export const storageApi = {
  stats: () => request<any>('/api/storage/stats'),
};

// ── Shares ────────────────────────────────────────────
export const sharesApi = {
  generate: (params: {
    messageId: number;
    folderId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    password?: string;
    expiresHours?: number;
  }) =>
    request<{ success: boolean; shareId: string; url: string }>('/api/shares/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getDetails: (shareId: string) =>
    request<{
      id: string;
      fileName: string;
      fileSize: number;
      fileSizeStr: string;
      mimeType: string;
      passwordRequired: boolean;
    }>(`/api/public/shares/${shareId}`),

  downloadUrl: (shareId: string) => `${API_BASE}/api/public/shares/${shareId}/download`,
};
