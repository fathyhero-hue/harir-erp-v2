import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Factory from './pages/Factory';
import Financials from './pages/Financials'; 
import Catalog from './pages/Catalog';
import CatalogManager from './pages/CatalogManager';
import Employees from './pages/Employees'; 
import SupervisorPanel from './pages/SupervisorPanel'; 
import ClientPortal from './pages/ClientPortal'; 
import { supabase } from './supabaseClient';

export default function App() {
  const checkInitialPage = () => {
    const hash = window.location.hash;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (hash.includes('#/client-portal') || path.includes('/client-portal') || params.get('view') === 'client') {
      return 'client-portal';
    }
    if (hash === '#supervisor' || path === '/supervisor' || params.get('mode') === 'supervisor') {
      return 'supervisor-panel';
    }
    return 'catalog';
  };

  const [activePage, setActivePage] = useState(checkInitialPage);
  
  // لقط جلسة الدخول المحفوظة تلقائياً لمنع طلب تسجيل الدخول عند الـ Refresh
  const [userSession, setUserSession] = useState(() => {
    const saved = localStorage.getItem('harir_user_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 🕒 ميزة كابتن هيرو: نظام الوقت والتاريخ الفعلي الحي (Real-Time Dashboard Clock)
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // تحديث الوقت كل ثانية بالملي ريال تايم
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // دالة لتنسيق التاريخ واليوم باللغة العربية الفصحى الاحترافية
  const formatArabicDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('ar-EG', options);
  };

  // دالة لتنسيق الساعة والدقائق والثواني بدقة
  const formatArabicTime = (date) => {
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash;
      const currentPath = window.location.pathname;
      
      if (currentHash.includes('#/client-portal')) {
        setActivePage('client-portal');
      } else if (currentHash === '#supervisor') {
        setActivePage('supervisor-panel');
        setShowLoginModal(false);
      } else if (currentHash === '#admin' || currentPath === '/admin') {
        if (userSession) {
          setActivePage('inventory');
        } else {
          setShowLoginModal(true);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    
    const currentHash = window.location.hash;
    const currentPath = window.location.pathname;
    if (currentHash === '#admin' || currentPath === '/admin') {
      if (userSession) setActivePage('inventory');
      else setShowLoginModal(true);
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [userSession]);

  const handleDashboardLogin = async (e) => {
    e.preventDefault();

    // 🔒 حرس الأمان المحلي والمباشر لبيانات كابتن هيرو (تخطي فوري آمن)
    if (usernameInput === 'hero' && passwordInput === '2026') {
      const sessionData = { name: 'كابتن هيرو', username: 'hero', role: 'مدير عام' };
      setUserSession(sessionData);
      localStorage.setItem('harir_user_session', JSON.stringify(sessionData));
      
      // توثيق النشاط في سجل العمليات الخلفي
      try {
        await supabase.from('activity_logs').insert([
          { user_name: 'كابتن هيرو', role: 'مدير عام', action_type: 'تسجيل دخول', details: 'قام بالدخول الآمن السريع للوحة التحكم' }
        ]);
      } catch (err) {}

      setShowLoginModal(false);
      setActivePage('inventory');
      setUsernameInput('');
      setPasswordInput('');
      return; 
    }

    // الفحص السحابي الطبيعي لباقي موظفي الإدارة والصلاحيات
    const { data, error } = await supabase
      .from('dashboard_users')
      .select('*')
      .eq('username', usernameInput)
      .eq('password', passwordInput)
      .single();

    if (!error && data) {
      const sessionData = { name: data.real_name, username: data.username, role: data.role };
      setUserSession(sessionData);
      localStorage.setItem('harir_user_session', JSON.stringify(sessionData));
      
      try {
        await supabase.from('activity_logs').insert([
          { user_name: data.real_name, role: data.role, action_type: 'تسجيل دخول', details: 'قام بالدخول الموثق للوحة التحكم الحسابية' }
        ]);
      } catch (err) {}

      setShowLoginModal(false);
      setActivePage('inventory');
      setUsernameInput('');
      setPasswordInput('');
    } else {
      alert('❌ اسم المستخدم أو كلمة المرور غير صحيحة!');
    }
  };

  const isPublicCatalog = activePage === 'catalog';
  const isSupervisorView = activePage === 'supervisor-panel';
  const isClientView = activePage === 'client-portal';
  const isAuth = !!userSession;

  const renderPage = () => {
    switch (activePage) {
      case 'client-portal': 
        return <ClientPortal />; 
      case 'supervisor-panel': 
        return <SupervisorPanel />; 
      case 'catalog': 
        return <Catalog />;
      case 'inventory': 
        return isAuth ? <Inventory userRole={userSession.role} userSession={userSession} /> : <Catalog />;
      case 'customers': 
        return isAuth ? <Customers userRole={userSession.role} userSession={userSession} /> : <Catalog />;
      case 'factory': 
        return isAuth ? <Factory userRole={userSession.role} userSession={userSession} /> : <Catalog />;
      case 'employees': 
        return isAuth ? <Employees userRole={userSession.role} userSession={userSession} /> : <Catalog />;
      case 'financials': 
        return isAuth ? <Financials userRole={userSession.role} userSession={userSession} /> : <Catalog />;
      case 'catalog-manager': 
        return isAuth ? <CatalogManager userRole={userSession.role} userSession={userSession} /> : <Catalog />;
      default: 
        return <Catalog />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', minHeight: '100vh', backgroundColor: '#020617', margin: 0, padding: 0 }}>
      
      {/* عرض القائمة الجانبية فقط عند إتمام التوثيق للأدوار المسموحة */}
      {!isPublicCatalog && !isSupervisorView && !isClientView && isAuth && (
        <Sidebar activePage={activePage} setActivePage={setActivePage} userRole={userSession.role} />
      )}
      
      <div style={{ 
        flex: 1, 
        marginRight: (isPublicCatalog || isSupervisorView || isClientView || !isAuth) ? '0' : '260px', 
        padding: (isPublicCatalog || isSupervisorView || isClientView || !isAuth) ? '0' : '20px', 
        backgroundColor: '#020617', color: 'white', minHeight: '100vh', boxSizing: 'border-box'
      }}>
        
        {/* شريط الإدارة العلوي الفخم: يظهر فقط عند تسجيل الدخول، ويعرض الوقت والتاريخ لايف */}
        {!isPublicCatalog && !isSupervisorView && !isClientView && isAuth && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            padding: '12px 25px',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid #1e293b',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }} className="print:hidden" dir="rtl">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>👋 مرحباً،</span>
              <strong style={{ color: '#38bdf8', fontSize: '16px' }}>{userSession.name}</strong>
              <span style={{ color: '#64748b', fontSize: '12px' }}>({userSession.role})</span>
            </div>
            
            {/* 🕒 شاشة الساعة والتاريخ الرقمية الحية الفاخرة بالثواني لايف */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '14px', fontWeight: 'bold' }}>
              <div style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📅</span>
                <span>{formatArabicDate(currentTime)}</span>
              </div>
              <div style={{ 
                backgroundColor: '#020617', 
                color: '#10b981', 
                padding: '6px 16px', 
                borderRadius: '8px', 
                fontFamily: 'monospace', 
                fontSize: '15px',
                border: '1px solid #1e293b',
                boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.6)'
              }}>
                ⏰ {formatArabicTime(currentTime)}
              </div>
            </div>
          </div>
        )}

        {/* زر السحب والتأمين الفوري في أسفل الشاشة ويمسح كل التوثيقات */}
        {!isPublicCatalog && !isSupervisorView && !isClientView && isAuth && (
          <div style={{ position: 'fixed', bottom: '20px', left: '20px', display: 'flex', flexDirection: 'column', gap: '5px', zIndex: 2000 }} className="print:hidden">
            <button 
              onClick={async () => {
                try {
                  await supabase.from('activity_logs').insert([
                    { user_name: userSession.name, role: userSession.role, action_type: 'تسجيل خروج', details: 'قام بتسجيل الخروج وتأمين النظام بالكامل' }
                  ]);
                } catch (err) {}
                
                setUserSession(null);
                localStorage.removeItem('harir_user_session');
                setActivePage('catalog');
                window.history.pushState({}, document.title, '/');
              }} 
              style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            >
              🚪 تسجيل خروج وتأمين اللوحة
            </button>
          </div>
        )}

        {renderPage()}
      </div>

      {/* مودال تسجيل الدخول الفخم المنفصل وعزل المسارات السفلية */}
      {showLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(2, 6, 23, 0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '30px', borderRadius: '12px', border: '1px solid #1e293b', width: '340px', textAlign: 'center' }} dir="rtl">
            <img src="/logo.png" alt="لوجو حرير الفخم" style={{ height: '65px', marginBottom: '15px', objectFit: 'contain' }} />
            <h3 style={{ margin: '0 0 5px 0', color: '#f43f5e', fontWeight: 'bold' }}>بوابة موظفي شركة حرير</h3>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 20px 0' }}>برجاء إدخال البيانات المعتمدة لمباشرة صلاحياتك</p>
            <form onSubmit={handleDashboardLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="اسم المستخدم" 
                value={usernameInput} 
                onChange={e => setUsernameInput(e.target.value)} 
                required 
                style={{ width: '100%', padding: '11px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', textAlign: 'center', boxSizing: 'border-box' }} 
              />
              <input 
                type="password" 
                placeholder="كلمة المرور" 
                value={passwordInput} 
                onChange={e => setPasswordInput(e.target.value)} 
                required 
                style={{ width: '100%', padding: '11px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', textAlign: 'center', boxSizing: 'border-box' }} 
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" style={{ flex: 1, backgroundColor: '#6B1D2F', color: 'white', border: 'none', padding: '11px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>دخول</button>
                <button type="button" onClick={() => { setShowLoginModal(false); setActivePage('catalog'); window.history.pushState({}, document.title, '/'); }} style={{ flex: 1, backgroundColor: '#334155', color: '#94a3b8', border: 'none', padding: '11px', borderRadius: '6px', cursor: 'pointer' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}