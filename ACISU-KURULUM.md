# Acısu United yönetim paneli kurulumu

1. Acısu United için **ayrı** bir Supabase projesi oluştur. ANT Turnuva projesini kullanma.
2. Yeni projenin SQL Editor ekranında `supabase-schema.sql` dosyasının tamamını çalıştır. Bu işlem taslaktaki dokuz oyuncuyu ve 16.09.2026 tarihli 5–6'lık maçı aktarır. Eski maçın saati taslakta yazmadığı için sitede sadece tarih görünür.
3. Supabase Authentication > Users bölümünden kendi e-posta adresinle bir kullanıcı oluştur. E-posta onayını tamamla. Auth içindeki kullanıcının **UUID** değerini kopyala.
4. SQL Editor'de şu komutu, kendi UUID değerinle çalıştır:

   ```sql
   insert into public.acisu_admins (user_id)
   values ('KENDI-KULLANICI-UUID-DEGERIN');
   ```

5. Yeni projenin Project URL ve **publishable key** değerlerini `supabase-config.js` içine gir. `service_role` ya da secret key dosyaya kesinlikle koyma.
6. GitHub Pages üzerinden `admin.html` sayfasına gir ve admin e-postan/şifrenle oturum aç.

Oyuncu fotoğrafları için depodaki `oyuncu.png` gibi dosya adları veya HTTPS görsel adresleri kullanılabilir. Fotoğraf yükleme henüz panelde yok; dosyayı önce GitHub reposuna koyman gerekir. Oyuncu, maç ve kadro kayıtları Supabase'e yazılır; anasayfa her açıldığında veritabanından okur. Maç kadrosu bölümünde yayımlanan en yakın oynanmamış maçın oyuncuları görünür.

**Not:** Bu değişiklikler veritabanı oluşturulup yapılandırma doldurulmadan canlı veri yazmaz. Bu sırada ana sayfa mevcut taslak kadroyu ve son maç kartını göstermeye devam eder.
