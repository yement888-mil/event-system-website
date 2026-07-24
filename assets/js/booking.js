// Extracted from booking.html's inline <script> (Sprint 7, Epic L -
// strict CSP follow-up: this page's script-src can now drop
// unsafe-inline). Behavior is unchanged from the original except for the
// wiring itself (onclick= attributes -> addEventListener, since inline
// event handlers are exactly what unsafe-inline was covering); the new
// testimonial section (Sprint 7, Epic K) is additive.

const STATUS_LABELS = {
    draft: 'Quotation Draft',
    sent: 'Quotation Sent',
    waiting_deposit: 'Waiting for Deposit',
    deposit_paid: 'Confirmed - Deposit Paid',
    completed: 'Event Completed',
    cancelled: 'Cancelled'
};

let selectedRating = 0;

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sprint 7, Epic K - five clickable stars, no external rating widget
// needed for something this simple. selectedRating is read by
// submitTestimonial() below.
function renderStarRating() {
    const container = document.getElementById('starRating');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'star-btn';
        btn.textContent = '★';
        btn.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''}`);
        btn.addEventListener('click', () => {
            selectedRating = i;
            container.querySelectorAll('.star-btn').forEach((el, idx) => {
                el.classList.toggle('selected', idx < selectedRating);
            });
        });
        container.appendChild(btn);
    }
}

async function loadBooking() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('notFoundState').classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/quotation/booking/${token}`);
        if (!res.ok) throw new Error('Not found');

        const result = await res.json();
        const b = result.data;
        window.__bookingToken = token;

        document.getElementById('quotationNo').textContent = b.quotation_no || '';
        document.getElementById('customerName').textContent = b.customer_name || '-';
        document.getElementById('eventType').textContent = b.event_type || '-';
        document.getElementById('eventDate').textContent = formatDate(b.event_date);
        document.getElementById('guestCount').textContent = (b.guest_count || '-') + ' pax';

        const badge = document.getElementById('statusBadge');
        badge.className = 'status-badge status-' + (b.status || 'draft');
        badge.textContent = STATUS_LABELS[b.status] || 'Processing';

        let items = b.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { items = []; }
        }
        const servicesList = document.getElementById('servicesList');
        if (Array.isArray(items) && items.length > 0) {
            servicesList.innerHTML = items.map(i =>
                `<div class="flex justify-between"><span>${escapeHTML(i.name)}</span><span>RM ${Number(i.price).toFixed(2)}</span></div>`
            ).join('');
        } else {
            servicesList.innerHTML = '<p class="text-gray-400">No services listed</p>';
        }

        document.getElementById('totalAmount').textContent = `RM ${Number(b.total || 0).toFixed(2)}`;
        document.getElementById('depositAmount').textContent = `RM ${Number(b.deposit || 0).toFixed(2)}`;
        document.getElementById('balanceAmount').textContent = `RM ${Number(b.balance || 0).toFixed(2)}`;

        if (b.inquiry_status === 'cancel_requested') {
            document.getElementById('cancelRequestedNote').classList.remove('hidden');
        } else if (b.status === 'cancelled') {
            document.getElementById('cancelledNote').classList.remove('hidden');
        } else if (b.status === 'deposit_paid' || b.status === 'completed') {
            document.getElementById('confirmedNote').classList.remove('hidden');
        } else {
            document.getElementById('depositNote').classList.remove('hidden');

            // Feature 4 - show the "already acknowledged" note if this
            // customer already checked the box on a previous visit,
            // otherwise show the checkbox + button form.
            if (b.deposit_ack_at) {
                const noteEl = document.getElementById('depositAckedNote');
                noteEl.textContent = `You acknowledged our deposit policy on ${formatDate(b.deposit_ack_at)}.`;
                noteEl.classList.remove('hidden');
            } else {
                document.getElementById('depositAckSection').classList.remove('hidden');
            }
        }

        // Only offer the cancel-request/change-request options if
        // this booking isn't already cancelled, completed, or
        // already pending a cancellation review.
        const cancellableStates = ['cancelled', 'completed', 'cancel_requested'];
        if (b.withdraw_token && !cancellableStates.includes(b.inquiry_status) && b.status !== 'completed' && b.status !== 'cancelled') {
            window.__withdrawToken = b.withdraw_token;
            document.getElementById('requestCancelSection').classList.remove('hidden');

            // BAU backlog #15
            document.getElementById('requestChangeSection').classList.remove('hidden');
            const pending = b.pending_change_requests || [];
            if (pending.length > 0) {
                const noteEl = document.getElementById('pendingChangeRequestsNote');
                noteEl.innerHTML = pending.map(r =>
                    r.request_type === 'date_change'
                        ? `We're reviewing your request to change the date to ${formatDate(r.requested_date)}.`
                        : `We're reviewing your request to add "${escapeHTML(r.requested_service)}".`
                ).join('<br>');
                noteEl.classList.remove('hidden');

                // Don't offer a second request of the same type
                // while one is already pending review.
                const pendingTypes = pending.map(r => r.request_type);
                if (pendingTypes.includes('date_change')) document.getElementById('requestDateChangeBtn').classList.add('hidden');
                if (pendingTypes.includes('add_service')) document.getElementById('requestAddServiceBtn').classList.add('hidden');
            }
        }

        // Sprint 7, Epic K - review section only once the event is
        // actually completed; has_testimonial (server-reported, from a
        // real EXISTS check against the testimonials table) picks
        // between the form and the thank-you message.
        if (b.status === 'completed') {
            document.getElementById('testimonialSection').classList.remove('hidden');
            if (b.has_testimonial) {
                document.getElementById('testimonialForm').classList.add('hidden');
                document.getElementById('testimonialThanks').classList.remove('hidden');
            }
        }

        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('bookingContent').classList.remove('hidden');

    } catch (err) {
        console.error('Booking load error:', err);
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('notFoundState').classList.remove('hidden');
    }
}

