// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        function changeAdminCalMonth(delta) {
            adminCalMonth += delta;
            if (adminCalMonth < 1) { adminCalMonth = 12; adminCalYear -= 1; }
            if (adminCalMonth > 12) { adminCalMonth = 1; adminCalYear += 1; }
            loadAdminCalendar();
        }


        async function loadAdminCalendar() {
            const label = document.getElementById('adminCalMonthLabel');
            const grid = document.getElementById('adminCalGrid');
            if (!grid) return;

            if (label) label.textContent = `${ADMIN_CAL_MONTH_NAMES[adminCalMonth - 1]} ${adminCalYear}`;
            grid.innerHTML = '<div class="col-span-7 text-gray-400 py-6">Loading...</div>';

            try {
                const monthParam = `${adminCalYear}-${String(adminCalMonth).padStart(2, '0')}`;
                const res = await fetch(`${CONFIG.API_URL}/api/calendar/admin?month=${monthParam}`, {
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

                if (!res.ok) throw new Error('Failed to load calendar');

                const result = await res.json();
                adminCalEvents = result.data || { quotations: [], inquiries_only: [] };
                renderAdminCalendar();

            } catch (err) {
                console.error('Load admin calendar error:', err);
                grid.innerHTML = '<div class="col-span-7 text-red-500 py-6">Failed to load calendar</div>';
            }
        }


        // Returns the matching active peak period's name for a given
        // YYYY-MM-DD, or null. Plain string comparison works here since
        // start_date/end_date/dateStr are all already YYYY-MM-DD.
        function getPeakPeriodForDate(dateStr) {
            const match = peakPeriodsCache.find(p =>
                p.active && dateStr >= String(p.start_date).split('T')[0] && dateStr <= String(p.end_date).split('T')[0]
            );
            return match ? match.name : null;
        }


        // Feature 3 - true when this event's tentative hold is still active
        // (set, not past its expiry, and not yet auto-released). Broader
        // than checking status alone - a brand new inquiry with no
        // quotation yet can hold a date just as much as a sent/
        // waiting_deposit quotation can.
        function hasActiveHold(e) {
            return !!e.hold_expires_at && !e.hold_released_at && new Date(e.hold_expires_at) > new Date();
        }

        function adminCalDayColor(dayEvents) {
            if (dayEvents.some(e => e.status === 'deposit_paid' || e.status === 'completed')) return 'bg-emerald-200';
            if (dayEvents.some(e => e.status === 'cancelled') && dayEvents.every(e => e.status === 'cancelled')) return 'bg-red-200';
            if (dayEvents.some(hasActiveHold)) return 'bg-amber-200';
            if (dayEvents.some(e => e.status === 'sent' || e.status === 'waiting_deposit')) return 'bg-amber-200';
            if (dayEvents.length > 0) return 'bg-gray-200';
            return '';
        }


        function renderAdminCalendar() {
            const grid = document.getElementById('adminCalGrid');
            if (!grid) return;

            const eventsByDay = {};
            adminCalEvents.quotations.forEach(q => {
                const d = (q.event_date || '').split('T')[0];
                if (!d) return;
                (eventsByDay[d] = eventsByDay[d] || []).push({ ...q, source: 'quotation' });
            });
            adminCalEvents.inquiries_only.forEach(i => {
                const d = (i.event_date || '').split('T')[0];
                if (!d) return;
                (eventsByDay[d] = eventsByDay[d] || []).push({ ...i, status: i.inquiry_status, source: 'inquiry' });
            });

            const firstDay = new Date(adminCalYear, adminCalMonth - 1, 1).getDay();
            const daysInMonth = new Date(adminCalYear, adminCalMonth, 0).getDate();

            let html = '';
            ['S','M','T','W','T','F','S'].forEach(d => {
                html += `<div class="text-gray-400 font-medium py-1">${d}</div>`;
            });
            for (let i = 0; i < firstDay; i++) html += `<div></div>`;

            for (let d = 1; d <= daysInMonth; d++) {
                const str = `${adminCalYear}-${String(adminCalMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dayEvents = eventsByDay[str] || [];
                const color = adminCalDayColor(dayEvents);
                const clickable = dayEvents.length > 0;
                const peakName = getPeakPeriodForDate(str);
                html += `
                    <div class="rounded-lg py-1.5 ${color} ${peakName ? 'border-2 border-purple-400' : ''} ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-gold' : ''}" ${clickable ? `onclick="showAdminCalDay('${str}')"` : ''} ${peakName ? `title="${escapeHTML(peakName)}"` : ''}>
                        <div>${d}</div>
                        ${dayEvents.length > 0 ? `<div class="text-[10px] text-gray-600">${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}</div>` : ''}
                        ${peakName ? `<div class="text-[9px] text-purple-600 truncate px-0.5">${escapeHTML(peakName)}</div>` : ''}
                    </div>
                `;
            }

            grid.innerHTML = html;
            window.__adminCalEventsByDay = eventsByDay;
        }


        function showAdminCalDay(dateStr) {
            const dayEvents = (window.__adminCalEventsByDay || {})[dateStr] || [];
            if (dayEvents.length === 0) return;

            document.getElementById('modalTitle').textContent = `Events on ${formatDate(dateStr)}`;

            let html = '<div class="space-y-3">';
            dayEvents.forEach(e => {
                html += `
                    <div class="border rounded-xl p-3 text-sm">
                        <div class="flex justify-between items-center">
                            <strong>${escapeHTML(e.customer_name || 'Unknown')}</strong>
                            ${e.source === 'quotation' ? getStatusBadge(e.status) : getInquiryStatusBadge(e.status)}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">
                            ${escapeHTML(e.event_type || '-')} | Phone: ${escapeHTML(e.phone || '-')}
                        </div>
                        <div class="text-xs text-gray-400 mt-1">
                            ${e.source === 'quotation' ? `Quotation ${e.quotation_no || '#' + e.id}` : `Inquiry #${e.id} (no quotation yet)`}
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            document.getElementById('modalBody').innerHTML = html;
            document.getElementById('inquiryModal').classList.add('active');
        }


        // ------------------------------------------------------------
        // UPCOMING REMINDERS (customer-facing, one-click send)
        // ------------------------------------------------------------
        async function loadUpcomingReminders() {
            // Renders into every matching container - the Calendar tab and
            // the Today dashboard both show this same list, so they share
            // one fetch instead of drifting out of sync.
            const targets = document.querySelectorAll('.upcoming-reminders-target');
            if (targets.length === 0) return;
            targets.forEach(el => el.innerHTML = '<p class="text-sm text-gray-400">Loading...</p>');

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/calendar/upcoming-reminders?days=7`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load reminders');

                const result = await res.json();
                const events = result.data || [];

                if (events.length === 0) {
                    targets.forEach(el => el.innerHTML = '<p class="text-sm text-gray-400">No confirmed events in the next 7 days.</p>');
                    return;
                }

                const html = events.map(e => {
                    const daysUntil = Math.ceil((new Date(e.event_date) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24));
                    return `
                        <div class="flex flex-wrap justify-between items-center gap-2 border rounded-xl p-3 text-sm">
                            <div>
                                <strong>${escapeHTML(e.customer_name)}</strong>
                                <span class="text-xs text-gray-400 ml-2">${formatDate(e.event_date)} (in ${daysUntil} day${daysUntil === 1 ? '' : 's'})</span>
                                <div class="text-xs text-gray-500 mt-0.5">${escapeHTML(e.event_type || '-')} | ${e.guest_count || '-'} pax | ${escapeHTML(e.quotation_no || '')}</div>
                            </div>
                            <button onclick='sendCustomerReminder(${JSON.stringify(e).replace(/'/g, "&#39;")})' class="bg-green-600 text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-green-700 transition whitespace-nowrap">
                                Send Reminder
                            </button>
                        </div>
                    `;
                }).join('');
                targets.forEach(el => el.innerHTML = html);

            } catch (err) {
                console.error('Load upcoming reminders error:', err);
                targets.forEach(el => el.innerHTML = '<p class="text-sm text-red-500">Failed to load reminders.</p>');
            }
        }


        // ---- Peak Periods (BAU backlog #17 - admin calendar holiday awareness) ----
        function renderPeakPeriodsList() {
            const el = document.getElementById('peakPeriodsList');
            if (!el) return;
            if (peakPeriodsCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No peak periods added yet.</p>';
                return;
            }
            el.innerHTML = peakPeriodsCache.map(p => `
                <div class="border rounded-xl p-3 text-sm flex justify-between items-center ${p.active ? '' : 'opacity-50'}">
                    <div>
                        <strong>${escapeHTML(p.name)}</strong>
                        <div class="text-xs text-gray-500 mt-0.5">${formatDate(p.start_date)} - ${formatDate(p.end_date)}${p.active ? '' : ' (inactive)'}</div>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button onclick="editPeakPeriod(${p.id})" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">Edit</button>
                        <button onclick="deletePeakPeriod(${p.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition">Delete</button>
                    </div>
                </div>
            `).join('');
        }


        function editPeakPeriod(id) {
            const p = peakPeriodsCache.find(x => x.id === id);
            if (!p) return;
            editingPeakPeriodId = id;
            document.getElementById('peak_name').value = p.name || '';
            document.getElementById('peak_start').value = toDateInputValue(p.start_date);
            document.getElementById('peak_end').value = toDateInputValue(p.end_date);
            document.getElementById('peak_active').checked = !!p.active;
            document.getElementById('peakSaveLabel').textContent = 'Update Peak Period';
            document.getElementById('peakCancelBtn').classList.remove('hidden');
        }


        function resetPeakPeriodForm() {
            editingPeakPeriodId = null;
            document.getElementById('peak_name').value = '';
            document.getElementById('peak_start').value = '';
            document.getElementById('peak_end').value = '';
            document.getElementById('peak_active').checked = true;
            document.getElementById('peakSaveLabel').textContent = 'Add Peak Period';
            document.getElementById('peakCancelBtn').classList.add('hidden');
        }


        async function savePeakPeriod() {
            const name = document.getElementById('peak_name').value.trim();
            const start_date = document.getElementById('peak_start').value;
            const end_date = document.getElementById('peak_end').value;
            const active = document.getElementById('peak_active').checked;

            if (!name || !start_date || !end_date) { alert('Name, start date, and end date are required'); return; }
            if (end_date < start_date) { alert('End date must be on or after the start date'); return; }

            try {
                const url = editingPeakPeriodId ? `${CONFIG.API_URL}/api/peak-periods/${editingPeakPeriodId}` : `${CONFIG.API_URL}/api/peak-periods`;
                const method = editingPeakPeriodId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ name, start_date, end_date, active })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save peak period');
                }
                resetPeakPeriodForm();
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deletePeakPeriod(id) {
            if (!confirm('Delete this peak period?')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/peak-periods/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete peak period');
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // BAU backlog #14 - read-only iCal feed link
        function renderCalendarFeedLink() {
            const el = document.getElementById('calendarFeedLink');
            if (!el) return;
            if (!calendarFeedToken) {
                el.innerHTML = '<p class="text-gray-400">Feed link unavailable - try reloading.</p>';
                return;
            }
            const feedUrl = `${CONFIG.API_URL}/api/calendar/feed/${calendarFeedToken}`;
            el.innerHTML = `
                <div class="flex flex-wrap items-center gap-2">
                    <code class="bg-gray-100 rounded-lg px-3 py-2 text-xs break-all">${escapeHTML(feedUrl)}</code>
                    <button onclick="copyCalendarFeedLink()" class="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-100 transition whitespace-nowrap">
                        Copy Link
                    </button>
                    <button onclick="regenerateCalendarFeedToken()" class="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-100 transition whitespace-nowrap">
                        Regenerate
                    </button>
                </div>
            `;
        }


        function copyCalendarFeedLink() {
            if (!calendarFeedToken) return;
            const feedUrl = `${CONFIG.API_URL}/api/calendar/feed/${calendarFeedToken}`;
            navigator.clipboard.writeText(feedUrl)
                .then(() => alert('Calendar feed link copied! Paste this into "Subscribe by URL" in Google Calendar, Outlook, or your phone\'s calendar app:\n\n' + feedUrl))
                .catch(() => prompt('Copy this calendar feed link:', feedUrl));
        }


        // Sprint 8, Epic N - this is a single shared feed link (unlike a
        // per-inquiry/per-quotation token), so regenerating it breaks the
        // link for EVERY calendar app currently subscribed to it, not
        // just an admin's own device - worth the explicit confirm text
        // saying so, not just a generic "are you sure?".
        async function regenerateCalendarFeedToken() {
            if (!confirm('Regenerate the calendar feed link? Any calendar app currently subscribed to the old link (yours or anyone else\'s) will stop receiving updates until re-subscribed with the new one.')) return;

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/calendar/feed-token/regenerate`, {
                    method: 'PATCH',
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
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to regenerate calendar feed link');
                }

                const result = await res.json();
                calendarFeedToken = result.token;
                renderCalendarFeedLink();
                alert('New calendar feed link generated. Re-subscribe any calendar apps using the old link.');

            } catch (err) {
                console.error('Regenerate calendar feed token error:', err);
                alert('Failed to regenerate calendar feed link: ' + err.message);
            }
        }
