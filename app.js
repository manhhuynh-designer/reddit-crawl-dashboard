// Main dashboard script — Supports both Reddit Crawl & Social Trend Radar (TikTok, FB, IG, Threads)
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dateListEl = document.getElementById('dateList');
    const postsGridEl = document.getElementById('postsGrid');
    const activeDateTitleEl = document.getElementById('activeDateTitle');
    const activeDateSubEl = document.getElementById('activeDateSub');
    const postsCountEl = document.getElementById('postsCount');
    const searchInput = document.getElementById('searchInput');
    const topicFiltersContainer = document.getElementById('topicFilters');
    const trendRadarBanner = document.getElementById('trendRadarBanner');
    const brandIcon = document.getElementById('brandIcon');
    const brandTitle = document.getElementById('brandTitle');
    const modeRedditBtn = document.getElementById('modeRedditBtn');
    const modeSocialBtn = document.getElementById('modeSocialBtn');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const closeSidebar = document.getElementById('closeSidebar');
    
    // Lightbox Elements
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');

    // Global state
    let currentMode = 'reddit'; // 'reddit' | 'social'
    let datesList = [];
    let currentSelectedDate = '';
    let currentPosts = [];
    let currentSocialSummary = null;
    let currentFilterTopic = 'all';
    let currentSearchQuery = '';
    let currentGalleryImages = [];
    let currentGalleryIndex = 0;

    const REDDIT_FILTERS_HTML = `
        <button class="filter-btn active" data-topic="all">Tất cả</button>
        <button class="filter-btn" data-topic="design"><i class="fa-solid fa-pen-nib"></i> Design</button>
        <button class="filter-btn" data-topic="3d"><i class="fa-solid fa-cube"></i> 3D Art</button>
        <button class="filter-btn" data-topic="movies"><i class="fa-solid fa-film"></i> Movies/TV</button>
        <button class="filter-btn" data-topic="art"><i class="fa-solid fa-palette"></i> Art</button>
        <button class="filter-btn" data-topic="ai"><i class="fa-solid fa-microchip"></i> AI</button>
        <button class="filter-btn" data-topic="gamedev"><i class="fa-solid fa-gamepad"></i> Indie Game</button>
        <button class="filter-btn" data-topic="bip"><i class="fa-solid fa-laptop-code"></i> BIP / App</button>
    `;

    const SOCIAL_FILTERS_HTML = `
        <button class="filter-btn active" data-topic="all"><i class="fa-solid fa-layer-group"></i> Tất cả kênh</button>
        <button class="filter-btn" data-topic="tiktok"><i class="fa-brands fa-tiktok"></i> TikTok</button>
        <button class="filter-btn" data-topic="facebook"><i class="fa-brands fa-facebook"></i> Facebook</button>
        <button class="filter-btn" data-topic="instagram"><i class="fa-brands fa-instagram"></i> Instagram</button>
        <button class="filter-btn" data-topic="threads"><i class="fa-brands fa-threads"></i> Threads</button>
        <button class="filter-btn" data-topic="trending_hashtag"><i class="fa-solid fa-hashtag"></i> Hashtag Hot</button>
        <button class="filter-btn" data-topic="viral_video"><i class="fa-solid fa-clapperboard"></i> Video Viral</button>
    `;

    // Helper: Formatter for timestamps
    function formatTimeAgo(utcSeconds) {
        if (!utcSeconds) return '';
        const postDate = new Date(utcSeconds * 1000);
        const now = new Date();
        const diffMs = now - postDate;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffHrs < 1) {
            const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
            return `${diffMins} phút trước`;
        }
        if (diffHrs < 24) {
            return `${diffHrs} giờ trước`;
        }
        const diffDays = Math.floor(diffHrs / 24);
        return `${diffDays} ngày trước`;
    }

    // Helper: Format large numbers
    function formatScore(score) {
        if (!score || isNaN(score)) return '0';
        if (score >= 1000000) {
            return (score / 1000000).toFixed(1) + 'M';
        }
        if (score >= 1000) {
            return (score / 1000).toFixed(1) + 'k';
        }
        return score;
    }

    // Format Date string for UI (e.g. 2026-06-11 -> 11 Tháng 06, 2026)
    function formatDateString(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]} Tháng ${parts[1]}, ${parts[0]}`;
    }

    function switchMode(newMode) {
        if (currentMode === newMode) return;
        currentMode = newMode;
        currentFilterTopic = 'all';

        if (currentMode === 'reddit') {
            modeRedditBtn.classList.add('active');
            modeSocialBtn.classList.remove('active');
            brandIcon.className = 'fa-brands fa-reddit logo-icon';
            brandTitle.innerHTML = 'Reddit<span class="logo-accent">Crawl</span>';
            activeDateSubEl.textContent = 'Tổng quan bài viết phổ biến đã cào trên Reddit';
            topicFiltersContainer.innerHTML = REDDIT_FILTERS_HTML;
            trendRadarBanner.style.display = 'none';
        } else {
            modeSocialBtn.classList.add('active');
            modeRedditBtn.classList.remove('active');
            brandIcon.className = 'fa-solid fa-fire-flame-curved logo-icon';
            brandTitle.innerHTML = 'Trend<span class="logo-accent">Radar</span>';
            activeDateSubEl.textContent = 'Xu hướng đại chúng trên TikTok • Facebook • Instagram • Threads';
            topicFiltersContainer.innerHTML = SOCIAL_FILTERS_HTML;
        }

        loadManifest();
    }

    if (modeRedditBtn && modeSocialBtn) {
        modeRedditBtn.addEventListener('click', () => switchMode('reddit'));
        modeSocialBtn.addEventListener('click', () => switchMode('social'));
    }

    // Initialize sidebar
    async function loadManifest() {
        const manifestFile = currentMode === 'reddit' ? 'data/manifest.json' : 'data/social_manifest.json';
        try {
            const response = await fetch(manifestFile + '?t=' + Date.now());
            if (!response.ok) throw new Error('Cannot load ' + manifestFile);
            
            datesList = await response.json();
            
            // Sort dates descending
            datesList.sort((a, b) => b.localeCompare(a));
            
            if (datesList.length === 0) {
                renderEmptyHistory();
                return;
            }

            renderDateList(datesList);
            
            // Select the most recent date by default
            selectDate(datesList[0]);
        } catch (err) {
            console.error('Error loading manifest:', err);
            renderError(`Không thể tải danh sách ngày cào bài (${manifestFile}). Hãy chạy crawler trước.`);
        }
    }

    function renderDateList(dates) {
        dateListEl.innerHTML = '';
        dates.forEach(date => {
            const item = document.createElement('div');
            item.className = 'date-item';
            item.setAttribute('data-date', date);
            item.innerHTML = `
                <i class="fa-regular fa-folder-open"></i>
                <span>${formatDateString(date)}</span>
            `;
            
            item.addEventListener('click', () => {
                selectDate(date);
                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('open');
                }
            });
            
            dateListEl.appendChild(item);
        });
    }

    function renderEmptyHistory() {
        dateListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Chưa có dữ liệu bài viết</p>';
        activeDateTitleEl.textContent = 'Không có bài viết';
        trendRadarBanner.style.display = 'none';
        postsGridEl.innerHTML = `
            <div class="empty-state glass">
                <i class="fa-solid fa-cloud-arrow-down empty-icon"></i>
                <h3>Chưa Có Dữ Liệu Nào Được Cào</h3>
                <p>Hãy chạy crawler để bắt đầu thu thập dữ liệu và đẩy lên repo này.</p>
            </div>
        `;
    }

    // Select date and fetch posts
    async function selectDate(date) {
        currentSelectedDate = date;
        
        document.querySelectorAll('.date-item').forEach(el => {
            if (el.getAttribute('data-date') === date) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        activeDateTitleEl.textContent = formatDateString(date);
        
        postsGridEl.innerHTML = `
            <div class="post-card-skeleton"></div>
            <div class="post-card-skeleton"></div>
            <div class="post-card-skeleton"></div>
            <div class="post-card-skeleton"></div>
        `;

        const dataFile = currentMode === 'reddit'
            ? `data/scraped_${date}.json`
            : `data/social_trends_${date}.json`;

        try {
            const response = await fetch(`${dataFile}?t=` + Date.now());
            if (!response.ok) throw new Error('Cannot load posts for date ' + date);
            
            currentPosts = await response.json();

            if (currentMode === 'social') {
                try {
                    const sumRes = await fetch(`data/social_summary_${date}.json?t=` + Date.now());
                    currentSocialSummary = sumRes.ok ? await sumRes.json() : null;
                } catch (_) {
                    currentSocialSummary = null;
                }
                renderSocialTrendBanner();
            } else {
                trendRadarBanner.style.display = 'none';
            }

            applyFilters();
        } catch (err) {
            console.error('Error fetching posts:', err);
            renderError(`Không tìm thấy hoặc không thể đọc được file ${dataFile}`);
        }
    }

    function renderSocialTrendBanner() {
        if (currentMode !== 'social' || !currentSocialSummary) {
            trendRadarBanner.style.display = 'none';
            return;
        }

        const counts = currentSocialSummary.platform_counts || {};
        const hashtags = currentSocialSummary.top_hashtags || [];
        const keywords = currentSocialSummary.top_keywords || [];

        const tagsHtml = hashtags.slice(0, 10).map(h =>
            `<span class="trend-chip" data-tag="${h.tag}">${h.tag} (${h.count})</span>`
        ).join('');

        const kwHtml = keywords.slice(0, 8).map(k =>
            `<span class="trend-chip" style="background:rgba(59,130,246,0.15);border-color:rgba(59,130,246,0.35);color:#bfdbfe" data-tag="${k.word}">${k.word}</span>`
        ).join('');

        trendRadarBanner.style.display = 'flex';
        trendRadarBanner.innerHTML = `
            <div class="trend-radar-header">
                <div class="trend-radar-title">
                    <i class="fa-solid fa-wand-magic-sparkles" style="color: #ec4899;"></i>
                    <span>AI Trend Radar — Tổng Hợp Điểm Nóng Đa Kênh</span>
                </div>
                <div class="trend-counts-row">
                    <span class="plat-stat-pill"><i class="fa-brands fa-tiktok"></i> TikTok: ${counts.tiktok || 0}</span>
                    <span class="plat-stat-pill"><i class="fa-brands fa-facebook"></i> FB: ${counts.facebook || 0}</span>
                    <span class="plat-stat-pill"><i class="fa-brands fa-instagram"></i> IG: ${counts.instagram || 0}</span>
                    <span class="plat-stat-pill"><i class="fa-brands fa-threads"></i> Threads: ${counts.threads || 0}</span>
                </div>
            </div>
            <div class="trend-tags-row">
                <strong style="font-size:0.8rem;color:var(--text-secondary);">🔥 Hashtags & Chủ đề:</strong>
                ${tagsHtml}
                ${kwHtml}
            </div>
        `;

        trendRadarBanner.querySelectorAll('.trend-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const tag = chip.getAttribute('data-tag') || '';
                searchInput.value = tag;
                currentSearchQuery = tag;
                applyFilters();
            });
        });
    }

    // Apply Filter & Search
    function applyFilters() {
        let filtered = [...currentPosts];

        if (currentFilterTopic !== 'all') {
            if (currentMode === 'social') {
                if (['tiktok', 'facebook', 'instagram', 'threads'].includes(currentFilterTopic)) {
                    filtered = filtered.filter(post => post.platform === currentFilterTopic || post.topic === currentFilterTopic);
                } else {
                    filtered = filtered.filter(post => post.category === currentFilterTopic);
                }
            } else {
                filtered = filtered.filter(post => post.topic === currentFilterTopic);
            }
        }

        if (currentSearchQuery) {
            const query = currentSearchQuery.toLowerCase();
            filtered = filtered.filter(post => 
                (post.title && post.title.toLowerCase().includes(query)) ||
                (post.author && post.author.toLowerCase().includes(query)) ||
                (post.subreddit && post.subreddit.toLowerCase().includes(query)) ||
                (post.selftext && post.selftext.toLowerCase().includes(query)) ||
                (post.trend_tags && post.trend_tags.some(t => t.toLowerCase().includes(query)))
            );
        }

        postsCountEl.textContent = filtered.length;
        renderPosts(filtered);
    }

    // Render post cards
    function renderPosts(posts) {
        postsGridEl.innerHTML = '';

        if (posts.length === 0) {
            postsGridEl.innerHTML = `
                <div class="empty-state glass">
                    <i class="fa-solid fa-ban empty-icon"></i>
                    <h3>Không Tìm Thấy Kết Quả</h3>
                    <p>Không có bài viết nào khớp với bộ lọc hoặc từ khóa tìm kiếm của bạn.</p>
                </div>
            `;
            return;
        }

        posts.forEach(post => {
            const card = document.createElement('article');
            card.className = 'post-card glass';
            
            if (post.topic) {
                const topicTag = document.createElement('div');
                topicTag.className = 'topic-tag';
                topicTag.title = `Chủ đề: ${post.topic}`;
                card.appendChild(topicTag);
            }

            const scoreFormatted = formatScore(post.score || 0);
            const isExternalSocial = currentMode === 'social' || (post.permalink && post.permalink.startsWith('http'));
            const permalinkUrl = isExternalSocial
                ? (post.url || post.permalink || '#')
                : `https://www.reddit.com${post.permalink}`;
            const badgeText = isExternalSocial
                ? (post.subreddit || (post.platform ? post.platform.toUpperCase() : 'TREND'))
                : `r/${post.subreddit}`;
            const authorLabel = isExternalSocial ? `@${post.author}` : `u/${post.author}`;
            const scoreLabel = (currentMode === 'social' && post.pct_score)
                ? `🔥 Top ${post.pct_score}% • ${scoreFormatted}`
                : scoreFormatted;

            // Construct Media HTML
            let mediaHtml = '';
            if (currentMode === 'social' && post.is_video) {
                const video = (post.videos && post.videos[0]) || {};
                const posterImg = video.poster || (post.images && post.images[0]) || '';
                const platformName = post.platform ? post.platform.toUpperCase() : 'MẠNG XÃ HỘI';
                const isTikTok = post.platform === 'tiktok' || permalinkUrl.includes('tiktok.com');
                const actionLabel = isTikTok
                    ? `▶ Phát trực tiếp (${platformName})`
                    : `▶ Mở Mini-Player (${platformName})`;
                if (posterImg) {
                    mediaHtml = `
                        <div class="media-container video-preview-mode" data-video-url="${permalinkUrl}" data-platform="${post.platform || ''}" data-poster="${posterImg}" title="Bấm để phát video">
                            <img src="${posterImg}" alt="Video thumbnail" loading="lazy" onerror="this.style.display='none'">
                            <div class="video-play-overlay">
                                <div class="play-icon-circle"><i class="fa-solid fa-play"></i></div>
                                <span class="play-label">${actionLabel}</span>
                            </div>
                        </div>
                    `;
                }
            } else if (post.is_video && post.videos && post.videos.length > 0) {
                const video = post.videos[0];
                mediaHtml = `
                    <div class="media-container video-mode">
                        <video controls preload="metadata" poster="${video.poster || ''}" id="video-${post.created_utc || Math.random()}" class="reddit-video" data-src="${video.src}">
                            Trình duyệt của bạn không hỗ trợ tag video.
                        </video>
                    </div>
                `;
            } else if (post.is_gallery && post.images && post.images.length > 0) {
                mediaHtml = `
                    <div class="media-container gallery-mode" data-images='${JSON.stringify(post.images)}'>
                        <img src="${post.images[0]}" alt="Gallery image preview" loading="lazy" onerror="this.style.display='none'">
                        <div class="gallery-badge"><i class="fa-regular fa-images"></i> 1/${post.images.length}</div>
                    </div>
                `;
            } else if (post.images && post.images.length > 0) {
                mediaHtml = `
                    <div class="media-container image-mode" data-image="${post.images[0]}">
                        <img src="${post.images[0]}" alt="Post image" loading="lazy" onerror="this.style.display='none'">
                    </div>
                `;
            }

            // Description rendering
            let selftextHtml = '';
            const bodyText = post.selftext || post.text || '';
            if (bodyText) {
                const cleanedText = bodyText.trim();
                if (cleanedText.length > 0 && cleanedText !== post.title) {
                    selftextHtml = `
                        <div class="post-text">${cleanedText}</div>
                        <button class="read-more-btn">Đọc thêm</button>
                    `;
                }
            }

            const timeAgo = formatTimeAgo(post.created_utc);

            card.innerHTML += `
                <div class="post-header">
                    <span class="subreddit-badge">${badgeText}</span>
                    <div class="score-pill">
                        <i class="fa-solid ${currentMode === 'social' ? 'fa-heart' : 'fa-arrow-up'}"></i>
                        <span>${scoreLabel}</span>
                    </div>
                </div>
                
                <div class="post-body">
                    <a href="${permalinkUrl}" target="_blank" rel="noopener noreferrer" class="post-title">${post.title}</a>
                    ${mediaHtml}
                    ${selftextHtml}
                </div>
                
                <div class="post-footer">
                    <a href="${permalinkUrl}" target="_blank" rel="noopener noreferrer" class="author-link">
                        <i class="fa-regular fa-user"></i>
                        <span>${authorLabel}</span>
                    </a>
                    <div class="post-time">
                        <i class="fa-regular fa-clock"></i>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            `;

            postsGridEl.appendChild(card);
        });

        initMediaListeners();
    }

    async function playSocialVideoInPlace(container) {
        if (container.getAttribute('data-playing') === 'true') return;
        const postUrl = container.getAttribute('data-video-url') || '';
        const platform = container.getAttribute('data-platform') || '';
        const posterImg = container.getAttribute('data-poster') || '';
        const videoIdMatch = postUrl.match(/\/video\/(\d+)/);
        const tiktokVideoId = videoIdMatch ? videoIdMatch[1] : null;

        if (platform === 'tiktok' || tiktokVideoId) {
            container.setAttribute('data-playing', 'true');
            container.style.maxHeight = '440px';
            container.style.cursor = 'default';
            const labelEl = container.querySelector('.play-label');
            if (labelEl) {
                labelEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải luồng MP4...';
            }

            const renderIframeFallback = () => {
                if (tiktokVideoId) {
                    container.innerHTML = `
                        <iframe src="https://www.tiktok.com/player/v1/${tiktokVideoId}?autoplay=1&rel=0"
                            style="width:100%;height:380px;border:none;border-radius:12px;background:#000;"
                            allow="autoplay; fullscreen; encrypted-media"></iframe>
                    `;
                } else {
                    window.open(postUrl, '_blank');
                }
            };

            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 4500);
                const resp = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(postUrl)}`, {
                    signal: controller.signal
                });
                clearTimeout(timer);
                const json = await resp.json();
                const streamUrl = json?.data?.play || json?.data?.wmplay;

                if (streamUrl) {
                    container.innerHTML = `
                        <div style="width:100%;display:flex;flex-direction:column;gap:6px;">
                            <video src="${streamUrl}" poster="${posterImg}" controls autoplay playsinline
                                style="width:100%;max-height:360px;border-radius:12px;background:#000;outline:none;"></video>
                            <div style="display:flex;justify-content:space-between;padding:2px 6px;font-size:0.75rem;">
                                <a href="${streamUrl}" target="_blank" rel="noopener" style="color:#34d399;text-decoration:none;font-weight:600;">
                                    <i class="fa-solid fa-download"></i> Tải MP4 (Không logo)
                                </a>
                                <a href="${postUrl}" target="_blank" rel="noopener" style="color:#94a3b8;text-decoration:none;">
                                    Mở bài gốc ↗
                                </a>
                            </div>
                        </div>
                    `;
                    const vidEl = container.querySelector('video');
                    if (vidEl) {
                        vidEl.addEventListener('error', () => renderIframeFallback());
                    }
                    return;
                }
            } catch (_) {
                // Fallback to official embed player v1
            }

            renderIframeFallback();
            return;
        }

        // For Instagram / Facebook / Threads: Open compact centered Mini-Player Popup
        const w = 480;
        const h = 760;
        const left = Math.max(0, Math.round((window.screen.width - w) / 2));
        const top = Math.max(0, Math.round((window.screen.height - h) / 2));
        window.open(
            postUrl,
            'SocialMiniPlayer',
            `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
    }

    function initMediaListeners() {
        document.querySelectorAll('.reddit-video').forEach(videoEl => {
            const videoSrc = videoEl.getAttribute('data-src');
            if (!videoSrc) return;

            if (typeof Hls !== 'undefined' && Hls.isSupported() && videoSrc.includes('m3u8')) {
                const hls = new Hls();
                hls.loadSource(videoSrc);
                hls.attachMedia(videoEl);
            } else {
                videoEl.src = videoSrc;
            }
        });

        document.querySelectorAll('.media-container.video-preview-mode').forEach(container => {
            container.addEventListener('click', () => playSocialVideoInPlace(container));
        });

        document.querySelectorAll('.post-card').forEach(card => {
            const btn = card.querySelector('.read-more-btn');
            const text = card.querySelector('.post-text');
            if (btn && text) {
                btn.addEventListener('click', () => {
                    const isExpanded = text.classList.toggle('expanded');
                    btn.textContent = isExpanded ? 'Thu gọn' : 'Đọc thêm';
                });
            }
        });

        document.querySelectorAll('.media-container.image-mode, .media-container.gallery-mode').forEach(container => {
            container.addEventListener('click', () => {
                if (container.classList.contains('gallery-mode')) {
                    const images = JSON.parse(container.getAttribute('data-images'));
                    openLightbox(images, 0);
                } else {
                    const imgUrl = container.getAttribute('data-image');
                    openLightbox([imgUrl], 0);
                }
            });
        });
    }

    // Lightbox modal operations
    function openLightbox(images, index) {
        currentGalleryImages = images;
        currentGalleryIndex = index;
        lightbox.style.display = 'flex';
        updateLightboxImage();
        
        if (images.length > 1) {
            lightboxPrev.style.display = 'block';
            lightboxNext.style.display = 'block';
        } else {
            lightboxPrev.style.display = 'none';
            lightboxNext.style.display = 'none';
        }
    }

    function updateLightboxImage() {
        lightboxImg.src = currentGalleryImages[currentGalleryIndex];
    }

    lightboxClose.addEventListener('click', () => {
        lightbox.style.display = 'none';
    });

    lightboxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
        updateLightboxImage();
    });

    lightboxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryImages.length;
        updateLightboxImage();
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === lightbox.querySelector('.lightbox-content')) {
            lightbox.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (lightbox.style.display === 'flex') {
            if (e.key === 'Escape') lightbox.style.display = 'none';
            if (e.key === 'ArrowLeft' && currentGalleryImages.length > 1) {
                lightboxPrev.click();
            }
            if (e.key === 'ArrowRight' && currentGalleryImages.length > 1) {
                lightboxNext.click();
            }
        }
    });

    // Filter by Search Query
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearchQuery = e.target.value;
            applyFilters();
        }, 300);
    });

    // Filter by Topic tags
    topicFiltersContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;

        document.querySelectorAll('.filter-btn').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');

        currentFilterTopic = btn.getAttribute('data-topic');
        applyFilters();
    });

    // Mobile Sidebar controls
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('open');
    });

    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && 
            sidebar.classList.contains('open') && 
            !sidebar.contains(e.target) && 
            e.target !== menuToggle && 
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    function renderError(msg) {
        postsGridEl.innerHTML = `
            <div class="empty-state glass" style="border-color: rgba(239, 68, 68, 0.2)">
                <i class="fa-solid fa-triangle-exclamation empty-icon" style="color: #ef4444"></i>
                <h3>Đã Xảy Ra Lỗi</h3>
                <p>${msg}</p>
            </div>
        `;
    }

    // Load initial data
    loadManifest();
});
