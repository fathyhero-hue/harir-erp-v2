import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const emptyLine = { itemId: '', quantity: '1', unitPrice: '', notes: '' };

export default function Sales({ userSession }) {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' أو 'history'
  
  // حالات نقطة البيع
  const [inventory, setInventory] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('كاش');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // حالات حركة البيع
  const [salesHistory, setSalesHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchInventory();
    if (activeTab === 'history') {
      fetchSalesHistory();
    }
  }, [activeTab]);

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, name, quantity, price, selling_price')
      .order('name', { ascending: true });
      
    if (!error && data) {
      setInventory(data);
    }
  };

  const fetchSalesHistory = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('action_type', 'بيع مباشر')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      setSalesHistory(data);
    }
    setLoadingHistory(false);
  };

  const selectedLines = useMemo(() => {
    return lines.map((line) => {
        const item = inventory.find((entry) => entry.id === Number(line.itemId));
        return { 
          ...line, 
          item, 
          quantity: Number(line.quantity) || 0, 
          unitPrice: Number(line.unitPrice) || 0, 
          lineTotal: (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) 
        };
      }).filter((line) => line.item && line.quantity > 0);
  }, [inventory, lines]);

  const totals = useMemo(() => {
    return selectedLines.reduce(
      (sum, line) => ({ amount: sum.amount + line.lineTotal, quantity: sum.quantity + line.quantity }), 
      { amount: 0, quantity: 0 }
    );
  }, [selectedLines]);

  const handleSaveSale = async (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });
    
    if (selectedLines.length === 0) {
      setMessage({ type: 'error', text: 'أضف صنفاً واحداً على الأقل' });
      return;
    }
    
    setSaving(true);
    try {
      // 1. خصم المخزون
      for (const line of selectedLines) {
        await supabase.from('inventory')
          .update({ quantity: Number(line.item.quantity) - line.quantity })
          .eq('id', line.item.id);
      }

      // 2. تسجيل مالي مطابق تماماً لأعمدة الجدول
      const { error: financeError } = await supabase
        .from('financial_transactions')
        .insert([{ 
          type: 'إيراد', 
          amount: totals.amount, 
          description: `بيع مباشر: ${customerName || 'عميل'} | ${paymentMethod}` 
        }]);

      if (financeError) throw new Error("فشل تسجيل الإيراد في الداتابيز: " + financeError.message);

      // 3. توثيق حركة البيع في سجل النشاطات
      const { error: actError } = await supabase.from('activity_logs').insert([{
        user_name: userSession?.name || 'مدير عام',
        role: userSession?.role || 'مدير',
        action_type: 'بيع مباشر',
        details: `إيراد ${totals.amount} ج.م | ${paymentMethod} | الأصناف: ${selectedLines.map(l => l.item.name).join('، ')}`
      }]);
      
      if (actError) {
        console.error("خطأ في تسجيل حركة البيع:", actError);
      }

      setMessage({ type: 'success', text: '✅ تم البيع بنجاح وتسجيل الفلوس في الخزنة!' });
      setLines([{ ...emptyLine }]); 
      setCustomerName(''); 
      fetchInventory();
    } catch (error) {
      console.error("خطأ:", error);
      setMessage({ type: 'error', text: 'خطأ: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { width: '100%', padding: '11px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white' };
  const cardStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '18px' };
  const tabStyle = (active) => ({ 
    padding: '10px 20px', 
    backgroundColor: active ? '#6B1D2F' : '#0f172a', 
    color: 'white', 
    border: '1px solid #1e293b', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    fontWeight: 'bold',
    transition: '0.3s'
  });

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
        <button onClick={() => setActiveTab('pos')} style={tabStyle(activeTab === 'pos')}>🛒 نقطة البيع المباشر</button>
        <button onClick={() => setActiveTab('history')} style={tabStyle(activeTab === 'history')}>📜 سجل وحركة المبيعات</button>
      </div>

      {activeTab === 'pos' && (
        <>
          <h1 style={{ color: '#A04456', marginTop: 0 }}>نقطة البيع</h1>
          {message.text && (
            <div style={{ padding: '15px', marginBottom: '15px', borderRadius: '6px', backgroundColor: message.type === 'success' ? '#064e3b' : '#7f1d1d', border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}` }}>
              {message.text}
            </div>
          )}
          
          <form onSubmit={handleSaveSale} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 15px 0', color: '#f43f5e' }}>أصناف الفاتورة</h3>
              {lines.map((line, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center', backgroundColor: '#111827', padding: '10px', borderRadius: '8px' }}>
                  <select value={line.itemId} onChange={(e) => {
                    const newLines = [...lines];
                    newLines[index].itemId = e.target.value;
                    const item = inventory.find(i => i.id == e.target.value);
                    newLines[index].unitPrice = item ? item.selling_price : '';
                    setLines(newLines);
                  }} style={inputStyle}>
                    <option value="">اختار من المخزون</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (متاح: {i.quantity})</option>)}
                  </select>
                  
                  <input type="number" placeholder="الكمية" min="0.01" step="0.01" value={line.quantity} onChange={(e) => { 
                    const n = [...lines]; 
                    n[index].quantity = e.target.value; 
                    setLines(n); 
                  }} style={inputStyle} />
                  
                  <input type="number" placeholder="سعر البيع" min="0" step="0.01" value={line.unitPrice} onChange={(e) => { 
                    const n = [...lines]; 
                    n[index].unitPrice = e.target.value; 
                    setLines(n); 
                  }} style={inputStyle} />
                  
                  <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))} style={{ backgroundColor: '#7f1d1d', color: '#fecaca', border: 'none', padding: '11px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    حذف
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setLines([...lines, { ...emptyLine }])} style={{ width: '100%', padding: '12px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '5px' }}>
                + إضافة صنف للفاتورة
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 15px 0', color: '#38bdf8' }}>بيانات العميل والدفع</h3>
                <input type="text" placeholder="اسم العميل (اختياري)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{...inputStyle, marginBottom: '15px'}} />
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={inputStyle}>
                  <option value="كاش">طريقة الدفع: كاش</option>
                  <option value="فيزا">طريقة الدفع: فيزا</option>
                  <option value="تحويل">طريقة الدفع: تحويل بنكي</option>
                </select>
              </div>

              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 15px 0', color: '#10b981' }}>ملخص الفاتورة</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#cbd5e1' }}>
                  <span>عدد الأصناف:</span>
                  <strong>{selectedLines.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '15px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '18px', color: '#a7f3d0' }}>إجمالي البيع:</span>
                  <strong style={{ fontSize: '22px', color: '#10b981' }}>{totals.amount.toFixed(2)} ج.م</strong>
                </div>
                
                <button type="submit" disabled={saving} style={{ width: '100%', padding: '15px', backgroundColor: saving ? '#475569' : '#10b981', border: 'none', borderRadius: '8px', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                  {saving ? 'جاري الحفظ...' : 'تأكيد البيع وحفظ الإيراد'}
                </button>
              </div>
            </div>
          </form>
        </>
      )}

      {activeTab === 'history' && (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, color: '#38bdf8', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>آخر 50 عملية بيع مسجلة</h2>
          {loadingHistory ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>⏳ جاري تحميل سجل المبيعات...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px' }}>
              <thead>
                <tr style={{ color: '#94a3b8', backgroundColor: '#1e293b' }}>
                  <th style={{ padding: '12px', borderRadius: '0 6px 6px 0' }}>التاريخ والوقت</th>
                  <th style={{ padding: '12px' }}>المستخدم</th>
                  <th style={{ padding: '12px', borderRadius: '6px 0 0 6px' }}>تفاصيل العملية والمبلغ</th>
                </tr>
              </thead>
              <tbody>
                {salesHistory.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>لا توجد حركات بيع مسجلة حتى الآن</td>
                  </tr>
                ) : (
                  salesHistory.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #1e293b', transition: '0.2s' }}>
                      <td style={{ padding: '15px', color: '#cbd5e1' }} dir="ltr">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                      <td style={{ padding: '15px', color: '#fbbf24', fontWeight: 'bold' }}>{log.user_name}</td>
                      <td style={{ padding: '15px', color: '#a7f3d0' }}>{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}