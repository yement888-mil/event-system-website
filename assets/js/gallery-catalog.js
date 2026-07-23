// Renders the gallery on gallery.html from the backend, with dynamic
// category filter buttons built from whatever categories actually exist
// in the data (instead of hardcoded categories that could drift out of
// sync with what the admin has actually added).
document.addEventListener('DOMContentLoaded', async function () {
    const grid = document.getElementById('galleryGrid');
    const filtersEl = document.getElementById('galleryFilters');
    if (!grid) return; // not on this page

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    let items = [];

    function renderFilters() {
        const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
        if (categories.length === 0) {
            filtersEl.innerHTML = '';
            return;
        }
        filtersEl.innerHTML = `
            <button class="filter-btn bg-dark text-white px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap" data-filter="all">All</button>
            ${categories.map(cat => `
                <button class="filter-btn bg-white text-dark border border-gray-200 px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap" data-filter="${escapeHTML(cat)}">${escapeHTML(cat)}</button>
            `).join('')}
        `;
        filtersEl.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                filtersEl.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('bg-dark', 'text-white');
                    b.classList.add('bg-white', 'text-dark', 'border', 'border-gray-200');
                });
                this.classList.add('bg-dark', 'text-white');
                this.classList.remove('bg-white', 'border', 'border-gray-200');
                renderGrid(this.dataset.filter);
            });
        });
    }

    function renderGrid(filter = 'all') {
        const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);
        if (filtered.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center text-sm text-gray-400 py-8">No photos in this category yet.</p>';
            return;
        }
        grid.innerHTML = filtered.map(item => `
            <div class="gallery-item rounded-xl overflow-hidden aspect-square">
                <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.alt_text || item.title || 'Gallery photo')}" class="w-full h-full object-cover" loading="lazy">
            </div>
        `).join('');
    }

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/gallery`);
        if (!res.ok) throw new Error('Failed to load gallery');
        const result = await res.json();
        items = result.data || [];

        if (items.length === 0) {
            filtersEl.innerHTML = '';
            grid.innerHTML = '<p class="col-span-full text-center text-sm text-gray-400 py-8">Gallery coming soon - check back shortly, or contact us to see recent work.</p>';
            return;
        }

        renderFilters();
        renderGrid('all');

    } catch (err) {
        console.error('Failed to load gallery:', err);
        grid.innerHTML = '<p class="col-span-full text-center text-sm text-gray-400 py-8">Unable to load gallery right now.</p>';
    }
});