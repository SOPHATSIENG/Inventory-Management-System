const API_BASE = 'http://localhost:5000/api';
let products = [], categories = [], orders = [], customers = [], cart = [], charts = {};

let modalCustomer; // Will initialize in $(document).ready

// Utils
function showToast(msg, type = 'success') {
    const toastEl = document.getElementById('app-toast');
    toastEl.querySelector('.toast-body').textContent = msg;
    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    new bootstrap.Toast(toastEl).show();
}

function formatCurrency(amount) { return `$${parseFloat(amount || 0).toFixed(2)}`; }
function getStatusBadge(status) {
    const map = { 'Completed': 'status-completed', 'Pending': 'status-pending', 'Cancelled': 'status-cancelled', 'Active': 'status-completed' };
    return `<span class="badge-status ${map[status] || 'status-pending'}">${status}</span>`;
}

// API
async function apiCall(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || `HTTP ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.error(e);
        showToast(e.message, 'danger');
        return null;
    }
}

// Load All
async function loadAll() {
    const [prods, cats, ords, custs] = await Promise.all([
        apiCall('/products') || [],
        apiCall('/categories') || [],
        apiCall('/orders') || [],
        apiCall('/customers') || []
    ]);
    products = prods; categories = cats; orders = ords; customers = custs;
    await loadDashboard();
    populateCategorySelect(); // Always refresh select
}

async function loadDashboard() {
    const data = await apiCall('/dashboard');
    if (!data) return;
    $('#total-products').text(data.totalProducts || 0);
    $('#total-stock-value').text(formatCurrency(data.totalStockValue));
    $('#today-sales').text(formatCurrency(data.todaySales));
    $('#low-stock-count').text(data.lowStockCount || 0);
}

function populateCategorySelect() {
    const sel = $('#product-category');
    sel.empty().append('<option value="">Select Category</option>');
    categories.forEach(c => sel.append(`<option value="${c.name}">${c.name}</option>`));
}

// Dashboard
function renderDashboard() {
    renderRecentOrders();
    renderDashboardCharts();
}

function renderRecentOrders() {
    const tbody = $('#recent-orders');
    tbody.empty();
    orders.slice(-5).reverse().forEach(o => {
        tbody.append(`
            <tr>
                <td>${o.order_id || o.id}</td>
                <td>${o.date ? new Date(o.date).toLocaleDateString() : 'N/A'}</td>
                <td>${o.customer || 'Walk-in'}</td>
                <td>${formatCurrency(o.total)}</td>
                <td>${getStatusBadge(o.status)}</td>
                <td><button class="btn btn-sm btn-outline-primary view-order" data-id="${o.id}"><i class="fa fa-eye"></i></button></td>
            </tr>`
        );
    });
}

function renderDashboardCharts() {
    if (charts.weekly) charts.weekly.destroy();
    charts.weekly = new Chart($('#weeklySalesChart')[0].getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{ label: 'Sales', data: [450, 620, 380, 750, 900, 520, 680], borderColor: '#1e40af', fill: true }]
        },
        options: { plugins: { legend: { display: false } } }
    });

    if (charts.topProducts) charts.topProducts.destroy();
    charts.topProducts = new Chart($('#topProductsChart')[0].getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: products.slice(0, 5).map(p => p.name),
            datasets: [{ data: products.slice(0, 5).map(p => p.stock * p.price), backgroundColor: ['#1e40af', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'] }]
        },
        options: { plugins: { legend: { position: 'right' } } }
    });

    // Dynamic New Customers Chart (last 6 months)
    const months = [];
    const counts = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toLocaleString('default', { month: 'short' }));
        counts.push(0);
    }
    customers.forEach(c => {
        if (c.join_date) {
            const join = new Date(c.join_date);
            const diff = (now.getFullYear() * 12 + now.getMonth()) - (join.getFullYear() * 12 + join.getMonth());
            if (diff >= 0 && diff <= 5) {
                counts[5 - diff] += 1;
            }
        }
    });

    if (charts.newCustomers) charts.newCustomers.destroy();
    charts.newCustomers = new Chart($('#newCustomersChart')[0].getContext('2d'), {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'New Customers',
                data: counts,
                backgroundColor: '#22c55e'
            }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

// Products
function renderProductsTable() {
    const tbody = $('#products-table tbody');
    tbody.empty();
    products.forEach(p => {
        tbody.append(`
            <tr>
                <td>${p.id}</td>
                <td><img src="${p.image}" width="50" class="rounded" onerror="this.src='https://via.placeholder.com/80'"></td>
                <td>${p.code}</td>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${formatCurrency(p.price)}</td>
                <td>${formatCurrency(p.cost)}</td>
                <td class="${p.stock < 5 ? 'low-stock' : ''}">${p.stock}</td>
                <td>${getStatusBadge(p.status)}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-product me-1" data-id="${p.id}"><i class="fa fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger delete-product" data-id="${p.id}"><i class="fa fa-trash"></i></button>
                </td>
            </tr>`
        );
    });
    if ($.fn.DataTable.isDataTable('#products-table')) $('#products-table').DataTable().destroy();
    $('#products-table').DataTable({ pageLength: 10, order: [[0, 'desc']] });
}

// Edit Product
$(document).on('click', '.edit-product', function () {
    const id = $(this).data('id');
    const p = products.find(x => x.id === id);
    if (!p) return;
    $('#modal-product-title').text('Edit Product');
    $('#product-id').val(p.id);
    $('#product-code').val(p.code);
    $('#product-name').val(p.name);
    $('#product-category').val(p.category);
    $('#product-price').val(p.price);
    $('#product-cost').val(p.cost);
    $('#product-stock').val(p.stock);
    $('#product-image').val(p.image);
    $('#product-desc').val(p.desc || '');
    populateCategorySelect();
    new bootstrap.Modal('#productModal').show();
});

$(document).on('click', '.delete-product', async function () {
    if (!confirm('Delete product?')) return;
    const id = $(this).data('id');
    await apiCall(`/products/${id}`, { method: 'DELETE' });
    showToast('Product deleted!');
    await loadAll();
    renderProductsTable();
});

// Categories
function renderCategories() {
    const tbody = $('#categories-table tbody');
    tbody.empty();
    categories.forEach(c => {
        const count = products.filter(p => p.category === c.name).length;
        tbody.append(`
            <tr>
                <td>${c.id}</td>
                <td>${c.name}</td>
                <td>${c.desc || ''}</td>
                <td>${count}</td>
                <td><button class="btn btn-sm btn-danger delete-category" data-id="${c.id}"><i class="fa fa-trash"></i></button></td>
            </tr>`
        );
    });
    renderCategoryChart();
}

function renderCategoryChart() {
    if (charts.categoryPie) charts.categoryPie.destroy();
    charts.categoryPie = new Chart($('#categoryPieChart')[0].getContext('2d'), {
        type: 'pie',
        data: {
            labels: categories.map(c => c.name),
            datasets: [{
                data: categories.map(c => products.filter(p => p.category === c.name).length || 1),
                backgroundColor: ['#1e40af', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']
            }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}

// Orders
function renderOrdersTable() {
    const tbody = $('#orders-table tbody');
    tbody.empty();
    orders.forEach(o => {
        tbody.append(`
            <tr>
                <td>${o.order_id || o.id}</td>
                <td>${o.date ? new Date(o.date).toLocaleDateString() : 'N/A'}</td>
                <td>${o.customer || 'Walk-in'}</td>
                <td>${o.items}</td>
                <td>${formatCurrency(o.total)}</td>
                <td>${o.payment}</td>
                <td>${getStatusBadge(o.status)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-order me-1" data-id="${o.id}"><i class="fa fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-order" data-id="${o.id}"><i class="fa fa-ban"></i></button>
                </td>
            </tr>`
        );
    });
    if ($.fn.DataTable.isDataTable('#orders-table')) $('#orders-table').DataTable().destroy();
    $('#orders-table').DataTable({ pageLength: 10 });

    $('#order-status-filter').off('change').on('change', function () {
        const val = this.value;
        $('#orders-table').DataTable().column(6).search(val === 'all' ? '' : val).draw();
    });
}

// Customers
function renderCustomersTable() {
    const tbody = $('#customers-table tbody');
    tbody.empty();

    // Compute stats per customer (matched by name)
    let customerOrders = {};
    orders.forEach(o => {
        if (o.customer && o.customer !== 'Walk-in') {
            if (!customerOrders[o.customer]) customerOrders[o.customer] = { count: 0, value: 0 };
            customerOrders[o.customer].count += 1;
            customerOrders[o.customer].value += o.total;
        }
    });

    customers.forEach(c => {
        const stats = customerOrders[c.name] || { count: 0, value: 0 };
        tbody.append(`
            <tr>
                <td>${c.id}</td>
                <td>${c.name}</td>
                <td>${c.phone || '-'}</td>
                <td>${c.email || '-'}</td>
                <td>${stats.count}</td>
                <td>${formatCurrency(stats.value)}</td>
                <td>${c.join_date ? new Date(c.join_date).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-customer me-1" data-id="${c.id}"><i class="fa fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger delete-customer" data-id="${c.id}"><i class="fa fa-trash"></i></button>
                </td>
            </tr>`
        );
    });
    if ($.fn.DataTable.isDataTable('#customers-table')) $('#customers-table').DataTable().destroy();
    $('#customers-table').DataTable({ pageLength: 10 });
}

// Reports - Dynamic from orders
function renderReports() {
    // Dynamic monthly sales
    const monthly = {};
    orders.forEach(o => {
        if (o.date) {
            const m = new Date(o.date).toLocaleString('default', { month: 'short' });
            monthly[m] = (monthly[m] || 0) + o.total;
        }
    });
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = labels.map(l => monthly[l] || 0);

    const avgOrder = orders.length ? (orders.reduce((s, o) => s + o.total, 0) / orders.length).toFixed(2) : 0;

    $('#avg-order-value').text(formatCurrency(avgOrder));
    $('#conversion-rate').text('3.2%'); // static
    $('#return-rate').text('1.1%'); // static

    if (charts.monthlySales) charts.monthlySales.destroy();
    charts.monthlySales = new Chart($('#monthlySalesChart')[0].getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Sales', data, backgroundColor: 'rgba(30,64,175,0.7)' }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// POS
function renderPOSProducts() {
    const container = $('#pos-products');
    container.empty();
    products.filter(p => p.stock > 0).forEach(p => {
        container.append(`
            <div class="col-md-4 mb-3">
                <div class="card h-100 text-center p-3 position-relative" style="cursor:pointer" onclick="addToCart(${p.id})">
                    <img src="${p.image}" height="80" class="rounded mx-auto d-block mb-2" onerror="this.src='https://via.placeholder.com/80'">
                    <h6>${p.name}</h6>
                    <p class="small text-muted">${p.category}</p>
                    <strong>${formatCurrency(p.price)}</strong>
                    <span class="badge bg-info position-absolute top-0 end-0 m-2">Stock: ${p.stock}</span>
                </div>
            </div>`
        );
    });

    $('#pos-search').off('input').on('input', function () {
        const term = this.value.toLowerCase();
        $('#pos-products .col-md-4').each(function () {
            const text = $(this).text().toLowerCase();
            $(this).toggle(text.includes(term));
        });
    });
}

// Cart
window.addToCart = async (id) => {
    const p = products.find(x => x.id === id);
    if (!p || p.stock <= 0) return showToast('Out of stock!', 'danger');

    let item = cart.find(i => i.id === id);
    if (item) {
        item.qty += 1;
    } else {
        item = { ...p, qty: 1 };
        cart.push(item);
    }

    await apiCall(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ stock: p.stock - 1 }) });
    await loadAll();
    renderPOSProducts();
    updateCart();
    showToast(`${p.name} added to cart!`);
};

function updateCart() {
    const tbody = $('#cart-table tbody');
    tbody.empty();
    let subtotal = 0;
    cart.forEach((item, i) => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;
        tbody.append(`
            <tr>
                <td>${item.name}</td>
                <td><input type="number" class="form-control form-control-sm w-50 cart-qty" data-idx="${i}" value="${item.qty}" min="1" max="${item.stock + item.qty}"></td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(lineTotal)}</td>
                <td><button class="btn btn-sm btn-danger remove-from-cart" data-idx="${i}">X</button></td>
            </tr>`
        );
    });

    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    $('#cart-subtotal').text(formatCurrency(subtotal));
    $('#cart-tax').text(formatCurrency(tax));
    $('#cart-total').text(formatCurrency(total));

    const paid = parseFloat($('#amount-paid').val()) || 0;
    $('#cart-change').text(formatCurrency(Math.max(0, paid - total)));
}

$(document).on('click', '.remove-from-cart', async function () {
    const idx = parseInt($(this).data('idx'));
    const item = cart[idx];
    // Restore full qty stock
    await apiCall(`/products/${item.id}`, { method: 'PUT', body: JSON.stringify({ stock: item.stock + item.qty }) });
    cart.splice(idx, 1);
    updateCart();
    await loadAll();
    renderPOSProducts();
    showToast('Item removed from cart');
});

$(document).on('change', '.cart-qty', async function () {
    const idx = parseInt($(this).data('idx'));
    const newQty = parseInt(this.value);
    const item = cart[idx];
    if (newQty < 1) { this.value = item.qty; return; }
    const delta = newQty - item.qty;
    if (delta > item.stock) {
        showToast('Not enough stock!', 'danger');
        this.value = item.qty;
        return;
    }
    await apiCall(`/products/${item.id}`, { method: 'PUT', body: JSON.stringify({ stock: item.stock - delta }) });
    item.qty = newQty;
    updateCart();
    await loadAll();
    renderPOSProducts();
});

$('#amount-paid').on('input', updateCart);

$('#clear-cart').on('click', async () => {
    if (cart.length === 0 || !confirm('Clear cart?')) return;
    for (const item of cart) {
        await apiCall(`/products/${item.id}`, { method: 'PUT', body: JSON.stringify({ stock: item.stock + item.qty }) });
    }
    cart = [];
    $('#amount-paid').val('');
    updateCart();
    await loadAll();
    renderPOSProducts();
    showToast('Cart cleared!');
});

$('#checkout-btn').on('click', async () => {
    if (cart.length === 0) return showToast('Cart is empty!', 'warning');
    const total = parseFloat($('#cart-total').text().replace('$', ''));
    const paid = parseFloat($('#amount-paid').val()) || 0;
    if (paid < total) return showToast('Payment insufficient!', 'danger');

    const orderData = {
        order_id: 'ORD' + Date.now(),
        customer: 'Walk-in',
        items: cart.reduce((s, i) => s + i.qty, 0),
        total: total,
        payment: $('#payment-method').val(),
        status: 'Completed'
    };

    const res = await apiCall('/orders', { method: 'POST', body: JSON.stringify(orderData) });
    if (res) {
        cart = [];
        $('#amount-paid').val('');
        updateCart();
        await loadAll();
        renderOrdersTable();
        renderRecentOrders();
        showToast(`Checkout complete! Change: ${formatCurrency(paid - total)}`);
    }
});

// Events
$(document).ready(async () => {
    modalCustomer = new bootstrap.Modal('#customerModal');
    await loadAll();

    // Navigation
    $('#sidebar .list-group-item').on('click', async function () {
        $('.page').addClass('hidden');
        const pageId = $(this).data('page');
        $(`#${pageId}`).removeClass('hidden');
        $('#sidebar .list-group-item').removeClass('active');
        $(this).addClass('active');

        if (pageId === 'dashboard') { renderDashboard(); renderDashboardCharts(); }
        if (pageId === 'products') { renderProductsTable(); }
        if (pageId === 'pos') { renderPOSProducts(); updateCart(); }
        if (pageId === 'categories') { renderCategories(); }
        if (pageId === 'orders') { renderOrdersTable(); }
        if (pageId === 'customers') { renderCustomersTable(); }
        if (pageId === 'reports') { renderReports(); }
    });

    // Product Modal
    $('#btn-new-product').on('click', () => {
        $('#modal-product-title').text('New Product');
        $('#product-form')[0].reset();
        $('#product-id').val('');
        populateCategorySelect();
        new bootstrap.Modal('#productModal').show();
    });

    $('#save-product').on('click', async () => {
        const id = $('#product-id').val();
        let code = $('#product-code').val().trim();
        if (!id && !code) code = 'P' + Date.now().toString().slice(-6);

        const data = {
            code,
            name: $('#product-name').val().trim(),
            category: $('#product-category').val() || 'Uncategorized',
            price: parseFloat($('#product-price').val()) || 0,
            cost: parseFloat($('#product-cost').val()) || 0,
            stock: parseInt($('#product-stock').val()) || 0,
            image: $('#product-image').val() || 'https://via.placeholder.com/80?text=Product',
            desc: $('#product-desc').val(),
            status: 'Active'
        };

        if (!data.name) return showToast('Name required!', 'danger');

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/products/${id}` : '/products';

        const res = await apiCall(url, { method, body: JSON.stringify(data) });
        if (res) {
            showToast(id ? 'Product updated!' : 'Product added!');
            bootstrap.Modal.getInstance('#productModal').hide();
            await loadAll();
            renderProductsTable();
            renderPOSProducts();
        }
    });

    // Category Add
    $('#btn-new-category').on('click', async () => {
        const name = prompt('Category Name:');
        const desc = prompt('Description (optional):') || '';
        if (!name) return;
        await apiCall('/categories', { method: 'POST', body: JSON.stringify({ name, desc }) });
        showToast('Category added!');
        await loadAll();
        renderCategories();
    });

    // Category Delete
    $(document).on('click', '.delete-category', async function () {
        if (!confirm('Delete category? Products will become Uncategorized.')) return;
        const id = $(this).data('id');
        await apiCall(`/categories/${id}`, { method: 'DELETE' });
        showToast('Category deleted!');
        await loadAll();
        renderCategories();
        renderProductsTable();
    });

    // Order View
    $(document).on('click', '.view-order', function () {
        const id = $(this).data('id');
        const o = orders.find(x => x.id === id);
        if (!o) return showToast('Order not found', 'danger');
        const details = `
Order ID: ${o.order_id || o.id}
Date: ${o.date ? new Date(o.date).toLocaleString() : 'N/A'}
Customer: ${o.customer || 'Walk-in'}
Items: ${o.items}
Total: ${formatCurrency(o.total)}
Payment: ${o.payment}
Status: ${o.status}
        `.trim();
        alert(details);
    });

    // Order Delete
    $(document).on('click', '.delete-order', async function () {
        if (!confirm('Delete this order permanently?')) return;
        const id = $(this).data('id');
        await apiCall(`/orders/${id}`, { method: 'DELETE' });
        showToast('Order deleted!');
        await loadAll();
        renderOrdersTable();
        renderRecentOrders();
    });

    // Customer Add/Edit/Delete
    $('#btn-new-customer').on('click', () => {
        $('#modal-customer-title').text('New Customer');
        $('#customer-form')[0].reset();
        $('#customer-id').val('');
        modalCustomer.show();
    });

    $('#save-customer').on('click', async () => {
        const id = $('#customer-id').val();
        const data = {
            name: $('#customer-name').val().trim(),
            phone: $('#customer-phone').val().trim() || null,
            email: $('#customer-email').val().trim() || null
        };
        if (!data.name) return showToast('Name required', 'danger');

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/customers/${id}` : '/customers';

        const res = await apiCall(url, { method, body: JSON.stringify(data) });
        if (res) {
            showToast(id ? 'Customer updated!' : 'Customer added!');
            modalCustomer.hide();
            await loadAll();
            renderCustomersTable();
            renderDashboardCharts(); // Update chart after add/edit
        }
    });

    $(document).on('click', '.edit-customer', function () {
        const id = $(this).data('id');
        const c = customers.find(x => x.id === id);
        if (!c) return;
        $('#modal-customer-title').text('Edit Customer');
        $('#customer-id').val(c.id);
        $('#customer-name').val(c.name);
        $('#customer-phone').val(c.phone);
        $('#customer-email').val(c.email);
        modalCustomer.show();
    });

    $(document).on('click', '.delete-customer', async function () {
        if (!confirm('Delete customer?')) return;
        const id = $(this).data('id');
        await apiCall(`/customers/${id}`, { method: 'DELETE' });
        showToast('Customer deleted!');
        await loadAll();
        renderCustomersTable();
        renderDashboardCharts(); // Update chart after delete
    });

    $('#toggle-sidebar').on('click', () => $('#sidebar').toggleClass('d-block'));

    $('#login-form').on('submit', e => {
        e.preventDefault();
        showToast('Login successful (demo)');
        setTimeout(() => $('[data-page="dashboard"]').click(), 1000);
    });

    // Initial
    $('[data-page="dashboard"]').click();
});

