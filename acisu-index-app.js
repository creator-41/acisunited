// Oyuncu listesi ve klasördeki resim yolları
        window.teamSquad = [
            { name: "Mert Ali", number: 1, pos: "KL", ovr: 88, pace: 82, def: 89, pas: 84, img: "mert_ali.png" },
            { name: "Utku", number: 4, pos: "STP", ovr: 85, pace: 78, def: 88, pas: 75, img: "utku.png" },
            { name: "Yasir", number: 7, pos: "OS", ovr: 89, pace: 86, def: 82, pas: 88, img: "yasir.png" },
            { name: "Muhammed", number: 8, pos: "OS", ovr: 86, pace: 84, def: 80, pas: 85, img: "muhammed.png" },
            { name: "Hamza", number: 9, pos: "FOR", ovr: 92, pace: 94, def: 45, pas: 86, img: "hamza.png" },
            { name: "Enes", number: 10, pos: "OS", ovr: 90, pace: 88, def: 72, pas: 91, img: "enes.png" },
            { name: "Emrullah", number: 20, pos: "DEF", ovr: 96, pace: 97, def: 96, pas: 95, img: "emrullah.png" },
            { name: "Recep", number: 41, pos: "DEF", ovr: 86, pace: 81, def: 89, pas: 78, img: "recep.png" },
            { name: "Yusuf", number: 99, pos: "FOR", ovr: 88, pace: 91, def: 48, pas: 80, img: "yusuf.png" }
        ];

        window.technicalStaff = [];

        // Oyuncu Kartlarını Dinamik Basma (Fotoğraflar hafifçe aşağı kaydırıldı)
        function renderSquad() {
            const container = document.getElementById('squad-container');
            container.innerHTML = '';
            window.teamSquad.forEach(player => {
                const card = document.createElement('div');
                card.className = "fifa-card player-profile-trigger p-5 relative overflow-hidden group flex flex-col justify-between";
                card.dataset.playerId = player.id || "";
                card.tabIndex = 0;
                card.setAttribute("role", "button");
                card.setAttribute("aria-label", `${player.name} oyuncu profilini görüntüle`);
                card.addEventListener("click", () => document.dispatchEvent(new CustomEvent("acisu:open-player-profile", {detail:{playerId:player.id}})));
                card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); card.click(); } });
                card.innerHTML = `
                    <!-- Arka plan büyük şeffaf logo -->
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                        <img src="image_09a3ea.png" alt="" class="w-96 h-96 object-contain scale-150">
                    </div>

                    <!-- Üst Kısım: Reyting, Pozisyon ve Arma -->
                    <div class="flex justify-between items-start relative z-10">
                        <div class="flex flex-col items-center">
                            <span class="font-baslik text-3xl font-black text-altin leading-none">${player.ovr}</span>
                            <span class="font-bold text-xs text-gray-300 tracking-widest mt-1">${player.pos}</span>
                        </div>
                        <img src="image_09a3ea.png" alt="Arma" class="w-10 h-10 object-contain drop-shadow-[0_0_5px_rgba(193,165,123,0.6)]">
                    </div>

                    <!-- Oyuncu Fotoğrafı (Klasörden çekilir, hafif aşağı kaydırıldı) -->
                    <div class="my-2 flex justify-center relative z-10 pt-2">
                        <div class="w-28 h-28 rounded-full border-2 border-altin/50 overflow-hidden bg-black/40 flex items-center justify-center shadow-lg">
                            <img src="${player.img}" alt="${player.name}" onerror="this.onerror=null;this.src='image_09a3ea.png'" class="w-full h-full object-cover object-top translate-y-3 group-hover:scale-105 transition-transform duration-500">
                        </div>
                    </div>

                    <!-- Orta Kısım: Oyuncu İsmi -->
                    <div class="text-center mb-4 relative z-10">
                        <h3 class="font-bold text-xl text-white uppercase tracking-wider border-t border-altin/30 pt-2">${player.name}</h3>
                    </div>

                    <!-- Alt Kısım: FIFA İstatistikleri -->
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300 border-t border-white/10 pt-3 relative z-10 font-semibold tracking-wider">
                        <div class="flex justify-between px-2"><span>HIZ</span> <span class="text-altin">${player.pace}</span></div>
                        <div class="flex justify-between px-2"><span>PAS</span> <span class="text-altin">${player.pas}</span></div>
                        <div class="flex justify-between px-2"><span>DEF</span> <span class="text-altin">${player.def}</span></div>
                        <div class="flex justify-between px-2"><span>GEN</span> <span class="text-altin">${player.ovr}</span></div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        // Teknik heyeti oyuncu kartlarının görünümüyle göster.
        function renderCoach() {
            const container = document.getElementById('coach-container');
            container.innerHTML = window.technicalStaff.length ? window.technicalStaff.map(coachData => `
                <div class="fifa-card p-5 relative overflow-hidden group flex flex-col justify-between w-full max-w-sm sm:w-72 cursor-pointer" data-coach-id="${coachData.id}" role="button" tabindex="0" aria-label="${coachData.name} teknik heyet profilini görüntüle">
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                        <img src="image_09a3ea.png" alt="" class="w-96 h-96 object-contain scale-150">
                    </div>
                    <div class="flex justify-between items-start relative z-10">
                        <div class="flex flex-col items-center">
                            <span class="font-baslik text-3xl font-black text-altin leading-none">${coachData.played}</span>
                            <span class="font-bold text-[10px] text-gray-300 tracking-widest mt-1">OYNANAN MAÇ</span>
                        </div>
                        <img src="image_09a3ea.png" alt="Acısu United arması" class="w-10 h-10 object-contain drop-shadow-[0_0_5px_rgba(193,165,123,0.6)]">
                    </div>
                    <div class="my-2 flex justify-center relative z-10 pt-2">
                        <div class="w-28 h-28 rounded-full border-2 border-altin/50 overflow-hidden bg-black/40 flex items-center justify-center shadow-lg">
                            <img src="${coachData.img}" alt="${coachData.name}" onerror="this.onerror=null;this.src='image_09a3ea.png'" class="w-full h-full object-cover object-top translate-y-3 group-hover:scale-105 transition-transform duration-500">
                        </div>
                    </div>
                    <div class="text-center mb-4 relative z-10">
                        <p class="text-xs font-bold text-altin">${coachData.pos}</p>
                        <h3 class="font-bold text-xl text-white uppercase tracking-wider border-t border-altin/30 pt-2">${coachData.name}</h3>
                    </div>
                    <div class="grid grid-cols-4 gap-2 text-center text-[10px] text-gray-300 border-t border-white/10 pt-3 relative z-10 font-semibold tracking-wider">
                        <div><span class="block text-gray-400">OYN</span><strong class="text-white">${coachData.played}</strong></div>
                        <div><span class="block text-gray-400">GAL</span><strong class="text-green-300">${coachData.wins}</strong></div>
                        <div><span class="block text-gray-400">BER</span><strong class="text-altin">${coachData.draws}</strong></div>
                        <div><span class="block text-gray-400">MAĞ</span><strong class="text-red-300">${coachData.losses}</strong></div>
                    </div>
                    <p class="mt-3 text-center text-xs text-gray-300">Gol ${coachData.scored}–${coachData.conceded} · ${coachData.points} puan</p>
                </div>
            `).join('') : '<p class="text-gray-400 col-span-full">Teknik heyet henüz eklenmedi.</p>';
        }

        // Behold JSON akışından ana sayfa Instagram kartlarını üret.
        async function renderInstagramFeed() {
            const container = document.getElementById('instagram-posts');
            if (!container) return;
            const feedUrl = 'https://feeds.behold.so/K5bU1eZaLfTkkRePQJoP';
            const instagramHome = 'https://www.instagram.com/acisunited';
            const safeUrl = (value, allowedHost) => {
                try {
                    const url = new URL(value);
                    return url.protocol === 'https:' && allowedHost(url.hostname) ? url.href : '';
                } catch (_) { return ''; }
            };
            const safePermalink = value => safeUrl(value, host => host === 'instagram.com' || host === 'www.instagram.com') || instagramHome;
            const safeMediaUrl = value => safeUrl(value, host => host.endsWith('cdninstagram.com') || host.endsWith('behold.pictures'));

            try {
                const response = await fetch(feedUrl, { cache: 'no-store' });
                if (!response.ok) throw new Error('Instagram akışı alınamadı');
                const feed = await response.json();
                const posts = (Array.isArray(feed) ? feed : feed.posts || [])
                    .filter(post => post && post.visibility !== 'hidden')
                    .slice(0, 6);
                if (!posts.length) {
                    container.innerHTML = '<p class="col-span-full text-center text-gray-400">Henüz Instagram gönderisi bulunmuyor.</p>';
                    return;
                }
                container.replaceChildren();
                posts.forEach((post, index) => {
                    const item = post.mediaType === 'CAROUSEL_ALBUM' && Array.isArray(post.children) && post.children.length ? post.children[0] : post;
                    const card = document.createElement('a');
                    card.href = safePermalink(post.permalink);
                    card.target = '_blank';
                    card.rel = 'noopener noreferrer';
                    card.className = 'glass-panel rounded-2xl overflow-hidden group hover:-translate-y-1 transition-all duration-300 block border border-white/10';

                    const mediaBox = document.createElement('div');
                    mediaBox.className = 'aspect-square bg-bordo/10 overflow-hidden relative flex items-center justify-center';
                    const poster = safeMediaUrl(item.sizes?.large?.mediaUrl || item.sizes?.medium?.mediaUrl || item.mediaUrl || post.mediaUrl);
                    const videoUrl = post.mediaType === 'VIDEO' ? safeMediaUrl(post.mediaUrl) : '';
                    if (videoUrl) {
                        const video = document.createElement('video');
                        video.src = videoUrl;
                        if (poster) video.poster = poster;
                        video.muted = true;
                        video.loop = true;
                        video.autoplay = true;
                        video.playsInline = true;
                        video.className = 'w-full h-full object-cover';
                        mediaBox.appendChild(video);
                    } else if (poster) {
                        const image = document.createElement('img');
                        image.src = poster;
                        image.alt = 'Acısu United Instagram gönderisi';
                        image.loading = index < 3 ? 'eager' : 'lazy';
                        image.className = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500';
                        image.onerror = () => image.remove();
                        mediaBox.appendChild(image);
                    } else {
                        mediaBox.classList.add('text-altin', 'text-5xl');
                        mediaBox.textContent = '⚽';
                    }

                    const overlay = document.createElement('div');
                    overlay.className = 'absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center';
                    const label = document.createElement('span');
                    label.className = 'bg-bordo text-white font-bold px-4 py-2 rounded-xl text-sm shadow-lg';
                    label.textContent = "Instagram'da Gör";
                    overlay.appendChild(label);
                    mediaBox.appendChild(overlay);

                    const details = document.createElement('div');
                    details.className = 'p-5';
                    const caption = document.createElement('p');
                    caption.className = 'text-gray-300 text-sm mb-3';
                    const captionText = (post.prunedCaption || post.caption || '').trim();
                    caption.textContent = captionText.length > 180 ? captionText.slice(0, 177) + '…' : (captionText || 'Acısu United Instagram gönderisi');
                    const date = document.createElement('span');
                    date.className = 'text-altin text-xs font-bold uppercase tracking-widest';
                    const parsedDate = post.timestamp ? new Date(post.timestamp) : null;
                    date.textContent = parsedDate && !Number.isNaN(parsedDate.getTime())
                        ? parsedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Acısu United';
                    details.append(caption, date);
                    card.append(mediaBox, details);
                    container.appendChild(card);
                });
            } catch (error) {
                container.innerHTML = '<p class="col-span-full text-center text-gray-400">Instagram akışı şu an yüklenemedi. Gönderileri <a class="text-altin font-bold" href="https://www.instagram.com/acisunited" target="_blank" rel="noopener noreferrer">@acisunited</a> hesabımızda görebilirsin.</p>';
                console.warn('Instagram akışı yüklenemedi:', error);
            }
        }
        renderInstagramFeed();

        // Navbar scroll efekti
        window.addEventListener('scroll', () => {
            const nav = document.getElementById('navbar');
            if (window.scrollY > 50) {
                nav.classList.add('bg-siyah/95', 'shadow-lg');
                nav.classList.remove('glass-panel');
            } else {
                nav.classList.remove('bg-siyah/95', 'shadow-lg');
                nav.classList.add('glass-panel');
            }
        });

        // İlk görünümü çiz; veritabanı yüklenince kartlar yenilenir.
        renderSquad();
        renderCoach();
    