import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Financials() {
  const [financialSubTab, setFinancialSubTab] = useState('analytics'); // analytics | ledger | expenses | balance
  const [loading, setLoading] = useState(true);
  
  // 1. التقارير الرسومية
  const [analytics, setAnalytics] = useState({
    vaultCash: 0, outsideDebts: 0, readyOrders: 0, lateInstallments: 0, topItems: [], topEmployees: []
  });

  // 2. الحساب الجاري
  const [parties, setParties] = useState([]); 
  const [selectedParty, setSelectedParty] = useState(null);
  const [ledgerTransactions, setLedgerTransactions] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerForm, setLedgerFormData] = useState({ party_id: '', type: 'credit', amount: '', job_type: '', description: '', reference_order_id: '' });

  // 3. المركز المالي والميزانية العمومية
  const [balanceSheet, setBalanceSheet] = useState({
    vaultCash: 0, totalRevenue: 0, totalExpense: 0, capital: 0, fixedAssets: 0, 
    inventoryValue: 0, customerDebts: 0, 
    contractorLiabilities: 0, contractorAdvances: 0,
    employeeLiabilities: 0, employeeAdvances: 0,
    totalAssets: 0, netWorth: 0, netProfit: 0
  });

  const [capitalForm, setCapitalForm] = useState({ type: 'رأس مال', amount: '', description: '' });
  
  // 4. المصروفات التشغيلية
  const [expensesHistory, setExpensesHistory] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', category: 'عام' });

  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchComprehensiveAnalytics();
    fetchLedgerParties();
    fetchBalanceSheet();
  }, []);

  useEffect(() => {
    if (financialSubTab === 'expenses') {
      fetchExpensesHistory();
    }
  }, [financialSubTab]);

  const fetchComprehensiveAnalytics = async () => {
    setLoading(true);
    const { data: txData } = await supabase.from('financial_transactions').select('*');
    let cash = 0;
    if (txData) {
      txData.forEach(tx => {
        if (tx.type === 'إيراد' || tx.type === 'رأس مال') cash += Number(tx.amount);
        else if (tx.type === 'مصروف' || tx.type === 'أصول ثابتة') cash -= Number(tx.amount);
      });
    }

    const { data: custData } = await supabase.from('customers').select('total_amount, paid_amount, address');
    let debts = 0; let itemCounts = {};
    if (custData) {
      custData.forEach(c => {
        debts += (Number(c.total_amount) - Number(c.paid_amount));
        if (c.address && c.address.includes('|||')) {
          try { JSON.parse(c.address.split('|||')[1]).forEach(item => { if (item.item_name) itemCounts[item.item_name] = (itemCounts[item.item_name] || 0) + 1; }); } catch {}
        }
      });
    }

    const topItemsArray = Object.keys(itemCounts).map(key => ({ name: key, count: itemCounts[key] })).sort((a,b) => b.count - a.count).slice(0, 4);
    
    const { data: ordersData } = await supabase.from('production_orders').select('*, employees(name)');
    let empCounts = {}; let readyCount = 0;
    if (ordersData) {
      ordersData.forEach(o => {
        if (o.status === 'جاهز للتسليم' || o.status === 'تم التسليم') {
          const empName = o.employees?.name || 'ورشة الانتظار';
          empCounts[empName] = (empCounts[empName] || 0) + 1;
        }
        if (o.status === 'جاهز للتسليم') readyCount++;
      });
    }

    const topEmployeesArray = Object.keys(empCounts).map(key => ({ name: key, count: empCounts[key] })).sort((a,b) => b.count - a.count).slice(0, 4);
    const todayStr = new Date().toISOString().split('T')[0];
    const { count: lateCount } = await supabase.from('customer_installments').select('*', { count: 'exact', head: true }).eq('status', 'غير مدفوع').lt('due_date', todayStr);

    setAnalytics({ vaultCash: cash, outsideDebts: debts, readyOrders: readyCount, lateInstallments: lateCount || 0, topItems: topItemsArray, topEmployees: topEmployeesArray });
    setLoading(false);
  };

  const fetchLedgerParties = async () => {
    try {
      const { data } = await supabase.from('employees').select('id, name, role');
      setParties((data || []).map(emp => ({ id: emp.id, name: emp.name, role: emp.role || 'صنايعي قطعية', type: 'employee' })));
    } catch {}
  };

  const fetchPartyTransactions = async (party) => {
    setLedgerLoading(true); setSelectedParty(party);
    const { data } = await supabase.from('ledger_transactions').select('*').eq('party_id', party.id).eq('party_type', party.type).order('created_at', { ascending: true });
    if (data) setLedgerTransactions(data);
    setLedgerLoading(false);
  };

  const handleSaveLedgerTx = async (e) => {
    e.preventDefault();
    if (!ledgerForm.party_id || !ledgerForm.amount) return alert('برجاء استكمال البيانات');
    const party = parties.find(p => p.id === parseInt(ledgerForm.party_id));
    const sessionUser = localStorage.getItem('harir_user_session'); 
    const currentUsername = sessionUser ? JSON.parse(sessionUser).name : 'مدير عام';
    
    const { error } = await supabase.from('ledger_transactions').insert([{
      party_type: party.type, party_id: party.id, party_name: party.name, 
      job_type: ledgerForm.job_type || (party.role.includes('تطريز') ? 'أعمال تطريز' : 'أعمال قطعية'), 
      credit: ledgerForm.type === 'credit' ? parseFloat(ledgerForm.amount) : 0, 
      debit: ledgerForm.type === 'debit' ? parseFloat(ledgerForm.amount) : 0, 
      description: ledgerForm.description, 
      reference_order_id: ledgerForm.reference_order_id ? parseInt(ledgerForm.reference_order_id) : null, 
      created_by: currentUsername
    }]);

    if (!error) {
      showNotification('تم تسجيل الحركة بنجاح!', 'success');
      setLedgerFormData({ party_id: ledgerForm.party_id, type: 'credit', amount: '', job_type: '', description: '', reference_order_id: '' });
      if (selectedParty?.id === party.id) fetchPartyTransactions(party);
      fetchBalanceSheet();
    }
  };

  // --- محرك الحسابات والميزانية ---
  const fetchBalanceSheet = async () => {
    try {
      const { data: txData } = await supabase.from('financial_transactions').select('amount, type');
      let totalRevenue = 0; let totalExpense = 0; let capital = 0; let fixedAssets = 0;
      
      txData?.forEach(tx => {
        if (tx.type === 'إيراد') totalRevenue += Number(tx.amount);
        if (tx.type === 'مصروف') totalExpense += Number(tx.amount);
        if (tx.type === 'رأس مال') capital += Number(tx.amount);
        if (tx.type === 'أصول ثابتة') fixedAssets += Number(tx.amount);
      });
      
      const vaultCash = (totalRevenue + capital) - (totalExpense + fixedAssets);

      const { data: invData } = await supabase.from('inventory').select('quantity, price');
      let inventoryValue = 0;
      invData?.forEach(item => { inventoryValue += (Number(item.quantity || 0) * Number(item.price || 0)); });

      const { data: custData } = await supabase.from('customers').select('total_amount, paid_amount');
      let customerDebts = 0;
      custData?.forEach(c => {
        const debt = Number(c.total_amount || 0) - Number(c.paid_amount || 0);
        if (debt > 0) customerDebts += debt;
      });

      const { data: empData } = await supabase.from('employees').select('id, role');
      const roleMap = {};
      empData?.forEach(emp => { roleMap[emp.id] = emp.role || 'صنايعي'; });

      const { data: ledgerData } = await supabase.from('ledger_transactions').select('party_id, credit, debit');
      const partyBalances = {};
      ledgerData?.forEach(tx => {
        if (!partyBalances[tx.party_id]) partyBalances[tx.party_id] = 0;
        partyBalances[tx.party_id] += (Number(tx.credit || 0) - Number(tx.debit || 0));
      });

      let contractorLiabilities = 0; let contractorAdvances = 0;
      let employeeLiabilities = 0; let employeeAdvances = 0;

      Object.keys(partyBalances).forEach(partyId => {
        const balance = partyBalances[partyId];
        const role = roleMap[partyId] || '';
        const isEmployee = ['مدير', 'موظف', 'مشرف', 'مبيعات', 'مخازن', 'محاسب', 'أمن'].some(r => role.includes(r));

        if (balance > 0) { 
          if (isEmployee) employeeLiabilities += balance;
          else contractorLiabilities += balance;
        } else if (balance < 0) { 
          if (isEmployee) employeeAdvances += Math.abs(balance);
          else contractorAdvances += Math.abs(balance);
        }
      });

      const totalAssets = vaultCash + inventoryValue + customerDebts + contractorAdvances + employeeAdvances + fixedAssets;
      const totalLiabilities = contractorLiabilities + employeeLiabilities;
      const netWorth = totalAssets - totalLiabilities;
      const netProfit = netWorth - capital; 

      setBalanceSheet({
        vaultCash, totalRevenue, totalExpense, capital, fixedAssets, inventoryValue, 
        customerDebts, contractorLiabilities, contractorAdvances, employeeLiabilities, employeeAdvances, 
        totalAssets, netWorth, netProfit
      });
    } catch (error) { console.error("Error calculating balance sheet:", error); }
  };

  const handleSaveCapitalOrAsset = async (e) => {
    e.preventDefault();
    if (!capitalForm.amount) return;
    
    let defaultDesc = capitalForm.type === 'أصول ثابتة' ? 'تأسيس معدات' : 'ضخ سيولة';

    const { error } = await supabase.from('financial_transactions').insert([{
      type: capitalForm.type,
      amount: parseFloat(capitalForm.amount),
      description: `تسجيل ميزانية: ${capitalForm.description || defaultDesc}`
    }]);

    if (!error) {
      showNotification('تم التحديث بنجاح!', 'success');
      setCapitalForm({ type: 'رأس مال', amount: '', description: '' });
      fetchBalanceSheet();
      fetchComprehensiveAnalytics();
    } else { showNotification('خطأ في التسجيل!', 'error'); }
  };

  // --- دوال المصروفات التشغيلية ---
  const fetchExpensesHistory = async () => {
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('type', 'مصروف')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setExpensesHistory(data);
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.description) return alert('اكتب المبلغ وتفاصيل المصروف');

    const { error } = await supabase.from('financial_transactions').insert([{
      type: 'مصروف',
      amount: parseFloat(expenseForm.amount),
      description: `[${expenseForm.category}] ${expenseForm.description}`
    }]);

    if (!error) {
      showNotification('✅ تم خصم المصروف من الخزنة وتسجيله بنجاح!', 'success');
      setExpenseForm({ amount: '', description: '', category: 'عام' });
      fetchExpensesHistory();
      fetchBalanceSheet();
      fetchComprehensiveAnalytics();
    } else {
      showNotification('خطأ أثناء تسجيل المصروف', 'error');
    }
  };

  const showNotification = (text, type) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };
  const handlePrintLedger = () => { window.print(); };

  const totalCredit = ledgerTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);
  const totalDebit = ledgerTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const currentBalance = totalCredit - totalDebit;

  const boxCard = { backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' };
  const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', marginTop: '5px' };
  const subTabStyle = (active) => ({ padding: '10px 15px', backgroundColor: active ? '#6B1D2F' : '#0f172a', color: 'white', border: '1px solid #1e293b', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', transition: '0.3s' });

  if (loading) return <div style={{ color: 'white', textAlign: 'center', paddingTop: '100px' }}>⏳ جاري تحميل الرسوم البيانية وجرد الإحصائيات...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      
      <div className="print:hidden" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <button onClick={() => setFinancialSubTab('analytics')} style={subTabStyle(financialSubTab === 'analytics')}>📊 المؤشرات الرسومية</button>
        <button onClick={() => setFinancialSubTab('ledger')} style={subTabStyle(financialSubTab === 'ledger')}>💰 سجل الحساب الجاري</button>
        <button onClick={() => setFinancialSubTab('expenses')} style={subTabStyle(financialSubTab === 'expenses')}>💸 سجل المصروفات التشغيلية</button>
        <button onClick={() => { setFinancialSubTab('balance'); fetchBalanceSheet(); }} style={subTabStyle(financialSubTab === 'balance')}>🏛️ المركز المالي والميزانية العمومية</button>
      </div>

      {msg.text && (
        <div className="print:hidden" style={{ backgroundColor: msg.type === 'success' ? '#064e3b' : '#7f1d1d', color: 'white', padding: '12px', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold' }}>{msg.text}</div>
      )}

      {/* 💸 التبويب الجديد: سجل المصروفات التشغيلية */}
      {financialSubTab === 'expenses' && (
        <div>
          <div className="print:hidden" style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
            <div style={{ ...boxCard, flex: 1, borderTop: '4px solid #f97316' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#fdba74' }}>➕ تسجيل مصروف تشغيلي جديد</h3>
              <form onSubmit={handleSaveExpense} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '15px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>المبلغ المخصوم (ج.م):</label>
                  <input type="number" required value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} style={inputStyle} placeholder="مثال: 500" />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>تصنيف المصروف:</label>
                  <select value={expenseForm.category} onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})} style={inputStyle}>
                    <option value="عام">نثريات عامة</option>
                    <option value="فواتير">فواتير (كهرباء، مياه، نت)</option>
                    <option value="إيجار">إيجار مكان</option>
                    <option value="بوفيه">بوفيه وضيافة</option>
                    <option value="صيانة">صيانة وأعطال</option>
                    <option value="نقل">مصاريف نقل ومشال</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>البيان والتفاصيل بدقة:</label>
                  <input type="text" required value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} placeholder="مثال: فاتورة كهرباء شهر يوليو، شاي وسكر..." style={inputStyle} />
                </div>
                <button type="submit" style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>خصم وحفظ</button>
              </form>
            </div>
          </div>

          <div style={boxCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#f97316' }}>📋 سجل حركة المصروفات التفصيلي</h3>
              <button onClick={() => window.print()} className="print:hidden" style={{ background: '#334155', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer' }}>🖨️ طباعة السجل</button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '12px' }}>التاريخ والوقت</th>
                  <th style={{ padding: '12px' }}>تفاصيل العملية والبيان</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>المبلغ المخصوم</th>
                </tr>
              </thead>
              <tbody>
                {expensesHistory.length === 0 ? (
                  <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>لا توجد مصروفات مسجلة حتى الآن</td></tr>
                ) : (
                  expensesHistory.map(expense => (
                    <tr key={expense.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px', color: '#cbd5e1' }} dir="ltr">{new Date(expense.created_at).toLocaleString('ar-EG')}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#fdba74' }}>{expense.description}</td>
                      <td style={{ padding: '12px', color: '#ef4444', textAlign: 'center', fontWeight: 'bold' }}>- {expense.amount} ج.م</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🏛️ تبويب المركز المالي والميزانية العمومية الشامل */}
      {financialSubTab === 'balance' && (
        <div>
          <div className="print:hidden" style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
            <div style={{ ...boxCard, flex: 1, borderTop: '4px solid #8b5cf6' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#c4b5fd' }}>⚙️ إعدادات الخزنة (رأس المال، الأصول الثابتة)</h3>
              <form onSubmit={handleSaveCapitalOrAsset} style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>النوع:</label>
                  <select value={capitalForm.type} onChange={(e) => setCapitalForm({...capitalForm, type: e.target.value})} style={inputStyle}>
                    <option value="رأس مال">ضخ رأس مال (يزيد الخزنة ورأس المال)</option>
                    <option value="أصول ثابتة">أصول ومعدات تأسيس (يخصم من الخزنة ويزيد الأصول)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>المبلغ (ج.م):</label>
                  <input type="number" required value={capitalForm.amount} onChange={(e) => setCapitalForm({...capitalForm, amount: e.target.value})} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>البيان / التفاصيل:</label>
                  <input type="text" value={capitalForm.description} onChange={(e) => setCapitalForm({...capitalForm, description: e.target.value})} placeholder="مثال: سيارة، ماكينات..." style={inputStyle} />
                </div>
                <button type="submit" style={{ backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ وإضافة</button>
              </form>
            </div>
          </div>

          <div className="print:hidden" style={{ borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ color: '#38bdf8', fontSize: '28px', margin: 0, fontWeight: 'bold' }}>🏛️ المركز المالي والميزانية لشركة حرير</h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '5px 0 0 0' }}>ميزانية عمومية حية تحسب كل مليم داخل وخارج المشروع</p>
            </div>
            <button onClick={() => window.print()} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ طباعة الميزانية</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div style={{ ...boxCard, borderTop: '5px solid #10b981' }}>
              <h2 style={{ color: '#10b981', margin: '0 0 20px 0', fontSize: '20px' }}>🟢 الأصول والممتلكات (ما تملكه الشركة)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>السيولة النقدية (الخزنة):</span> <strong>{balanceSheet.vaultCash.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>أصول ومعدات الشركة:</span> <strong>{balanceSheet.fixedAssets.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>قيمة بضاعة المخزن (بالتكلفة):</span> <strong>{balanceSheet.inventoryValue.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ديون ومستحقات عند العملاء:</span> <strong>{balanceSheet.customerDebts.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>سلف في ذمة الصنايعية والموردين:</span> <strong>{balanceSheet.contractorAdvances.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>سلف وقروض للموظفين والإدارة:</span> <strong style={{ color: '#6ee7b7' }}>{balanceSheet.employeeAdvances.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '10px', fontSize: '18px', color: '#a7f3d0' }}>
                  <span>إجمالي الأصول والممتلكات:</span> <strong>{balanceSheet.totalAssets.toLocaleString()} ج.م</strong>
                </div>
              </div>
            </div>

            <div style={{ ...boxCard, borderTop: '5px solid #ef4444' }}>
              <h2 style={{ color: '#ef4444', margin: '0 0 20px 0', fontSize: '20px' }}>🔴 الخصوم وحقوق الملكية</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>إجمالي رأس المال المدفوع:</span> <strong style={{ color: '#c4b5fd' }}>{balanceSheet.capital.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>مستحقات للصنايعية والموردين:</span> <strong style={{ color: '#fca5a5' }}>{balanceSheet.contractorLiabilities.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رواتب ومستحقات للموظفين:</span> <strong style={{ color: '#f87171' }}>{balanceSheet.employeeLiabilities.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}><span>إجمالي المصروفات التشغيلية:</span> <strong>{balanceSheet.totalExpense.toLocaleString()} ج.م</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>إجمالي الإيرادات والمبيعات:</span> <strong style={{ color: '#60a5fa' }}>{balanceSheet.totalRevenue.toLocaleString()} ج.م</strong></div>
              </div>
            </div>

            <div style={{ ...boxCard, borderTop: '5px solid #3b82f6', gridColumn: '1 / -1', display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1, textAlign: 'center', backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8' }}>صافي القيمة الحالية للشركة (المركز المالي)</span>
                <p style={{ margin: '5px 0 10px 0', fontSize: '11px', color: '#64748b' }}>(إجمالي الأصول والممتلكات - الالتزامات والديون الخارجية)</p>
                <h1 style={{ fontSize: '38px', margin: '0', color: '#38bdf8' }}>{balanceSheet.netWorth.toLocaleString()} ج.م</h1>
              </div>
              
              <div style={{ flex: 1, textAlign: 'center', backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: `2px solid ${balanceSheet.netProfit >= 0 ? '#10b981' : '#ef4444'}` }}>
                <span style={{ fontSize: '18px', color: balanceSheet.netProfit >= 0 ? '#a7f3d0' : '#fecaca' }}>صافي الأرباح / الخسائر الحقيقية للمشروع</span>
                <p style={{ margin: '5px 0 10px 0', fontSize: '11px', color: '#64748b' }}>(صافي القيمة الحالية للشركة - إجمالي رأس المال المدفوع)</p>
                <h1 style={{ fontSize: '42px', margin: '0', color: balanceSheet.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                  {balanceSheet.netProfit >= 0 ? '+' : ''}{balanceSheet.netProfit.toLocaleString()} ج.م
                </h1>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📊 التبويب الأول */}
      {financialSubTab === 'analytics' && (
         <div className="print:hidden">
         <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px' }}>
           <h1 style={{ color: '#A04456', fontSize: '28px', margin: 0, fontWeight: 'bold' }}>📊 لوحة تقارير المدير والتحليلات الرسومية</h1>
         </div>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
           <div style={{ ...boxCard, borderLeft: '5px solid #10b981' }}>
             <span style={{ color: '#94a3b8', fontSize: '13px' }}>كاش الخزنة الحالي</span>
             <h2 style={{ color: '#10b981', margin: '5px 0' }}>{analytics.vaultCash.toLocaleString()} ج.م</h2>
           </div>
           <div style={{ ...boxCard, borderLeft: '5px solid #ef4444' }}>
             <span style={{ color: '#94a3b8', fontSize: '13px' }}>الديون المتبقية برة عند العملاء</span>
             <h2 style={{ color: '#ef4444', margin: '5px 0' }}>{analytics.outsideDebts.toLocaleString()} ج.م</h2>
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
       </div>
      )}

      {/* 💰 التبويب الثاني */}
      {financialSubTab === 'ledger' && (
        <div>
          <div className="flex justify-between items-center mb-6 print:hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div><h1 style={{ color: '#eab308', fontSize: '26px', margin: 0, fontWeight: 'bold' }}>📊 سجل كشوفات الحساب الجاري والقطعية لايف</h1></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: selectedParty ? '1.1fr 2fr' : '1fr', gap: '25px' }} className="print:block">
            <div className="space-y-6 print:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={boxCard}>
                <h3 style={{ margin: '0 0 12px 0', color: '#eab308', fontSize: '15px' }}>🎯 لستة الطاقم الفني والموردين</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {parties.map(p => (
                    <button key={p.id} onClick={() => fetchPartyTransactions(p)} style={{ width: '100%', padding: '10px', textAlign: 'right', borderRadius: '6px', border: '1px solid #1e293b', backgroundColor: selectedParty?.id === p.id ? '#6B1D2F' : '#1e293b', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{p.name}</span><small style={{ backgroundColor: '#020617', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#f43f5e' }}>{p.role}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div style={boxCard}>
                <h3 style={{ margin: '0 0 15px 0', color: '#10b981', fontSize: '15px' }}>➕ تسجيل مستحقات شغل أو صرف سلفة</h3>
                <form onSubmit={handleSaveLedgerTx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8' }}>اختر المستهدف:</label>
                    <select value={ledgerForm.party_id} onChange={e => setLedgerFormData({...ledgerForm, party_id: e.target.value})} required style={inputStyle}>
                      <option value="">-- اختر من الكشف --</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button type="button" onClick={() => setLedgerFormData({...ledgerForm, type: 'credit'})} style={{ padding: '10px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: ledgerForm.type === 'credit' ? '#10b981' : '#334155', color: 'white' }}>له (مستحقات / راتب)</button>
                    <button type="button" onClick={() => setLedgerFormData({...ledgerForm, type: 'debit'})} style={{ padding: '10px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: ledgerForm.type === 'debit' ? '#ef4444' : '#334155', color: 'white' }}>عليه (سحب سلفة)</button>
                  </div>
                  <input type="number" value={ledgerForm.amount} onChange={e => setLedgerFormData({...ledgerForm, amount: e.target.value})} required style={inputStyle} placeholder="المبلغ المالي (ج.م)" />
                  <input type="text" value={ledgerForm.job_type} onChange={e => setLedgerFormData({...ledgerForm, job_type: e.target.value})} style={inputStyle} placeholder="بيان العمل / الراتب" />
                  <button type="submit" style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>💾 ترحيل الحركة</button>
                </form>
              </div>
            </div>
            
            <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              {selectedParty ? (
                <div>
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #6B1D2F', paddingBottom: '15px', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: '#f43f5e', fontSize: '24px' }}>كشف الحساب الجاري: {selectedParty.name}</h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{ backgroundColor: '#064e3b', padding: '10px', borderRadius: '8px' }}><span style={{ fontSize: '11px', color: '#a7f3d0' }}>له</span><h3 style={{ margin: '4px 0 0 0' }}>{totalCredit.toLocaleString()} ج.م</h3></div>
                    <div style={{ backgroundColor: '#7f1d1d', padding: '10px', borderRadius: '8px' }}><span style={{ fontSize: '11px', color: '#fca5a5' }}>عليه</span><h3 style={{ margin: '4px 0 0 0' }}>{totalDebit.toLocaleString()} ج.م</h3></div>
                    <div style={{ backgroundColor: currentBalance >= 0 ? '#1e3a8a' : '#78350f', padding: '10px', borderRadius: '8px' }}><span style={{ fontSize: '11px', color: '#bfdbfe' }}>صافي الرصيد</span><h3 style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>{currentBalance >= 0 ? `له: ${currentBalance.toLocaleString()}` : `عليه: ${Math.abs(currentBalance).toLocaleString()}`} ج.م</h3></div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
                    <thead><tr style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}><th style={{ padding: '8px', border: '1px solid #334155' }}>التاريخ</th><th style={{ padding: '8px', border: '1px solid #334155' }}>البيان</th><th style={{ padding: '8px', border: '1px solid #334155', color: '#34d399', textAlign: 'center' }}>له</th><th style={{ padding: '8px', border: '1px solid #334155', color: '#f87171', textAlign: 'center' }}>عليه</th></tr></thead>
                    <tbody>
                      {ledgerTransactions.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '8px', border: '1px solid #334155', fontSize: '11px', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                          <td style={{ padding: '8px', border: '1px solid #334155' }}><span style={{ fontWeight: 'bold' }}>{t.job_type}</span></td>
                          <td style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center', color: '#34d399', fontWeight: 'bold' }}>{t.credit > 0 ? `+${t.credit}` : '-'}</td>
                          <td style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center', color: '#f87171', fontWeight: 'bold' }}>{t.debit > 0 ? `-${t.debit}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (<div style={{ textAlign: 'center', padding: '100px 0', color: '#475569' }}><h3>الرجاء اختيار الشخص من القائمة</h3></div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}