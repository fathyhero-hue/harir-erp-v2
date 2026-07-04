import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ClientPortal() {
  const [customer, setCustomer] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // التقاط الـ id الخاص بالعميل من رابط المتصفح
    const params = new URLSearchParams(window.location.search);
    const custId = params.get('id');

    if (custId) {
      fetchClientData(custId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchClientData = async (id) => {
    // 1. جلب بيانات العميل والأصناف
    const { data: custData, error: custErr } = await supabase.from('customers').select('*').eq('id', id).single();
    if (!custErr && custData) {
      setCustomer(custData);
      
      // 2. جلب جدول الأقساط الخاص به
      const { data: instData } = await supabase.from('customer_installments').select('*').eq('customer_id', id).order('due_date', { ascending: true });
      if (instData) setInstallments(instData);
    }
    setLoading(false);
  };

  const parseCustomerData = (str) => {
    if (!str) return { address: '', items: [] };
    if (str.includes('|||')) {
      const parts = str.split('|||');
      try { return { address: parts[0], items: JSON.parse(parts[1]) }; } catch (e) { return { address: parts[0], items: [] }; }
    }
    return { address: str, items: [] };
  };

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', paddingTop: '100px', fontSize: '20px' }}>⏳ جاري تحميل بيان الحساب المعتمد...</div>;
  }

  if (!customer) {
    return (
      <div style={{ color: 'white', textAlign: 'center', paddingTop: '100px' }} dir="rtl">
        <h2>❌ عذراً، رابط البيان غير صحيح أو انتهت صلاحيته.</h2>
        <p style={{ color: '#94a3b8' }}>يرجى مراجعة إدارة شركة حرير.</p>
      </div>
    );
  }

  const currentData = parseCustomerData(customer.address);

  return (
    <div style={{ padding: '30px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      {/* رأس الصفحة الشيك */}
      <div style={{ textAlign: 'center', borderBottom: '3px solid #6B1D2F', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ color: '#f43f5e', fontSize: '32px', margin: 0, fontWeight: 'bold' }}>بوابة عملاء شركة حـريـر</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '5px 0 0 0' }}>مرحباً بك. بيان الموقف المالي وتفاصيل التعاقد الحية</p>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '25px' }}>
        
        {/* كارت العميل */}
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#f43f5e' }}>👤 بيانات العميل المتفق عليها</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '15px' }}>
            <div><strong>اسم العميل:</strong> {customer.name}</div>
            <div><strong>رقم الهاتف:</strong> {customer.phone}</div>
            <div style={{ gridColumn: '1 / span 2', marginTop: '5px' }}><strong>مكان التسليم والتركيب:</strong> {currentData.address || 'غير محدد'}</div>
          </div>
        </div>

        {/* كارت الملخص المالي */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid #334155' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>إجمالي الحساب الكلي</span>
            <h3 style={{ margin: '5px 0 0 0', color: 'white' }}>{customer.total_amount} ج.م</h3>
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid #334155' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>إجمالي ما تم سداده</span>
            <h3 style={{ margin: '5px 0 0 0', color: '#10b981' }}>{customer.paid_amount} ج.م</h3>
          </div>
          <div style={{ backgroundColor: '#6B1D2F', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#fca5a5' }}>المتبقي في ذمتكم</span>
            <h3 style={{ margin: '5px 0 0 0', color: 'white', fontWeight: 'bold' }}>{customer.total_amount - customer.paid_amount} ج.م</h3>
          </div>
        </div>

        {/* بيان الأصناف والمقايسات */}
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#eab308' }}>📦 تفاصيل الأصناف والمقايسات الفنية للموديل</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '10px', border: '1px solid #334155' }}>الصنف</th>
                <th style={{ padding: '10px', border: '1px solid #334155' }}>المقاس المطلوب</th>
                <th style={{ padding: '10px', border: '1px solid #334155' }}>المواصفات الفنية</th>
              </tr>
            </thead>
            <tbody>
              {currentData.items && currentData.items.length > 0 ? (
                currentData.items.map((item, index) => (
                  <tr key={index}>
                    <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>{item.item_name}</td>
                    <td style={{ padding: '10px', border: '1px solid #334155' }}>{item.item_size}</td>
                    <td style={{ padding: '10px', border: '1px solid #334155', color: '#cbd5e1' }}>{item.item_notes || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="3" style={{ padding: '10px', textAlign: 'center' }}>مقايسة إجمالية موحدة</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* كشف جدول الأقساط */}
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#3b82f6' }}>📅 جدول تواريخ استحقاق الأقساط والدفعات</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '10px', border: '1px solid #334155' }}>رقم القسط</th>
                <th style={{ padding: '10px', border: '1px solid #334155' }}>تاريخ الاستحقاق</th>
                <th style={{ padding: '10px', border: '1px solid #334155' }}>مبلغ الدفعة</th>
                <th style={{ padding: '10px', border: '1px solid #334155' }}>حالة السداد</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((inst, index) => (
                <tr key={inst.id}>
                  <td style={{ padding: '10px', border: '1px solid #334155' }}>دفعة شهرية رقم {index + 1}</td>
                  <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>{new Date(inst.due_date).toLocaleDateString('ar-EG')}</td>
                  <td style={{ padding: '10px', border: '1px solid #334155', fontWeight: 'bold' }}>{inst.amount} ج.م</td>
                  <td style={{ padding: '10px', border: '1px solid #334155', color: inst.status === 'مدفوع' ? '#10b981' : '#f59e0b' }}>
                    {inst.status === 'مدفوع' ? `✅ مدفوع (بتاريخ ${new Date(inst.paid_date).toLocaleDateString('ar-EG')})` : '⏳ قيد الانتظار'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '20px' }}>
          نشكركم لاختياركم شركة حرير للأثاث والمفروشات 🛋️
        </div>

      </div>
    </div>
  );
}