import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [selectedCust, setSelectedCust] = useState(null);
  
  // لستة الأصناف الديناميكية للمقايسة الحالية
  const [itemsList, setItemsList] = useState([{ item_name: '', item_size: '', item_price: '', item_notes: '' }]);

  const [newCust, setNewCust] = useState({ 
    name: '', phone: '', address: '', 
    paid_amount: '', installment_months: '1', start_date: '' 
  });
  
  const [installmentsLog, setInstallmentsLog] = useState([]);
  const [upcomingInstallments, setUpcomingInstallments] = useState([]);
  const [lateInstallments, setLateInstallments] = useState([]);

  useEffect(() => {
    fetchCustomers();
    fetchAllInstallmentsForAlerts();
  }, []);

  useEffect(() => {
    if (selectedCust) {
      fetchInstallments(selectedCust.id);
    }
  }, [selectedCust]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true });
    if (!error && data) setCustomers(data);
  };

  const fetchInstallments = async (custId) => {
    const { data, error } = await supabase.from('customer_installments').select('*').eq('customer_id', custId).order('due_date', { ascending: true });
    if (!error && data) setInstallmentsLog(data);
  };

  const fetchAllInstallmentsForAlerts = async () => {
    const { data, error } = await supabase.from('customer_installments').select('*, customers(name, phone)').eq('status', 'غير مدفوع');
    if (!error && data) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const upcoming = [];
      const late = [];

      data.forEach(inst => {
        const dueDate = new Date(inst.due_date);
        if (dueDate < today && inst.due_date !== today.toISOString().split('T')[0]) {
          late.push(inst);
        } else if (dueDate.getFullYear() === currentYear && dueDate.getMonth() === currentMonth) {
          upcoming.push(inst);
        }
      });
      setUpcomingInstallments(upcoming);
      setLateInstallments(late);
    }
  };

  const handleAddItemRow = () => {
    setItemsList([...itemsList, { item_name: '', item_size: '', item_price: '', item_notes: '' }]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...itemsList];
    updated[index][field] = value;
    setItemsList(updated);
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    
    const total = itemsList.reduce((sum, item) => sum + Number(item.item_price || 0), 0);
    const paid = Number(newCust.paid_amount);
    const remaining = total - paid;
    const months = Number(newCust.installment_months);
    const instAmount = Math.round(remaining / months);
    const itemsJsonString = JSON.stringify(itemsList);

    const { data: custData, error: custErr } = await supabase.from('customers').insert([
      { 
        name: newCust.name, phone: newCust.phone, 
        total_amount: total, paid_amount: paid,
        address: `${newCust.address || ''} ||| ${itemsJsonString}`
      }
    ]).select();

    if (custErr) return alert('خطأ أثناء تسجيل العميل: ' + custErr.message);

    if (custData && custData[0] && remaining > 0) {
      const custId = custData[0].id;
      const installmentsArray = [];
      const baseDate = newCust.start_date ? new Date(newCust.start_date) : new Date();

      for (let i = 1; i <= months; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + (i - 1));
        installmentsArray.push({
          customer_id: custId,
          amount: instAmount,
          due_date: d.toISOString().split('T')[0],
          status: 'غير مدفوع'
        });
      }
      await supabase.from('customer_installments').insert(installmentsArray);
    }

    alert('تم تسجيل العميل والمقايسة المتعددة وجدولة الأقساط بنجاح! 🎉👥');
    setNewCust({ name: '', phone: '', address: '', paid_amount: '', installment_months: '1', start_date: '' });
    setItemsList([{ item_name: '', item_size: '', item_price: '', item_notes: '' }]);
    fetchCustomers();
    fetchAllInstallmentsForAlerts();
  };

  const handlePayInstallment = async (instId, amount) => {
    const { error: instErr } = await supabase.from('customer_installments').update({ status: 'مدفوع', paid_date: new Date().toISOString().split('T')[0] }).eq('id', instId);
    if (!instErr) {
      const targetCust = selectedCust || customers.find(c => c.id === installmentsLog[0]?.customer_id);
      if (targetCust) {
        const newPaidTotal = Number(targetCust.paid_amount) + Number(amount);
        await supabase.from('customers').update({ paid_amount: newPaidTotal }).eq('id', targetCust.id);
        if (selectedCust) setSelectedCust({ ...selectedCust, paid_amount: newPaidTotal });
      }
      alert('تم تحصيل القسط بنجاح وتحديث حساب العميل! 💰');
      if (selectedCust) fetchInstallments(selectedCust.id);
      fetchCustomers();
      fetchAllInstallmentsForAlerts();
    }
  };

  const handlePrintInvoice = () => {
    const printContent = document.getElementById('pure-invoice-print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = `<div dir="rtl" style="padding:40px; background:white; color:black;">${printContent}</div>`;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); 
  };

  const parseCustomerData = (str) => {
    if (!str) return { address: '', items: [] };
    if (str.includes('|||')) {
      const parts = str.split('|||');
      try {
        return { address: parts[0], items: JSON.parse(parts[1]) };
      } catch (e) {
        return { address: parts[0], items: [] };
      }
    }
    return { address: str, items: [] };
  };

  const currentData = selectedCust ? parseCustomerData(selectedCust.address) : { address: '', items: [] };

  const baseUrl = window.location.origin; 
  const clientViewUrl = selectedCust ? `${baseUrl}/?view=client&id=${selectedCust.id}#/client-portal` : '';
  const qrCodeUrl = selectedCust ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(clientViewUrl)}` : '';

  const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white' };

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      
      {/* 👑 رأس صفحة الإدارة المطور: دمج اسم حرير واللوجو الـ PNG الشفاف الفخم */}
      <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: '#A04456', fontSize: '28px', margin: 0, fontWeight: 'bold' }}>👥 نظام العملاء وإدارة المقايسات المتعددة</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '5px 0 0 0' }}>لوحة تحكم كابتن هيرو المركزية</p>
        </div>
        {/* اللوجو منور فوق على اليسار بصيغة PNG */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: '#0f172a', padding: '10px 20px', borderRadius: '10px', border: '1px solid #1e293b' }}>
          <img src="/logo.png" alt="لوجو حرير" style={{ height: '55px', width: 'auto', display: 'block' }} />
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontWeight: 'bold', color: 'white', fontSize: '16px', display: 'block' }}>حرير | أثاث ومفروشات</span>
            <small style={{ color: '#94a3b8', fontSize: '11px' }}>نظام الإدارة الحسابي المركزي</small>
          </div>
        </div>
      </div>

      {/* شريط التنبيهات والأقساط */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
        <div style={{ backgroundColor: '#1e1b1b', border: '1px solid #7f1d1d', borderRadius: '12px', padding: '15px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#ef4444', fontSize: '15px' }}>⚠️ أقساط متأخرة لم تُحصل ({lateInstallments.length})</h3>
          <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {lateInstallments.map(inst => (
              <div key={inst.id} style={{ backgroundColor: '#2d1a1a', padding: '6px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>{inst.customers?.name} (📅 {new Date(inst.due_date).toLocaleDateString('ar-EG')})</span>
                <span style={{ fontWeight: 'bold', color: '#f87171' }}>{inst.amount} ج.م</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e3a8a', borderRadius: '12px', padding: '15px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#3b82f6', fontSize: '15px' }}>📅 أقساط مطلوبة خلال الشهر الحالي ({upcomingInstallments.length})</h3>
          <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {upcomingInstallments.map(inst => (
              <div key={inst.id} style={{ backgroundColor: '#1e293b', padding: '6px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>{inst.customers?.name} (📅 {new Date(inst.due_date).toLocaleDateString('ar-EG')})</span>
                <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>{inst.amount} ج.م</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '25px' }}>
        
        {/* اليمين: تسجيل العميل ونموذج كتل الأصناف المتعددة */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#f43f5e' }}>■ تسجيل تعاقد ومقايسة جديدة</h3>
            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" placeholder="اسم العميل" value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} required style={inputStyle} />
              <input type="text" placeholder="رقم التليفون" value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} required style={inputStyle} />
              <input type="text" placeholder="العنوان ومكان التركيب" value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} style={inputStyle} />
              
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '10px', marginTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <small style={{ color: '#eab308', fontWeight: 'bold' }}>📋 تفاصيل أصناف التعاقد:</small>
                  <button type="button" onClick={handleAddItemRow} style={{ backgroundColor: '#1e3a8a', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ صنف آخر</button>
                </div>

                {itemsList.map((item, idx) => (
                  <div key={idx} style={{ backgroundColor: '#141b2d', padding: '8px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #1e293b' }}>
                    <input type="text" placeholder={`اسم الصنف ${idx + 1}`} value={item.item_name} onChange={e => handleItemChange(idx, 'item_name', e.target.value)} required style={{ ...inputStyle, padding: '6px', marginBottom: '5px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                      <input type="text" placeholder="المقاس المطلوب" value={item.item_size} onChange={e => handleItemChange(idx, 'item_size', e.target.value)} required style={{ ...inputStyle, padding: '6px' }} />
                      <input type="number" placeholder="السعر (ج.م)" value={item.item_price} onChange={e => handleItemChange(idx, 'item_price', e.target.value)} required style={{ ...inputStyle, padding: '6px' }} />
                    </div>
                    <input type="text" placeholder="مواصفات / ملاحظات التفصيل" value={item.item_notes} onChange={e => handleItemChange(idx, 'item_notes', e.target.value)} style={{ ...inputStyle, padding: '6px', marginTop: '5px' }} />
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                <small style={{ color: '#10b981', fontWeight: 'bold' }}>💰 السداد وجدولة الدفعات:</small>
                <input type="number" placeholder="المقدم المدفوع كاش (ج.م)" value={newCust.paid_amount} onChange={e => setNewCust({...newCust, paid_amount: e.target.value})} required style={{ ...inputStyle, marginTop: '5px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>مدة الأقساط:</label>
                  <select value={newCust.installment_months} onChange={e => setNewCust({...newCust, installment_months: e.target.value})} style={inputStyle}>
                    {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1} شهر</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>تاريخ الدفعة الأولى:</label>
                  <input type="date" value={newCust.start_date} onChange={e => setNewCust({...newCust, start_date: e.target.value})} required style={inputStyle} />
                </div>
              </div>

              <button type="submit" style={{ backgroundColor: '#6B1D2F', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '5px' }}>+ تثبيت التعاقد وجدولة الفاتورة</button>
            </form>
          </div>

          {/* لستة دفتر العملاء */}
          <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '15px' }}>📋 دفتر العملاء ({customers.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {customers.map(cust => (
                <button key={cust.id} onClick={() => setSelectedCust(cust)} style={{ width: '100%', padding: '12px', textAlign: 'right', borderRadius: '6px', border: '1px solid #1e293b', backgroundColor: selectedCust?.id === cust.id ? '#6B1D2F' : '#1e293b', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{cust.name}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>المتبقي: {cust.total_amount - cust.paid_amount} ج.م ◀</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* اليسار: المعاينة الحية وعزل الفاتورة للطباعة */}
        <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          {selectedCust ? (
            <div>
              <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                <button onClick={handlePrintInvoice} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                  🖨️ إصدار وطباعة الفاتورة النظيفة (حفظ كمستند PDF)
                </button>
              </div>

              {/* 🛑 منطقة الفاتورة النقية الحصرية المخصصة للطباعة والعزل التام 🛑 */}
              <div id="pure-invoice-print-area" style={{ backgroundColor: '#141b2d', padding: '20px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                
                {/* ترويسة الفاتورة المطبوعة: دمج اللوجو والاسم في النص بالظبط */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #6B1D2F', paddingBottom: '20px', marginBottom: '25px' }}>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="/logo.png" alt="لوجو حرير الفخم" style={{ height: '65px', width: 'auto' }} />
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#f43f5e' }}>حرير | أثاث ومفروشات</div>
                      <div style={{ fontSize: '14px', color: '#94a3b8' }}>أرقى المجالس العربية، الستائر، الصالونات، ومقايسات الديكور المتكاملة</div>
                    </div>
                  </div>
                  {/* الـ QR Code السحابي لبوابة العميل */}
                  <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '6px', borderRadius: '6px' }}>
                    <img src={qrCodeUrl} alt="حساب العميل QR" style={{ width: '90px', height: '90px', display: 'block' }} />
                    <small style={{ color: 'black', fontSize: '10px', fontWeight: 'bold', display: 'block', marginTop: '3px' }}>امسح لمتابعة الأقساط</small>
                  </div>
                </div>

                {/* كتل البيانات للزبون وعنوانه */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px', fontSize: '15px' }}>
                  <div><strong>اسم العميل المكرم:</strong> {selectedCust.name}</div>
                  <div><strong>رقم الهاتف المعتمد:</strong> {selectedCust.phone}</div>
                  <div style={{ gridColumn: '1 / span 2' }}><strong>مكان التركيب والتسليم:</strong> {currentData.address || 'غير محدد'}</div>
                  <div><strong>تاريخ الطباعة الموثق:</strong> {new Date().toLocaleDateString('ar-EG')}</div>
                </div>

                {/* جدول المقايسات متعددة الأصناف الاحترافي */}
                <h3 style={{ fontSize: '15px', color: '#f43f5e', marginBottom: '10px' }}>■ أولاً: بيان تفاصيل المقايسة الفنية والأصناف الموردة</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e293b' }}>
                      <th style={{ padding: '10px', border: '1px solid #334155' }}>الصنف</th>
                      <th style={{ padding: '10px', border: '1px solid #334155' }}>المقاس</th>
                      <th style={{ padding: '10px', border: '1px solid #334155' }}>السعر</th>
                      <th style={{ padding: '10px', border: '1px solid #334155' }}>المواصفات الفنية وملاحظات التفصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.items && currentData.items.length > 0 ? (
                      currentData.items.map((item, index) => (
                        <tr key={index}>
                          <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>{item.item_name}</td>
                          <td style={{ padding: '10px', border: '1px solid #334155' }}>{item.item_size}</td>
                          <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>{item.item_price} ج.م</td>
                          <td style={{ padding: '10px', border: '1px solid #334155', fontSize: '13px', color: '#cbd5e1' }}>{item.item_notes || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>قيمة مقايسة شاملة</td>
                        <td style={{ padding: '10px', border: '1px solid #334155' }}>-</td>
                        <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>{selectedCust.total_amount} ج.م</td>
                        <td style={{ padding: '10px', border: '1px solid #334155', fontSize: '13px' }}>مقايسة قديمة قبل تحديث السلة المتعددة</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* جدول الميزان الحسابي الكلي للفاتورة */}
                <h3 style={{ fontSize: '15px', color: '#10b981', marginBottom: '10px' }}>■ ثانياً: بيان الموقف المالي الإجمالي وعقد الاتفاق</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e293b' }}>
                      <th style={{ padding: '10px', border: '1px solid #334155' }}>إجمالي قيمة التعاقد</th>
                      <th style={{ padding: '10px', border: '1px solid #334155', color: '#10b981' }}>إجمالي المدفوع (المقدم + الدفعات)</th>
                      <th style={{ padding: '10px', border: '1px solid #334155', color: '#ef4444' }}>المبلغ المتبقي في الذمة للتحصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '12px', border: '1px solid #334155', fontSize: '15px', fontWeight: 'bold' }}>{selectedCust.total_amount} ج.م</td>
                      <td style={{ padding: '12px', border: '1px solid #334155', fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>{selectedCust.paid_amount} ج.م</td>
                      <td style={{ padding: '12px', border: '1px solid #334155', fontSize: '16px', fontWeight: 'bold', color: '#f87171' }}>{selectedCust.total_amount - selectedCust.paid_amount} ج.م</td>
                    </tr>
                  </tbody>
                </table>

                {/* كشف جدول الدفعات والأقساط المتفق عليها بالتواريخ */}
                <h3 style={{ fontSize: '15px', color: '#eab308', marginBottom: '10px' }}>■ ثالثاً: مواعيد استحقاق الدفعات والأقساط المجدولة</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e293b' }}>
                      <th style={{ padding: '8px', border: '1px solid #334155' }}>رقم الدفعة</th>
                      <th style={{ padding: '8px', border: '1px solid #334155' }}>تاريخ الاستحقاق</th>
                      <th style={{ padding: '8px', border: '1px solid #334155' }}>مبلغ القسط</th>
                      <th style={{ padding: '8px', border: '1px solid #334155' }}>حالة السداد والتحصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installmentsLog.map((inst, index) => (
                      <tr key={inst.id}>
                        <td style={{ padding: '10px', border: '1px solid #334155' }}>قسط / دفعة رقم {index + 1}</td>
                        <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>{new Date(inst.due_date).toLocaleDateString('ar-EG')}</td>
                        <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>{inst.amount} ج.م</td>
                        <td style={{ padding: '10px', border: '1px solid #334155', color: inst.status === 'مدفوع' ? '#10b981' : '#f59e0b' }}>
                          {inst.status} {inst.status === 'مدفوع' && `(بتاريخ ${new Date(inst.paid_date).toLocaleDateString('ar-EG')})`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* بنود الشروط والأحكام لعقد الاتفاق الرسمي المستقل */}
                <div style={{ border: '1px solid #334155', padding: '15px', borderRadius: '6px', fontSize: '13px', backgroundColor: '#0f172a', lineHeight: '1.6', marginBottom: '25px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#f43f5e', fontWeight: 'bold' }}>⚖️ بنود عقد اتفاق وتوريد رسمي:</h4>
                  1. يلتزم الطرف الأول (شركة حرير) بتفصيل وتسليم الموديلات والأصناف المتفق عليها بالجدول رقم (1) وبنفس المقاسات والمواصفات المحددة.<br />
                  2. يلتزم الطرف الثاني (العميل) بسداد الدفعات المالية الموضحة بالجدول رقم (3) في مواعيد استحقاقها المحددة دون تأخير.<br />
                  3. البضاعة المباعة لا ترد ولا تستبدل بعد قص الأقمشة وبدء أعمال النجارة والتفصيل في المصنع.
                </div>

                {/* ذيل الفاتورة للتوقيعات الرسمية المعزولة */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <div style={{ textAlign: 'center', minWidth: '180px' }}>
                    <span>توقيع العميل (الطرف الثاني)</span>
                    <br /><br />
                    <span>.......................................</span>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '180px' }}>
                    <span>ختم وتوقيع (إدارة شركة حرير)</span>
                    <br /><br />
                    <span>.......................................</span>
                  </div>
                </div>

              </div> {/* 🛑 نهاية منطقة العزل والطباعة */}

              {/* أزرار التحصيل الفعلية داخل لوحة التحكم للإدارة (مخفية تماماً من الفاتورة) */}
              <div style={{ marginTop: '25px', backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#10b981' }}>💵 شاشة تحصيل الدفعات الحية داخل لوحة التحكم</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {installmentsLog.map((inst, index) => (
                    <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span>دفعة رقم {index + 1} (📅 {new Date(inst.due_date).toLocaleDateString('ar-EG')}) - <strong style={{ color: '#eab308' }}>{inst.amount} ج.م</strong></span>
                      {inst.status === 'غير مدفوع' ? (
                        <button onClick={() => handlePayInstallment(inst.id, inst.amount)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>💵 تسجيل استلام المبلغ</button>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '13px' }}>✅ تم استلامها بنجاح</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '150px 0', color: '#475569' }}>
              <span style={{ fontSize: '50px' }}>🛋️</span>
              <h3>الرجاء اختيار عميل من القائمة اليمنى لعرض وتحصيل وإصدار فواتير المقايسات</h3>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}