import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const categories = ['الكل', 'المرابيع والجلسات العربية', 'ستائر', 'صالونات', 'مفروشات'];
const whatsappNumber = '201001899372';

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [loading, setLoading] = useState(true);
  
  const [offers, setOffers] = useState([]);
  const [news, setNews] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [heroImages, setHeroImages] = useState([]);
  const [fabrics, setFabrics] = useState([]);

  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [offerIdx, setOfferIdx] = useState(0);
  const [newIdx, setNewIdx] = useState(0);
  const [deliveryIdx, setDeliveryIdx] = useState(0);

  // الصور والخامات الافتراضية لو الداتابيز فاضية
  const fallbackHero = [
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80",
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80"
  ];
  const fallbackFabrics = [
    { name: 'قطيفة تركي (افتراضي)', colors: '#6B1D2F,#1e293b,#d97706', image_url: '' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [catRes, heroRes, fabRes] = await Promise.all([
      supabase.from('catalog').select('*').order('created_at', { ascending: false }),
      supabase.from('hero_images').select('*'),
      supabase.from('fabrics').select('*')
    ]);

    if (catRes.data) {
      setProducts(catRes.data);
      setOffers(catRes.data.filter(p => p.is_offer));
      setNews(catRes.data.slice(0, 5));
      const shuffled = [...catRes.data].sort(() => 0.5 - Math.random());
      setDeliveries(shuffled.slice(0, 5));
    }
    
    // سحب الهيدر والأقمشة أو وضع الافتراضي
    setHeroImages(heroRes.data && heroRes.data.length > 0 ? heroRes.data.map(h => h.image_url) : fallbackHero);
    setFabrics(fabRes.data && fabRes.data.length > 0 ? fabRes.data : fallbackFabrics);
    
    setLoading(false);
  };

  const filteredProducts = selectedCategory === 'الكل' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  useEffect(() => {
    const tHero = setInterval(() => setHeroImageIndex(i => (i + 1) % heroImages.length), 5000);
    const tOffer = setInterval(() => setOfferIdx(i => offers.length ? (i + 1) % offers.length : 0), 3000);
    const tNew = setInterval(() => setNewIdx(i => news.length ? (i + 1) % news.length : 0), 4000);
    const tDel = setInterval(() => setDeliveryIdx(i => deliveries.length ? (i + 1) % deliveries.length : 0), 5000);
    return () => { clearInterval(tHero); clearInterval(tOffer); clearInterval(tNew); clearInterval(tDel); };
  }, [heroImages.length, offers.length, news.length, deliveries.length]);

  const handleWhatsAppConnect = (productName, type = 'الموديل') => {
    const message = encodeURIComponent(`مرحباً شركة حرير، أريد الاستفسار واطلب معاينة بخصوص ${type}: ${productName}`);
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const SliderCard = ({ title, icon, badge, items, currentIndex, type }) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', padding: '15px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
        <h3 style={{ textAlign: 'center', color: '#eab308', fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>{icon} {title}</h3>
        <div style={{ position: 'relative', height: '200px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#1e293b' }}>
          {items.map((item, idx) => (
            <div key={`${item.id}-${idx}`} style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              opacity: idx === currentIndex ? 1 : 0, transition: 'opacity 0.8s ease-in-out', pointerEvents: idx === currentIndex ? 'auto' : 'none'
            }}>
              <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', zIndex: 10 }}>{badge}</div>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>بدون صورة</div>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'linear-gradient(transparent, rgba(2,6,23,0.95))', padding: '25px 15px 10px', textAlign: 'center' }}>
                <h4 style={{ color: 'white', margin: '0 0 5px 0', fontSize: '15px', fontWeight: 'bold' }}>{item.name}</h4>
                {item.discount_price && <span style={{ color: '#eab308', fontWeight: 'bold', fontSize: '14px' }}>{item.discount_price} ج</span>}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => handleWhatsAppConnect(items[currentIndex]?.name, type)} style={{ width: '100%', marginTop: '15px', backgroundColor: '#6B1D2F', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#881337'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#6B1D2F'}>
          استفسر الآن 💬
        </button>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', paddingBottom: '50px', fontFamily: '"Cairo", system-ui, sans-serif' }} dir="rtl">
      
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          .fade-transition { transition: opacity 1s ease-in-out; }
          .hover-scale { transition: transform 0.3s ease, box-shadow 0.3s ease; }
          .hover-scale:hover { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-color: #6B1D2F; }
          .contact-item { transition: color 0.2s; }
          .contact-item:hover { color: #eab308; }
          .custom-scrollbar::-webkit-scrollbar { height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
          
          /* تأثير اللمعان الاحترافي للشعار */
          @keyframes logoShine {
            0% { filter: drop-shadow(0px 2px 5px rgba(0,0,0,0.6)) brightness(1); }
            50% { filter: drop-shadow(0px 0px 15px rgba(234, 179, 8, 0.7)) brightness(1.25); }
            100% { filter: drop-shadow(0px 2px 5px rgba(0,0,0,0.6)) brightness(1); }
          }
          .logo-glowing { animation: logoShine 3s infinite alternate ease-in-out; }
        `}
      </style>

      {/* الهيدر المدمج (الشعار + معلومات التواصل + الخلفية المتغيرة) */}
      <div style={{
        position: 'relative',
        minHeight: '520px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '30px 20px',
        overflow: 'hidden',
        borderBottom: '2px solid #6B1D2F',
        borderRadius: '0 0 30px 30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
      }}>
        
        {/* الصور المتغيرة كخلفية (تم زيادة الوضوح إلى 0.85 ليبرز جمال الصورة) */}
        {heroImages.map((img, index) => (
          <div key={index} className="fade-transition" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: index === heroImageIndex ? 0.85 : 0, zIndex: 0 }} />
        ))}
        
        {/* تدرج لوني ذكي (خفيف جداً لضمان قراءة النص دون طمس معالم الصورة) */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(2,6,23,0.7) 0%, rgba(2,6,23,0.1) 40%, rgba(2,6,23,0.8) 100%)', zIndex: 1 }} />

        {/* محتوى الهيدر (فوق الصورة) */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', maxWidth: '1200px' }}>
          
          {/* الجزء العلوي: الشعار والاسم ومعلومات التواصل */}
          <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
            {/* الشعار مع تأثير اللمعان الجديد */}
            <img src="/logo.png" alt="شعار حرير" className="logo-glowing" style={{ height: '70px', margin: '0 auto' }} />
            <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#f43f5e', margin: '10px 0 5px 0', letterSpacing: '1px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>حـــريـــر</h1>
            <h2 style={{ fontSize: '15px', color: '#eab308', margin: '0 0 15px 0', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>مفروشات وأثاث</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '14px', fontWeight: '600' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px', direction: 'ltr' }}>
                <span className="contact-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>📞 01003548222</span>
                <span className="contact-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#eab308', fontWeight: 'bold', textShadow: '0 2px 6px rgba(0,0,0,0.9)', fontSize: '15px' }}>📞 01001899372</span>
                <span className="contact-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>📞 01007227190</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', padding: '8px 20px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)', marginTop: '5px' }}>
                <span style={{ color: '#f43f5e' }}>📍</span><span>مطروح - شارع علم الروم - أمام الشعشاعي</span>
              </div>
            </div>
          </div>

          {/* الجزء السفلي: عنوان الترحيب وزر المعاينة */}
          <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '20px' }}>
            <h2 style={{ fontSize: '30px', fontWeight: '900', color: '#fff', marginBottom: '10px', textShadow: '0 4px 10px rgba(0,0,0,0.9)' }}>أحدث صيحات المرابيع والجلسات العربية</h2>
            <p style={{ color: '#cbd5e1', fontSize: '15px', maxWidth: '650px', margin: '0 auto 25px auto', lineHeight: '1.6', textShadow: '0 2px 8px rgba(0,0,0,0.9)', fontWeight: 'bold' }}>نصنع الفخامة في مصنعنا لتزين منزلك بأجود الخامات العالمية برعاية "حرير للأثاث والديكور"</p>
            <button 
              onClick={() => handleWhatsAppConnect('طلب معاينة عامة للمنزل', 'معاينة مجانية')} 
              style={{ backgroundColor: '#25D366', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '40px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 25px rgba(37,211,102,0.4)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', transition: 'all 0.2s ease', fontFamily: '"Cairo", sans-serif' }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} 
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '18px' }}>💬</span> اطلب معاينة مجانية الآن
            </button>
          </div>
          
        </div>
      </div>

      {/* السلايدرات الثلاثة */}
      {products.length > 0 && (
        <div style={{ padding: '0 20px', maxWidth: '1200px', margin: '-40px auto 30px auto', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <SliderCard title="أحدث العروض" icon="🔥" badge="عرض خاص" items={offers} currentIndex={offerIdx} type="العرض الخاص" />
            <SliderCard title="جديد حرير" icon="✨" badge="جديدنا" items={news} currentIndex={newIdx} type="الموديل الجديد" />
            <SliderCard title="أحدث التسليمات" icon="🚚" badge="تم التسليم" items={deliveries} currentIndex={deliveryIdx} type="الموديل" />
          </div>
        </div>
      )}

      {/* شريط الأقسام */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '40px 0 30px 0', flexWrap: 'wrap', padding: '0 20px' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: '8px 20px', borderRadius: '30px', border: selectedCategory === cat ? 'none' : '1px solid #1e293b', backgroundColor: selectedCategory === cat ? '#6B1D2F' : '#0f172a', color: selectedCategory === cat ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s ease', fontFamily: '"Cairo", sans-serif' }}>
            {cat}
          </button>
        ))}
      </div>

      {/* معرض الموديلات */}
      <div style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto 50px auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '25px', borderRight: '4px solid #6B1D2F', paddingRight: '12px', color: '#f8fafc' }}>معرض الموديلات الجاهزة للتفصيل</h2>
        {loading ? ( <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ جاري تحميل الكتالوج...</div> ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '25px' }}>
            {filteredProducts.map(prod => (
              <div key={prod.id} className="hover-scale" style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '220px', backgroundColor: '#1e293b', position: 'relative' }}>
                  {prod.image_url ? ( <img src={prod.image_url} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> ) : ( <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>بدون صورة</div> )}
                  <span style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(107,29,47,0.9)', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{prod.category}</span>
                </div>
                <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#fff' }}>{prod.name}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', margin: '0 0 15px 0' }}>{prod.description}</p>
                  </div>
                  {prod.price && !prod.is_offer && ( <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '12px' }}> السعر: {prod.price} ج.م </div> )}
                  {prod.video_url && ( <a href={prod.video_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', backgroundColor: '#1e293b', color: '#38bdf8', textDecoration: 'none', padding: '8px', borderRadius: '6px', marginBottom: '10px', fontSize: '13px', border: '1px solid #0284c7' }}> ▶️ فيديو توضيحي </a> )}
                  <button onClick={() => handleWhatsAppConnect(prod.name)} style={{ width: '100%', backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #0284c7', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', fontFamily: '"Cairo", sans-serif' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#0284c7'; e.currentTarget.style.color = '#fff'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = '#38bdf8'; }}>
                    اطلب مثل هذا الموديل 📞
                  </button>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '14px', backgroundColor: '#0f172a', borderRadius: '12px', border: '1px dashed #334155' }}>
                لا توجد موديلات في هذا القسم حالياً.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ركن الأقمشة المُدار برمجياً */}
      <div style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '25px', borderRight: '4px solid #f59e0b', paddingRight: '12px' }}>ركن الأقمشة والألوان المتاحة بالمصنع</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          {fabrics.map((fab, idx) => (
            <div key={idx} className="hover-scale" style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                {fab.image_url && <img src={fab.image_url} alt={fab.name} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #eab308' }} />}
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#eab308' }}>{fab.name}</h4>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {fab.colors && fab.colors.split(',').map((col, cIdx) => (
                  <div key={cIdx} style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: col.trim(), border: '2px solid #334155', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ color: '#10b981' }}>●</span> متوفر وجاهز للقص</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}