import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini 結構化輸出 Schema 定義 (使用字串字面值相容所有版本)
const taskSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['calendar', 'shopping', 'finance', 'unconfirmed'],
      description: '項目類別：calendar (行程行事曆), shopping (店家採買清單), finance (財務收支記帳), unconfirmed (無法解析/待確認記事)'
    },
    // 行程欄位
    title: { type: 'string', description: '行程標題 (如：帶貓咪看醫生)' },
    dateTime: { type: 'string', description: '行程 ISO 8601 時間字串 (如：2026-07-26T15:00:00)' },

    // 採買欄位
    item: { type: 'string', description: '採買物品名稱 (如：全鮮乳)' },
    store: { type: 'string', description: '特定店家 (如：好市多, 全聯, 家樂福)' },
    quantity: { type: 'string', description: '採買數量/單位 (如：1加侖)' },

    // 財務欄位
    amount: { type: 'integer', description: '記帳金額 (如：850)' },
    category: { type: 'string', description: '記帳分類 (如：餐飲, 交通, 水電, 貓咪開銷)' },
    direction: {
      type: 'string',
      enum: ['expense', 'income'],
      description: '收支方向：expense (支出), income (收入)'
    },
    remark: { type: 'string', description: '備註說明' },

    // 待確認欄位
    rawText: { type: 'string', description: '當無法明確歸類時，保留其原始文字內容' }
  },
  required: ['type']
};

const geminiOutputSchema = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: taskSchema,
      description: '從用戶輸入中批次拆解出的所有待處理項目'
    },
    rawReply: {
      type: 'string',
      description: '回覆給 LINE 使用者的繁體中文親切溫馨短語，簡述已登記的內容。'
    }
  },
  required: ['tasks', 'rawReply']
};

export interface GeminiParsedTask {
  type: 'calendar' | 'shopping' | 'finance' | 'unconfirmed';
  title?: string;
  dateTime?: string;
  item?: string;
  store?: string;
  quantity?: string;
  amount?: number;
  category?: string;
  direction?: 'expense' | 'income';
  remark?: string;
  rawText?: string;
}

export interface GeminiParsedResponse {
  tasks: GeminiParsedTask[];
  rawReply: string;
}

/**
 * 使用 Gemini 1.5 Flash 進行多模態 NLP 批次解析
 * @param input 文字內容或語音檔 Buffer
 * @param mimeType 媒體類型，文字時為 text/plain，語音時通常為 audio/x-m4a, audio/wav, audio/ogg 等
 * @param apiKey Gemini API Key
 * @param asOfDate 當前日期基準 (ISO 8601)，協助 Gemini 換算「明天、週五」等相對時間
 */
