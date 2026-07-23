// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // ANALYTICS
        // ------------------------------------------------------------
        // Drop-off analytics (BAU backlog #13): computed entirely from
        // allInquiries, already loaded for the Unread/All Inquiries tabs -
        // no new endpoint needed. "Stale" means still in a non-terminal
        // pipeline stage with no update (status change, reschedule, note)
        // in 7+ days, the same staleness window used elsewhere in this app
        // (event reminders, quotation expiry).
        function updateFunnelAnalytics() {
            const countsEl = document.getElementById('funnelCounts');
            const staleEl = document.getElementById('staleLeadsList');
            if (!countsEl || !staleEl) return;

            const counts = {};
            INQUIRY_STATUSES.forEach(s => counts[s] = 0);
            allInquiries.forEach(i => {
                const s = i.status || 'new';
                counts[s] = (counts[s] || 0) + 1;
            });

            countsEl.innerHTML = INQUIRY_STATUSES.map(s => `
                <div class="bg-[#F8F8F8] rounded-xl p-3 text-center">
                    <p class="text-xs text-gray-400">${INQUIRY_STATUS_LABELS[s]}</p>
                    <p class="text-lg font-bold">${counts[s] || 0}</p>
                </div>
            `).join('');

            const nonTerminal = ['new', 'contacted', 'quotation_sent', 'waiting_deposit'];
            const now = new Date();
            const stale = allInquiries
                .filter(i => nonTerminal.includes(i.status || 'new') && i.updated_at && (now - new Date(i.updated_at)) / 86400000 >= 7)
                .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));

            staleEl.innerHTML = stale.length === 0
                ? '<p class="text-sm text-gray-500">No stale leads right now.</p>'
                : stale.map(i => {
                    const daysSince = Math.floor((now - new Date(i.updated_at)) / 86400000);
                    return `
                        <div class="flex justify-between items-center gap-2 border rounded-xl p-3 text-sm cursor-pointer hover:shadow transition" onclick="viewInquiry(${i.id})">
                            <div>
                                <strong>#${i.id} - ${escapeHTML(i.customer_name)}</strong>
                                <div class="mt-0.5">${getInquiryStatusBadge(i.status)}</div>
                            </div>
                            <span class="text-xs text-red-600 font-medium whitespace-nowrap">${daysSince} days stale</span>
                        </div>
                    `;
                }).join('');

            // BAU backlog #26 - simple report over inquiries.source. All-time,
            // same scope as the funnel counts above (not month-filtered).
            const sourceEl = document.getElementById('sourceBreakdown');
            if (sourceEl) {
                const sourceCounts = {};
                allInquiries.forEach(i => {
                    const s = i.source || 'Not specified';
                    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
                });
                const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
                sourceEl.innerHTML = sortedSources.map(([source, count]) => `
                    <div class="bg-[#F8F8F8] rounded-xl p-3 text-center">
                        <p class="text-xs text-gray-400">${escapeHTML(source)}</p>
                        <p class="text-lg font-bold">${count}</p>
                    </div>
                `).join('');
            }
        }


        function updateAnalytics() {
            updateFunnelAnalytics();

            const monthInput = document.getElementById('analyticsMonth');
            if (!monthInput || !monthInput.value) return;

            const [year, month] = monthInput.value.split('-').map(Number);
            
            const monthQuotations = allQuotations.filter(q => {
                if (!q.event_date) return false;
                const d = new Date(q.event_date);
                return d.getMonth() === (month - 1) && d.getFullYear() === year;
            });
            
            const revenueQuotations = monthQuotations.filter(q => 
                q.status === 'completed' || q.status === 'deposit_paid'
            );
            
            let totalRevenue = 0;
            let decoRevenue = 0;
            let photoRevenue = 0;
            let cateringRevenue = 0;
            let magicRevenue = 0;

            // BAU backlog #37 - margin, computed only from items that
            // actually have a snapshotted cost (see generateQuotation()).
            // Items without one contribute to revenue above as always,
            // but are deliberately left out of margin math entirely -
            // counting them as 0-cost would silently overstate margin
            // (a confident-sounding number built on missing data), and
            // this business is only just starting to record costs, so
            // most historical quotations won't have any yet. costTracked
            // item counts let the tile disclose its own coverage instead
            // of presenting a number that looks more complete than it is.
            let marginRevenue = 0;
            let marginCost = 0;
            let costTrackedItems = 0;
            let totalLineItems = 0;

            revenueQuotations.forEach(q => {
                totalRevenue += parseFloat(q.total) || 0;
                if (q.items && q.items.length > 0) {
                    q.items.forEach(item => {
                        const itemName = item.name.toLowerCase();
                        const price = parseFloat(item.price) || 0;
                        if (itemName.includes('decor') || itemName.includes('balloon') || itemName.includes('flower') || itemName.includes('backdrop') || itemName.includes('stage')) {
                            decoRevenue += price;
                        } else if (itemName.includes('photo') || itemName.includes('camera')) {
                            photoRevenue += price;
                        } else if (itemName.includes('cater') || itemName.includes('food') || itemName.includes('cake')) {
                            cateringRevenue += price;
                        } else if (itemName.includes('magic') || itemName.includes('show')) {
                            magicRevenue += price;
                        }

                        totalLineItems++;
                        if (item.cost !== undefined && item.cost !== null && item.cost !== '') {
                            costTrackedItems++;
                            marginRevenue += price;
                            marginCost += parseFloat(item.cost) || 0;
                        }
                    });
                }
            });

            const margin = marginRevenue - marginCost;

            // BAU backlog #27 - "most requested" vs "most profitable".
            // Revenue-by-category above only counts what actually
            // converted; this counts how often each service is *asked
            // about* at all (from inquiries.services_requested, same
            // event_date month scope as the revenue tiles), independent of
            // whether it ever became a paid booking.
            const monthInquiries = allInquiries.filter(i => {
                if (!i.event_date) return false;
                const d = new Date(i.event_date);
                return d.getMonth() === (month - 1) && d.getFullYear() === year;
            });
            const requestCounts = { deco: 0, photo: 0, catering: 0, magic: 0 };
            monthInquiries.forEach(i => {
                let requested = i.services_requested;
                if (typeof requested === 'string') {
                    try { requested = JSON.parse(requested); } catch (e) { requested = []; }
                }
                (requested || []).forEach(code => {
                    if (requestCounts[code] !== undefined) requestCounts[code]++;
                });
            });

            const totalEvents = monthQuotations.length;
            const completedEvents = monthQuotations.filter(q => q.status === 'completed').length;
            const pendingDeposits = monthQuotations
                .filter(q => q.status === 'waiting_deposit' || q.status === 'sent')
                .reduce((sum, q) => sum + (parseFloat(q.deposit) || 0), 0);
            
            const totalRevenueEl = document.getElementById('analyticsTotalRevenue');
            const marginEl = document.getElementById('analyticsMargin');
            const marginCoverageEl = document.getElementById('analyticsMarginCoverage');
            const decoEl = document.getElementById('analyticsDecoRevenue');
            const photoEl = document.getElementById('analyticsPhotoRevenue');
            const cateringEl = document.getElementById('analyticsCateringRevenue');
            const magicEl = document.getElementById('analyticsMagicRevenue');
            const decoReqEl = document.getElementById('analyticsDecoRequested');
            const photoReqEl = document.getElementById('analyticsPhotoRequested');
            const cateringReqEl = document.getElementById('analyticsCateringRequested');
            const magicReqEl = document.getElementById('analyticsMagicRequested');
            const eventsEl = document.getElementById('analyticsTotalEvents');
            const pendingEl = document.getElementById('analyticsPending');
            const completedEl = document.getElementById('analyticsCompleted');

            if (totalRevenueEl) totalRevenueEl.textContent = 'RM ' + totalRevenue;
            if (marginEl) marginEl.textContent = 'RM ' + margin;
            if (marginCoverageEl) {
                marginCoverageEl.textContent = totalLineItems === 0
                    ? 'No line items this month'
                    : `Based on ${costTrackedItems} of ${totalLineItems} line items with cost data`;
            }
            if (decoEl) decoEl.textContent = 'RM ' + decoRevenue;
            if (photoEl) photoEl.textContent = 'RM ' + photoRevenue;
            if (cateringEl) cateringEl.textContent = 'RM ' + cateringRevenue;
            if (magicEl) magicEl.textContent = 'RM ' + magicRevenue;
            if (decoReqEl) decoReqEl.textContent = `Requested ${requestCounts.deco} times`;
            if (photoReqEl) photoReqEl.textContent = `Requested ${requestCounts.photo} times`;
            if (cateringReqEl) cateringReqEl.textContent = `Requested ${requestCounts.catering} times`;
            if (magicReqEl) magicReqEl.textContent = `Requested ${requestCounts.magic} times`;
            if (eventsEl) eventsEl.textContent = totalEvents;
            if (pendingEl) pendingEl.textContent = 'RM ' + pendingDeposits;
            if (completedEl) completedEl.textContent = completedEvents;
            
            // Monthly chart
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                months.push(d);
            }
            
            const chartData = months.map(m => {
                const month = m.getMonth();
                const yr = m.getFullYear();
                return allQuotations.filter(q => {
                    if (!q.event_date) return false;
                    const d = new Date(q.event_date);
                    return d.getMonth() === month && d.getFullYear() === yr && 
                        (q.status === 'completed' || q.status === 'deposit_paid');
                }).reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);
            });
            
            const maxVal = Math.max(...chartData, 1);
            const chartHtml = chartData.map((val, index) => {
                const height = Math.round((val / maxVal) * 200);
                const monthName = months[index].toLocaleString('default', { month: 'short' });
                return `
                    <div class="flex-1 flex flex-col items-center">
                        <div class="w-full bg-gold/20 rounded-t" style="height: ${Math.max(height, 10)}px; min-height: 20px;">
                            <div class="w-full bg-gold rounded-t" style="height: ${Math.max(height, 10)}px; min-height: 20px;"></div>
                        </div>
                        <span class="text-xs text-gray-400 mt-1">${monthName}</span>
                        <span class="text-xs font-medium">RM ${val}</span>
                    </div>
                `;
            }).join('');
            
            const chartContainer = document.getElementById('monthlyChart');
            if (chartContainer) chartContainer.innerHTML = chartHtml;
        }


        // ------------------------------------------------------------
        // EXPORT EXCEL
        // ------------------------------------------------------------
        function exportExcel() {
            const monthInput = document.getElementById('analyticsMonth');
            if (!monthInput || !monthInput.value) {
                alert('Please select a month first');
                return;
            }
            
            const [year, month] = monthInput.value.split('-').map(Number);
            const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
            
            const monthQuotations = allQuotations.filter(q => {
                if (!q.event_date) return false;
                const d = new Date(q.event_date);
                return d.getMonth() === (month - 1) && d.getFullYear() === year;
            });
            
            if (monthQuotations.length === 0) {
                alert('No data available for this month');
                return;
            }
            
            const data = monthQuotations.map(q => {
                let servicesStr = '';
                if (q.items && q.items.length > 0) {
                    servicesStr = q.items.map(item => `${item.name}: RM${item.price || 0}`).join('; ');
                }
                
                return {
                    'Quotation ID': q.quotation_no || 'Q-' + String(q.id).padStart(5,'0'),
                    'Customer': q.customer_name || 'Unknown',
                    'Phone': q.phone || '-',
                    'Event Date': formatDate(q.event_date),
                    'Services': servicesStr,
                    'Total (RM)': parseFloat(q.total) || 0,
                    'Deposit (RM)': parseFloat(q.deposit) || 0,
                    'Balance (RM)': parseFloat(q.balance) || 0,
                    'Status': q.status || 'draft',
                    'Created': formatDateTime(q.created_at)
                };
            });
            
            const totalRevenue = data.reduce((sum, row) => sum + row['Total (RM)'], 0);
            const totalDeposits = data.reduce((sum, row) => sum + row['Deposit (RM)'], 0);
            const totalBalance = data.reduce((sum, row) => sum + row['Balance (RM)'], 0);
            
            data.push({
                'Quotation ID': '--- SUMMARY ---',
                'Customer': '',
                'Phone': '',
                'Event Date': '',
                'Services': '',
                'Total (RM)': totalRevenue,
                'Deposit (RM)': totalDeposits,
                'Balance (RM)': totalBalance,
                'Status': '',
                'Created': ''
            });
            
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Quotations');
            
            const colWidths = [
                { wch: 20 }, // Quotation ID
                { wch: 20 }, // Customer
                { wch: 15 }, // Phone
                { wch: 15 }, // Event Date
                { wch: 40 }, // Services
                { wch: 12 }, // Total
                { wch: 12 }, // Deposit
                { wch: 12 }, // Balance
                { wch: 15 }, // Status
                { wch: 20 }  // Created
            ];
            ws['!cols'] = colWidths;
            
            XLSX.writeFile(wb, `Quotations_${monthName}_${year}.xlsx`);
        }


        // ------------------------------------------------------------
        // FULL DATABASE BACKUP (customers, quotations, catalog, logs)
        // ------------------------------------------------------------
        async function downloadFullBackup() {
            const label = document.getElementById('backupBtnLabel');
            const originalText = label ? label.textContent : '';
            if (label) label.textContent = 'Preparing backup...';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/backup/full`, {
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

                if (!res.ok) throw new Error('Failed to generate backup');

                const result = await res.json();
                const data = result.data || {};

                const wb = XLSX.utils.book_new();

                function addSheet(rows, sheetName) {
                    // Flatten JSONB columns (items, details, services_requested) to
                    // readable text so they don't render as "[object Object]" in Excel.
                    const flatRows = (rows || []).map(row => {
                        const flat = {};
                        Object.keys(row).forEach(key => {
                            const val = row[key];
                            if (val !== null && typeof val === 'object') {
                                flat[key] = JSON.stringify(val);
                            } else {
                                flat[key] = val;
                            }
                        });
                        return flat;
                    });
                    const ws = XLSX.utils.json_to_sheet(flatRows.length > 0 ? flatRows : [{ note: 'No data' }]);
                    // Sheet names in Excel are capped at 31 characters
                    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
                }

                addSheet(data.inquiries, 'Inquiries');
                addSheet(data.quotations, 'Quotations');
                addSheet(data.quotation_versions, 'Quotation Versions');
                addSheet(data.services, 'Services');
                addSheet(data.pricing_items, 'Pricing Items');
                addSheet(data.packages, 'Packages');
                addSheet(data.package_items, 'Package Items');
                addSheet(data.activity_logs, 'Activity Log');
                addSheet(data.notification_logs, 'Notification Log');
                addSheet(data.customers, 'Customers');
                addSheet(data.gallery_items, 'Gallery');
                addSheet(data.faq_items, 'FAQ');
                addSheet(data.tasks, 'Tasks');

                const dateStr = new Date().toISOString().split('T')[0];
                XLSX.writeFile(wb, `Full_Backup_${dateStr}.xlsx`);

            } catch (err) {
                console.error('Backup download error:', err);
                alert('Failed to download backup: ' + err.message);
            } finally {
                if (label) label.textContent = originalText;
            }
        }
