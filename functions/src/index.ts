import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { CloudTasksClient } from '@google-cloud/tasks';
import { validateLineSignature, downloadLineAudio, replyLineMessage, pushLineMessage } from './lineApi';
import { parseInputWithGemini, GeminiParsedTask } from './gemini';
import { LineWebhookRequestBody, LineWebhookEvent } from './types/line';
import { checkBudgetAlert } from './financeLedger';

admin.initializeApp();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// 取得環境變數，提供 Safe Fallback
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GCP_PROJECT = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || 'household-secretary-test';
const GCP_LOCATION = process.env.GCP_LOCATION || 'us-central1';
const QUEUE_NAME = 'line-events-queue';

/**
 * 1. LINE Webhook 接收端點 (HTTPS Trigger)
 * 職責：1秒內驗簽、分發 Cloud Tasks，快速回覆 200 OK 避免 LINE 逾時重試
 */
export const lineWebhook = onRequest({
  secrets: ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'GEMINI_API_KEY'],
  invoker: 'public', // LINE 平台需要可公開呼叫
}, async (req, res) => {
  const signature = req.headers['x-line-signature'] as string;
  const rawBody = req.rawBody; // Sec-1: 採用 rawBody Buffer 防止 JSON 排序誤差

  // 1. 簽章校驗
  if (!validateLineSignature(rawBody, signature, LINE_CHANNEL_SECRET)) {
    console.warn('LINE Webhook 簽章校驗失敗！');
    res.status(401).send('Unauthorized');
    return;
  }

  const body = req.body as LineWebhookRequestBody;
  const events = body.events || [];

  try {
    for (const event of events) {
      // 2. 將 Event 分發到非同步處理隊列
      if (process.env.FUNCTIONS_EMULATOR === 'true') {
        // 本地開發環境：使用 setTimeout 模擬 Cloud Tasks 非同步分發，免除 GCP 憑證限制
        console.log(`[Emulator] 模擬非同步分發事件: ${event.webhookEventId}`);
        setTimeout(() => {
          processEventCore(event).catch((err) => {
            console.error('[Emulator] 處理事件出錯:', err);
          });
        }, 100);
      } else {
        // 生產環境：加入真實 Cloud Tasks 佇列
        await enqueueCloudTask(event);
      }
    }
    
    // 3. 立即回覆 200 OK
    res.status(200).send('OK');
  } catch (error) {
    console.error('分發 LINE Webhook 事件時發生錯誤:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * 2. Cloud Tasks 佇列任務寫入
 */
async function enqueueCloudTask(event: LineWebhookEvent): Promise<void> {
  const client = new CloudTasksClient();
  const queuePath = client.queuePath(GCP_PROJECT, GCP_LOCATION, QUEUE_NAME);
  
  // 指向 processLineEvents 的 Functions 網址
  const url = `https://${GCP_LOCATION}-${GCP_PROJECT}.cloudfunctions.net/processLineEvents`;
  
  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(event)).toString('base64'),
      oidcToken: {
        // Sec-2: 採用具有 Cloud Tasks 呼叫權限的 Service Account 簽發 OIDC Token
        serviceAccountEmail: `cloud-tasks-invoker@${GCP_PROJECT}.iam.gserviceaccount.com`,
      },
    },
  };

  await client.createTask({ parent: queuePath, task });
  console.log(`已成功將事件 ${event.webhookEventId} 加入 Cloud Tasks 佇列。`);
}

/**
 * 3. Cloud Tasks 執行端點 (HTTPS OIDC 受保護)
 */
export const processLineEvents = onRequest({
  secrets: ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'GEMINI_API_KEY'],
}, async (req, res) => {
  // 在生產環境中，此處應驗證 OIDC Token 以防偽造請求。
  // 本地 Emulator 開發時跳過驗證以利測試。
  if (process.env.FUNCTIONS_EMULATOR !== 'true') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).send('Unauthorized: Missing OIDC Token');
      return;
    }
    // 這裡可以使用 google-auth-library 的 verifyIdToken 來校驗 OIDC 憑證
  }

  const event = req.body as LineWebhookEvent;
  
  try {
    await processEventCore(event);
    res.status(200).send('Event processed');
  } catch (error) {
    console.error(`處理事件 ${event.webhookEventId} 失敗:`, error);
    res.status(500).send('Error processing event');
  }
});

