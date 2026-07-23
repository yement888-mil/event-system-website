// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        async function loadCustomers() {
            const el = document.getElementById('customersList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-400">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/customers`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (res.status === 401) {
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    return;
                }
                if (!res.ok) throw new Error('Failed to load customers');

                const result = await res.json();
                allCustomers = result.data || [];
                renderCustomers(allCustomers);

            } catch (err) {
                console.error('Load customers error:', err);
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load customers.</p>';
            }
        }


        function renderCustomers(customers) {
            const el = document.getElementById('customersList');
            if (!el) return;
            if (customers.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No customers yet.</p>';
                return;
            }
            el.innerHTML = customers.map(c => {
                const inquiryCount = parseInt(c.inquiry_count) || 0;
                const isRepeat = inquiryCount > 1;
                return `
                    <div onclick="viewCustomerDetail(${c.id})" class="flex flex-wrap justify-between items-center gap-2 border rounded-xl p-3 text-sm cursor-pointer hover:border-gold transition">
                        <div>
                            <strong>${escapeHTML(c.name || 'Unknown')}</strong>
                            ${isRepeat ? `<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2">Repeat customer</span>` : ''}
                            <div class="text-xs text-gray-400 mt-0.5">${escapeHTML(c.phone)}</div>
                        </div>
                        <div class="text-xs text-gray-500 text-right">
                            <div>${inquiryCount} inquir${inquiryCount === 1 ? 'y' : 'ies'} - ${c.quotation_count || 0} quotation${c.quotation_count == 1 ? '' : 's'}</div>
                            <div class="text-gray-400">Last: ${c.last_inquiry_at ? formatDate(c.last_inquiry_at) : '-'}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }


        function filterCustomers() {
            const query = document.getElementById('customerSearchInput').value.toLowerCase();
            const filtered = allCustomers.filter(c =>
                (c.name || '').toLowerCase().includes(query) ||
                (c.phone || '').includes(query)
            );
            renderCustomers(filtered);
        }


        async function viewCustomerDetail(id) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/customers/${id}`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to load customer');
                const result = await res.json();
                const { customer, history } = result.data;
                currentCustomerDetail = { customer, history };

                document.getElementById('modalTitle').textContent = customer.name || 'Customer';

                // BAU backlog #28 - Customer Lifetime Value. Only sums
                // money actually received (deposit_paid/completed), not
                // draft/sent quotations that were quoted but never paid -
                // summing those would overstate this customer's real value.
                const totalSpent = history
                    .filter(h => h.quotation_status === 'deposit_paid' || h.quotation_status === 'completed')
                    .reduce((sum, h) => sum + (parseFloat(h.total) || 0), 0);

                const historyHtml = history.map(h => `
                    <div class="border rounded-xl p-3 text-sm mb-2">
                        <div class="flex justify-between items-center">
                            <strong>${escapeHTML(h.event_type || 'Inquiry')}</strong>
                            ${getInquiryStatusBadge(h.status)}
                        </div>
                        <div class="text-xs text-gray-400 mt-1">${formatDate(h.event_date)} - submitted ${formatDateTime(h.created_at)}</div>
                        ${h.quotation_no ? `<div class="text-xs mt-1">Quotation: <strong>${escapeHTML(h.quotation_no)}</strong> ${getStatusBadge(h.quotation_status)} - RM ${h.total || 0}</div>` : '<div class="text-xs text-gray-400 mt-1">No quotation yet</div>'}
                        <button onclick='copyAsNewInquiry(${JSON.stringify(h).replace(/'/g, "&#39;")})' class="mt-2 text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-full font-medium hover:bg-gray-100 transition">
                            Copy as New Booking (recurring event)
                        </button>
                    </div>
                `).join('') || '<p class="text-sm text-gray-400">No history found.</p>';

                document.getElementById('modalBody').innerHTML = `
                    <div class="mb-4">
                        <div class="text-sm"><strong>Phone:</strong> ${escapeHTML(customer.phone)}</div>
                        <div class="text-sm mt-1"><strong>Email:</strong> ${escapeHTML(customer.email || '-')}</div>
                        <div class="text-sm mt-1"><strong>Customer since:</strong> ${formatDate(customer.first_seen_at)}</div>
                        <div class="text-sm mt-1"><strong>Total Spent:</strong> RM ${totalSpent} <span class="text-xs text-gray-400">(deposit-paid/completed bookings only)</span></div>
                    </div>
                    <div class="mb-4">
                        <label class="text-sm font-medium">Notes</label>
                        <textarea id="customerNotesInput" rows="2" class="w-full border rounded-xl px-3 py-2 text-sm mt-1">${escapeHTML(customer.notes || '')}</textarea>
                        <button onclick="saveCustomerNotes(${customer.id})" class="mt-2 bg-gold text-dark px-3 py-1.5 rounded-full text-xs font-medium hover:bg-yellow-600 transition">Save Notes</button>
                    </div>
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="font-semibold text-sm">Booking History (${history.length})</h3>
                        <button onclick="exportCustomerHistoryPDF()" class="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-full font-medium hover:bg-gray-100 transition">
                            Export PDF
                        </button>
                    </div>
                    ${historyHtml}
                `;
                document.getElementById('inquiryModal').classList.add('active');

            } catch (err) {
                alert('Failed to load customer: ' + err.message);
            }
        }


        // Exports the currently open customer's full booking history to a
        // PDF - reuses the same jsPDF/autoTable setup as the quotation PDF
        // (buildAndDownloadPDF above) for a consistent look.
        function exportCustomerHistoryPDF() {
            if (!currentCustomerDetail) {
                alert('Open a customer first.');
                return;
            }
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) {
                alert('PDF library failed to load. Please check your internet connection and try again.');
                return;
            }

            const { customer, history } = currentCustomerDetail;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('Event Management System', 14, 20);
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('Event Decoration & Styling', 14, 26);

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('CUSTOMER HISTORY', pageWidth - 14, 20, { align: 'right' });
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(customer.name || '-', pageWidth - 14, 26, { align: 'right' });

            doc.setDrawColor(200);
            doc.line(14, 35, pageWidth - 14, 35);

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Customer', 14, 44);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.text(`Phone: ${customer.phone || '-'}`, 14, 50);
            doc.text(`Email: ${customer.email || '-'}`, 14, 55);
            doc.text(`Customer since: ${formatDate(customer.first_seen_at)}`, 14, 60);

            doc.autoTable({
                startY: 68,
                head: [['Event Date', 'Event Type', 'Status', 'Quotation', 'Total (RM)']],
                body: history.map(h => [
                    formatDate(h.event_date),
                    h.event_type || '-',
                    (INQUIRY_STATUS_LABELS[h.status] || h.status || '-'),
                    h.quotation_no || '-',
                    h.total ? Number(h.total).toFixed(2) : '-'
                ]),
                theme: 'grid',
                headStyles: { fillColor: [201, 168, 76], textColor: [26, 26, 26] },
                styles: { fontSize: 9 },
                columnStyles: { 4: { halign: 'right' } }
            });

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generated: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`, 14, doc.internal.pageSize.getHeight() - 10);

            const fileName = `Customer_History_${(customer.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            doc.save(fileName);
        }


        // "Copy previous year's event" quick-start for recurring annual
        // clients (BAU backlog #12). Takes a past history entry from the
        // currently-open customer, asks only for the new date, and creates
        // a brand new inquiry from it - it re-enters the normal pipeline
        // (Unread/All Inquiries -> Generate Quotation) from there, exactly
        // like any customer-submitted inquiry would.
        async function copyAsNewInquiry(historyEntry) {
            if (!currentCustomerDetail) return;
            const { customer } = currentCustomerDetail;

            const newDate = prompt(`New event date for this recurring booking (YYYY-MM-DD):`, '');
            if (!newDate) return;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                alert('Please enter the date as YYYY-MM-DD.');
                return;
            }

            let servicesRequested = historyEntry.services_requested;
            if (typeof servicesRequested === 'string') {
                try { servicesRequested = JSON.parse(servicesRequested); } catch (e) { servicesRequested = []; }
            }

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/admin-create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({
                        customer_name: customer.name,
                        phone: customer.phone,
                        event_type: historyEntry.event_type,
                        event_date: newDate,
                        guest_count: historyEntry.guest_count,
                        services_requested: servicesRequested || [],
                        message: `Recurring booking - copied from ${historyEntry.event_type || 'previous event'} on ${formatDate(historyEntry.event_date)}.`
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to create inquiry');
                }

                const result = await res.json();
                closeModal();
                await loadInquiries();
                alert(`New inquiry #${result.data.id} created for ${formatDate(newDate)}. Continue as usual from Unread/All Inquiries.`);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function saveCustomerNotes(id) {
            try {
                const notes = document.getElementById('customerNotesInput').value;
                const res = await fetch(`${CONFIG.API_URL}/api/customers/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ notes })
                });
                if (!res.ok) throw new Error('Failed to save notes');
                await loadCustomers();
                alert('Notes saved.');
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