/* ==============================================================
   BEST-IN-CLASS SETTINGS – MY IDEA (Enhanced with Exports)
   ============================================================== */
let settings = {
    store: {}, theme: 'light', primaryColor: '#0d6efd',
    taxRate: 10, currency: '$', autoRound: false,
    animateCards: true, requireLogin: false
};

// Load everything when Settings opens
$('#sidebar .list-group-item[data-page="settings"]').on('click', () => {
    loadAllSettings();
    applyTheme();   // immediate visual feedback
});

function loadAllSettings() {
    const s = JSON.parse(localStorage.getItem('inventoryProSettings')) || {};

    // Profile
    const user = currentUser || { username: 'Employee', email: 'Employee@inventorypro.com' };
    $('#profile-username').text(user.username);
    $('#profile-email').text(user.email);
    const pic = localStorage.getItem('profilePic');
    if (pic) $('#profile-pic-preview').attr('src', pic);

    // Store
    $('#store-name').val(s.store?.name || 'InventoryPro Store');
    $('#store-tagline').val(s.store?.tagline || '');
    $('#store-logo').val(s.store?.logo || '');

    // Sales & Tax
    $('#tax-rate').val(s.taxRate ?? 10);
    $('#currency-symbol').val(s.currency ?? '$');
    $('#auto-round').prop('checked', s.autoRound ?? false);

    // Appearance
    $('#app-theme').val(s.theme ?? 'light');
    $('#primary-color').val(s.primaryColor ?? '#0d6efd');
    $('#animate-cards').prop('checked', s.animateCards ?? true);

    // Backup & Security
    $('#require-login').prop('checked', s.requireLogin ?? false);
    $('#last-backup').text(s.lastBackup || 'Never');
    $('#session-id').text(s.sessionId || 'demo-session');
}

