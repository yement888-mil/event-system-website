// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // BAU backlog #15 - extends the existing self-service cancellation-
        // request pattern to date-change/add-service requests. Same
        // token-based, customer-triggered, admin-approved, never-auto-
        // executed shape. A date_change request's conflict field (from
        // the same same-date confirmed-booking check reschedule uses) is
        // shown as a warning before the admin approves it.
        async function loadChangeRequests() {
            const el = document.getElementById('todayChangeRequestsList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/change-requests`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load change requests');

                const result = await res.json();
                const requests = result.data || [];

                if (requests.length === 0) {
                    el.innerHTML = '<p class="text-sm text-gray-500">No pending change requests.</p>';
                    return;
                }

                el.innerHTML = requests.map(r => {
                    const isDateChange = r.request_type === 'date_change';
                    const conflictHtml = isDateChange && r.conflict
                        ? `<div class="text-xs text-red-600 font-medium mt-1">Conflict: ${escapeHTML(r.conflict.customer_name)} (${escapeHTML(r.conflict.quotation_no || '-')}) already has a confirmed booking on this date.</div>`
                        : '';
                    return `
                        <div class="border rounded-xl p-3 text-sm ${conflictHtml ? 'border-red-300 bg-red-50' : ''}">
                            <div class="flex justify-between items-start">
                                <div>
                                    <strong>${escapeHTML(r.customer_name)}</strong>
                                    <span class="text-xs text-gray-400 ml-1">${escapeHTML(r.quotation_no || '-')}</span>
                                </div>
                                <span class="text-xs text-gray-400">${formatDateTime(r.created_at)}</span>
                            </div>
                            <div class="text-xs mt-1">
                                ${isDateChange
                                    ? `Requested new date: <strong>${formatDate(r.requested_date)}</strong> (currently ${formatDate(r.current_event_date)})`
                                    : `Requested service: <strong>${escapeHTML(r.requested_service)}</strong>`}
                            </div>
                            ${r.customer_note ? `<div class="text-xs text-gray-500 mt-1">Note: ${escapeHTML(r.customer_note)}</div>` : ''}
                            ${conflictHtml}
                            <div class="flex gap-2 mt-2">
                                <button onclick="resolveChangeRequest(${r.id}, 'approve')" class="bg-gold text-dark px-3 py-1 rounded text-xs font-medium hover:bg-yellow-600 transition">Approve</button>
                                <button onclick="resolveChangeRequest(${r.id}, 'reject')" class="border border-gray-300 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-100 transition">Reject</button>
                            </div>
                        </div>
                    `;
                }).join('');

            } catch (err) {
                console.error('Load change requests error:', err);
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load.</p>';
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
            const el = document.getElementById('todayRemindersList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/reminders/due`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load reminders');

                const result = await res.json();
                const reminders = result.data || [];

                if (reminders.length === 0) {
                    el.innerHTML = '<p class="text-sm text-gray-500">No reminders due.</p>';
                    return;
                }

                el.innerHTML = reminders.map(r => `
                    <div class="flex justify-between items-center gap-2 border rounded-xl p-3 text-sm cursor-pointer hover:shadow transition" onclick="viewInquiry(${r.inquiry_id})">
                        <div>
                            <strong>${escapeHTML(r.customer_name)}</strong>
                            <span class="text-xs text-gray-400 ml-2">Due ${formatDate(r.remind_at)}</span>
                            ${r.note ? `<div class="text-xs text-gray-500 mt-0.5">${escapeHTML(r.note)}</div>` : ''}
                        </div>
                        <button onclick="event.stopPropagation(); markReminderDone(${r.id})" class="border border-gray-300 text-gray-600 px-3 py-1 rounded-full text-xs font-medium hover:bg-gray-100 transition whitespace-nowrap">
                            Done
                        </button>
                    </div>
                `).join('');

            } catch (err) {
                console.error('Load reminders error:', err);
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load.</p>';
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


        // BAU backlog #24 - additive grouping alongside the full open-tasks
        // list below (todayTasksList), not a replacement - filtering the
        // main list down to just today's events would hide an overdue
        // task from last week from the one place it's currently impossible
        // to miss.
        async function loadOpenTasksToday() {
            const el = document.getElementById('todayTasksList');
            const eventTasksEl = document.getElementById('todayEventTasksList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';
            if (eventTasksEl) eventTasksEl.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks/open`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load open tasks');

                const result = await res.json();
                const tasks = result.data || [];
                const today = new Date(new Date().toDateString());
                const todayStr = today.toISOString().split('T')[0];

                if (tasks.length === 0) {
                    el.innerHTML = '<p class="text-sm text-gray-500">No open tasks.</p>';
                } else {
                    el.innerHTML = tasks.map(t => renderTaskCard(t, today)).join('');
                }

                if (eventTasksEl) {
                    const eventTasks = tasks.filter(t => t.event_date && String(t.event_date).split('T')[0] === todayStr);
                    eventTasksEl.innerHTML = eventTasks.length === 0
                        ? '<p class="text-sm text-gray-500">No tasks for events happening today.</p>'
                        : eventTasks.map(t => renderTaskCard(t, today)).join('');
                }

            } catch (err) {
                console.error('Load open tasks error:', err);
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load open tasks.</p>';
                if (eventTasksEl) eventTasksEl.innerHTML = '<p class="text-sm text-red-500">Failed to load.</p>';
            }
        }


        // Quotations that have sat at "sent" for 5+ days with no customer
        // response, closing in on (or past) the 7-day validity window shown
        // on the generated PDF - a nudge to follow up before it lapses.
        async function loadExpiringQuotationsToday() {
            const el = document.getElementById('todayExpiringList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/expiring`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load expiring quotations');

                const result = await res.json();
                const rows = result.data || [];

                if (rows.length === 0) {
                    el.innerHTML = '<p class="text-sm text-gray-500">Nothing expiring soon.</p>';
                    return;
                }

                el.innerHTML = rows.map(q => `
                    <div class="flex justify-between items-center gap-2 border rounded-xl p-3 text-sm ${q.expired ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}">
                        <div>
                            <strong>${escapeHTML(q.quotation_no)}</strong>
                            <div class="text-xs text-gray-500 mt-0.5">${escapeHTML(q.customer_name)} | RM ${q.total || 0}</div>
                            <div class="text-xs mt-0.5 ${q.expired ? 'text-red-600 font-medium' : 'text-amber-700'}">
                                Sent ${q.days_since_sent} day${q.days_since_sent === 1 ? '' : 's'} ago${q.expired ? ' - past the 7-day validity window' : ''}
                            </div>
                        </div>
                    </div>
                `).join('');

            } catch (err) {
                console.error('Load expiring quotations error:', err);
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load.</p>';
            }
        }
