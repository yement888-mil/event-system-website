// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        async function loadNotificationCenter() {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/notifications/failures`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load notifications');

                const result = await res.json();
                notificationCenterCache.failures = result.data || [];
                notificationCenterCache.unreadCount = result.unread_count || 0;
                updateNotificationBadge();
                if (notificationPanelOpen) renderNotificationPanel();
            } catch (err) {
                console.error('Load notification center error:', err);
            }
        }


        function updateNotificationBadge() {
            const badge = document.getElementById('notificationBadge');
            if (!badge) return;
            const count = notificationCenterCache.unreadCount;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : String(count);
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }


        function toggleNotificationCenter() {
            const panel = document.getElementById('notificationPanel');
            if (!panel) return;
            notificationPanelOpen = panel.classList.contains('hidden');
            panel.classList.toggle('hidden');
            if (notificationPanelOpen) renderNotificationPanel();
        }


        // Closes the panel on an outside click, standard dropdown UX -
        // ignores clicks on the bell button itself since that already
        // toggles the panel via toggleNotificationCenter().
        document.addEventListener('click', function(e) {
            if (!notificationPanelOpen) return;
            const panel = document.getElementById('notificationPanel');
            if (panel && !panel.contains(e.target) && !e.target.closest('[onclick="toggleNotificationCenter()"]')) {
                panel.classList.add('hidden');
                notificationPanelOpen = false;
            }
        });


        // "Since you're here" recap - a snapshot of counts already computed
        // elsewhere (unread inquiries, pending cancellations, stale leads),
        // not a new delta-since-last-visit tracking system. This project's
        // own CLAUDE.md already rejected a real-time activity feed in favor
        // of "a polling read of data already on hand" - this is that, for
        // the notification panel specifically.
        function renderNotificationPanel() {
            const el = document.getElementById('notificationPanelContent');
            if (!el) return;

            const unreadInquiries = allInquiries.filter(i => !i.is_read).length;
            const pendingCancellations = allInquiries.filter(i => i.status === 'cancel_requested').length;
            const nonTerminal = ['new', 'contacted', 'quotation_sent', 'waiting_deposit'];
            const now = new Date();
            const staleCount = allInquiries.filter(i =>
                nonTerminal.includes(i.status || 'new') && i.updated_at && (now - new Date(i.updated_at)) / 86400000 >= 7
            ).length;

            const recapHtml = `
                <div class="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div class="bg-gray-50 rounded-xl p-2">
                        <p class="text-lg font-bold">${unreadInquiries}</p>
                        <p class="text-[10px] text-gray-400">Unread</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-2">
                        <p class="text-lg font-bold">${pendingCancellations}</p>
                        <p class="text-[10px] text-gray-400">Cancel Requests</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-2">
                        <p class="text-lg font-bold">${staleCount}</p>
                        <p class="text-[10px] text-gray-400">Stale Leads</p>
                    </div>
                </div>
            `;

            const failures = notificationCenterCache.failures;
            const failuresHtml = failures.length === 0
                ? '<p class="text-sm text-gray-400">No failed sends.</p>'
                : `
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="text-xs font-semibold text-gray-500">Failed Sends</h4>
                        ${notificationCenterCache.unreadCount > 0 ? `<button onclick="markAllNotificationsRead()" class="text-xs text-gold hover:underline">Mark all read</button>` : ''}
                    </div>
                    ${failures.map(n => `
                        <div class="flex justify-between items-start gap-2 border ${n.read_at ? 'border-gray-200' : 'border-red-300 bg-red-50'} rounded-xl p-2 text-xs mb-1.5">
                            <div>
                                <strong>${escapeHTML(n.channel)}</strong>
                                <span class="text-gray-500 ml-1">to ${escapeHTML(n.customer_name || 'unknown customer')}</span>
                                <div class="text-red-600 mt-0.5">${escapeHTML(n.error_message || 'No error detail recorded')}</div>
                                <div class="text-gray-400 mt-0.5">${formatDateTime(n.sent_at)}</div>
                            </div>
                            ${!n.read_at ? `<button onclick="markNotificationRead(${n.id})" class="text-gray-400 hover:text-gray-600 whitespace-nowrap">Mark read</button>` : ''}
                        </div>
                    `).join('')}
                `;

            el.innerHTML = `
                <h3 class="font-semibold text-sm mb-2">Since you're here</h3>
                ${recapHtml}
                ${failuresHtml}
            `;
        }


        async function markNotificationRead(id) {
            try {
                await fetch(`${CONFIG.API_URL}/api/notifications/failures/${id}/read`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                await loadNotificationCenter();
            } catch (err) {
                console.error('Mark notification read error:', err);
            }
        }


        async function markAllNotificationsRead() {
            try {
                await fetch(`${CONFIG.API_URL}/api/notifications/failures/mark-all-read`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                await loadNotificationCenter();
            } catch (err) {
                console.error('Mark all notifications read error:', err);
            }
        }


        function sendCustomerReminder(event) {
            const phone = (event.phone || '').replace(/[^0-9]/g, '');
            if (!phone) {
                alert('This customer has no phone number on file.');
                return;
            }

            const fallback = `Hi {{customer_name}},\n\nJust a friendly reminder that your event ({{event_type}}) is coming up soon on {{event_date}}.\n\nGuests: {{guest_count}} pax\nQuotation: {{quotation_no}}\n\nWe're looking forward to it! Let us know if there's anything you need before the day.\n\nThank you.`;
            const msg = renderTemplate(getTemplateBody('event_reminder', fallback), {
                customer_name: event.customer_name,
                event_type: event.event_type || 'event',
                event_date: formatDate(event.event_date),
                guest_count: event.guest_count || '-',
                quotation_no: event.quotation_no || '-'
            });

            const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        }
