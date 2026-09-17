// ====== السلة ======
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart') || '[]');
  } catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const cart = getCart();
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const badges = document.querySelectorAll('#cartBadge, .badge');
  badges.forEach(b => b.textContent = count);
}

function addToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  if (!product.available) return showToast('❌ المنتج غير متوفر', 'error');

  const cart = getCart();
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1
    });
  }
  saveCart(cart);
  showToast('✅ تمت الإضافة للسلة', 'success');
}

function removeFromCart(id) {
  let cart = getCart();
  cart = cart.filter(i => i.id !== id);
  saveCart(cart);
  renderCart();
}

function changeQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    return removeFromCart(id);
  }
  saveCart(cart);
  renderCart();
}

function cartTotal() {
  const cart = getCart();
  return cart.reduce((s, i) => s + i.price * i.quantity, 0);
}

// ====== عرض السلة ======
function renderCart() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  const cart = getCart();
  const summary = document.getElementById('cartSummary');
  const empty = document.getElementById('emptyCart');

  if (cart.length === 0) {
    container.innerHTML = '';
    if (summary) summary.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (summary) summary.style.display = 'block';
  if (empty) empty.style.display = 'none';

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      ${item.image
        ? `<img src="${item.image}" alt="${item.name}">`
        : `<div style="width:80px;height:80px;background:#f5e6d3;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:2rem">🥞</div>`}
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <p style="color:var(--primary);font-weight:700">${item.price} د.م</p>
      </div>
      <div class="qty-controls">
        <button onclick="changeQty(${item.id}, -1)">−</button>
        <span style="font-weight:700;min-width:30px;text-align:center">${item.quantity}</span>
        <button onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeFromCart(${item.id})">🗑️</button>
    </div>
  `).join('');

  const totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.textContent = cartTotal().toFixed(2) + ' درهم';
}

// ====== إرسال الطلب ======
async function submitOrder(e) {
  e.preventDefault();
  const cart = getCart();
  if (cart.length === 0) return showToast('❌ السلة فارغة', 'error');

  const customer_name = document.getElementById('orderName').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const pickup_time = document.getElementById('orderPickup').value.trim();

  if (!customer_name || !phone) {
    return showToast('❌ املأ الاسم والهاتف', 'error');
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name,
        phone,
        pickup_time,
        items: cart,
        total: cartTotal()
      })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.removeItem('cart');
      updateCartBadge();
      showToast('🎉 تم إرسال طلبك رقم #' + data.orderId, 'success');
      setTimeout(() => {
        alert(`🎉 شكراً لك!\nطلبك رقم #${data.orderId} توصلنا بنجاح.\nغادي نتواصلو معاك فـ 5 دقايق.`);
        location.href = '/';
      }, 1000);
    } else {
      showToast('❌ ' + (data.error || 'خطأ'), 'error');
    }
  } catch (e) {
    showToast('❌ خطأ فـ الاتصال', 'error');
  }
}

// ====== بدء ======
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  renderCart();

  const form = document.getElementById('orderForm');
  if (form) form.addEventListener('submit', submitOrder);
});