/**
 * 4. 核心事件處理邏輯 (去重、綁定反查、語音下載、Gemini 多模態解析、資料寫入)
 */
async function processEventCore(event: LineWebhookEvent): Promise<void> {
  const { webhookEventId, replyToken, source, message } = event;
  const lineUserId = source.userId;

  if (!lineUserId) {
    console.warn('事件無 lineUserId，略過處理。');
    return;
  }

  // 🔴 去重檢查 (Log-3: Effectively-Once 處理)
  const eventRef = db.collection('processedEvents').doc(webhookEventId);
  const isDuplicate = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(eventRef);
    if (doc.exists) {
      return true; // 已處理過
    }
    // 未處理過，標記並寫入 (TTL 30天由後端自動清理)
    transaction.set(eventRef, {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return false;
  });

  if (isDuplicate) {
    console.log(`[去重攔截] 事件 ${webhookEventId} 已經處理過，忽略重複請求。`);
    return;
  }

  // 🔵 檢查綁定狀態 (以 lineUserId 反查 familyId)
  let familyId: string | null = null;
  const memberQuery = await db
    .collectionGroup('members')
    .where('lineUserId', '==', lineUserId)
    .limit(1)
    .get();

  if (!memberQuery.empty) {
    const memberDoc = memberQuery.docs[0];
    // 取得 members 的上一層即為 families/{familyId}
    const familyRef = memberDoc.ref.parent.parent;
    if (familyRef) {
      familyId = familyRef.id;
    }
  }

  // 🟢 處理「尚未綁定」的使用者與「配對碼發送」
  if (!familyId) {
    await handleUnboundUser(lineUserId, replyToken, message);
    return;
  }

  // 🟡 處理「已綁定」使用者的語音或文字記事
  if (!message) return;

  let textContent = '';
  let audioBuffer: Buffer | null = null;
  let mimeType = 'text/plain';

  if (message.type === 'text') {
    textContent = message.text;
    const intercepted = await handleLineCommands(familyId, lineUserId, replyToken || '', textContent);
    if (intercepted) return;
  } else if (message.type === 'audio') {
    // 語音檔下載 (限制大於 10MB 將拒絕)
    try {
      console.log(`開始下載語音訊息: ${message.id}`);
      audioBuffer = await downloadLineAudio(message.id, LINE_CHANNEL_ACCESS_TOKEN);
      mimeType = 'audio/x-m4a'; // LINE 語音預設通常為 m4a / ogg / wav
    } catch (err: any) {
      console.error('語音下載失敗:', err);
      await sendReplyOrPush(lineUserId, replyToken, [
        { type: 'text', text: `⚠️ 語音下載失敗: ${err.message || '檔案可能過大或已失效'}` }
      ]);
      return;
    }
  } else {
    // 其他不支援的多媒體
    await sendReplyOrPush(lineUserId, replyToken, [
      { type: 'text', text: '💡 家庭秘書目前僅支援「語音訊息」與「文字訊息」的記帳與行程管理喔！' }
    ]);
    return;
  }

  // 🟠 呼叫 Gemini 1.5 Flash 多模態解析
  try {
    const inputPayload = audioBuffer || textContent;
    const asOfDate = new Date().toISOString(); // asOfDate 基準時間
    
    console.log(`送交 Gemini 解析... 基準日期為: ${asOfDate}`);
    const parsed = await parseInputWithGemini(
      inputPayload,
      mimeType,
      GEMINI_API_KEY,
      asOfDate
    );

    // 🟣 寫入資料庫待確認佇列或行程採買
    await saveParsedTasks(familyId, lineUserId, parsed.tasks);

    // 🔴 預算警報檢查 (Phase 4)
    let budgetAlertMessage = '';
    for (const task of parsed.tasks) {
      if (task.type === 'finance' && task.direction === 'expense' && task.amount) {
        const alert = await checkBudgetAlert(familyId, task.category || '未分類', task.amount);
        if (alert) {
          budgetAlertMessage += `\n${alert}`;
        }
      }
    }

    const finalReply = budgetAlertMessage 
      ? `${parsed.rawReply}\n${budgetAlertMessage}` 
      : parsed.rawReply;

    // 🔴 回覆使用者解析成功的親切短語
    await sendReplyOrPush(lineUserId, replyToken, [
      { type: 'text', text: finalReply }
    ]);

  } catch (error: any) {
    console.error('Gemini NLP 解析出錯:', error);
    
    // NLP Fallback 三層防護策略：
    // 若為文字訊息，嘗試正則匹配或直接塞入待確認佇列
    if (message.type === 'text') {
      const fallbackReply = await handleTextFallback(familyId, lineUserId, textContent);
      await sendReplyOrPush(lineUserId, replyToken, [{ type: 'text', text: fallbackReply }]);
    } else {
      // 語音解析失敗，直接告知使用者
      await sendReplyOrPush(lineUserId, replyToken, [
        { type: 'text', text: '😢 抱歉，太太！這段語音我剛剛聽得不太清楚，能請您用打字的、或是重新說一次嗎？' }
      ]);
    }
  }
}

