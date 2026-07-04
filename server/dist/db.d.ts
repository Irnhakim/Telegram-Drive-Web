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
