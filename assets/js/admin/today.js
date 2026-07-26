// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.

// Dashboard redesign - cancellations, change requests, expiring quotations
// and due reminders (the 4 boxes that need a decision, not just a read) are
// merged into one severity-sorted feed instead of 4 same-weight cards.
// Each loader below still does its own fetch (unchanged), but writes into
// this cache and calls renderAttentionFeed() instead of its own container -
// renderInquiries() (inquiries.js) does the same for cancellations.
let attentionCache = { cancel: [], change: [], expiring: [], reminder: [] };
let attentionFilter = 'all';

function renderCancelAttentionItem(inq) {
    return `
        <div class="item sev-critical" data-type="cancel">
            <div class="item-main">
                <div class="item-top"><span class="who">#${inq.id} ${escapeHTML(inq.customer_name)}</span><span class="when">${formatDate(inq.created_at)}</span></div>
                <span class="item-tag tag-critical">Cancellation requested</span>
                <div class="item-detail">${escapeHTML(inq.event_type || '-')} &middot; ${formatDate(inq.event_date)} &middot; ${escapeHTML(inq.phone || '-')}</div>
                <div class="item-actions">
                    <button class="btn btn-primary" onclick="viewInquiry(${inq.id})">Review</button>
                </div>
            </div>
        </div>
    `;
}

function renderChangeAttentionItem(r) {
    const isDateChange = r.request_type === 'date_change';
    const isTimeChange = r.request_type === 'time_change';
    const conflict = isDateChange && r.conflict;
    const sev = conflict ? 'critical' : 'warning';
    const tagLabel = isDateChange
        ? (conflict ? 'Date change &middot; conflict' : 'Date change requested')
        : isTimeChange ? 'Time change requested' : 'Add service requested';
    const detail = isDateChange
        ? `Requested new date: <strong>${formatDate(r.requested_date)}</strong> (currently ${formatDate(r.current_event_date)})`
        : isTimeChange
            ? `Requested new time: <strong>${escapeHTML(r.requested_time)}</strong>`
            : `Requested service: <strong>${escapeHTML(r.requested_service)}</strong>`;
    const conflictHtml = conflict
        ? `<div class="item-detail" style="color:var(--danger)">Conflict: ${escapeHTML(r.conflict.customer_name)} (${escapeHTML(r.conflict.quotation_no || '-')}) already has a confirmed booking on this date.</div>`
        : '';
    return `
        <div class="item sev-${sev}" data-type="change">
            <div class="item-main">
                <div class="item-top"><span class="who">${escapeHTML(r.customer_name)}</span><span class="when">${formatDateTime(r.created_at)}</span></div>
                <span class="item-tag tag-${sev}">${tagLabel}</span>
                <div class="item-detail">${detail}${r.quotation_no ? ' &middot; ' + escapeHTML(r.quotation_no) : ''}</div>
                ${r.customer_note ? `<div class="item-detail">Note: ${escapeHTML(r.customer_note)}</div>` : ''}
                ${conflictHtml}
                <div class="item-actions">
                    <button class="btn btn-primary" onclick="resolveChangeRequest(${r.id}, 'approve')">Approve</button>
                    <button class="btn btn-ghost" onclick="resolveChangeRequest(${r.id}, 'reject')">Reject</button>
                </div>
            </div>
        </div>
    `;
}

function renderReminderAttentionItem(r) {
    return `
        <div class="item sev-info" data-type="reminder" onclick="viewInquiry(${r.inquiry_id})" style="cursor:pointer">
            <div class="item-main">
                <div class="item-top"><span class="who">${escapeHTML(r.customer_name)}</span><span class="when">Due ${formatDate(r.remind_at)}</span></div>
                <span class="item-tag tag-info">Follow-up reminder</span>
                ${r.note ? `<div class="item-detail">&ldquo;${escapeHTML(r.note)}&rdquo;</div>` : ''}
                <div class="item-actions">
                    <button class="btn btn-ghost" onclick="event.stopPropagation(); markReminderDone(${r.id})">Mark done</button>
                </div>
            </div>
        </div>
    `;
}

function renderExpiringAttentionItem(q) {
    const sev = q.expired ? 'critical' : 'warning';
    return `
        <div class="item sev-${sev}" data-type="expiring">
            <div class="item-main">
                <div class="item-top"><span class="who">${escapeHTML(q.quotation_no)}</span><span class="when">${q.days_since_sent} day${q.days_since_sent === 1 ? '' : 's'} sent</span></div>
                <span class="item-tag tag-${sev}">${q.expired ? 'Past 7-day validity' : 'Expiring soon'}</span>
                <div class="item-detail">${escapeHTML(q.customer_name)} &middot; RM ${q.total || 0}</div>
            </div>
        </div>
    `;
}

