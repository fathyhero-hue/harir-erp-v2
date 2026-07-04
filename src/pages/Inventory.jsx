import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('items'); // 'items' أو 'audit'
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: '', price: '', selling_price: '' });
  const [editingItem, setEditingItem] = useState(null); 

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('name', { ascending: true });
    if (data) setItems(data);
  };

  const cleanNumber = (val) => Number(String(val).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))) || 0;

  const handleAddItem = async () => {
    if (!newItem.name) return alert('برجاء كتابة اسم الخامة');
    const { error } = await supabase.from('inventory').insert([{
      name: newItem.name, quantity: cleanNumber(newItem.quantity), price: cleanNumber(newItem.price), selling_price: cleanNumber(newItem.selling_price)
    }]);
    if (!error) { setNewItem({ name: '', quantity: '', price: '', selling_price: '' }); fetchInventory(); }
  };

  const handleUpdateItem = async () => {
    const { error } = await supabase.from('inventory').update({
      quantity: cleanNumber(editingItem.quantity), price: cleanNumber(editingItem.price), selling_price: cleanNumber(editingItem.selling_price)
    }).eq('id', editingItem.id);
    if (!error) { alert('✅ تم الحفظ!'); setEditingItem(null); fetchInventory(); }
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm('حذف نهائي؟')) {
      await supabase.from('inventory').delete().eq('id', id);
      fetchInventory();
    }
  };

  // حسابات الجرد
  const auditTotals = useMemo(() => {
    let totalCost = 0;
    let expectedRevenue = 0;
    items.forEach(item => {
      totalCost += (item.quantity * item.price);
      expectedRevenue += (item.quantity * item.selling_price);
    });
    return { totalCost, expectedRevenue, expectedProfit: expectedRevenue - totalCost };
  }, [items]);

  const inputStyle = { padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', width: '150px' };
  const tabStyle = (active) => ({ padding: '10px 20px', backgroundColor: active ? '#6B1D2F' : '#0f172a', color: 'white', border: '1px solid #1e293b', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' });

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      
      <div className="print:hidden" style={{ display: 'flex', gap: '15px', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
        <button onClick={() => setActiveTab('items')} style={tabStyle(activeTab === 'items')}>📦 إدارة الأصناف</button>
        <button onClick={() => setActiveTab('audit')} style={tabStyle(activeTab === 'audit')}>📋 تقرير الجرد والقيمة</button>
      </div>

      {activeTab === 'items' && (
        <div className="print:hidden">
          {editingItem ? (
            <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
              <h3>✏️ تعديل: {editingItem.name}</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})} style={inputStyle} />
                <input type="text" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})} style={inputStyle} />
                <input type="text" value={editingItem.selling_price} onChange={e => setEditingItem({...editingItem, selling_price: e.target.value})} style={inputStyle} />
                <button onClick={handleUpdateItem} style={{ background: '#38bdf8', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>حفظ التعديل</button>
                <button onClick={() => setEditingItem(null)} style={{ background: '#475569', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>إلغاء</button>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="الاسم" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} style={inputStyle} />
                <input type="text" placeholder="الكمية" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} style={inputStyle} />
                <input type="text" placeholder="التكلفة" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} style={inputStyle} />
                <input type="text" placeholder="البيع" value={newItem.selling_price} onChange={e => setNewItem({...newItem, selling_price: e.target.value})} style={inputStyle} />
                <button onClick={handleAddItem} style={{ background: '#10b981', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>+ إضافة</button>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead><tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}><th style={{padding:'10px'}}>الاسم</th><th>الرصيد</th><th>التكلفة</th><th>البيع</th><th>الربح</th><th>تحكم</th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px' }}>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.price}</td>
                  <td>{item.selling_price}</td>
                  <td style={{ color: '#34d399' }}>{item.selling_price - item.price}</td>
                  <td>
                    <button onClick={() => setEditingItem(item)} style={{ background: '#1e3a8a', color: 'white', marginRight: '5px', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>تعديل</button>
                    <button onClick={() => handleDeleteItem(item.id)} style={{ background: '#7f1d1d', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px' }} className="print:bg-white print:text-black">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#f43f5e' }} className="print:text-black">ورقة الجرد المركزي للمخازن</h2>
              <p style={{ margin: '5px 0 0 0', color: '#94a3b8' }} className="print:text-gray-600">تاريخ استخراج الجرد: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            <button onClick={() => window.print()} className="print:hidden" style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ طباعة ورقة الجرد
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }} className="print:border">
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>إجمالي التكلفة بالمخزن</span>
              <h3 style={{ margin: '5px 0 0 0', color: '#fbbf24' }}>{auditTotals.totalCost.toLocaleString()} ج.م</h3>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }} className="print:border">
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>القيمة البيعية المتوقعة</span>
              <h3 style={{ margin: '5px 0 0 0', color: '#38bdf8' }}>{auditTotals.expectedRevenue.toLocaleString()} ج.م</h3>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }} className="print:border">
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>إجمالي الربح المتوقع</span>
              <h3 style={{ margin: '5px 0 0 0', color: '#10b981' }}>{auditTotals.expectedProfit.toLocaleString()} ج.م</h3>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px' }} className="print:border">
            <thead>
              <tr style={{ backgroundColor: '#1e293b', color: '#cbd5e1' }} className="print:bg-gray-200 print:text-black">
                <th style={{ padding: '10px', border: '1px solid #334155' }}>م</th>
                <th style={{ padding: '10px', border: '1px solid #334155' }}>اسم الصنف</th>
                <th style={{ padding: '10px', border: '1px solid #334155', textAlign: 'center' }}>الرصيد الدفتري</th>
                <th style={{ padding: '10px', border: '1px solid #334155', textAlign: 'center' }}>الجرد الفعلي (للكتابة)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td style={{ padding: '8px', border: '1px solid #334155' }}>{index + 1}</td>
                  <td style={{ padding: '8px', border: '1px solid #334155' }}>{item.name}</td>
                  <td style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                  <td style={{ padding: '8px', border: '1px solid #334155' }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}