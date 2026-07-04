import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // تم ضبط المسار وفقاً لبنية مشروعك الأصلي بالملي

export default function Financials() {
  // حالة التبويب الداخلي لصفحة الماليات والتقارير
  const [financialSubTab, setFinancialSubTab] = useState('analytics'); // analytics أو ledger

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    vaultCash: 0,
    outsideDebts: 0,
    readyOrders: 0,
    lateInstallments: 0,
    topItems: [],
    topEmployees: []
  });

  // حالات إدارة الحساب الجاري (Ledger)
  const [parties, setParties] = useState([]); 
  const [selectedParty, setSelectedParty] = useState(null);
  const [ledgerTransactions, setLedgerTransactions] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // نموذج المعاملة المالية للحساب الجاري
  const [ledgerForm, setLedgerFormData] = useState({
    party_id: '',
    type: 'credit', // credit = له، debit = عليه
    amount: '',
    job_type: '',
    description: '',
    reference_order_id: ''
  });

  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchComprehensiveAnalytics();
    fetchLedgerParties();
  }, []);

  // 1. كود جلب الإحصائيات الأصلي الخاص بك بالملي دون تعديل أو حذف
  const fetchComprehensiveAnalytics = async () => {
    setLoading(true);
    // حساب كاش الخزنة
    const { data: txData } = await supabase.from('financial_transactions').select('*');
    let cash = 0;
    if (txData) {
      txData.forEach(tx => {
        if (tx.type === 'إيراد') cash += Number(tx.amount);
        else if (tx.type === 'مصروف') cash -= Number(tx.amount);
      });
    }

    // حساب ديون العملاء وتحليل الأصناف
    const { data: custData } = await supabase.from('customers').select('total_amount, paid_amount, address');
    let debts = 0;
    let itemCounts = {};

    if (custData) {
      custData.forEach(c => {
        debts += (Number(c.total_amount) - Number(c.paid_amount));
        if (c.address && c.address.includes('|||')) {
          try {
            const items = JSON.parse(c.address.split('|||')[1]);
            items.forEach(item => {
              if (item.item_name) {
                itemCounts[item.item_name] = (itemCounts[item.item_name] || 0) + 1;
              }
            });
          } catch(e) {}
        }
      });
    }

    const topItemsArray = Object.keys(itemCounts).map(key => ({ name: key, count: itemCounts[key] }))
      .sort((a,b) => b.count - a.count).slice(0, 4);

    // حساب إنتاجية الصنايعية
    const { data: ordersData } = await supabase.from('production_orders').select('*, employees(name)');
    let empCounts = {};
    let readyCount = 0;

    if (ordersData) {
      ordersData.forEach(o => {
        if (o.status === 'جاهز للتسليم' || o.status === 'تم التسليم') {
          const empName = o.employees?.name || 'ورشة الانتظار';
          empCounts[empName] = (empCounts[empName] || 0) + 1;
        }
        if (o.status === 'جاهز للتسليم') readyCount++;
      });
    }

    const topEmployeesArray = Object.keys(empCounts).map(key => ({ name: key, count: empCounts[key] }))
      .sort((a,b) => b.count - a.count).slice(0, 4);

    // عداد الأقساط المتأخرة
    const todayStr = new Date().toISOString().split('T')[0];
    const { count: lateCount } = await supabase.from('customer_installments').select('*', { count: 'exact', head: true }).eq('status', 'غير مدفوع').lt('due_date', todayStr);

    setAnalytics({
      vaultCash: cash,
      outsideDebts: debts,
      readyOrders: readyCount,
      lateInstallments: lateCount || 0,
      topItems: topItemsArray,
      topEmployees: topEmployeesArray
    });

    setLoading(false);
  };

  // 2. كود جلب الصنايعية وعمال التطريز والموردين لدعم ميزة الـ Ledger
  const fetchLedgerParties = async () => {
    try {
      const { data: employeesData } = await supabase.from('employees').select('id, name, role');
      const formattedParties = (employeesData || []).map(emp => ({
        id: emp.id,
        name: emp.name,
        role: emp.role || 'صنايعي قطعية',
        type: 'employee'
      }));
      setParties(formattedParties);
    } catch (error) {
      showNotification('خطأ في جلب بيانات الصنايعية والموظفين', 'error');
    }
  };

  // جلب حركات الحساب الجاري للشخص المختار لايف
  const fetchPartyTransactions = async (party) => {
    setLedgerLoading(true);
    setSelectedParty(party);
    try {
      const { data, error } = await supabase
        .from('ledger_transactions')
        .select('*')
        .eq('party_id', party.id)
        .eq('party_type', party.type)
        .order('created_at', { ascending: true });

      if (!error && data) setLedgerTransactions(data);
    } catch (error) {
      showNotification('خطأ في تحميل كشف الحساب اللحظي', 'error');
    } finally {
      setLedgerLoading(false);
    }
  };

  // حفظ حركة مالية جديدة بالدفتر الجاري
  const handleSaveLedgerTx = async (e) => {
    e.preventDefault();
    if (!ledgerForm.party_id || !ledgerForm.amount) {
      alert('الرجاء اختيار الشخص وتحديد المبلغ بدقة ج.م');
      return;
    }

    const party = parties.find(p => p.id === parseInt(ledgerForm.party_id));
    const sessionUser = localStorage.getItem('harir_user_session'); 
    const currentUsername = sessionUser ? JSON.parse(sessionUser).name : 'كابتن هيرو';

    const creditValue = ledgerForm.type === 'credit' ? parseFloat(ledgerForm.amount) : 0;
    const debitValue = ledgerForm.type === 'debit' ? parseFloat(ledgerForm.amount) : 0;

    const { error } = await supabase
      .from('ledger_transactions')
      .insert([{
        party_type: party.type,
        party_id: party.id,
        party_name: party.name,
        job_type: ledgerForm.job_type || (party.role.includes('تطريز') ? 'أعمال تطريز' : 'أعمال قطعية'),
        credit: creditValue,
        debit: debitValue,
        description: ledgerForm.description,
        reference_order_id: ledgerForm.reference_order_id ? parseInt(ledgerForm.reference_order_id) : null,
        created_by: currentUsername
      }]);

    if (!error) {
      showNotification('تم تسجيل وتوثيق حركة الحساب الجاري بنجاح!', 'success');
      setLedgerFormData({ party_id: ledgerForm.party_id, type: 'credit', amount: '', job_type: '', description: '', reference_order_id: '' });
      if (selectedParty && selectedParty.id === party.id) {
        fetchPartyTransactions(party);
      }
    } else {
      alert('خطأ أثناء الحفظ بقاعدة البيانات: ' + error.message);
    }
  };

  const showNotification = (text, type) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const handlePrintLedger = () => {
    window.print();
  };

  // احتساب مجاميع كشف الحساب الجاري الحالي
  const totalCredit = ledgerTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);
  const totalDebit = ledgerTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const currentBalance = totalCredit - totalDebit;

  const boxCard = { backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' };
  const progressBg = { width: '100%', backgroundColor: '#1e293b', borderRadius: '8px', height: '12px', marginTop: '6px', overflow: 'hidden' };
  const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', marginTop: '5px' };
  const subTabStyle = (active) => ({ padding: '10px 20px', backgroundColor: active ? '#6B1D2F' : '#0f172a', color: 'white', border: '1px solid #1e293b', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' });

  if (loading) return <div style={{ color: 'white', textAlign: 'center', paddingTop: '100px' }}>⏳ جاري تحميل الرسوم البيانية وجرد الإحصائيات...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      
      {/* شريط التحكم بالتبويبات الداخلية لتوزيع المهام الإدارية */}
      <div className="print:hidden" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px' }}>
        <button onClick={() => setFinancialSubTab('analytics')} style={subTabStyle(financialSubTab === 'analytics')}>📊 تقارير الأداء والمؤشرات الرسومية</button>
        <button onClick={() => setFinancialSubTab('ledger')} style={subTabStyle(financialSubTab === 'ledger')}>💰 سجل الحساب الجاري (القطعية والتطريز والموردين)</button>
      </div>

      {/* 📊 الجزء الأول: شاشة التقارير والرسوم البيانية الأصلية للمشروع */}
      {financialSubTab === 'analytics' && (
        <div className="print:hidden">
          <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px' }}>
            <h1 style={{ color: '#A04456', fontSize: '28px', margin: 0, fontWeight: 'bold' }}>📊 لوحة تقارير المدير والتحليلات الرسومية</h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ ...boxCard, borderLeft: '5px solid #10b981' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>كاش الخزنة الحالي</span>
              <h2 style={{ color: '#10b981', margin: '5px 0' }}>{analytics.vaultCash} ج.م</h2>
            </div>
            <div style={{ ...boxCard, borderLeft: '5px solid #ef4444' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>الديون المتبقية برة عند العملاء</span>
              <h2 style={{ color: '#ef4444', margin: '5px 0' }}>{analytics.outsideDebts} ج.م</h2>
            </div>
            <div style={{ ...boxCard, borderLeft: '5px solid #3b82f6' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>شغل جاهز للتسليم بالمصنع</span>
              <h2 style={{ color: '#3b82f6', margin: '5px 0' }}>{analytics.readyOrders} طلبات</h2>
            </div>
            <div style={{ ...boxCard, borderLeft: '5px solid #f59e0b' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>الأقساط المتأخرة المطلوبة</span>
              <h2 style={{ color: '#f59e0b', margin: '5px 0' }}>{analytics.lateInstallments} دَفعة ⚠️</h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
            <div style={boxCard}>
              <h3 style={{ margin: '0 0 15px 0', color: '#f43f5e' }}>🛋️ الأصناف الأكثر سحباً وطلباً من الكتالوج</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {analytics.topItems.map((item, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span>{item.name}</span>
                      <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>{item.count} طلبية</span>
                    </div>
                    <div style={progressBg}>
                      <div style={{ width: `${Math.min(item.count * 20, 100)}%`, backgroundColor: '#f43f5e', height: '100%', borderRadius: '8px' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={boxCard}>
              <h3 style={{ margin: '0 0 15px 0', color: '#10b981' }}>🏆 مؤشر إنتاجية وإنجاز الصنايعية والفنيين</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {analytics.topEmployees.map((emp, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span>{emp.name}</span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>{emp.count} شغلانة خلصت</span>
                    </div>
                    <div style={progressBg}>
                      <div style={{ width: `${Math.min(emp.count * 15, 100)}%`, backgroundColor: '#10b981', height: '100%', borderRadius: '8px' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💰 الجزء الثاني: نظام الحساب الجاري التفاعلي المطور بالملي */}
      {financialSubTab === 'ledger' && (
        <div>
          <div className="flex justify-between items-center mb-6 print:hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h1 style={{ color: '#eab308', fontSize: '26px', margin: 0, fontWeight: 'bold' }}>📊 سجل كشوفات الحساب الجاري والقطعية لايف</h1>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>ضبط مستحقات وسلفيات صنايعية التنجيد، التطريز، والموردين بمرونة بالغة</p>
            </div>
            {selectedParty && (
              <button onClick={handlePrintLedger} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                🖨️ طباعة كشف حساب التصفية الفورية
              </button>
            )}
          </div>

          {msg.text && (
            <div className="print:hidden" style={{ backgroundColor: msg.type === 'success' ? '#064e3b' : '#7f1d1d', color: 'white', padding: '12px', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold' }}>
              {msg.text}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: selectedParty ? '1.1fr 2fr' : '1fr', gap: '25px' }} className="print:block">
            
            {/* القائمة اليمنى والإدخال (تختفي عند الطباعة تلقائياً) */}
            <div className="space-y-6 print:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* قائمة الفئات */}
              <div style={boxCard}>
                <h3 style={{ margin: '0 0 12px 0', color: '#eab308', fontSize: '15px' }}>🎯 لستة الطاقم الفني والموردين</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {parties.map(p => (
                    <button
                      key={p.id}
                      onClick={() => fetchPartyTransactions(p)}
                      style={{ width: '100%', padding: '10px', textAlign: 'right', borderRadius: '6px', border: '1px solid #1e293b', backgroundColor: selectedParty?.id === p.id ? '#6B1D2F' : '#1e293b', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span>{p.name}</span>
                      <small style={{ backgroundColor: '#020617', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#f43f5e' }}>{p.role}</small>
                    </button>
                  ))}
                </div>
              </div>

              {/* إضافة قيد مالي حر */}
              <div style={boxCard}>
                <h3 style={{ margin: '0 0 15px 0', color: '#10b981', fontSize: '15px' }}>➕ تسجيل مستحقات شغل أو صرف سلفة</h3>
                <form onSubmit={handleSaveLedgerTx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8' }}>اختر المستهدف:</label>
                    <select value={ledgerForm.party_id} onChange={e => setLedgerFormData({...ledgerForm, party_id: e.target.value})} required style={inputStyle}>
                      <option value="">-- اختر من الكشف --</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button type="button" onClick={() => setLedgerFormData({...ledgerForm, type: 'credit'})} style={{ padding: '10px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: ledgerForm.type === 'credit' ? '#10b981' : '#334155', color: 'white' }}>له (مستحقات عمل)</button>
                    <button type="button" onClick={() => setLedgerFormData({...ledgerForm, type: 'debit'})} style={{ padding: '10px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: ledgerForm.type === 'debit' ? '#ef4444' : '#334155', color: 'white' }}>عليه (سحب سلفة)</button>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8' }}>المبلغ المالي (ج.م):</label>
                    <input type="number" value={ledgerForm.amount} onChange={e => setLedgerFormData({...ledgerForm, amount: e.target.value})} required style={inputStyle} placeholder="0.00" />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8' }}>بيان العمل (مسمى حر ومخصص):</label>
                    <input type="text" value={ledgerForm.job_type} onChange={e => setLedgerFormData({...ledgerForm, job_type: e.target.value})} style={inputStyle} placeholder="مثال: تطريز مجلس الوجار، تنجيد صالون" />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8' }}>تفاصيل إضافية:</label>
                    <textarea value={ledgerForm.description} onChange={e => setLedgerFormData({...ledgerForm, description: e.target.value})} style={{ ...inputStyle, height: '50px', resize: 'none' }} placeholder="اكتب ملاحظات القطعة أو رقم الدفعة..." />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8' }}>رقم أمر الإنتاج المرتبط (اختياري):</label>
                    <input type="number" value={ledgerForm.reference_order_id} onChange={e => setLedgerFormData({...ledgerForm, reference_order_id: e.target.value})} style={inputStyle} placeholder="رقم أمر الشغل بالسيستم" />
                  </div>

                  <button type="submit" style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginTop: '5px' }}>💾 ترحيل الحركة للدفتر الجاري</button>
                </form>
              </div>
            </div>

            {/* شاشة العرض والطباعة النظيفة الفورية */}
            <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px', border: '1px solid #1e293b' }} className="print:border-none print:bg-transparent print:p-0">
              {selectedParty ? (
                <div>
                  {/* ترويسة الفاتورة المخصصة للتصفية عند الطباعة */}
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #6B1D2F', paddingBottom: '15px', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: '#f43f5e', fontSize: '24px' }}>شركة حرير للأثاث والمفروشات</h2>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0 0' }}>كشف ميزان الحساب الجاري المعتمد لعام 2026</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'right', backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px', marginTop: '15px', fontSize: '14px' }} className="print:bg-white print:text-black print:border print:border-gray-300">
                      <div><strong>الاسم:</strong> {selectedParty.name}</div>
                      <div><strong>الفئة التشغيلية:</strong> {selectedParty.role}</div>
                      <div style={{ marginTop: '5px' }}><strong>تاريخ استخراج الكشف:</strong> {new Date().toLocaleDateString('ar-EG')}</div>
                    </div>
                  </div>

                  {/* بطاقات الإجماليات الثلاثية لايف بالتحديث المباشر */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{ backgroundColor: '#064e3b', padding: '10px', borderRadius: '8px' }} className="print:border">
                      <span style={{ fontSize: '11px', color: '#a7f3d0' }} className="print:text-black">له (إجمالي مستحقاته)</span>
                      <h3 style={{ margin: '4px 0 0 0', fontMonomspace: 'monospace' }}>{totalCredit.toLocaleString()} ج.م</h3>
                    </div>
                    <div style={{ backgroundColor: '#7f1d1d', padding: '10px', borderRadius: '8px' }} className="print:border">
                      <span style={{ fontSize: '11px', color: '#fca5a5' }} className="print:text-black">عليه (إجمالي السُلف)</span>
                      <h3 style={{ margin: '4px 0 0 0', fontMonomspace: 'monospace' }}>{totalDebit.toLocaleString()} ج.م</h3>
                    </div>
                    <div style={{ backgroundColor: currentBalance >= 0 ? '#1e3a8a' : '#78350f', padding: '10px', borderRadius: '8px' }} className="print:border">
                      <span style={{ fontSize: '11px', color: '#bfdbfe' }} className="print:text-black">صافي الرصيد المتبقي</span>
                      <h3 style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>
                        {currentBalance >= 0 ? `له: ${currentBalance.toLocaleString()}` : `عليه: ${Math.abs(currentBalance).toLocaleString()}`} ج.م
                      </h3>
                    </div>
                  </div>

                  {/* جدول تفاصيل العمليات والقيود */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
                        <th style={{ padding: '8px', border: '1px solid #334155' }}>التاريخ</th>
                        <th style={{ padding: '8px', border: '1px solid #334155' }}>البيان / تفاصيل العمل</th>
                        <th style={{ padding: '8px', border: '1px solid #334155', color: '#34d399', textAlign: 'center' }}>له (دائن)</th>
                        <th style={{ padding: '8px', border: '1px solid #334155', color: '#f87171', textAlign: 'center' }}>عليه (مدين)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerLoading ? (
                        <tr><td colSpan="4" style={{ padding: '15px', textAlign: 'center', color: '#94a3b8' }}>جاري سحب القيود الحية...</td></tr>
                      ) : ledgerTransactions.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '15px', textAlign: 'center', color: '#475569' }}>لا توجد حركات مالية مسجلة بحساب هذا الشخص بعد.</td></tr>
                      ) : (
                        ledgerTransactions.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '8px', border: '1px solid #334155', fontSize: '11px', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                            <td style={{ padding: '8px', border: '1px solid #334155' }}>
                              <span style={{ fontWeight: 'bold' }}>{t.job_type}</span>
                              {t.description && <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>{t.description}</p>}
                              {t.reference_order_id && <span style={{ fontSize: '10px', backgroundColor: '#334155', padding: '1px 4px', borderRadius: '30px', marginRight: '6px' }}>أمر رقم #{t.reference_order_id}</span>}
                            </td>
                            <td style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center', color: '#34d399', fontWeight: 'bold' }}>{t.credit > 0 ? `+${t.credit}` : '-'}</td>
                            <td style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center', color: '#f87171', fontWeight: 'bold' }}>{t.debit > 0 ? `-${t.debit}` : '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* ترويسة التوقيع الرسمية المخفية تظهر فقط عند تصدير المستند للطباعة */}
                  <div style={{ display: 'none' }} className="print:grid print:grid-cols-2 print:gap-10 print:mt-12 print:text-center print:text-sm print:font-bold print:text-black">
                    <div>توقيع كابتن هيرو (المدير العام): __________________</div>
                    <div>توقيع المستلم المالي: __________________</div>
                  </div>

                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '100px 0', color: '#475569' }}>
                  <span style={{ fontSize: '40px' }}>📊</span>
                  <h3>الرجاء اختيار اسم صنايعي أو مطرز من القائمة اليمنى</h3>
                  <p style={{ fontSize: '12px' }}>لمعاينة كشف حسابه الجاري التفصيلي، رصيد السُلف، وإصدار مستند التصفية فوراً.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}