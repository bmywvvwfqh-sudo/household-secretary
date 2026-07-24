import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '../../hooks/useToast';
import { Plus, Trash2, CheckCircle2, Circle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ChoreItem {
  id: string;
  task: string;
  assignee: string;
  isDone: boolean;
  createdBy: string;
}

const ASSIGNEES = ['媽媽', '爸爸', '小孩', '共同'];

export const ChoresTab: React.FC = () => {
  const { user } = useAuth();
  const [chores, setChores] = useState<ChoreItem[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newAssignee, setNewAssignee] = useState('媽媽');
  const [filterAssignee, setFilterAssignee] = useState<string>('全部');
  const toast = useToast();

  const familyId = user?.uid || '';

  const mockChores: ChoreItem[] = [
    { id: '1', task: '吸地板 🧹', assignee: '媽媽', isDone: false, createdBy: '媽媽' },
    { id: '2', task: '倒垃圾 🗑️', assignee: '爸爸', isDone: true, createdBy: '媽媽' },
    { id: '3', task: '洗碗 🍽️', assignee: '小孩', isDone: false, createdBy: '媽媽' },
    { id: '4', task: '清貓砂盆 🐱', assignee: '共同', isDone: false, createdBy: '爸爸' },
    { id: '5', task: '曬衣服 👕', assignee: '媽媽', isDone: true, createdBy: '媽媽' },
  ];

  useEffect(() => {
    if (!db) {
      setChores(mockChores);
      return;
    }
    if (!familyId) return;
    const q = query(collection(db, 'families', familyId, 'chores'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ChoreItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data();
        data.push({ id: d.id, task: item.task, assignee: item.assignee, isDone: item.isDone, createdBy: item.createdBy });
      });
      setChores(data);
    }, (err) => {
      console.error(err);
      toast.show('無法載入家務清單，請檢查權限。', 'error');
    });
    return () => unsubscribe();
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
          <h4 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '20px' }}>
            📋 家務清單 ({filtered.length} 項)
          </h4>
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