function renderAttentionFeed() {
    const el = document.getElementById('todayAttentionFeed');
    if (!el) return;

    const sevRank = { critical: 0, warning: 1, info: 2 };
    const items = [];
    attentionCache.cancel.forEach(x => items.push({ type: 'cancel', sev: 'critical', html: renderCancelAttentionItem(x) }));
    attentionCache.change.forEach(x => {
        const sev = (x.request_type === 'date_change' && x.conflict) ? 'critical' : 'warning';
        items.push({ type: 'change', sev, html: renderChangeAttentionItem(x) });
    });
    attentionCache.expiring.forEach(x => items.push({ type: 'expiring', sev: x.expired ? 'critical' : 'warning', html: renderExpiringAttentionItem(x) }));
    attentionCache.reminder.forEach(x => items.push({ type: 'reminder', sev: 'info', html: renderReminderAttentionItem(x) }));

    items.sort((a, b) => sevRank[a.sev] - sevRank[b.sev]);

    const counts = { all: items.length, cancel: attentionCache.cancel.length, change: attentionCache.change.length, expiring: attentionCache.expiring.length, reminder: attentionCache.reminder.length };
    Object.keys(counts).forEach(key => {
        const badge = document.getElementById(`attnCount-${key}`);
        if (badge) badge.textContent = counts[key];
    });
    const pill = document.getElementById('attentionCountPill');
    if (pill) pill.textContent = counts.all;

    const visible = attentionFilter === 'all' ? items : items.filter(i => i.type === attentionFilter);

    el.innerHTML = visible.length === 0
        ? `<div class="empty">
                <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                <b>All caught up</b>
                <span>${attentionFilter === 'all' ? 'Nothing needs your attention right now.' : 'Nothing in this category right now.'}</span>
            </div>`
        : visible.map(i => i.html).join('');
}

function setAttentionFilter(type, btnEl) {
    attentionFilter = type;
    document.querySelectorAll('#attentionChips .chip').forEach(c => c.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderAttentionFeed();
}


        // BAU backlog #15 - extends the existing self-service cancellation-
        // request pattern to date-change/add-service requests. Same
        // token-based, customer-triggered, admin-approved, never-auto-
        // executed shape. A date_change request's conflict field (from
        // the same same-date confirmed-booking check reschedule uses) is
        // shown as a warning before the admin approves it.
        async function loadChangeRequests() {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/change-requests`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load change requests');

                const result = await res.json();
                attentionCache.change = result.data || [];
                renderAttentionFeed();

            } catch (err) {
                console.error('Load change requests error:', err);
            }
        }


        async function resolveChangeRequest(id, action, force = false) {
            try {
                let admin_notes = null;
                if (action === 'reject') {
                    admin_notes = prompt('Reason for rejecting (optional):');
                    if (admin_notes === null) return; // admin hit Cancel on the prompt itself
                }

                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/change-requests/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ action, admin_notes, force })
                });

                if (res.status === 409) {
                    const err = await res.json();
                    const c = err.conflict || {};
                    const confirmMsg = `${err.error}\n\n${c.customer_name} (${c.quotation_no || '-'}) already has a confirmed booking on this date.\n\nApprove the date change anyway?`;
                    if (confirm(confirmMsg)) {
                        await resolveChangeRequest(id, action, true);
                    }
                    return;
                }

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to resolve request');
                }

                await loadChangeRequests();
                await loadInquiries();

            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // BAU backlog #23 - snooze/per-inquiry follow-up reminder
        async function loadDueReminders() {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/reminders/due`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load reminders');

                const result = await res.json();
                attentionCache.reminder = result.data || [];
                renderAttentionFeed();

            } catch (err) {
                console.error('Load reminders error:', err);
            }
        }


        async function markReminderDone(id) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/reminders/${id}/done`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to mark reminder done');
                await loadDueReminders();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // Quotations that have sat at "sent" for 5+ days with no customer
        // response, closing in on (or past) the 7-day validity window shown
        // on the generated PDF - a nudge to follow up before it lapses.
        async function loadExpiringQuotationsToday() {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/expiring`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load expiring quotations');

                const result = await res.json();
                attentionCache.expiring = result.data || [];
                renderAttentionFeed();

            } catch (err) {
                console.error('Load expiring quotations error:', err);
            }
        }


        // Sprint 7, Epic K - completed events asked for a review 3+ days
        // ago (services/testimonialRequestScheduler.js) that haven't left
        // one yet. The automated ask only reaches customers with an email
        // on file (most don't - see Epic J's finding), so this is the
        // manual-nudge path for everyone else: one click opens WhatsApp
        // with a message ready to send, same wa.me pattern as
        // sendQuotationToCustomer in quotations-list.js.
        async function loadTestimonialRequestsToday() {
            const el = document.getElementById('todayTestimonialRequestsList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/testimonials/pending-requests`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load pending review requests');

                const result = await res.json();
                const rows = result.data || [];

                if (rows.length === 0) {
                    el.innerHTML = '<p class="text-sm text-gray-500">No pending review requests.</p>';
                    return;
                }

                el.innerHTML = rows.map(r => {
                    const phone = (r.phone || '').replace(/[^0-9]/g, '');
                    const msg = `Hi ${r.customer_name}, thank you again for booking with us! If you have a moment, we'd love to hear how your event went - your feedback helps other customers find us.`;
                    const waLink = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : null;
                    return `
                        <div class="mini-item">
                            <div class="mini-main">
                                <div class="t">${escapeHTML(r.customer_name)}</div>
                                <div class="s">${escapeHTML(r.quotation_no || '-')} &middot; asked ${formatDate(r.testimonial_requested_at)}</div>
                            </div>
                            ${waLink ? `<a href="${waLink}" target="_blank" class="btn btn-wa">WhatsApp</a>` : ''}
                        </div>
                    `;
                }).join('');

            } catch (err) {
                console.error('Load testimonial requests error:', err);
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load.</p>';
            }
        }
