import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { validateLineSignature } from '../lineApi';

describe('LINE Webhook 簽章驗證測試', () => {
  const secret = 'test-channel-secret-12345';
  const rawBody = Buffer.from(JSON.stringify({
    events: [
      {
        type: 'message',
        replyToken: 'mock-reply-token',
        webhookEventId: 'evt_001'
      }
    ]
  }));

  it('傳入正確的簽章時應返回 true', () => {
    // 計算正確的簽章
    const signature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    const isValid = validateLineSignature(rawBody, signature, secret);
    expect(isValid).toBe(true);
  });

  it('傳入錯誤的簽章時應返回 false', () => {
    const invalidSignature = 'invalid-signature-value';
    const isValid = validateLineSignature(rawBody, invalidSignature, secret);
    expect(isValid).toBe(false);
  });

  it('缺少簽章或密鑰時應返回 false', () => {
    expect(validateLineSignature(rawBody, '', secret)).toBe(false);
    expect(validateLineSignature(rawBody, 'sig', '')).toBe(false);
  });
});
