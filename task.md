# 家庭秘書專案 — 實作任務清單 (TODO)

## 🔷 Phase 1：基礎架構、Auth 與 UI Shell (已完成)
- [x] 前端 React TypeScript 專案初始化
- [x] 全站 CSS 設計系統 (index.css) 玻璃擬態與深淺雙主題
- [x] UI 錯誤處理元件與 hooks (ErrorBoundary, Toast, 離線 Banner)
- [x] 前端 Firebase SDK 連線模組 (firebase.ts, AuthContext.tsx)
- [x] 響應式 UI Shell 版面 (Header, Sidebar, BottomNav, LoginScreen)
- [x] 後端 Functions 環境依賴與 tsconfig 設定 (安裝中)
- [x] 模擬器本地執行驗收與 Google 登入驗證

## 🔷 Phase 2：LINE Webhook 與 Gemini NLP 智慧管家 (已完成)
- [x] 內建 LINE Webhook 非同步 `200 OK` 接收端點 (functions/src/lineWebhook.ts)
- [x] Cloud Tasks 佇列配置與 OIDC token 安全驗收
- [x] 冪等去重實作 (ProcessedEvents, webhookEventId)
- [x] Gemini 1.5 Flash API 連線與台灣中文 Prompt (functions/src/gemini.ts)
- [x] 語音檔 (<10MB) 二進位下載與多模態音訊解析
- [x] 三層式降級 Fallback 策略 (Gemini -> Regex -> 待確認佇列)
- [x] 後端單元測試與 Fallback 邏輯驗證 (Vitest)

## 🔷 Phase 3：LINE 帳號配對綁定、店家採買與 Google 日曆 (已完成)
- [x] 6 位數配對碼原子 Transaction 驗證與安全時效綁定 (BindingPanel 面板與後端 Transaction)
- [x] 店家專屬採買清單過濾 (好市多、全聯、家樂福、傳統市場) (ShoppingTab 實作與勾選)
- [x] iCal 唯讀日曆讀取與 Google OAuth 2.0 雙軌同步 (calendarSync.ts 與 ics 下載)
- [x] 前端 Firestore Security Rules 安全規則整合測試 (firestore-rules.test.ts 撰寫)

## 🔷 Phase 4：專業財務與動態餘額計算 (已完成)
- [x] 財務收支方向模型 (`direction: 'expense' | 'income'`) (FinanceTab 元件與後端模型)
- [x] 移除 balance 欄位，改用 `initialBalance` 搭配交易明細動態計算 (Ledger 動態加總算法)
- [x] 月結快照 (MonthlySnapshot) 背景排程定時生成 (每月 1 日 00:05 排程) (financeLedger.ts)
- [x] 預算上限警報 (80% / 100%) 與 LINE 互動警示 (checkBudgetAlert 與 Webhook 回覆整合)

## 🔷 Phase 5：全功能驗證與線上部署
- [ ] 前端 Vercel CI/CD 自動部署
- [ ] 後端 GitHub Actions 自動測試與 Functions 部署門禁
- [ ] 真實 LINE 官方帳號對話整合與 $0 推播配額驗收
- [ ] 跨裝置 (iOS/Android/Desktop) 無破損最終驗收
