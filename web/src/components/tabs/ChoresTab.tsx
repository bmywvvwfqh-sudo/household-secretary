import React, { useState, useEffect } from 'react';
import { db, functions } from '../../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '../../hooks/useToast';
import { Plus, Trash2, CheckCircle2, Circle, User, Sparkles, Brain } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ChoreItem {
  id: string;
  task: string;
  assignee: string;
  isDone: boolean;
  createdBy: string;
  aiReason?: string;
}

const ASSIGNEES = ['媽媽', '爸爸', '小孩', '共同'];

export const ChoresTab: React.FC = () => {
  const { user } = useAuth();
  const [chores, setChores] = useState<ChoreItem[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newAssignee, setNewAssignee] = useState('媽媽');
  const [filterAssignee, setFilterAssignee] = useState<string>('全部');
  const [aiComment, setAiComment] = useState<string>('');
  const [isAllocating, setIsAllocating] = useState(false);
  const toast = useToast();

  const familyId = user?.uid || '';

  const mockChores: ChoreItem[] = [
    { id: '1', task: '吸地板 🧹', assignee: '媽媽', isDone: false, createdBy: '媽媽', aiReason: '吸塵器拿著像打高爾夫，交給媽媽優雅揮灑！' },
    { id: '2', task: '倒垃圾 🗑️', assignee: '爸爸', isDone: true, createdBy: '媽媽', aiReason: '追垃圾車需要百米衝刺，爸爸非你莫屬！' },
    { id: '3', task: '洗碗 🍽️', assignee: '小孩', isDone: false, createdBy: '媽媽', aiReason: '飯後適度洗碗，是培養生活自理能力的第一步！' },
    { id: '4', task: '清貓砂盆 🐱', assignee: '共同', isDone: false, createdBy: '爸爸', aiReason: '貓主子是大家的，鏟屎官人人有份！' },
    { id: '5', task: '曬衣服 👕', assignee: '媽媽', isDone: true, createdBy: '媽媽' },
  ];

  useEffect(() => {
    if (!db) {
      setChores(mockChores);
      return;
    }
    if (!familyId) return;

    // 1. 訂閱家務列表
    const choresQuery = query(collection(db, 'families', familyId, 'chores'));
    const unsubscribeChores = onSnapshot(choresQuery, (snapshot) => {
      const data: ChoreItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data();
        data.push({ 
          id: d.id, 
          task: item.task, 
          assignee: item.assignee, 
          isDone: item.isDone, 
          createdBy: item.createdBy,
          aiReason: item.aiReason
        });
      });
      setChores(data);
    }, (err) => {
      console.error(err);
      toast.show('無法載入家務清單，請檢查權限。', 'error');
    });

    // 2. 訂閱家庭設定（獲取 AI 評語）
    const familyDocRef = doc(db, 'families', familyId);
    const unsubscribeFamily = onSnapshot(familyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const familyData = docSnap.data();
        setAiComment(familyData.lastChoreAIComment || '');
      }
    }, (err) => {
      console.error('訂閱家庭資料失敗:', err);
    });

    return () => {
      unsubscribeChores();
      unsubscribeFamily();
    };
  }, [familyId]);

  const handleAddChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) {
      toast.show('請輸入家務名稱', 'warning');
      return;
    }
    const newChore = { task: newTask.trim(), assignee: newAssignee, isDone: false, createdBy: user?.displayName || '媽媽' };
    try {
      if (db) {
        await addDoc(collection(db, 'families', familyId, 'chores'), newChore);
      } else {
        setChores((prev) => [...prev, { id: Math.random().toString(), ...newChore }]);
      }
      setNewTask('');
      toast.show(`已指派「${newTask}」給 ${newAssignee}`, 'success');
    } catch (err: any) {
      toast.show(`新增失敗: ${err.message}`, 'error');
    }
  };

  const handleAIAllocation = async () => {
    const pendingChores = chores.filter(c => !c.isDone);
    if (pendingChores.length === 0) {
      toast.show('目前沒有未完成的家務需要 AI 分配唷！', 'warning');
      return;
    }

    setIsAllocating(true);
    toast.show('🤖 AI 管家已收到任務，正在研究最佳分工，請稍候...', 'info');

    try {
      if (!db) {
        // Mock 模式的模擬回應
        setTimeout(() => {
          setChores(prev => prev.map(c => !c.isDone ? { ...c, assignee: '爸爸', aiReason: '模擬 AI 配派理由' } : c));
          setAiComment('模擬的管家溫馨評語。');
          setIsAllocating(false);
          toast.show('✨ [模擬] AI 智慧分配完畢！', 'success');
        }, 1500);
        return;
      }
      
      const allocateFn = httpsCallable<any, any>(functions, 'aiAllocateChores');
      const response = await allocateFn({
        familyId,
        chores: pendingChores.map(c => ({ id: c.id, task: c.task }))
      });
      
      if (response.data?.success) {
        toast.show('✨ AI 智慧分配完畢！大家要開心地分工合作喔！', 'success');
      } else {
        toast.show('AI 分配失敗，請重試。', 'error');
      }
    } catch (err: any) {
      console.error(err);
      toast.show(`AI 分配失敗: ${err.message || '未知錯誤'}`, 'error');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleToggleDone = async (id: string, current: boolean) => {
    try {
      if (db) {
        await updateDoc(doc(db, 'families', familyId, 'chores', id), { isDone: !current });
      } else {
        setChores((prev) => prev.map((c) => c.id === id ? { ...c, isDone: !current } : c));
      }
      toast.show(current ? '已標記為未完成' : '✅ 家務完成！', 'success');
    } catch (err: any) {
      toast.show(`操作失敗: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'families', familyId, 'chores', id));
      } else {
        setChores((prev) => prev.filter((c) => c.id !== id));
      }
      toast.show('家務已刪除', 'info');
    } catch (err: any) {
      toast.show(`刪除失敗: ${err.message}`, 'error');
    }
  };

  const filtered = filterAssignee === '全部' ? chores : chores.filter((c) => c.assignee === filterAssignee);
  const doneCount = filtered.filter((c) => c.isDone).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
      {/* 說明面板 */}
      <div className="glass-panel" style={{
        padding: '24px', borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(162, 155, 254, 0.05) 100%)',
      }}>
        <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>🧹 家務分配板</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          「一句話，輪流分工不爭執。」<br />
          在 LINE 說「請爸爸去倒垃圾」，管家自動記錄在此！
        </p>

        {/* AI 分配點評公告區 */}
        {aiComment && (
          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.12) 0%, rgba(251, 191, 36, 0.04) 100%)',
            borderLeft: '4px solid var(--accent-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginTop: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Sparkles size={13} />
              <span>🤖 本期管家溫馨分工點評</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.45', margin: 0, fontStyle: 'italic' }}>
              「 {aiComment} 」
            </p>
          </div>
        )}
      </div>

      {/* 篩選 + 進度 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {['全部', ...ASSIGNEES].map((a) => (
          <button key={a} onClick={() => setFilterAssignee(a)} style={{
            padding: '8px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap',
            background: filterAssignee === a ? 'var(--accent-warning)' : 'var(--glass-bg)',
            color: filterAssignee === a ? '#fff' : 'var(--text-secondary)',
            borderWidth: '1px', borderStyle: 'solid',
            borderColor: filterAssignee === a ? 'transparent' : 'var(--glass-border)',
            transition: 'all 0.2s'
          }}>
            {a} {a !== '全部' && `(${chores.filter(c => c.assignee === a && !c.isDone).length})`}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
          完成 {doneCount} / {filtered.length} 項
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* 新增家務表單 */}
        <form onSubmit={handleAddChore} translate="no" className="glass-panel" style={{
          padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px'
        }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} color="var(--accent-warning)" />
            <span>指派新家務</span>
          </h4>
          <input
            type="text"
            translate="no"
            placeholder="例如：清洗浴室、整理書桌"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            style={{
              padding: '10px 16px', borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} /> 指派給
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ASSIGNEES.map((a) => (
                <button key={a} type="button" onClick={() => setNewAssignee(a)} style={{
                  padding: '6px 14px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: newAssignee === a ? 'bold' : 'normal',
                  background: newAssignee === a ? 'var(--accent-primary)' : 'var(--glass-bg)',
                  color: newAssignee === a ? '#fff' : 'var(--text-secondary)',
                  borderWidth: '1px', borderStyle: 'solid',
                  borderColor: newAssignee === a ? 'transparent' : 'var(--glass-border)',
                }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" style={{
            padding: '10px', borderRadius: '10px', border: 'none',
            background: 'var(--accent-warning)', color: '#fff',
            fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)'
          }}>
            新增並指派
          </button>
        </form>

        {/* 家務清單 */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ fontWeight: 'bold', fontSize: '16px', margin: 0 }}>
              📋 家務清單 ({filtered.length} 項)
            </h4>
            
            {/* AI 智慧分配按鈕 */}
            <button
              type="button"
              onClick={handleAIAllocation}
              disabled={isAllocating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: isAllocating ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #a29bfe 100%)',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(108, 92, 231, 0.3)',
                transition: 'all 0.2s',
                opacity: isAllocating ? 0.7 : 1
              }}
              onMouseOver={(e) => {
                if (!isAllocating) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 15px rgba(108, 92, 231, 0.5)';
                }
              }}
              onMouseOut={(e) => {
                if (!isAllocating) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(108, 92, 231, 0.3)';
                }
              }}
            >
              <Brain size={13} />
              <span>{isAllocating ? '分配中...' : 'AI 智慧分配'}</span>
            </button>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <p>🎉 沒有待辦家務！</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>在左側新增或透過 LINE 指派。</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map((chore) => (
                <div key={chore.id} className="glass-card" style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: '12px',
                  opacity: chore.isDone ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}>
                  <div onClick={() => handleToggleDone(chore.id, chore.isDone)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                    {chore.isDone
                      ? <CheckCircle2 size={20} color="var(--accent-success)" />
                      : <Circle size={20} color="var(--text-secondary)" />}
                  </div>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleToggleDone(chore.id, chore.isDone)}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', textDecoration: chore.isDone ? 'line-through' : 'none' }}>
                      {chore.task}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      負責人：{chore.assignee} · 登記人：{chore.createdBy}
                    </div>
                    {/* AI 分配理由展示 */}
                    {chore.aiReason && !chore.isDone && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: 'var(--accent-warning)', 
                        marginTop: '4px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        background: 'rgba(251, 191, 36, 0.06)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        width: 'fit-content'
                      }}>
                        <Sparkles size={11} style={{ flexShrink: 0 }} />
                        <span style={{ lineHeight: '1.2' }}>管家點評：{chore.aiReason}</span>
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px',
                    background: 'rgba(108, 92, 231, 0.12)', color: 'var(--accent-primary)',
                    flexShrink: 0
                  }}>
                    {chore.assignee}
                  </span>
                  <button onClick={() => handleDelete(chore.id)} style={{
                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                    cursor: 'pointer', padding: '4px', flexShrink: 0
                  }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-danger)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
