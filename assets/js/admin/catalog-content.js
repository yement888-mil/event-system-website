// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ---- Gallery ----
        function renderGalleryAdminList() {
            const el = document.getElementById('galleryAdminList');
            if (!el) return;
            if (galleryCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400 col-span-full">No photos yet.</p>';
                return;
            }
            el.innerHTML = galleryCache.map(g => `
                <div class="border rounded-xl overflow-hidden text-xs ${g.active ? '' : 'opacity-50'}">
                    <img src="${escapeHTML(g.image_url)}" alt="${escapeHTML(g.alt_text || g.title || 'Gallery photo')}" class="w-full aspect-square object-cover" onerror="this.style.display='none'">
                    <div class="p-2">
                        <div class="truncate">${escapeHTML(g.title || g.category || 'Untitled')}</div>
                        <div class="flex gap-1 mt-1">
                            <button onclick="editGalleryItem(${g.id})" class="flex-1 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition">Edit</button>
                            <button onclick="deleteGalleryItem(${g.id})" class="flex-1 bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 transition">Del</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }


        function editGalleryItem(id) {
            const g = galleryCache.find(x => x.id === id);
            if (!g) return;
            editingGalleryItemId = id;
            document.getElementById('gal_title').value = g.title || '';
            document.getElementById('gal_category').value = g.category || '';
            document.getElementById('gal_alt_text').value = g.alt_text || '';
            document.getElementById('gal_image_url').value = g.image_url || '';
            document.getElementById('gal_active').checked = g.active !== false;
            document.getElementById('galSaveLabel').textContent = 'Update Photo';
            document.getElementById('galCancelBtn').classList.remove('hidden');
            if (g.image_url) {
                document.getElementById('galUploadPreviewImg').src = g.image_url;
                document.getElementById('galUploadPreview').classList.remove('hidden');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }


        function resetGalleryForm() {
            editingGalleryItemId = null;
            document.getElementById('gal_title').value = '';
            document.getElementById('gal_category').value = '';
            document.getElementById('gal_alt_text').value = '';
            document.getElementById('gal_image_url').value = '';
            document.getElementById('gal_active').checked = true;
            document.getElementById('galSaveLabel').textContent = 'Add Photo';
            document.getElementById('galCancelBtn').classList.add('hidden');
            document.getElementById('gal_image_file').value = '';
            document.getElementById('galUploadPreview').classList.add('hidden');
        }


        async function uploadGalleryPhoto() {
            const fileInput = document.getElementById('gal_image_file');
            const files = [...fileInput.files];
            if (files.length === 0) return;

            const label = document.getElementById('galUploadLabel');
            const originalText = label.textContent;

            // Single file: unchanged behavior - upload, preview, let the
            // admin edit the title before clicking "Add Photo" themselves.
            if (files.length === 1) {
                label.textContent = 'Uploading...';
                try {
                    const formData = new FormData();
                    formData.append('image', files[0]);

                    const res = await fetch(`${CONFIG.API_URL}/api/upload/image`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${adminToken}` },
                        body: formData
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
                        throw new Error(err.error || 'Upload failed');
                    }

                    const result = await res.json();
                    document.getElementById('gal_image_url').value = result.url;

                    const preview = document.getElementById('galUploadPreview');
                    const previewImg = document.getElementById('galUploadPreviewImg');
                    previewImg.src = result.url;
                    preview.classList.remove('hidden');

                } catch (err) {
                    alert('Upload failed: ' + err.message);
                } finally {
                    label.textContent = originalText;
                }
                return;
            }

            // Multiple files: upload the whole batch, then create one
            // gallery item per photo automatically using the shared
            // title/category/active fields already in the form - editing
            // each photo's title individually isn't practical for a batch.
            label.textContent = `Uploading ${files.length} photos...`;
            try {
                const formData = new FormData();
                files.forEach(f => formData.append('images', f));

                const res = await fetch(`${CONFIG.API_URL}/api/upload/images`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${adminToken}` },
                    body: formData
                });

                if (res.status === 401) {
                    localStorage.removeItem('adminToken');
                    adminToken = '';
                    document.getElementById('toolContent').classList.add('hidden');
                    document.getElementById('passwordGate').classList.remove('hidden');
                    return;
                }

                const result = await res.json();
                if (!res.ok || !result.urls || result.urls.length === 0) {
                    throw new Error(result.error || 'Upload failed');
                }

                const title = document.getElementById('gal_title').value.trim();
                const category = document.getElementById('gal_category').value.trim();
                const alt_text = document.getElementById('gal_alt_text').value.trim();
                const active = document.getElementById('gal_active').checked;

                for (const url of result.urls) {
                    await fetch(`${CONFIG.API_URL}/api/gallery`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                        body: JSON.stringify({ title, category, alt_text, image_url: url, active })
                    });
                }

                if (result.errors && result.errors.length > 0) {
                    alert(`Added ${result.urls.length} photo(s). ${result.errors.length} failed:\n${result.errors.join('\n')}`);
                }

                resetGalleryForm();
                await loadCatalog();

            } catch (err) {
                alert('Batch upload failed: ' + err.message);
            } finally {
                label.textContent = originalText;
            }
        }


        async function saveGalleryItem() {
            const image_url = document.getElementById('gal_image_url').value.trim();
            if (!image_url) { alert('Image URL is required'); return; }

            const payload = {
                title: document.getElementById('gal_title').value.trim(),
                category: document.getElementById('gal_category').value.trim(),
                alt_text: document.getElementById('gal_alt_text').value.trim(),
                image_url,
                active: document.getElementById('gal_active').checked
            };

            try {
                const url = editingGalleryItemId ? `${CONFIG.API_URL}/api/gallery/${editingGalleryItemId}` : `${CONFIG.API_URL}/api/gallery`;
                const method = editingGalleryItemId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save photo');
                }
                resetGalleryForm();
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deleteGalleryItem(id) {
            if (!confirm('Delete this photo?')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/gallery/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete photo');
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // ---- FAQ ----
        function renderFaqAdminList() {
            const el = document.getElementById('faqAdminList');
            if (!el) return;
            if (faqCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No FAQs yet.</p>';
                return;
            }
            el.innerHTML = faqCache.map(f => `
                <div class="border rounded-xl p-3 text-sm ${f.active ? '' : 'opacity-50'}">
                    <div class="flex justify-between items-start gap-2">
                        <strong>${escapeHTML(f.question)}</strong>
                        <div class="flex gap-2 flex-shrink-0">
                            <button onclick="editFaqItem(${f.id})" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">Edit</button>
                            <button onclick="deleteFaqItem(${f.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition">Delete</button>
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">${escapeHTML(f.answer)}</p>
                </div>
            `).join('');
        }


        function editFaqItem(id) {
            const f = faqCache.find(x => x.id === id);
            if (!f) return;
            editingFaqItemId = id;
            document.getElementById('faq_question').value = f.question || '';
            document.getElementById('faq_answer').value = f.answer || '';
            document.getElementById('faqSaveLabel').textContent = 'Update FAQ';
            document.getElementById('faqCancelBtn').classList.remove('hidden');
        }


        function resetFaqForm() {
            editingFaqItemId = null;
            document.getElementById('faq_question').value = '';
            document.getElementById('faq_answer').value = '';
            document.getElementById('faqSaveLabel').textContent = 'Add FAQ';
            document.getElementById('faqCancelBtn').classList.add('hidden');
        }


        async function saveFaqItem() {
            const question = document.getElementById('faq_question').value.trim();
            const answer = document.getElementById('faq_answer').value.trim();
            if (!question || !answer) { alert('Question and answer are required'); return; }

            try {
                const url = editingFaqItemId ? `${CONFIG.API_URL}/api/faq/${editingFaqItemId}` : `${CONFIG.API_URL}/api/faq`;
                const method = editingFaqItemId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ question, answer, active: true })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save FAQ');
                }
                resetFaqForm();
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deleteFaqItem(id) {
            if (!confirm('Delete this FAQ item?')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/faq/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete FAQ');
                await loadCatalog();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // ---- WhatsApp Message Templates ----
        function renderMessageTemplatesList() {
            const el = document.getElementById('messageTemplatesList');
            if (!el) return;
            if (messageTemplatesCache.length === 0) {
                el.innerHTML = '<p class="text-sm text-gray-400">No templates found.</p>';
                return;
            }
            el.innerHTML = messageTemplatesCache.map(t => `
                <div class="border rounded-xl p-3">
                    <label class="block text-sm font-medium mb-1">${escapeHTML(t.label)}</label>
                    <textarea id="tpl_${t.key}" rows="8" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono">${escapeHTML(t.body)}</textarea>
                    <button onclick="saveMessageTemplate('${t.key}')" class="mt-2 bg-dark text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-gold hover:text-dark transition">
                        Save Template
                    </button>
                </div>
            `).join('');
        }


        async function saveMessageTemplate(key) {
            try {
                const textarea = document.getElementById(`tpl_${key}`);
                if (!textarea) return;

                const res = await fetch(`${CONFIG.API_URL}/api/message-templates/${key}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ body: textarea.value })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save template');
                }

                await loadCatalog();
                alert('Template saved.');
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
