// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // TODAY DASHBOARD
        // ------------------------------------------------------------
        function renderTaskCard(t, today) {
            const overdue = t.due_date && new Date(t.due_date) < today;
            return `
                <div class="item ${overdue ? 'sev-critical' : 'sev-info'}">
                    <div class="item-main">
                        <div class="item-top"><span class="who">${escapeHTML(t.title)}</span><span class="when">${t.due_date ? `Due ${formatDate(t.due_date)}${overdue ? ' (overdue)' : ''}` : 'No due date'}</span></div>
                        <div class="item-detail">${escapeHTML(t.customer_name)}${t.quotation_no ? ' &middot; ' + escapeHTML(t.quotation_no) : ''}${t.assigned_to_username ? ' &middot; ' + escapeHTML(t.assigned_to_username) : ''}</div>
                        <div class="item-actions">
                            <button onclick="toggleTaskDone(${t.id}, ${t.quotation_id}, true, false); loadOpenTasksToday();" class="btn btn-ghost">Done</button>
                        </div>
                    </div>
                </div>
            `;
        }


        // Dashboard redesign - Tasks rail panel shares two lists
        // (todayEventTasksList / todayTasksList, both still populated by
        // loadOpenTasksToday in today.js) behind a tab switch instead of
        // two separate stacked cards.
        function showTasksRailTab(tab) {
            const todayEl = document.getElementById('todayEventTasksList');
            const allEl = document.getElementById('todayTasksList');
            const todayBtn = document.getElementById('tasksTabToday');
            const allBtn = document.getElementById('tasksTabAll');
            if (!todayEl || !allEl) return;
            todayEl.classList.toggle('hidden', tab !== 'today');
            allEl.classList.toggle('hidden', tab !== 'all');
            if (todayBtn) todayBtn.classList.toggle('tab-btn-active', tab === 'today');
            if (allBtn) allBtn.classList.toggle('tab-btn-active', tab === 'all');
        }


        // ------------------------------------------------------------
        // TASK CHECKLIST (per quotation)
        // ------------------------------------------------------------
        async function toggleTaskChecklist(quotationId) {
            const panel = document.getElementById(`taskPanel_${quotationId}`);
            if (!panel) return;
            const isHidden = panel.classList.contains('hidden');
            panel.classList.toggle('hidden');
            if (isHidden) {
                await loadTasks(quotationId);
            }
        }


        async function loadTasks(quotationId) {
            const listEl = document.getElementById(`taskList_${quotationId}`);
            if (!listEl) return;
            listEl.innerHTML = '<p class="text-xs text-gray-400">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks/quotation/${quotationId}`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to load tasks');
                const result = await res.json();
                renderTasks(quotationId, result.data || []);
            } catch (err) {
                listEl.innerHTML = '<p class="text-xs text-red-500">Failed to load tasks.</p>';
            }
        }


        function renderTasks(quotationId, tasks) {
            const listEl = document.getElementById(`taskList_${quotationId}`);
            if (!listEl) return;
            if (tasks.length === 0) {
                listEl.innerHTML = '<p class="text-xs text-gray-400">No tasks yet.</p>';
                return;
            }
            listEl.innerHTML = tasks.map(t => `
                <div class="flex items-center gap-2 text-xs py-1">
                    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTaskDone(${t.id}, ${quotationId}, this.checked, ${t.done})">
                    <span class="flex-1 ${t.done ? 'line-through text-gray-400' : ''}">${escapeHTML(t.title)}</span>
                    <select onchange="reassignTask(${t.id}, ${quotationId}, this.value)" class="border rounded-lg px-1 py-0.5 text-xs">
                        <option value="" ${!t.assigned_to_admin_id ? 'selected' : ''}>Unassigned</option>
                        ${adminUsernamesCache.map(u => `<option value="${u.id}" ${String(t.assigned_to_admin_id) === String(u.id) ? 'selected' : ''}>${escapeHTML(u.username)}</option>`).join('')}
                    </select>
                    <button onclick="deleteTask(${t.id}, ${quotationId})" class="text-red-400 hover:text-red-600 transition">&#10005;</button>
                </div>
            `).join('');
        }


        async function addTask(quotationId) {
            const input = document.getElementById(`newTaskInput_${quotationId}`);
            const assigneeSelect = document.getElementById(`newTaskAssignee_${quotationId}`);
            const title = input.value.trim();
            if (!title) return;

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({
                        quotation_id: quotationId,
                        title,
                        assigned_to_admin_id: assigneeSelect?.value || null
                    })
                });
                if (!res.ok) throw new Error('Failed to add task');
                input.value = '';
                await loadTasks(quotationId);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // BAU backlog #25 - applying a task template is a pure frontend
        // loop over the cached template's items, calling the exact same
        // POST /api/tasks endpoint addTask() above uses, once per item -
        // no dedicated "apply" backend route, matching exactly how
        // applyPackage() works for quotation line items.
        async function applyTaskTemplate(quotationId) {
            const select = document.getElementById(`applyTplSelect_${quotationId}`);
            const templateId = select?.value;
            if (!templateId) return;

            const template = taskTemplatesCache.find(t => String(t.id) === String(templateId));
            if (!template || !Array.isArray(template.items) || template.items.length === 0) return;

            if (!confirm(`Add ${template.items.length} task(s) from "${template.name}" to this booking?`)) return;

            try {
                for (const item of template.items) {
                    await fetch(`${CONFIG.API_URL}/api/tasks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                        body: JSON.stringify({ quotation_id: quotationId, title: item.title })
                    });
                }
                if (select) select.value = '';
                await loadTasks(quotationId);
            } catch (err) {
                alert('Error applying template: ' + err.message);
            }
        }


        async function reassignTask(taskId, quotationId, adminId) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ assigned_to_admin_id: adminId || null })
                });
                if (!res.ok) throw new Error('Failed to reassign task');
                await loadTasks(quotationId);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // BAU backlog #6 - oldDone defaults to the opposite of the new
        // value (a plain toggle), but callers that already know the
        // previous value (e.g. the task list checkbox, which has the
        // task object in scope) pass it explicitly instead of assuming.
        async function toggleTaskDone(taskId, quotationId, done, oldDone) {
            if (oldDone === undefined) oldDone = !done;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ done })
                });
                if (!res.ok) throw new Error('Failed to update task');
                await loadTasks(quotationId);
                showUndoToast(`Task marked ${done ? 'done' : 'not done'}.`, () => undoTaskDone(taskId, quotationId, oldDone, done));
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function undoTaskDone(taskId, quotationId, revertTo, revertFrom) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ done: revertTo, if_current_equals_done: revertFrom })
                });

                if (res.status === 409) {
                    alert("Can't undo - this was already changed.");
                    await loadTasks(quotationId);
                    return;
                }
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to undo');
                }

                await loadTasks(quotationId);
            } catch (err) {
                alert('Undo failed: ' + err.message);
            }
        }


        async function deleteTask(taskId, quotationId) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/tasks/${taskId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to delete task');
                await loadTasks(quotationId);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