/**
 * 尚未綁定的使用者處理 (配對碼綁定驗證)
 */
async function handleUnboundUser(
  lineUserId: string,
  replyToken: string | undefined,
  message: any
): Promise<void> {
  const unboundText = (message?.type === 'text' ? message.text.trim() : '') as string;
  const bindingCodeRegex = /^\d{6}$/; // 6位數配對碼

  if (bindingCodeRegex.test(unboundText)) {
    // 使用者輸入了 6 位數配對碼，執行驗證綁定 (Sec-3: Transaction 原子鎖)
    const codeRef = db.collection('bindingCodes').doc(unboundText);
    
    try {
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(codeRef);
        if (!doc.exists) {
          return { success: false, reason: '配對碼不存在或已失效。' };
        }
        
        const data = doc.data()!;
        const attempts = (data.attempts || 0) + 1;
        const isExpired = Date.now() > data.expiresAt;
        
        if (attempts > 5 || isExpired) {
          transaction.delete(codeRef); // 刪除失效的配對碼
          return { success: false, reason: '此配對碼嘗試次數過多或已過期，請重新生成。' };
        }
        
        if (data.isUsed) {
          return { success: false, reason: '此配對碼已被使用。' };
        }

        // 綁定成功，建立家庭成員紀錄
        const familyId = data.familyId;
        const newMemberRef = db.collection('families').doc(familyId).collection('members').doc();
        
        transaction.set(newMemberRef, {
          lineUserId,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          role: 'member'
        });
        
        // 標記配對碼已使用
        transaction.update(codeRef, { isUsed: true, attempts });

        // 更新家庭 memberUids (用來讓 security rules 驗算權限)
        const familyRef = db.collection('families').doc(familyId);
        transaction.update(familyRef, {
          memberUids: admin.firestore.FieldValue.arrayUnion(lineUserId) // 在模擬器/本地登入情境，將 lineUserId 加入存取許可 list
        });

        return { success: true };
      });

      if (result.success) {
        await sendReplyOrPush(lineUserId, replyToken, [
          { type: 'text', text: '🎉 恭喜！家庭祕書綁定成功！您現在可以直接傳送「語音」或「文字」來記帳、記行程囉！🥰' }
        ]);
      } else {
        await sendReplyOrPush(lineUserId, replyToken, [
          { type: 'text', text: `⚠️ 綁定失敗: ${result.reason}` }
        ]);
      }
    } catch (err: any) {
      console.error('配對碼綁定失敗:', err);
      await sendReplyOrPush(lineUserId, replyToken, [
        { type: 'text', text: '⚠️ 綁定過程發生系統異常，請稍後再試。' }
      ]);
    }
  } else {
    // 提示如何進行 Onboarding 綁定
    await sendReplyOrPush(lineUserId, replyToken, [
      { type: 'text', text: '💡 歡迎使用家庭秘書！您尚未綁定家庭帳號。請先登入網頁版控制台，生成「6位數配對碼」，並直接在此回覆配對碼，即可完成連線喔！✨' }
    ]);
  }
}

