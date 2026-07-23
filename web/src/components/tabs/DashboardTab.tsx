import { 
  Calendar, 
  ShoppingBag, 
  DollarSign, 
  Mic, 
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { BindingPanel } from '../BindingPanel';

export const DashboardTab: React.FC = () => {
  const toast = useToast();

  const handleVoiceTrigger = () => {
    toast.show('🎤 正在錄音中...請對著麥克風說話。', 'info');
    setTimeout(() => {
      toast.show('🎤 錄音結束，正在傳送音檔 (2.4MB) 直送 Gemini 解析...', 'info');
      setTimeout(() => {
        toast.show('✅ 語音解析成功！已記入帳目：\n• 全聯消費：$850 元 (飲食 > 超市採買)', 'success');
      }, 2000);
    }, 2000);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      animation: 'fadeIn 0.4s ease'
    }}>
      {/* 歡迎與溫馨小語 */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.2) 0%, rgba(162, 155, 254, 0.1) 100%)',
        position: 'relative'
      }}>
        <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>早安，家庭主理人！☀️</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          「家人的安全與舒適，因為有您的悉心打理而完美。」<br />
          今日有 2 項行程，全聯待買 3 項，本月家庭預算剩餘 42%。
        </p>
        
        {/* 快捷語音記帳漂浮鈕 */}
        <button
          onClick={handleVoiceTrigger}
          style={{
            position: 'absolute',
            right: '24px',
            bottom: '-20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(108, 92, 231, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="太太專用一鍵語音記帳/記事"
        >
          <Mic size={24} />
        </button>
      </div>

      {/* 四欄儀表板 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginTop: '10px'
      }}>
        {/* 今日行程卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <Calendar size={18} color="var(--accent-primary)" />
              <span>今日行程</span>
            </div>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(108, 92, 231, 0.15)', color: 'var(--accent-primary)', fontWeight: 'bold' }}>2 項</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>15:00</span>
              <span style={{ fontSize: '13px' }}>繳納本月水費 ($1,250)</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', padding: '8px 0' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>19:30</span>
              <span style={{ fontSize: '13px' }}>帶貓咪去動物醫院看診 🐱</span>
            </div>
          </div>
        </div>

        {/* 待買清單卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <ShoppingBag size={18} color="var(--accent-success)" />
              <span>待買清單 (缺貨通知)</span>
            </div>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.15)', color: 'var(--accent-success)', fontWeight: 'bold' }}>3 項</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '13px' }}>🥛 全鮮乳 (1加侖)</span>
              <span style={{ fontSize: '11px', color: 'var(--accent-success)', fontWeight: 'bold' }}>[好市多]</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '13px' }}>🧻 抽取式衛生紙</span>
              <span style={{ fontSize: '11px', color: 'var(--accent-success)', fontWeight: 'bold' }}>[好市多]</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: '13px' }}>🥬 生鮮有機花椰菜</span>
              <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>[全聯]</span>
            </div>
          </div>
        </div>

        {/* 財務預算預警卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <DollarSign size={18} color="var(--accent-warning)" />
              <span>預算狀態</span>
            </div>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.15)', color: 'var(--accent-warning)', fontWeight: 'bold' }}>注意</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>本月飲食預算限額:</span>
              <span style={{ fontWeight: 'bold' }}>$15,000 / $20,000</span>
            </div>
            
            {/* 預算進度條 */}
            <div style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              background: 'var(--glass-border)',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '75%', // 已用 75%
                height: '100%',
                background: 'var(--accent-warning)',
                borderRadius: '4px'
              }} />
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--accent-danger)',
              fontSize: '11px',
              fontWeight: 500,
              marginTop: '6px'
            }}>
              <AlertTriangle size={14} />
              <span>已達警報閾值 75%，超額時 LINE 將自動示警！</span>
            </div>
          </div>
        </div>
        
        <BindingPanel />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
