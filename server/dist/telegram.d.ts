import { TelegramClient, Api } from 'telegram';
export declare function getTelegramClient(): TelegramClient | null;
export declare function initClient(): Promise<TelegramClient>;
export declare function sendCode(phoneNumber: string): Promise<{
    phoneCodeHash: string;
}>;
export declare function verifyCode(phoneNumber: string, code: string, hash: string): Promise<{
    success: boolean;
    requires2FA?: boolean;
}>;
export declare function verify2FA(password: string): Promise<{
    success: boolean;
}>;
export declare function checkAuth(): Promise<boolean>;
export declare function logout(): Promise<void>;
export declare function getMe(): Promise<Api.User | null>;
export declare function getSavedMessages(): Promise<Api.User | null>;
export declare function getUserChannels(): Promise<Api.Channel[]>;
export declare function getMessages(entity: Api.TypeEntityLike, options?: {
    limit?: number;
    offsetId?: number;
    search?: string;
}): Promise<{
    messages: Api.Message[];
    total: number;
}>;
export declare function uploadFile(entity: Api.TypeEntityLike, filePath: string, fileName: string): Promise<Api.Message>;
export declare function downloadFile(message: Api.Message, outputPath: string, progressCallback?: (progress: number) => void): Promise<string>;
export declare function downloadFileToBuffer(message: Api.Message): Promise<Buffer | null>;
export declare function downloadThumbnail(message: Api.Message): Promise<Buffer | null>;
export declare function createChannel(title: string): Promise<Api.Channel | null>;
export declare function renameChannel(channelId: bigint, newTitle: string): Promise<boolean>;
export declare function deleteChannel(channelId: bigint): Promise<boolean>;
export declare function deleteMessages(entity: Api.TypeEntityLike, messageIds: number[]): Promise<boolean>;
export declare function forwardMessage(fromEntity: Api.TypeEntityLike, toEntity: Api.TypeEntityLike, messageId: number): Promise<boolean>;
export declare function editCaption(entity: Api.TypeEntityLike, messageId: number, newCaption: string): Promise<boolean>;
