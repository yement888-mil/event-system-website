// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // MARK INQUIRY AS READ
        // ------------------------------------------------------------
        async function markAllAsRead() {
            if (!confirm('Mark all unread inquiries as read?')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/mark-all-read`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to mark all as read');
                }

                await loadInquiries();
            } catch (err) {
                console.error('Mark all as read error:', err);
                alert('Error: ' + err.message);
            }
        }


        async function markAsRead(id) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/read`, {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${adminToken}` 
                    }
                });
                
                if (res.ok) {
                    await loadInquiries();
                } else {
                    const data = await res.json();
                    alert('Failed to mark as read: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('Error marking as read:', err);
                alert('Error: ' + err.message);
            }
        }


        // ------------------------------------------------------------
        // VIEW INQUIRY DETAILS
        // ------------------------------------------------------------
        function viewInquiry(id) {
            const inq = allInquiries.find(i => i.id === id);
            if (!inq) return;
            
            document.getElementById('modalTitle').textContent = `Inquiry from ${inq.customer_name}`;
            
            let servicesHtml = '';
            if (inq.services_requested) {
                try {
                    const services = typeof inq.services_requested === 'string' ? 
                        JSON.parse(inq.services_requested) : inq.services_requested;
                    servicesHtml = services.map(s => `<span class="bg-gray-100 px-2 py-1 rounded text-xs mr-1">${escapeHTML(s)}</span>`).join(' ');
                } catch(e) {
                    servicesHtml = escapeHTML(inq.services_requested);
                }
            }
            
            let statusOptionsHtml = '';
            INQUIRY_STATUSES.forEach(s => {
                const selected = (inq.status || 'new') === s ? 'selected' : '';
                statusOptionsHtml += `<option ${selected} value="${s}">${INQUIRY_STATUS_LABELS[s]}</option>`;
            });

            document.getElementById('modalBody').innerHTML = `
                <div class="inquiry-detail-grid">
                    <div><strong>ID:</strong> #${inq.id}</div>
                    <div><strong>Name:</strong> ${escapeHTML(inq.customer_name)}</div>
                    <div><strong>Phone:</strong> ${escapeHTML(inq.phone || '-')}</div>
                    <div><strong>Event Type:</strong> ${escapeHTML(inq.event_type || '-')}</div>
                    <div><strong>Event Date:</strong> ${formatDate(inq.event_date)}</div>
                    <div><strong>Guests:</strong> ${inq.guest_count || '-'}</div>
                    <div><strong>Read Status:</strong> ${inq.is_read ? 'Read' : 'Unread'}</div>
                </div>
                ${inq.customer_id ? `<button onclick="viewCustomerDetail(${inq.customer_id})" class="mt-3 text-xs text-gold hover:underline">View this customer's full booking history &rarr;</button>` : ''}
                <button onclick="viewInquiryHistory(${inq.id})" class="mt-3 ml-3 text-xs text-gray-500 hover:underline">Version History (status changes, notes)</button>
                <div class="mt-4">
                    <strong>Services Requested:</strong>
                    <div class="mt-2">${servicesHtml || '-'}</div>
                </div>
                ${inq.catering_package ? `<div class="mt-2"><strong>Preferred Catering Package:</strong> ${escapeHTML(inq.catering_package)}</div>` : ''}
                <div class="mt-4">
                    <strong>Message:</strong>
                    <p class="mt-1 text-sm bg-gray-50 p-3 rounded">${escapeHTML(inq.message || 'No message')}</p>
                </div>
                <div class="mt-4">
                    <strong>Pipeline Status:</strong>
                    <div class="flex items-center gap-2 mt-2">
                        <select id="pipelineStatus_${inq.id}" class="border rounded-xl text-sm px-3 py-2">
                            ${statusOptionsHtml}
                        </select>
                        <button onclick="updateInquiryStatus(${inq.id})" class="bg-gold text-dark px-4 py-2 rounded-xl text-sm font-medium hover:bg-yellow-600 transition">
                            Update
                        </button>
                    </div>
                </div>
                <div class="mt-4">
                    <strong>Internal Notes (staff only, this inquiry only):</strong>
                    <textarea id="adminNotes_${inq.id}" rows="2" class="w-full border rounded-xl px-3 py-2 text-sm mt-2" placeholder="e.g. called twice, no answer">${escapeHTML(inq.admin_notes || '')}</textarea>
                    <button onclick="saveInquiryNotes(${inq.id})" class="mt-2 bg-gold text-dark px-4 py-2 rounded-xl text-sm font-medium hover:bg-yellow-600 transition">
                        Save Notes
                    </button>
                </div>
                <div class="mt-4">
                    <strong>Reschedule Event Date:</strong>
                    <div class="flex items-center gap-2 mt-2">
                        <input type="date" id="rescheduleDate_${inq.id}" value="${toDateInputValue(inq.event_date)}" class="border rounded-xl text-sm px-3 py-2">
                        <button onclick="rescheduleInquiry(${inq.id})" class="border-2 border-dark text-dark px-4 py-2 rounded-xl text-sm font-medium hover:bg-dark hover:text-white transition">
                            Reschedule
                        </button>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">This also updates the linked quotation, calendar, and reminders automatically.</p>
                </div>
                <div class="mt-4">
                    <strong>Snooze / Follow-Up Reminder:</strong>
                    <div class="flex items-center gap-2 mt-2">
                        <input type="date" id="snoozeDate_${inq.id}" class="border rounded-xl text-sm px-3 py-2">
                        <input type="text" id="snoozeNote_${inq.id}" placeholder="Note (optional)" class="flex-1 border rounded-xl text-sm px-3 py-2">
                        <button onclick="snoozeInquiry(${inq.id})" class="border-2 border-dark text-dark px-4 py-2 rounded-xl text-sm font-medium hover:bg-dark hover:text-white transition whitespace-nowrap">
                            Remind Me
                        </button>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">Reminds you here and on the Today tab once the date arrives - nothing else changes automatically.</p>
                </div>
                <div class="mt-4">
                    <strong>Customer Self-Service Link:</strong>
                    <p class="text-xs text-gray-400 mt-1">
                        ${inq.withdraw_token_expires_at ? `Expires ${formatDateTime(inq.withdraw_token_expires_at)}` : 'No expiry on record'} - lets the customer withdraw or request a change via their booking page.
                    </p>
                    <button onclick="regenerateWithdrawToken(${inq.id})" class="mt-2 border-2 border-dark text-dark px-4 py-2 rounded-xl text-sm font-medium hover:bg-dark hover:text-white transition">
                        Regenerate Link
                    </button>
                </div>
                <div class="mt-4 text-xs text-gray-400">
                    Submitted: ${formatDateTime(inq.created_at)}
                </div>
                ${!inq.is_read ? `<button onclick="markAsRead(${inq.id}); closeModal();" class="mt-4 bg-gold text-dark px-4 py-2 rounded text-sm font-medium hover:bg-yellow-600 transition">Mark as Read</button>` : ''}
            `;
            
            document.getElementById('inquiryModal').classList.add('active');
        }


        async function saveInquiryNotes(id) {
            try {
                const textarea = document.getElementById(`adminNotes_${id}`);
                if (!textarea) return;

                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/notes`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ admin_notes: textarea.value })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save notes');
                }

                await loadInquiries();
            } catch (err) {
                console.error('Save inquiry notes error:', err);
                alert('Error: ' + err.message);
            }
        }


        async function updateInquiryStatus(id) {
            try {
                const select = document.getElementById(`pipelineStatus_${id}`);
                if (!select) return;
                const newStatus = select.value;
                // Captured before the request, from the array as it stood
                // before this change - BAU backlog #6's undo toast needs
                // the pre-change value to revert to.
                const oldStatus = allInquiries.find(i => i.id === id)?.status;

                // BAU backlog #30 - confirmation prompt before the 2-3
                // genuinely high-stakes transitions only (confirm/cancel),
                // not the whole status dropdown - a confirm on every
                // change would just become reflexive "yes" clicking within
                // a week and stop protecting anything. This select requires
                // a separate "Update" button click (not auto-submit on
                // change - see the modal markup above), so cancelling here
                // just leaves the dropdown as picked with nothing sent;
                // reopening the inquiry rebuilds it from the real status.
                if (newStatus === 'confirmed' || newStatus === 'cancelled') {
                    const verb = newStatus === 'confirmed' ? 'confirm this booking' : 'cancel this booking';
                    if (!confirm(`Are you sure you want to ${verb}? This is a high-stakes change.`)) {
                        return;
                    }
                }

                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ status: newStatus })
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
                    throw new Error(err.error || 'Failed to update status');
                }

                await loadInquiries();
                closeModal();

                if (oldStatus && oldStatus !== newStatus) {
                    showUndoToast(`Status changed to "${INQUIRY_STATUS_LABELS[newStatus] || newStatus}".`, () => undoInquiryStatus(id, oldStatus, newStatus));
                }

            } catch (err) {
                console.error('Update inquiry status error:', err);
                alert('Failed to update status: ' + err.message);
            }
        }


        // BAU backlog #6 - reverts only if the current value still equals
        // revertFrom (the value the original action set) - an optimistic-
        // concurrency check the server enforces via if_current_equals, not
        // just this client trusting its own stale state. If someone (or
        // another action) already changed it again, this fails loudly
        // instead of silently clobbering that newer, intentional change.
        async function undoInquiryStatus(id, revertTo, revertFrom) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ status: revertTo, if_current_equals: revertFrom })
                });

                if (res.status === 409) {
                    alert("Can't undo - this was already changed.");
                    await loadInquiries();
                    return;
                }
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to undo');
                }

                await loadInquiries();
            } catch (err) {
                alert('Undo failed: ' + err.message);
            }
        }


        async function rescheduleInquiry(id, force = false) {
            try {
                const input = document.getElementById(`rescheduleDate_${id}`);
                if (!input || !input.value) {
                    alert('Please pick a new date');
                    return;
                }
                const newDate = input.value;

                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/reschedule`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ new_date: newDate, force })
                });

                if (res.status === 401) {
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    alert('Session expired. Please login again.');
                    return;
                }

                if (res.status === 409) {
                    const err = await res.json();
                    const who = err.conflict?.customer_name || 'another customer';
                    const confirmMsg = `${formatDate(newDate)} already has a confirmed booking for ${who} (${err.conflict?.quotation_no || '-'}).\n\nReschedule to this date anyway?`;
                    if (confirm(confirmMsg)) {
                        await rescheduleInquiry(id, true);
                    }
                    return;
                }

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to reschedule');
                }

                await loadInquiries();
                await loadQuotations();
                closeModal();

            } catch (err) {
                console.error('Reschedule error:', err);
                alert('Failed to reschedule: ' + err.message);
            }
        }


        // BAU backlog E5 - mints a fresh withdraw_token/expiry, invalidating
        // whatever link the customer had before. Covers both "the old link
        // expired and they still need it" and "this link may have leaked,
        // kill it now".
        async function regenerateWithdrawToken(id) {
            if (!confirm('Generate a new self-service link for this inquiry? The old link will stop working immediately.')) return;

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/regenerate-withdraw-token`, {
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
                    throw new Error(err.error || 'Failed to regenerate link');
                }

                await loadInquiries();
                viewInquiry(id);
                alert('New link generated. The old link no longer works.');

            } catch (err) {
                console.error('Regenerate withdraw token error:', err);
                alert('Failed to regenerate link: ' + err.message);
            }
        }


        // BAU backlog #23 - snooze/per-inquiry follow-up reminder
        async function snoozeInquiry(id) {
            const dateInput = document.getElementById(`snoozeDate_${id}`);
            const noteInput = document.getElementById(`snoozeNote_${id}`);
            if (!dateInput || !dateInput.value) {
                alert('Please pick a reminder date');
                return;
            }

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/snooze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ remind_at: dateInput.value, note: noteInput?.value?.trim() || '' })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to set reminder');
                }
                alert('Reminder set.');
                closeModal();
                await loadDueReminders();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // ------------------------------------------------------------
        // LOAD INQUIRIES
        // ------------------------------------------------------------
        // BAU backlog #13 - builds the query string from inquiryServerFilters
        // (only ever set by applyInquiryFilters()), shared by loadInquiries()
        // and loadMoreInquiries() so a filtered search stays applied across
        // pagination instead of Load More silently returning to unfiltered.
        function inquiryFilterParams(extra) {
            const params = new URLSearchParams(extra);
            if (inquiryServerFilters.search) params.set('search', inquiryServerFilters.search);
            if (inquiryServerFilters.dateFrom) params.set('date_from', inquiryServerFilters.dateFrom);
            if (inquiryServerFilters.dateTo) params.set('date_to', inquiryServerFilters.dateTo);
            return params.toString();
        }


        async function applyInquiryFilters() {
            inquiryServerFilters = {
                search: document.getElementById('inquirySearch')?.value?.trim() || '',
                dateFrom: document.getElementById('inquiryDateFrom')?.value || '',
                dateTo: document.getElementById('inquiryDateTo')?.value || ''
            };
            await loadInquiries();
        }


        function clearInquiryFilters() {
            const dateFrom = document.getElementById('inquiryDateFrom');
            const dateTo = document.getElementById('inquiryDateTo');
            if (dateFrom) dateFrom.value = '';
            if (dateTo) dateTo.value = '';
            inquiryServerFilters = { search: '', dateFrom: '', dateTo: '' };
            loadInquiries();
        }


        async function loadInquiries() {
            const unreadList = document.getElementById('unreadInquiryList');
            const allList = document.getElementById('allInquiryList');

            // Show loading state
            if (unreadList) {
                unreadList.innerHTML = `
                    <div class="text-center py-8">
                        <div class="loading-spinner"></div>
                        <p class="text-sm text-gray-500 mt-2">Loading inquiries...</p>
                    </div>
                `;
            }
            if (allList) {
                allList.innerHTML = `
                    <div class="text-center py-8">
                        <div class="loading-spinner"></div>
                        <p class="text-sm text-gray-500 mt-2">Loading inquiries...</p>
                    </div>
                `;
            }

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry?${inquiryFilterParams({ limit: LIST_PAGE_SIZE, offset: 0 })}`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (res.status === 401) {
                    // Token expired, redirect to login
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    return;
                }

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to load inquiries');
                }

                const data = await res.json();
                allInquiries = data.data || [];
                inquiriesOffset = allInquiries.length;
                inquiriesHasMore = !!data.pagination?.has_more;
                inquiriesTotalCount = data.pagination?.total ?? allInquiries.length;
                filteredInquiries = [...allInquiries];
                renderInquiries(allInquiries);
                updateStats();
            } catch (err) {
                console.error('Load inquiries error:', err);
                if (unreadList) unreadList.innerHTML = `<p class="text-red-500 text-sm">Error: ${err.message}</p>`;
                if (allList) allList.innerHTML = `<p class="text-red-500 text-sm">Error: ${err.message}</p>`;
            }
        }


        // Appends the next page to the already-loaded allInquiries (BAU
        // backlog #2) rather than replacing it, so everything that reads
        // allInquiries - search, stats, analytics - just sees more data,
        // not a reset.
        async function loadMoreInquiries() {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry?${inquiryFilterParams({ limit: LIST_PAGE_SIZE, offset: inquiriesOffset })}`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to load more inquiries');
                }

                const data = await res.json();
                const nextPage = data.data || [];
                allInquiries = allInquiries.concat(nextPage);
                inquiriesOffset = allInquiries.length;
                inquiriesHasMore = !!data.pagination?.has_more;
                inquiriesTotalCount = data.pagination?.total ?? allInquiries.length;
                filteredInquiries = [...allInquiries];
                renderInquiries(allInquiries);
                updateStats();
            } catch (err) {
                console.error('Load more inquiries error:', err);
                alert('Failed to load more inquiries: ' + err.message);
            }
        }


        // BAU backlog #17 (weekly capacity alerts) - matches Postgres's
        // date_trunc('week', ...), which truncates to the Monday of that
        // ISO week. Uses UTC methods throughout so the result never shifts
        // by a day depending on the browser's local timezone (event_date
        // is a plain DATE with no timezone of its own).
        function getWeekStartMonday(dateStr) {
            // event_date comes back from the API as a full ISO timestamp
            // ("2026-08-01T00:00:00.000Z"), not a plain "YYYY-MM-DD" -
            // Postgres DATE columns get parsed into a JS Date by the pg
            // driver, then serialized with a time+Z suffix by res.json().
            // Strip anything from 'T' onward first (same defensive pattern
            // as toDateStr() in routes/calendar.js) before rebuilding it as
            // UTC midnight, or appending 'T00:00:00Z' to an already-full
            // timestamp string produces an Invalid Date.
            const datePart = String(dateStr).split('T')[0];
            const d = new Date(datePart + 'T00:00:00Z');
            const day = d.getUTCDay();
            const diff = (day === 0 ? -6 : 1) - day;
            d.setUTCDate(d.getUTCDate() + diff);
            return d.toISOString().split('T')[0];
        }


        function highDemandWeekBadge(eventDate) {
            if (!eventDate || !highDemandWeeksCache.has(getWeekStartMonday(eventDate))) return '';
            return '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium ml-1">High Demand Week</span>';
        }


        function renderInquiries(inquiries) {
            const unreadList = document.getElementById('unreadInquiryList');
            const allList = document.getElementById('allInquiryList');
            const todayUnreadList = document.getElementById('todayUnreadList');
            const todayCancelList = document.getElementById('todayCancelList');

            if (!inquiries || inquiries.length === 0) {
                if (unreadList) unreadList.innerHTML = '<p class="text-sm text-gray-500">No unread inquiries</p>';
                if (allList) allList.innerHTML = '<p class="text-sm text-gray-500">No inquiries yet</p>';
                if (todayUnreadList) todayUnreadList.innerHTML = '<p class="text-sm text-gray-500">No unread inquiries</p>';
                if (todayCancelList) todayCancelList.innerHTML = '<p class="text-sm text-gray-500">No cancellation requests</p>';
                return;
            }

            const unread = inquiries.filter(i => !i.is_read);
            const cancelRequests = inquiries.filter(i => i.status === 'cancel_requested');

            // Today dashboard - same unread card markup, reused as-is
            if (todayUnreadList) {
                todayUnreadList.innerHTML = unread.length === 0
                    ? '<p class="text-sm text-gray-500">All caught up! No unread inquiries.</p>'
                    : unread.map(inq => `
                        <div class="bg-[#FFF8E7] border-l-4 border-gold rounded-xl p-3 text-sm cursor-pointer hover:shadow transition inquiry-card" onclick="viewInquiry(${inq.id})">
                            <div class="flex justify-between items-start">
                                <div>
                                    <strong>#${inq.id} - ${escapeHTML(inq.customer_name)}</strong>
                                    <span class="text-xs text-gray-400 ml-2">${formatDate(inq.created_at)}</span>
                                </div>
                                <button onclick="event.stopPropagation(); markAsRead(${inq.id})" class="bg-gold text-dark px-2 py-0.5 rounded text-xs font-medium hover:bg-yellow-600 transition">
                                    Mark Read
                                </button>
                            </div>
                            <div class="mt-1">${getInquiryStatusBadge(inq.status)}</div>
                            <div class="text-xs text-gray-500 mt-1">
                                ${escapeHTML(inq.event_type || '-')} | ${formatDate(inq.event_date)} | ${escapeHTML(inq.phone || '-')}
                            </div>
                        </div>
                    `).join('');
            }

            // Today dashboard - cancellation requests need admin review before
            // anything money-related happens, so they get their own panel
            // rather than being buried in the general inquiries list.
            if (todayCancelList) {
                todayCancelList.innerHTML = cancelRequests.length === 0
                    ? '<p class="text-sm text-gray-500">No cancellation requests.</p>'
                    : cancelRequests.map(inq => `
                        <div class="bg-orange-50 border-l-4 border-orange-400 rounded-xl p-3 text-sm cursor-pointer hover:shadow transition inquiry-card" onclick="viewInquiry(${inq.id})">
                            <div class="flex justify-between items-start">
                                <div>
                                    <strong>#${inq.id} - ${escapeHTML(inq.customer_name)}</strong>
                                    <span class="text-xs text-gray-400 ml-2">${formatDate(inq.created_at)}</span>
                                </div>
                            </div>
                            <div class="mt-1">${getInquiryStatusBadge(inq.status)}</div>
                            <div class="text-xs text-gray-500 mt-1">
                                ${escapeHTML(inq.event_type || '-')} | ${formatDate(inq.event_date)} | ${escapeHTML(inq.phone || '-')}
                            </div>
                            <div class="text-xs text-orange-700 mt-1">Review in Quotations/Inquiries tab to confirm cancellation and any refund.</div>
                        </div>
                    `).join('');
            }

            // Render UNREAD inquiries
            if (unreadList) {
                if (unread.length === 0) {
                    unreadList.innerHTML = '<p class="text-sm text-gray-500">All caught up! No unread inquiries.</p>';
                } else {
                    unreadList.innerHTML = unread.map(inq => `
                        <div class="bg-[#FFF8E7] border-l-4 border-gold rounded-xl p-3 text-sm cursor-pointer hover:shadow transition inquiry-card" onclick="viewInquiry(${inq.id})">
                            <div class="flex justify-between items-start">
                                <div>
                                    <strong>#${inq.id} - ${escapeHTML(inq.customer_name)}</strong>
                                    <span class="text-xs text-gray-400 ml-2">${formatDate(inq.created_at)}</span>
                                </div>
                                <button onclick="event.stopPropagation(); markAsRead(${inq.id})" class="bg-gold text-dark px-2 py-0.5 rounded text-xs font-medium hover:bg-yellow-600 transition">
                                    Mark Read
                                </button>
                            </div>
                            <div class="mt-1">${getInquiryStatusBadge(inq.status)}${highDemandWeekBadge(inq.event_date)}</div>
                            <div class="text-xs text-gray-500 mt-1">
                                ${escapeHTML(inq.event_type || '-')} | ${formatDate(inq.event_date)} | ${escapeHTML(inq.phone || '-')}
                            </div>
                            <div class="text-xs text-gray-400 mt-0.5 truncate">
                                ${inq.services_requested ? (typeof inq.services_requested === 'string' ? JSON.parse(inq.services_requested).join(', ') : inq.services_requested.join(', ')) : 'No services selected'}
                            </div>
                            <button onclick="event.stopPropagation(); generateQuotationFromCard(${inq.id})" class="mt-2 text-xs border border-gold text-dark px-3 py-1 rounded-full font-medium hover:bg-gold transition">
                                Generate Quotation
                            </button>
                        </div>
                    `).join('');
                }
            }

            // Render ALL inquiries (filtered)
            const searchTerm = document.getElementById('inquirySearch')?.value?.toLowerCase() || '';
            const statusFilter = document.getElementById('inquiryStatusFilter')?.value || '';
            
            const filtered = inquiries.filter(i => {
                const matchSearch = i.customer_name?.toLowerCase().includes(searchTerm) ||
                    i.phone?.includes(searchTerm) ||
                    i.event_type?.toLowerCase().includes(searchTerm) ||
                    String(i.id).includes(searchTerm);
                const matchStatus = statusFilter === '' ? true :
                    statusFilter === 'unread' ? !i.is_read :
                    statusFilter === 'read' ? i.is_read :
                    INQUIRY_STATUSES.includes(statusFilter) ? (i.status || 'new') === statusFilter : true;
                return matchSearch && matchStatus;
            });

            if (allList) {
                if (filtered.length === 0 && (searchTerm || statusFilter)) {
                    allList.innerHTML = '<p class="text-sm text-gray-500">No inquiries match your filters</p>';
                } else if (filtered.length === 0) {
                    allList.innerHTML = '<p class="text-sm text-gray-500">No inquiries yet</p>';
                } else {
                    allList.innerHTML = filtered.map(inq => `
                        <div class="bg-white rounded-xl p-3 text-sm border hover:shadow transition cursor-pointer inquiry-card ${inq.is_read ? '' : 'border-l-4 border-l-gold'}" onclick="viewInquiry(${inq.id})">
                            <div class="flex justify-between items-start">
                                <div class="flex items-start gap-2">
                                    <input type="checkbox" class="bulk-inquiry-checkbox mt-1" value="${inq.id}" onclick="event.stopPropagation(); updateBulkSelectedCount();" />
                                    <div>
                                        <strong>#${inq.id} - ${escapeHTML(inq.customer_name)}</strong>
                                        <span class="text-xs text-gray-400 ml-2">${formatDate(inq.created_at)}</span>
                                    </div>
                                </div>
                                <span class="text-xs ${inq.is_read ? 'text-gray-400' : 'text-gold font-medium'}">
                                    ${inq.is_read ? 'Read' : 'Unread'}
                                </span>
                            </div>
                            <div class="mt-1">${getInquiryStatusBadge(inq.status)}${highDemandWeekBadge(inq.event_date)}</div>
                            <div class="text-xs text-gray-500 mt-1">
                                ${escapeHTML(inq.event_type || '-')} | ${formatDate(inq.event_date)} | ${escapeHTML(inq.phone || '-')}
                            </div>
                            <div class="text-xs text-gray-400 mt-0.5 truncate">
                                ${inq.services_requested ? (typeof inq.services_requested === 'string' ? JSON.parse(inq.services_requested).join(', ') : inq.services_requested.join(', ')) : 'No services selected'}
                            </div>
                            <button onclick="event.stopPropagation(); generateQuotationFromCard(${inq.id})" class="mt-2 text-xs border border-gold text-dark px-3 py-1 rounded-full font-medium hover:bg-gold transition">
                                Generate Quotation
                            </button>
                        </div>
                    `).join('');
                }

                // BAU backlog #2 - only the first LIST_PAGE_SIZE rows are
                // fetched by default; this appears once there are more on
                // the server than have been loaded into allInquiries yet.
                if (inquiriesHasMore) {
                    allList.innerHTML += `
                        <div class="text-center py-3">
                            <button onclick="loadMoreInquiries()" class="bg-gray-100 hover:bg-gray-200 text-dark px-4 py-2 rounded-lg text-sm font-medium transition">
                                Load More (${allInquiries.length} of ${inquiriesTotalCount})
                            </button>
                        </div>
                    `;
                }
            }
        }


        function filterInquiries() {
            renderInquiries(allInquiries);
        }


        // ------------------------------------------------------------
        // BULK STATUS UPDATE (All Inquiries tab)
        // ------------------------------------------------------------
        function toggleSelectAllInquiries(checked) {
            document.querySelectorAll('.bulk-inquiry-checkbox').forEach(cb => cb.checked = checked);
            updateBulkSelectedCount();
        }


        function updateBulkSelectedCount() {
            const count = document.querySelectorAll('.bulk-inquiry-checkbox:checked').length;
            const el = document.getElementById('bulkSelectedCount');
            if (el) el.textContent = count > 0 ? `${count} selected` : '';
        }


        async function applyBulkStatus() {
            const ids = [...document.querySelectorAll('.bulk-inquiry-checkbox:checked')].map(cb => parseInt(cb.value));
            if (ids.length === 0) {
                alert('Select at least one inquiry first.');
                return;
            }
            const status = document.getElementById('bulkStatusSelect')?.value;
            if (!status) return;
            if (!confirm(`Set status to "${INQUIRY_STATUS_LABELS[status] || status}" for ${ids.length} inquiry(ies)?`)) return;

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/bulk-status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ ids, status })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Bulk update failed');
                }

                const selectAll = document.getElementById('selectAllInquiries');
                if (selectAll) selectAll.checked = false;
                await loadInquiries();
                updateBulkSelectedCount();
            } catch (err) {
                console.error('Bulk status update error:', err);
                alert('Error: ' + err.message);
            }
        }


        function renderCancellationPanel(q) {
            const refundStatus = q.refund_status || 'not_applicable';
            return `
                <div class="mt-3 pt-3 border-t border-red-100 bg-red-50 rounded-lg p-3 text-xs">
                    <div><span class="text-gray-500">Cancelled:</span> ${formatDateTime(q.cancelled_at)}</div>
                    <div class="mt-1"><span class="text-gray-500">Reason:</span> ${escapeHTML(q.cancellation_reason || 'Not specified')}</div>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                        <label class="font-medium">Refund:</label>
                        <select id="refundStatus_${q.id}" class="border rounded text-xs px-2 py-1">
                            ${Object.keys(REFUND_STATUS_LABELS).map(s =>
                                `<option value="${s}" ${refundStatus === s ? 'selected' : ''}>${REFUND_STATUS_LABELS[s]}</option>`
                            ).join('')}
                        </select>
                        <input type="number" id="refundAmount_${q.id}" placeholder="Amount (RM)" value="${q.refund_amount || ''}" class="border rounded text-xs px-2 py-1 w-28">
                        <button onclick="updateRefund(${q.id})" class="bg-dark text-white px-3 py-1 rounded text-xs hover:bg-gold hover:text-dark transition">Save</button>
                    </div>
                    ${q.refund_notes ? `<div class="mt-1 text-gray-500">Notes: ${escapeHTML(q.refund_notes)}</div>` : ''}
                    ${q.refunded_at ? `<div class="mt-1 text-gray-500">Refunded: ${formatDateTime(q.refunded_at)}</div>` : ''}
                </div>
            `;
        }


        // BAU backlog #7 - version history for inquiries (status changes,
        // notes), same append-only pattern and same UI shape as
        // viewQuotationHistory() above.
        async function viewInquiryHistory(id) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/versions`, {
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
                    throw new Error(err.error || 'Failed to load history');
                }

                const result = await res.json();
                const versions = result.data || [];

                document.getElementById('modalTitle').textContent = `Inquiry #${id} - Version History`;

                if (versions.length === 0) {
                    document.getElementById('modalBody').innerHTML = '<p class="text-sm text-gray-500">No version history found.</p>';
                } else {
                    let html = '<div class="space-y-3">';
                    versions.forEach((v, index) => {
                        const isLatest = index === 0;
                        html += `
                            <div class="border rounded-xl p-3 text-sm ${isLatest ? 'border-gold bg-yellow-50' : ''}">
                                <div class="flex justify-between items-center">
                                    <strong>Version ${v.version_number}${isLatest ? ' (current)' : ''}</strong>
                                    <span class="text-xs text-gray-400">${formatDateTime(v.created_at)}</span>
                                </div>
                                <div class="mt-2 text-xs">
                                    ${getInquiryStatusBadge(v.status)}
                                    <span class="text-gray-400 ml-1">${escapeHTML(v.change_type || '')}</span>
                                </div>
                                ${v.admin_notes ? `<div class="mt-1 text-xs text-gray-600">Notes: ${escapeHTML(v.admin_notes)}</div>` : ''}
                                <div class="mt-1 text-xs text-gray-400">By: ${escapeHTML(v.changed_by || 'unknown')}</div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    document.getElementById('modalBody').innerHTML = html;
                }

                document.getElementById('inquiryModal').classList.add('active');

            } catch (err) {
                console.error('History fetch error:', err);
                alert('Failed to load version history: ' + err.message);
            }
        }
