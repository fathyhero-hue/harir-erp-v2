import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const categories = ['الكل', 'جلسات عربية', 'ستائر', 'صالونات', 'مفروشات'];
const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER;

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    const { data, error } = await supabase.from('catalog').select('*').order('id', { ascending: false });
    if (!error && data) setProducts(data);
  };

  const filteredProducts = selectedCategory === 'الكل' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const handleWhatsAppConnect = (productName) => {
    if (!whatsappNumber) {
      alert('رقم واتساب غير مضبوط. أضف VITE_WHATSAPP_NUMBER في ملف البيئة.');
      return;
    }
    const message = encodeURIComponent(`مرحباً شركة حرير، أريد الاستفسار واطلب معاينة بخصوص: ${productName}`);
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const fabrics = [
    { name: 'قطيفة تركي', colors: ['#6B1D2F', '#1e293b', '#b91c1c', '#d97706'] },
    { name: 'شانيل مشجر', colors: ['#15803d', '#4338ca', '#6b7280'] },
    { name: 'كتان هيرميز', colors: ['#78350f', '#fef08a', '#f59e0b'] }
  ];

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', paddingBottom: '50px' }} dir="rtl">
      
      {/* البنر الرئيسي الفخم */}
      <div style={{
        backgroundImage: 'linear-gradient(rgba(2,6,23,0.7), rgba(2,6,23,0.95)), url("https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '80px 20px',
        textAlign: 'center',
        borderRadius: '0 0 24px 24px',
        borderBottom: '2px solid #6B1D2F'
      }}>
        <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>أحدث صيحات الجلسات العربية والستائر</h1>
        <p style={{ color: '#94a3b8', fontSize: '16px', maxWidth: '600px', margin: '0 auto 25px auto' }}>نصنع الفخامة في مصنعنا لتزين منزلك بأجود أنواع الأخشاب والأقمشة العالمية برعاية "حرير والديكور"</p>
        <button onClick={() => handleWhatsAppConnect('طلب معاينة عامة للمنزل')} style={{ backgroundColor: '#25D366', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,211,102,0.4)' }}>
          💬 اطلب معاينة ورفع مقاسات مجانية الآن
        </button>
      </div>

      {/* شريط الأقسام */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '30px 0', flexWrap: 'wrap', padding: '0 20px' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              border: selectedCategory === cat ? 'none' : '1px solid #1e293b',
              backgroundColor: selectedCategory === cat ? '#6B1D2F' : '#0f172a',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* المعرض المربوط بقاعدة البيانات */}
      <div style={{ padding: '0 20px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', borderRight: '4px solid #6B1D2F', paddingRight: '10px' }}>معرض الموديلات الجاهزة للتفصيل</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
          {filteredProducts.map(prod => (
            <div key={prod.id} style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '200px', backgroundColor: '#1e293b', position: 'relative' }}>
                <img src={prod.image_url} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(107,29,47,0.9)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>{prod.category}</span>
              </div>
              <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'between' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0' }}>{prod.name}</h3>
                  <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', margin: '0 0 15px 0' }}>{prod.description}</p>
                </div>
                <button onClick={() => handleWhatsAppConnect(prod.name)} style={{ width: '100%', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  اطلب مثل هذا الموديل 📞
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ركن الأقمشة */}
      <div style={{ padding: '0 20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', borderRight: '4px solid #f59e0b', paddingRight: '10px' }}>ركن الأقمشة والألوان المتاحة بالمصنع</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          {fabrics.map((fab, idx) => (
            <div key={idx} style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold' }}>{fab.name}</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                {fab.colors.map((col, cIdx) => (
                  <div key={cIdx} style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: col, border: '2px solid #334155' }} />
                ))}
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>متوفر حالياً وجاهز للقص الفوري</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
