// Renders the public services catalog on services.html from the backend,
// so prices/descriptions can be managed by the admin without editing code.
document.addEventListener('DOMContentLoaded', async function () {
    const container = document.getElementById('servicesList');
    if (!container) return; // not on this page

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/services`);
        if (!res.ok) throw new Error('Failed to load services');
        const result = await res.json();
        const services = result.data || [];

        if (services.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-sm text-gray-400">Services coming soon - contact us for details.</div>';
            return;
        }

        container.innerHTML = services.map(s => `
            <div class="bg-white p-6 rounded-2xl hover-lift">
                <div class="flex items-start gap-4">
                    ${s.image_url ? `<img src="${escapeHTML(s.image_url)}" alt="${escapeHTML(s.name)}" class="w-16 h-16 rounded-xl object-cover flex-shrink-0">` : '<span class="text-gold text-2xl mt-1">&#10022;</span>'}
                    <div>
                        <h3 class="font-semibold text-dark text-lg">${escapeHTML(s.name)}</h3>
                        ${s.description ? `<p class="text-[#333333] text-sm mt-1 leading-relaxed">${escapeHTML(s.description)}</p>` : ''}
                        ${s.managed_by ? `<span class="inline-block mt-3 text-xs text-gold border border-gold px-3 py-1 rounded-full">${escapeHTML(s.managed_by)}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load services:', err);
        container.innerHTML = '<div class="text-center py-8 text-sm text-gray-400">Unable to load services right now - please contact us via WhatsApp.</div>';
    }
});