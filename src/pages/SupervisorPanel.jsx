import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function SupervisorPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  
  // حالات سحب الخامات وحساب الهالك والفضلات
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [qtyUsed, setQtyUsed] = useState('');     // الاستهلاك الفعلي
  const [qtyWasted, setQtyWasted] = useState('0'); // الهالك
  const [qtyLeftover, setQtyLeftover] = useState('0'); // الفضلة المتبقية
  const [activeOrderId, setActiveOrderId] = useState(null);

  useEffect(() => {
    if (isLoggedIn) {
      fetchSupervisorData();
    }
  }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    const { data, error } = await supabase
      .from('factory_supervisors')
      .select('*')
      .eq('username', username.trim())
      .eq('password', password)
      .maybeSingle();

    if (!error && data) {
      setIsLoggedIn(true);
    } else {
      setLoginError('اسم المستخدم أو الرقم السري للمشرف غير صحيح.');
    }
  };

  const fetchSupervisorData = async () => {
    const { data: oData } = await supabase.from('production_orders').select('*, customers(name), employees(name, role)').not('status', 'eq', 'تم التسليم').order('id', { ascending: false });
    if (oData) setOrders(oData);

    const { data: iData } = await supabase.from('inventory').select('id, name, quantity');
    if (iData) setInventory(iData);
  };

  // 🚀 دالة السحب المتقدمة وحساب الهالك والخصم الفوري من المخزن
  const handleConsumeMaterial = async (e) => {
    e.preventDefault();
    if (!activeOrderId || !selectedMaterial || !qtyUsed) return alert('اختر الطلب والخامة والكمية المستهلكة أولاً');

    const mat = inventory.find(i => i.id === Number(selectedMaterial));
    if (mat) {
      // إجمالي الكمية التي خرجت من الرف = المستهلك الفعلي + الهالك
      const totalOut = Number(qtyUsed) + Number(qtyWasted);

      if (totalOut > mat.quantity) {
        return alert(`❌ الكمية غير كافية بالمخزن! المتاح من [${mat.name}] هو ${mat.quantity} فقط، وأنت تحاول سحب إجمالي (مستهلك + هالك) = ${totalOut}`);
      }

      // 1. تسجيل السحب التفصيلي في قاعدة البيانات
      const { error: insertErr } = await supabase.from('order_consumed_materials').insert([
        { 
          order_id: activeOrderId, 
          material_id: mat.id, 
          quantity_used: Number(qtyUsed),
          quantity_wasted: Number(qtyWasted),
          quantity_leftover: Number(qtyLeftover)
        }
      ]);

      if (insertErr) {
        alert('خطأ أثناء تسجيل سحب المواد: ' + insertErr.message);
        return;
      }

      // 2. تحديث كمية المخزن: نخصم (المستهلك + الهالك) ونعيد إضافة (الفضلات المتبقية للورشة)
      const newQty = mat.quantity - totalOut + Number(qtyLeftover);
      await supabase.from('inventory').update({ quantity: newQty }).eq('id', mat.id);

      alert(`✅ تم الصرف بنجاح!\n🔹 استهلاك: ${qtyUsed}\n🔸 هالك: ${qtyWasted}\n♻️ فضلات مضافة للمخزن: ${qtyLeftover}`);
      
      // تفريغ الحقول وتحديث البيانات
      setQtyUsed('');
      setQtyWasted('0');
      setQtyLeftover('0');
      setSelectedMaterial('');
      fetchSupervisorData();
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    const { error } = await supabase.from('production_orders').update({ status: newStatus }).eq('id', orderId);
    if (!error) {
      alert(`✅ تم تحديث الحالة للطلب وإرسال الرد الفوري للإدارة!`);
      fetchSupervisorData();
    }
  };

  const boxStyle = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', marginBottom: '15px' };
  const smallInputStyle = { width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: 'white', border: '1px solid #334155' };

  if (!isLoggedIn) {
    return (
      <div style={{ backgroundColor: '#020617', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} dir="rtl">
        <form onSubmit={handleLogin} style={{ backgroundColor: '#0f172a', padding: '30px', borderRadius: '12px', border: '1px solid #1e293b', width: '350px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#A04456', margin: 0 }}>شاشة مشرف مصنع حرير</h2>
            <small style={{ color: '#64748b' }}>سجل الدخول لإدارة الخامات وحساب الهالك</small>
          </div>
          {loginError && (
            <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              {loginError}
            </div>
          )}
          <input type="text" placeholder="اسم مستخدم المشرف" value={username} onChange={e => setUsername(e.target.value)} required style={boxStyle} />
          <input type="password" placeholder="الرقم السري" value={password} onChange={e => setPassword(e.target.value)} required style={boxStyle} />
          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#6B1D2F', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>دخول للمصنع 🏭</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '25px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px' }}>
        <div>
          <h1 style={{ color: '#10b981', fontSize: '26px', margin: 0 }}>🏭 لوحة تحكم المشرف الفني ومراقبة الهالك والفضلات</h1>
        </div>
        <button onClick={() => setIsLoggedIn(false)} style={{ backgroundColor: '#ef4444', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer' }}>تسجيل الخروج</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '25px' }}>
        
        {/* لستة أوامر الشغل المفتوحة */}
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#3b82f6' }}>📥 أوامر الشغل الجارية بالمصنع</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {orders.map(order => (
              <div key={order.id} onClick={() => setActiveOrderId(order.id)} style={{ backgroundColor: activeOrderId === order.id ? '#1e293b' : '#141b2d', padding: '15px', borderRadius: '10px', border: activeOrderId === order.id ? '2px solid #10b981' : '1px solid #1e293b', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#f43f5e' }}>العميل: {order.customers?.name}</span>
                  <span style={{ backgroundColor: '#334155', padding: '3px 10px', borderRadius: '4px', fontSize: '13px' }}>المقاس: {order.size_value} {order.size_unit}</span>
                </div>
                <p style={{ margin: '0 0 15px 0', color: '#cbd5e1', fontSize: '14px' }}>📋 المواصفات: {order.item_description}</p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>المسؤول: {order.employees?.name || 'لم يحدد'}</span>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'قيد النحت/النجارة'); }} style={{ backgroundColor: '#f59e0b', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🪓 نجارة</button>
                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'قيد التنجيد'); }} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🧵 تنجيد</button>
                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'جاهز للتسليم'); }} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>✅ جاهز وتسليم</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 📦 نظام الجرد الذكي وحساب الهالك والفضلات */}
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', height: 'fit-content' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#eab308' }}>⚖️ صرف الخامات وضبط الهالك</h3>
          {activeOrderId ? (
            <form onSubmit={handleConsumeMaterial} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>اختر الخامة من المخزن</label>
                <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)} required style={{ ...boxStyle, backgroundColor: '#0f172a', marginTop: '5px', marginBottom: 0 }}>
                  <option value="">-- اختر الخامة --</option>
                  {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (المتاح: {i.quantity})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#10b981' }}>الكمية المستهلكة فعلياً في الشغلانة</label>
                <input type="number" placeholder="مثال: 9 متر" value={qtyUsed} onChange={e => setQtyUsed(e.target.value)} required style={{ ...smallInputStyle, marginTop: '5px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#ef4444' }}>الكمية الهالكة (قصاصات)</label>
                  <input type="number" placeholder="هالك" value={qtyWasted} onChange={e => setQtyWasted(e.target.value)} style={{ ...smallInputStyle, marginTop: '5px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#34d399' }}>الفضلات المتبقية (صالحة)</label>
                  <input type="number" placeholder="فضلة" value={qtyLeftover} onChange={e => setQtyLeftover(e.target.value)} style={{ ...smallInputStyle, marginTop: '5px' }} />
                </div>
              </div>

              <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#eab308', color: 'black', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>
                💾 تثبيت الصرف المطور وتحديث الجرد
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: '14px' }}>
              ◀ الرجاء تحديد أمر الشغل الأخضر أولاً لتفعيل جرد الهالك والفضلات له.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
