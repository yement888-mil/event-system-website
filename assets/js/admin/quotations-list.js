// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // EDIT EXISTING QUOTATION
        // ------------------------------------------------------------
        function editQuotation(id) {
            const q = allQuotations.find(x => x.id === id);
            if (!q) return;

            selectedInquiry = {
                id: q.inquiry_id,
                customer_name: q.customer_name,
                phone: q.phone,
                event_type: q.event_type,
                event_date: q.event_date,
                guest_count: q.guest_count
            };
            editingQuotationId = q.id;
            editingQuotationVersion = q.current_version;

            switchTab('generate');
            document.getElementById('quotationForm').classList.remove('hidden');

            document.getElementById('inquiryPreview').innerHTML = `
                <strong>#${q.inquiry_id} - ${escapeHTML(q.customer_name || 'Unknown')}</strong><br>
                ${escapeHTML(q.event_type || '-')} | ${formatDate(q.event_date)}
                <br>Phone: ${escapeHTML(q.phone || '-')}
                <br><span class="text-gold font-medium">Editing ${q.quotation_no || 'Quotation #' + q.id}</span>
            `;

            let items = q.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch (e) { items = []; }
            }
            const container = document.getElementById('serviceRows');
            container.innerHTML = '';
            if (Array.isArray(items) && items.length > 0) {
                items.forEach(item => addServiceRow(item.name, item.price, item.cost));
            } else {
                addServiceRow('', '');
            }
            calculate();

            document.getElementById('whatsappOutput').classList.add('hidden');
            document.getElementById('copyBtn').classList.add('hidden');
            document.getElementById('copyFromQuotationBox')?.classList.add('hidden');
            document.getElementById('inquirySearchResult').innerHTML = '';
            document.getElementById('inquiryIdSearch').value = '';

            const saveText = document.getElementById('saveQuotationText');
            if (saveText) saveText.innerText = 'Update Quotation';
            const cancelBtn = document.getElementById('cancelEditBtn');
            if (cancelBtn) cancelBtn.classList.remove('hidden');

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }


        function cancelEditQuotation() {
            editingQuotationId = null;
            editingQuotationVersion = null;
            selectedInquiry = null;
            document.getElementById('quotationForm').classList.add('hidden');
            const cancelBtn = document.getElementById('cancelEditBtn');
            if (cancelBtn) cancelBtn.classList.add('hidden');
            const saveText = document.getElementById('saveQuotationText');
            if (saveText) saveText.innerText = 'Generate & Save Quotation';
            const container = document.getElementById('serviceRows');
            if (container) {
                container.innerHTML = '';
                addServiceRow('', '');
            }
            calculate();
        }


        // ------------------------------------------------------------
        // LOAD QUOTATIONS
        // ------------------------------------------------------------
        // BAU backlog #13 - see inquiryFilterParams() above, same reasoning:
        // only ever set by applyQuotationFilters(), never read live from
        // the search box.
        function quotationFilterParams(extra) {
            const params = new URLSearchParams(extra);
            if (quotationServerFilters.search) params.set('search', quotationServerFilters.search);
            if (quotationServerFilters.revenueMin !== '') params.set('revenue_min', quotationServerFilters.revenueMin);
            if (quotationServerFilters.revenueMax !== '') params.set('revenue_max', quotationServerFilters.revenueMax);
            return params.toString();
        }


        async function applyQuotationFilters() {
            quotationServerFilters = {
                search: document.getElementById('quotationSearch')?.value?.trim() || '',
                revenueMin: document.getElementById('quotationRevenueMin')?.value || '',
                revenueMax: document.getElementById('quotationRevenueMax')?.value || ''
            };
            await loadQuotations();
        }


        function clearQuotationFilters() {
            const min = document.getElementById('quotationRevenueMin');
            const max = document.getElementById('quotationRevenueMax');
            if (min) min.value = '';
            if (max) max.value = '';
            quotationServerFilters = { search: '', revenueMin: '', revenueMax: '' };
            loadQuotations();
        }


        async function loadQuotations() {
            const historyEl = document.getElementById('quotationHistory');

            // Show loading state
            if (historyEl) {
                historyEl.innerHTML = `
                    <div class="text-center py-8">
                        <div class="loading-spinner"></div>
                        <p class="text-sm text-gray-500 mt-2">Loading quotations...</p>
                    </div>
                `;
            }

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation?${quotationFilterParams({ limit: LIST_PAGE_SIZE, offset: 0 })}`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (res.status === 401) {
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    return;
                }

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to load quotations');
                }

                const data = await res.json();
                allQuotations = (data.data || []).map(q => {
                    if (typeof q.items === 'string') {
                        try { q.items = JSON.parse(q.items); } catch (e) { q.items = []; }
                    }
                    return q;
                });
                quotationsOffset = allQuotations.length;
                quotationsHasMore = !!data.pagination?.has_more;
                quotationsTotalCount = data.pagination?.total ?? allQuotations.length;
                filteredQuotations = [...allQuotations];
                renderQuotations(filteredQuotations);
                updateStats();
                updateAnalytics();
            } catch (err) {
                console.error('Load quotations error:', err);
                if (historyEl) historyEl.innerHTML = `<p class="text-red-500 text-sm">Error: ${err.message}</p>`;
            }
        }


        // Appends the next page to the already-loaded allQuotations (BAU
        // backlog #2), same pattern as loadMoreInquiries above.
        async function loadMoreQuotations() {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation?${quotationFilterParams({ limit: LIST_PAGE_SIZE, offset: quotationsOffset })}`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to load more quotations');
                }

                const data = await res.json();
                const nextPage = (data.data || []).map(q => {
                    if (typeof q.items === 'string') {
                        try { q.items = JSON.parse(q.items); } catch (e) { q.items = []; }
                    }
                    return q;
                });
                allQuotations = allQuotations.concat(nextPage);
                quotationsOffset = allQuotations.length;
                quotationsHasMore = !!data.pagination?.has_more;
                quotationsTotalCount = data.pagination?.total ?? allQuotations.length;
                filteredQuotations = [...allQuotations];
                renderQuotations(filteredQuotations);
                updateStats();
                updateAnalytics();
            } catch (err) {
                console.error('Load more quotations error:', err);
                alert('Failed to load more quotations: ' + err.message);
            }
        }


        async function updateRefund(id) {
            try {
                const statusSelect = document.getElementById(`refundStatus_${id}`);
                const amountInput = document.getElementById(`refundAmount_${id}`);
                if (!statusSelect) return;

                const notes = ['partial', 'denied'].includes(statusSelect.value)
                    ? prompt('Any notes on this refund? (optional)') || ''
                    : '';

                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${id}/refund`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({
                        refund_status: statusSelect.value,
                        refund_amount: amountInput?.value ? parseFloat(amountInput.value) : null,
                        refund_notes: notes
                    })
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
                    throw new Error(err.error || 'Failed to update refund');
                }

                await loadQuotations();

            } catch (err) {
                console.error('Update refund error:', err);
                alert('Failed to update refund: ' + err.message);
            }
        }


        function renderQuotations(quotations) {
            const box = document.getElementById('quotationHistory');
            if (!box) return;
            
            if (!quotations || quotations.length === 0) {
                box.innerHTML = '<p class="text-sm text-gray-500">No quotations yet</p>';
                return;
            }
            
            let html = '';
            quotations.forEach(q => {
                const statusOptions = ['draft', 'sent', 'waiting_deposit', 'deposit_paid', 'completed', 'cancelled', 'expired'];
                let optionsHtml = '';
                statusOptions.forEach(s => {
                    const selected = q.status === s ? 'selected' : '';
                    optionsHtml += `<option ${selected} value="${s}">${s}</option>`;
                });
                
                let servicesHtml = '';
                if (q.items && q.items.length > 0) {
                    servicesHtml = q.items.map(item =>
                        `<span class="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs mr-1">${escapeHTML(item.name)}: RM ${item.price || 0}</span>`
                    ).join(' ');
                }
                
                html += `
                    <div class="border rounded-xl p-4 text-sm" id="quotation_${q.id}">
                        <div class="flex flex-wrap justify-between items-start gap-2">
                            <div>
                                <strong class="text-base">#${q.id} - ${escapeHTML(q.customer_name || 'Unknown')}</strong>
                                ${q.phone ? `<span class="text-gray-400 text-xs">| ${escapeHTML(q.phone)}</span>` : ''}
                            </div>
                            <span class="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">${q.quotation_no || 'Q-' + String(q.id).padStart(5,'0')}</span>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                            <div><span class="text-gray-400">Event:</span> ${formatDate(q.event_date)}</div>
                            <div><span class="text-gray-400">Total:</span> <strong>RM ${q.total || 0}</strong></div>
                            <div><span class="text-gray-400">Deposit:</span> RM ${q.deposit || 0}</div>
                            <div><span class="text-gray-400">Balance:</span> RM ${q.balance || 0}</div>
                        </div>
                        <div class="mt-2 text-xs">
                            <span class="text-gray-400">Services:</span>
                            <div class="mt-1">${servicesHtml || '-'}</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 mt-2 text-xs">
                            <label class="text-gray-400">Venue:</label>
                            <input type="text" id="venue_${q.id}" value="${escapeHTML(q.venue || '')}" placeholder="e.g. Grand Ballroom, KL" class="border rounded px-2 py-1 text-xs w-48">
                            <label class="text-gray-400">Time:</label>
                            <input type="text" id="eventTime_${q.id}" value="${escapeHTML(q.event_time || '')}" placeholder="e.g. 2:00 PM - 6:00 PM" class="border rounded px-2 py-1 text-xs w-40">
                            <button onclick="saveQuotationLogistics(${q.id})" class="bg-gray-200 text-dark px-3 py-0.5 rounded text-xs hover:bg-gray-300 transition">Save</button>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 mt-3">
                            <label class="text-xs font-medium">Status:</label>
                            <select id="status_${q.id}" class="border rounded text-xs px-2 py-1">
                                ${optionsHtml}
                            </select>
                            <button onclick="updateQuotationStatus(${q.id})" class="bg-gold text-dark px-3 py-0.5 rounded text-xs font-medium hover:bg-yellow-600 transition">
                                Update
                            </button>
                            <button onclick="viewQuotationHistory(${q.id})" class="bg-gray-200 text-dark px-3 py-0.5 rounded text-xs hover:bg-gray-300 transition">History</button>
                            <button onclick="editQuotation(${q.id})" class="bg-blue-100 text-blue-700 px-3 py-0.5 rounded text-xs hover:bg-blue-200 transition">Edit</button>
                            ${adminRole === 'owner' ? `
                            <button onclick="sendQuotationToCustomer(${q.id})" class="bg-green-100 text-green-700 px-3 py-0.5 rounded text-xs hover:bg-green-200 transition" title="Generates the PDF, emails it if the customer has an email on file, opens WhatsApp with a link ready to send, and marks this quotation as sent.">Send Quotation</button>
                            ` : ''}
                            <button onclick="copyBookingLink('${q.booking_token || ''}')" class="bg-purple-100 text-purple-700 px-3 py-0.5 rounded text-xs hover:bg-purple-200 transition">Copy Booking Link</button>
                            <button onclick="regenerateBookingToken(${q.id})" title="${q.booking_token_expires_at ? 'Expires ' + formatDateTime(q.booking_token_expires_at) : ''}" class="bg-purple-50 text-purple-700 px-3 py-0.5 rounded text-xs border border-purple-200 hover:bg-purple-100 transition">Regenerate Link</button>
                            <button onclick="toggleTaskChecklist(${q.id})" class="bg-emerald-100 text-emerald-700 px-3 py-0.5 rounded text-xs hover:bg-emerald-200 transition">Tasks</button>
                            <button onclick="togglePropsPanel(${q.id})" class="bg-amber-100 text-amber-700 px-3 py-0.5 rounded text-xs hover:bg-amber-200 transition">Props</button>
                            ${(q.status === 'deposit_paid' || q.status === 'completed') ? `
                            <button onclick="buildAndDownloadRunSheetPDF(${q.id})" class="bg-indigo-100 text-indigo-700 px-3 py-0.5 rounded text-xs hover:bg-indigo-200 transition">Run Sheet PDF</button>
                            ` : ''}
                            <button onclick="deleteQuotation(${q.id})" class="bg-red-600 text-white px-3 py-0.5 rounded text-xs hover:bg-red-700 transition">Delete</button>
                        </div>
                        <div id="taskPanel_${q.id}" class="hidden mt-3 pt-3 border-t border-gray-100">
                            ${taskTemplatesCache.length > 0 ? `
                                <!-- BAU backlog #25 - manual apply, same as
                                     Package Templates in the quotation
                                     builder: pick one, click Apply, it
                                     loops client-side and creates each
                                     item via the same POST /api/tasks used
                                     by the Add button below. -->
                                <div class="flex gap-2 mb-2">
                                    <select id="applyTplSelect_${q.id}" class="flex-1 border rounded-xl px-2 py-1.5 text-xs">
                                        <option value="">Apply a task template...</option>
                                        ${taskTemplatesCache.filter(t => t.active !== false).map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join('')}
                                    </select>
                                    <button onclick="applyTaskTemplate(${q.id})" class="bg-gray-100 text-dark px-3 py-1.5 rounded-xl text-xs hover:bg-gray-200 transition whitespace-nowrap">Apply</button>
                                </div>
                            ` : ''}
                            <div class="flex gap-2 mb-2">
                                <input type="text" id="newTaskInput_${q.id}" placeholder="Add a task (e.g. confirm caterer)" class="flex-1 border rounded-xl px-3 py-1.5 text-xs" onkeydown="if(event.key==='Enter') addTask(${q.id})">
                                <select id="newTaskAssignee_${q.id}" class="border rounded-xl px-2 py-1.5 text-xs">
                                    <option value="">Unassigned</option>
                                    ${adminUsernamesCache.map(u => `<option value="${u.id}">${escapeHTML(u.username)}</option>`).join('')}
                                </select>
                                <button onclick="addTask(${q.id})" class="bg-dark text-white px-3 py-1.5 rounded-xl text-xs hover:bg-gold hover:text-dark transition">Add</button>
                            </div>
                            <div id="taskList_${q.id}" class="space-y-1"></div>
                        </div>
                        <div id="propsPanel_${q.id}" class="hidden mt-3 pt-3 border-t border-gray-100">
                            <div class="flex gap-2 mb-2">
                                <select id="newPropSelect_${q.id}" class="flex-1 border rounded-xl px-2 py-1.5 text-xs">
                                    <option value="">Select a prop...</option>
                                    ${propsCache.filter(p => p.active !== false).map(p => `<option value="${p.id}">${escapeHTML(p.name)} (${p.quantity_available} available)</option>`).join('')}
                                </select>
                                <input type="number" id="newPropQty_${q.id}" placeholder="Qty" min="1" value="1" class="w-16 border rounded-xl px-2 py-1.5 text-xs">
                                <button onclick="addPropToQuotation(${q.id})" class="bg-dark text-white px-3 py-1.5 rounded-xl text-xs hover:bg-gold hover:text-dark transition">Add</button>
                            </div>
                            <div id="propsQuotationList_${q.id}" class="space-y-1"></div>
                        </div>
                        ${q.status === 'cancelled' ? renderCancellationPanel(q) : ''}
                    </div>
                `;
            });

            // BAU backlog #2 - only the first LIST_PAGE_SIZE rows are
            // fetched by default; this appears once there are more on the
            // server than have been loaded into allQuotations yet.
            if (quotationsHasMore) {
                html += `
                    <div class="text-center py-3">
                        <button onclick="loadMoreQuotations()" class="bg-gray-100 hover:bg-gray-200 text-dark px-4 py-2 rounded-lg text-sm font-medium transition">
                            Load More (${allQuotations.length} of ${quotationsTotalCount})
                        </button>
                    </div>
                `;
            }

            box.innerHTML = html;
        }


        function filterQuotations() {
            const search = document.getElementById('quotationSearch')?.value?.toLowerCase() || '';
            const status = document.getElementById('statusFilter')?.value || '';
            
            filteredQuotations = allQuotations.filter(q => {
                const matchSearch = q.customer_name?.toLowerCase().includes(search) || 
                    String(q.id).includes(search) ||
                    (q.quotation_no || '').toLowerCase().includes(search);
                const matchStatus = status ? q.status === status : true;
                return matchSearch && matchStatus;
            });
            
            renderQuotations(filteredQuotations);
        }


        // ---- Props assigned to a booking (BAU backlog #38) ----
        // Same show/hide-panel pattern as the Tasks checklist above.
        async function togglePropsPanel(quotationId) {
            const panel = document.getElementById(`propsPanel_${quotationId}`);
            if (!panel) return;
            const isHidden = panel.classList.contains('hidden');
            panel.classList.toggle('hidden');
            if (isHidden) {
                await loadQuotationProps(quotationId);
            }
        }


        async function loadQuotationProps(quotationId) {
            const listEl = document.getElementById(`propsQuotationList_${quotationId}`);
            if (!listEl) return;
            listEl.innerHTML = '<p class="text-xs text-gray-400">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${quotationId}/props`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to load props');
                const result = await res.json();
                renderQuotationProps(quotationId, result.data || []);
            } catch (err) {
                listEl.innerHTML = '<p class="text-xs text-red-500">Failed to load props.</p>';
            }
        }


        function renderQuotationProps(quotationId, props) {
            const listEl = document.getElementById(`propsQuotationList_${quotationId}`);
            if (!listEl) return;
            if (props.length === 0) {
                listEl.innerHTML = '<p class="text-xs text-gray-400">No props assigned yet.</p>';
                return;
            }
            listEl.innerHTML = props.map(p => `
                <div class="flex items-center gap-2 text-xs py-1">
                    <span class="flex-1">${escapeHTML(p.name)} - qty ${p.quantity}</span>
                    <button onclick="removePropFromQuotation(${quotationId}, ${p.prop_id})" class="text-red-400 hover:text-red-600 transition">&#10005;</button>
                </div>
            `).join('');
        }


        // Mirrors rescheduleInquiry()'s conflict-then-force pattern (see
        // PATCH /api/inquiry/:id/reschedule): a 409 means another
        // confirmed booking near this event date already has enough of
        // this prop committed that there isn't enough left. This is a
        // warning, not a hard block, same severity as the existing
        // same-date double-booking check - the admin can confirm and
        // proceed anyway if they know it'll work out (e.g. the other
        // event is already done by then).
        async function addPropToQuotation(quotationId, force = false) {
            try {
                const select = document.getElementById(`newPropSelect_${quotationId}`);
                const qtyInput = document.getElementById(`newPropQty_${quotationId}`);
                const propId = select?.value;
                const quantity = parseInt(qtyInput?.value, 10) || 1;
                if (!propId) {
                    alert('Please select a prop');
                    return;
                }

                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${quotationId}/props`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ prop_id: propId, quantity, force })
                });

                if (res.status === 409) {
                    const err = await res.json();
                    const c = err.conflict || {};
                    const bookingsList = (c.bookings || [])
                        .map(b => `${b.customer_name} (${b.quotation_no || '-'}, ${formatDate(b.event_date)}) - qty ${b.quantity}`)
                        .join('\n');
                    const confirmMsg = `${err.error}\n\nAvailable: ${c.quantity_available}, already committed nearby: ${c.committed_elsewhere}, requested: ${c.requested}.\n\n${bookingsList}\n\nAssign anyway?`;
                    if (confirm(confirmMsg)) {
                        await addPropToQuotation(quotationId, true);
                    }
                    return;
                }

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to add prop');
                }

                if (select) select.value = '';
                if (qtyInput) qtyInput.value = '1';
                await loadQuotationProps(quotationId);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function removePropFromQuotation(quotationId, propId) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${quotationId}/props/${propId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to remove prop');
                await loadQuotationProps(quotationId);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // ------------------------------------------------------------
        // UPDATE STATUS
        // ------------------------------------------------------------
        async function updateQuotationStatus(id) {
            try {
                const statusSelect = document.getElementById(`status_${id}`);
                if (!statusSelect) {
                    alert('Status dropdown not found');
                    return;
                }
                
                const newStatus = statusSelect.value;
                // Captured before the request - BAU backlog #6's undo
                // toast needs the pre-change value to revert to.
                const oldStatus = allQuotations.find(q => q.id === id)?.status;

                let cancellationReason = null;
                if (newStatus === 'cancelled') {
                    // BAU backlog #30 - explicit confirm before the reason
                    // prompt, since typing nothing and hitting OK on the
                    // prompt alone doesn't actually require confirming the
                    // cancellation itself.
                    if (!confirm('Are you sure you want to cancel this booking? This is a high-stakes change.')) {
                        return;
                    }
                    cancellationReason = prompt('Why is this quotation being cancelled? (shown in the activity log and refund tracking)');
                    if (cancellationReason === null) return; // admin hit Cancel on the prompt itself
                }
                
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${id}/status`, {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${adminToken}` 
                    },
                    body: JSON.stringify({ status: newStatus, cancellation_reason: cancellationReason })
                });
                
                if (res.status === 401) {
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    alert('Session expired. Please login again.');
                    return;
                }
                
                if (res.ok) {
                    const result = await res.json();
                    if (result.success) {
                        await loadQuotations();
                        if (oldStatus && oldStatus !== newStatus) {
                            showUndoToast(`Quotation status changed to "${newStatus}".`, () => undoQuotationStatus(id, oldStatus, newStatus));
                        }
                    } else {
                        alert('Status update failed: ' + (result.message || 'Unknown error'));
                    }
                } else {
                    const errData = await res.json();
                    alert('Status update failed: ' + (errData.error || `HTTP ${res.status}`));
                }
            } catch (err) {
                console.error('Status update error:', err);
                alert('Status update failed: ' + err.message);
            }
        }


        // BAU backlog #6 - same optimistic-concurrency undo as
        // undoInquiryStatus above. Note this reverts the status column
        // only, not any side-effect field a status branch may have set
        // (sent_at, deposit_paid_at, cancelled_at/refund_status, etc.) -
        // same as manually changing status backward through the dropdown
        // already does today; undo isn't more destructive than that.
        async function undoQuotationStatus(id, revertTo, revertFrom) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ status: revertTo, if_current_equals: revertFrom })
                });

                if (res.status === 409) {
                    alert("Can't undo - this was already changed.");
                    await loadQuotations();
                    return;
                }
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to undo');
                }

                await loadQuotations();
            } catch (err) {
                alert('Undo failed: ' + err.message);
            }
        }


        // BAU backlog #40 - venue/event_time are day-of logistics for the
        // Run Sheet PDF, saved separately from the pricing-editing PUT /:id
        // flow (see backend route comment) since they aren't pricing data
        // and don't need a quotation_versions snapshot.
        async function saveQuotationLogistics(id) {
            try {
                const venue = document.getElementById(`venue_${id}`)?.value || '';
                const eventTime = document.getElementById(`eventTime_${id}`)?.value || '';

                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${id}/logistics`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ venue, event_time: eventTime })
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
                    throw new Error(err.error || 'Failed to save');
                }

                await loadQuotations();
            } catch (err) {
                alert('Failed to save venue/time: ' + err.message);
            }
        }


        // ------------------------------------------------------------
        // DELETE QUOTATION
        // ------------------------------------------------------------
        // ------------------------------------------------------------
        // VERSION HISTORY
        // ------------------------------------------------------------
        async function viewQuotationHistory(id) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${id}/versions`, {
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

                document.getElementById('modalTitle').textContent = `Quotation #${id} - Version History`;

                if (versions.length === 0) {
                    document.getElementById('modalBody').innerHTML = '<p class="text-sm text-gray-500">No version history found.</p>';
                } else {
                    let html = '<div class="space-y-3">';
                    versions.forEach((v, index) => {
                        const isLatest = index === 0;
                        let versionItems = v.items;
                        if (typeof versionItems === 'string') {
                            try { versionItems = JSON.parse(versionItems); } catch (e) { versionItems = []; }
                        }
                        let itemsHtml = '';
                        if (Array.isArray(versionItems) && versionItems.length > 0) {
                            itemsHtml = versionItems.map(item =>
                                `<span class="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs mr-1">${escapeHTML(item.name)}: RM ${item.price || 0}</span>`
                            ).join(' ');
                        }
                        html += `
                            <div class="border rounded-xl p-3 text-sm ${isLatest ? 'border-gold bg-yellow-50' : ''}">
                                <div class="flex justify-between items-center">
                                    <strong>Version ${v.version_number}${isLatest ? ' (current)' : ''}</strong>
                                    <span class="text-xs text-gray-400">${formatDateTime(v.created_at)}</span>
                                </div>
                                <div class="grid grid-cols-3 gap-2 mt-2 text-xs">
                                    <div><span class="text-gray-400">Total:</span> <strong>RM ${v.total || 0}</strong></div>
                                    <div><span class="text-gray-400">Deposit:</span> RM ${v.deposit || 0}</div>
                                    <div><span class="text-gray-400">Balance:</span> RM ${v.balance || 0}</div>
                                </div>
                                <div class="mt-2">${itemsHtml || '-'}</div>
                                <div class="mt-1 text-xs text-gray-400">By: ${escapeHTML(v.created_by || 'unknown')}</div>
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


        async function deleteQuotation(id) {
            if (!confirm('Delete this quotation? It can be restored afterwards from "Recently Deleted" below the list.')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${id}`, {
                    method: 'DELETE',
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

                if (res.ok) {
                    await loadQuotations();
                } else {
                    const err = await res.json();
                    throw new Error(err.error || 'Delete failed');
                }
            } catch (err) {
                console.error(err);
                alert('Delete failed: ' + err.message);
            }
        }


        function toggleRecentlyDeleted() {
            const panel = document.getElementById('recentlyDeletedPanel');
            const isHidden = panel.classList.contains('hidden');
            panel.classList.toggle('hidden');
            if (isHidden) {
                loadDeletedQuotations();
                loadDeletedInquiries();
            }
        }


        async function loadDeletedQuotations() {
            const el = document.getElementById('deletedQuotationsList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/deleted`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to load');
                const result = await res.json();
                const rows = result.data || [];
                el.innerHTML = rows.length === 0
                    ? '<p class="text-sm text-gray-500">Nothing deleted.</p>'
                    : rows.map(q => `
                        <div class="flex justify-between items-center gap-2 border rounded-xl p-3 text-sm">
                            <div>
                                <strong>${escapeHTML(q.quotation_no || ('#' + q.id))}</strong>
                                <div class="text-xs text-gray-500 mt-0.5">${escapeHTML(q.customer_name)} | RM ${q.total || 0}</div>
                                <div class="text-xs text-gray-400 mt-0.5">Deleted ${formatDateTime(q.deleted_at)}</div>
                            </div>
                            <button onclick="restoreQuotation(${q.id})" class="bg-gold text-dark px-3 py-1.5 rounded-full text-xs font-medium hover:bg-yellow-600 transition whitespace-nowrap">
                                Restore
                            </button>
                        </div>
                    `).join('');
            } catch (err) {
                console.error('Load deleted quotations error:', err);
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load.</p>';
            }
        }


        async function loadDeletedInquiries() {
            const el = document.getElementById('deletedInquiriesList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/deleted`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to load');
                const result = await res.json();
                const rows = result.data || [];
                el.innerHTML = rows.length === 0
                    ? '<p class="text-sm text-gray-500">Nothing deleted.</p>'
                    : rows.map(i => `
                        <div class="flex justify-between items-center gap-2 border rounded-xl p-3 text-sm">
                            <div>
                                <strong>#${i.id} - ${escapeHTML(i.customer_name)}</strong>
                                <div class="text-xs text-gray-500 mt-0.5">${escapeHTML(i.event_type || '-')} | ${formatDate(i.event_date)} | ${escapeHTML(i.phone || '-')}</div>
                                <div class="text-xs text-gray-400 mt-0.5">Deleted ${formatDateTime(i.deleted_at)}</div>
                            </div>
                            <button onclick="restoreInquiry(${i.id})" class="bg-gold text-dark px-3 py-1.5 rounded-full text-xs font-medium hover:bg-yellow-600 transition whitespace-nowrap">
                                Restore
                            </button>
                        </div>
                    `).join('');
            } catch (err) {
                console.error('Load deleted inquiries error:', err);
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load.</p>';
            }
        }


        async function restoreQuotation(id) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${id}/restore`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Restore failed');
                }
                await loadQuotations();
                await loadDeletedQuotations();
            } catch (err) {
                alert('Restore failed: ' + err.message);
            }
        }


        async function restoreInquiry(id) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/inquiry/${id}/restore`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Restore failed');
                }
                await loadInquiries();
                await loadDeletedInquiries();
            } catch (err) {
                alert('Restore failed: ' + err.message);
            }
        }


        function copyBookingLink(token) {
            if (!token) {
                alert('No booking link available for this quotation yet.');
                return;
            }
            // Builds the link relative to wherever this admin tool is
            // hosted, so it works whether that's GitHub Pages, a custom
            // domain, or local testing - no hardcoded domain needed.
            const bookingUrl = window.location.href.replace(/tool\.html.*$/, `booking.html?token=${token}`);
            navigator.clipboard.writeText(bookingUrl)
                .then(() => alert('Booking link copied! Share this with the customer:\n\n' + bookingUrl))
                .catch(() => prompt('Copy this booking link:', bookingUrl));
        }


        // Sprint 4, Epic A - mints a fresh booking_token/expiry, same
        // safety-valve reasoning as regenerateWithdrawToken above: covers
        // an expired link the customer still needs, or an early kill of
        // a link that may have leaked.
        async function regenerateBookingToken(id) {
            if (!confirm('Generate a new booking link for this quotation? The old link will stop working immediately.')) return;

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/quotation/${id}/regenerate-booking-token`, {
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

                await loadQuotations();
                alert('New booking link generated. The old link no longer works.');

            } catch (err) {
                console.error('Regenerate booking token error:', err);
                alert('Failed to regenerate link: ' + err.message);
            }
        }

        // Sprint 7, Epic J - one-click "send this quotation to the
        // customer": builds the PDF client-side (buildQuotationPDFDoc,
        // quotations-generate.js - same code the manual "Download PDF"
        // button already uses, not a reimplementation), uploads it,
        // emails it automatically if the customer has an email on file
        // (most don't yet - phone is the primary channel here), then
        // opens a WhatsApp deep link with the same message template used
        // elsewhere plus the PDF link, and marks the quotation sent.
        // Owner-only in the UI (see renderQuotations above) because the
        // PDF needs real total/deposit/balance/item prices, which are
        // already stripped from a staff session's data by
        // redactQuotation server-side - there's nothing to protect
        // further here, a staff session simply never has the numbers to
        // build a correct PDF from.
        async function sendQuotationToCustomer(id) {
            const q = allQuotations.find(x => x.id === id);
            if (!q) return;

            if (!confirm(`Send quotation ${q.quotation_no} to ${q.customer_name}? This will mark it as sent.`)) return;

            try {
                let items = q.items;
                if (typeof items === 'string') {
                    try { items = JSON.parse(items); } catch (e) { items = []; }
                }
                const total = parseFloat(q.total) || 0;
                const deposit = parseFloat(q.deposit) || 0;
                const balance = parseFloat(q.balance) || 0;

                const doc = buildQuotationPDFDoc(q, q.quotation_no, items, total, deposit, balance);
                if (!doc) return; // buildQuotationPDFDoc already alerted (jsPDF not loaded)
                const pdfBlob = doc.output('blob');

                const formData = new FormData();
                formData.append('pdf', pdfBlob, `Quotation_${q.quotation_no}.pdf`);

                const sendRes = await fetch(`${CONFIG.API_URL}/api/quotation/${id}/send`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${adminToken}` },
                    body: formData
                });

                if (sendRes.status === 401) {
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    alert('Session expired. Please login again.');
                    return;
                }

                if (!sendRes.ok) {
                    const err = await sendRes.json();
                    throw new Error(err.error || 'Failed to send quotation');
                }

                const sendResult = await sendRes.json();

                // Mark as sent - existing endpoint, unchanged, deliberately
                // not folded into POST /:id/send (see that route's comment).
                await fetch(`${CONFIG.API_URL}/api/quotation/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ status: 'sent' })
                });

                // Same rendering pattern as generateWhatsApp() in
                // quotations-generate.js, reusing the same admin-editable
                // 'quotation' template - just sourced from the persisted
                // quotation row instead of the in-progress generate form,
                // plus the PDF link appended.
                const valid = new Date();
                valid.setDate(valid.getDate() + 7);
                const fallback = `Hi {{customer_name}},\n\nThank you for your inquiry.\n\nQUOTATION\n--------------------\nEvent: {{event_type}}\nDate: {{event_date}}\nGuests: {{guest_count}} pax\n\nServices\n{{items}}\n\n--------------------\nTotal: RM {{total}}\nDeposit (30%): RM {{deposit}}\nBalance: RM {{balance}}\n\nValid until: {{valid_until}}\n\nPayment Details\nMaybank | 5xxxxx | Event Management System\n\nThank you.`;
                const msgText = renderTemplate(getTemplateBody('quotation', fallback), {
                    customer_name: q.customer_name,
                    event_type: q.event_type || '-',
                    event_date: formatDate(q.event_date),
                    guest_count: q.guest_count || '-',
                    items: items.map(i => `${i.name}: RM ${i.price}`).join('\n'),
                    total, deposit, balance,
                    valid_until: valid.toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })
                }) + `\n\nView/download your quotation PDF: ${sendResult.pdf_url}`;

                const phone = (q.phone || '').replace(/[^0-9]/g, '');
                if (phone) {
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msgText)}`, '_blank');
                }

                alert(`Quotation sent.${sendResult.emailed ? ' Also emailed to the customer.' : ' No email on file - WhatsApp only.'}`);
                await loadQuotations();

            } catch (err) {
                console.error('Send quotation error:', err);
                alert('Failed to send quotation: ' + err.message);
            }
        }
