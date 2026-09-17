let allProducts = [];
let currentCategory = 'all';
let currentSearch = '';

function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast ' + type; }, 3000);
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderFeatured();
    renderProducts();
  } catch (e) {
    console.error('خطأ فـ تحميل المنتجات:', e);
  }
}

function productCard(p) {
  const img = p.image
    ? `<img src="${p.image}" alt="${p.name}" class="product-image">`
    : `<div class="product-image" style="display:flex;align-items:center;justify-content:center;font-size:3rem">🥞</div>`;

  const oldPrice = p.old_price
    ? `<span class="price-old">${p.old_price} د.م</span>`
    : '';

  const tag = p.old_price && p.old_price > p.price
    ? `<span class="tag">🔥 عرض</span>`
    : (p.featured ? `<span class="tag">⭐ مميز</span>` : '');

  const unavailable = !p.available
    ? `<div class="unavailable-overlay">غير متوفر</div>`
    : '';

  const btn = p.available
    ? `<button class="btn btn-primary" onclick="addToCart(${p.id})">🛒 أضف للسلة</button>`
    : `<button class="btn" disabled style="opacity:0.5">غير متوفر</button>`;

  return `
    <div class="product-card">
      ${tag}
      ${unavailable}
      ${img}
      <div class="product-body">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description || ''}</p>
        <div class="product-price">
          <span class="price-current">${p.price} د.م</span>
          ${oldPrice}
        </div>
        <div class="product-actions">
          ${btn}
        </div>
      </div>
    </div>
  `;
}

function renderFeatured() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;
  const featured = allProducts.filter(p => p.featured && p.available).slice(0, 4);
  if (featured.length === 0) {
    grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;color:var(--muted)">ما كاينش منتجات مميزة دابا</p>';
    return;
  }
  grid.innerHTML = featured.map(p => productCard(p)).join('');
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let list = allProducts;
  if (currentCategory !== 'all') {
    list = list.filter(p => p.category === currentCategory);
  }
  if (currentSearch) {
    list = list.filter(p =>
      p.name.includes(currentSearch) ||
      (p.description || '').includes(currentSearch)
    );
  }

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🔍</div><h3>ما لقيناش نتائج</h3><p>جرب كلمة أخرى</p></div>';
    return;
  }

  grid.innerHTML = list.map(p => productCard(p)).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const searchBox = document.getElementById('searchBox');
  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderProducts();
    });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      renderProducts();
    });
  });

  loadProducts();
});