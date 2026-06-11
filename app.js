// Main dashboard script
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dateListEl = document.getElementById('dateList');
    const postsGridEl = document.getElementById('postsGrid');
    const activeDateTitleEl = document.getElementById('activeDateTitle');
    const postsCountEl = document.getElementById('postsCount');
    const searchInput = document.getElementById('searchInput');
    const topicFiltersContainer = document.getElementById('topicFilters');
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
    let datesList = [];
    let currentSelectedDate = '';
    let currentPosts = [];
    let currentFilterTopic = 'all';
    let currentSearchQuery = '';
    let currentGalleryImages = [];
    let currentGalleryIndex = 0;

    // Helper: Formatter for timestamps
    function formatTimeAgo(utcSeconds) {
        if (!utcSeconds) return '';
        const postDate = new Date(utcSeconds * 1000);
        const now = new Date();
        const diffMs = now - postDate;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffHrs < 1) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
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
        if (score >= 1000) {
            return (score / 1000).toFixed(1) + 'k';
        }
        return score;
    }

    // Format Date string for UI (e.g. 2026-06-11 -> 11 Th06, 2026)
    function formatDateString(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]} Tháng ${parts[1]}, ${parts[0]}`;
    }

    // Initialize sidebar
    async function loadManifest() {
        try {
            const response = await fetch('data/manifest.json?t=' + Date.now());
            if (!response.ok) throw new Error('Cannot load manifest');
            
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
            renderError('Không thể tải danh sách ngày cào bài. Hãy kiểm tra file manifest.json.');
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
                // Close sidebar on mobile
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
        postsGridEl.innerHTML = `
            <div class="empty-state glass">
                <i class="fa-solid fa-cloud-arrow-down empty-icon"></i>
                <h3>Chưa Có Bài Viết Nào Được Cào</h3>
                <p>Hãy chạy crawler để bắt đầu cào bài viết Reddit và đẩy dữ liệu lên repo này.</p>
            </div>
        `;
    }

    // Select date and fetch posts
    async function selectDate(date) {
        currentSelectedDate = date;
        
        // Update active class in sidebar
        document.querySelectorAll('.date-item').forEach(el => {
            if (el.getAttribute('data-date') === date) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        // Set title
        activeDateTitleEl.textContent = formatDateString(date);
        
        // Show loading skeleton
        postsGridEl.innerHTML = `
            <div class="post-card-skeleton"></div>
            <div class="post-card-skeleton"></div>
            <div class="post-card-skeleton"></div>
            <div class="post-card-skeleton"></div>
        `;

        try {
            const response = await fetch(`data/scraped_${date}.json?t=` + Date.now());
            if (!response.ok) throw new Error('Cannot load posts for date ' + date);
            
            currentPosts = await response.json();
            applyFilters();
        } catch (err) {
            console.error('Error fetching posts:', err);
            renderError(`Không tìm thấy hoặc không thể đọc được file scraped_${date}.json`);
        }
    }

    // Apply Filter & Search
    function applyFilters() {
        let filtered = [...currentPosts];

        // Apply topic filter
        if (currentFilterTopic !== 'all') {
            filtered = filtered.filter(post => post.topic === currentFilterTopic);
        }

        // Apply search query
        if (currentSearchQuery) {
            const query = currentSearchQuery.toLowerCase();
            filtered = filtered.filter(post => 
                (post.title && post.title.toLowerCase().includes(query)) ||
                (post.author && post.author.toLowerCase().includes(query)) ||
                (post.subreddit && post.subreddit.toLowerCase().includes(query)) ||
                (post.selftext && post.selftext.toLowerCase().includes(query))
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
            
            // Topic label icon or badge
            if (post.topic) {
                const topicTag = document.createElement('div');
                topicTag.className = 'topic-tag';
                topicTag.title = `Chủ đề: ${post.topic}`;
                card.appendChild(topicTag);
            }

            // Upvote score
            const scoreFormatted = formatScore(post.score || 0);

            // Construct Media HTML
            let mediaHtml = '';
            if (post.is_video && post.videos && post.videos.length > 0) {
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
                        <img src="${post.images[0]}" alt="Gallery image preview" loading="lazy">
                        <div class="gallery-badge"><i class="fa-regular fa-images"></i> 1/${post.images.length}</div>
                    </div>
                `;
            } else if (post.images && post.images.length > 0) {
                mediaHtml = `
                    <div class="media-container image-mode" data-image="${post.images[0]}">
                        <img src="${post.images[0]}" alt="Post image" loading="lazy">
                    </div>
                `;
            }

            // Description rendering (with truncate / read more)
            let selftextHtml = '';
            if (post.selftext) {
                const cleanedText = post.selftext.trim();
                if (cleanedText.length > 0) {
                    selftextHtml = `
                        <div class="post-text">${cleanedText}</div>
                        <button class="read-more-btn">Đọc thêm</button>
                    `;
                }
            }

            const permalinkUrl = `https://www.reddit.com${post.permalink}`;
            const timeAgo = formatTimeAgo(post.created_utc);

            card.innerHTML += `
                <div class="post-header">
                    <span class="subreddit-badge">r/${post.subreddit}</span>
                    <div class="score-pill">
                        <i class="fa-solid fa-arrow-up"></i>
                        <span>${scoreFormatted}</span>
                    </div>
                </div>
                
                <div class="post-body">
                    <a href="${permalinkUrl}" target="_blank" class="post-title">${post.title}</a>
                    ${mediaHtml}
                    ${selftextHtml}
                </div>
                
                <div class="post-footer">
                    <a href="${permalinkUrl}" target="_blank" class="author-link">
                        <i class="fa-regular fa-user"></i>
                        <span>u/${post.author}</span>
                    </a>
                    <div class="post-time">
                        <i class="fa-regular fa-clock"></i>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            `;

            postsGridEl.appendChild(card);
        });

        // Initialize media interactions
        initMediaListeners();
    }

    function initMediaListeners() {
        // 1. Play HLS Videos
        document.querySelectorAll('.reddit-video').forEach(videoEl => {
            const videoSrc = videoEl.getAttribute('data-src');
            if (!videoSrc) return;

            if (Hls.isSupported() && videoSrc.includes('m3u8')) {
                const hls = new Hls();
                hls.loadSource(videoSrc);
                hls.attachMedia(videoEl);
            } else {
                // Native playback (Safari, mobile iOS, etc.)
                videoEl.src = videoSrc;
            }
        });

        // 2. Expand descriptions
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

        // 3. Image & Gallery Lightbox triggers
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
        
        // Show nav buttons if gallery has multiple images
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

    // Close lightbox on clicking backdrop
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === lightbox.querySelector('.lightbox-content')) {
            lightbox.style.display = 'none';
        }
    });

    // Keyboard navigation in lightbox
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

        // Toggle active states
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

    // Click outside sidebar on mobile to close it
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && 
            sidebar.classList.contains('open') && 
            !sidebar.contains(e.target) && 
            e.target !== menuToggle && 
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    // Render errors
    function renderError(msg) {
        postsGridEl.innerHTML = `
            <div class="empty-state glass" style="border-color: rgba(239, 68, 68, 0.2)">
                <i class="fa-solid fa-triangle-exclamation empty-icon" style="color: #ef4444"></i>
                <h3>Đã Xảy Ra Lỗi</h3>
                <p>${msg}</p>
            </div>
        `;
    }

    // Load data
    loadManifest();
});
