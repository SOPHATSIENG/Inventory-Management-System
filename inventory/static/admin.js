
        const API_BASE = 'http://127.0.0.1:5000/api';
        let users = [], products = [], categories = [], customers = [], sales = [], logs = [];
        let charts = {};
        let dt = {}; // DataTable instances
        let cart = [];
        let currentUser = { username: 'admin', email: 'admin@inventorypro.com' };

        /* -------------------------- UTILITIES -------------------------- */
        function showToast(message, type = 'success', title = '') {
            const toastEl = document.getElementById('liveToast');
            document.getElementById('toastBody').textContent = message;
            document.getElementById('toastTitle').textContent = title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info');
            toastEl.classList.remove('toast-success', 'toast-error', 'toast-info', 'toast-warning');
            toastEl.classList.add(type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : 'toast-info');
            new bootstrap.Toast(toastEl).show();
        }
        function formatCurrency(amount) { return `$${parseFloat(amount).toFixed(2)}`; }
        function getStatusBadge(status) {
            const map = { 'Active': 'status-completed', 'Pending': 'status-pending', 'Cancelled': 'status-cancelled' };
            return `<span class="badge-status ${map[status] || 'status-completed'}">${status}</span>`;
        }
        function initTable(tableId, columnsCount) {
            if (dt[tableId]) { try { dt[tableId].destroy(); } catch (e) {} }
            dt[tableId] = $(`#${tableId}`).DataTable({
                pageLength: 8, lengthChange: false, ordering: false, info: false,
                columnDefs: [{ targets: columnsCount - 1, orderable: false }]
            });
        }

        /* -------------------------- CATEGORY HELPERS -------------------------- */
        function populateCategorySelect() {
            const sel = document.getElementById('product-category');
            sel.innerHTML = '<option value="">-- Select Category --</option>';
            categories.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        }
        function openCategoryModal(id = null) {
            const modal = new bootstrap.Modal('#categoryModal');
            const title = document.getElementById('categoryModalTitle');
            const nameInp = document.getElementById('categoryName');
            const descInp = document.getElementById('categoryDesc');
            const hidden = document.getElementById('editCategoryId');

            if (id) {
                const cat = categories.find(c => c.id == id);
                if (!cat) return showToast('Category not found', 'error');
                title.textContent = 'Edit Category';
                hidden.value = cat.id;
                nameInp.value = cat.name;
                descInp.value = cat.description || '';
            } else {
                title.textContent = 'Add Category';
                hidden.value = '';
                nameInp.value = '';
                descInp.value = '';
            }
            nameInp.classList.remove('is-invalid');
            modal.show();
        }
        function isCategoryNameUnique(name, excludeId = null) {
            return !categories.some(c => c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.id != excludeId);
        }
        async function saveCategory() {
            const id = document.getElementById('editCategoryId').value;
            const name = document.getElementById('categoryName').value.trim();
            const desc = document.getElementById('categoryDesc').value.trim();
            const nameInp = document.getElementById('categoryName');

            if (!name) { nameInp.classList.add('is-invalid'); return; }
            if (!isCategoryNameUnique(name, id)) {
                nameInp.classList.add('is-invalid');
                showToast('Category name already exists', 'error');
                return;
            }
            nameInp.classList.remove('is-invalid');

            const payload = { name, description: desc };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE}/categories/${id}` : `${API_BASE}/categories`;

            try {
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) throw new Error((await res.json()).message || 'Server error');
                const saved = await res.json();

                if (id) {
                    const idx = categories.findIndex(c => c.id == id);
                    if (idx > -1) categories[idx] = saved;
                    showToast('Category updated', 'success');
                } else {
                    categories.unshift(saved);
                    showToast('Category added', 'success');
                }
                renderCategories();
                populateCategorySelect();
                renderProducts();          // refresh product table
                renderPOSProducts();       // refresh POS grid
                bootstrap.Modal.getInstance('#categoryModal').hide();
            } catch (e) {
                console.error(e);
                showToast(e.message || 'Failed to save category', 'error');
            }
        }
        async function deleteCategory(id) {
            const cat = categories.find(c => c.id == id);
            if (!cat) return;
            const linked = products.filter(p => p.category_id == id).length;
            if (linked && !confirm(`Warning: ${linked} product(s) belong to "${cat.name}". Delete anyway?`)) return;
            if (!confirm('Delete this category permanently?')) return;

            try {
                const res = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error((await res.json()).message || 'Server error');
                categories = categories.filter(c => c.id != id);
                products.forEach(p => { if (p.category_id == id) p.category_id = null; });
                renderCategories();
                populateCategorySelect();
                renderProducts();
                renderPOSProducts();
                showToast('Category deleted', 'success');
            } catch (e) {
                console.error(e);
                showToast(e.message || 'Failed to delete', 'error');
            }
        }

        /* -------------------------- RENDER CATEGORIES -------------------------- */
        function renderCategories() {
            initTable('categories-table', 5);
            const tbody = $('#categories-table tbody');
            tbody.empty();
            categories.forEach(c => {
                const productCount = products.filter(p => p.category_id == c.id).length;
                const tr = $(`
                    <tr data-id="${c.id}" class="row-fade-in">
                        <td>${c.id}</td><td>${c.name}</td><td>${c.description || ''}</td><td>${productCount}</td>
                        <td>
                            <button class="btn btn-sm btn-primary edit-category" data-id="${c.id}"><i class="fa fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger delete-category" data-id="${c.id}"><i class="fa fa-trash"></i></button>
                        </td>
                    </tr>`);
                dt['categories-table'].row.add(tr).draw(false);
            });
            if (charts.categoryPie) charts.categoryPie.destroy();
            const pieData = categories.map(c => ({
                label: c.name,
                value: products.filter(p => p.category_id == c.id).length
            }));
            charts.categoryPie = new Chart(document.getElementById('categoryPieChart'), {
                type: 'pie',
                data: { labels: pieData.map(d => d.label), datasets: [{ data: pieData.map(d => d.value), backgroundColor: ['#1e40af','#3b82f6','#22c55e','#f59e0b','#ef4444'] }] },
                options: { plugins: { legend: { position: 'bottom' } } }
            });
        }

        /* -------------------------- PRODUCT SAVE -------------------------- */
        async function saveProduct() {
            const id = document.getElementById('product-id').value;
            const data = {
                code: document.getElementById('product-code').value.trim(),
                name: document.getElementById('product-name').value.trim(),
                category_id: document.getElementById('product-category').value || null,
                price: parseFloat(document.getElementById('product-price').value) || 0,
                cost: parseFloat(document.getElementById('product-cost').value) || 0,
                stock: parseInt(document.getElementById('product-stock').value) || 0,
                description: document.getElementById('product-desc').value.trim(),
                image: document.getElementById('product-image').value.trim()
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;

            try {
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (!res.ok) throw new Error((await res.json()).message || 'Server error');
                const saved = await res.json();

                if (id) {
                    const idx = products.findIndex(p => p.id == id);
                    if (idx > -1) products[idx] = saved;
                } else {
                    products.unshift(saved);
                }
                renderProducts();
                renderPOSProducts();
                populateCategorySelect();
                bootstrap.Modal.getInstance('#productModal').hide();
                showToast(id ? 'Product updated' : 'Product added', 'success');
            } catch (e) {
                console.error(e);
                showToast(e.message || 'Failed to save product', 'error');
            }
        }

        /* -------------------------- RENDER PRODUCTS -------------------------- */
        function renderProducts() {
            initTable('products-table', 10);
            const tbody = $('#products-table tbody');
            tbody.empty();
            products.forEach(p => {
                const cat = categories.find(c => c.id == p.category_id);
                const catName = cat ? cat.name : '-';
                const tr = $(`
                    <tr data-id="${p.id}" class="row-fade-in">
                        <td>${p.id}</td>
                        <td><img src="${p.image || ''}" width="50" alt=""></td>
                        <td>${p.code || ''}</td>
                        <td>${p.name}</td>
                        <td>${catName}</td>
                        <td>${p.price}</td>
                        <td>${p.cost || 'N/A'}</td>
                        <td class="${p.stock < 5 ? 'text-danger' : ''}">${p.stock}</td>
                        <td>${getStatusBadge(p.status || 'Active')}</td>
                        <td>
                            <button class="btn btn-sm btn-primary edit-product" data-id="${p.id}"><i class="fa fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger delete-product" data-id="${p.id}"><i class="fa fa-trash"></i></button>
                        </td>
                    </tr>`);
                dt['products-table'].row.add(tr).draw(false);
            });
        }

        /* -------------------------- POS GRID -------------------------- */
        function renderPOSProducts() {
            const container = document.getElementById('pos-products');
            container.innerHTML = '';
            products.filter(p => p.stock > 0).forEach(p => {
                const cat = categories.find(c => c.id == p.category_id);
                container.innerHTML += `
                <div class="col-md-4 mb-3">
                    <div class="card h-100 text-center p-3 position-relative pos-product-card" onclick="addToCart(${p.id})">
                        <img src="${p.image||'https://via.placeholder.com/80'}" class="rounded mx-auto d-block mb-2" height="80">
                        <h6 class=" "mb-1">${p.name}</h6>
                        <p class="text-muted small mb-1">${cat ? cat.name : ''}</p>
                        <strong>${formatCurrency(p.price)}</strong>
                        <span class="badge bg-info position-absolute top-0 end-0 m-2">Stock: ${p.stock}</span>
                    </div>
                </div>`;
            });
        }

        /* -------------------------- PAGE NAVIGATION -------------------------- */
        document.querySelectorAll('#sidebar .list-group-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('#sidebar .list-group-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
                document.getElementById(item.dataset.page).classList.remove('hidden');

                const refresh = {
                    dashboard: renderDashboard,
                    users: renderUsers,
                    products: renderProducts,
                    categories: renderCategories,
                    customers: renderCustomers,
                    sales: renderSales,
                    pos: () => { renderPOSProducts(); updateCart(); },
                    logs: renderLogs,
                    settings: loadSettingsFromLocal
                };
                if (refresh[item.dataset.page]) refresh[item.dataset.page]();

                if (window.innerWidth <= 992) {
                    document.getElementById('sidebar').style.marginLeft = '-260px';
                    document.getElementById('page-content').style.marginLeft = '0';
                }
            });
        });

        /* -------------------------- MOBILE SIDEBAR -------------------------- */
        document.getElementById('toggle-sidebar').addEventListener('click', e => {
            e.stopPropagation();
            const sidebar = document.getElementById('sidebar');
            const content = document.getElementById('page-content');
            sidebar.classList.toggle('show');
            if (sidebar.classList.contains('show')) {
                sidebar.style.marginLeft = '0';
                content.style.marginLeft = '260px';
            } else {
                sidebar.style.marginLeft = '-260px';
                content.style.marginLeft = '0';
            }
        });
        document.getElementById('page-content').addEventListener('click', () => {
            if (window.innerWidth <= 992) {
                document.getElementById('sidebar').style.marginLeft = '-260px';
                document.getElementById('page-content').style.marginLeft = '0';
            }
        });

        /* -------------------------- INITIAL LOAD -------------------------- */
        async function loadAll() {
            try {
                const [u, p, cus, cat, ord, lgs] = await Promise.all([
                    fetch(`${API_BASE}/users`).then(r => r.ok ? r.json() : []),
                    fetch(`${API_BASE}/products`).then(r => r.ok ? r.json() : []),
                    fetch(`${API_BASE}/customers`).then(r => r.ok ? r.json() : []),
                    fetch(`${API_BASE}/categories`).then(r => r.ok ? r.json() : []),
                    fetch(`${API_BASE}/orders`).then(r => r.ok ? r.json() : []),
                    fetch(`${API_BASE}/logs`).then(r => r.ok ? r.json() : [])
                ]);
                users = Array.isArray(u) ? u : [];
                products = Array.isArray(p) ? p : [];
                customers = Array.isArray(cus) ? cus : [];
                categories = Array.isArray(cat) ? cat : [];
                sales = Array.isArray(ord) ? ord : [];
                logs = Array.isArray(lgs) ? lgs : [];

                populateCategorySelect();
                renderAll();
                loadSettingsFromLocal();
            } catch (e) {
                console.error(e);
                showToast('Failed to load data', 'error');
            }
        }
        function renderAll() {
            renderDashboard(); renderUsers(); renderProducts(); renderCategories();
            renderCustomers(); renderSales(); renderPOSProducts(); renderLogs();
        }

        /* -------------------------- DASHBOARD -------------------------- */
        function renderDashboard() {
            document.getElementById('total-users').textContent = users.length;
            fetch(`${API_BASE}/dashboard`).then(r => r.ok ? r.json() : null).then(d => {
                if (d) {
                    document.getElementById('today-revenue').textContent = `$${d.todaySales.toFixed(2)}`;
                    document.getElementById('low-stock-count').textContent = d.lowStockCount;
                }
                document.getElementById('today-orders').textContent = sales.filter(o => new Date(o.date).toDateString() === new Date().toDateString()).length;
            }).catch(() => {});
            renderRevenueChart(); renderRecentLogs();
        }
        function renderRevenueChart() {
            if (charts.revenue) charts.revenue.destroy();
            charts.revenue = new Chart(document.getElementById('revenueChart'), {
                type: 'line',
                data: { labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                        datasets: [{ label: 'Revenue', data: [65,59,80,81,56,55,40,65,59,80,81,56], borderColor: 'rgb(75,192,192)', tension: 0.1 }] },
                options: { plugins: { legend: { display: false } } }
            });
        }
        function renderRecentLogs() {
            const list = document.getElementById('recent-logs');
            list.innerHTML = logs.slice(0,5).map(l => `<div class="list-group-item">${new Date(l.timestamp).toLocaleString()} - User ${l.user_id}: ${l.action}</div>`).join('');
        }

        /* -------------------------- USERS -------------------------- */
        function renderUsers() {
            initTable('users-table',5);
            $('#users-table tbody').empty();
            users.forEach(u => {
                const tr = $(`<tr data-id="${u.id}" class="row-fade-in">
                    <td>${u.id}</td><td>${u.username}</td><td>${u.role}</td><td>${u.email}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-user" data-id="${u.id}"><i class="fa fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger delete-user" data-id="${u.id}"><i class="fa fa-trash"></i></button>
                    </td>
                </tr>`);
                dt['users-table'].row.add(tr).draw(false);
            });
        }
        async function saveUser() {
            const id = document.getElementById('editUserId').value;
            const data = {
                username: document.getElementById('userUsername').value,
                password: document.getElementById('userPassword').value,
                role: document.getElementById('userRole').value,
                email: document.getElementById('userEmail').value
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE}/users/${id}` : `${API_BASE}/users`;
            try {
                const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
                if (!res.ok) throw new Error('Server error');
                showToast('User saved', 'success');
            } catch (e) { showToast('Failed to save user', 'error'); setTimeout(loadAll,600); }
            bootstrap.Modal.getInstance(document.getElementById('userModal'))?.hide();
        }

        /* -------------------------- CUSTOMERS -------------------------- */
        function renderCustomers() {
            initTable('customers-table',5);
            $('#customers-table tbody').empty();
            customers.forEach(c => {
                const tr = $(`<tr data-id="${c.id}" class="row-fade-in">
                    <td>${c.id}</td><td>${c.name}</td><td>${c.phone||''}</td><td>${c.email||''}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-customer" data-id="${c.id}"><i class="fa fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger delete-customer" data-id="${c.id}"><i class="fa fa-trash"></i></button>
                    </td>
                </tr>`);
                dt['customers-table'].row.add(tr).draw(false);
            });
        }
        async function saveCustomer() {
            const id = document.getElementById('editCustomerId').value;
            const data = {
                name: document.getElementById('customerName').value,
                phone: document.getElementById('customerPhone').value,
                email: document.getElementById('customerEmail').value
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE}/customers/${id}` : `${API_BASE}/customers`;
            try {
                const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
                if (!res.ok) throw new Error('Server error');
                showToast('Customer saved', 'success');
            } catch (e) { showToast('Failed to save customer', 'error'); setTimeout(loadAll,600); }
            bootstrap.Modal.getInstance(document.getElementById('customerModal'))?.hide();
        }

        /* -------------------------- SALES & LOGS -------------------------- */
        function renderSales(filtered = null) {
            initTable('sales-table',7);
            $('#sales-table tbody').empty();
            (filtered || sales).forEach(s => {
                const tr = $(`<tr data-id="${s.id}" class="row-fade-in">
                    <td>${s.id}</td><td>${s.order_id}</td><td>${new Date(s.date).toLocaleString()}</td><td>${s.customer}</td><td>${s.total}</td><td>${s.status}</td>
                    <td><button class="btn btn-sm btn-danger delete-sale" data-id="${s.id}"><i class="fa fa-trash"></i></button></td>
                </tr>`);
                dt['sales-table'].row.add(tr).draw(false);
            });
        }
        function renderLogs() {
            initTable('logs-table',5);
            $('#logs-table tbody').empty();
            logs.forEach(l => {
                const tr = $(`<tr data-id="${l.id}" class="row-fade-in">
                    <td>${l.id}</td><td>${l.user_id}</td><td>${l.action}</td><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.ip_address}</td>
                </tr>`);
                dt['logs-table'].row.add(tr).draw(false);
            });
        }

        /* -------------------------- POS CART -------------------------- */
        window.addToCart = async (id) => {
            const product = products.find(p => p.id == id);
            if (!product || product.stock <= 0) return showToast('Out of stock!', 'danger');
            const existing = cart.find(item => item.id == id);
            const qtyChange = existing ? 1 : 1;
            await fetch(`${API_BASE}/products/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ stock: product.stock - qtyChange }) });
            if (existing) existing.qty += 1; else cart.push({ ...product, qty: 1 });
            await loadAll(); updateCart(); showToast(`${product.name} added to cart!`);
        };
        const updateCart = () => {
            const tbody = document.querySelector('#cart-table tbody');
            tbody.innerHTML = '';
            let subtotal = 0;
            cart.forEach((item, idx) => {
                const lineTotal = item.price * item.qty;
                subtotal += lineTotal;
                tbody.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td><input type="number" class="form-control form-control-sm w-50 cart-qty" data-idx="${idx}" value="${item.qty}" min="1" max="999"></td>
                    <td>${formatCurrency(item.price)}</td>
                    <td>${formatCurrency(lineTotal)}</td>
                    <td><button class="btn btn-sm btn-danger remove-from-cart" data-idx="${idx}"><i class="fa fa-times"></i></button></td>
                </tr>`;
            });
            const tax = subtotal * 0.1;
            const total = subtotal + tax;
            document.getElementById('cart-subtotal').textContent = formatCurrency(subtotal);
            document.getElementById('cart-tax').textContent = formatCurrency(tax);
            document.getElementById('cart-total').textContent = formatCurrency(total);
            const paid = parseFloat(document.getElementById('amount-paid').value) || 0;
            document.getElementById('cart-change').textContent = formatCurrency(Math.max(0, paid - total));
        };
        $(document).on('click', '.remove-from-cart', async function () {
            const idx = parseInt($(this).data('idx'));
            const item = cart[idx];
            await fetch(`${API_BASE}/products/${item.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ stock: item.stock + item.qty }) });
            cart.splice(idx, 1); updateCart(); await loadAll(); showToast('Item removed!');
        });
        $(document).on('change', '.cart-qty', async function () {
            const idx = parseInt($(this).data('idx'));
            const newQty = parseInt(this.value);
            const item = cart[idx];
            const delta = newQty - item.qty;
            if (Math.abs(delta) > item.stock + Math.abs(delta)) { showToast('Not enough stock!', 'danger'); this.value = item.qty; return; }
            await fetch(`${API_BASE}/products/${item.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ stock: item.stock - delta }) });
            item.qty = newQty; updateCart(); await loadAll();
        });
        document.getElementById('amount-paid').addEventListener('input', updateCart);
        document.getElementById('clear-cart').addEventListener('click', () => {
            if (cart.length === 0 || !confirm('Clear cart?')) return;
            cart.forEach(async item => {
                await fetch(`${API_BASE}/products/${item.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ stock: item.stock + item.qty }) });
            });
            cart = []; updateCart(); loadAll(); showToast('Cart cleared!');
        });
        document.getElementById('checkout-btn').addEventListener('click', async () => {
            if (cart.length === 0) return showToast('Cart empty!', 'warning');
            const total = parseFloat(document.getElementById('cart-total').textContent.replace('$',''));
            const paid = parseFloat(document.getElementById('amount-paid').value) || 0;
            if (paid < total) return showToast('Payment insufficient!', 'danger');
            const orderData = { order_id: 'ORD' + Date.now(), items: cart.reduce((s,i)=>s+i.qty,0), total, payment: document.getElementById('payment-method').value, customer: 'Walk-in Customer' };
            await fetch(`${API_BASE}/orders`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(orderData) });
            cart = []; document.getElementById('amount-paid').value = ''; updateCart(); await loadAll();
            showToast(`Checkout OK! Change: ${formatCurrency(paid-total)}`);
        });

        /* -------------------------- EVENT DELEGATION -------------------------- */
        document.addEventListener('click', async e => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Category CRUD
            if (btn.id === 'btn-new-category') { openCategoryModal(); return; }
            if (btn.classList.contains('edit-category')) { openCategoryModal(btn.dataset.id); return; }
            if (btn.classList.contains('delete-category')) { deleteCategory(btn.dataset.id); return; }

            // Product edit
            if (btn.classList.contains('edit-product')) {
                const p = products.find(x => x.id == btn.dataset.id);
                if (!p) return;
                document.getElementById('modal-product-title').innerText = 'Edit Product';
                document.getElementById('product-id').value = p.id;
                document.getElementById('product-code').value = p.code || '';
                document.getElementById('product-name').value = p.name || '';
                populateCategorySelect(); document.getElementById('product-category').value = p.category_id || '';
                document.getElementById('product-price').value = p.price || 0;
                document.getElementById('product-cost').value = p.cost || '';
                document.getElementById('product-stock').value = p.stock || 0;
                document.getElementById('product-desc').value = p.description || '';
                document.getElementById('product-image').value = p.image || '';
                new bootstrap.Modal('#productModal').show();
                return;
            }
            if (btn.classList.contains('delete-product')) { deleteEntity('products', btn.dataset.id, 'products'); return; }

            // User edit/delete
            if (btn.classList.contains('edit-user')) {
                const u = users.find(x => x.id == btn.dataset.id);
                if (!u) return;
                document.getElementById('editUserId').value = u.id;
                document.getElementById('userUsername').value = u.username;
                document.getElementById('userPassword').value = '';
                document.getElementById('userRole').value = u.role;
                document.getElementById('userEmail').value = u.email;
                new bootstrap.Modal('#userModal').show();
                return;
            }
            if (btn.classList.contains('delete-user')) { deleteEntity('users', btn.dataset.id, 'users'); return; }

            // Customer edit/delete
            if (btn.classList.contains('edit-customer')) {
                const c = customers.find(x => x.id == btn.dataset.id);
                if (!c) return;
                document.getElementById('editCustomerId').value = c.id;
                document.getElementById('customerName').value = c.name;
                document.getElementById('customerPhone').value = c.phone || '';
                document.getElementById('customerEmail').value = c.email || '';
                new bootstrap.Modal('#customerModal').show();
                return;
            }
            if (btn.classList.contains('delete-customer')) { deleteEntity('customers', btn.dataset.id, 'customers'); return; }

            // Sale delete
            if (btn.classList.contains('delete-sale')) { deleteEntity('sales', btn.dataset.id, 'orders'); return; }
        });

        async function deleteEntity(kind, id, endpoint) {
            if (!confirm('Delete item?')) return;
            const row = $(`#${kind}-table tbody tr[data-id="${id}"]`);
            if (row.length) { row.addClass('row-fade-out'); setTimeout(() => { try { dt[`${kind}-table`].row(row).remove().draw(false); } catch (e) { row.remove(); } }, 260); }
            if (kind === 'users') users = users.filter(x => x.id != id);
            if (kind === 'products') products = products.filter(x => x.id != id);
            if (kind === 'categories') categories = categories.filter(x => x.id != id);
            if (kind === 'customers') customers = customers.filter(x => x.id != id);
            if (kind === 'sales') sales = sales.filter(x => x.id != id);
            try {
                const res = await fetch(`${API_BASE}/${endpoint}/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Server error');
                showToast('Deleted successfully', 'success');
            } catch (e) { showToast('Failed to delete on server; reloading', 'warning'); setTimeout(loadAll,700); }
        }

        /* -------------------------- SETTINGS -------------------------- */
        const SETTINGS_KEY = 'inventory_pro_settings_v1';
        function loadSettingsFromLocal() {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return;
            try {
                const s = JSON.parse(raw);
                document.getElementById('store-name').value = s.storeName || 'InventoryPro Store';
                document.getElementById('store-tagline').value = s.storeTagline || '';
                document.getElementById('store-logo').value = s.storeLogo || '';
                document.getElementById('tax-rate').value = s.taxRate || 10;
                document.getElementById('currency-symbol').value = s.currencySymbol || '$';
                document.getElementById('auto-round').checked = s.autoRound || false;
                document.getElementById('app-theme').value = s.appTheme || 'light';
                document.getElementById('primary-color').value = s.primaryColor || '#1e40af';
                document.getElementById('animate-cards').checked = s.animateCards !== false;
                document.getElementById('require-login').checked = s.requireLogin || false;
                applyAppearanceFromSettings();
            } catch (e) {}
        }
        function applyAppearanceFromSettings() {
            const dark = document.getElementById('app-theme').value === 'dark' || (document.getElementById('app-theme').value === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.body.classList.toggle('dark-mode', dark);
            document.documentElement.style.setProperty('--primary', document.getElementById('primary-color').value);
        }
        function saveSettings() {
            const s = {
                storeName: document.getElementById('store-name').value,
                storeTagline: document.getElementById('store-tagline').value,
                storeLogo: document.getElementById('store-logo').value,
                taxRate: parseFloat(document.getElementById('tax-rate').value) || 10,
                currencySymbol: document.getElementById('currency-symbol').value,
                autoRound: document.getElementById('auto-round').checked,
                appTheme: document.getElementById('app-theme').value,
                primaryColor: document.getElementById('primary-color').value,
                animateCards: document.getElementById('animate-cards').checked,
                requireLogin: document.getElementById('require-login').checked
            };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
            applyAppearanceFromSettings();
            showToast('Settings saved', 'success');
        }
        function resetSettings() {
            if (!confirm('Reset settings to defaults?')) return;
            localStorage.removeItem(SETTINGS_KEY);
            loadSettingsFromLocal();
            showToast('Settings reset', 'info');
        }
        document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
        document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
        document.getElementById('profile-pic-input').addEventListener('change', e => {
            const f = e.target.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => { document.getElementById('profile-pic-preview').src = ev.target.result; showToast('Profile picture updated', 'success'); };
            reader.readAsDataURL(f);
        });

        /* -------------------------- CATEGORY SAVE BUTTON -------------------------- */
        document.getElementById('saveCategoryBtn').addEventListener('click', () => {
            const btn = document.getElementById('saveCategoryBtn');
            btn.disabled = true;
            saveCategory().finally(() => btn.disabled = false);
        });

        /* -------------------------- NEW PRODUCT BUTTON -------------------------- */
        document.getElementById('btn-new-product').addEventListener('click', () => {
            document.getElementById('modal-product-title').innerText = 'New Product';
            document.getElementById('product-id').value = '';
            document.getElementById('product-code').value = '';
            document.getElementById('product-name').value = '';
            populateCategorySelect(); document.getElementById('product-category').value = '';
            document.getElementById('product-price').value = '';
            document.getElementById('product-cost').value = '';
            document.getElementById('product-stock').value = '';
            document.getElementById('product-desc').value = '';
            document.getElementById('product-image').value = '';
            new bootstrap.Modal('#productModal').show();
        });

        /* -------------------------- EXPORT / PRINT -------------------------- */
        function exportSales(type) {
            if (type === 'pdf') {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                doc.autoTable({ head: [['ID','Order ID','Date','Customer','Total','Status']], body: sales.map(s => [s.id,s.order_id,new Date(s.date).toLocaleString(),s.customer,s.total,s.status]) });
                doc.save('sales.pdf');
            } else {
                const ws = XLSX.utils.json_to_sheet(sales);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Sales');
                XLSX.writeFile(wb, 'sales.xlsx');
            }
        }
        function printDashboard() { window.print(); }

        /* -------------------------- START -------------------------- */
        loadAll();

                /* -------------------------- LOGOUT -------------------------- */
        function logout() {
            if (!confirm('Are you sure you want to log out?')) return;
            // Clear any local data you store for the session
            localStorage.removeItem(SETTINGS_KEY);
            // Optionally clear other keys if you have them
            // localStorage.removeItem('authToken');

            // Show a toast
            showToast('Logged out successfully', 'info');

            // Redirect to your login page (change the URL if needed)
            setTimeout(() => {
                window.location.href = 'http://127.0.0.1:5501/index.html';   // <-- put your login page here
            }, 800);
        }
        // Bind the logout button in the Settings page
        document.getElementById('logout-btn-settings').addEventListener('click', logout);