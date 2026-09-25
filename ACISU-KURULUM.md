# Acısu United yönetim paneli kurulumu

1. **Acısu United** için ayrı Supabase projesi (`mjnnotqrcdotklqtemgm`) oluşturuldu. ANT Turnuva projesi kullanılmadı.
2. `supabase-schema.sql` Acısu projesinde çalıştırıldı. Taslaktaki dokuz oyuncu ve 16.09.2026 tarihli 5–6'lık maç aktarıldı. Eski maçın saati taslakta yazmadığı için sitede yalnızca tarih görünür.
3. Supabase Authentication > Users bölümünden admin e-postanla bir kullanıcı oluştur. E-posta onayını tamamla. Auth içindeki kullanıcının **UUID** değerini kopyala.
4. Acısu projesinin SQL Editor ekranında şu komutu kendi UUID değerinle çalıştır:

   ```sql
   insert into public.acisu_admins (user_id)
   values ('KENDI-KULLANICI-UUID-DEGERIN');
   ```

5. Acısu projesinin Project URL ve **publishable key** değerleri `supabase-config.js` içine girildi. `service_role` ya da secret key dosyaya kesinlikle koyma.
6. GitHub Pages üzerinden `admin.html` sayfasına gir ve admin e-postan/şifrenle oturum aç.

Oyuncu fotoğrafları için depodaki `oyuncu.png` gibi dosya adları veya HTTPS görsel adresleri kullanılabilir. Fotoğraf yükleme henüz panelde yok; dosyayı önce GitHub reposuna koyman gerekir. Oyuncu, maç ve kadro kayıtları Supabase'e yazılır; anasayfa her açıldığında veritabanından okur. Maç kadrosu bölümünde yayımlanan en yakın oynanmamış maçın oyuncuları görünür.

**Not:** Kod şu anda taslak PR dalındadır. Admin kullanıcı oluşturulup `acisu_admins` tablosuna eklenene kadar veri girişi yapılamaz. PR birleştirilince anasayfa ayrı Acısu projesinden veri okur.
