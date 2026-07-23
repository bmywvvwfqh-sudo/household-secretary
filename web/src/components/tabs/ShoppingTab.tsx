import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '../../hooks/useToast';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ShoppingItem {
  id: string;
  item: string;
  store: string;
  quantity: string;
  isBought: boolean;
  createdBy: string;
}

export const ShoppingTab: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [activeStore, setActiveStore] = useState<string>('好市多');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const toast = useToast();

  const familyId = "family-123";
  const stores = ['好市多', '全聯', '家樂福', '一般採買'];

  // Mock 資料，供訪客通道使用
  const mockItems: ShoppingItem[] = [
    { id: '1', item: '🥛 全鮮乳', store: '好市多', quantity: '1加侖', isBought: false, createdBy: 'mom' },
    { id: '2', item: '🧻 抽取式衛生紙', store: '好市多', quantity: '1箱', isBought: false, createdBy: 'mom' },
    { id: '3', item: '🥬 生鮮有機花椰菜', store: '全聯', quantity: '2包', isBought: false, createdBy: 'dad' },
    { id: '4', item: '🥚 雞蛋', store: '全聯', quantity: '1盒', isBought: true, createdBy: 'mom' },
    { id: '5', item: '🥤 無糖可樂', store: '家樂福', quantity: '6罐', isBought: false, createdBy: 'mom' },
  ];

  useEffect(() => {
    if (!db) {
      // 訪客預覽：使用 Mock 資料
      setItems(mockItems);
      return;
    }

    // 真實 Firestore 資料同步
    const q = query(collection(db, 'families', familyId, 'shoppingList'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shoppingData: ShoppingItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        shoppingData.push({
          id: doc.id,
          item: data.item,
          store: data.store,
          quantity: data.quantity,
          isBought: data.isBought,
          createdBy: data.createdBy
        });
      });
      setItems(shoppingData);
    }, (err) => {
      console.error(err);
      toast.show('無法載入採買清單，請檢查權限。', 'error');
    });

    return () => unsubscribe();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem = {
      item: newItemName,
      store: activeStore,
      quantity: newItemQty,
      isBought: false,
      createdBy: user?.displayName || '媽媽'
    };

    try {
      if (db) {
        await addDoc(collection(db, 'families', familyId, 'shoppingList'), newItem);
      } else {
        // Mock 新增
        const createdItem: ShoppingItem = {
          id: Math.random().toString(),
          ...newItem
        };
        setItems((prev) => [...prev, createdItem]);
      }
      setNewItemName('');
      setNewItemQty('1');
      toast.show(`已成功加入「${activeStore}」採買單`, 'success');
    } catch (err: any) {
      toast.show(`新增失敗: ${err.message}`, 'error');
    }
  };

  const handleToggleBought = async (id: string, currentStatus: boolean) => {
    try {
      if (db) {
        await updateDoc(doc(db, 'families', familyId, 'shoppingList', id), {
          isBought: !currentStatus
        });
      } else {
        // Mock 切換
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isBought: !currentStatus } : item))
        );
      }
      toast.show(currentStatus ? '標記為未購買' : '🎉 已放入購物車！', 'success');
    } catch (err: any) {
      toast.show(`操作失敗: ${err.message}`, 'error');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'families', familyId, 'shoppingList', id));
      } else {
        // Mock 刪除
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
      toast.show('項目已成功刪除', 'info');
    } catch (err: any) {
      toast.show(`刪除失敗: ${err.message}`, 'error');
    }
  };

  const clearBoughtItems = async () => {
    const boughtItems = items.filter((i) => i.isBought && i.store === activeStore);
    if (boughtItems.length === 0) return;

    try {
      if (db) {
        const batch = writeBatch(db);
        boughtItems.forEach((item) => {
          const ref = doc(db, 'families', familyId, 'shoppingList', item.id);
          batch.delete(ref);
        });
        await batch.commit();
      } else {
        // Mock 批次清除
        setItems((prev) => prev.filter((item) => !(item.isBought && item.store === activeStore)));
      }
      toast.show(`已清除「${activeStore}」中所有已買項目`, 'info');
    } catch (err: any) {
      toast.show(`清除失敗: ${err.message}`, 'error');
    }
  };

  const filteredItems = items.filter((item) => item.store === activeStore);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
      {/* 頂部說明面板 */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(162, 155, 254, 0.05) 100%)',
      }}>
        <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>🛒 特定店家採買清單</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          「太太隨口一句，管家自動分類。」<br />
          在 LINE 傳送「好市多買衛生紙」或「全聯買牛奶 2 瓶」，就會即時同步於此！
        </p>
      </div>

      {/* 店家切換標籤 */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {stores.map((store) => (
          <button
            key={store}
            onClick={() => setActiveStore(store)}
            style={{
              padding: '10px 20px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              background: activeStore === store ? 'var(--accent-success)' : 'var(--glass-bg)',
              color: activeStore === store ? '#fff' : 'var(--text-secondary)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: activeStore === store ? 'transparent' : 'var(--glass-border)',
              boxShadow: activeStore === store ? '0 4px 12px rgba(52, 211, 153, 0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {store} ({items.filter(i => i.store === store && !i.isBought).length})
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        {/* 新增採買物資表單 */}
        <form onSubmit={handleAddItem} className="glass-panel" style={{
          padding: '20px',
          borderRadius: '12px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder="請輸入採買項目 (例如: 鮮乳)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            style={{
              flex: 2,
              minWidth: '200px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <input
            type="text"
            placeholder="數量/規格 (例如: 1加侖)"
            value={newItemQty}
            onChange={(e) => setNewItemQty(e.target.value)}
            style={{
              flex: 1,
              minWidth: '120px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-success)',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(52, 211, 153, 0.2)'
            }}
          >
            <Plus size={16} />
            <span>手動新增</span>
          </button>
        </form>

        {/* 採買清單列表 */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ fontWeight: 'bold', fontSize: '16px' }}>🛍️ 「{activeStore}」採買細項</h4>
            {filteredItems.some(i => i.isBought) && (
              <button
                onClick={clearBoughtItems}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-danger)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                清除已買項目
              </button>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <p>📭 目前此商店沒有待買清單！</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>您可以手動新增，或使用 LINE 發送語音新增喔！</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    background: item.isBought ? 'rgba(255,255,255,0.1)' : 'var(--glass-bg)',
                    opacity: item.isBought ? 0.6 : 1,
                    textDecoration: item.isBought ? 'line-through' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <div
                    onClick={() => handleToggleBought(item.id, item.isBought)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', flex: 1 }}
                  >
                    {item.isBought ? (
                      <CheckCircle2 size={20} color="var(--accent-success)" />
                    ) : (
                      <Circle size={20} color="var(--text-secondary)" />
                    )}
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{item.item}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        數量: {item.quantity} · 登記人: {item.createdBy}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-danger)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    <Trash2 size={16} />
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
