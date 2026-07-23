// Sprint 7, Epic K - testimonial moderation queue. Same file-per-concern
// convention established by the Sprint 5 tool.html split.

function renderStars(rating) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

const TESTIMONIAL_STATUS_BADGE = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700'
};

async function loadTestimonials() {
    const el = document.getElementById('testimonialsList');
    if (!el) return;
    el.innerHTML = '<p class="text-sm text-gray-400">Loading...</p>';

    try {
        const status = document.getElementById('testimonialStatusFilter')?.value || '';
        const res = await fetch(`${CONFIG.API_URL}/api/testimonials${status ? '?status=' + status : ''}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (res.status === 401) {
            localStorage.removeItem('adminToken');
            adminToken = '';
            document.getElementById('toolContent').classList.add('hidden');
            document.getElementById('passwordGate').classList.remove('hidden');
            alert('Session expired. Please login again.');
            return;
        }
        if (!res.ok) throw new Error('Failed to load testimonials');

        const result = await res.json();
        const rows = result.data || [];

        if (rows.length === 0) {
            el.innerHTML = '<p class="text-sm text-gray-400">Nothing here.</p>';
            return;
        }

        el.innerHTML = rows.map(t => `
            <div class="border rounded-xl p-4">
                <div class="flex justify-between items-start">
                    <div>
                        <strong>${escapeHTML(t.customer_name)}</strong>
                        <span class="text-xs text-gray-400 ml-2">${escapeHTML(t.quotation_no || '-')}</span>
                        <div class="text-gold text-sm mt-0.5">${renderStars(t.rating)}</div>
                    </div>
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium ${TESTIMONIAL_STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-600'}">${escapeHTML(t.status)}</span>
                </div>
                <p class="text-sm text-gray-700 mt-2">${escapeHTML(t.body)}</p>
                <div class="text-xs text-gray-400 mt-2">Submitted ${formatDateTime(t.submitted_at)}</div>
                <div class="flex gap-2 mt-3">
                    ${t.status !== 'approved' ? `<button onclick="updateTestimonialStatus(${t.id}, 'approved')" class="bg-gold text-dark px-3 py-1 rounded text-xs font-medium hover:bg-yellow-600 transition">Approve</button>` : ''}
                    ${t.status !== 'rejected' ? `<button onclick="updateTestimonialStatus(${t.id}, 'rejected')" class="border border-gray-300 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-100 transition">Reject</button>` : ''}
                    <button onclick="deleteTestimonial(${t.id})" class="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition">Delete</button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Load testimonials error:', err);
        el.innerHTML = '<p class="text-sm text-red-500">Failed to load.</p>';
    }
}

async function updateTestimonialStatus(id, status) {
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/testimonials/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ status })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update testimonial');
        }
        await loadTestimonials();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function deleteTestimonial(id) {
    if (!confirm('Delete this testimonial? This also lets the customer submit a new one for the same booking.')) return;
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/testimonials/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete testimonial');
        }
        await loadTestimonials();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}
