import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const db = admin.firestore();

/**
 * 計算指定帳戶在特定日期的動態可用餘額 (Ledger 演算法 + 月結快照優化)
 * @param familyId 家庭 ID
 * @param accountId 帳戶 ID (如 'main-ledger')
 * @param asOfDate 計算基準時間 (YYYY-MM-DD)
 */
export async function computeAccountBalance(
  familyId: string,
  accountId: string,
  asOfDate: string
): Promise<number> {
  const [year, month] = asOfDate.split('-');
  const currentYearMonth = `${year}-${month}`;

  // 1. 查詢最新一個月份的月結快照 (复合索引: accountId ASC, yearMonth DESC)
  const snapshotQuery = await db
    .collection('families')
    .doc(familyId)
    .collection('monthlySnapshots')
    .where('accountId', '==', accountId)
    .where('yearMonth', '<', currentYearMonth)
    .orderBy('yearMonth', 'desc')
    .limit(1)
    .get();

  let baseBalance = 0;
  let startDate = '1970-01-01';

  if (!snapshotQuery.empty) {
    const snapshotDoc = snapshotQuery.docs[0];
    const snapshotData = snapshotDoc.data();
    baseBalance = snapshotData.balance || 0;
    
    // 從快照的次月 1 號開始累加明細
    const snapshotYM = snapshotData.yearMonth as string; // 'YYYY-MM'
    const [sYear, sMonth] = snapshotYM.split('-');
    const sDateObj = new Date(parseInt(sYear, 10), parseInt(sMonth, 10), 1); // 次月 1 號
    startDate = sDateObj.toISOString().split('T')[0];
  }

  // 2. 查詢該日期範圍內的 Ledger 交易明細
  const expensesQuery = await db
    .collection('families')
    .doc(familyId)
    .collection('expenses')
    .where('accountId', '==', accountId)
    .where('date', '>=', startDate)
    .where('date', '<=', asOfDate)
    .get();

  let incomeTotal = 0;
  let expenseTotal = 0;

  expensesQuery.forEach((doc) => {
    const data = doc.data();
    const amount = data.amount || 0;
    if (data.direction === 'income') {
      incomeTotal += amount;
    } else {
      expenseTotal += amount;
    }
  });

  return baseBalance + incomeTotal - expenseTotal;
}

/**
 * 預算上限警報檢算 (80% 與 100%)
 * @param familyId 家庭 ID
 * @param category 分類 (如 '飲食')
 * @param addedAmount 剛新增的金額
 */
export async function checkBudgetAlert(
  familyId: string,
  category: string,
  addedAmount: number
): Promise<string | null> {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const startOfMonth = `${year}-${month}-01`;

  // 1. 讀取家庭文件中的預算上限
  const familyDoc = await db.collection('families').doc(familyId).get();
  if (!familyDoc.exists) return null;
  
  const data = familyDoc.data()!;
  const budgets = data.budgets || {}; // 格式: { '飲食': 20000, '水電': 5000 }
  const budgetLimit = budgets[category];

  if (!budgetLimit) return null; // 沒有為此類別設定預算

  // 2. 累加本月該類別已支出的費用
  const expensesQuery = await db
    .collection('families')
    .doc(familyId)
    .collection('expenses')
    .where('category', '==', category)
    .where('direction', '==', 'expense')
    .where('date', '>=', startOfMonth)
    .get();

  let totalExpense = addedAmount;
  expensesQuery.forEach((doc) => {
    totalExpense += doc.data().amount || 0;
  });

  const percentage = (totalExpense / budgetLimit) * 100;

  // 3. 判斷是否觸發警報
  if (percentage >= 100) {
    return `🚨 預算超額警報：本月「${category}」累計支出已達 $${totalExpense} 元，已超出設定預算 $${budgetLimit} 元 (100% 爆表)！💸`;
  } else if (percentage >= 80) {
    return `⚠️ 預算超額警戒：本月「${category}」累計支出已達 $${totalExpense} 元，已佔預算 $${budgetLimit} 元的 ${Math.floor(percentage)}%！請注意支出節制。`;
  }

  return null;
}

/**
 * 每月 1 日 00:05 自動閉帳與月結快照定時排程 (台北時間)
 */
export const createMonthlySnapshots = onSchedule({
  schedule: '5 0 1 * *',
  timeZone: 'Asia/Taipei',
  consumeAppAssociation: false
}, async (event) => {
  console.log('開始執行月結快照定時排程...');

  const today = new Date();
  // 計算上月 YYYY-MM
  today.setMonth(today.getMonth() - 1);
  const lastYear = today.getFullYear();
  const lastMonth = (today.getMonth() + 1).toString().padStart(2, '0');
  const lastYearMonth = `${lastYear}-${lastMonth}`;
  
  // 上月的最後一天 YYYY-MM-DD
  const lastDayObj = new Date(lastYear, today.getMonth() + 1, 0);
  const lastDayStr = lastDayObj.toISOString().split('T')[0];

  const familiesQuery = await db.collection('families').get();

  for (const familyDoc of familiesQuery.docs) {
    const familyId = familyDoc.id;
    const accountId = 'main-ledger'; // 預設主帳本

    try {
      // 1. 計算上期終期餘額
      const finalBalance = await computeAccountBalance(familyId, accountId, lastDayStr);
      
      // 2. 寫入快照集合
      const snapshotRef = db
        .collection('families')
        .doc(familyId)
        .collection('monthlySnapshots')
        .doc(lastYearMonth);

      await snapshotRef.set({
        accountId,
        yearMonth: lastYearMonth,
        balance: finalBalance,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`家庭 ${familyId} 的月結快照 ${lastYearMonth} 建立成功，餘額: $${finalBalance}`);
    } catch (err) {
      console.error(`建立家庭 ${familyId} 月結快照失敗:`, err);
    }
  }

  console.log('月結快照排程執行完畢。');
});
