import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Factory() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [newOrder, setNewOrder] = useState({ customer_id: '', assigned_employee_id: '', item_description: '', size_value: '', size_unit: 'متر', end_date: '' });

  useEffect(() => {
    fetchOrders();
    fetchInitialData();
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('production_orders').select('*, customers(name), employees(name, role)').order('id', { ascending: false });
    if (!error && data) setOrders(data);
  };

  const fetchInitialData = async () => {
    const { data: custData } = await supabase.from('customers').select('id, name');
    if (custData) setCustomers(custData);
    const { data: empData } = await supabase.from('employees').select('id, name, role');
    if (empData) setEmployees(empData);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.customer_id) return alert('الرجاء اختيار العميل أولاً');

    const { error } = await supabase.from('production_orders').insert([
      {
        customer_id: Number(newOrder.customer_id),
        assigned_employee_id: newOrder.assigned_employee_id ? Number(newOrder.assigned_employee_id) : null,
        item_description: newOrder.item_description,
        size_value: Number(newOrder.size_value),
        size_unit: newOrder.size_unit,
        end_date: newOrder.end_date || null,
        status: 'في الانتظار'
      }
    ]);

    if (!error) {
      alert('🚀 تم إصدار أمر التشغيل للمصنع بنجاح!');
      setNewOrder({ customer_id: '', assigned_employee_id: '', item_description: '', size_value: '', size_unit: 'متر', end_date: '' });
      fetchOrders();
    }
  };

  const readyOrders = orders.filter(o => o.status === 'جاهز للتسليم');

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px' }}>
        <h1 style={{ color: '#A04456', fontSize: '28px', margin: 0, fontWeight: 'bold' }}>🏭 إدارة أوامر الشغل (لوحة المدير)</h1>
      </div>

      {/* 🔔 الإشعارات القادمة من المشرف */}
      {readyOrders.length > 0 && (
        <div style={{ backgroundColor: '#064e3b', border: '2px solid #10b981', padding: '15px', borderRadius: '12px', marginBottom: '25px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#34d399' }}>🎉 تنبيه: طلبات انتهت في المصنع وجاهزة للتسليم للزبون ({readyOrders.length})</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {readyOrders.map(o => (
              <div key={o.id} style={{ backgroundColor: '#022c22', padding: '8px 15px', borderRadius: '6px', fontSize: '13px' }}>
                🟢 العميل: <strong>{o.customers?.name}</strong> | {o.item_description} ({o.size_value} {o.size_unit})
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px' }}>
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f43f5e' }}>■ إطلاق أمر تشغيل وتفصيل جديد</h3>
          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <select value={newOrder.customer_id} onChange={e => setNewOrder({...newOrder, customer_id: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: 'white', border: 'none' }}>
              <option value="">-- اختر العميل --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={newOrder.assigned_employee_id} onChange={e => setNewOrder({...newOrder, assigned_employee_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: 'white', border: 'none' }}>
              <option value="">-- تعيين الصنايعي المسؤول --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <input type="number" placeholder="حجم الشغل / المقاس" value={newOrder.size_value} onChange={e => setNewOrder({...newOrder, size_value: e.target.value})} required style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: 'white', border: 'none' }} />
              <select value={newOrder.size_unit} onChange={e => setNewOrder({...newOrder, size_unit: e.target.value})} style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: 'white', border: 'none' }}>
                <option value="متر">متر</option>
                <option value="قطعة">قطعة</option>
              </select>
            </div>
            <textarea placeholder="المواصفات الفنية للطلب..." value={newOrder.item_description} onChange={e => setNewOrder({...newOrder, item_description: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: 'white', border: 'none', height: '80px', resize: 'none' }} />
            <input type="date" value={newOrder.end_date} onChange={e => setNewOrder({...newOrder, end_date: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: 'white', border: 'none' }} />
            <button type="submit" style={{ backgroundColor: '#6B1D2F', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🛠️ إرسال للمصنع</button>
          </form>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>📋 كشف تتبع خطوط الإنتاج بالمصنع</h3>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '10px', maxHeight: '450px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '14px', textAlign: 'right' }}>
              <thead>
                <tr style={{ color: '#94a3b8' }}>
                  <th>العميل</th><th>الصنايعي</th><th>المقاس</th><th>المواصفات</th><th>الحالة الحالية</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{order.customers?.name}</td>
                    <td style={{ padding: '12px' }}>{order.employees ? order.employees.name : 'انتظار'}</td>
                    <td style={{ padding: '12px', color: '#f59e0b' }}>{order.size_value} {order.size_unit}</td>
                    <td style={{ padding: '12px', fontSize: '12px' }}>{order.item_description}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: order.status === 'جاهز للتسليم' ? '#10b981' : '#3b82f6' }}>{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}