import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

describe('Firestore Security Rules 安全隔離測試', () => {
  let testEnv: RulesTestEnvironment;
  const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const projectId = 'household-secretary-test-rules';

  beforeAll(async () => {
    // 初始化測試環境並加載 Rules
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('🔴 封鎖未登入使用者存取任何家庭資料', async () => {
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(unauthenticatedDb, 'families/family_01/calendarEvents/evt_01');
    
    await assertFails(getDoc(docRef));
    await assertFails(setDoc(docRef, { title: '偷看行程' }));
  });

  it('🔴 封鎖非家庭成員讀寫家庭資料', async () => {
    // 建立一個家庭，成員包含 line_mom
    const adminDb = testEnv.withSecurityRulesDisabled((context) => context.firestore());
    await setDoc(doc(adminDb, 'families/family_01'), {
      memberUids: ['line_mom'],
    });

    // 以 line_dad 身份登入，他不是成員
    const dadDb = testEnv.authenticatedContext('line_dad').firestore();
    const docRef = doc(dadDb, 'families/family_01/calendarEvents/evt_01');

    await assertFails(getDoc(docRef));
    await assertFails(setDoc(docRef, { title: '偷改行程' }));
  });

  it('🟢 允許授權成員讀寫所屬家庭資料', async () => {
    const adminDb = testEnv.withSecurityRulesDisabled((context) => context.firestore());
    await setDoc(doc(adminDb, 'families/family_01'), {
      memberUids: ['line_mom'],
    });

    // 以 line_mom 身份登入
    const momDb = testEnv.authenticatedContext('line_mom').firestore();
    const docRef = doc(momDb, 'families/family_01/calendarEvents/evt_01');

    await assertSucceeds(setDoc(docRef, { title: '全家聚餐' }));
    await assertSucceeds(getDoc(docRef));
  });

  it('🔴 封鎖前端對配對碼 bindingCodes 的讀寫 (僅限後端操作)', async () => {
    const momDb = testEnv.authenticatedContext('line_mom').firestore();
    const codeRef = doc(momDb, 'bindingCodes/123456');

    await assertFails(getDoc(codeRef));
    await assertFails(setDoc(codeRef, { familyId: 'family_01' }));
  });

  it('🔴 封鎖前端寫入待確認佇列 unconfirmedQueue (僅限前端讀取)', async () => {
    const momDb = testEnv.authenticatedContext('line_mom').firestore();
    const queueRef = doc(momDb, 'unconfirmedQueue/item_01');

    // 允許讀取以供前端修正
    await assertSucceeds(getDoc(queueRef));
    // 拒絕寫入
    await assertFails(setDoc(queueRef, { rawText: '偷塞訊息' }));
  });
});