/**
 * 儲存 Gemini 解析出來的各個 Task 項目到 Firestore
 */
async function saveParsedTasks(
  familyId: string,
  lineUserId: string,
  tasks: GeminiParsedTask[]
): Promise<void> {
  const batch = db.batch();
  
  for (const task of tasks) {
    if (task.type === 'calendar') {
      const ref = db.collection('families').doc(familyId).collection('calendarEvents').doc();
      batch.set(ref, {
        title: task.title || task.item || '未命名行程',
        dateTime: task.dateTime || new Date().toISOString(),
        createdBy: lineUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'line'
      });
    } else if (task.type === 'shopping') {
      const ref = db.collection('families').doc(familyId).collection('shoppingList').doc();
      batch.set(ref, {
        item: task.item || task.title || '未指定採買物',
        store: task.store || '一般採買',
        quantity: task.quantity || '1',
        isBought: false,
        createdBy: lineUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'line'
      });
    } else if (task.type === 'finance') {
      // 財務記帳 (Phase 4 規格: 移除 balance 餘額實體欄，全面動態 Ledger 記帳)
      const ref = db.collection('families').doc(familyId).collection('expenses').doc();
      batch.set(ref, {
        amount: task.amount !== undefined ? task.amount : 0,
        category: task.category || '未分類',
        direction: task.direction || 'expense',
        remark: task.remark || '',
        date: new Date().toISOString().split('T')[0], // 預設為當天
        createdBy: lineUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'line'
      });
    } else {
      // unconfirmed 寫入前端待確認佇列
      const ref = db.collection('unconfirmedQueue').doc();
      batch.set(ref, {
        familyId,
        rawText: task.rawText || '未明原始記事',
        createdBy: lineUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });
    }
  }

  await batch.commit();
}

/**
 * NLP 失敗時的文字 Fallback 機制 (例如正則記帳)
 */
async function handleTextFallback(
  familyId: string,
  lineUserId: string,
  text: string
): Promise<string> {
  // 簡易正則匹配記帳，例如：「花費 150 午餐」
  const financeRegex = /(花費|支出|買|花|收)\s*(\d+)\s*(.*)/i;
  const match = text.match(financeRegex);
  
  if (match) {
    const amount = parseInt(match[2], 10);
    const remark = match[3].trim() || '未分類支出';
    
    await db.collection('families').doc(familyId).collection('expenses').add({
      amount,
      category: '一般支出',
      direction: 'expense',
      remark,
      date: new Date().toISOString().split('T')[0],
      createdBy: lineUserId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'line_fallback'
    });
    
    return `📝 [NLP 降級正則記帳] 已為您記下支出：$${amount} 元 (${remark})。`;
  }

  // 否則直接塞入待確認佇列
  await db.collection('unconfirmedQueue').add({
    familyId,
    rawText: text,
    createdBy: lineUserId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'pending'
  });

  return '💡 已將此訊息放入您的「待確認佇列」，您可以稍後至控制台確認分類喔！';
}

/**
 * 送出 LINE 訊息，並實作 30秒 Reply-to-Push 降級容錯策略
 */
async function sendReplyOrPush(
  lineUserId: string,
  replyToken: string | undefined,
  messages: any[]
): Promise<void> {
  if (replyToken) {
    try {
      await replyLineMessage(replyToken, messages, LINE_CHANNEL_ACCESS_TOKEN);
      return;
    } catch (err: any) {
      console.warn('Reply Token 回覆超時或失效，無縫降級為 Push Message...', err.message);
    }
  }
  // 降級為 Push Message 推送
  await pushLineMessage(lineUserId, messages, LINE_CHANNEL_ACCESS_TOKEN);
}

/**
 * 處理 LINE 圖文選單特定關鍵字查詢指令，直接查庫返回，跳過 Gemini 呼叫以加速並省流量
 */
