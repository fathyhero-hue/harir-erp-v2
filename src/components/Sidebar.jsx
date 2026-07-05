import React from 'react';

export default function Sidebar({ activePage, setActivePage, userRole }) {
  // القائمة الكاملة لكل تبويبات السيستم وصلاحيات أدوارها
  // تم ضبط الأدوار لتتطابق تماماً مع ما سيتم تسجيله في جدول system_users
  const allItems = [
    { id: 'sales', label: '🧾 نقطة البيع والفواتير', icon: '🧾', roles: ['مدير عام', 'أمين مخازن', 'محاسب', 'مبيعات'] },
    { id: 'inventory', label: '📦 إدارة المخازن والمواد', icon: '🏪', roles: ['مدير عام', 'أمين مخازن', 'مشرف إنتاج'] },
    { id: 'smart-calculator', label: '📐 حاسبة المقايسات والتسعير الذكي', icon: '📊', roles: ['مدير عام', 'مبيعات', 'مشرف إنتاج'] },
    { id: 'catalog-manager', label: '🖼️ التحكم الشامل في الكتالوج', icon: '⚙️', roles: ['مدير عام', 'مبيعات'] },
    { id: 'customers', label: '👥 العملاء والأقساط والفواتير', icon: '💳', roles: ['مدير عام', 'محاسب', 'مبيعات'] },
    { id: 'factory', label: '🏭 أوامر الشغل بالمصنع', icon: '🛠️', roles: ['مدير عام', 'مشرف إنتاج'] },
    { id: 'financials', label: '📊 الحساب الجاري والتقارير المالية', icon: '📈', roles: ['مدير عام', 'محاسب'] },
    { id: 'employees', label: '👑 التحكم بالموظفين وسجل الرقابة', icon: '🧰', roles: ['مدير عام'] },
    { id: 'catalog', label: '✨ معاينة الكتالوج العام', icon: '✨', roles: ['مدير عام', 'أمين مخازن', 'محاسب', 'مبيعات', 'مشرف إنتاج'] },
  ];

  // تصفية التبويبات بناءً على الدور (Role) المسجل في جلسة الدخول
  const filteredItems = allItems.filter(item => item.roles.includes(userRole || 'مدير عام'));

  return (
    <div style={{
      width: '260px',
      backgroundColor: '#0f172a',
      borderLeft: '1px solid #1e293b',
      height: '100vh',
      position: 'fixed',
      top: 0,
      right: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 10px',
      boxSizing: 'border-box',
      zIndex: 1000
    }}>
      {/* رأس القائمة الجانبية */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '30px', 
        borderBottom: '1px solid #1e293b', 
        paddingBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <img src="/logo.png" alt="لوجو شركة حرير" style={{ height: '65px', width: 'auto', display: 'block' }} />
        <div>
          <h2 style={{ color: '#f43f5e', margin: 0, fontSize: '20px', fontWeight: 'bold' }}>حـريـر | أثاث ومفروشات</h2>
          <small style={{ color: '#64748b', fontSize: '11px' }}>نظام الإدارة الحسابي المركزي</small>
        </div>
      </div>

      {/* توليد أزرار القائمة المصفاة أمنياً */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
        {filteredItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              style={{
                width: '100%',
                padding: '12px 15px',
                textAlign: 'right',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isActive ? '#6B1D2F' : 'transparent',
                color: isActive ? 'white' : '#cbd5e1',
                fontSize: '14px',
                fontWeight: isActive ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* حقوق النظام */}
      <div style={{ textAlign: 'center', borderTop: '1px solid #1e293b', paddingTop: '15px', color: '#475569', fontSize: '10px', marginTop: 'auto' }}>
        جميع الحقوق محفوظة لكابتن هيرو © 2026
      </div>
    </div>
  );
}