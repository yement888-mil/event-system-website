// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // BAU backlog #9 - System Health. Pure render job: all three
        // figures already exist server-side (see routes/backup.js's
        // GET /status), nothing new is tracked here.
        async function loadSystemHealth() {
            const el = document.getElementById('systemHealthList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-400 col-span-full">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/backup/status`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (res.status === 401) {
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    return;
                }
                if (!res.ok) throw new Error('Failed to load system health');

                const result = await res.json();
                const h = result.data || {};

                el.innerHTML = `
                    <div class="rounded-2xl p-4 ${h.backup_overdue ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}">
                        <h3 class="text-xs text-gray-500">Weekly Backup</h3>
                        <p class="text-lg font-bold mt-1 ${h.backup_overdue ? 'text-red-700' : 'text-emerald-700'}">
                            ${h.backup_overdue ? 'Overdue' : 'On Track'}
                        </p>
                        <p class="text-xs text-gray-500 mt-1">
                            ${h.last_backup_sent_at ? `Last sent ${formatDateTime(h.last_backup_sent_at)}` : 'Never sent yet'}
                        </p>
                        <p class="text-[10px] text-gray-400 mt-1">Expected every ${h.backup_interval_days || 7} days</p>
                    </div>
                    <div class="rounded-2xl p-4 ${h.failed_notification_count > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}">
                        <h3 class="text-xs text-gray-500">Failed Notifications (all time)</h3>
                        <p class="text-lg font-bold mt-1 ${h.failed_notification_count > 0 ? 'text-red-700' : 'text-emerald-700'}">
                            ${h.failed_notification_count || 0}
                        </p>
                        <p class="text-[10px] text-gray-400 mt-1">See the bell icon for details and to mark them read</p>
                    </div>
                `;

            } catch (err) {
                console.error('Load system health error:', err);
                el.innerHTML = '<p class="text-sm text-red-500 col-span-full">Failed to load system health.</p>';
            }
        }
