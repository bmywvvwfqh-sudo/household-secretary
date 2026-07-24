import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as ical from 'node-ical';

/**
 * 訂閱外部 iCal 行事曆同步 Function (支援 iOS iCal / Google Public ICS)
 * 前端可直接傳送 { familyId, icalUrl } 進行呼叫
 */
export const syncExternalCalendar = onCall(async (request) => {
  const db = admin.firestore(); // 延遲初始化：確保 initializeApp() 已先執行
  // 檢查登入權限
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '使用者未登入。');
  }

  const { familyId, icalUrl } = request.data as { familyId: string; icalUrl: string };

  if (!familyId || !icalUrl) {
    throw new HttpsError('invalid-argument', '缺少 familyId 或 icalUrl 參數。');
  }

  try {
    // 🔴 容錯清洗：將 iOS iCloud 的 webcal:// 協定強制替換為 https:// 才能被 node-ical 正常下載
    let targetUrl = icalUrl.trim();
    if (targetUrl.toLowerCase().startsWith('webcal://')) {
      targetUrl = 'https://' + targetUrl.substring(9);
    }

    console.log(`開始同步家庭 ${familyId} 的外部日曆: ${targetUrl}`);
    
    // 1. 抓取並解析 .ics 內容
    const webEvents = await ical.fromURL(targetUrl);
    const batch = db.batch();
    let syncCount = 0;

    // 2. 遍歷所有的 ics 事件
    for (const k in webEvents) {
      if (Object.prototype.hasOwnProperty.call(webEvents, k)) {
        const ev = webEvents[k];
        if (ev.type === 'VEVENT') {
          // 以 ics 內的 uid 或 雜湊 作為 Firestore document ID 以防重複同步
          const eventId = ev.uid ? ev.uid.replace(/[^a-zA-Z0-9]/g, '_') : `ical_${ev.start?.getTime()}`;
          const eventRef = db.collection('families').doc(familyId).collection('calendarEvents').doc(eventId);
          
          batch.set(eventRef, {
            title: ev.summary || '未命名外部行程',
            dateTime: ev.start ? new Date(ev.start).toISOString() : new Date().toISOString(),
            createdBy: 'iCal 同步服務',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'ical'
          }, { merge: true }); // 採用 merge 避免覆寫已被使用者修改的其他自訂欄位
          
          syncCount++;
          // Firestore batch 限制為最多 500 次操作
          if (syncCount >= 400) break;
        }
      }
    }

    // 3. 提交批次寫入
    if (syncCount > 0) {
      await batch.commit();
    }

    console.log(`同步成功，共匯入 ${syncCount} 項外部行程。`);
    return { success: true, count: syncCount };
  } catch (error: any) {
    console.error('外部日曆同步失敗:', error);
    throw new HttpsError('internal', `外部日曆抓取失敗: ${error.message || '未知錯誤'}`);
  }
});