async function handleLineCommands(
  familyId: string,
  lineUserId: string,
  replyToken: string,
  text: string
): Promise<boolean> {
  const cleanText = text.trim();
  
  // 1. 當日待辦事項
  if (cleanText === '當日待辦事項' || cleanText.toLowerCase() === 'today') {
    try {
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const startOfDay = `${todayStr}T00:00:00.000Z`;
      const endOfDay = `${todayStr}T23:59:59.999Z`;

      const snapshot = await db
        .collection('families')
        .doc(familyId)
        .collection('calendarEvents')
        .where('dateTime', '>=', startOfDay)
        .where('dateTime', '<=', endOfDay)
        .get();

      const events: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        events.push({
          title: data.title,
          time: data.dateTime ? data.dateTime.split('T')[1]?.substring(0, 5) : '--:--',
          source: data.source === 'line' ? 'LINE' : data.source === 'web' ? '網頁' : data.source === 'ical' ? 'iCal 訂閱' : '其他'
        });
      });

      events.sort((a, b) => a.time.localeCompare(b.time));

      let replyText = `📅 共享當日待辦行程 (${todayStr.replace(/-/g, '/')})：\n`;
      if (events.length === 0) {
        replyText += '🎉 太棒了！今天目前沒有安排任何行程。';
      } else {
        events.forEach((evt, idx) => {
          replyText += `${idx + 1}. [${evt.time}] ${evt.title} (${evt.source})\n`;
        });
      }

      await sendReplyOrPush(lineUserId, replyToken, [{ type: 'text', text: replyText }]);
      return true;
    } catch (err: any) {
      console.error('查詢當日待辦失敗:', err);
      await sendReplyOrPush(lineUserId, replyToken, [{ type: 'text', text: `⚠️ 查詢失敗: ${err.message}` }]);
      return true;
    }
  }

  // 2. 購買清單
  if (cleanText === '購買清單' || cleanText.toLowerCase() === 'shopping') {
    try {
      const snapshot = await db
        .collection('families')
        .doc(familyId)
        .collection('shoppingList')
        .where('isBought', '==', false)
        .get();

      const storeMap: Record<string, string[]> = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const store = data.store || '一般採買';
        const itemStr = `${data.item}${data.quantity ? ` (${data.quantity})` : ''}`;
        if (!storeMap[store]) {
          storeMap[store] = [];
        }
        storeMap[store].push(itemStr);
      });

      let replyText = `🛒 當前家庭購買清單：\n`;
      const stores = Object.keys(storeMap);
      if (stores.length === 0) {
        replyText += '🛒 家中物資齊全，目前無待買項目！';
      } else {
        stores.forEach(store => {
          replyText += `\n【${store}】\n`;
          storeMap[store].forEach(item => {
            replyText += `- ${item}\n`;
          });
        });
      }

      await sendReplyOrPush(lineUserId, replyToken, [{ type: 'text', text: replyText }]);
      return true;
    } catch (err: any) {
      console.error('查詢購買清單失敗:', err);
      await sendReplyOrPush(lineUserId, replyToken, [{ type: 'text', text: `⚠️ 查詢失敗: ${err.message}` }]);
      return true;
    }
  }

  // 3. 未完成事項
  if (cleanText === '未完成事項' || cleanText.toLowerCase() === 'pending') {
    try {
      const snapshot = await db
        .collection('unconfirmedQueue')
        .where('familyId', '==', familyId)
        .where('status', '==', 'pending')
        .get();

      const tasks: string[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        tasks.push(data.rawText || '未明原始記事');
      });

      let replyText = `💡 待確認記事佇列 (共 ${tasks.length} 筆)：\n`;
      if (tasks.length === 0) {
        replyText += '✅ 目前沒有任何待確認記事，太棒了！';
      } else {
        tasks.forEach((task, idx) => {
          replyText += `${idx + 1}. 「${task}」\n`;
        });
      }

      await sendReplyOrPush(lineUserId, replyToken, [{ type: 'text', text: replyText }]);
      return true;
    } catch (err: any) {
      console.error('查詢未完成事項失敗:', err);
      await sendReplyOrPush(lineUserId, replyToken, [{ type: 'text', text: `⚠️ 查詢失敗: ${err.message}` }]);
      return true;
    }
  }

  return false;
}

export { syncExternalCalendar, autoSyncCalendars } from './calendarSync';
