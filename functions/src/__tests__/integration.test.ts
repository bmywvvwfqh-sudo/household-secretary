import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

// 1. Mocking Variables (必須先宣告，以便 Mocking 提升時能存取)
const mockBatchCommit = vi.fn();
const mockBatchSet = vi.fn();
const mockBatch = () => ({
  set: mockBatchSet,
  commit: mockBatchCommit
});

const mockDoc = vi.fn().mockImplementation(() => ({
  collection: () => ({
    doc: () => ({})
  }),
  get: async () => ({
    exists: true,
    data: () => ({ budgets: { '飲食': 20000 } })
  }),
  update: vi.fn()
}));

const mockRunTransaction = vi.fn().mockImplementation(async (callback) => {
  return false; 
});

const mockCollectionGroup = vi.fn().mockImplementation(() => ({
  where: () => ({
    limit: () => ({
      get: async () => ({
        empty: false,
        docs: [
          {
            ref: {
              parent: {
                parent: {
                  id: 'family_123'
                }
              }
            }
          }
        ]
      })
    })
  })
}));

// 2. Mocking Firebase Admin (在最上方宣告後，即可安全 mock 注入)
vi.mock('firebase-admin', () => ({
  initializeApp: vi.fn(),
  firestore: () => ({
    collection: () => ({
      doc: mockDoc
    }),
    collectionGroup: mockCollectionGroup,
    batch: mockBatch,
    runTransaction: mockRunTransaction,
    FieldValue: {
      serverTimestamp: () => 'mock-timestamp'
    }
  })
}));

// 3. Mocking External Modules (LINE & Gemini)
vi.mock('../lineApi', () => ({
  validateLineSignature: () => true,
  downloadLineAudio: async () => Buffer.from('mock-audio-bytes'),
  replyLineMessage: vi.fn(),
  pushLineMessage: vi.fn()
}));

vi.mock('../gemini', () => ({
  parseInputWithGemini: async () => ({
    tasks: [
      {
        type: 'shopping',
        item: '抽取式衛生紙',
        store: '好市多',
        quantity: '1箱'
      }
    ],
    rawReply: '好的，太太！我已經幫您記下了好市多的衛生紙採買囉！🥰'
  })
}));

describe('家庭秘書 Webhook 整合發包流程測試', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('🟢 模擬 LINE 訊息發送，應順利經歷去重、綁定反查、Gemini 解析與寫入資料庫', async () => {
    // 3. 測試目標 (使用動態載入防範 ES6 Hoisting 造成的未初始化錯誤)
    const { processLineEvents } = await import('../index');

    // 模擬 Cloud Tasks 發送過來的 Webhook 事件請求
    const mockRequest = {
      headers: {
        authorization: 'Bearer mock-oidc-token'
      },
      body: {
        webhookEventId: 'evt_integration_999',
        replyToken: 'reply_token_999',
        source: {
          type: 'user',
          userId: 'usr_mom_999'
        },
        message: {
          type: 'text',
          id: 'msg_999',
          text: '好市多買衛生紙 1箱'
        }
      }
    } as any;

    const mockResponse = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    } as any;

    // 呼叫 Cloud Tasks 事件處理端點
    await processLineEvents(mockRequest, mockResponse);

    // 1. 驗證去重 Transaction 被呼叫
    expect(mockRunTransaction).toHaveBeenCalled();

    // 2. 驗證 lineUserId 反查家庭 ID 被呼叫
    expect(mockCollectionGroup).toHaveBeenCalled();

    // 3. 驗證批次寫入 (Batch Set) 被呼叫，且寫入的資料正確符合 Gemini 解析
    expect(mockBatchSet).toHaveBeenCalled();
    const mockWriteCallArgs = mockBatchSet.mock.calls[0];
    expect(mockWriteCallArgs[1]).toEqual({
      item: '抽取式衛生紙',
      store: '好市多',
      quantity: '1箱',
      isBought: false,
      createdBy: 'usr_mom_999',
      createdAt: 'mock-timestamp',
      source: 'line'
    });

    // 4. 驗證 Webhook 完成後回傳 200 OK
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.send).toHaveBeenCalledWith('Event processed');
  });
});
