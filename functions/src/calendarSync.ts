import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as ical from 'node-ical';

/**
 * 訂閱外部 iCal 行事曆同步 Function (支援 iOS iCal / Google Public ICS)
 * 前端可直接傳送 { familyId, icalUrl } 進行呼叫
 */
export const syncExternalCalendar = onCall({ cors: true, invoker: 'public' }, async (request) => {
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

    // 3. 將 icalUrl 儲存至家庭設定中，供背景定時任務讀取自動同步，並提交批次寫入
    const familyRef = db.collection('families').doc(familyId);
    batch.set(familyRef, { icalUrl: targetUrl }, { merge: true });

    await batch.commit();

    console.log(`同步成功，共匯入 ${syncCount} 項外部行程。`);
    return { success: true, count: syncCount };
  } catch (error: any) {
    console.error('外部日曆同步失敗:', error);
    throw new HttpsError('internal', `外部日曆抓取失敗: ${error.message || '未知錯誤'}`);
  }
});

/**
 * 定時自動同步所有家庭的外部 iCal 行事曆 (每 4 小時執行一次)
 */
export const autoSyncCalendars = onSchedule({
  schedule: '0 */4 * * *', // 每 4 小時執行一次
  timeZone: 'Asia/Taipei', // 台灣時區
  memory: '256MiB',
  timeoutSeconds: 120
}, async (event) => {
  const db = admin.firestore();
  console.log('開始執行定時 iCal 日曆自動同步排程任務...');
  
  try {
    // 1. 撈取所有設定了 icalUrl 的家庭
    const familiesSnapshot = await db.collection('families').get();
    console.log(`共掃描 ${familiesSnapshot.size} 個家庭以檢查外部日曆配置。`);

    for (const familyDoc of familiesSnapshot.docs) {
      const familyId = familyDoc.id;
      const data = familyDoc.data();
      let icalUrl = data.icalUrl;

      if (!icalUrl) continue;

      // 容錯清洗
      icalUrl = icalUrl.trim();
      if (icalUrl.toLowerCase().startsWith('webcal://')) {
        icalUrl = 'https://' + icalUrl.substring(9);
      }

      console.log(`正在自動背景同步家庭 ${familyId} 的日曆: ${icalUrl}`);
      
      try {
        const webEvents = await ical.fromURL(icalUrl);
        const batch = db.batch();
        let syncCount = 0;

        for (const k in webEvents) {
          if (Object.prototype.hasOwnProperty.call(webEvents, k)) {
            const ev = webEvents[k];
            if (ev.type === 'VEVENT') {
              const eventId = ev.uid ? ev.uid.replace(/[^a-zA-Z0-9]/g, '_') : `ical_${ev.start?.getTime()}`;
              const eventRef = db.collection('families').doc(familyId).collection('calendarEvents').doc(eventId);
              
              batch.set(eventRef, {
                title: ev.summary || '未命名外部行程',
                dateTime: ev.start ? new Date(ev.start).toISOString() : new Date().toISOString(),
                createdBy: '自動排程同步服務',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'ical'
              }, { merge: true });
              
              syncCount++;
              if (syncCount >= 200) break; // 限制每個家庭一次同步最多 200 筆
            }
          }
        }

        if (syncCount > 0) {
          await batch.commit();
          console.log(`家庭 ${familyId} 自動同步成功，共匯入 ${syncCount} 項行程。`);
        }
      } catch (innerErr: any) {
        console.error(`家庭 ${familyId} 的外部日曆自動同步失敗:`, innerErr.message || innerErr);
      }
    }
    console.log('定時 iCal 日曆自動同步排程任務執行完畢。');
  } catch (error) {
    console.error('定時自動同步任務遇到重大錯誤:', error);
  }
});