/* ---------- Profile Picture ---------- */
$('#profile-pic-input').on('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const data = ev.target.result;
        $('#profile-pic-preview').attr('src', data);
        localStorage.setItem('profilePic', data);
        showToast('Profile picture updated', 'success');
    };
    reader.readAsDataURL(file);
});

/* ---------- Logout (Settings) ---------- */
$('#logout-btn-settings').on('click', () => {
    if (confirm('Logout now?')) {
        // Clear user data
        localStorage.removeItem('profilePic');
        localStorage.removeItem('inventoryProSettings');
        // Optional: clear currentUser if used elsewhere
        currentUser = null;
        showToast('Logged out', 'info');
        window.location.href = 'http://127.0.0.1:5501/index.html'; // add new - redirects to login page
    }
});

/* ---------- Store Identity ---------- */
function saveStore() {
    settings.store = {
        name: $('#store-name').val().trim(),
        tagline: $('#store-tagline').val().trim(),
        logo: $('#store-logo').val().trim()
    };
}

/* ---------- Sales & Tax ---------- */
$('#tax-rate, #currency-symbol, #auto-round').on('change', function () {
    settings.taxRate = parseFloat($('#tax-rate').val()) || 0;
    settings.currency = $('#currency-symbol').val();
    settings.autoRound = $('#auto-round').is(':checked');
});

