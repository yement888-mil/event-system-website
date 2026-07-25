// Renders the "Latest from Instagram" slideshow on gallery.html from the
// backend's cached feed (services/instagram.js + instagramSyncScheduler.js
// on the backend - never calls Instagram directly from the browser).
// Whole section stays hidden if the integration isn't configured yet or
// the feed is empty, rather than showing an empty carousel shell.
document.addEventListener('DOMContentLoaded', async function () {
    const section = document.getElementById('instagramSlideshow');
    const track = document.getElementById('instagramTrack');
    const prevBtn = document.getElementById('igPrevBtn');
    const nextBtn = document.getElementById('igNextBtn');
    if (!section || !track) return; // not on this page

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Instagram requires attribution back to the post when its content is
    // displayed elsewhere - every slide links out via its own permalink,
    // never just embeds the raw image.
    function renderSlides(posts) {
        track.innerHTML = posts.map(post => `
            <a href="${escapeHTML(post.permalink)}" target="_blank" rel="noopener"
               class="gallery-item hover-lift flex-none w-56 sm:w-64 rounded-xl overflow-hidden aspect-square snap-start">
                <img src="${escapeHTML(post.image_url)}" alt="${escapeHTML((post.caption || 'Instagram post').slice(0, 120))}" class="w-full h-full object-cover" loading="lazy">
            </a>
        `).join('');
    }

    let autoAdvanceTimer = null;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function startAutoAdvance() {
        if (prefersReducedMotion || autoAdvanceTimer) return;
        autoAdvanceTimer = setInterval(() => {
            const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
            track.scrollBy({ left: atEnd ? -track.scrollWidth : 240, behavior: 'smooth' });
        }, 4000);
    }
    function stopAutoAdvance() {
        clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
    }

    if (prevBtn) prevBtn.addEventListener('click', () => track.scrollBy({ left: -240, behavior: 'smooth' }));
    if (nextBtn) nextBtn.addEventListener('click', () => track.scrollBy({ left: 240, behavior: 'smooth' }));
    track.addEventListener('mouseenter', stopAutoAdvance);
    track.addEventListener('mouseleave', startAutoAdvance);

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/instagram`);
        if (!res.ok) throw new Error('Failed to load Instagram feed');
        const result = await res.json();
        const posts = result.data || [];

        if (posts.length === 0) {
            section.classList.add('hidden');
            return;
        }

        renderSlides(posts);
        section.classList.remove('hidden');
        startAutoAdvance();

    } catch (err) {
        console.error('Failed to load Instagram feed:', err);
        section.classList.add('hidden');
    }
});
