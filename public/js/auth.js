// ====== حالة المستخدم ======
let currentUser = null;

async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    currentUser = data.user;

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLink = document.getElementById('adminLink');

    if (currentUser) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) {
        logoutBtn.style.display = 'inline-block';
        logoutBtn.textContent = '👤 ' + currentUser.name;
      }
      if (adminLink && currentUser.role === 'admin') {
        adminLink.style.display = 'inline-block';
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  } catch (e) {
    console.error('خطأ فـ التحقق:', e);
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  showToast('👋 تم تسجيل الخروج', 'success');
  setTimeout(() => location.href = '/', 800);
}

// ====== تشغيل عند التحميل ======
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});