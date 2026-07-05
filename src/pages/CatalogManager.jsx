import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CatalogManager() {
  const [activeTab, setActiveTab] = useState('products'); // 'products', 'hero', 'fabrics'
  const [loading, setLoading] = useState(false);
  
  // داتا الموديلات
  const [items, setItems] = useState([]);
  const categories = ['المرابيع والجلسات العربية', 'ستائر', 'صالونات', 'مفروشات'];
  const [productData, setProductData] = useState({ name: '', category: 'المرابيع والجلسات العربية', description: '', price: '', discount_price: '', is_offer: false, video_url: '' });
  const [productFile, setProductFile] = useState(null);
  const [productPreview, setProductPreview] = useState('');

  // داتا الهيدر
  const [heroImages, setHeroImages] = useState([]);
  const [heroFile, setHeroFile] = useState(null);
  const [heroPreview, setHeroPreview] = useState('');

  // داتا الأقمشة
  const [fabrics, setFabrics] = useState([]);
  const [fabricData, setFabricData] = useState({ name: '' });
  const [fabricFile, setFabricFile] = useState(null);
  const [fabricPreview, setFabricPreview] = useState('');
  
  // نظام اختيار الألوان الجديد
  const [fabricColors, setFabricColors] = useState([]); // مصفوفة لحفظ الألوان المختارة
  const [currentColor, setCurrentColor] = useState('#eab308'); // اللون الافتراضي في لوحة الاختيار

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [catRes, heroRes, fabRes] = await Promise.all([
      supabase.from('catalog').select('*').order('id', { ascending: false }),
      supabase.from('hero_images').select('*').order('id', { ascending: false }),
      supabase.from('fabrics').select('*').order('id', { ascending: false })
    ]);
    if (catRes.data) setItems(catRes.data);
    if (heroRes.data) setHeroImages(heroRes.data);
    if (fabRes.data) setFabrics(fabRes.data);
  };

  // تصغير المقاسات
  const resizeImage = (file, maxWidth = 1000, maxHeight = 1000) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } } 
          else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }));
          }, 'image/webp', 0.8);
        };
      };
    });
  };

  const uploadFile = async (file) => {
    const fileName = `${Math.random()}.webp`;
    const { error } = await supabase.storage.from('catalog_images').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('catalog_images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // ============ معالجة المنتجات ============
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!productData.name || (!productFile && !productData.video_url)) return alert('أدخل الاسم وصورة أو فيديو');
    setLoading(true);
    try {
      let imgUrl = null;
      if (productFile) imgUrl = await uploadFile(productFile);
      
      const { error } = await supabase.from('catalog').insert([{
        name: productData.name, category: productData.category, description: productData.description,
        price: productData.price || null, discount_price: productData.discount_price || null,
        is_offer: productData.is_offer, video_url: productData.video_url, image_url: imgUrl
      }]);
      if (error) throw error;
      setProductData({ name: '', category: 'المرابيع والجلسات العربية', description: '', price: '', discount_price: '', is_offer: false, video_url: '' });
      setProductFile(null); setProductPreview(''); fetchData(); alert('تم إضافة الموديل بنجاح');
    } catch (err) { alert('خطأ: ' + err.message); }
    setLoading(false);
  };

  // ============ معالجة الهيدر ============
  const handleHeroSubmit = async (e) => {
    e.preventDefault();
    if (!heroFile) return alert('الرجاء اختيار صورة');
    setLoading(true);
    try {
      const imgUrl = await uploadFile(heroFile);
      const { error } = await supabase.from('hero_images').insert([{ image_url: imgUrl }]);
      if (error) throw error;
      setHeroFile(null); setHeroPreview(''); fetchData(); alert('تم إضافة صورة الهيدر');
    } catch (err) { alert('خطأ: ' + err.message); }
    setLoading(false);
  };

  // ============ دوال اختيار الألوان للأقمشة ============
  const handleAddColor = () => {
    if (!fabricColors.includes(currentColor)) {
      setFabricColors([...fabricColors, currentColor]);
    }
  };

  const handleRemoveColor = (colorToRemove) => {
    setFabricColors(fabricColors.filter(c => c !== colorToRemove));
  };

  // ============ معالجة الأقمشة ============
  const handleFabricSubmit = async (e) => {
    e.preventDefault();
    if (!fabricData.name || !fabricFile) return alert('الرجاء إدخال الاسم وصورة القماش');
    if (fabricColors.length === 0) return alert('الرجاء اختيار لون واحد على الأقل');
    setLoading(true);
    try {
      const imgUrl = await uploadFile(fabricFile);
      const { error } = await supabase.from('fabrics').insert([{
        name: fabricData.name,
        colors: fabricColors.join(','), // دمج الألوان بنص مفصول بفاصلة ليتوافق مع قاعدة البيانات والكتالوج
        image_url: imgUrl
      }]);
      if (error) throw error;
      setFabricData({ name: '' });
      setFabricColors([]); // تصفير الألوان بعد الحفظ
      setFabricFile(null); setFabricPreview(''); fetchData(); alert('تم إضافة القماش');
    } catch (err) { alert('خطأ: ' + err.message); }
    setLoading(false);
  };

  const handleDelete = async (table, id) => {
    if(window.confirm('تأكيد الحذف؟')) {
      await supabase.from(table).delete().eq('id', id);
      fetchData();
    }
  };

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', marginTop: '5px' };

  return (
    <div style={{ padding: '20px', backgroundColor: '#020617', color: 'white', minHeight: '100vh', paddingRight: '280px', fontFamily: '"Cairo", sans-serif' }} dir="rtl">
      <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '20px' }}>
        <h1 style={{ color: '#eab308', fontSize: '28px', margin: 0, fontWeight: 'bold' }}>🖼️ التحكم الشامل في محتوى الموقع</h1>
      </div>

      {/* شريط التبويبات */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('products')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: activeTab === 'products' ? '#6B1D2F' : '#1e293b', color: 'white' }}>🛋️ الموديلات والعروض</button>
        <button onClick={() => setActiveTab('hero')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: activeTab === 'hero' ? '#6B1D2F' : '#1e293b', color: 'white' }}>🌄 صور الهيدر</button>
        <button onClick={() => setActiveTab('fabrics')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: activeTab === 'fabrics' ? '#6B1D2F' : '#1e293b', color: 'white' }}>🧵 الأقمشة والألوان</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px' }}>
        
        {/* ================= فورم الإدخال حسب التبويب النشط ================= */}
        <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          
          {activeTab === 'products' && (
            <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ color: '#eab308', margin: 0 }}>➕ إضافة موديل</h3>
              <div><label style={{ fontSize: '12px', color: '#94a3b8' }}>الاسم</label><input type="text" value={productData.name} onChange={e => setProductData({...productData, name: e.target.value})} required style={inputStyle} /></div>
              <div><label style={{ fontSize: '12px', color: '#94a3b8' }}>القسم</label><select value={productData.category} onChange={e => setProductData({...productData, category: e.target.value})} style={inputStyle}>{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
              <div><label style={{ fontSize: '12px', color: '#94a3b8' }}>الوصف</label><textarea rows="2" value={productData.description} onChange={e => setProductData({...productData, description: e.target.value})} style={inputStyle}></textarea></div>
              <div style={{ border: '1px dashed #334155', padding: '10px', borderRadius: '8px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>الصورة</label>
                <input type="file" accept="image/*" onChange={async (e) => { if(e.target.files[0]) { setProductPreview(URL.createObjectURL(e.target.files[0])); setProductFile(await resizeImage(e.target.files[0])); } }} style={{ color: 'white', width: '100%' }} />
                {productPreview && <img src={productPreview} alt="Preview" style={{ height: '60px', marginTop: '10px', borderRadius: '6px' }}/>}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="السعر" value={productData.price} onChange={e => setProductData({...productData, price: e.target.value})} style={inputStyle} />
                <input type="text" placeholder="سعر العرض" value={productData.discount_price} onChange={e => setProductData({...productData, discount_price: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>رابط فيديو يوتيوب أو ڤيميو (اختياري)</label>
                <input type="text" placeholder="https://..." value={productData.video_url} onChange={e => setProductData({...productData, video_url: e.target.value})} style={inputStyle} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={productData.is_offer} onChange={e => setProductData({...productData, is_offer: e.target.checked})} />
                <span style={{ color: '#eab308', fontSize: '14px', fontWeight: 'bold' }}>تحديد كعرض خاص ليظهر بالسلايدر</span>
              </label>
              <button type="submit" disabled={loading} style={{ backgroundColor: '#eab308', padding: '12px', borderRadius: '6px', fontWeight: 'bold' }}>{loading ? '⏳...' : 'حفظ'}</button>
            </form>
          )}

          {activeTab === 'hero' && (
            <form onSubmit={handleHeroSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ color: '#eab308', margin: 0 }}>🌄 إضافة صورة هيدر</h3>
              <div style={{ border: '1px dashed #334155', padding: '10px', borderRadius: '8px' }}>
                <input type="file" accept="image/*" onChange={async (e) => { if(e.target.files[0]) { setHeroPreview(URL.createObjectURL(e.target.files[0])); setHeroFile(await resizeImage(e.target.files[0], 1920, 1080)); } }} style={{ color: 'white', width: '100%' }} />
                {heroPreview && <img src={heroPreview} alt="Preview" style={{ width: '100%', height: '100px', objectFit: 'cover', marginTop: '10px', borderRadius: '6px' }}/>}
              </div>
              <button type="submit" disabled={loading} style={{ backgroundColor: '#eab308', padding: '12px', borderRadius: '6px', fontWeight: 'bold' }}>{loading ? '⏳...' : 'حفظ ورفع'}</button>
            </form>
          )}

          {activeTab === 'fabrics' && (
            <form onSubmit={handleFabricSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ color: '#eab308', margin: 0 }}>🧵 إضافة خامة قماش</h3>
              
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>اسم القماش</label>
                <input type="text" value={fabricData.name} onChange={e => setFabricData({...fabricData, name: e.target.value})} required style={inputStyle} />
              </div>

              {/* قسم اختيار الألوان البصري */}
              <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '10px' }}>الألوان المتاحة (اضغط لاختيار لون)</label>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                  <input 
                    type="color" 
                    value={currentColor} 
                    onChange={(e) => setCurrentColor(e.target.value)} 
                    style={{ width: '45px', height: '45px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }} 
                  />
                  <button 
                    type="button" 
                    onClick={handleAddColor} 
                    style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
                  >
                    إضافة هذا اللون +
                  </button>
                </div>

                {/* عرض الألوان المختارة */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', minHeight: '40px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                  {fabricColors.map((color, index) => (
                    <div 
                      key={index} 
                      onClick={() => handleRemoveColor(color)}
                      title="اضغط للحذف"
                      style={{ 
                        width: '30px', height: '30px', borderRadius: '50%', backgroundColor: color, 
                        border: '2px solid #fff', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: '10px', textShadow: '0 0 2px #000', opacity: 0 }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0}>✕</span>
                    </div>
                  ))}
                  {fabricColors.length === 0 && <span style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center' }}>لم يتم اختيار ألوان بعد</span>}
                </div>
                <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '8px' }}>* اضغط على الدائرة لحذفها.</small>
              </div>

              <div style={{ border: '1px dashed #334155', padding: '10px', borderRadius: '8px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>صورة شكل القماش</label>
                <input type="file" accept="image/*" onChange={async (e) => { if(e.target.files[0]) { setFabricPreview(URL.createObjectURL(e.target.files[0])); setFabricFile(await resizeImage(e.target.files[0])); } }} style={{ color: 'white', width: '100%', marginTop: '5px' }} />
                {fabricPreview && <img src={fabricPreview} alt="Preview" style={{ height: '60px', marginTop: '10px', borderRadius: '6px' }}/>}
              </div>
              <button type="submit" disabled={loading} style={{ backgroundColor: '#eab308', padding: '12px', borderRadius: '6px', fontWeight: 'bold' }}>{loading ? '⏳...' : 'حفظ'}</button>
            </form>
          )}

        </div>

        {/* ================= الجداول لعرض الداتا ================= */}
        <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px', border: '1px solid #1e293b', overflowX: 'auto' }}>
          
          {activeTab === 'products' && (
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}><th>الصورة</th><th>الاسم</th><th>القسم</th><th>إجراء</th></tr></thead>
              <tbody>{items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px' }}>{item.image_url ? <img src={item.image_url} alt="" style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover' }} /> : 'بدون'}</td>
                  <td style={{ padding: '10px' }}>{item.name} {item.is_offer && '🔥'}</td>
                  <td style={{ padding: '10px', color: '#94a3b8' }}>{item.category}</td>
                  <td style={{ padding: '10px' }}><button onClick={() => handleDelete('catalog', item.id)} style={{ background: '#7f1d1d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>حذف</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {activeTab === 'hero' && (
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}><th>الصورة المعروضة بالهيدر</th><th>إجراء</th></tr></thead>
              <tbody>{heroImages.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px' }}><img src={item.image_url} alt="" style={{ width: '150px', height: '70px', borderRadius: '6px', objectFit: 'cover' }} /></td>
                  <td style={{ padding: '10px' }}><button onClick={() => handleDelete('hero_images', item.id)} style={{ background: '#7f1d1d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>حذف</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {activeTab === 'fabrics' && (
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}><th>الصورة</th><th>الاسم</th><th>الألوان</th><th>إجراء</th></tr></thead>
              <tbody>{fabrics.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px' }}><img src={item.image_url} alt="" style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover' }} /></td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.name}</td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {item.colors && item.colors.split(',').map((c, i) => <div key={i} title={c} style={{ width: '20px', height: '20px', backgroundColor: c.trim(), borderRadius: '50%', border: '1px solid white' }} />)}
                    </div>
                  </td>
                  <td style={{ padding: '10px' }}><button onClick={() => handleDelete('fabrics', item.id)} style={{ background: '#7f1d1d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>حذف</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}

        </div>
      </div>
    </div>
  );
}