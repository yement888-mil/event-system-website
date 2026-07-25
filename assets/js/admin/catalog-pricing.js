// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // CATALOG: SERVICES + PRICING ITEMS + PACKAGES
        // ------------------------------------------------------------
        async function loadCatalog() {
            try {
                const [svcRes, itemsRes, pkgRes, galRes, faqRes, tplRes, peakRes, demandRes, pairsRes, feedTokenRes] = await Promise.all([
                    fetch(`${CONFIG.API_URL}/api/services/admin`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/pricing/items`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/pricing/packages`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/gallery/admin`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/faq/admin`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/message-templates`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/peak-periods`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/calendar/high-demand-weeks`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/quotation/frequent-pairs`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/calendar/feed-token`, { headers: { Authorization: `Bearer ${adminToken}` } })
                ]);

                if (svcRes.status === 401 || itemsRes.status === 401 || pkgRes.status === 401) return;

                const svcData = await svcRes.json();
                const itemsData = await itemsRes.json();
                const pkgData = await pkgRes.json();
                const galData = await galRes.json();
                const faqData = await faqRes.json();
                const tplData = await tplRes.json();
                const peakData = await peakRes.json();
                const demandData = await demandRes.json();
                const pairsData = await pairsRes.json();
                const feedTokenData = await feedTokenRes.json();

                servicesCache = svcData.data || [];
                pricingItemsCache = itemsData.data || [];
                packagesCache = pkgData.data || [];
                galleryCache = galData.data || [];
                faqCache = faqData.data || [];
                paymentDetailsCache = (tplData.data || []).find(t => t.key === 'payment_details')?.body || '';
                peakPeriodsCache = peakData.data || [];
                highDemandWeeksCache = new Set((demandData.data || []).map(w => w.week_start));
                frequentPairsCache = pairsData.data || [];
                calendarFeedToken = feedTokenData.token || '';

                renderServicesAdminList();
                renderPricingItemsList();
                renderPackagesList();
                populatePackageSelect();
                populateQuickAddSelect();
                renderGalleryAdminList();
                renderFaqAdminList();
                renderPaymentDetailsField();
                renderPeakPeriodsList();
                renderPeakSuggestions();
                renderAdminCalendar();
                renderCalendarFeedLink();

            } catch (err) {
                console.error('Load catalog error:', err);
            }
        }


        // ---- Public Services ----
        function renderServicesAdminList() {
            const el = document.getElementById('servicesAdminList');
            if (!el) return;
            if (servicesCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No services yet.</p>';
                return;
            }
            el.innerHTML = servicesCache.map(s => `
                <div class="flex flex-wrap justify-between items-center gap-2 border rounded-xl p-3 text-sm ${s.active ? '' : 'opacity-50'}">
                    <div>
                        <strong>${escapeHTML(s.name)}</strong>
                        <span class="text-xs text-gray-400 ml-2">${escapeHTML(s.category || '')}</span>
                        ${!s.active ? '<span class="text-xs text-red-500 ml-2">(hidden)</span>' : ''}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="editService(${s.id})" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">Edit</button>
                        <button onclick="deleteService(${s.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition">Delete</button>
                    </div>
                </div>
            `).join('');
        }


        function editService(id) {
            const s = servicesCache.find(x => x.id === id);
            if (!s) return;
            editingServiceId = id;
            document.getElementById('svc_name').value = s.name || '';
            document.getElementById('svc_category').value = s.category || '';
            document.getElementById('svc_description').value = s.description || '';
            document.getElementById('svc_active').checked = s.active !== false;
            document.getElementById('svcSaveLabel').textContent = 'Update Service';
            document.getElementById('svcCancelBtn').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }


        function resetServiceForm() {
            editingServiceId = null;
            document.getElementById('svc_name').value = '';
            document.getElementById('svc_category').value = '';
            document.getElementById('svc_description').value = '';
            document.getElementById('svc_active').checked = true;
            document.getElementById('svcSaveLabel').textContent = 'Add Service';
            document.getElementById('svcCancelBtn').classList.add('hidden');
        }


        async function saveService() {
            const name = document.getElementById('svc_name').value.trim();
            if (!name) { alert('Service name is required'); return; }

            // managed_by/image_url no longer have form fields (BAU: admin
            // form declutter) - preserve whatever the record already had
            // instead of sending undefined, which the backend's PUT would
            // otherwise silently null out on the next edit-save of an
            // existing service (2 of 4 services still use managed_by to
            // mark outsourced work, e.g. Catering/Magic Show).
            const existing = editingServiceId ? servicesCache.find(x => x.id === editingServiceId) : null;

            const payload = {
                name,
                category: document.getElementById('svc_category').value.trim(),
                managed_by: existing?.managed_by || '',
                image_url: existing?.image_url || '',
                description: document.getElementById('svc_description').value.trim(),
                active: document.getElementById('svc_active').checked
            };

            try {
                const url = editingServiceId ? `${CONFIG.API_URL}/api/services/${editingServiceId}` : `${CONFIG.API_URL}/api/services`;
                const method = editingServiceId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save service');
                }
                resetServiceForm();
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deleteService(id) {
            if (!confirm('Delete this service? It will disappear from the website immediately.')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/services/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete service');
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // ---- Internal Pricing Items ----
        function renderPricingItemsList() {
            const el = document.getElementById('pricingItemsList');
            if (!el) return;
            if (pricingItemsCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No pricing items yet.</p>';
                return;
            }
            el.innerHTML = pricingItemsCache.map(p => `
                <div class="flex flex-wrap justify-between items-center gap-2 border rounded-xl p-3 text-sm ${p.active ? '' : 'opacity-50'}">
                    <div>
                        <strong>${escapeHTML(p.name)}</strong>
                        <span class="text-xs text-gray-400 ml-2">${escapeHTML(p.category || '')}</span>
                        <span class="text-xs text-gray-500 ml-2">RM ${p.price}</span>
                        ${p.cost !== null && p.cost !== undefined ? `<span class="text-xs text-gray-400 ml-2">Cost: RM ${p.cost}</span>` : ''}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="editPricingItem(${p.id})" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">Edit</button>
                        <button onclick="deletePricingItem(${p.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition">Delete</button>
                    </div>
                </div>
            `).join('');
        }


        function editPricingItem(id) {
            const p = pricingItemsCache.find(x => x.id === id);
            if (!p) return;
            editingPricingItemId = id;
            document.getElementById('pi_category').value = p.category || '';
            document.getElementById('pi_name').value = p.name || '';
            document.getElementById('pi_price').value = p.price;
            document.getElementById('pi_cost').value = p.cost !== null && p.cost !== undefined ? p.cost : '';
            document.getElementById('piSaveLabel').textContent = 'Update Item';
            document.getElementById('piCancelBtn').classList.remove('hidden');
        }


        function resetPricingItemForm() {
            editingPricingItemId = null;
            document.getElementById('pi_category').value = '';
            document.getElementById('pi_name').value = '';
            document.getElementById('pi_price').value = '';
            document.getElementById('pi_cost').value = '';
            document.getElementById('piSaveLabel').textContent = 'Add Item';
            document.getElementById('piCancelBtn').classList.add('hidden');
        }


        async function savePricingItem() {
            const name = document.getElementById('pi_name').value.trim();
            const price = parseFloat(document.getElementById('pi_price').value);
            if (!name || isNaN(price)) { alert('Item name and price are required'); return; }

            const costRaw = document.getElementById('pi_cost').value;
            const cost = costRaw === '' ? '' : parseFloat(costRaw);

            const payload = {
                category: document.getElementById('pi_category').value.trim(),
                name,
                price,
                cost,
                active: true
            };

            try {
                const url = editingPricingItemId ? `${CONFIG.API_URL}/api/pricing/items/${editingPricingItemId}` : `${CONFIG.API_URL}/api/pricing/items`;
                const method = editingPricingItemId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save pricing item');
                }
                resetPricingItemForm();
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deletePricingItem(id) {
            if (!confirm('Delete this pricing item?')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/pricing/items/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete pricing item');
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // ---- Package Templates ----
        function addPkgItemRow(name = '', price = '') {
            const container = document.getElementById('pkgItemRows');
            const row = document.createElement('div');
            row.className = 'flex gap-2 items-center';
            row.innerHTML = `
                <input type="text" placeholder="Item name" value="${escapeHTML(name)}" class="pkg-item-name w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <input type="number" placeholder="Price (RM)" value="${price}" class="pkg-item-price w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <button onclick="this.parentElement.remove()" class="text-red-500 text-sm px-2">&#10005;</button>
            `;
            container.appendChild(row);
        }


        function renderPackagesList() {
            const el = document.getElementById('packagesList');
            if (!el) return;
            if (packagesCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No package templates yet.</p>';
                return;
            }
            el.innerHTML = packagesCache.map(p => `
                <div class="border rounded-xl p-3 text-sm">
                    <div class="flex flex-wrap justify-between items-center gap-2">
                        <strong>${escapeHTML(p.name)}</strong>
                        <div class="flex gap-2">
                            <button onclick="editPackage(${p.id})" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">Edit</button>
                            <button onclick="deletePackage(${p.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition">Delete</button>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                        ${(p.items || []).map(i => `${escapeHTML(i.name)}: RM ${i.price}`).join(', ')}
                    </div>
                </div>
            `).join('');
        }


        function editPackage(id) {
            const pkg = packagesCache.find(x => x.id === id);
            if (!pkg) return;
            editingPackageId = id;
            document.getElementById('pkg_name').value = pkg.name || '';
            const container = document.getElementById('pkgItemRows');
            container.innerHTML = '';
            (pkg.items || []).forEach(i => addPkgItemRow(i.name, i.price));
            document.getElementById('pkgSaveLabel').textContent = 'Update Package';
            document.getElementById('pkgCancelBtn').classList.remove('hidden');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }


        function resetPackageForm() {
            editingPackageId = null;
            document.getElementById('pkg_name').value = '';
            document.getElementById('pkgItemRows').innerHTML = '';
            document.getElementById('pkgSaveLabel').textContent = 'Save Package';
            document.getElementById('pkgCancelBtn').classList.add('hidden');
        }


        async function savePackage() {
            const name = document.getElementById('pkg_name').value.trim();
            if (!name) { alert('Package name is required'); return; }

            const items = [];
            document.querySelectorAll('#pkgItemRows > div').forEach(row => {
                const itemName = row.querySelector('.pkg-item-name')?.value.trim();
                const itemPrice = parseFloat(row.querySelector('.pkg-item-price')?.value);
                if (itemName && !isNaN(itemPrice)) items.push({ name: itemName, price: itemPrice });
            });

            if (items.length === 0) { alert('Add at least one item to the package'); return; }

            try {
                const url = editingPackageId ? `${CONFIG.API_URL}/api/pricing/packages/${editingPackageId}` : `${CONFIG.API_URL}/api/pricing/packages`;
                const method = editingPackageId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ name, items, active: true })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save package');
                }
                resetPackageForm();
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deletePackage(id) {
            if (!confirm('Delete this package template?')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/pricing/packages/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete package');
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


