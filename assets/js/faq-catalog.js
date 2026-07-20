// Renders the FAQ list on faq.html from the backend, admin-managed
// instead of hardcoded HTML. Rebuilds its own click-to-expand handlers
// since these elements don't exist yet at DOMContentLoaded time.
document.addEventListener('DOMContentLoaded', async function () {
    const container = document.getElementById('faqList');
    if (!container) return; // not on this page

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/faq`);
        if (!res.ok) throw new Error('Failed to load FAQ');
        const result = await res.json();
        const items = result.data || [];

        if (items.length === 0) {
            container.innerHTML = '<p class="text-center text-sm text-gray-400 py-8">No FAQs yet - contact us via WhatsApp with any questions.</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="faq-item bg-white rounded-xl p-5 cursor-pointer hover-lift">
                <div class="flex justify-between items-center font-medium text-dark">
                    ${escapeHTML(item.question)}
                    <span class="faq-icon text-gold text-lg transition-transform">+</span>
                </div>
                <div class="faq-answer hidden mt-3 text-[#333333] text-sm leading-relaxed">
                    ${escapeHTML(item.answer)}
                </div>
            </div>
        `).join('');

        // Same accordion behavior as before, just attached after render
        container.querySelectorAll('.faq-item').forEach(item => {
            item.addEventListener('click', function () {
                const answer = this.querySelector('.faq-answer');
                const icon = this.querySelector('.faq-icon');
                const isHidden = answer.classList.contains('hidden');
                answer.classList.toggle('hidden');
                icon.textContent = isHidden ? '\u2212' : '+';
                icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        });

    } catch (err) {
        console.error('Failed to load FAQ:', err);
        container.innerHTML = '<p class="text-center text-sm text-gray-400 py-8">Unable to load FAQ right now.</p>';
    }
});