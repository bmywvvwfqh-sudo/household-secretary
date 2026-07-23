import * as crypto from 'crypto';
import * as https from 'https';
import { IncomingMessage } from 'http';

/**
 * 驗證 LINE Webhook 簽章 (Sec-1: 採用原始 rawBody Buffer 防止 JSON 物件順序誤差)
 */
export function validateLineSignature(
  rawBody: Buffer,
  signature: string,
  channelSecret: string
): boolean {
  if (!signature || !channelSecret) return false;
  
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');
    
  return hash === signature;
}

/**
 * 下載 LINE 語音/多媒體檔案 (限制大小為 10MB 以免記憶體耗盡)
 */
export function downloadLineAudio(
  messageId: string,
  accessToken: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
    const options = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    https.get(url, options, (res: IncomingMessage) => {
      if (res.statusCode !== 200) {
        reject(new Error(`下載 LINE 音檔失敗，HTTP 狀態碼: ${res.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const MAX_BYTES = 10 * 1024 * 1024; // 10MB 限制

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          res.destroy(); // 關閉串流
          reject(new Error('語音檔案大小超過 10MB 限制。'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      res.on('error', (err) => {
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 使用 Reply API 回覆訊息 (100% 免費配額)
 */
export async function replyLineMessage(
  replyToken: string,
  messages: any[],
  accessToken: string
): Promise<void> {
  return callLineApi('https://api.line.me/v2/bot/message/reply', {
    replyToken,
    messages,
  }, accessToken);
}

/**
 * 使用 Push API 主動推送訊息 (會消耗每月 200 則的額度，通常作為降級備用)
 */
export async function pushLineMessage(
  to: string,
  messages: any[],
  accessToken: string
): Promise<void> {
  return callLineApi('https://api.line.me/v2/bot/message/push', {
    to,
    messages,
  }, accessToken);
}

/**
 * 呼叫 LINE REST API 通用方法
 */
async function callLineApi(
  url: string,
  body: any,
  accessToken: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const req = https.request(options, (res: IncomingMessage) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(
            new Error(`LINE API 請求失敗 [${res.statusCode}]: ${responseBody}`)
          );
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}
