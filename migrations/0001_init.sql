CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER,
  price REAL NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  calories INTEGER NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id) REFERENCES categories(id)
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duration TEXT NOT NULL CHECK(duration IN ('weekly','monthly')),
  price REAL NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  meals_per_day INTEGER NOT NULL DEFAULT 3,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  order_type TEXT NOT NULL CHECK(order_type IN ('single','subscription')),
  items_json TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO settings(key,value) VALUES
 ('store_name','سعودي دايت'),
 ('tagline','غذاؤك قوتك'),
 ('whatsapp',''),
 ('delivery_fee','0'),
 ('free_delivery_minimum','0'),
 ('hero_title','قوّتك تبدأ من طبقك'),
 ('hero_subtitle','وجبات محسوبة بعناية… لتقربك من هدفك');
INSERT INTO categories(name,sort_order)
SELECT 'وجبات رئيسية',1 WHERE NOT EXISTS (SELECT 1 FROM categories);
INSERT INTO categories(name,sort_order)
SELECT 'سناكات صحية',2 WHERE (SELECT COUNT(*) FROM categories)=1;
INSERT INTO categories(name,sort_order)
SELECT 'مشروبات',3 WHERE (SELECT COUNT(*) FROM categories)=2;