/* ---------- Appearance ---------- */
$('#app-theme').on('change', function () {
    settings.theme = $(this).val();
    applyTheme();
});
$('#primary-color').on('change', function () {
    settings.primaryColor = $(this).val();
    applyPrimaryColor();
});
$('#animate-cards').on('change', function () {
    settings.animateCards = $(this).is(':checked');
    document.body.classList.toggle('no-card-anim', !settings.animateCards);
});

/* ---------- Enhanced Export Functions ---------- */

/* ---------- Enhanced Export Functions ---------- */

// Helper: Get customer order stats
function getCustomerStats() {
    const stats = {};
    orders.forEach(o => {
        if (o.customer && o.customer !== 'Walk-in') {
            if (!stats[o.customer]) stats[o.customer] = { count: 0, total: 0 };
            stats[o.customer].count += 1;
            stats[o.customer].total += o.total;
        }
    });
    return stats;
}

// EXPORT TO EXCEL (.xlsx) - Using SheetJS (xlsx) - FULLY WORKING
function exportToExcel() {
    try {
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `InventoryPro-Export-${timestamp}.xlsx`;

        // Create workbook
        const wb = XLSX.utils.book_new();

        // === Sheet 1: Products ===
        const productsWS = XLSX.utils.json_to_sheet(products.map(p => ({
            ID: p.id,
            Code: p.code,
            Name: p.name,
            Category: p.category,
            Price: p.price,
            Cost: p.cost,
            Stock: p.stock,
            Status: p.status,
            Description: p.desc || ''
        })));
        XLSX.utils.book_append_sheet(wb, productsWS, "Products");

        // === Sheet 2: Categories ===
        const catData = categories.map(c => {
            const count = products.filter(p => p.category === c.name).length;
            return { ID: c.id, Name: c.name, Description: c.desc || '', Products: count };
        });
        const catWS = XLSX.utils.json_to_sheet(catData);
        XLSX.utils.book_append_sheet(wb, catWS, "Categories");

        // === Sheet 3: Orders ===
        const ordersWS = XLSX.utils.json_to_sheet(orders.map(o => ({
            ID: o.id,
            'Order ID': o.order_id || '',
            Date: o.date ? new Date(o.date).toLocaleDateString() : '',
            Customer: o.customer || 'Walk-in',
            Items: o.items,
            Total: o.total,
            Payment: o.payment,
            Status: o.status
        })));
        XLSX.utils.book_append_sheet(wb, ordersWS, "Orders");

        // === Sheet 4: Customers ===
        const custStats = getCustomerStats();
        const custData = customers.map(c => {
            const s = custStats[c.name] || { count: 0, total: 0 };
            return {
                ID: c.id,
                Name: c.name,
                Phone: c.phone || '',
                Email: c.email || '',
                'Order Count': s.count,
                'Total Spent': s.total,
                'Join Date': c.join_date ? new Date(c.join_date).toLocaleDateString() : ''
            };
        });
        const custWS = XLSX.utils.json_to_sheet(custData);
        XLSX.utils.book_append_sheet(wb, custWS, "Customers");

        // Export file
        XLSX.writeFile(wb, filename);
        showToast(`Excel exported: ${filename}`, 'success');

        // Update backup time
        settings.lastBackup = new Date().toLocaleString();
        $('#last-backup').text(settings.lastBackup);
        saveSettings();
    } catch (err) {
        console.error(err);
        showToast('Excel export failed!', 'danger');
    }
}

