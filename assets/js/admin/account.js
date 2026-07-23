// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // LOGOUT
        // ------------------------------------------------------------
        // ------------------------------------------------------------
        // ACCOUNT: CHANGE MY PASSWORD
        // ------------------------------------------------------------
        async function changeMyPassword() {
            try {
                const current = document.getElementById('currentPasswordInput').value;
                const newPw = document.getElementById('newPasswordInput').value;

                if (!current || !newPw) {
                    alert('Please fill in both fields');
                    return;
                }
                if (newPw.length < 6) {
                    alert('New password must be at least 6 characters');
                    return;
                }

                const res = await fetch(`${CONFIG.API_URL}/api/admin/me/password`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ current_password: current, new_password: newPw })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to change password');
                }

                alert('Password updated successfully.');
                document.getElementById('currentPasswordInput').value = '';
                document.getElementById('newPasswordInput').value = '';

            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        // ------------------------------------------------------------
        // ACCOUNT: STAFF MANAGEMENT (owner only - also enforced server-side)
        // ------------------------------------------------------------
        async function loadStaffAccounts() {
            const el = document.getElementById('staffAccountsList');
            if (!el) return;
            el.innerHTML = '<p class="text-sm text-gray-400">Loading...</p>';

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/admin/users`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error('Failed to load accounts');
                const result = await res.json();
                renderStaffAccounts(result.data || []);
            } catch (err) {
                el.innerHTML = '<p class="text-sm text-red-500">Failed to load accounts.</p>';
            }
        }


        function renderStaffAccounts(accounts) {
            const el = document.getElementById('staffAccountsList');
            if (!el) return;
            el.innerHTML = accounts.map(a => `
                <div class="flex flex-wrap justify-between items-center border rounded-xl p-3 text-sm gap-2 ${a.active ? '' : 'opacity-50'}">
                    <div>
                        <strong>${escapeHTML(a.username)}</strong>
                        <span class="text-xs text-gray-400 ml-2">${a.role}</span>
                        ${!a.active ? '<span class="text-xs text-red-500 ml-2">(disabled)</span>' : ''}
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="toggleStaffRole(${a.id}, '${a.role === 'owner' ? 'staff' : 'owner'}')" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">Make ${a.role === 'owner' ? 'Staff' : 'Owner'}</button>
                        <button onclick="toggleStaffActive(${a.id}, ${!a.active})" class="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition">${a.active ? 'Disable' : 'Enable'}</button>
                        <button onclick="resetStaffPassword(${a.id})" class="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition">Reset Password</button>
                        <button onclick="deleteStaffAccount(${a.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition">Delete</button>
                    </div>
                </div>
            `).join('') || '<p class="text-sm text-gray-400">No accounts found.</p>';
        }


        async function createStaffAccount() {
            try {
                const username = document.getElementById('newStaffUsername').value.trim();
                const password = document.getElementById('newStaffPassword').value;
                const role = document.getElementById('newStaffRole').value;

                if (!username || !password) {
                    alert('Username and password are required');
                    return;
                }

                const res = await fetch(`${CONFIG.API_URL}/api/admin/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ username, password, role })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to create account');
                }

                document.getElementById('newStaffUsername').value = '';
                document.getElementById('newStaffPassword').value = '';
                await loadStaffAccounts();

            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function toggleStaffRole(id, newRole) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/admin/users/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ role: newRole })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to update role');
                }
                await loadStaffAccounts();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function toggleStaffActive(id, newActive) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/admin/users/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ active: newActive })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to update account');
                }
                await loadStaffAccounts();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function resetStaffPassword(id) {
            const newPw = prompt('Enter a new password for this account (6+ characters):');
            if (!newPw) return;
            if (newPw.length < 6) { alert('Password must be at least 6 characters'); return; }

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/admin/users/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ new_password: newPw })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to reset password');
                }
                alert('Password reset successfully.');
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }


        async function deleteStaffAccount(id) {
            if (!confirm('Delete this account? They will no longer be able to log in.')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/admin/users/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to delete account');
                }
                await loadStaffAccounts();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
