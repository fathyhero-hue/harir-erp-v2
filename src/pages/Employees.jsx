import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Employees({ userRole, userSession }) {
  const [viewMode, setViewMode] = useState('list'); // 'list' أو 'profile'
  const [activeWorker, setActiveWorker] = useState(null); 

  const [workers, setWorkers] = useState([]); 
  const [users, setUsers] = useState([]);     
  const [loading, setLoading] = useState(true);

  // حالات خاصة بملف العامل (Profile)
  const [workerAttLogs, setWorkerAttLogs] = useState([]);
  const [workerFinLogs, setWorkerFinLogs] = useState([]);
  const [totalDeductions, setTotalDeductions] = useState(0); // كارت إجمالي الخصومات الجزائية الجديد
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]); 
  
  // نماذج الإدخال المحدثة
  const [newWorker, setNewWorker] = useState({ name: '', role: '', daily_rate: '', salary_type: 'daily', phone: '', hire_date: new Date().toISOString().split('T')[0] }); 
  const [workerAction, setWorkerAction] = useState({ type: 'سحب سلفة', amount: '', notes: '' });
  const [attendanceForm, setAttendanceForm] = useState({ status: 'حضور', reason: '', deduction: '0' });
  const [newUser, setNewUser] = useState({ real_name: '', username: '', password: '', role: 'حسابات' });
  const [editingWorker, setEditingWorker] = useState(null);

  useEffect(() => {
    fetchMainData();
  }, []);

  const fetchMainData = async () => {
    setLoading(true);
    try {
      const { data: wData } = await supabase.from('employees').select('*').order('name', { ascending: true });
      if (wData) setWorkers(wData);

      const { data: uData } = await supabase.from('dashboard_users').select('*').order('id', { ascending: false });
      if (uData) setUsers(uData);
    } catch (err) {}
    setLoading(false);
  };

  const openWorkerProfile = async (worker) => {
    setActiveWorker(worker);
    setViewMode('profile');
    fetchWorkerHistory(worker.id, worker.name);
  };

  const fetchWorkerHistory = async (workerId, workerName) => {
    // 1. جلب سجل الحضور والغياب
    const { data: attData } = await supabase.from('employee_attendance_logs').select('*').eq('worker_id', workerId).order('record_date', { ascending: false });
    if (attData) setWorkerAttLogs(attData);

    // 2. جلب الحركات المالية من جدول الرقابة العام
    const { data: finData } = await supabase.from('activity_logs').select('*').eq('action_type', 'حسابات عمال').like('details', `%${workerName}%`).order('created_at', { ascending: false });
    
    let deductionSum = 0;
    if (finData) {
      const formattedFinLogs = finData.map(log => {
        const amtMatch = log.details.match(/\d+/);
        const amountVal = amtMatch ? parseInt(amtMatch[0]) : 0;
        let currentType = 'إضافة يومية/مكافأة';
        
        if (log.details.includes('سحب سلفة')) currentType = 'سحب سلفة';
        if (log.details.includes('خصم جزائي')) {
          currentType = 'خصم جزائي';
          deductionSum += amountVal; // حساب مجموع الخصومات الجزائية لايف
        }

        return {
          id: log.id,
          created_at: log.created_at,
          type: currentType,
          amount: amountVal + ' ج.م',
          notes: log.details
        };
      });
      setWorkerFinLogs(formattedFinLogs);
      setTotalDeductions(deductionSum); // تحديث كارت الخصومات
    }
    
    const { data: wData } = await supabase.from('employees').select('*').eq('id', workerId).single();
    if (wData) setActiveWorker(wData);
  };

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    if (!newWorker.name || !newWorker.role || !newWorker.daily_rate) return alert('برجاء ملء كافة الحقول الأساسية');

    const { error } = await supabase.from('employees').insert([{
      name: newWorker.name, role: newWorker.role, daily_rate: Number(newWorker.daily_rate),
      salary_type: newWorker.salary_type, phone: newWorker.phone, hire_date: newWorker.hire_date,
      total_withdrawals: 0, current_salary: 0, total_leaves: 0, late_days: 0, is_active: true
    }]);

    if (!error) {
      alert('✅ تم تسجيل الصنايعي بنجاح!');
      setNewWorker({ name: '', role: '', daily_rate: '', salary_type: 'daily', phone: '', hire_date: new Date().toISOString().split('T')[0] });
      fetchMainData();
    }
  };

  const handleUpdateWorker = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('employees').update({
      name: editingWorker.name, role: editingWorker.role, daily_rate: Number(editingWorker.daily_rate), salary_type: editingWorker.salary_type, phone: editingWorker.phone, hire_date: editingWorker.hire_date
    }).eq('id', editingWorker.id);

    if (!error) {
      alert('✅ تم تحديث بيانات الصنايعي بنجاح!');
      setEditingWorker(null);
      fetchMainData();
    }
  };

  const toggleWorkerStatus = async (worker) => {
    const nextStatus = !worker.is_active;
    const msg = nextStatus ? `هل تريد إعادة تفعيل ${worker.name}؟` : `هل تريد إيقاف حساب ${worker.name}؟`;
    if (window.confirm(msg)) {
      await supabase.from('employees').update({ is_active: nextStatus }).eq('id', worker.id);
      fetchMainData();
    }
  };

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    const adminName = userSession?.name || 'المدير العام';
    const deductAmt = Number(attendanceForm.deduction || 0);
    
    let newSalary = Number(activeWorker.current_salary || 0);
    let updatedLeaves = Number(activeWorker.total_leaves || 0);
    let updatedLate = Number(activeWorker.late_days || 0);

    if (attendanceForm.status === 'حضور') {
      if (activeWorker.salary_type === 'daily') newSalary += Number(activeWorker.daily_rate || 0);
      newSalary -= deductAmt;
    } else if (attendanceForm.status === 'غياب بدون إذن' || attendanceForm.status === 'إجازة رسمية') {
      updatedLeaves += 1;
      newSalary -= deductAmt;
    } else if (attendanceForm.status === 'تأخير') {
      updatedLate += 1;
      newSalary -= deductAmt;
    }

    await supabase.from('employees').update({ current_salary: newSalary, total_leaves: updatedLeaves, late_days: updatedLate }).eq('id', activeWorker.id);
    
    await supabase.from('employee_attendance_logs').insert([{ 
      worker_id: activeWorker.id, worker_name: activeWorker.name, 
      status: attendanceForm.status, reason: attendanceForm.reason || 'تم التسجيل', 
      deduction: deductAmt, record_date: attDate, created_by: adminName 
    }]);

    alert(`✅ تم إثبات حالة [${attendanceForm.status}] لتاريخ ${attDate}!`);
    setAttendanceForm({ status: 'حضور', reason: '', deduction: '0' });
    fetchWorkerHistory(activeWorker.id, activeWorker.name);
    fetchMainData();
  };

  const handleWorkerFinance = async (e) => {
    e.preventDefault();
    if (!workerAction.amount) return alert('أدخل المبلغ المالي أولاً!');
    
    const amt = Number(workerAction.amount);
    const adminName = userSession?.name || 'المدير العام';

    let updatedWithdrawals = Number(activeWorker.total_withdrawals || 0);
    let updatedSalary = Number(activeWorker.current_salary || 0);

    if (workerAction.type === 'سحب سلفة') {
      updatedWithdrawals += amt;
      updatedSalary -= amt; 
    } else if (workerAction.type === 'خصم جزائي') {
      updatedSalary -= amt;
    } else {
      updatedSalary += amt;
    }

    await supabase.from('employees').update({ total_withdrawals: updatedWithdrawals, current_salary: updatedSalary }).eq('id', activeWorker.id);
    
    await supabase.from('activity_logs').insert([
      { 
        user_name: adminName, role: userRole || 'مدير عام', action_type: 'حسابات عمال', 
        details: `سجل حركة مادية [${workerAction.type}] للصنايعي: ${activeWorker.name} بمبلغ قدره ${amt} ج.م | ملاحظات: ${workerAction.notes || 'لا يوجد'}` 
      }
    ]);

    alert(`✅ تم قيد [${workerAction.type}] بنجاح!`);
    setWorkerAction({ type: 'سحب سلفة', amount: '', notes: '' });
    fetchWorkerHistory(activeWorker.id, activeWorker.name);
    fetchMainData();
  };

  const handleDeleteFinTx = async (tx) => {
    if (window.confirm(`هل أنت متأكد من حذف وإلغاء هذه الحركة الموثقة من السجل؟`)) {
      await supabase.from('activity_logs').delete().eq('id', tx.id);

      let updatedWithdrawals = Number(activeWorker.total_withdrawals || 0);
      let updatedSalary = Number(activeWorker.current_salary || 0);

      const rawAmount = parseInt(tx.amount);
      if (tx.type === 'سحب سلفة') {
        updatedWithdrawals -= rawAmount;
        updatedSalary += rawAmount;
      } else if (tx.type === 'خصم جزائي') {
        updatedSalary += rawAmount;
      } else {
        updatedSalary -= rawAmount;
      }

      await supabase.from('employees').update({ total_withdrawals: updatedWithdrawals, current_salary: updatedSalary }).eq('id', activeWorker.id);
      
      alert('🗑️ تم التراجع عن الحركة المالية وحذفها بنجاح!');
      fetchWorkerHistory(activeWorker.id, activeWorker.name);
      fetchMainData();
    }
  };

  const handleDeleteAttTx = async (att) => {
    if (window.confirm(`هل أنت متأكد من حذف قيد الحضور لتاريخ ${att.record_date}؟`)) {
      await supabase.from('employee_attendance_logs').delete().eq('id', att.id);

      let newSalary = Number(activeWorker.current_salary || 0);
      let updatedLeaves = Number(activeWorker.total_leaves || 0);
      let updatedLate = Number(activeWorker.late_days || 0);

      if (att.status === 'حضور') {
        if (activeWorker.salary_type === 'daily') newSalary -= Number(activeWorker.daily_rate || 0);
        newSalary += Number(att.deduction || 0);
      } else if (att.status === 'غياب بدون إذن' || att.status === 'إجازة رسمية') {
        updatedLeaves -= 1;
        newSalary += Number(att.deduction || 0);
      } else if (att.status === 'تأخير') {
        updatedLate -= 1;
        newSalary += Number(att.deduction || 0);
      }

      await supabase.from('employees').update({ current_salary: newSalary, total_leaves: updatedLeaves, late_days: updatedLate }).eq('id', activeWorker.id);
      
      alert('🗑️ تم مسح حركة الحضور من الداتابيز بنجاح!');
      fetchWorkerHistory(activeWorker.id, activeWorker.name);
      fetchMainData();
    }
  };

  const activeWorkers = workers.filter(w => w.is_active !== false);
  const inputStyle = { width: '100%', padding: '11px', boxSizing: 'border-box', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', fontSize: '14px' };

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      
      {viewMode === 'profile' && activeWorker ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* رأس الملف الشخصي لعامل شركة حرير */}
          <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: '0 0 5px 0', color: '#10b981', fontSize: '24px' }}>👤 ملف العامل: {activeWorker.name}</h2>
              <div style={{ display: 'flex', gap: '15px', color: '#94a3b8', fontSize: '14px', flexWrap: 'wrap' }}>
                <span>الوظيفة: <strong style={{ color: 'white' }}>{activeWorker.role}</strong></span>
                <span>نوع الراتب: <strong style={{ color: 'white' }}>{activeWorker.salary_type === 'daily' ? 'يومية' : 'شهري ثابت'}</strong></span>
                <span>الفئة/الأجر: <strong style={{ color: '#eab308' }}>{activeWorker.daily_rate} ج.م</strong></span>
                <span>رقم التليفون: <strong style={{ color: '#38bdf8' }}>{activeWorker.phone || 'غير مسجل'}</strong></span>
                <span>بداية العمل: <strong style={{ color: '#a7f3d0' }}>{activeWorker.hire_date ? new Date(activeWorker.hire_date).toLocaleDateString('ar-EG') : 'غير محدد'}</strong></span>
              </div>
            </div>
            <button type="button" onClick={() => setViewMode('list')} style={{ backgroundColor: '#334155', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              🔙 عودة لقائمة العمال
            </button>
          </div>

          {/* 📊 كروت الإحصائيات الخماسية الفاخرة بعد إضافة كارت الخصومات باللون المخصص */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#064e3b', padding: '15px', borderRadius: '8px', border: '1px solid #10b981' }}>
              <div style={{ fontSize: '12px', color: '#a7f3d0' }}>صافي الراتب المستحق</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{activeWorker.current_salary} ج.م</div>
            </div>
            <div style={{ backgroundColor: '#7f1d1d', padding: '15px', borderRadius: '8px', border: '1px solid #ef4444' }}>
              <div style={{ fontSize: '12px', color: '#fca5a5' }}>إجمالي سحوبات السلف</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{activeWorker.total_withdrawals} ج.م</div>
            </div>
            {/* ⚠️ كارت إجمالي الخصومات والجزاءات الجديد بالملي */}
            <div style={{ backgroundColor: '#4c0519', padding: '15px', borderRadius: '8px', border: '1px solid #9f1239' }}>
              <div style={{ fontSize: '12px', color: '#fda4af' }}>إجمالي الخصومات والجزاءات</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f43f5e' }}>{totalDeductions} ج.م</div>
            </div>
            <div style={{ backgroundColor: '#78350f', padding: '15px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <div style={{ fontSize: '12px', color: '#fde68a' }}>إجمالي غياب/إجازات</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{activeWorker.total_leaves} يوم</div>
            </div>
            <div style={{ backgroundColor: '#1e3a8a', padding: '15px', borderRadius: '8px', border: '1px solid #3b82f6' }}>
              <div style={{ fontSize: '12px', color: '#bfdbfe' }}>مرات التأخير المسجلة</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{activeWorker.late_days} مرة</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* تسجيل حضور/غياب يوم مخصص */}
            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#3b82f6', fontSize: '16px' }}>📅 تسجيل حضور/غياب يوم مخصص</h3>
              <form onSubmit={handleAttendanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} required style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <select value={attendanceForm.status} onChange={e => setAttendanceForm({...attendanceForm, status: e.target.value})} style={inputStyle}>
                    <option value="حضور">✓ إثبات حضور</option>
                    <option value="إجازة رسمية">🌴 إجازة رسمية / بعذر</option>
                    <option value="غياب بدون إذن">❌ غياب بدون إذن</option>
                    <option value="تأخير">⏳ تسجيل تأخير</option>
                  </select>
                  <input type="number" placeholder="قيمة الخصم (ج.م)" value={attendanceForm.deduction} onChange={e => setAttendanceForm({...attendanceForm, deduction: e.target.value})} style={inputStyle} />
                </div>
                <input type="text" placeholder="اكتب العذر أو الملاحظات..." value={attendanceForm.reason} onChange={e => setAttendanceForm({...attendanceForm, reason: e.target.value})} style={inputStyle} />
                <button type="submit" style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>💾 إثبات الحركة لليوم المحدد</button>
              </form>
            </div>

            {/* سحب سلفة أو خصم جزائي */}
            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#eab308', fontSize: '16px' }}>💸 صرف سلفة نقدية / مكافآت أو خصومات</h3>
              <form onSubmit={handleWorkerFinance} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <select value={workerAction.type} onChange={e => setWorkerAction({...workerAction, type: e.target.value})} style={inputStyle}>
                  <option value="سحب سلفة">💸 سحب سلفة (تخصم من الراتب)</option>
                  <option value="خصم جزائي">⚠️ تسجيل خصم جزائي (سوء مصنعية / إتلاف خامات)</option>
                  <option value="إضافة يومية/مكافأة">➕ مكافأة أو حافز (تضاف للراتب)</option>
                </select>
                <input type="number" placeholder="المبلغ (ج.م)" value={workerAction.amount} onChange={e => setWorkerAction({...workerAction, amount: e.target.value})} required style={inputStyle} />
                <input type="text" placeholder="ملاحظات الصرف والخصم..." value={workerAction.notes} onChange={e => setWorkerAction({...workerAction, notes: e.target.value})} style={inputStyle} />
                <button type="submit" style={{ backgroundColor: '#eab308', color: 'black', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '27px' }}>💾 تنفيذ الحركة بالملف</button>
              </form>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#10b981' }}>📅 سجل الحضور والغياب التاريخي للعامل</h4>
              <table style={{ width: '100%', fontSize: '13px', textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
                    <th style={{ padding: '8px', border: '1px solid #334155' }}>التاريخ المخصص</th>
                    <th style={{ padding: '8px', border: '1px solid #334155' }}>الحالة</th>
                    <th style={{ padding: '8px', border: '1px solid #334155' }}>السبب / العذر</th>
                    <th style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center' }}>تراجع</th>
                  </tr>
                </thead>
                <tbody>
                  {workerAttLogs.map(att => (
                    <tr key={att.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '8px', border: '1px solid #334155', fontWeight: 'bold' }}>{att.record_date}</td>
                      <td style={{ padding: '8px', border: '1px solid #334155', color: att.status === 'حضور' ? '#34d399' : '#f87171' }}>{att.status}</td>
                      <td style={{ padding: '8px', border: '1px solid #334155' }}>{att.reason}</td>
                      <td style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center' }}>
                        <button type="button" onClick={() => handleDeleteAttTx(att)} style={{ backgroundColor: '#7f1d1d', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#f59e0b' }}>💸 سجل السُلف والمكافآت والخصومات الجزائية لايف</h4>
              <table style={{ width: '100%', fontSize: '13px', textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
                    <th style={{ padding: '8px', border: '1px solid #334155' }}>التاريخ</th>
                    <th style={{ padding: '8px', border: '1px solid #334155' }}>البيان والمبلغ</th>
                    <th style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center' }}>تراجع</th>
                  </tr>
                </thead>
                <tbody>
                  {workerFinLogs.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '8px', border: '1px solid #334155', fontSize: '11px' }}>{new Date(tx.created_at).toLocaleDateString('ar-EG')}</td>
                      <td style={{ padding: '8px', border: '1px solid #334155', fontWeight: 'bold', color: tx.type === 'خصم جزائي' ? '#ef4444' : 'white' }}>{tx.type}: {tx.amount}</td>
                      <td style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center' }}>
                        <button type="button" onClick={() => handleDeleteFinTx(tx)} style={{ backgroundColor: '#7f1d1d', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#f43f5e', fontSize: '16px' }}>{editingWorker ? '✏️ تعديل بيانات صنايعي' : '➕ إضافة صنايعي جديد ببيانات كاملة'}</h3>
            <form onSubmit={editingWorker ? handleUpdateWorker : handleCreateWorker} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="اسم الصنايعي الكامل" value={editingWorker ? editingWorker.name : newWorker.name} onChange={e => editingWorker ? setEditingWorker({...editingWorker, name: e.target.value}) : setNewWorker({...newWorker, name: e.target.value})} required style={{ ...inputStyle, flex: 1 }} />
              <input type="text" placeholder="الوظيفة (منجد، مطرز...)" value={editingWorker ? editingWorker.role : newWorker.role} onChange={e => editingWorker ? setEditingWorker({...editingWorker, role: e.target.value}) : setNewWorker({...newWorker, role: e.target.value})} required style={inputStyle} />
              <input type="text" placeholder="رقم التليفون" value={editingWorker ? editingWorker.phone : newWorker.phone} onChange={e => editingWorker ? setEditingWorker({...editingWorker, phone: e.target.value}) : setNewWorker({...newWorker, phone: e.target.value})} style={{ ...inputStyle, width: '150px' }} />
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8', minWidth: '70px' }}>بداية العمل:</label>
                <input type="date" value={editingWorker ? editingWorker.hire_date : newWorker.hire_date} onChange={e => editingWorker ? setEditingWorker({...editingWorker, hire_date: e.target.value}) : setNewWorker({...newWorker, hire_date: e.target.value})} required style={{ ...inputStyle, width: '140px' }} />
              </div>
              <input type="number" placeholder="الأجر / الفئة" value={editingWorker ? editingWorker.daily_rate : newWorker.daily_rate} onChange={e => editingWorker ? setEditingWorker({...editingWorker, daily_rate: e.target.value}) : setNewWorker({...newWorker, daily_rate: e.target.value})} required style={{ ...inputStyle, width: '110px' }} />
              <select value={editingWorker ? editingWorker.salary_type : newWorker.salary_type} onChange={e => editingWorker ? setEditingWorker({...editingWorker, salary_type: e.target.value}) : setNewWorker({...newWorker, salary_type: e.target.value})} style={{ ...inputStyle, width: '100px' }}>
                <option value="daily">يومية</option>
                <option value="monthly">شهري</option>
              </select>
              <button type="submit" style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{editingWorker ? '💾 حفظ التعديل' : '+ تسجيل بالورشة'}</button>
              {editingWorker && <button type="button" onClick={() => setEditingWorker(null)} style={{ backgroundColor: '#334155', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>إلغاء</button>}
            </form>
          </div>

          <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#cbd5e1' }}>📋 دفتر عمال ورشة شركة حرير المعتمدين</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
                    <th>الاسم</th><th>الوظيفة</th><th>رقم الهاتف</th><th>نوع الراتب</th><th style={{ textAlign: 'center' }}>التحكم الإداري المتقدم</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map(w => (
                    <tr key={w.id} style={{ borderBottom: '1px solid #1e293b', opacity: w.is_active === false ? 0.4 : 1 }}>
                      <td style={{ padding: '12px', border: '1px solid #334155', fontWeight: 'bold' }}>{w.name} {w.is_active === false && <span style={{ color: '#ef4444', fontSize: '11px' }}>(موقوف)</span>}</td>
                      <td style={{ padding: '12px', border: '1px solid #334155', color: '#f43f5e' }}>{w.role}</td>
                      <td style={{ padding: '12px', border: '1px solid #334155' }}>{w.phone || 'غير مسجل'}</td>
                      <td style={{ padding: '12px', border: '1px solid #334155' }}>{w.salary_type === 'daily' ? 'يومية' : 'شهري'}</td>
                      <td style={{ padding: '12px', border: '1px solid #334155', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button type="button" onClick={() => openWorkerProfile(w)} style={{ backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>👁️ ملف العامل</button>
                          <button type="button" onClick={() => setEditingWorker(w)} style={{ backgroundColor: '#1e3a8a', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>✏️ تعديل</button>
                          <button type="button" onClick={() => toggleWorkerStatus(w)} style={{ backgroundColor: w.is_active ? '#7f1d1d' : '#064e3b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>{w.is_active ? '🛑 إيقاف' : '🔄 تفعيل'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}