// EXPORT TO PDF - Using jsPDF + autoTable
function exportToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `InventoryPro-Export-${timestamp}.pdf`;

        let y = 20;
        const addTitle = (text) => {
            doc.setFontSize(14);
            doc.text(text, 14, y);
            y += 10;
        };

        const addTable = (head, body, startY) => {
            doc.autoTable({
                head: [head],
                body: body,
                startY: startY,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [30, 64, 175] },
                margin: { left: 14, right: 14 }
            });
            return doc.lastAutoTable.finalY + 10;
        };

        // Title
        doc.setFontSize(18);
        doc.text('InventoryPro Full Export', 14, y);
        y += 7;
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
        y += 15;

        // Products
        addTitle('Products');
        const prodBody = products.map(p => [
            p.id, p.code, p.name, p.category, `$${p.price}`, p.stock, p.status
        ]);
        y = addTable(['ID', 'Code', 'Name', 'Category', 'Price', 'Stock', 'Status'], prodBody, y);

        if (y > 270) { doc.addPage(); y = 20; }

        // Categories
        addTitle('Categories');
        const catBody = categories.map(c => {
            const count = products.filter(p => p.category === c.name).length;
            return [c.id, c.name, c.desc || '', count];
        });
        y = addTable(['ID', 'Name', 'Description', 'Products'], catBody, y);

        if (y > 270) { doc.addPage(); y = 20; }

        // Orders
        addTitle('Orders');
        const orderBody = orders.map(o => [
            o.id,
            o.order_id || '',
            o.date ? new Date(o.date).toLocaleString().split(',')[0] : '',
            o.customer || 'Walk-in',
            o.items,
            `$${o.total}`,
            o.status
        ]);
        y = addTable(['ID', 'Order ID', 'Date', 'Customer', 'Items', 'Total', 'Status'], orderBody, y);

        if (y > 270) { doc.addPage(); y = 20; }

        // Customers
        addTitle('Customers');
        const custStats = getCustomerStats();
        const custBody = customers.map(c => {
            const s = custStats[c.name] || { count: 0, total: 0 };
            return [c.id, c.name, c.phone || '', c.email || '', s.count, `$${s.total}`, c.join_date ? new Date(c.join_date).toLocaleDateString() : ''];
        });
        addTable(['ID', 'Name', 'Phone', 'Email', 'Orders', 'Total Spent', 'Join Date'], custBody, y);

        // Save
        doc.save(filename);
        showToast(`PDF exported: ${filename}`, 'success');

        settings.lastBackup = new Date().toLocaleString();
        $('#last-backup').text(settings.lastBackup);
        saveSettings();
    } catch (err) {
        console.error(err);
        showToast('PDF export failed!', 'danger');
    }
}