export async function parseInputWithGemini(
  input: string | Buffer,
  mimeType: string,
  apiKey: string,
  asOfDate: string
): Promise<GeminiParsedResponse> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: geminiOutputSchema,
      temperature: 0.1 // 低隨機性以獲取穩定的 JSON 結構
    } as any // 相容舊版套件型別，執行時 API 仍支援
  });

  const systemInstruction = `
你是一位貼心的家庭秘書 AI 管家。你的任務是將用戶（主要是太太）發送的語音或文字訊息進行批次拆解，分類為以下三類項目：
1. 共享行事曆 (calendar)：與時間、約定、提醒相關。
2. 特定店家採買 (shopping)：提及特定店家（如：全聯、好市多、家樂福、傳統市場）的採買物資。
3. 財務記帳 (finance)：提及金錢支出或收入的項目。

### 當前日期基準 (asOfDate) 參考：
當前時間基準為：${asOfDate}
如果用戶提及相對時間，如「明天下午三點」、「週五」、「下週一」，請以此基準計算出具體的 ISO 8601 時間字串填入 dateTime。

### 分類規則：
- 行程 (calendar)：標題標示為 title，時間標示為 dateTime (格式：YYYY-MM-DDTHH:mm:ss)。
- 採買 (shopping)：物品標示為 item，店家標示為 store，數量/規格標示為 quantity。
- 記帳 (finance)：金額為整數 amount，分類為 category（請從中文字面判斷，如: 水電、餐飲、交通、娛樂），收支方向 direction 必須為 'expense' (支出) 或 'income' (收入)。
- 待確認項目 (unconfirmed)：如果無法精準分類或內容含糊，請將 type 設為 'unconfirmed'，並將原文記錄在 rawText。

最後，寫一句簡短、繁體中文且帶有親切溫馨氣氛的 rawReply 作為對使用者的答覆，告訴他們你已經登記了哪些項目（例如：「好的，太太！我已經幫您記下了週六帶貓看醫生，還有好市多的牛奶採買囉！🥰」）。
`;

  let contents: any[];

  if (mimeType === 'text/plain') {
    // 文字輸入：必須包成 Content 物件
    contents = [{
      role: 'user',
      parts: [{ text: input as string }]
    }];
  } else {
    // 語音多模態輸入：音訊 + 提示語合為同一個 Content 物件的多個 parts
    contents = [{
      role: 'user',
      parts: [
        {
          inlineData: {
            data: (input as Buffer).toString('base64'),
            mimeType: mimeType
          }
        },
        { text: "請仔細聽這段語音，並依照系統指令拆解內容。" }
      ]
    }];
  }

  const result = await model.generateContent({
    contents,
    systemInstruction
  });

  const responseText = result.response.text();
  if (!responseText) {
    throw new Error("Gemini 返回空回應。");
  }

  return JSON.parse(responseText) as GeminiParsedResponse;
}

/**
 * 🤖 使用 Gemini 3.5 Flash 智慧分配家務
 */
export async function allocateChoresWithAI(
  chores: { id: string; task: string }[],
  apiKey: string
): Promise<{
  assignments: { choreId: string; assignee: string; reason: string }[];
  overallComment: string;
}> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          assignments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                choreId: { type: 'string', description: '家務的 ID' },
                assignee: { type: 'string', enum: ['媽媽', '爸爸', '小孩', '共同'], description: '指派的負責人' },
                reason: { type: 'string', description: '分配該負責人的溫馨或幽默理由 (限繁體中文，一行字以內)' }
              },
              required: ['choreId', 'assignee', 'reason']
            },
            description: '所有家務的 AI 分配結果'
          },
          overallComment: {
            type: 'string',
            description: '管家對這次家務分配的總體點評與溫馨叮嚀 (限繁體中文，兩行字以內)'
          }
        },
        required: ['assignments', 'overallComment']
      },
      temperature: 0.2
    } as any
  });

  const systemInstruction = `
你是一位幽默貼心的家庭祕書 AI 管家。
使用者會提供你一項或多項尚未完成的家庭家務（包含 ID 與家務名稱）。
你的任務是把這些家務合理、平衡且有趣地分配給家庭成員：'媽媽'、'爸爸' | '小孩' | '共同'。
分派原則：
- 考慮家務的性質，將體力活、技術活、或適合小朋友做的家務進行合理分配。
- 分配必須平衡，不要全部塞給同一個人。
- 寫出令人莞爾、溫馨幽默且具有人情味的分配理由 (繁體中文)，例如：'爸爸最近肩膀酸，這個擦地板就交給小孩當作運動吧！' 或 '倒垃圾需要追垃圾車，爸爸跑得最快！'。
- 最後寫一段整體的溫馨叮嚀或口號 (overallComment)，鼓勵大家一起為家庭努力。
`;

  const inputPrompt = `請分配以下家務：\n` + JSON.stringify(chores, null, 2);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: inputPrompt }] }],
    systemInstruction
  });

  const responseText = result.response.text();
  if (!responseText) {
    throw new Error("Gemini 返回空分配結果。");
  }

  return JSON.parse(responseText);
}
