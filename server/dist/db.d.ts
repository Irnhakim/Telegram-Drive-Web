export declare function initDatabase(): Promise<void>;
export declare function cacheFolders(folders: Array<{
    id: string;
    name: string;
    isSavedMessages: boolean;
}>): void;
export declare function getCachedFolders(): Array<{
    id: string;
    name: string;
    is_saved_messages: number;
    group_id: string | null;
}>;
export declare function cacheFiles(folderId: string, files: Array<{
    messageId: number;
    name: string;
    size: number;
    mimeType: string;
    hasThumb: boolean;
    createdAt: string;
}>): void;
export declare function getCachedFiles(folderId: string): {
    message_id: number;
    folder_id: string;
    name: string;
    size: number;
    mime_type: string;
    has_thumb: number;
    created_at: string;
}[];
export declare function clearFileCache(folderId: string): void;
export declare function cacheThumbnail(messageId: number, folderId: string, data: Buffer): void;
export declare function getCachedThumbnail(messageId: number, folderId: string): Buffer | null;
export declare function getStorageStats(): {
    totalSize: number;
    totalFiles: number;
    byFolder: {
        folderId: string;
        folderName: string;
        fileCount: number;
        totalSize: number;
    }[];
    byMimeType: {
        mimeType: string;
        fileCount: number;
        totalSize: number;
    }[];
};
export declare function createShareLink(params: {
    id: string;
    messageId: number;
    folderId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    password?: string;
    expiresAt?: number;
}): void;
export declare function getShareLink(id: string): {
    id: string;
    messageId: number;
    folderId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    password: string | null;
    expiresAt: number | null;
} | null;
export declare function deleteShareLink(id: string): void;
export declare function createGroup(id: string, name: string, color: string): void;
export declare function getGroups(): {
    id: string;
    name: string;
    color: string;
}[];
export declare function deleteGroup(id: string): void;
export declare function updateFolderGroup(folderId: string, groupId: string | null): void;