// EXPORT TO JSON (Enhanced)
$('#btn-export-json').on('click', () => {
    const timestamp = new Date().toISOString();
    const data = {
        exportDate: new Date().toLocaleString(),
        timestamp,
        products,
        categories,
        orders,
        customers,
        settings: JSON.parse(localStorage.getItem('inventoryProSettings') || '{}')
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InventoryPro-Backup-${timestamp.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    settings.lastBackup = new Date().toLocaleString();
    $('#last-backup').text(settings.lastBackup);
    saveSettings();
    showToast('JSON backup exported!', 'success');
});

// Button Listeners
$('#btn-export-excel').on('click', exportToExcel);
$('#btn-export-pdf').on('click', exportToPDF);

/* ---------- Backup ---------- */
$('#btn-import-backup').on('click', () => $('#import-backup').click());
$('#import-backup').on('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const imported = JSON.parse(ev.target.result);
            // Simple restore – you can expand to API PUTs later
            localStorage.setItem('inventoryProSettings', JSON.stringify(imported.settings || {}));
            showToast('Backup imported – reload page', 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            showToast('Invalid backup file', 'danger');
        }
    };
    reader.readAsText(file);
});

// /* ---------- Require Login ---------- */
// $('#require-login').on('change', function () {
//     settings.requireLogin = $(this).is(':checked');
// });

