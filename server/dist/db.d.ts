export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, storedHash: string): boolean;
export declare function initDatabase(): Promise<void>;
export interface UserRow {
    id: string;
    username: string;
    passwordHash: string;
    email: string | null;
    telegramId: string | null;
    telegramUsername: string | null;
    telegramFirstName: string | null;
    telegramLastName: string | null;
    telegramPhone: string | null;
    session: string | null;
    apiId: number | null;
    apiHash: string | null;
    token: string;
    createdAt: number;
}
export declare function getUserByToken(token: string): UserRow | null;
export declare function getUserById(id: string): UserRow | null;
export declare function getUserByUsername(username: string): UserRow | null;
export declare function registerUser(username: string, passwordHash: string, email?: string): UserRow;
export declare function updateUserTelegramSession(userId: string, tgData: {
    telegramId: string;
    telegramUsername?: string | null;
    telegramFirstName?: string | null;
    telegramLastName?: string | null;
    telegramPhone?: string | null;
    session: string;
    apiId: number;
    apiHash: string;
}): void;
export declare function updateUserWebToken(userId: string, token: string): void;
export declare function deleteUser(id: string): void;
export declare function cacheFolders(userId: string, folders: Array<{
    id: string;
    name: string;
    isSavedMessages: boolean;
}>): void;
export declare function getCachedFolders(userId: string): Array<{
    id: string;
    name: string;
    is_saved_messages: number;
    group_id: string | null;
}>;
export declare function cacheFiles(userId: string, folderId: string, files: Array<{
    messageId: number;
    name: string;
    size: number;
    mimeType: string;
    hasThumb: boolean;
    createdAt: string;
}>): void;
export declare function getCachedFiles(userId: string, folderId: string): {
    message_id: number;
    folder_id: string;
    name: string;
    size: number;
    mime_type: string;
    has_thumb: number;
    created_at: string;
}[];
export declare function clearFileCache(userId: string, folderId: string): void;
export declare function cacheThumbnail(userId: string, messageId: number, folderId: string, data: Buffer): void;
export declare function getCachedThumbnail(userId: string, messageId: number, folderId: string): Buffer | null;
export declare function getStorageStats(userId: string): {
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
export declare function createShareLink(userId: string, params: {
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
    userId: string;
    messageId: number;
    folderId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    password: string | null;
    expiresAt: number | null;
} | null;
export declare function deleteShareLink(id: string): void;
export declare function createGroup(userId: string, id: string, name: string, color: string): void;
export declare function getGroups(userId: string): {
    id: string;
    name: string;
    color: string;
}[];
export declare function deleteGroup(userId: string, id: string): void;
export declare function updateFolderGroup(userId: string, folderId: string, groupId: string | null): void;
