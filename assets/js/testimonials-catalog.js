// Renders approved testimonials on index.html (Sprint 7, Epic K). Same
// self-contained, "not on this page, do nothing" pattern as
// gallery-catalog.js/services-catalog.js/faq-catalog.js.
document.addEventListener('DOMContentLoaded', async function () {
    const section = document.getElementById('testimonialsSection');
    const grid = document.getElementById('testimonialsGrid');
    if (!section || !grid) return; // not on this page

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderStars(rating) {
        return '★'.repeat(rating) + '☆'.repeat(5 - rating);
    }

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/testimonials/public`);
        if (!res.ok) return;

        const result = await res.json();
        const testimonials = result.data || [];

        if (testimonials.length === 0) return; // section stays hidden

        grid.innerHTML = testimonials.map(t => `
            <div class="bg-white p-6 rounded-2xl">
                <div class="text-gold text-lg mb-2">${renderStars(t.rating)}</div>
                <p class="text-[#333333] text-sm leading-relaxed mb-4">"${escapeHTML(t.body)}"</p>
                <p class="text-dark text-sm font-semibold">${escapeHTML(t.customer_name)}</p>
            </div>
        `).join('');

        section.classList.remove('hidden');

    } catch (err) {
        console.error('Load testimonials error:', err);
    }
});
