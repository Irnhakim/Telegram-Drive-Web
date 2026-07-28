import { TelegramClient, Api } from 'telegram';
export declare function getActiveClient(userId: string): TelegramClient | null;
export declare function getClientForUser(userId: string): Promise<TelegramClient | null>;
export declare function sendQRToken(userId: string, authSessionIdInput?: string, apiIdInput?: number, apiHashInput?: string): Promise<{
    authSessionId: string;
    tokenUrl: string;
    expires: number;
}>;
export declare function checkQRStatus(authSessionId: string): Promise<{
    status: string;
    user?: any;
    error?: string;
}>;
export declare function sendCode(userId: string, authSessionIdInput: string | undefined, phoneNumber: string, apiIdInput?: number, apiHashInput?: string): Promise<{
    authSessionId: string;
    phoneCodeHash: string;
}>;
export declare function verifyCode(userId: string, authSessionId: string, phoneNumber: string, code: string, hash: string): Promise<{
    success: boolean;
    requires2FA?: boolean;
    user?: any;
}>;
export declare function verify2FA(userId: string, authSessionId: string, password: string): Promise<{
    success: boolean;
    user?: any;
}>;
export declare function disconnectTelegram(userId: string): Promise<void>;
export declare function deactivateClient(userId: string): Promise<void>;
export declare function getSavedMessages(client: TelegramClient): Promise<Api.User | null>;
export declare function getUserChannels(client: TelegramClient): Promise<Api.Channel[]>;
export declare function getMessages(client: TelegramClient, entity: Api.TypeEntityLike, options?: {
    limit?: number;
    offsetId?: number;
    search?: string;
}): Promise<{
    messages: Api.Message[];
    total: number;
}>;
export declare function uploadFile(client: TelegramClient, entity: Api.TypeEntityLike, filePath: string, fileName: string): Promise<Api.Message>;
export declare function downloadFile(client: TelegramClient, message: Api.Message, outputPath: string, progressCallback?: (progress: number) => void): Promise<string>;
export declare function downloadFileToBuffer(client: TelegramClient, message: Api.Message): Promise<Buffer | null>;
export declare function downloadFileStream(client: TelegramClient, message: Api.Message, fileSize: number): AsyncGenerator<Buffer, void, unknown>;
export declare function downloadThumbnail(client: TelegramClient, message: Api.Message): Promise<Buffer | null>;
export declare function createChannel(client: TelegramClient, title: string): Promise<Api.Channel | null>;
export declare function renameChannel(client: TelegramClient, channelId: bigint, newTitle: string): Promise<boolean>;
export declare function deleteChannel(client: TelegramClient, channelId: bigint): Promise<boolean>;
export declare function updateChannelPublicity(client: TelegramClient, channelId: bigint, isPublic: boolean, username?: string): Promise<boolean>;
export declare function getChannelInviteLink(client: TelegramClient, channelId: bigint): Promise<string | null>;
export declare function deleteMessages(client: TelegramClient, entity: Api.TypeEntityLike, messageIds: number[]): Promise<boolean>;
export declare function forwardMessage(client: TelegramClient, fromEntity: Api.TypeEntityLike, toEntity: Api.TypeEntityLike, messageId: number): Promise<boolean>;
export declare function editCaption(client: TelegramClient, entity: Api.TypeEntityLike, messageId: number, newCaption: string): Promise<boolean>;
