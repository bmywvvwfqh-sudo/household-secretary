export interface LineWebhookRequestBody {
  destination: string;
  events: LineWebhookEvent[];
}

export interface LineWebhookEvent {
  type: string;
  mode: 'active' | 'standby';
  timestamp: number;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  webhookEventId: string;
  deliveryContext: {
    isRedelivery: boolean;
  };
  replyToken?: string;
  message?: LineMessage;
}

export type LineMessage =
  | LineTextMessage
  | LineAudioMessage
  | LineImageMessage
  | LineOtherMessage;

export interface LineTextMessage {
  type: 'text';
  id: string;
  text: string;
  mention?: {
    mentions: Array<{
      index: number;
      length: number;
      userId: string;
    }>;
  };
}

export interface LineAudioMessage {
  type: 'audio';
  id: string;
  duration: number; // 毫秒
  contentProvider: {
    type: 'line' | 'external';
    originalContentUrl?: string;
  };
}

export interface LineImageMessage {
  type: 'image';
  id: string;
  contentProvider: {
    type: 'line' | 'external';
    originalContentUrl?: string;
    previewImageUrl?: string;
  };
}

export interface LineOtherMessage {
  type: 'video' | 'file' | 'location' | 'sticker';
  id: string;
}