/* ---------- Apply All Button ---------- */
$('#apply-all-settings').on('click', () => {
    saveStore();
    saveSettings();
    applyTheme();
    applyPrimaryColor();
    showToast('All settings applied!', 'success');
});

function saveSettings() {
    localStorage.setItem('inventoryProSettings', JSON.stringify(settings));
}

/* ---------- Theme Engine ---------- */
function applyTheme() {
    const theme = settings.theme;
    if (theme === 'dark') {
        $('body').addClass('dark-mode');
    } else if (theme === 'light') {
        $('body').removeClass('dark-mode');
    } else { // auto
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        $('body').toggleClass('dark-mode', prefersDark);
    }
}
function applyPrimaryColor() {
    document.documentElement.style.setProperty('--bs-primary', settings.primaryColor);
    document.documentElement.style.setProperty('--bs-primary-rgb', hexToRgb(settings.primaryColor));
}
function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '13,110,253';
}

/* ---------- Init on page load ---------- */
$(document).ready(() => {
    // Load saved settings (if any)
    const saved = JSON.parse(localStorage.getItem('inventoryProSettings') || '{}');
    Object.assign(settings, saved);
    applyTheme();
    applyPrimaryColor();
    document.body.classList.toggle('no-card-anim', !settings.animateCards);

    // Demo mode – hide login
    $('#login').addClass('hidden');
    $('#logout-btn, #logout-btn-settings').show();
    currentUser = { username: 'Employee', email: 'Employee@inventorypro.com' };
});