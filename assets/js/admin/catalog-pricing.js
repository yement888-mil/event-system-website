// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // CATALOG: SERVICES + PRICING ITEMS + PACKAGES
        // ------------------------------------------------------------
        async function loadCatalog() {
            try {
                const [svcRes, itemsRes, pkgRes, galRes, faqRes, tplRes, userRes, peakRes, propsRes, demandRes, pairsRes, feedTokenRes, taskTplRes] = await Promise.all([
                    fetch(`${CONFIG.API_URL}/api/services/admin`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/pricing/items`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/pricing/packages`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/gallery/admin`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/faq/admin`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/message-templates`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/admin/usernames`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/peak-periods`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/props`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/calendar/high-demand-weeks`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/quotation/frequent-pairs`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/calendar/feed-token`, { headers: { Authorization: `Bearer ${adminToken}` } }),
                    fetch(`${CONFIG.API_URL}/api/tasks/templates`, { headers: { Authorization: `Bearer ${adminToken}` } })
                ]);

                if (svcRes.status === 401 || itemsRes.status === 401 || pkgRes.status === 401) return;

                const svcData = await svcRes.json();
                const itemsData = await itemsRes.json();
                const pkgData = await pkgRes.json();
                const galData = await galRes.json();
                const faqData = await faqRes.json();
                const tplData = await tplRes.json();
                const userData = await userRes.json();
                const peakData = await peakRes.json();
                const propsData = await propsRes.json();
                const demandData = await demandRes.json();
                const pairsData = await pairsRes.json();
                const feedTokenData = await feedTokenRes.json();
                const taskTplData = await taskTplRes.json();

                servicesCache = svcData.data || [];
                pricingItemsCache = itemsData.data || [];
                packagesCache = pkgData.data || [];
                galleryCache = galData.data || [];
                faqCache = faqData.data || [];
                messageTemplatesCache = tplData.data || [];
                adminUsernamesCache = userData.data || [];
                peakPeriodsCache = peakData.data || [];
                propsCache = propsData.data || [];
                highDemandWeeksCache = new Set((demandData.data || []).map(w => w.week_start));
                frequentPairsCache = pairsData.data || [];
                calendarFeedToken = feedTokenData.token || '';
                taskTemplatesCache = taskTplData.data || [];

                renderServicesAdminList();
                renderPricingItemsList();
                renderPackagesList();
                populatePackageSelect();
                populateQuickAddSelect();
                renderGalleryAdminList();
                renderFaqAdminList();
                renderMessageTemplatesList();
                renderPeakPeriodsList();
                renderAdminCalendar();
                renderPropsList();
                renderCalendarFeedLink();
                renderTaskTemplatesList();

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
            document.getElementById('svc_managed_by').value = s.managed_by || '';
            document.getElementById('svc_image_url').value = s.image_url || '';
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
            document.getElementById('svc_managed_by').value = '';
            document.getElementById('svc_image_url').value = '';
            document.getElementById('svc_description').value = '';
            document.getElementById('svc_active').checked = true;
            document.getElementById('svcSaveLabel').textContent = 'Add Service';
            document.getElementById('svcCancelBtn').classList.add('hidden');
        }


        async function saveService() {
            const name = document.getElementById('svc_name').value.trim();
            if (!name) { alert('Service name is required'); return; }

            const payload = {
                name,
                category: document.getElementById('svc_category').value.trim(),
                managed_by: document.getElementById('svc_managed_by').value.trim(),
                image_url: document.getElementById('svc_image_url').value.trim(),
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


        // ---- Physical Props / Inventory (BAU backlog #38) ----
        function renderPropsList() {
            const el = document.getElementById('propsList');
            if (!el) return;
            if (propsCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No props yet.</p>';
                return;
            }
            el.innerHTML = propsCache.map(p => `
                <div class="flex flex-wrap justify-between items-center gap-2 border rounded-xl p-3 text-sm ${p.active ? '' : 'opacity-50'}">
                    <div>
                        <strong>${escapeHTML(p.name)}</strong>
                        ${p.description ? `<span class="text-xs text-gray-400 ml-2">${escapeHTML(p.description)}</span>` : ''}
                        <span class="text-xs text-gray-500 ml-2">Qty: ${p.quantity_available}</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="editProp(${p.id})" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">Edit</button>
                        <button onclick="deleteProp(${p.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition">Delete</button>
                    </div>
                </div>
            `).join('');
        }


        function editProp(id) {
            const p = propsCache.find(x => x.id === id);
            if (!p) return;
            editingPropId = id;
            document.getElementById('prop_name').value = p.name || '';
            document.getElementById('prop_description').value = p.description || '';
            document.getElementById('prop_quantity').value = p.quantity_available;
            document.getElementById('propSaveLabel').textContent = 'Update Prop';
            document.getElementById('propCancelBtn').classList.remove('hidden');
        }


        function resetPropForm() {
            editingPropId = null;
            document.getElementById('prop_name').value = '';
            document.getElementById('prop_description').value = '';
            document.getElementById('prop_quantity').value = '';
            document.getElementById('propSaveLabel').textContent = 'Add Prop';
            document.getElementById('propCancelBtn').classList.add('hidden');
        }


        async function saveProp() {
            const name = document.getElementById('prop_name').value.trim();
            const quantity_available = parseInt(document.getElementById('prop_quantity').value, 10);
            if (!name || !Number.isFinite(quantity_available) || quantity_available <= 0) {
                alert('Prop name and a positive quantity are required');
                return;
            }

            const payload = {
                name,
                description: document.getElementById('prop_description').value.trim(),
                quantity_available,
                active: true
            };

            try {
                const url = editingPropId ? `${CONFIG.API_URL}/api/props/${editingPropId}` : `${CONFIG.API_URL}/api/props`;
                const method = editingPropId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save prop');
                }
                resetPropForm();
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deleteProp(id) {
            if (!confirm('Delete this prop? This also removes it from any booking it is currently assigned to.')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/props/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete prop');
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


        // ---- Task Templates (BAU backlog #25) - exact same shape as
        // Package Templates above, just title-only items (no price) and
        // POST /api/tasks/templates instead of /api/pricing/packages. ----
        function addTplItemRow(title = '') {
            const container = document.getElementById('tplItemRows');
            const row = document.createElement('div');
            row.className = 'flex gap-2 items-center';
            row.innerHTML = `
                <input type="text" placeholder="Task title" value="${escapeHTML(title)}" class="tpl-item-title w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <button onclick="this.parentElement.remove()" class="text-red-500 text-sm px-2">&#10005;</button>
            `;
            container.appendChild(row);
        }


        function renderTaskTemplatesList() {
            const el = document.getElementById('taskTemplatesList');
            if (!el) return;
            if (taskTemplatesCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No task templates yet.</p>';
                return;
            }
            el.innerHTML = taskTemplatesCache.map(t => `
                <div class="border rounded-xl p-3 text-sm">
                    <div class="flex flex-wrap justify-between items-center gap-2">
                        <strong>${escapeHTML(t.name)}</strong>
                        <div class="flex gap-2">
                            <button onclick="editTaskTemplate(${t.id})" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">Edit</button>
                            <button onclick="deleteTaskTemplate(${t.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition">Delete</button>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                        ${(t.items || []).map(i => escapeHTML(i.title)).join(', ')}
                    </div>
                </div>
            `).join('');
        }


        function editTaskTemplate(id) {
            const tpl = taskTemplatesCache.find(x => x.id === id);
            if (!tpl) return;
            editingTaskTemplateId = id;
            document.getElementById('tpl_name').value = tpl.name || '';
            const container = document.getElementById('tplItemRows');
            container.innerHTML = '';
            (tpl.items || []).forEach(i => addTplItemRow(i.title));
            document.getElementById('tplSaveLabel').textContent = 'Update Template';
            document.getElementById('tplCancelBtn').classList.remove('hidden');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }


        function resetTaskTemplateForm() {
            editingTaskTemplateId = null;
            document.getElementById('tpl_name').value = '';
            document.getElementById('tplItemRows').innerHTML = '';
            document.getElementById('tplSaveLabel').textContent = 'Save Template';
            document.getElementById('tplCancelBtn').classList.add('hidden');
        }


        async function saveTaskTemplate() {
            const name = document.getElementById('tpl_name').value.trim();
            if (!name) { alert('Template name is required'); return; }

            const items = [];
            document.querySelectorAll('#tplItemRows > div').forEach(row => {
                const title = row.querySelector('.tpl-item-title')?.value.trim();
                if (title) items.push({ title });
            });

            if (items.length === 0) { alert('Add at least one item to the template'); return; }

            try {
                const url = editingTaskTemplateId ? `${CONFIG.API_URL}/api/tasks/templates/${editingTaskTemplateId}` : `${CONFIG.API_URL}/api/tasks/templates`;
                const method = editingTaskTemplateId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ name, items, active: true })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save task template');
                }
                resetTaskTemplateForm();
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deleteTaskTemplate(id) {
            if (!confirm('Delete this task template?')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks/templates/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete task template');
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