async function requestCancellation() {
    const token = window.__withdrawToken;
    if (!token) return;

    if (!confirm('Request cancellation of this booking? Our team will review and confirm with you.')) return;

    const btn = document.getElementById('requestCancelBtn');
    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Sending request...'; }

        const res = await fetch(`${CONFIG.API_URL}/api/inquiry/withdraw/${token}`, {
            method: 'POST'
        });
        const result = await res.json();

        alert(result.message || 'Request sent.');
        document.getElementById('requestCancelSection').classList.add('hidden');
        loadBooking();

    } catch (err) {
        alert('Something went wrong. Please contact us via WhatsApp.');
        if (btn) { btn.disabled = false; btn.textContent = 'Need to cancel this booking?'; }
    }
}

// BAU backlog #15 - extends the cancellation-request pattern above
// to date-change/add-service requests. Same token, same "notify
// only, never applied automatically" behavior.
function toggleChangeForm(type) {
    const formId = type === 'date_change' ? 'dateChangeForm' : 'addServiceForm';
    document.getElementById(formId).classList.toggle('hidden');
}

async function submitChangeRequest(type) {
    const token = window.__withdrawToken;
    if (!token) return;

    const payload = { type };
    if (type === 'date_change') {
        const date = document.getElementById('requestedDateInput').value;
        if (!date) { alert('Please pick a date'); return; }
        payload.requested_date = date;
        payload.customer_note = document.getElementById('dateChangeNoteInput').value.trim();
    } else {
        const service = document.getElementById('requestedServiceInput').value.trim();
        if (!service) { alert('Please enter a service'); return; }
        payload.requested_service = service;
        payload.customer_note = document.getElementById('addServiceNoteInput').value.trim();
    }

    if (!confirm('Submit this request? Our team will review and confirm with you.')) return;

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/inquiry/request-change/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to submit request');

        alert(result.message || 'Request sent.');
        loadBooking();

    } catch (err) {
        alert(err.message || 'Something went wrong. Please contact us via WhatsApp.');
    }
}

// Sprint 7, Epic K - submits the review via the booking_token (not
// withdraw_token - a different token, see routes/quotationBooking.js).
async function submitTestimonial() {
    const token = window.__bookingToken;
    if (!token) return;

    const body = document.getElementById('testimonialBody').value.trim();
    if (selectedRating < 1) { alert('Please select a star rating'); return; }
    if (!body) { alert('Please write a short review'); return; }

    const btn = document.getElementById('submitTestimonialBtn');
    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

        const res = await fetch(`${CONFIG.API_URL}/api/quotation/booking/${token}/testimonial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: selectedRating, body })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to submit review');

        document.getElementById('testimonialForm').classList.add('hidden');
        document.getElementById('testimonialThanks').classList.remove('hidden');

    } catch (err) {
        alert(err.message || 'Something went wrong. Please contact us via WhatsApp.');
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
    }
}

// Feature 4 - submits the deposit non-refundable acknowledgment via the
// booking_token (same token as the testimonial submission above).
async function submitDepositAck() {
    const token = window.__bookingToken;
    if (!token) return;

    const btn = document.getElementById('submitDepositAckBtn');
    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

        const res = await fetch(`${CONFIG.API_URL}/api/quotation/booking/${token}/acknowledge-deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acknowledged: true })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to record acknowledgment');

        document.getElementById('depositAckSection').classList.add('hidden');
        const noteEl = document.getElementById('depositAckedNote');
        noteEl.textContent = `You acknowledged our deposit policy on ${formatDate(result.deposit_ack_at)}.`;
        noteEl.classList.remove('hidden');

    } catch (err) {
        alert(err.message || 'Something went wrong. Please contact us via WhatsApp.');
        if (btn) { btn.disabled = false; btn.textContent = 'Acknowledge'; }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    renderStarRating();

    const depositAckCheckbox = document.getElementById('depositAckCheckbox');
    const submitDepositAckBtn = document.getElementById('submitDepositAckBtn');
    if (depositAckCheckbox && submitDepositAckBtn) {
        depositAckCheckbox.addEventListener('change', function() {
            submitDepositAckBtn.disabled = !this.checked;
        });
        submitDepositAckBtn.addEventListener('click', submitDepositAck);
    }

    const requestCancelBtn = document.getElementById('requestCancelBtn');
    if (requestCancelBtn) requestCancelBtn.addEventListener('click', requestCancellation);

    const requestDateChangeBtn = document.getElementById('requestDateChangeBtn');
    if (requestDateChangeBtn) requestDateChangeBtn.addEventListener('click', () => toggleChangeForm('date_change'));

    const requestAddServiceBtn = document.getElementById('requestAddServiceBtn');
    if (requestAddServiceBtn) requestAddServiceBtn.addEventListener('click', () => toggleChangeForm('add_service'));

    const submitDateChangeBtn = document.getElementById('submitDateChangeBtn');
    if (submitDateChangeBtn) submitDateChangeBtn.addEventListener('click', () => submitChangeRequest('date_change'));

    const submitAddServiceBtn = document.getElementById('submitAddServiceBtn');
    if (submitAddServiceBtn) submitAddServiceBtn.addEventListener('click', () => submitChangeRequest('add_service'));

    const submitTestimonialBtn = document.getElementById('submitTestimonialBtn');
    if (submitTestimonialBtn) submitTestimonialBtn.addEventListener('click', submitTestimonial);

    loadBooking();
});
