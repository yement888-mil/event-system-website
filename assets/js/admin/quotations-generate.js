// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // SEARCH INQUIRY BY ID (for Generate Quotation)
        // ------------------------------------------------------------
        function searchInquiryById() {
            const idInput = document.getElementById('inquiryIdSearch');
            const resultDiv = document.getElementById('inquirySearchResult');
            
            if (!idInput || !resultDiv) return;
            
            const id = parseInt(idInput.value);
            if (!id || isNaN(id)) {
                resultDiv.innerHTML = '<p class="text-red-500 text-sm">Please enter a valid inquiry ID</p>';
                return;
            }
            
            // First check if we have inquiries loaded
            if (!allInquiries || allInquiries.length === 0) {
                resultDiv.innerHTML = '<p class="text-yellow-500 text-sm">No inquiries found in the system. Please submit an inquiry first.</p>';
                document.getElementById('quotationForm').classList.add('hidden');
                return;
            }
            
            const inquiry = allInquiries.find(i => i.id === id);
            
            if (!inquiry) {
                const availableIds = allInquiries.map(i => i.id).join(', ');
                resultDiv.innerHTML = `<p class="text-red-500 text-sm">No inquiry found with ID #${id}. Available IDs: ${availableIds}</p>`;
                document.getElementById('quotationForm').classList.add('hidden');
                return;
            }
            
            selectedInquiry = inquiry;
            resultDiv.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                    <strong>Found: #${inquiry.id} - ${escapeHTML(inquiry.customer_name)}</strong>
                    <br>${escapeHTML(inquiry.event_type || '-')} | ${formatDate(inquiry.event_date)}
                    <br>Phone: ${escapeHTML(inquiry.phone || '-')}
                    <button onclick="loadInquiryForQuotation(${inquiry.id})" class="mt-2 bg-gold text-dark px-4 py-1 rounded text-xs font-medium hover:bg-yellow-600 transition">
                        Load for Quotation
                    </button>
                </div>
            `;
        }


        // BAU backlog #29 - shortcut from an inquiry card straight into
        // the quotation builder, skipping the manual ID-search step
        // loadInquiryForQuotation() normally requires the admin to have
        // already navigated to the Generate Quotation tab for.
        function generateQuotationFromCard(id) {
            switchTab('generate');
            loadInquiryForQuotation(id);
        }


        // For each service this inquiry already requested, surface any
        // frequently-paired service it *doesn't* already have - "customers
        // who wanted X often also wanted Y". frequentPairsCache is
        // pre-filtered server-side to pairs seen 5+ times (see GET
        // /api/quotation/frequent-pairs), so nothing here needs its own
        // sample-size guard.
        function renderPairSuggestion(inq) {
            const el = document.getElementById('pairSuggestion');
            if (!el) return;
            el.innerHTML = '';

            let requested = [];
            if (inq.services_requested) {
                try {
                    requested = typeof inq.services_requested === 'string'
                        ? JSON.parse(inq.services_requested)
                        : inq.services_requested;
                } catch (e) { requested = []; }
            }
            if (!Array.isArray(requested) || requested.length === 0) return;

            const suggestions = [];
            frequentPairsCache.forEach(pair => {
                let requestedSide, otherSide;
                if (requested.includes(pair.service_a) && !requested.includes(pair.service_b)) {
                    requestedSide = pair.service_a; otherSide = pair.service_b;
                } else if (requested.includes(pair.service_b) && !requested.includes(pair.service_a)) {
                    requestedSide = pair.service_b; otherSide = pair.service_a;
                } else {
                    return;
                }
                suggestions.push({ requestedSide, otherSide, count: pair.count });
            });

            if (suggestions.length === 0) return;

            el.innerHTML = suggestions.map(s => `
                <div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                    Often added together: customers who wanted ${SERVICE_CODE_LABELS[s.requestedSide] || s.requestedSide}
                    also wanted ${SERVICE_CODE_LABELS[s.otherSide] || s.otherSide} (${s.count} times).
                </div>
            `).join('');
        }


        function loadInquiryForQuotation(id) {
            const inq = allInquiries.find(i => i.id === id);
            if (!inq) return;

            selectedInquiry = inq;
            document.getElementById('quotationForm').classList.remove('hidden');

            let servicesStr = '';
            if (inq.services_requested) {
                try {
                    const services = typeof inq.services_requested === 'string' ?
                        JSON.parse(inq.services_requested) : inq.services_requested;
                    servicesStr = services.join(', ');
                } catch(e) {
                    servicesStr = inq.services_requested;
                }
            }

            document.getElementById('inquiryPreview').innerHTML = `
                <strong>#${inq.id} - ${escapeHTML(inq.customer_name)}</strong><br>
                ${escapeHTML(inq.event_type || '-')} | ${formatDate(inq.event_date)}
                <br>Phone: ${escapeHTML(inq.phone || '-')}
                <br>Services: ${servicesStr || 'No services selected'}
            `;
            renderPairSuggestion(inq);

            const container = document.getElementById('serviceRows');
            container.innerHTML = '';
            const restored = offerToRestoreQuotationDraft(inq.id);
            if (!restored) addServiceRow('', '');
            calculate();
            const valid = new Date();
            valid.setDate(valid.getDate() + 7);
            document.getElementById('validUntil').textContent = valid.toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
            document.getElementById('whatsappOutput').classList.add('hidden');
            document.getElementById('copyBtn').classList.add('hidden');

            populateCopyFromQuotationBox(inq);

            document.getElementById('inquirySearchResult').innerHTML = '';
            document.getElementById('inquiryIdSearch').value = '';
        }


        // Repeat-customer quick-start: if this inquiry's customer has any
        // past quotations, offer to copy that quotation's line items into
        // this new one instead of rebuilding from scratch or a generic
        // package template.
        function populateCopyFromQuotationBox(inq) {
            const box = document.getElementById('copyFromQuotationBox');
            const select = document.getElementById('copyFromQuotationSelect');
            if (!box || !select) return;

            const previous = inq.customer_id
                ? allQuotations.filter(q => q.customer_id === inq.customer_id && q.inquiry_id !== inq.id)
                : [];

            if (previous.length === 0) {
                box.classList.add('hidden');
                select.innerHTML = '<option value="">-- Select a past quotation --</option>';
                return;
            }

            select.innerHTML = '<option value="">-- Select a past quotation --</option>' +
                previous.map(q => `<option value="${q.id}">${escapeHTML(q.quotation_no)} - RM ${q.total || 0} (${formatDate(q.event_date)})</option>`).join('');
            box.classList.remove('hidden');
        }


        function copyFromPreviousQuotation() {
            const select = document.getElementById('copyFromQuotationSelect');
            const id = select?.value;
            if (!id) return;
            const q = allQuotations.find(x => String(x.id) === String(id));
            if (!q || !q.items) return;

            const items = typeof q.items === 'string' ? JSON.parse(q.items) : q.items;
            if (!Array.isArray(items) || items.length === 0) return;

            const container = document.getElementById('serviceRows');
            if (!container) return;
            container.innerHTML = '';
            items.forEach(s => addServiceRow(s.name, s.price));
            calculate();
        }


        // ------------------------------------------------------------
        // DYNAMIC SERVICES
        // ------------------------------------------------------------
        // BAU backlog #37 - cost is carried as a hidden input (.service-cost),
        // parallel to .service-name/.service-price, so generateQuotation()
        // can read it the same way it reads name/price. Not admin-editable
        // here directly - it's a snapshot of whatever the pricing catalog's
        // cost was at the moment this row was added (see
        // quickAddFromPricingList()), left blank for manually-typed rows
        // and rows filled from a package template, since neither has a
        // known cost to snapshot.
        function addServiceRow(name = '', price = '', cost = '') {
            const container = document.getElementById('serviceRows');
            if (!container) return;

            const row = document.createElement('div');
            row.className = 'flex gap-2 items-center';
            row.innerHTML = `
                <input type="text" placeholder="Service name" value="${escapeHTML(name)}" class="service-name w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                <input type="number" placeholder="Price (RM)" value="${price}" class="service-price w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                <input type="hidden" class="service-cost" value="${cost !== null && cost !== undefined ? cost : ''}" />
                <button onclick="removeServiceRow(this)" class="text-red-500 text-sm px-2">&#10005;</button>
            `;
            container.appendChild(row);
            row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calculate));
        }


        function removeServiceRow(btn) {
            const container = document.getElementById('serviceRows');
            if (!container) return;
            if (container.children.length <= 1) return alert('At least one service required.');
            btn.closest('.flex').remove();
            calculate();
        }


        function applyPackage() {
            const pkgId = document.getElementById('packageSelect')?.value;
            if (!pkgId) return;
            const pkg = packagesCache.find(p => String(p.id) === String(pkgId));
            if (!pkg || !Array.isArray(pkg.items)) return;
            const container = document.getElementById('serviceRows');
            if (!container) return;
            container.innerHTML = '';
            pkg.items.forEach(s => addServiceRow(s.name, s.price));
            calculate();
        }


        function quickAddFromPricingList() {
            const select = document.getElementById('quickAddPricingItem');
            const itemId = select?.value;
            if (!itemId) return;
            const item = pricingItemsCache.find(p => String(p.id) === String(itemId));
            if (!item) return;

            // If the only row so far is an empty placeholder row, fill it instead of adding a new one
            const container = document.getElementById('serviceRows');
            const rows = container ? container.querySelectorAll('.service-name') : [];
            if (rows.length === 1 && !rows[0].value) {
                rows[0].value = item.name;
                container.querySelector('.service-price').value = item.price;
                container.querySelector('.service-cost').value = item.cost !== null && item.cost !== undefined ? item.cost : '';
            } else {
                addServiceRow(item.name, item.price, item.cost);
            }
            calculate();
            select.value = '';
        }


        // Fills {{placeholder}} tokens in an admin-editable template body.
        // Missing keys resolve to '' rather than leaving the raw token
        // visible in an outgoing customer message.
        function renderTemplate(body, vars) {
            return body.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined && vars[key] !== null) ? String(vars[key]) : '');
        }


        function getTemplateBody(key, fallback) {
            const tpl = messageTemplatesCache.find(t => t.key === key);
            return tpl ? tpl.body : fallback;
        }


        // ---- Dropdown population (used in Generate Quotation tab) ----
        function populatePackageSelect() {
            const select = document.getElementById('packageSelect');
            if (!select) return;
            const current = select.value;
            select.innerHTML = '<option value="">-- Custom --</option>' +
                packagesCache.filter(p => p.active !== false).map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('');
            select.value = current;
        }


        function populateQuickAddSelect() {
            const select = document.getElementById('quickAddPricingItem');
            if (!select) return;
            const activeItems = pricingItemsCache.filter(p => p.active !== false);
            select.innerHTML = '<option value="">+ Quick add from price list...</option>' +
                activeItems.map(p => `<option value="${p.id}">${escapeHTML(p.category ? p.category + ' - ' : '')}${escapeHTML(p.name)} (RM ${p.price})</option>`).join('');
        }


        // ------------------------------------------------------------
        // CALCULATE
        // ------------------------------------------------------------
        function calculate() {
            const prices = document.querySelectorAll('.service-price');
            let total = 0;
            prices.forEach(inp => { total += parseFloat(inp.value) || 0; });
            const totalEl = document.getElementById('totalPrice');
            const depositEl = document.getElementById('depositPrice');
            const balanceEl = document.getElementById('balancePrice');
            if (totalEl) totalEl.textContent = 'RM ' + total;
            if (depositEl) depositEl.textContent = 'RM ' + Math.round(total * 0.3);
            if (balanceEl) balanceEl.textContent = 'RM ' + Math.round(total * 0.7);
            saveQuotationDraft();
        }

        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('service-price')) calculate();
        });


        // ------------------------------------------------------------
        // DRAFT AUTO-SAVE (BAU backlog #18) - protects against a browser
        // crash or session expiry losing an in-progress quotation before
        // "Save Quotation" is ever clicked. Scoped to building a brand
        // NEW quotation only (not editing an existing one) - an existing
        // quotation is already a saved DB row, so the "unsaved work" risk
        // this protects against doesn't apply there the same way.
        // ------------------------------------------------------------
        function quotationDraftKey(inquiryId) {
            return `quotationDraft_${inquiryId}`;
        }


        function saveQuotationDraft() {
            if (!selectedInquiry || editingQuotationId) return;
            const names = document.querySelectorAll('.service-name');
            const prices = document.querySelectorAll('.service-price');
            const items = [];
            for (let i = 0; i < names.length; i++) {
                const name = names[i].value.trim();
                const price = prices[i].value;
                if (name || price) items.push({ name, price });
            }
            if (items.length === 0) {
                localStorage.removeItem(quotationDraftKey(selectedInquiry.id));
                return;
            }
            localStorage.setItem(quotationDraftKey(selectedInquiry.id), JSON.stringify({ items, savedAt: new Date().toISOString() }));
        }


        function clearQuotationDraft(inquiryId) {
            localStorage.removeItem(quotationDraftKey(inquiryId));
        }


        // Offers to restore an unsaved draft for this inquiry, if one
        // exists from an earlier session that never got saved. Returns
        // true if a draft was restored (caller should skip its own
        // default blank-row setup).
        function offerToRestoreQuotationDraft(inquiryId) {
            const raw = localStorage.getItem(quotationDraftKey(inquiryId));
            if (!raw) return false;
            try {
                const draft = JSON.parse(raw);
                if (!draft.items || draft.items.length === 0) { clearQuotationDraft(inquiryId); return false; }

                const savedAt = draft.savedAt ? new Date(draft.savedAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }) : 'earlier';
                const restore = confirm(`An unsaved quotation draft from ${savedAt} was found for this inquiry. Restore it?`);
                if (!restore) { clearQuotationDraft(inquiryId); return false; }

                const container = document.getElementById('serviceRows');
                container.innerHTML = '';
                draft.items.forEach(i => addServiceRow(i.name, i.price));
                return true;
            } catch (e) {
                clearQuotationDraft(inquiryId);
                return false;
            }
        }


        // ------------------------------------------------------------
        // GENERATE QUOTATION
        // ------------------------------------------------------------
        async function generateQuotation() {
            if (savingQuotation) return;
            savingQuotation = true;
            const btn = document.getElementById('saveQuotationBtn');
            if (btn) {
                btn.disabled = true;
                document.getElementById('saveQuotationText').innerText = 'Saving...';
            }

            try {
                if (!selectedInquiry) {
                    alert('Please search and select an inquiry first');
                    savingQuotation = false;
                    if (btn) {
                        btn.disabled = false;
                        document.getElementById('saveQuotationText').innerText = 'Generate & Save Quotation';
                    }
                    return;
                }

                const nameInputs = document.querySelectorAll('.service-name');
                const priceInputs = document.querySelectorAll('.service-price');
                const costInputs = document.querySelectorAll('.service-cost');
                const items = [];
                for (let i = 0; i < nameInputs.length; i++) {
                    const name = nameInputs[i].value.trim();
                    const price = parseFloat(priceInputs[i].value) || 0;
                    if (name && price > 0) {
                        const item = { name, price };
                        // BAU backlog #37 - only snapshot cost when it's
                        // actually known (from the pricing catalog);
                        // omit it entirely for manual/package rows rather
                        // than storing 0, so Analytics can tell "no cost
                        // data" apart from "this item is free to deliver".
                        const costRaw = costInputs[i] ? costInputs[i].value : '';
                        if (costRaw !== '' && !isNaN(parseFloat(costRaw))) {
                            item.cost = parseFloat(costRaw);
                        }
                        items.push(item);
                    }
                }
                if (items.length === 0) { alert('Add at least one service'); return; }

                const total = items.reduce((s, i) => s + i.price, 0);
                const deposit = Math.round(total * 0.3);
                const balance = Math.round(total * 0.7);

                const payload = {
                    inquiry_id: selectedInquiry.id,
                    items: JSON.stringify(items),
                    total: total,
                    deposit: deposit,
                    balance: balance,
                    status: 'draft'
                };

                let response;
                if (editingQuotationId) {
                    // BAU backlog E4 - expected_version tells the server
                    // which version this edit started from, so a stale
                    // save (someone else changed it in the meantime)
                    // gets rejected with a 409 instead of silently
                    // overwriting their changes.
                    response = await fetch(`${CONFIG.API_URL}/api/quotation/${editingQuotationId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                        body: JSON.stringify({ ...payload, expected_version: editingQuotationVersion })
                    });
                } else {
                    // BAU backlog #4 - only regenerate the key if this is
                    // a different inquiry than the last attempt; a retry
                    // of the same failed attempt reuses it.
                    if (quotationIdempotencyKey === null || quotationIdempotencyKeyInquiryId !== selectedInquiry.id) {
                        quotationIdempotencyKey = generateIdempotencyKey();
                        quotationIdempotencyKeyInquiryId = selectedInquiry.id;
                    }
                    payload.idempotency_key = quotationIdempotencyKey;

                    response = await fetch(`${CONFIG.API_URL}/api/quotation`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                        body: JSON.stringify(payload)
                    });
                }

                if (response.status === 401) {
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    alert('Session expired. Please login again.');
                    return;
                }

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || errData.message || 'Request failed');
                }

                const result = await response.json();
                if (result.success) {
                    const savedQuotationNo = result.data?.quotation_no || 'DRAFT';
                    const inqForPdf = selectedInquiry;
                    const itemsForPdf = items;
                    const totalForPdf = total;
                    const depositForPdf = deposit;
                    const balanceForPdf = balance;

                    clearQuotationDraft(inqForPdf.id);
                    editingQuotationId = null;
                    editingQuotationVersion = null;
                    selectedInquiry = null;
                    quotationIdempotencyKey = null;
                    quotationIdempotencyKeyInquiryId = null;
                    await loadQuotations();
                    document.getElementById('whatsappOutput').classList.add('hidden');
                    document.getElementById('copyBtn').classList.add('hidden');
                    const container = document.getElementById('serviceRows');
                    if (container) {
                        container.innerHTML = '';
                        addServiceRow('', '');
                    }
                    calculate();
                    document.getElementById('quotationForm').classList.add('hidden');
                    document.getElementById('inquirySearchResult').innerHTML = '';
                    document.getElementById('inquiryIdSearch').value = '';
                    document.getElementById('cancelEditBtn')?.classList.add('hidden');
                    document.getElementById('saveQuotationText').innerText = 'Generate & Save Quotation';
                    switchTab('quotations');

                    if (confirm(`Quotation ${savedQuotationNo} saved. Download the PDF now?`)) {
                        buildAndDownloadPDF(inqForPdf, savedQuotationNo, itemsForPdf, totalForPdf, depositForPdf, balanceForPdf);
                    }
                } else {
                    throw new Error(result.message || 'Operation failed');
                }

            } catch (err) {
                console.error('Save error:', err);
                alert('Error: ' + err.message);
            } finally {
                savingQuotation = false;
                if (btn) {
                    btn.disabled = false;
                    document.getElementById('saveQuotationText').innerText = editingQuotationId ? 'Update Quotation' : 'Generate & Save Quotation';
                }
            }
        }


        // ------------------------------------------------------------
        // WHATSAPP
        // ------------------------------------------------------------
        function generateWhatsApp() {
            if (!selectedInquiry) {
                alert('Please search and select an inquiry first');
                return;
            }
            
            const inq = selectedInquiry;
            const nameInputs = document.querySelectorAll('.service-name');
            const priceInputs = document.querySelectorAll('.service-price');
            const items = [];
            let total = 0;
            for (let i = 0; i < nameInputs.length; i++) {
                const name = nameInputs[i].value.trim();
                const price = parseFloat(priceInputs[i].value) || 0;
                if (name && price > 0) { items.push({ name, price });
                    total += price; }
            }
            if (total <= 0) { alert('Enter service prices'); return; }
            const deposit = Math.round(total * 0.3);
            const balance = Math.round(total * 0.7);
            const valid = new Date();
            valid.setDate(valid.getDate() + 7);

            const fallback = `Hi {{customer_name}},\n\nThank you for your inquiry.\n\nQUOTATION\n--------------------\nEvent: {{event_type}}\nDate: {{event_date}}\nGuests: {{guest_count}} pax\n\nServices\n{{items}}\n\n--------------------\nTotal: RM {{total}}\nDeposit (30%): RM {{deposit}}\nBalance: RM {{balance}}\n\nValid until: {{valid_until}}\n\nPayment Details\nMaybank | 5xxxxx | Event Management System\n\nThank you.`;
            const msgText = renderTemplate(getTemplateBody('quotation', fallback), {
                customer_name: inq.customer_name,
                event_type: inq.event_type || '-',
                event_date: formatDate(inq.event_date),
                guest_count: inq.guest_count || '-',
                items: items.map(i => `${i.name}: RM ${i.price}`).join('\n'),
                total,
                deposit,
                balance,
                valid_until: valid.toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })
            });

            const output = document.getElementById('whatsappOutput');
            if (output) {
                output.textContent = msgText;
                output.classList.remove('hidden');
            }
            const copyBtn = document.getElementById('copyBtn');
            if (copyBtn) copyBtn.classList.remove('hidden');

            const phone = inq.phone || '';
            if (phone) {
                const url = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msgText)}`;
                window.open(url, '_blank');
            } else {
                if (output) output.scrollIntoView({ behavior: 'smooth' });
            }
        }


        // ------------------------------------------------------------
        // PDF
        // ------------------------------------------------------------
        // Builds the jsPDF document without saving/downloading it -
        // shared by buildAndDownloadPDF (below, unchanged behavior -
        // triggers a browser download) and sendQuotationToCustomer (BAU
        // Sprint 7, Epic J, in quotations-list.js - needs the PDF as a
        // Blob to upload, not a download). Returns null (after alerting,
        // same message as before) if jsPDF failed to load, so callers
        // only need to check truthiness.
        function buildQuotationPDFDoc(inq, quotationNo, items, total, deposit, balance) {
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) {
                alert('PDF library failed to load. Please check your internet connection and try again.');
                return null;
            }

            const valid = new Date();
            valid.setDate(valid.getDate() + 7);

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Header
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('Event Management System', 14, 20);
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('Event Decoration & Styling', 14, 26);

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('QUOTATION', pageWidth - 14, 20, { align: 'right' });
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(quotationNo, pageWidth - 14, 26, { align: 'right' });
            doc.text(`Valid until: ${valid.toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`, pageWidth - 14, 31, { align: 'right' });

            doc.setDrawColor(200);
            doc.line(14, 35, pageWidth - 14, 35);

            // Customer + event details
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Bill To', 14, 44);
            doc.setFont(undefined, 'normal');
            doc.text(inq.customer_name || '-', 14, 50);
            doc.text(inq.phone || '-', 14, 55);

            doc.setFont(undefined, 'bold');
            doc.text('Event Details', pageWidth - 14, 44, { align: 'right' });
            doc.setFont(undefined, 'normal');
            doc.text(`${inq.event_type || '-'}`, pageWidth - 14, 50, { align: 'right' });
            doc.text(`${formatDate(inq.event_date)}`, pageWidth - 14, 55, { align: 'right' });
            doc.text(`${inq.guest_count || '-'} pax`, pageWidth - 14, 60, { align: 'right' });

            // Items table
            doc.autoTable({
                startY: 68,
                head: [['Service', 'Amount (RM)']],
                body: items.map(i => [i.name, i.price.toFixed(2)]),
                theme: 'grid',
                headStyles: { fillColor: [201, 168, 76], textColor: [26, 26, 26] },
                styles: { fontSize: 10 },
                columnStyles: { 1: { halign: 'right' } }
            });

            const afterTableY = doc.lastAutoTable.finalY + 8;

            doc.setFontSize(10);
            doc.text('Total:', pageWidth - 60, afterTableY);
            doc.text(`RM ${total.toFixed(2)}`, pageWidth - 14, afterTableY, { align: 'right' });
            doc.text('Deposit (30%):', pageWidth - 60, afterTableY + 6);
            doc.text(`RM ${deposit.toFixed(2)}`, pageWidth - 14, afterTableY + 6, { align: 'right' });
            doc.setFont(undefined, 'bold');
            doc.text('Balance:', pageWidth - 60, afterTableY + 12);
            doc.text(`RM ${balance.toFixed(2)}`, pageWidth - 14, afterTableY + 12, { align: 'right' });
            doc.setFont(undefined, 'normal');

            // Payment details + notes
            const notesY = afterTableY + 26;
            doc.setDrawColor(200);
            doc.line(14, notesY - 8, pageWidth - 14, notesY - 8);
            doc.setFont(undefined, 'bold');
            doc.text('Payment Details', 14, notesY);
            doc.setFont(undefined, 'normal');
            doc.text('Maybank | 5xxxxx | Event Management System', 14, notesY + 6);

            doc.setFont(undefined, 'bold');
            doc.text('Notes', 14, notesY + 18);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            const notes = doc.splitTextToSize(
                'This quotation is an estimate and is valid until the date shown above. A 30% deposit is required to secure your booking date; the balance is due before the event. Prices are subject to change if event requirements change.',
                pageWidth - 28
            );
            doc.text(notes, 14, notesY + 24);

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generated: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`, 14, doc.internal.pageSize.getHeight() - 10);

            return doc;
        }

        function buildAndDownloadPDF(inq, quotationNo, items, total, deposit, balance) {
            const doc = buildQuotationPDFDoc(inq, quotationNo, items, total, deposit, balance);
            if (!doc) return;
            const fileName = `Quotation_${quotationNo}_${(inq.customer_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            doc.save(fileName);
        }


        // BAU backlog #40 - "Generate Run Sheet PDF" on a confirmed
        // (deposit_paid/completed) quotation. Reuses the same jsPDF/
        // autoTable setup as buildAndDownloadPDF above for a consistent
        // look, but this is a day-of document handed to someone physically
        // at a venue - it deliberately excludes pricing, deposit/balance,
        // and admin_notes (per the task), showing only what a crew member
        // setting up needs: who, where, when, headcount, what services,
        // and what's still outstanding on the checklist.
        async function buildAndDownloadRunSheetPDF(quotationId) {
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) {
                alert('PDF library failed to load. Please check your internet connection and try again.');
                return;
            }

            const q = allQuotations.find(x => x.id === quotationId);
            if (!q) {
                alert('Quotation not found. Try reloading the Quotations tab.');
                return;
            }

            let tasks = [];
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks/quotation/${quotationId}`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (res.ok) {
                    const result = await res.json();
                    tasks = (result.data || []).filter(t => !t.done);
                }
            } catch (err) {
                console.error('Load tasks for run sheet error:', err);
                // Non-fatal - the run sheet is still useful without the
                // task section, so continue rather than blocking the PDF.
            }

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
            doc.text('RUN SHEET', pageWidth - 14, 20, { align: 'right' });
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(q.quotation_no || '-', pageWidth - 14, 26, { align: 'right' });

            doc.setDrawColor(200);
            doc.line(14, 35, pageWidth - 14, 35);

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Customer', 14, 44);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.text(q.customer_name || '-', 14, 50);

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Event Details', pageWidth - 14, 44, { align: 'right' });
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.text(`${q.event_type || '-'}`, pageWidth - 14, 50, { align: 'right' });
            doc.text(`${formatDate(q.event_date)}${q.event_time ? ' | ' + q.event_time : ''}`, pageWidth - 14, 55, { align: 'right' });
            doc.text(`${q.guest_count || '-'} pax`, pageWidth - 14, 60, { align: 'right' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Venue', 14, 68);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            const venueLines = doc.splitTextToSize(q.venue || 'Not recorded - check with admin.', pageWidth - 28);
            doc.text(venueLines, 14, 74);

            const servicesStartY = 74 + (venueLines.length * 5) + 8;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Services Booked', 14, servicesStartY);

            const serviceNames = (q.items || []).map(i => [i.name || '-']);
            doc.autoTable({
                startY: servicesStartY + 4,
                head: [['Service']],
                body: serviceNames.length > 0 ? serviceNames : [['-']],
                theme: 'grid',
                headStyles: { fillColor: [201, 168, 76], textColor: [26, 26, 26] },
                styles: { fontSize: 10 }
            });

            const tasksStartY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Open Tasks', 14, tasksStartY);

            const taskRows = tasks.map(t => [t.title || '-', t.due_date ? formatDate(t.due_date) : '-']);
            doc.autoTable({
                startY: tasksStartY + 4,
                head: [['Task', 'Due']],
                body: taskRows.length > 0 ? taskRows : [['No open tasks', '-']],
                theme: 'grid',
                headStyles: { fillColor: [201, 168, 76], textColor: [26, 26, 26] },
                styles: { fontSize: 10 }
            });

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generated: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`, 14, doc.internal.pageSize.getHeight() - 10);

            const fileName = `RunSheet_${q.quotation_no || quotationId}_${(q.customer_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            doc.save(fileName);
        }


        function generatePDF() {
            if (!selectedInquiry) {
                alert('Please search and select an inquiry first');
                return;
            }

            const inq = selectedInquiry;
            const nameInputs = document.querySelectorAll('.service-name');
            const priceInputs = document.querySelectorAll('.service-price');
            const items = [];
            let total = 0;
            for (let i = 0; i < nameInputs.length; i++) {
                const name = nameInputs[i].value.trim();
                const price = parseFloat(priceInputs[i].value) || 0;
                if (name && price > 0) { items.push({ name, price }); total += price; }
            }
            if (total <= 0) { alert('Enter service prices'); return; }
            const deposit = Math.round(total * 0.3);
            const balance = Math.round(total * 0.7);

            // Use the real quotation number if this is an existing/saved
            // quotation being edited; otherwise this is a not-yet-saved
            // draft, so label it clearly rather than guessing a number.
            let quotationNo = 'DRAFT';
            if (editingQuotationId) {
                const existing = allQuotations.find(q => q.id === editingQuotationId);
                if (existing?.quotation_no) quotationNo = existing.quotation_no;
            }

            buildAndDownloadPDF(inq, quotationNo, items, total, deposit, balance);
        }


        // ------------------------------------------------------------
        // COPY
        // ------------------------------------------------------------
        function copyToClipboard() {
            const text = document.getElementById('whatsappOutput')?.textContent;
            if (!text) return alert('Nothing to copy');
            navigator.clipboard.writeText(text).then(() => alert('Copied!')).catch(() => alert('Copy failed'));
        }
