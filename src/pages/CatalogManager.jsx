import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CatalogManager() {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // مدخلات المقايسة الذكية
  const [quote, setQuote] = useState({
    wood_id: '',
    sponge_id: '',
    fabric_id: '',
    meters: '',
    accessories_cost: '0',
    labor_cost: '0'
  });

  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchInventoryForPricing();
  }, []);

  // جلب الخامات المتاحة في المخزن لايف مع أسعارها
  const fetchInventoryForPricing = async () => {
    setLoading(true);
    // تأكد أن جدول المخزن يحتوي على حقل السعر (مثلاً باسم cost_price أو price)
    // هنا سنفترض أن الحقل المخزن فيه سعر التكلفة هو price أو نقوم بجلبه ديناميكياً
    const { data, error } = await supabase
      .from('inventory')
      .select('id, name, quantity, price'); // يمكنك تعديل اسم حقل السعر هنا ليطابق قاعدة بياناتك (مثال: cost_price)
    
    if (!error && data) {
      setInventoryItems(data);
    }
    setLoading(false);
  };

  const handleCalculateQuote = (e) => {
    e.preventDefault();
    const m = Number(quote.meters);
    if (!m || m <= 0) return alert('الرجاء كتابة عدد الأمتار المطلوب أولاً');

    // لقط أسعار الخامات المختارة من المخزن لايف
    const selectedWood = inventoryItems.find(item => item.id === Number(quote.wood_id));
    const selectedSponge = inventoryItems.find(item => item.id === Number(quote.sponge_id));
    const selectedFabric = inventoryItems.find(item => item.id === Number(quote.fabric_id));

    // استخراج الأسعار (لو مش محدد خامة أو سعرها مش مكتوب بنعتبره 0)
    const woodPrice = selectedWood ? Number(selectedWood.price || 0) : 0;
    const spongePrice = selectedSponge ? Number(selectedSponge.price || 0) : 0;
    const fabricPrice = selectedFabric ? Number(selectedFabric.price || 0) : 0;

    // 1. حساب تكلفة الخامات لكل متر بناءً على أسعار المخزن الحالية
    const materialsCostPerMeter = woodPrice + spongePrice + fabricPrice;
    const totalMaterialsCost = materialsCostPerMeter * m;

    // 2. إجمالي التكلفة الكلية = الخامات + الاكسسوارات + مصنعية الصنايعي
    const totalCost = totalMaterialsCost + Number(quote.accessories_cost) + Number(quote.labor_cost);

    // 3. حساب سعر البيع العادل للزبون (التكلفة + هامش ربح 35% لشركة حرير)
    const profitMargin = 0.35;
    const fairSellingPrice = Math.round(totalCost * (1 + profitMargin));

    setResult({
      woodName: selectedWood ? selectedWood.name : 'غير محدد',
      spongeName: selectedSponge ? selectedSponge.name : 'غير محدد',
      fabricName: selectedFabric ? selectedFabric.name : 'غير محدد',
      materialsCost: totalMaterialsCost,
      totalCost: totalCost,
      sellingPrice: fairSellingPrice,
      profit: fairSellingPrice - totalCost
    });
  };

  const inputStyle = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', marginTop: '5px' };

  if (loading) return <div style={{ color: 'white', textAlign: 'center', paddingTop: '100px' }}>⏳ جاري ربط الحاسبة بأسعار المخزن الحية...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh' }} dir="rtl">
      
      <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '25px' }}>
        <h1 style={{ color: '#eab308', fontSize: '28px', margin: 0, fontWeight: 'bold' }}>📐 حاسبة المقايسات السريعة والتسعير الذكي الآلي</h1>
        <p style={{ color: '#94a3b8', fontSize: '12px', margin: '5px 0 0 0' }}>مربوطة تلقائياً بأسعار الخامات الحالية في المخزن لايف</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: '25px' }}>
        
        {/* يمين: مدخلات المقايسة */}
        <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#eab308' }}>■ مواصفات تفصيل الموديل (من المخزن)</h3>
          <form onSubmit={handleCalculateQuote} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>اختر الخشب الأساسي</label>
              <select value={quote.wood_id} onChange={e => setQuote({...quote, wood_id: e.target.value})} required style={inputStyle}>
                <option value="">-- اختر خامة الخشب --</option>
                {inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.price} ج.م / للمتر)</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>اختر الإسفنج / الكثافة</label>
              <select value={quote.sponge_id} onChange={e => setQuote({...quote, sponge_id: e.target.value})} required style={inputStyle}>
                <option value="">-- اختر نوع الإسفنج --</option>
                {inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.price} ج.م / للمتر)</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>اختر القماش</label>
              <select value={quote.fabric_id} onChange={e => setQuote({...quote, fabric_id: e.target.value})} required style={inputStyle}>
                <option value="">-- اختر نوع القماش --</option>
                {inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.price} ج.م / للمتر)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>عدد الأمتار المطلوب</label>
                <input type="number" step="0.1" placeholder="مثال: 7" value={quote.meters} onChange={e => setQuote({...quote, meters: e.target.value})} required style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>مصنعية الصنايعي التقديرية</label>
                <input type="number" placeholder="ج.م" value={quote.labor_cost} onChange={e => setQuote({...quote, labor_cost: e.target.value})} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>إجمالي تكلفة الإكسسوارات (خداديات، عجل، أزرار)</label>
              <input type="number" placeholder="تكلفة الإكسسوارات الإجمالية" value={quote.accessories_cost} onChange={e => setQuote({...quote, accessories_cost: e.target.value})} style={inputStyle} />
            </div>

            <button type="submit" style={{ backgroundColor: '#eab308', color: 'black', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px' }}>
              ⚡ احسب التكلفة وسعر البيع لايف
            </button>
          </form>
        </div>

        {/* يسار: شاشة عرض النتيجة */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {result ? (
            <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '12px', border: '2px solid #eab308', textAlign: 'center' }}>
              <span style={{ fontSize: '14px', color: '#94a3b8' }}>سعر البيع النهائي المقترح للزبون</span>
              <h1 style={{ fontSize: '45px', color: '#10b981', margin: '10px 0 20px 0', fontWeight: 'bold' }}>{result.sellingPrice} ج.م</h1>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'right', fontSize: '14px', borderTop: '1px solid #334155', paddingTop: '15px' }}>
                <div>🪵 <strong>الخشب المستخدم:</strong> {result.woodName}</div>
                <div>🧽 <strong>الإسفنج المستخدم:</strong> {result.spongeName}</div>
                <div>🧵 <strong>القماش المستخدم:</strong> {result.fabricName}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px', borderTop: '1px dashed #334155', paddingTop: '15px' }}>
                <div style={{ textAlign: 'right', fontSize: '13px' }}>
                  <div style={{ color: '#94a3b8' }}>إجمالي تكلفة الخامات:</div>
                  <strong style={{ color: 'white' }}>{result.materialsCost} ج.م</strong>
                </div>
                <div style={{ textAlign: 'right', fontSize: '13px' }}>
                  <div style={{ color: '#94a3b8' }}>التكلفة الكلية بالمصنعية:</div>
                  <strong style={{ color: 'white' }}>{result.totalCost} ج.م</strong>
                </div>
                <div style={{ textAlign: 'right', fontSize: '14px', gridColumn: '1 / span 2', borderTop: '1px solid #334155', paddingTop: '10px', marginTop: '5px' }}>
                  <div style={{ color: '#34d399' }}>صافي ربح شركة حرير التقريبي (35%):</div>
                  <strong style={{ color: '#34d399', fontSize: '18px' }}>{result.profit} ج.م</strong>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px', color: '#475569' }}>
              <span style={{ fontSize: '60px' }}>📊</span>
              <h3>اختر الأصناف الحية من مخزنك وسيقوم السيستم بسحب الأسعار الحالية وحساب المقايسة في التو واللحظة!</h3>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}