const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

const DB_FILE = 'database.sqlite';
let db;

if (!fs.existsSync('public/uploads')) {
  fs.mkdirSync('public/uploads', { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('يُسمح بالصور فقط'));
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

app.use(session({
  secret: 'ftayer-had-soualem-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - Admin فقط' });
  }
  next();
}

initSqlJs().then(SQL => {
  if (fs.existsSync(DB_FILE)) {
    const buf = fs.readFileSync(DB_FILE);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      old_price REAL,
      image TEXT,
      category TEXT,
      available INTEGER DEFAULT 1,
      featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      pickup_time TEXT,
      total REAL NOT NULL,
      status TEXT DEFAULT 'جديد',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      price REAL,
      quantity INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  saveDB();

  const adminRow = get("SELECT value FROM settings WHERE key='admin_created'");
  if (!adminRow) {
    run("INSERT INTO settings (key, value) VALUES ('admin_created', '0')");
  }

  const countRow = get("SELECT COUNT(*) as c FROM products");
  if (!countRow || countRow.c === 0) {
    const products = [
      ['مسمن', 'مسمن مغربي أصيل، رقيق، ذهبي، ومقرمش من برا وطري من الداخل.', 8, 10, '', 'مسمن', 1, 1],
      ['رزيزة', 'رزيزة دافئة، مشبعة، وطرية. مثالية للفطور مع كاس أتاي.', 7, null, '', 'رزيزة', 1, 1],
      ['بغرير', 'بغرير مغربي تقليدي بثقوب دقيقة، لون ذهبي، وطعم خفيف.', 6, 8, '', 'بغرير', 1, 1],
      ['بطبوط', 'بطبوط مغربي سميك، طري، ومشبع. مثالي للعشا.', 5, null, '', 'بطبوط', 1, 0],
      ['حرشة', 'حرشة مغربية بالسميد، ذهبية من برا، طرية من الداخل.', 6, null, '', 'حرشة', 1, 0],
      ['فطائر متنوعة', 'تشكيلة مختارة من الفطائر المغربية التقليدية.', 12, 15, '', 'متنوعة', 1, 1],
    ];
    for (const p of products) {
      run(`INSERT INTO products (name, description, price, old_price, image, category, available, featured) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, p);
    }
  }

  app.get('/api/admin-status', (req, res) => {
    const row = get("SELECT value FROM settings WHERE key='admin_created'");
    res.json({ adminExists: row && row.value === '1' });
  });

  app.post('/api/create-admin', async (req, res) => {
    try {
      const row = get("SELECT value FROM settings WHERE key='admin_created'");
      if (row && row.value === '1') {
        return res.status(403).json({ error: 'تم إنشاء Admin مسبقاً' });
      }
      const { name, email, password } = req.body;
      if (!name || !email || !password || password.length < 6) {
        return res.status(400).json({ error: 'بيانات غير صحيحة (كلمة السر 6+)' });
      }
      const hash = await bcrypt.hash(password, 10);
      run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')", [name, email, hash]);
      run("UPDATE settings SET value='1' WHERE key='admin_created'");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { email, password, adminPassword } = req.body;
      
      if (adminPassword) {
        const admin = get("SELECT * FROM users WHERE role='admin' LIMIT 1");
        if (!admin) return res.status(401).json({ error: 'لا يوجد Admin' });
        const ok = await bcrypt.compare(adminPassword, admin.password);
        if (!ok) return res.status(401).json({ error: 'كلمة سر Admin غير صحيحة' });
        req.session.user = { id: admin.id, name: admin.name, email: admin.email, role: 'admin' };
        return res.json({ user: req.session.user });
      }
      
      const user = get("SELECT * FROM users WHERE email=?", [email]);
      if (!user) return res.status(401).json({ error: 'بيانات خاطئة' });
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'بيانات خاطئة' });
      
      req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      res.json({ user: req.session.user });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/register', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password || password.length < 6) {
        return res.status(400).json({ error: 'بيانات غير صحيحة' });
      }
      const exists = get("SELECT id FROM users WHERE email=?", [email]);
      if (exists) return res.status(400).json({ error: 'البريد مستعمل' });
      
      const hash = await bcrypt.hash(password, 10);
      run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')", [name, email, hash]);
      const user = get("SELECT * FROM users WHERE email=?", [email]);
      req.session.user = { id: user.id, name, email, role: 'customer' };
      res.json({ user: req.session.user });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  app.get('/api/me', (req, res) => {
    res.json({ user: req.session.user || null });
  });

  app.get('/api/products', (req, res) => {
    const { category, search, featured } = req.query;
    let sql = "SELECT * FROM products WHERE 1=1";
    const params = [];
    
    if (category && category !== 'all') {
      sql += " AND category = ?";
      params.push(category);
    }
    if (search) {
      sql += " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (featured === '1') {
      sql += " AND featured = 1";
    }
    sql += " ORDER BY id DESC";
    res.json(all(sql, params));
  });

  app.get('/api/products/:id', (req, res) => {
    const p = get("SELECT * FROM products WHERE id=?", [req.params.id]);
    if (!p) return res.status(404).json({ error: 'غير موجود' });
    res.json(p);
  });

  app.post('/api/products', requireAdmin, upload.single('image'), (req, res) => {
    try {
      const { name, description, price, old_price, category, available, featured } = req.body;
      const image = req.file ? '/uploads/' + req.file.filename : '';
      run(`INSERT INTO products (name, description, price, old_price, image, category, available, featured) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        name, description || '', parseFloat(price), 
        old_price ? parseFloat(old_price) : null, 
        image, category || 'متنوعة', 
        available === 'false' ? 0 : 1, 
        featured === 'true' ? 1 : 0
      ]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/products/:id', requireAdmin, upload.single('image'), (req, res) => {
    try {
      const { name, description, price, old_price, category, available, featured } = req.body;
      const p = get("SELECT * FROM products WHERE id=?", [req.params.id]);
      if (!p) return res.status(404).json({ error: 'غير موجود' });
      
      const image = req.file ? '/uploads/' + req.file.filename : p.image;
      run(`UPDATE products SET name=?, description=?, price=?, old_price=?, 
           image=?, category=?, available=?, featured=? WHERE id=?`, [
        name, description, parseFloat(price), 
        old_price ? parseFloat(old_price) : null, 
        image, category, 
        available === 'false' ? 0 : 1, 
        featured === 'true' ? 1 : 0, 
        req.params.id
      ]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/products/:id', requireAdmin, (req, res) => {
    run("DELETE FROM products WHERE id=?", [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/orders', (req, res) => {
    try {
      const { customer_name, phone, pickup_time, items, total } = req.body;
      if (!customer_name || !phone || !items || !items.length) {
        return res.status(400).json({ error: 'بيانات ناقصة' });
      }
      const userId = req.session.user ? req.session.user.id : null;
      run(`INSERT INTO orders (user_id, customer_name, phone, pickup_time, total) 
           VALUES (?, ?, ?, ?, ?)`, [userId, customer_name, phone, pickup_time || '', total]);
      const orderId = get("SELECT last_insert_rowid() as id").id;
      
      for (const it of items) {
        run(`INSERT INTO order_items (order_id, product_id, product_name, price, quantity) 
             VALUES (?, ?, ?, ?, ?)`, [orderId, it.id, it.name, it.price, it.quantity]);
      }
      res.json({ success: true, orderId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/orders', requireAdmin, (req, res) => {
    const orders = all("SELECT * FROM orders ORDER BY id DESC");
    for (const o of orders) {
      o.items = all("SELECT * FROM order_items WHERE order_id=?", [o.id]);
    }
    res.json(orders);
  });

  app.put('/api/orders/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    run("UPDATE orders SET status=? WHERE id=?", [status, req.params.id]);
    res.json({ success: true });
  });

  app.get('/api/stats', requireAdmin, (req, res) => {
    const orders = get("SELECT COUNT(*) as c FROM orders").c;
    const sales = get("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status='تم الاستلام'").s;
    const customers = get("SELECT COUNT(*) as c FROM users WHERE role='customer'").c;
    const products = get("SELECT COUNT(*) as c FROM products").c;
    res.json({ orders, sales, customers, products });
  });

  app.get('/api/customers', requireAdmin, (req, res) => {
    res.json(all("SELECT id, name, email, created_at FROM users WHERE role='customer' ORDER BY id DESC"));
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل على: http://localhost:${PORT}`);
  });

}).catch(err => {
  console.error('❌ خطأ فـ تحميل قاعدة البيانات:', err);
});