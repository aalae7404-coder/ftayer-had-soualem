// ====== حماية لوحة الأدمن ======
let currentAdmin = null;

async function checkAdmin() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.user || data.user.role !== 'admin') {
      showToast('❌ غير مصرح', 'error');
      setTimeout(() => location.href = '/login.html', 800);
      return false;
    }
    currentAdmin = data.user;
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = '🛡️ ' + currentAdmin.name;
    return true;
  } catch (e) {
    location.href = '/login.html';
    return false;
  }
}

// ====== التبويبات ======
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById('tab-' + tab.dataset.tab);
    if (target) target.style.display = 'block';

    if (tab.dataset.tab === 'dashboard') loadStats();
    if (tab.dataset.tab === 'products') loadAdminProducts();
    if (tab.dataset.tab === 'orders') loadOrders();
    if (tab.dataset.tab === 'customers') loadCustomers();
  });
});

// ====== الإحصائيات ======
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('statOrders').textContent = data.orders || 0;
    document.getElementById('statSales').textContent = (data.sales || 0).toFixed(0);
    document.getElementById('statCustomers').textContent = data.customers || 0;
    document.getElementById('statProducts').textContent = data.products || 0;
  } catch (e) { console.error(e); }
}

// ====== المنتجات ======
let adminProducts = [];

async function loadAdminProducts() {
  const res = await fetch('/api/products');
  adminProducts = await res.json();
  const tbody = document.getElementById('productsTable');
  if (!tbody) return;

  if (adminProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem">ما كاينش منتجات</td></tr>';
    return;
  }

  tbody.innerHTML = adminProducts.map(p => `
    <tr>
      <td>${p.image ? `<img src="${p.image}" style="width:50px;height:50px;object-fit:cover;border-radius:8px">` : '🥞'}</td>
      <td>${p.name}</td>
      <td>${p.price} د.م${p.old_price ? ` <small style="color:var(--muted);text-decoration:line-through">${p.old_price}</small>` : ''}</td>
      <td>${p.category || '-'}</td>
      <td>${p.available ? '✅' : '❌'}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editProduct(${p.id})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openProductModal() {
  document.getElementById('modalTitle').textContent = '➕ إضافة منتج';
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
}

function editProduct(id) {
  const p = adminProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modalTitle').textContent = '✏️ تعديل منتج';
  document.getElementById('productId').value = p.id;
  document.getElementById('productName').value = p.name;
  document.getElementById('productDesc').value = p.description || '';
  document.getElementById('productPrice').value = p.price;
  document.getElementById('productOldPrice').value = p.old_price || '';
  document.getElementById('productCategory').value = p.category || 'متنوعة';
  document.getElementById('productAvailable').checked = p.available == 1;
  document.getElementById('productFeatured').checked = p.featured == 1;
  document.getElementById('productModal').classList.add('open');
}

async function deleteProduct(id) {
  if (!confirm('واش متأكد من الحذف؟')) return;
  const res = await fetch('/api/products/' + id, { method: 'DELETE' });
  if (res.ok) {
    showToast('✅ تم الحذف', 'success');
    loadAdminProducts();
  }
}

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('productId').value;
  const formData = new FormData();
  formData.append('name', document.getElementById('productName').value);
  formData.append('description', document.getElementById('productDesc').value);
  formData.append('price', document.getElementById('productPrice').value);
  formData.append('old_price', document.getElementById('productOldPrice').value);
  formData.append('category', document.getElementById('productCategory').value);
  formData.append('available', document.getElementById('productAvailable').checked ? 'true' : 'false');
  formData.append('featured', document.getElementById('productFeatured').checked ? 'true' : 'false');

  const imgInput = document.getElementById('productImage');
  if (imgInput.files[0]) formData.append('image', imgInput.files[0]);

  const url = id ? '/api/products/' + id : '/api/products';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, { method, body: formData });
  if (res.ok) {
    showToast('✅ تم الحفظ', 'success');
    closeProductModal();
    loadAdminProducts();
  } else {
    showToast('❌ خطأ فـ الحفظ', 'error');
  }
});

// ====== الطلبات ======
async function loadOrders() {
  const res = await fetch('/api/orders');
  const orders = await res.json();
  const tbody = document.getElementById('ordersTable');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem">ما كاينش طلبات</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>#${o.id}</td>
      <td>${o.customer_name}<br><small>${o.phone}</small></td>
      <td>${(o.items || []).map(i => `${i.product_name} ×${i.quantity}`).join('<br>')}</td>
      <td>${o.total} د.م</td>
      <td>
        <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding:0.3rem;border-radius:8px;border:1px solid var(--border)">
          <option ${o.status === 'جديد' ? 'selected' : ''}>جديد</option>
          <option ${o.status === 'قيد التحضير' ? 'selected' : ''}>قيد التحضير</option>
          <option ${o.status === 'جاهز للاستلام' ? 'selected' : ''}>جاهز للاستلام</option>
          <option ${o.status === 'تم الاستلام' ? 'selected' : ''}>تم الاستلام</option>
          <option ${o.status === 'ملغى' ? 'selected' : ''}>ملغى</option>
        </select>
      </td>
      <td>${new Date(o.created_at).toLocaleDateString('ar-MA')}</td>
    </tr>
  `).join('');
}

async function updateOrderStatus(id, status) {
  const res = await fetch('/api/orders/' + id + '/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (res.ok) showToast('✅ تم تحديث الحالة', 'success');
}

// ====== الزبائن ======
async function loadCustomers() {
  const res = await fetch('/api/customers');
  const customers = await res.json();
  const tbody = document.getElementById('customersTable');
  if (!tbody) return;

  if (customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem">ما كاينش زبائن</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map(c => `
    <tr>
      <td>#${c.id}</td>
      <td>${c.name}</td>
      <td>${c.email}</td>
      <td>${new Date(c.created_at).toLocaleDateString('ar-MA')}</td>
    </tr>
  `).join('');
}

// ====== بدء ======
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAdmin();
  if (ok) loadStats();
});