import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Inventory({ userRole, userSession }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: '', quantity: '', price: '', selling_price: '' });
  const [editingItem, setEditingItem] = useState(null); 

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory').select('*').order('name', { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  };

  const cleanNumber = (val) => Number(String(val).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))) || 0;

  const handleAddItem = async () => {
    if (!newItem.name) return alert('برجاء كتابة اسم الخامة');
    const { error } = await supabase.from('inventory').insert([{
      name: newItem.name,
      quantity: cleanNumber(newItem.quantity),
      price: cleanNumber(newItem.price),
      selling_price: cleanNumber(newItem.selling_price)
    }]);
    if (!error) {
      setNewItem({ name: '', quantity: '', price: '', selling_price: '' });
      fetchInventory();
    }
  };

  const handleUpdateItem = async () => {
    const { error } = await supabase.from('inventory').update({
      quantity: cleanNumber(editingItem.quantity),
      price: cleanNumber(editingItem.price),
      selling_price: cleanNumber(editingItem.selling_price)
    }).eq('id', editingItem.id);

    if (!error) {
      alert('✅ تم الحفظ!');
      setEditingItem(null);
      fetchInventory();
    } else {
      alert('خطأ: ' + error.message);
    }
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm('حذف نهائي؟')) {
      await supabase.from('inventory').delete().eq('id', id);
      fetchInventory();
    }
  };

  const inputStyle = { padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', width: '150px' };

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      <h1 style={{ color: '#A04456' }}>📦 المخازن المركزية</h1>

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
        <thead><tr style={{ color: '#94a3b8' }}><th>الاسم</th><th>الرصيد</th><th>التكلفة</th><th>البيع</th><th>الربح</th><th>تحكم</th></tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
              <td style={{ padding: '12px' }}>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{item.price}</td>
              <td>{item.selling_price}</td>
              <td style={{ color: '#34d399' }}>{item.selling_price - item.price}</td>
              <td>
                <button onClick={() => setEditingItem(item)} style={{ background: '#1e3a8a', color: 'white', marginRight: '5px' }}>تعديل</button>
                <button onClick={() => handleDeleteItem(item.id)} style={{ background: '#7f1d1d', color: 'white' }}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}