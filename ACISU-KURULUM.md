# Acısu United yönetim paneli kurulumu

1. **Acısu United** için ayrı Supabase projesi (`mjnnotqrcdotklqtemgm`) oluşturuldu. ANT Turnuva projesi kullanılmadı.
2. `supabase-schema.sql` Acısu projesinde çalıştırıldı. Taslaktaki dokuz oyuncu ve 16.09.2026 tarihli 5–6'lık maç aktarıldı. Eski maçın saati taslakta yazmadığı için sitede yalnızca tarih görünür.
3. İlk admin hesabı Acısu projesinde oluşturulup doğrulandı ve `acisu_admins` tablosuna eklendi. Yeni admin hesabı gerektiğinde önce Supabase Authentication > Users ekranında kullanıcı oluşturup e-postasını doğrula.
4. Doğrulama tamamlandıktan sonra Acısu projesinin SQL Editor ekranında şu komutla o e-postaya ait kullanıcıya admin yetkisi ver:

   ```sql
   insert into public.acisu_admins (user_id)
   select id from auth.users
   where email = 'ADMIN_E_POSTA_ADRESIN' and email_confirmed_at is not null
   on conflict (user_id) do nothing;
   ```

5. Acısu projesinin Project URL ve **publishable key** değerleri `supabase-config.js` içine girildi. `service_role` ya da secret key dosyaya kesinlikle koyma.
6. GitHub Pages üzerinden `admin.html` sayfasına gir ve e-postan/şifrenle oturum aç.

Admin panelinde oyuncu fotoğrafı telefondan veya bilgisayardan doğrudan seçilir (JPG, PNG veya WebP; en fazla 5 MB). Fotoğraf Acısu projesinin `acisu-player-photos` adlı public Supabase Storage alanına yüklenir ve URL'si oyuncu kaydına otomatik bağlanır. Sadece `acisu_admins` içindeki yöneticiler fotoğraf yükleyip silebilir. Yeni fotoğraflar GitHub reposuna otomatik commit edilmez; repodaki mevcut oyuncu görselleri kullanılmaya devam eder. Oyuncu, maç ve kadro kayıtları Supabase'e yazılır; anasayfa her açıldığında veritabanından okur. Maç kadrosu bölümünde yayımlanan en yakın oynanmamış maçın oyuncuları görünür.

**Not:** Kod ana dala alındı; anasayfa ayrı Acısu projesinden veri okuyor. Genel kayıt düğmesi kaldırıldı; admin paneli yalnızca tanımlı hesaplarla kullanılır.
