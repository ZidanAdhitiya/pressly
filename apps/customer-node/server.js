import 'dotenv/config';
import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';
import multer from 'multer';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLayout, getLayoutFile } from './prepress.js';

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
// Hostinger injects stale MIDTRANS_* values into the Passenger process even
// after its shared deployment env file is updated. Trust the canonical shared
// env for payment settings while keeping database/runtime settings managed by
// the process environment.
try {
  const sharedEnv = dotenv.parse(readFileSync(path.resolve(root, '../../../config/.env')));
  for (const key of ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'MIDTRANS_API_KEY', 'MIDTRANS_IS_PRODUCTION', 'MIDTRANS_FINISH_URL', 'MIDTRANS_ENABLED_PAYMENTS']) {
    if (sharedEnv[key]) process.env[key] = sharedEnv[key];
  }
} catch {}
const port = Number(process.env.PORT || 3000);
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE, waitForConnections: true,
  connectionLimit: 8, charset: 'utf8mb4', decimalNumbers: true,
  ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});
const q = (sql, values = []) => pool.execute(sql, values);
const json = (res, status, data) => res.status(status).json(data);
const int = (value, fallback, max = 500) => Math.max(1, Math.min(Number.parseInt(value, 10) || fallback, max));
const safeDate = value => value ? new Date(value).toISOString().replace('T', ' ').slice(0, 19) : null;
const publicDir = path.join(root, 'public');
const contentDir = process.env.CUSTOMER_CONTENT_PATH || path.join(root, 'storage', 'app', 'customer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
const validEnvValue = value => Boolean(String(value || '').trim()) && !/GANTI|CHANGE|REPLACE|YOUR_|TODO|EXAMPLE/i.test(String(value));
const databaseConfigured = () => ['MYSQL_HOST','MYSQL_DATABASE','MYSQL_USER','MYSQL_PASSWORD'].every(key => validEnvValue(process.env[key]));

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '16mb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function hasAdminAccess(req) {
  const expected = process.env.CUSTOMER_ADMIN_API_TOKEN || '';
  const supplied = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length >= 32 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
function admin(req, res, next) {
  const expected = process.env.CUSTOMER_ADMIN_API_TOKEN || '';
  if (Buffer.byteLength(expected) < 32) return json(res, 503, { error: 'Admin API belum dikonfigurasi dengan token server yang kuat.' });
  if (!hasAdminAccess(req)) return json(res, 401, { error: 'Autentikasi admin tidak valid.' });
  next();
}
function dbRequired(req, res, next) {
  if (!databaseConfigured()) return json(res, 503, { error: 'Lengkapi MYSQL_DATABASE, MYSQL_USER, dan MYSQL_PASSWORD dari detail database Hostinger.' });
  next();
}
const requestBuckets=new Map();
function rateLimit(max,windowMs){return (req,res,next)=>{const now=Date.now(),key=`${req.ip}:${req.baseUrl}${req.path}`,entry=requestBuckets.get(key);if(!entry||entry.until<=now){requestBuckets.set(key,{count:1,until:now+windowMs});return next();}if(entry.count>=max)return json(res,429,{error:'Terlalu banyak permintaan. Coba lagi nanti.'});entry.count++;next();};}
function wrap(fn) { return (req, res) => Promise.resolve(fn(req, res)).catch(error => {
  console.error('API failure:', req.method, req.path, error.code || error.name);
  if (!res.headersSent) json(res, 503, { error: 'Layanan belum dapat memproses permintaan.' });
}); }

app.get('/api/health', wrap(async (_req, res) => json(res, 200, {
  ok: true, service: 'Fazima Print-customer', mode: databaseConfigured() ? 'mysql' : 'unconfigured',
  database_configured: databaseConfigured(),
  gemini_configured: Boolean(process.env.GEMINI_API_KEY), gemini_model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  gemini_project_configured: Boolean(process.env.GEMINI_PROJECT_NUMBER),
})));
app.get('/api/firebase-config', (_req, res) => {
  const envValue = (key, ...aliases) => [key, ...aliases].map(name => process.env[name]).find(value => validEnvValue(value));
  const apiKey = envValue('FIREBASE_API_KEY');
  const authDomain = envValue('FIREBASE_AUTH_DOMAIN');
  const projectId = envValue('FIREBASE_PROJECT_ID', 'FIREBASE_PROJECTID');
  const appId = envValue('FIREBASE_APP_ID', 'FIREBASE_APPID');
  const messagingSenderId = envValue('FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGINGSENDERID');
  const configured = Boolean(apiKey && authDomain && projectId && appId);
  json(res, 200, { configured, config: configured ? {
    apiKey, authDomain, projectId,
    storageBucket: envValue('FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGEBUCKET') || '',
    messagingSenderId: messagingSenderId || '', appId,
    measurementId: envValue('FIREBASE_MEASUREMENT_ID', 'FIREBASE_MEASUREMENTID') || '',
  } : null });
});

const paymentLabels = { credit_card:'Credit/debit card', gopay:'GoPay', shopeepay:'ShopeePay', dana:'DANA', other_qris:'QRIS', bca_va:'BCA Virtual Account', bri_va:'BRI Virtual Account', bni_va:'BNI Virtual Account', permata_va:'Permata Virtual Account', echannel:'Mandiri Bill Payment', cimb_va:'CIMB Virtual Account', indomaret:'Indomaret', alfamart:'Alfamart' };
const sandboxGuides={
 credit_card:{label:'Kartu',simulator:'https://docs.midtrans.com/docs/testing-payment-on-sandbox',instruction:'Gunakan nomor kartu, expiry, CVV, dan OTP Sandbox dari panduan resmi.'},
 gopay:{label:'GoPay',simulator:'https://simulator.sandbox.midtrans.com/openapi/qris/index',instruction:'Di desktop, salin URL QR ke QRIS Simulator; jangan scan dengan aplikasi GoPay asli.'},
 shopeepay:{label:'ShopeePay',simulator:'https://simulator.sandbox.midtrans.com/openapi/qris/index',instruction:'Di desktop, salin URL QR ke QRIS Simulator; jangan gunakan ShopeePay asli.'},
 dana:{label:'DANA',simulator:'https://docs.midtrans.com/docs/testing-payment-on-sandbox',instruction:'Ikuti simulator/credential DANA yang tersedia pada akun Sandbox.'},
 other_qris:{label:'QRIS',simulator:'https://simulator.sandbox.midtrans.com/openapi/qris/index',instruction:'Salin URL QR ke QRIS Simulator, klik Scan QR, lalu selesaikan simulasi.'},
 bca_va:{label:'BCA Virtual Account',simulator:'https://simulator.sandbox.midtrans.com/bca/va/index',instruction:'Masukkan nomor VA ke BCA VA Simulator lalu selesaikan simulasi.'},
 bri_va:{label:'BRI Virtual Account',simulator:'https://simulator.sandbox.midtrans.com/openapi/va/index?bank=bri',instruction:'Masukkan nomor VA ke BRI VA Simulator lalu selesaikan simulasi.'},
 bni_va:{label:'BNI Virtual Account',simulator:'https://simulator.sandbox.midtrans.com/bni/va/index',instruction:'Masukkan nomor VA ke BNI VA Simulator lalu selesaikan simulasi.'},
 permata_va:{label:'Permata Virtual Account',simulator:'https://simulator.sandbox.midtrans.com/openapi/va/index?bank=permata',instruction:'Masukkan nomor VA ke Permata VA Simulator lalu selesaikan simulasi.'},
 echannel:{label:'Mandiri Bill Payment',simulator:'https://simulator.sandbox.midtrans.com/openapi/va/index?bank=mandiri',instruction:'Masukkan company code dan bill key ke Mandiri Simulator.'},
 cimb_va:{label:'CIMB Virtual Account',simulator:'https://simulator.sandbox.midtrans.com/openapi/va/index?bank=cimb',instruction:'Masukkan nomor VA ke CIMB VA Simulator lalu selesaikan simulasi.'},
 indomaret:{label:'Indomaret',simulator:'https://docs.midtrans.com/docs/testing-payment-on-sandbox',instruction:'Gunakan payment code pada Indomaret Simulator dari panduan Sandbox.'},
 alfamart:{label:'Alfamart',simulator:'https://docs.midtrans.com/docs/testing-payment-on-sandbox',instruction:'Gunakan payment code pada Alfamart Simulator dari panduan Sandbox.'}
};
app.get('/api/payments/config', (_req, res) => {
  const production = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  const clientKey = process.env.MIDTRANS_CLIENT_KEY || process.env.MIDTRANS_API_KEY || '';
  const ids = (process.env.MIDTRANS_ENABLED_PAYMENTS || 'credit_card,dana,other_qris,bca_va,bri_va,bni_va,permata_va,echannel,cimb_va,indomaret,alfamart').split(',').map(s => s.trim()).filter(id => paymentLabels[id]);
  json(res, 200, { configured: Boolean(process.env.MIDTRANS_SERVER_KEY && clientKey), environment: production ? 'production' : 'sandbox', snap_js: `https://app${production ? '' : '.sandbox'}.midtrans.com/snap/snap.js`, client_key: clientKey || null, payment_methods: ids.map(id => ({ id, label: paymentLabels[id], sandbox: production ? null : (sandboxGuides[id] || null) })), status_endpoint: '/api/payments/status/<order_id>' });
});

const PROMO_TIMER_CLAUSE=" AND NOT EXISTS (SELECT 1 FROM promo_timer_settings ts WHERE ts.id=1 AND (ts.enabled=0 OR ts.ends_at IS NULL OR ts.ends_at<=UTC_TIMESTAMP()))";
const catalogSQL = `SELECT p.id,p.name,p.slug,p.category,p.product_type,p.kind,p.unit,p.base_price,p.image_path,p.description,p.sizes_json,p.materials_json,
 COALESCE(sales.sales_count,0) sales_count,pr.id promo_id,pr.title promo_title,pr.discount_percent,pr.promo_price,pr.starts_at promo_starts_at,pr.ends_at promo_ends_at
 FROM products p LEFT JOIN promotions pr ON pr.product_id=p.id AND pr.is_active=1 AND (pr.starts_at IS NULL OR pr.starts_at<=UTC_TIMESTAMP()) AND (pr.ends_at IS NULL OR pr.ends_at>=UTC_TIMESTAMP())${PROMO_TIMER_CLAUSE}
 LEFT JOIN (SELECT sold.product_id,SUM(sold.quantity) sales_count FROM (SELECT oi.product_id,oi.quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('paid','processing','ready','completed') AND oi.product_id IS NOT NULL UNION ALL SELECT ci.product_id,ci.quantity FROM cashier_sale_items ci JOIN cashier_sales cs ON cs.id=ci.sale_id WHERE cs.status IN ('paid','partial') AND ci.product_id IS NOT NULL) sold GROUP BY sold.product_id) sales ON sales.product_id=p.id`;
function enrichCatalog(row) {
  const promo = row.promo_id != null;
  return { ...row, sizes: parseJSON(row.sizes_json), materials: parseJSON(row.materials_json), base_price: Number(row.base_price), sales_count: Number(row.sales_count || 0), price: promo ? Number(row.promo_price) : Number(row.base_price), original_price: promo ? Number(row.base_price) : null, discount: promo ? Number(row.discount_percent) : 0, ...(promo ? { promo_price: Number(row.promo_price), discount_percent: Number(row.discount_percent) } : {}) };
}
function parseJSON(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || '[]') || []; } catch { return []; }
}
function actor(value,fallback) { return String(value||'').trim().slice(0,120)||fallback; }
async function audit(conn,orderId,from,to,role,name,note='') { await conn.execute('INSERT INTO order_status_history (order_id,from_status,to_status,actor_role,actor_name,note) VALUES (?,?,?,?,?,?)',[orderId,from||null,to,role,name,String(note).slice(0,5000)]); }
async function notify(conn,orderId,team,type,title,message) { await conn.execute('INSERT INTO dashboard_notifications (order_id,target_team,notification_type,title,message) VALUES (?,?,?,?,?)',[orderId,team,type,title,message]); }
function productionCategory(material='') { const m=material.toLowerCase(); if(['flexy','korea','backlite','oneway'].some(x=>m.includes(x)))return 'Outdoor'; if(['ritrama','graftac','blockout','albatros','luster','quantac','camel'].some(x=>m.includes(x)))return 'Indoor'; return 'A3'; }
app.get('/api/products', dbRequired, wrap(async (_req, res) => {
  const [rows] = await q(`${catalogSQL} WHERE p.is_active=1 ORDER BY p.category,p.id`);
  json(res, 200, rows.map(row => { const x=enrichCatalog(row); return { name:x.name,sizes:x.sizes,materials:x.materials,kind:x.kind }; }));
}));
app.get('/api/catalog', dbRequired, wrap(async (_req, res) => {
  const [rows] = await q(`${catalogSQL} WHERE p.is_active=1 ORDER BY p.category,p.id`); json(res, 200, rows.map(enrichCatalog));
}));
app.get('/api/admin/catalog', dbRequired, wrap(async (_req, res) => {
  const [rows] = await q(`${catalogSQL.replace(PROMO_TIMER_CLAUSE,'')} ORDER BY p.category,p.id`); json(res, 200, rows.map(enrichCatalog));
}));
app.post('/api/admin/categories', admin, dbRequired, wrap(async (req,res) => {
  const name=String(req.body?.name||'').trim().slice(0,80), slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
  if(!name||!slug)return json(res,400,{error:'Nama kategori wajib diisi'});
  try { const [r]=await q('INSERT INTO product_categories (slug,name,sort_order,is_active) VALUES (?,?,?,1)',[slug,name,Number(req.body.sort_order)||0]); json(res,201,{ok:true,id:r.insertId,slug}); } catch { json(res,503,{error:'Kategori baru tidak dapat disimpan. Pastikan tabel product_categories tersedia.'}); }
}));
app.put('/api/admin/categories/:id', admin, dbRequired, wrap(async (req,res) => {
  const id=Number(req.params.id), name=String(req.body?.name||'').trim().slice(0,80), slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
  if(!Number.isInteger(id)||!name||!slug)return json(res,400,{error:'Nama kategori wajib diisi'});
  const c=await pool.getConnection(); try { await c.beginTransaction(); const [old]=await c.execute('SELECT slug FROM product_categories WHERE id=? FOR UPDATE',[id]); if(!old.length)throw new Error('Kategori tidak ditemukan'); await c.execute('UPDATE product_categories SET slug=?,name=?,sort_order=? WHERE id=?',[slug,name,Number(req.body.sort_order)||0,id]); await c.execute('UPDATE products SET category=? WHERE category=?',[slug,old[0].slug]); await c.commit(); json(res,200,{ok:true,id,slug}); } catch(e) { await c.rollback(); json(res,400,{error:e.message||'Kategori tidak dapat diubah.'}); } finally { c.release(); }
}));
app.delete('/api/admin/categories/:id', admin, dbRequired, wrap(async (req,res) => {
  const id=Number(req.params.id); try { const [rows]=await q('SELECT slug FROM product_categories WHERE id=?',[id]); if(!rows.length)return json(res,404,{error:'Kategori tidak ditemukan'}); const [active]=await q('SELECT COUNT(*) n FROM products WHERE category=? AND is_active=1',[rows[0].slug]); if(active[0].n)return json(res,400,{error:'Kategori masih dipakai produk aktif'}); await q('UPDATE product_categories SET is_active=0 WHERE id=?',[id]); json(res,200,{ok:true,id,deleted:true}); } catch { json(res,503,{error:'Kategori tidak dapat dihapus.'}); }
}));
app.post('/api/admin/products', admin, dbRequired, wrap(async (req,res) => {
  const p=req.body||{}, name=String(p.name||'').trim().slice(0,120), category=String(p.category||'').slice(0,40), type=String(p.product_type||'').slice(0,80), price=Number(p.base_price);
  if(!name||!category||!type||!Number.isFinite(price)||price<0)return json(res,400,{error:'Nama, kategori, tipe, dan harga produk wajib diisi'});
  const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,140)||'produk-baru';
  try { const image=String(p.image_data||'').trim()?await saveProductImage(p.image_data,name,category):String(p.image_path||'');const [r]=await q('INSERT INTO products (name,slug,category,product_type,kind,unit,base_price,image_path,description,sizes_json,materials_json,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)',[name,slug,category,type,String(p.kind||'custom').slice(0,40),String(p.unit||'pcs').slice(0,20),price,image.slice(0,255),String(p.description||'').slice(0,4000),JSON.stringify(Array.isArray(p.sizes)?p.sizes:[]),JSON.stringify(Array.isArray(p.materials)?p.materials:[])]); json(res,201,{ok:true,id:r.insertId,slug}); } catch(e) { json(res,e.message?.startsWith('Foto')?400:503,{error:e.message?.startsWith('Foto')?e.message:'Produk baru tidak dapat disimpan.'}); }
}));
app.put('/api/admin/products/:id', admin, dbRequired, wrap(async (req,res) => {
  const id=Number(req.params.id),p=req.body||{},name=String(p.name||'').trim().slice(0,120),category=String(p.category||'').slice(0,40),price=Number(p.base_price);
  if(!Number.isInteger(id)||!name||!category||!Number.isFinite(price)||price<0)return json(res,400,{error:'Data produk tidak valid'});
  let image=String(p.image_path||'');if(p.image_data)image=await saveProductImage(p.image_data,name,category);else if(!image){const [existing]=await q('SELECT image_path FROM products WHERE id=?',[id]);image=existing[0]?.image_path||'';}
  const [r]=await q('UPDATE products SET name=?,category=?,product_type=?,unit=?,base_price=?,image_path=?,description=?,sizes_json=?,materials_json=?,is_active=? WHERE id=?',[name,category,String(p.product_type||'').slice(0,80),String(p.unit||'pcs').slice(0,20),price,image.slice(0,255),String(p.description||'').slice(0,4000),JSON.stringify(Array.isArray(p.sizes)?p.sizes:[]),JSON.stringify(Array.isArray(p.materials)?p.materials:[]),p.is_active===false?0:1,id]);
  if(!r.affectedRows)return json(res,404,{error:'Produk tidak ditemukan'}); json(res,200,{ok:true,id});
}));
app.delete('/api/admin/products/:id', admin, dbRequired, wrap(async (req,res) => { const [r]=await q('UPDATE products SET is_active=0 WHERE id=?',[Number(req.params.id)]); r.affectedRows?json(res,200,{ok:true,id:Number(req.params.id),deleted:true}):json(res,404,{error:'Produk tidak ditemukan'}); }));
app.put('/api/admin/promotions/:productId', admin, dbRequired, wrap(async (req,res) => {
  const id=Number(req.params.productId),p=req.body||{},discount=Number(p.discount_percent); if(!Number.isInteger(id)||!Number.isFinite(discount)||discount<0||discount>100)return json(res,400,{error:'Nilai promo tidak valid'});
  const [products]=await q('SELECT base_price FROM products WHERE id=?',[id]); if(!products.length)return json(res,400,{error:'Produk tidak ditemukan'});
  await q(`INSERT INTO promotions (product_id,title,discount_percent,promo_price,starts_at,ends_at,is_active) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),discount_percent=VALUES(discount_percent),promo_price=VALUES(promo_price),starts_at=VALUES(starts_at),ends_at=VALUES(ends_at),is_active=VALUES(is_active)`,[id,String(p.title||'Promo katalog').slice(0,160),discount,Math.round(Number(products[0].base_price)*(1-discount/100)*100)/100,p.starts_at||null,p.ends_at||null,p.is_active?1:0]); json(res,200,{ok:true,product_id:id});
}));
function safeSlug(value,max=100){return String(value||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,max);}
async function saveImageData(data,prefix,maxBytes=3*1024*1024){
  const m=String(data||'').match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i); if(!m)throw new Error('Gambar harus PNG, JPG, atau WEBP.');
  const bytes=Buffer.from(m[2],'base64'); if(!bytes.length||bytes.length>maxBytes)throw new Error('Ukuran gambar melebihi batas yang diizinkan.');
  const ext=/^jpe?g$/i.test(m[1])?'jpg':m[1].toLowerCase(), file=`${prefix}${crypto.randomBytes(10).toString('hex')}.${ext}`, relative=`assets/real/gallery/${file}`;
  const target=path.join(publicDir,...relative.split('/')); await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(target,bytes,{flag:'wx'}); return relative;
}
async function saveProductImage(data,name,category){
  const m=String(data||'').match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i);if(!m)throw new Error('Foto harus PNG, JPG, atau WEBP');const bytes=Buffer.from(m[2],'base64');if(!bytes.length||bytes.length>10*1024*1024)throw new Error('Foto maksimal 10 MB');const ext=/^jpe?g$/i.test(m[1])?'jpg':m[1].toLowerCase(),rel=`assets/products/${safeSlug(category,40)||'custom'}/${safeSlug(name,140)||'produk'}.${ext}`,file=path.join(publicDir,...rel.split('/'));await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);return rel;
}
async function writeContent(name,value){ await fs.mkdir(contentDir,{recursive:true}); const target=path.join(contentDir,name),tmp=`${target}.${crypto.randomBytes(6).toString('hex')}.tmp`; await fs.writeFile(tmp,`${JSON.stringify(value,null,2)}\n`,'utf8'); await fs.rename(tmp,target); }
async function validAsset(asset,prefixes){ const p=String(asset||'').replaceAll('\\','/').replace(/^\/+/, ''); if(p.split('/').includes('..')||!prefixes.some(x=>p.startsWith(x)))return false; try{return (await fs.stat(path.join(publicDir,...p.split('/')))).isFile();}catch{return false;} }
app.put('/api/admin/promo-settings', admin, dbRequired, wrap(async (req,res) => {
  const p=req.body||{},mode=String(p.mode||'one_time'),endAction=String(p.end_action||'hide_box'); if(!['one_time','fixed_loop','random_loop'].includes(mode))return json(res,400,{error:'Mode timer tidak valid'}); if(!['reset_timer','hide_box','deactivate_promos'].includes(endAction))return json(res,400,{error:'Aksi akhir timer tidak valid'});
  const duration=Math.max(60,Number(p.duration_seconds)||28800),threshold=Math.max(0,Number(p.reset_threshold_seconds)||0),minimum=Math.max(60,Number(p.random_min_seconds)||14400),maximum=Math.max(minimum,Number(p.random_max_seconds)||43200),enabled=p.enabled!==false,now=new Date(); const conn=await pool.getConnection();
  try{await conn.beginTransaction();const [rows]=await conn.execute('SELECT * FROM promo_timer_settings WHERE id=1 FOR UPDATE');const old=rows[0],end=old?.ends_at?new Date(old.ends_at):null,keep=old&&old.mode===mode&&Boolean(old.enabled)&&end>now&&!p.restart_cycle;const generated=mode==='random_loop'?(keep?Number(old.generated_duration_seconds||duration):Math.floor(Math.random()*(maximum-minimum+1))+minimum):duration;const started=keep?new Date(old.started_at):now,ends=keep?end:new Date(now.getTime()+generated*1000);
   await conn.execute(`INSERT INTO promo_timer_settings (id,enabled,mode,duration_seconds,reset_threshold_seconds,random_min_seconds,random_max_seconds,end_action,started_at,ends_at,generated_duration_seconds) VALUES (1,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),mode=VALUES(mode),duration_seconds=VALUES(duration_seconds),reset_threshold_seconds=VALUES(reset_threshold_seconds),random_min_seconds=VALUES(random_min_seconds),random_max_seconds=VALUES(random_max_seconds),end_action=VALUES(end_action),started_at=VALUES(started_at),ends_at=VALUES(ends_at),generated_duration_seconds=VALUES(generated_duration_seconds)`,[enabled?1:0,mode,duration,threshold,minimum,maximum,endAction,enabled?started:null,enabled?ends:null,enabled?generated:null]); await conn.commit(); json(res,200,{enabled,visible:enabled&&ends>now,mode,duration_seconds:duration,reset_threshold_seconds:threshold,random_min_seconds:minimum,random_max_seconds:maximum,end_action:endAction,started_at:enabled?started.toISOString():null,ends_at:enabled?ends.toISOString():null,generated_duration_seconds:enabled?generated:null,persisted:true});
  }catch(e){await conn.rollback();if(e.code==='ER_NO_SUCH_TABLE')return json(res,503,{error:'Tabel promo_timer_settings belum tersedia.'});throw e;}finally{conn.release();}
}));
app.put('/api/admin/hero-images', admin, wrap(async (req,res) => {
  const slides=req.body?.slides;if(!Array.isArray(slides)||slides.length<1||slides.length>8)return json(res,400,{error:'Hero harus memiliki 1 sampai 8 gambar.'});const saved=[];
  try{for(const slide of slides){if(!slide||typeof slide!=='object')throw new Error('Data gambar hero tidak valid.');const image=String(slide.image_data||'').trim()?await saveImageData(slide.image_data,'hero-'):String(slide.image||'').replaceAll('\\','/').trim();if(!await validAsset(image,['assets/real/gallery/','assets/real/products/','assets/hero/']))throw new Error('Pilih file gambar yang valid untuk setiap slide hero.');saved.push({image,alt:String(slide.alt||'Fazima Print').trim().slice(0,180)||'Fazima Print'});}await writeContent('hero_images.json',{slides:saved});json(res,200,{slides:saved});}catch(e){json(res,400,{error:e.message||'Gambar hero tidak dapat disimpan.'});}
}));
app.put('/api/admin/category-box-visuals/:slug', admin, dbRequired, wrap(async (req,res) => {
  const slug=String(req.params.slug); let rows; try{[rows]=await q('SELECT slug,name FROM product_categories WHERE slug=? AND is_active=1',[slug]);}catch(e){if(e.code!=='ER_NO_SUCH_TABLE')throw e;[rows]=await q('SELECT category slug,category name FROM products WHERE category=? GROUP BY category',[slug]);} if(!rows.length)return json(res,400,{error:'Kategori tidak ditemukan.'});
  const p=req.body||{};let image=String(p.image_data||'').trim()?await saveImageData(p.image_data,`category-box-${safeSlug(slug)}-`):String(p.image||'').replaceAll('\\','/').trim();if(!await validAsset(image,['assets/real/gallery/','assets/real/products/']))return json(res,400,{error:'Pilih gambar kategori yang valid.'});
  let current={};try{current=JSON.parse(await fs.readFile(path.join(contentDir,'category_box_visuals.json'),'utf8')).categories||{};}catch{}const item={image,shadow:p.shadow===true};current[slug]=item;await writeContent('category_box_visuals.json',{categories:current});json(res,200,{slug,name:rows[0].name,...item});
}));
app.get('/api/categories', dbRequired, wrap(async (_req, res) => {
  try { const [rows] = await q('SELECT id,slug,name,sort_order,is_active FROM product_categories WHERE is_active=1 ORDER BY sort_order,name'); return json(res, 200, rows); }
  catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; const [rows] = await q('SELECT category slug,category name,0 sort_order FROM products GROUP BY category ORDER BY category'); json(res, 200, rows); }
}));
app.get('/api/admin/categories', dbRequired, wrap(async (_req, res) => {
  try { const [rows] = await q('SELECT id,slug,name,sort_order,is_active FROM product_categories ORDER BY sort_order,name'); return json(res, 200, rows); }
  catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; const [rows] = await q('SELECT category slug,category name,0 sort_order,1 is_active FROM products GROUP BY category ORDER BY category'); json(res, 200, rows); }
}));

app.get('/api/orders', dbRequired, wrap(async (req, res) => {
  const [rows] = await q(`SELECT o.id,o.order_number,o.customer_name,o.customer_phone,o.grand_total,o.status,o.source,o.workflow_status,o.rejection_reason,o.setting_note,o.deadline_at,o.created_at,o.updated_at,p.transaction_status,p.fraud_status FROM orders o LEFT JOIN payments p ON p.order_id=o.id ORDER BY o.created_at DESC LIMIT ${int(req.query.limit,100,500)}`);
  json(res, 200, rows.map(r => ({ ...r, grand_total:Number(r.grand_total || 0), created_at:safeDate(r.created_at), updated_at:safeDate(r.updated_at) })));
}));
app.get('/api/orders/:orderNumber', dbRequired, wrap(async (req, res) => {
  const [rows] = await q(`SELECT o.order_number,o.customer_name,o.customer_phone,o.source,o.grand_total,o.shipping_courier,o.status,o.workflow_status,o.rejection_reason,o.setting_note,o.deadline_at,o.layout_token,o.layout_output_name,o.layout_saved_at,o.cashier_note,o.created_at,o.updated_at,o.id,p.transaction_status,p.fraud_status FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.order_number=? LIMIT 1`, [req.params.orderNumber]);
  if (!rows.length) return json(res,404,{error:'Order tidak ditemukan.'});
  const order=rows[0]; const [items]=await q('SELECT product_name,size_label,quantity,unit_price,item_total,finishing FROM order_items WHERE order_id=? ORDER BY id',[order.id]);
  delete order.id; json(res,200,{...order,grand_total:Number(order.grand_total||0),items:items.map(i=>({...i,unit_price:Number(i.unit_price||0),item_total:Number(i.item_total||0)}))});
}));
app.get('/api/dashboard/orders', admin, dbRequired, wrap(async (req,res) => {
  const clauses=[],values=[]; if(req.query.workflow_status){clauses.push('o.workflow_status=?');values.push(String(req.query.workflow_status));} if(req.query.source){clauses.push('o.source=?');values.push(String(req.query.source).toUpperCase());}
  const [rows]=await q(`SELECT o.id,o.order_number,o.customer_name,o.customer_phone,o.source,o.grand_total,o.status,o.workflow_status,o.rejection_reason,o.setting_note,o.deadline_at,o.created_at,o.updated_at,p.transaction_status,p.fraud_status FROM orders o LEFT JOIN payments p ON p.order_id=o.id ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY o.created_at DESC LIMIT ${int(req.query.limit,100,500)}`,values);
  json(res,200,rows.map(x=>({...x,grand_total:x.grand_total==null?null:Number(x.grand_total)})));
}));
app.get('/api/dashboard/orders/:orderNumber', admin, dbRequired, wrap(async (req,res) => {
  const [orders]=await q('SELECT id FROM orders WHERE order_number=?',[req.params.orderNumber]); if(!orders.length)return json(res,404,{error:'Order tidak ditemukan.'});
  const id=orders[0].id; const [history]=await q('SELECT * FROM order_status_history WHERE order_id=? ORDER BY created_at,id',[id]); let verifications=[]; try{[verifications]=await q('SELECT * FROM order_verifications WHERE order_id=? ORDER BY created_at,id',[id]);}catch{}
  const [base]=await q('SELECT order_number FROM orders WHERE id=?',[id]); const [full]=await pool.query('SELECT * FROM orders WHERE id=?',[id]); const [payments]=await q('SELECT transaction_status,fraud_status FROM payments WHERE order_id=? LIMIT 1',[id]); const [items]=await q('SELECT product_name,size_label,quantity,unit_price,item_total,finishing FROM order_items WHERE order_id=? ORDER BY id',[id]);
  json(res,200,{...full[0],grand_total:Number(full[0].grand_total||0),transaction_status:payments[0]?.transaction_status||null,fraud_status:payments[0]?.fraud_status||null,items,history,verifications});
}));
app.get('/api/dashboard/notifications', admin, dbRequired, wrap(async (req,res) => {
  const team=String(req.query.team||'SETTING').toUpperCase().slice(0,32), unread=!['0','false','no'].includes(String(req.query.unread_only||'true').toLowerCase());
  const [rows]=await q(`SELECT id,order_id,notification_type,title,message,is_read,created_at,read_at FROM dashboard_notifications WHERE target_team=? ${unread?'AND is_read=0':''} ORDER BY created_at DESC LIMIT ${int(req.query.limit,100,500)}`,[team]); json(res,200,rows);
}));
app.put('/api/dashboard/notifications/:id/read', admin, dbRequired, wrap(async (req,res) => {
  const [r]=await q('UPDATE dashboard_notifications SET is_read=1,read_at=CURRENT_TIMESTAMP WHERE id=?',[Number(req.params.id)]); r.affectedRows?json(res,200,{ok:true,id:Number(req.params.id)}):json(res,404,{error:'Notifikasi tidak ditemukan.'});
}));
app.get('/api/operator/production', admin, dbRequired, wrap(async (req,res) => {
  const values=[],filter=req.query.category? 'WHERE p.production_category=?':'';if(filter)values.push(String(req.query.category).slice(0,20));
  const [rows]=await q(`SELECT p.id,p.order_id,p.production_category,p.status,p.operator_name,p.started_at,p.completed_at,p.notes,p.created_at,p.updated_at,o.order_number,o.customer_name,o.customer_phone,o.workflow_status,o.layout_token,o.layout_output_name,o.layout_file_path,o.deadline_at,o.grand_total,o.source FROM production_jobs p JOIN orders o ON o.id=p.order_id ${filter} ORDER BY FIELD(p.status,'in_progress','queued','blocked','completed'),p.created_at LIMIT ${int(req.query.limit,100,500)}`,values);
  for(const row of rows){row.grand_total=Number(row.grand_total||0);const [materials]=await q('SELECT u.id,u.stock_item_id,s.name,u.quantity,u.unit,u.note,u.usage_type,u.order_group,u.channel,u.operator_name FROM production_material_usage u JOIN stock_items s ON s.id=u.stock_item_id WHERE u.production_job_id=? ORDER BY u.id',[row.id]);row.materials=materials.map(x=>({...x,quantity:Number(x.quantity||0)}));}json(res,200,rows);
}));
app.get('/api/operator/production-usage', admin, dbRequired, wrap(async (req,res) => {
  const clauses=[],values=[];if(req.query.date_from){clauses.push('DATE(u.created_at)>=?');values.push(String(req.query.date_from).slice(0,10));}if(req.query.date_to){clauses.push('DATE(u.created_at)<=?');values.push(String(req.query.date_to).slice(0,10));}if(['offline','online','internal'].includes(req.query.group)){clauses.push('u.order_group=?');values.push(req.query.group);}if(req.query.channel){clauses.push('u.channel=?');values.push(String(req.query.channel).slice(0,60));}if(req.query.operator){clauses.push('u.operator_name LIKE ?');values.push(`%${String(req.query.operator).slice(0,120)}%`);}
  const [rows]=await q(`SELECT u.id,u.production_job_id,u.order_group,u.channel,u.operator_name,u.reference,u.usage_type,u.stock_item_id,s.name material_name,u.quantity,u.unit,u.note,u.created_at,o.order_number,o.source FROM production_material_usage u JOIN stock_items s ON s.id=u.stock_item_id LEFT JOIN production_jobs p ON p.id=u.production_job_id LEFT JOIN orders o ON o.id=p.order_id ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY u.created_at DESC,u.id DESC LIMIT ${int(req.query.limit,500,2000)}`,values);json(res,200,rows.map(x=>({...x,quantity:Number(x.quantity||0)})));
}));
app.post('/api/dashboard/orders/manual', admin, dbRequired, wrap(async (req,res) => {
  const p=req.body||{},source=String(p.source||'').trim().toUpperCase(),customer=String(p.customer_name||'').trim().slice(0,120),phone=String(p.customer_phone||'').trim().slice(0,40),items=p.items;
  if(!['SHOPEE','ECOMMERCE_LAIN'].includes(source))return json(res,400,{error:'Order manual harus bersumber dari SHOPEE atau ECOMMERCE_LAIN'});if(!Array.isArray(items)||!items.length||items.length>50)return json(res,400,{error:'Minimal satu item order wajib diisi'});if(!customer||!phone)return json(res,400,{error:'Nama customer dan nomor WhatsApp wajib diisi'});
  const clean=[];let total=0;for(const it of items){const name=String(it.product_name||'').trim().slice(0,120),size=String(it.size_label||'').trim().slice(0,80),qty=Number(it.quantity),price=Number(it.unit_price);if(!name||!size||!Number.isInteger(qty)||qty<1||qty>100000||!Number.isFinite(price)||price<0)return json(res,400,{error:'Detail item order tidak valid'});const line=Math.round(price*qty*100)/100;total+=line;clean.push({name,size,qty,price,line,material:String(it.material||'').slice(0,80),finish:String(it.finishing||'').slice(0,80),file:String(it.design_file||'').slice(0,255)});}
  const orderNo=String(p.order_number||`FZ-M-${Date.now()}`).slice(0,40),deadline=p.deadline_at||null,conn=await pool.getConnection();try{await conn.beginTransaction();const [insert]=await conn.execute(`INSERT INTO orders (order_number,source,customer_name,customer_phone,delivery_method,address,subtotal,discount_total,grand_total,status,workflow_status,notes,deadline_at,setting_note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[orderNo,source,customer,phone,p.delivery_method==='delivery'?'delivery':'pickup',String(p.address||'').slice(0,5000),total,0,total,'draft','DRAFT_MANUAL',String(p.note||'').slice(0,5000),deadline,String(p.note||'').slice(0,5000)]);for(const it of clean)await conn.execute('INSERT INTO order_items (order_id,product_name,size_label,material,quantity,unit_price,original_unit_price,finishing,design_file,item_total) VALUES (?,?,?,?,?,?,?,?,?,?)',[insert.insertId,it.name,it.size,it.material,it.qty,it.price,it.price,it.finish,it.file,it.line]);const by=actor(p.actor_name,'Nama Team Setting');await audit(conn,insert.insertId,null,'DRAFT_MANUAL','setting',by,String(p.note||''));await notify(conn,insert.insertId,'SETTING','MANUAL_ORDER_CREATED','Order manual baru',`${orderNo} dari ${source} menunggu validasi Team Setting.`);await conn.commit();json(res,201,{id:insert.insertId,order_id:orderNo,source,subtotal:total,grand_total:total,workflow_status:'DRAFT_MANUAL'});}catch(e){await conn.rollback();json(res,503,{error:'Order manual tidak dapat disimpan.'});}finally{conn.release();}
}));
app.post('/api/dashboard/orders/:orderNumber/setting-decision', admin, dbRequired, wrap(async (req,res) => {
  const p=req.body||{},action=String(p.action||'').toLowerCase(),by=actor(p.actor_name,'Nama validator pertama'),verifier=actor(p.verifier_name,'Nama verifier kedua'),note=String(p.note||'').slice(0,5000);if(!['accept','reject'].includes(action))return json(res,400,{error:'Aksi Team Setting harus accept atau reject'});if(by.toLowerCase()===verifier.toLowerCase())return json(res,400,{error:'Validator pertama dan verifier kedua harus berbeda'});if(action==='reject'&&!note.trim())return json(res,400,{error:'Alasan penolakan wajib diisi'});
  const target=action==='accept'?'SIAP_AUTO_LAYOUT':'DITOLAK_SETTING',conn=await pool.getConnection();try{await conn.beginTransaction();const [rows]=await conn.execute('SELECT id,workflow_status FROM orders WHERE order_number=? FOR UPDATE',[req.params.orderNumber]);if(!rows.length)throw new Error('Order tidak ditemukan');const order=rows[0];if(!['DRAFT_MANUAL','MENUNGGU_VALIDASI_SETTING','MENUNGGU_DOUBLE_VERIFIKASI'].includes(order.workflow_status))throw new Error('Order tidak berada pada antrean validasi Team Setting');const [seen]=await conn.execute('SELECT id FROM order_verifications WHERE order_id=? AND target_status=? LIMIT 1',[order.id,target]);if(seen.length)throw new Error('Keputusan order ini sudah diverifikasi');await conn.execute('UPDATE orders SET workflow_status=?,rejection_reason=?,setting_note=? WHERE id=?',[target,action==='reject'?note:null,note,order.id]);for(const name of [by,verifier])await conn.execute('INSERT INTO order_verifications (order_id,target_status,verifier_name,verifier_role,verification_note) VALUES (?,?,?,?,?)',[order.id,target,name,'setting',note]);await audit(conn,order.id,order.workflow_status,target,'setting',`${by} + ${verifier}`,note);await notify(conn,order.id,'SETTING',action==='accept'?'SETTING_ACCEPTED':'SETTING_REJECTED',action==='accept'?'Order diterima Team Setting':'Order ditolak Team Setting',action==='accept'?`${req.params.orderNumber} siap masuk Auto Layout.`:`${req.params.orderNumber} ditolak: ${note}`);await conn.commit();json(res,200,{order_id:req.params.orderNumber,workflow_status:target,verified_by:[by,verifier],note});}catch(e){await conn.rollback();json(res,400,{error:e.message||'Keputusan Team Setting tidak dapat disimpan.'});}finally{conn.release();}
}));
app.post('/api/dashboard/orders/:orderNumber/transfer-cashier', admin, dbRequired, wrap(async (req,res) => {
  const conn=await pool.getConnection(),by=actor(req.body?.actor_name,'Nama Team Setting'),note=String(req.body?.note||'').slice(0,5000);try{await conn.beginTransaction();const [r]=await conn.execute('SELECT id,workflow_status FROM orders WHERE order_number=? FOR UPDATE',[req.params.orderNumber]);if(!r.length)throw new Error('Order tidak ditemukan');if(r[0].workflow_status!=='LAYOUT_TERSEDIA')throw new Error('Order belum memiliki layout final yang tersimpan');await conn.execute("UPDATE orders SET workflow_status='MENUNGGU_VALIDASI_KASIR',setting_note=? WHERE id=?",[note,r[0].id]);await audit(conn,r[0].id,r[0].workflow_status,'MENUNGGU_VALIDASI_KASIR','setting',by,note);await notify(conn,r[0].id,'KASIR','ORDER_TRANSFERRED','Order baru untuk Kasir',`${req.params.orderNumber} sudah ditransfer Team Setting beserta file layout final.`);await conn.commit();json(res,200,{order_id:req.params.orderNumber,workflow_status:'MENUNGGU_VALIDASI_KASIR'});}catch(e){await conn.rollback();json(res,400,{error:e.message});}finally{conn.release();}
}));
app.post('/api/dashboard/orders/:orderNumber/cashier-decision', admin, dbRequired, wrap(async (req,res) => {
  const p=req.body||{},action=String(p.action||'').toLowerCase(),by=actor(p.actor_name,'Nama Kasir'),note=String(p.note||'').slice(0,5000);if(!['accept','reject'].includes(action))return json(res,400,{error:'Aksi Kasir harus accept atau reject'});if(action==='reject'&&!note.trim())return json(res,400,{error:'Alasan penolakan Kasir wajib diisi'});const conn=await pool.getConnection();
  try{await conn.beginTransaction();const [orders]=await conn.execute('SELECT id,workflow_status FROM orders WHERE order_number=? FOR UPDATE',[req.params.orderNumber]);if(!orders.length||orders[0].workflow_status!=='MENUNGGU_VALIDASI_KASIR')throw new Error('Order belum berada di antrean Kasir');const o=orders[0];let target=action==='accept'?'DITERIMA_KASIR':'PERLU_PERBAIKAN_SETTING';await conn.execute('UPDATE orders SET workflow_status=?,cashier_note=? WHERE id=?',[target,note,o.id]);if(action==='accept'){const [items]=await conn.execute('SELECT material FROM order_items WHERE order_id=? ORDER BY id LIMIT 1',[o.id]);const category=productionCategory(items[0]?.material||'');await conn.execute("INSERT INTO production_jobs (order_id,production_category,status) VALUES (?,?, 'queued') ON DUPLICATE KEY UPDATE production_category=VALUES(production_category),status=VALUES(status)",[o.id,category]);await conn.execute("UPDATE orders SET workflow_status='MENUNGGU_OPERATOR' WHERE id=?",[o.id]);target='MENUNGGU_OPERATOR';await notify(conn,o.id,'DASHBOARD','CASHIER_ACCEPTED','Order diterima Kasir',`${req.params.orderNumber} diterima Kasir dan siap diteruskan ke produksi.`);await notify(conn,o.id,'OPERATOR','PRODUCTION_ASSIGNED','Order masuk antrean produksi',`${req.params.orderNumber} siap diproses Operator ${category}.`);}else await notify(conn,o.id,'SETTING','CASHIER_REJECTED','Order ditolak Kasir',`${req.params.orderNumber} perlu diperbaiki: ${note}`);await audit(conn,o.id,o.workflow_status,target,'cashier',by,note);await conn.commit();json(res,200,{order_id:req.params.orderNumber,workflow_status:target,note});}catch(e){await conn.rollback();json(res,400,{error:e.message||'Keputusan Kasir tidak dapat disimpan.'});}finally{conn.release();}
}));
app.post('/api/operator/production/:orderNumber/start', admin, dbRequired, wrap(async (req,res) => {
  const conn=await pool.getConnection(),by=actor(req.body?.operator_name,'Nama Operator'),note=String(req.body?.note||'').slice(0,5000);try{await conn.beginTransaction();const [r]=await conn.execute('SELECT p.id,p.status,o.id order_id,o.workflow_status FROM production_jobs p JOIN orders o ON o.id=p.order_id WHERE o.order_number=? FOR UPDATE',[req.params.orderNumber]);if(!r.length||!['queued','blocked'].includes(r[0].status))throw new Error('Order belum masuk antrean produksi atau tidak dapat dimulai dari status ini');await conn.execute("UPDATE production_jobs SET status='in_progress',operator_name=?,started_at=COALESCE(started_at,CURRENT_TIMESTAMP),notes=? WHERE id=?",[by,note,r[0].id]);await conn.execute("UPDATE orders SET workflow_status='SEDANG_DIPRODUKSI',status='processing' WHERE id=?",[r[0].order_id]);await audit(conn,r[0].order_id,r[0].workflow_status,'SEDANG_DIPRODUKSI','operator',by,note);await notify(conn,r[0].order_id,'DASHBOARD','PRODUCTION_STARTED','Produksi dimulai',`${req.params.orderNumber} sedang dikerjakan oleh ${by}.`);await conn.commit();json(res,200,{order_id:req.params.orderNumber,workflow_status:'SEDANG_DIPRODUKSI',status:'in_progress'});}catch(e){await conn.rollback();json(res,400,{error:e.message||'Produksi tidak dapat dimulai.'});}finally{conn.release();}
}));
const usageTypes=['good','machine_reject','operator_error','other_reprint'];
function usageAmounts(components){const result={};for(const type of usageTypes){const n=Number(components?.[type]||0);if(!Number.isFinite(n)||n<0)throw new Error('Jumlah pemakaian bahan harus valid');result[type]=n;}return result;}
async function consumeStock(conn,{stockId,amounts,group,channel,operator,reference,note,jobId=null}){
  const total=Object.values(amounts).reduce((a,b)=>a+b,0);if(!Number.isInteger(Number(stockId))||Number(stockId)<=0||total<=0)throw new Error('Bahan dan minimal satu jumlah pemakaian wajib diisi');
  const [rows]=await conn.execute('SELECT id,name,unit,quantity FROM stock_items WHERE id=? AND active=1 FOR UPDATE',[Number(stockId)]);if(!rows.length)throw new Error('Bahan stok tidak ditemukan');const stock=rows[0];if(Number(stock.quantity)<total)throw new Error(`Stok ${stock.name} tidak mencukupi`);const balance=Number(stock.quantity)-total;
  await conn.execute('UPDATE stock_items SET quantity=? WHERE id=?',[balance,stock.id]);const [movement]=await conn.execute("INSERT INTO stock_movements (item_id,category,movement_type,quantity,balance_after,reference,note) VALUES (?,'PRODUKSI','out',?,?,?,?)",[stock.id,total,balance,reference||group,note||`Pemakaian produksi oleh ${operator}`]);
  for(const [type,quantity] of Object.entries(amounts))if(quantity>0)await conn.execute('INSERT INTO production_material_usage (production_job_id,stock_item_id,order_group,channel,operator_name,reference,usage_type,quantity,unit,note,stock_movement_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[jobId,stock.id,group,channel||'Internal',operator,reference||'',type,quantity,stock.unit,note||'',movement.insertId]);return {name:stock.name,total,unit:stock.unit,balance_after:balance};
}
app.post('/api/operator/production-usage', admin, dbRequired, wrap(async (req,res) => {
  const p=req.body||{},group=String(p.order_group||'').toLowerCase().trim(),channel=String(p.channel||(group==='internal'?'Internal':'Fazima')).slice(0,60),by=actor(p.operator_name,'Nama Operator'),reference=String(p.reference||'').slice(0,120),note=String(p.note||'').slice(0,500);if(!['offline','online','internal'].includes(group))return json(res,400,{error:'Kelompok pesanan tidak valid'});if(group==='online'&&!channel)return json(res,400,{error:'Pilih kanal online'});let amounts;try{amounts=usageAmounts(p.components||{});}catch(e){return json(res,400,{error:e.message});}
  const conn=await pool.getConnection();try{await conn.beginTransaction();const material=await consumeStock(conn,{stockId:p.stock_item_id,amounts,group,channel,operator:by,reference,note});await conn.commit();json(res,201,{ok:true,material:material.name,total_consumption:material.total,unit:material.unit,balance_after:material.balance_after});}catch(e){await conn.rollback();json(res,400,{error:e.message||'Pencatatan pemakaian bahan gagal disimpan.'});}finally{conn.release();}
}));
app.post('/api/operator/production/:orderNumber/complete', admin, dbRequired, wrap(async (req,res) => {
  const p=req.body||{},by=actor(p.operator_name,'Nama Operator'),note=String(p.note||'').slice(0,5000),materials=p.materials;if(!Array.isArray(materials)||!materials.length)return json(res,400,{error:'Minimal satu bahan yang digunakan wajib dicatat'});const conn=await pool.getConnection();
  try{await conn.beginTransaction();const [rows]=await conn.execute('SELECT p.id,p.status,o.id order_id,o.workflow_status,o.source FROM production_jobs p JOIN orders o ON o.id=p.order_id WHERE o.order_number=? FOR UPDATE',[req.params.orderNumber]);if(!rows.length||rows[0].status!=='in_progress')throw new Error('Order belum berstatus sedang diproduksi');const job=rows[0],group=['OFFLINE','CASHIER'].includes(String(job.source).toUpperCase())?'offline':'online',channel=['WEB','FAZIMA'].includes(String(job.source).toUpperCase())?'Fazima':String(job.source).toLowerCase().replace(/^./,c=>c.toUpperCase());const aggregated=new Map();
   for(const item of materials){const id=Number(item?.stock_item_id),amounts=usageAmounts(item?.components||{good:item?.quantity||0});if(!Number.isInteger(id)||id<=0||Object.values(amounts).reduce((a,b)=>a+b,0)<=0)throw new Error('Jumlah pemakaian bahan harus valid');const record=aggregated.get(id)||{amounts:Object.fromEntries(usageTypes.map(t=>[t,0])),notes:[]};for(const type of usageTypes)record.amounts[type]+=amounts[type];if(item.note)record.notes.push(String(item.note).slice(0,500));aggregated.set(id,record);}
   const consumed=[];for(const [stockId,data] of aggregated)consumed.push(await consumeStock(conn,{stockId,amounts:data.amounts,group,channel,operator:by,reference:req.params.orderNumber,note:data.notes.join('; ').slice(0,500),jobId:job.id}));
   await conn.execute("UPDATE production_jobs SET status='completed',operator_name=?,completed_at=CURRENT_TIMESTAMP,notes=? WHERE id=?",[by,note,job.id]);await conn.execute("UPDATE orders SET workflow_status='SELESAI_PRODUKSI',status='ready' WHERE id=?",[job.order_id]);await audit(conn,job.order_id,job.workflow_status,'SELESAI_PRODUKSI','operator',by,note);await notify(conn,job.order_id,'DASHBOARD','PRODUCTION_COMPLETED','Produksi selesai',`${req.params.orderNumber} selesai diproduksi dan stok telah dimutasi.`);await conn.commit();json(res,200,{order_id:req.params.orderNumber,workflow_status:'SELESAI_PRODUKSI',status:'completed',materials_used:consumed.length,total_consumption:consumed.reduce((n,x)=>n+x.total,0)});
  }catch(e){await conn.rollback();json(res,400,{error:e.message||'Produksi tidak dapat diselesaikan.'});}finally{conn.release();}
}));

const promoDefaults={enabled:true,mode:'one_time',duration_seconds:28800,reset_threshold_seconds:14400,random_min_seconds:14400,random_max_seconds:43200,end_action:'hide_box'};
const getPromoSettings=wrap(async (_req,res) => {
  const conn=await pool.getConnection();try{await conn.beginTransaction();const [rows]=await conn.execute('SELECT * FROM promo_timer_settings WHERE id=1 FOR UPDATE');if(!rows.length){await conn.commit();const now=new Date();return json(res,200,{...promoDefaults,visible:true,started_at:now.toISOString(),ends_at:new Date(now.getTime()+28800000).toISOString(),generated_duration_seconds:28800,persisted:false});}
   const r=rows[0],now=new Date(),ends=r.ends_at?new Date(r.ends_at):null;let enabled=Boolean(r.enabled),reset=false,duration=Number(r.duration_seconds)||28800;
   if(r.mode==='random_loop'){const min=Math.max(60,Number(r.random_min_seconds)||14400),max=Math.max(min,Number(r.random_max_seconds)||43200);duration=Math.floor(Math.random()*(max-min+1))+min;}else duration=Math.max(60,duration);
   if(enabled&&['fixed_loop','random_loop'].includes(r.mode)&&ends&&(ends.getTime()-now.getTime())/1000<=Math.max(0,Number(r.reset_threshold_seconds)||0))reset=true;else if(enabled&&ends&&ends<=now&&r.mode==='one_time'){if(r.end_action==='reset_timer')reset=true;else{enabled=false;await conn.execute('UPDATE promo_timer_settings SET enabled=0,updated_at=CURRENT_TIMESTAMP WHERE id=1');if(r.end_action==='deactivate_promos')await conn.execute('UPDATE promotions SET is_active=0');}}
   let started=r.started_at?new Date(r.started_at):now;if(reset){if(r.mode==='random_loop')duration=Math.floor(Math.random()*(Math.max(Number(r.random_min_seconds)||14400,Number(r.random_max_seconds)||43200)-Math.max(60,Number(r.random_min_seconds)||14400)+1))+Math.max(60,Number(r.random_min_seconds)||14400);ends=new Date(now.getTime()+duration*1000);started=now;await conn.execute('UPDATE promo_timer_settings SET started_at=?,ends_at=?,generated_duration_seconds=?,updated_at=CURRENT_TIMESTAMP WHERE id=1',[started,ends,duration]);}
   await conn.commit();const visible=enabled&&Boolean(ends)&&ends>now;json(res,200,{...promoDefaults,...r,enabled,visible,persisted:true,started_at:started?.toISOString()||null,ends_at:ends?.toISOString()||null,duration_seconds:Number(r.duration_seconds),reset_threshold_seconds:Number(r.reset_threshold_seconds),random_min_seconds:Number(r.random_min_seconds),random_max_seconds:Number(r.random_max_seconds),generated_duration_seconds:Number(reset?duration:r.generated_duration_seconds)||null});
  }catch(e){await conn.rollback();if(e.code==='ER_NO_SUCH_TABLE')return json(res,200,{...promoDefaults,visible:true,persisted:false});throw e;}finally{conn.release();}
});
app.get(['/api/admin/promo-settings','/api/promo-settings'], dbRequired, getPromoSettings);
const defaultSlides=[
  {image:'assets/real/gallery/hero-4cbf29e1768892df6fa6da5a.png',alt:'layout website (1600 x 700 piksel) (2)'},
  {image:'assets/real/gallery/hero-ecca5ea407f7e933d8525638.png',alt:'layout website (1600 x 700 piksel) (1)'},
  {image:'assets/real/gallery/hero-a81a5479e415d574c8c2e7ac.png',alt:'layout website (1600 x 700 piksel)'},
];
app.get(['/api/hero-images','/api/admin/hero-images'], wrap(async (_req,res) => {
  try { const saved=JSON.parse(await fs.readFile(path.join(contentDir,'hero_images.json'),'utf8')); const slides=saved.slides; if(Array.isArray(slides)&&slides.length&&slides.every(s=>s&&typeof s.image==='string'&&['assets/real/gallery/','assets/real/products/','assets/hero/'].some(prefix=>s.image.startsWith(prefix))&&!s.image.split('/').includes('..')))return json(res,200,{slides}); } catch {}
  json(res,200,{slides:defaultSlides});
}));
app.get(['/api/category-box-visuals','/api/admin/category-box-visuals'], dbRequired, wrap(async (_req,res) => {
  let categories; try { [categories]=await q('SELECT slug,name FROM product_categories WHERE is_active=1 ORDER BY sort_order,name'); }
  catch(e) { if(e.code!=='ER_NO_SUCH_TABLE')throw e; [categories]=await q('SELECT category slug,category name FROM products GROUP BY category ORDER BY category'); }
  let saved={}; try { saved=JSON.parse(await fs.readFile(path.join(contentDir,'category_box_visuals.json'),'utf8')).categories||{}; } catch {}
  const items=categories.map(c=>{const v=saved[c.slug]||{},defaultImage=c.slug.toLowerCase()==='outdoor'?'assets/real/products/banner.jpg':'assets/real/gallery/gallery-2.jpeg',image=String(v.image||defaultImage); return {slug:c.slug,name:c.name,image:(image.startsWith('assets/real/gallery/')||image.startsWith('assets/real/products/'))&&!image.split('/').includes('..')?image:defaultImage,shadow:v.shadow!==false};}); json(res,200,{items});
}));
app.get('/api/location/reverse', wrap(async (req,res) => {
  const lat=Number(req.query.lat),lon=Number(req.query.lon); if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return json(res,400,{error:'Koordinat lokasi tidak valid.'});
  try { const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&namedetails=1`,{headers:{'user-agent':'FazimaPrintCustomer/1.0 (reverse geocoding)'}}); if(!r.ok)return json(res,502,{error:'Alamat lokasi belum dapat ditemukan. Koordinat tetap bisa disimpan.'}); const d=await r.json(); json(res,200,{display_name:d.display_name||'',name:d.namedetails?.name||d.name||'',address:d.address||{}}); } catch { json(res,502,{error:'Alamat lokasi belum dapat ditemukan. Koordinat tetap bisa disimpan.'}); }
}));

function parseArea(unit,size,name) {
  if(!['m2','m^2','m²'].includes(String(unit||'').trim().toLowerCase())) return 1;
  const presets={A4:.21*.297,A3:.297*.42,A2:.42*.594}; if(presets[String(size).toUpperCase()]) return presets[String(size).toUpperCase()];
  const m=String(size).match(/^\s*([\d.,]+)\s*[x×]\s*([\d.,]+)\s*(mm|cm|m)?\s*$/i); if(!m) throw new Error(`Ukuran produk ${name} tidak valid`);
  const factor=({m:1,cm:.01,mm:.001}[String(m[3]||'cm').toLowerCase()]||.01); const area=Number(m[1].replace(',','.'))*Number(m[2].replace(',','.'))*factor*factor;
  if(!Number.isFinite(area)||area<=0) throw new Error(`Ukuran produk ${name} tidak valid`); return area;
}
app.post('/api/orders', dbRequired, wrap(async (req,res) => {
  const p=req.body||{}, items=p.items;
  if(!Array.isArray(items)||items.length<1||items.length>50) return json(res,400,{error:'Item order tidak valid'});
  const names=[...new Set(items.map(x=>String(x?.product||'').trim()).filter(Boolean))]; if(names.length!==new Set(items.map(x=>String(x?.product||'').trim())).size||!names.length) return json(res,400,{error:'Produk order tidak valid'});
  const delivery=p.delivery==='delivery'; const latitude=p.latitude===''||p.latitude==null?null:Number(p.latitude), longitude=p.longitude===''||p.longitude==null?null:Number(p.longitude);
  if((latitude===null)!==(longitude===null)) return json(res,400,{error:'Koordinat lokasi tidak valid'});
  if(latitude!==null&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)) return json(res,400,{error:'Koordinat lokasi tidak valid'});
  const locationLabel=String(p.location_label||'').trim(), addressDetail=String(p.address_detail||'').trim();
  if(delivery&&latitude===null&&!locationLabel&&!addressDetail) return json(res,400,{error:'Masukkan detail alamat pengantaran atau gunakan lokasi saat ini'});
  const weight=Number(process.env.SHIPPING_ESTIMATED_WEIGHT_GRAMS||1000);let shipping={cost:0,courier:'',service:'',weight:0};
  if(delivery&&p.shipping_mode==='gosend') shipping={cost:0,courier:'gosend',service:'COD',weight:0};
  else if(delivery) {
    const s=p.shipping_selection||{}; const dest=Number(s.destination_id), courier=String(s.courier||'').toLowerCase(), service=String(s.service||'');
    if(!Number.isInteger(dest)||dest<1||!['jne','jnt'].includes(courier)||!service) return json(res,400,{error:'Pilih layanan JNE atau J&T untuk melihat total estimasi pengiriman.'});
    if(!keys.length||!process.env.RAJAONGKIR_ORIGIN_ID) return json(res,503,{error:'Estimasi ongkir belum aktif. Lengkapi konfigurasi API ongkir di server.'});
    try { const result=await raja('calculate/domestic-cost',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({origin:process.env.RAJAONGKIR_ORIGIN_ID,destination:String(dest),weight:String(weight),courier})}); if(!result.ok)return json(res,400,{error:'Tarif berubah atau tidak tersedia. Pilih ulang layanan pengiriman.'}); const rate=(result.body.data||[]).find(x=>x.service===service&&Number.isFinite(Number(x.cost))); if(!rate) return json(res,400,{error:'Layanan berubah. Muat ulang estimasi dan pilih layanan yang tersedia.'}); shipping={cost:Number(rate.cost),courier,service,weight}; }
    catch { return json(res,503,{error:'Tarif ongkir belum dapat diverifikasi. Coba lagi.'}); }
  }
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    const placeholders=names.map(()=>'?').join(',');
    const [products]=await connection.execute(`SELECT p.id,p.name,p.unit,p.base_price,pr.id promo_id,pr.promo_price FROM products p LEFT JOIN promotions pr ON pr.product_id=p.id AND pr.is_active=1 AND (pr.starts_at IS NULL OR pr.starts_at<=UTC_TIMESTAMP()) AND (pr.ends_at IS NULL OR pr.ends_at>=UTC_TIMESTAMP()) WHERE p.is_active=1 AND p.name IN (${placeholders})`,names);
    const byName=new Map(products.map(x=>[x.name,x])); if(byName.size!==names.length) throw new Error('Ada produk order yang sudah tidak aktif');
    const orderNumber=String(p.order_id||`FZ-${Date.now()}`).trim(); if(!/^[A-Za-z0-9_.~-]{1,50}$/.test(orderNumber)) throw new Error('Order ID tidak valid');
    let subtotal=0,grand=0; const lines=[];
    for(const item of items) { const product=byName.get(String(item.product).trim()), quantity=Number(item.quantity??1); if(!Number.isInteger(quantity)||quantity<1||quantity>1000) throw new Error('Jumlah order tidak valid'); const area=parseArea(product.unit,String(item.size||''),product.name); const original=Number(product.base_price),price=product.promo_id?Number(product.promo_price):original,total=price*quantity*area; subtotal+=original*quantity*area; grand+=total; lines.push({item,product,quantity,original,price:price*area,total}); }
    grand+=shipping.cost;
    const noteParts=[String(p.notes||'').trim(),...items.map(i=>String(i.note||'').trim()).filter(Boolean)];
    if(shipping.courier==='gosend') noteParts.push('GoSend dipilih; ongkir ditanggung customer dan dibayar kepada driver dengan COD.'); else if(shipping.cost) noteParts.push(`Estimasi ongkir ${shipping.courier.toUpperCase()} ${shipping.service}: Rp ${shipping.cost} (${shipping.weight} gram).`);
    const address=delivery?[locationLabel||(latitude!==null?`Koordinat ${latitude}, ${longitude}`:''),addressDetail].filter(Boolean).join('\n'):'';
    const [insert]=await connection.execute(`INSERT INTO orders (order_number,source,customer_name,customer_phone,delivery_method,shipping_courier,address,location_label,address_detail,latitude,longitude,subtotal,discount_total,grand_total,status,workflow_status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[orderNumber,'WEB',String(p.customer||'').slice(0,120),String(p.phone||'').slice(0,40),delivery?'delivery':'pickup',shipping.courier?`${shipping.courier.toUpperCase()} ${shipping.service}`.slice(0,16):null,address||null,delivery?locationLabel.slice(0,3000):null,delivery?addressDetail.slice(0,2000):null,latitude,longitude,subtotal,subtotal+shipping.cost-grand,grand,'pending_payment','MENUNGGU_VALIDASI_SETTING',noteParts.filter(Boolean).join('\n').slice(0,5000)||null]);
    await connection.execute('INSERT INTO order_status_history (order_id,from_status,to_status,actor_role,actor_name,note) VALUES (?,NULL,?,?,?,?)',[insert.insertId,'MENUNGGU_VALIDASI_SETTING','system','website','Order WEB masuk otomatis ke antrean Team Setting']);
    await connection.execute('INSERT INTO dashboard_notifications (order_id,target_team,notification_type,title,message) VALUES (?,?,?,?,?),(?,?,?,?,?)',[insert.insertId,'SETTING','WEB_ORDER_CREATED','Order WEB baru',`${orderNumber} masuk otomatis ke antrean Team Setting.`,insert.insertId,'KASIR','WEB_ORDER_CREATED','Order web baru',`${orderNumber} dari ${String(p.customer||'Customer')} baru saja checkout.`]);
    for(const line of lines) await connection.execute('INSERT INTO order_items (order_id,product_id,product_name,size_label,material,quantity,unit_price,original_unit_price,promo_id,finishing,design_file,layout_token,item_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[insert.insertId,line.product.id,line.product.name,String(line.item.size||'').slice(0,80),String(line.item.material||'').slice(0,80),line.quantity,line.price,line.original,line.product.promo_id,String(line.item.finish||'').slice(0,80),String(line.item.file||'').slice(0,255),String(line.item.id||'').slice(0,32)||null,line.total]);
    await connection.commit(); json(res,201,{id:insert.insertId,order_id:orderNumber,subtotal,discount_total:subtotal+shipping.cost-grand,shipping_cost:shipping.cost,shipping_courier:shipping.courier?`${shipping.courier.toUpperCase()} ${shipping.service}`:null,grand_total:grand,status:'pending_payment'});
  } catch(e) { await connection.rollback(); json(res,400,{error:e.message||'Order tidak dapat disimpan.'}); }
  finally { connection.release(); }
}));

function midtransBase(api=false) { const production=process.env.MIDTRANS_IS_PRODUCTION==='true'; return production?'https://api.midtrans.com':`https://${api?'api.':'app.'}sandbox.midtrans.com`; }
app.post('/api/payments/snap-token', wrap(async (req,res) => {
  const serverKey=process.env.MIDTRANS_SERVER_KEY||'', clientKey=process.env.MIDTRANS_CLIENT_KEY||process.env.MIDTRANS_API_KEY||''; if(!serverKey||!clientKey) return json(res,503,{error:'Midtrans belum dikonfigurasi. Set MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY (atau MIDTRANS_API_KEY) di backend.'});
  const p=req.body||{}, amount=Number(p.gross_amount), items=p.item_details;
  if(!/^[A-Za-z0-9_.~-]{1,50}$/.test(String(p.order_id||''))||!Number.isInteger(amount)||amount<1000||amount>100000000||!Array.isArray(items)||!items.length||items.length>50) return json(res,400,{error:'order_id atau gross_amount tidak valid'});
  const sum=items.reduce((n,i)=>n+Number(i.price)*Number(i.quantity),0); if(sum!==amount||items.some(i=>!i.id||!i.name||!Number.isInteger(Number(i.price))||!Number.isInteger(Number(i.quantity))||Number(i.price)<=0||Number(i.quantity)<1||Number(i.quantity)>100)) return json(res,400,{error:'Detail item tidak valid'});
  const production=process.env.MIDTRANS_IS_PRODUCTION==='true'; let finish=process.env.MIDTRANS_FINISH_URL||''; if(!finish||/localhost|127\.0\.0\.1/.test(finish)) finish=`${req.protocol}://${req.get('host')}/order-history.html`;
  const enabled=(process.env.MIDTRANS_ENABLED_PAYMENTS||'credit_card,dana,other_qris,bca_va,bri_va,bni_va,permata_va,echannel,cimb_va,indomaret,alfamart').split(',').map(x=>x.trim()).filter(Boolean);
  try { const r=await fetch(`${midtransBase()}/snap/v1/transactions`,{method:'POST',headers:{authorization:`Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({transaction_details:{order_id:p.order_id,gross_amount:amount},item_details:items,customer_details:p.customer_details||{},enabled_payments:enabled,callbacks:{finish}})}); const body=await r.json(); if(!r.ok)return json(res,502,{error:`Midtrans menolak transaksi: ${JSON.stringify(body).slice(0,450)}`}); json(res,201,{order_id:p.order_id,token:body.token||null,redirect_url:body.redirect_url||null,finish_url:finish,client_key:clientKey,snap_js:`https://app${production?'':'.sandbox'}.midtrans.com/snap/snap.js`}); }
  catch { json(res,502,{error:'Midtrans tidak dapat dihubungi.'}); }
}));
async function savePayment(data) {
  const orderId=String(data.order_id||''); const status=String(data.transaction_status||'pending'); const fraud=String(data.fraud_status||'')||null;
  const mapped=({settlement:'paid',capture:'paid',pending:'pending_payment',expire:'cancelled',cancel:'cancelled',deny:'cancelled',failure:'cancelled'})[status]||'pending_payment';
  const [orders]=await q('SELECT id FROM orders WHERE order_number=?',[orderId]); if(!orders.length) throw new Error('Order pembayaran tidak ditemukan');
  await q(`INSERT INTO payments (order_id,provider,provider_order_id,transaction_status,fraud_status,gross_amount,raw_payload) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE order_id=VALUES(order_id),transaction_status=VALUES(transaction_status),fraud_status=VALUES(fraud_status),gross_amount=VALUES(gross_amount),raw_payload=VALUES(raw_payload),updated_at=CURRENT_TIMESTAMP`,[orders[0].id,'midtrans',orderId,status,fraud,Number(data.gross_amount||0),JSON.stringify(data)]);
  await q('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[mapped,orders[0].id]);
}
app.get('/api/payments/status/:orderId', wrap(async (req,res) => {
  const key=process.env.MIDTRANS_SERVER_KEY||''; if(!key)return json(res,503,{error:'MIDTRANS_SERVER_KEY belum dikonfigurasi'}); if(!/^[A-Za-z0-9_.~-]{1,50}$/.test(req.params.orderId))return json(res,400,{error:'Order ID pembayaran tidak valid'});
  try { const r=await fetch(`${midtransBase(true)}/v2/${encodeURIComponent(req.params.orderId)}/status`,{headers:{authorization:`Basic ${Buffer.from(`${key}:`).toString('base64')}`,accept:'application/json'}}); const data=await r.json(); if(!r.ok)return json(res,502,{error:'Status pembayaran belum dapat diperiksa.'}); if(data.transaction_status&&databaseConfigured())await savePayment(data); json(res,200,data); } catch { json(res,502,{error:'Midtrans tidak dapat dihubungi.'}); }
}));
app.post('/api/payments/notification', wrap(async (req,res) => {
  const key=process.env.MIDTRANS_SERVER_KEY||''; if(!key)return json(res,503,{error:'MIDTRANS_SERVER_KEY belum dikonfigurasi'}); const p=req.body||{};
  const expected=crypto.createHash('sha512').update(`${p.order_id||''}${p.status_code||''}${p.gross_amount||''}${key}`).digest('hex'); const supplied=Buffer.from(String(p.signature_key||'')), actual=Buffer.from(expected);
  if(supplied.length!==actual.length||!crypto.timingSafeEqual(supplied,actual))return json(res,403,{error:'Signature notification tidak valid'});
  if(!/^[A-Za-z0-9_.~-]{1,50}$/.test(String(p.order_id||'')))return json(res,400,{error:'Order ID pembayaran tidak valid'});
  if(databaseConfigured()) await savePayment(p); json(res,200,{ok:true});
}));

const keys = [...new Set([process.env.RAJAONGKIR_API_KEY,process.env.RAJAONGKIR_API_KEY_FALLBACK].filter(Boolean))];
async function raja(pathname, options = {}) {
  if(!keys.length)throw new Error('RajaOngkir is not configured');
  let primaryLimitedUntil=0;try{const saved=JSON.parse(await fs.readFile(path.join(contentDir,'rajaongkir-primary-limit.json'),'utf8'));primaryLimitedUntil=Number(saved.until)||0;}catch{}
  let order=keys.slice();if(keys.length>1&&primaryLimitedUntil>Date.now())order=[...keys.slice(1),keys[0]];else if(primaryLimitedUntil)try{await fs.unlink(path.join(contentDir,'rajaongkir-primary-limit.json'));}catch{}
  for(const key of order){
    const response=await fetch(`https://rajaongkir.komerce.id/api/v1/${pathname}`,{...options,headers:{key,...options.headers},signal:AbortSignal.timeout(12000)});
    const text=await response.text();let body={};try{body=JSON.parse(text);}catch{}
    const messages=[body.message,body.meta?.message,body.error,body.errors?.message,body.meta?.error].filter(x=>typeof x==='string').join(' ').toLowerCase();
    const limited=response.status===429||/rate[\s_-]*limit|too many requests|quota.{0,30}(?:exceed|limit|habis)|limit.{0,30}(?:exceed|reached|habis|terlampaui)|daily.{0,20}limit|limit.{0,20}harian/u.test(messages);
    if(limited&&key===keys[0]&&keys.length>1){primaryLimitedUntil=Date.now()+6*60*60*1000;try{await fs.mkdir(contentDir,{recursive:true});await fs.writeFile(path.join(contentDir,'rajaongkir-primary-limit.json'),JSON.stringify({until:primaryLimitedUntil}));}catch{}continue;}
    return {ok:response.ok,status:response.status,body};
  }
  throw new Error('RajaOngkir request failed');
}
app.get('/api/shipping/destinations', rateLimit(30,60000), wrap(async (req,res) => {
  const search=String(req.query.search||'').trim(); if(search.length<3||search.length>100) return json(res,422,{error:'Kata pencarian minimal 3 karakter.'}); if(!keys.length) return json(res,503,{error:'Estimasi ongkir belum aktif. Admin perlu mengisi RAJAONGKIR_API_KEY.'});
  try { const result=await raja(`destination/domestic-destination?search=${encodeURIComponent(search)}&limit=10&offset=0`);if(!result.ok)throw new Error('Destination search failed');const data=(result.body.data||[]).map(x=>({id:Number(x.id),label:String(x.label||''),city:String(x.city_name||''),district:String(x.district_name||''),subdistrict:String(x.subdistrict_name||''),zip_code:String(x.zip_code||'')})).filter(x=>x.id>0&&x.label); json(res,200,{data}); } catch { json(res,502,{error:'Wilayah belum dapat dicari. Coba lagi beberapa saat.'}); }
}));
app.post('/api/shipping/rates', rateLimit(15,60000), wrap(async (req,res) => {
  const destination=Number(req.body?.destination_id), origin=process.env.RAJAONGKIR_ORIGIN_ID;
  if(!Number.isInteger(destination)||destination<1) return json(res,422,{error:'Wilayah tujuan tidak valid.'}); if(!keys.length||!origin) return json(res,503,{error:'Estimasi ongkir belum aktif. Admin perlu mengisi API key dan ID wilayah asal Fazima Print.'});
  try { const data=[]; const weight=Number(process.env.SHIPPING_ESTIMATED_WEIGHT_GRAMS||1000); for(const courier of ['jne','jnt']) { try { const result=await raja('calculate/domestic-cost',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({origin,destination:String(destination),weight:String(weight),courier})});if(!result.ok)continue;for(const r of result.body.data||[]) if(Number.isFinite(Number(r.cost))) data.push({courier:String(r.name||courier.toUpperCase()),code:courier,service:String(r.service||''),description:String(r.description||''),cost:Number(r.cost),etd:String(r.etd||'')}); } catch {} } data.sort((a,b)=>a.cost-b.cost); json(res,200,{data,estimated_weight_grams:weight,message:data.length?null:'Tarif JNE/J&T tidak tersedia untuk wilayah ini.'}); } catch { json(res,502,{error:'Tarif ongkir belum dapat dimuat. Coba lagi.'}); }
}));
app.post('/api/chat', wrap(async (req,res) => {
  if(!String(req.get('content-type')||'').toLowerCase().includes('application/json'))return json(res,400,{error:'Gunakan application/json'});if(Buffer.byteLength(JSON.stringify(req.body||{}))>32000)return json(res,400,{error:'Payload chat tidak valid'});
  const key=process.env.GEMINI_API_KEY||'',p=req.body||{},message=String(p.message||'').trim();if(!key)return json(res,503,{error:'Chat AI belum dikonfigurasi. Set GEMINI_API_KEY di environment server.'});if(!message||message.length>2000)return json(res,400,{error:'Pesan harus berisi 1-2000 karakter'});
  const history=Array.isArray(p.history)?p.history.slice(-10):[],contents=[];for(const item of history){const text=String(item?.text||'').trim();if(text&&text.length<=2000)contents.push({role:item.role==='model'?'model':'user',parts:[{text}]});}contents.push({role:'user',parts:[{text:message}]});let model=process.env.GEMINI_MODEL||'gemini-3.6-flash';if(model==='gemini-2.5-flash')model='gemini-3.6-flash';
  const payload={systemInstruction:{parts:[{text:'Kamu adalah asisten customer Fazima Print di Bandung. Jawab dalam Bahasa Indonesia yang ramah, ringkas, dan jelas. Bantu menjelaskan Banner, X-Banner, Spanduk, Sticker, Poster, Kartu Nama, ukuran, finishing, upload desain, preview, keranjang, dan pengantaran. Jangan mengarang harga final, stok, status produksi, atau janji waktu. Harga yang tampil di situs adalah estimasi demo dan file akan diperiksa operator. Jika pertanyaan membutuhkan keputusan operator, arahkan customer untuk chat CS.'}]},contents,generationConfig:{temperature:0.65,maxOutputTokens:500}};
  try{const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});const data=await response.json();if(!response.ok){const status=response.status,error=status===401||status===403?'Konfigurasi Gemini API key tidak valid atau belum memiliki akses.':status===429?'Chat sedang ramai. Coba lagi beberapa saat lagi.':status===400?'Gemini menolak request. Periksa konfigurasi model atau format request.':status===404?`Model Gemini tidak ditemukan: ${model}`:status>=500?'Layanan Gemini sedang bermasalah. Coba lagi nanti.':`Gemini mengembalikan error HTTP ${status}.`;return json(res,503,{error});}const answer=(data.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('').trim();if(!answer)return json(res,503,{error:'Gemini tidak mengembalikan jawaban.'});const session=String(p.session_id||'').trim().slice(0,80);if(session&&databaseConfigured()){await q('INSERT INTO chat_messages (session_id,role,message) VALUES (?,\'user\',?),(?,\'model\',?)',[session,message.slice(0,12000),session,answer.slice(0,12000)]);}json(res,200,{answer:answer.slice(0,4000)});}catch(e){json(res,503,{error:e.name==='Error'&&e.code?'Riwayat chat tidak dapat disimpan.':'Koneksi ke Gemini gagal. Periksa internet, DNS, atau firewall server.'});}
}));
app.get('/api/chat/sessions', dbRequired, wrap(async (req,res) => {
  const [rows]=await q(`SELECT session_id,MAX(created_at) updated_at,MIN(created_at) started_at,COUNT(*) message_count,SUBSTRING_INDEX(GROUP_CONCAT(message ORDER BY created_at DESC SEPARATOR ' || '),' || ',1) latest_message FROM chat_messages GROUP BY session_id ORDER BY updated_at DESC LIMIT ${int(req.query.limit,100,500)}`);json(res,200,rows);
}));
app.get('/api/chat/sessions/:sessionId', dbRequired, wrap(async (req,res) => {
  const [rows]=await q(`SELECT session_id,role,message,created_at FROM chat_messages WHERE session_id=? ORDER BY created_at LIMIT ${int(req.query.limit,200,500)}`,[String(req.params.sessionId).slice(0,80)]);json(res,200,rows);
}));
async function saveFinalLayout(orderNumber,result,file,fields){
  if(!databaseConfigured())throw Object.assign(new Error('Database belum dikonfigurasi.'),{status:503});
  const orderDir=path.join(root,'storage','layouts',orderNumber,result.id),inputName=path.basename(String(file.originalname||'design').replaceAll('\\','/')).replace(/[^A-Za-z0-9_. -]/g,'_').slice(0,180)||'design';
  await fs.mkdir(orderDir,{recursive:true});await fs.writeFile(path.join(orderDir,inputName),file.buffer);
  const outputPath=path.join(orderDir,result.output_name);await fs.copyFile(result.outputPath,outputPath);
  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    const [orders]=await connection.execute('SELECT id,workflow_status FROM orders WHERE order_number=? FOR UPDATE',[orderNumber]);
    if(!orders.length)throw Object.assign(new Error('Order tidak ditemukan.'),{status:404});
    if(!['SIAP_AUTO_LAYOUT','PERLU_PERBAIKAN_SETTING'].includes(orders[0].workflow_status))throw Object.assign(new Error('Order belum siap diproses Auto Layout.'),{status:409});
    const actor=String(fields.actor_name||'Team Setting').trim().slice(0,120)||'Team Setting',note=String(fields.note||'').trim().slice(0,5000);
    await connection.execute("UPDATE orders SET workflow_status='LAYOUT_TERSEDIA',layout_token=?,layout_output_name=?,layout_file_path=?,layout_saved_at=NOW(),setting_note=? WHERE id=?",[result.id,result.output_name,outputPath,note,orders[0].id]);
    await connection.execute("INSERT INTO layout_jobs (order_id,token,product_name,input_file,output_file,output_name,storage_path,status,expires_at,saved_at) VALUES (?,?,?,?,?,?,?,'ready',DATE_ADD(NOW(),INTERVAL 30 DAY),NOW())",[orders[0].id,result.id,String(fields.product||'').slice(0,120),inputName,result.output_name,result.output_name,outputPath]);
    await connection.execute('INSERT INTO order_status_history (order_id,from_status,to_status,actor_role,actor_name,note) VALUES (?,?,?,?,?,?)',[orders[0].id,orders[0].workflow_status,'LAYOUT_TERSEDIA','setting',actor,note]);
    await connection.execute('INSERT INTO dashboard_notifications (order_id,target_team,notification_type,title,message) VALUES (?,\'SETTING\',\'LAYOUT_READY\',?,?)',[orders[0].id,'Layout final tersedia',`${orderNumber} siap ditinjau dan diteruskan ke Kasir.`]);
    await connection.commit();return {order_id:orderNumber,workflow_status:'LAYOUT_TERSEDIA'};
  }catch(error){await connection.rollback();await fs.rm(orderDir,{recursive:true,force:true});throw error;}finally{connection.release();}
}
app.post('/api/layouts', rateLimit(10,60000), upload.single('file'), async (req,res) => {
  try{
    const orderNumber=String(req.body.order_id||'').trim();
    if(orderNumber&&!/^[A-Za-z0-9_.~-]{1,50}$/.test(orderNumber))return json(res,400,{error:'Nomor order tidak valid.'});
    if(orderNumber&&!hasAdminAccess(req))return json(res,401,{error:'Autentikasi admin tidak valid.'});
    const result=await createLayout(req.file,req.body||{});
    if(orderNumber)result.saved_layout=await saveFinalLayout(orderNumber,result,req.file,req.body||{});
    const {folder,outputPath,...response}=result;json(res,201,response);
  }catch(error){if(error.status&&error.status>=500)console.error('Prepress save failed:',error.code||error.name);if(error.status)return json(res,error.status,{error:error.message});json(res,400,{error:error.message||'File desain tidak dapat diproses.'});}
});
app.get('/api/layouts/:token/:kind', rateLimit(60,60000), wrap(async (req,res) => {const job=await getLayoutFile(req.params.token,req.params.kind);if(!job)return json(res,404,{error:'Preview sudah kedaluwarsa atau file tidak ditemukan. Silakan proses ulang.'});res.set('Cache-Control','no-store');if(req.params.kind==='output')return res.download(job.path,job.outputName);res.type('png').sendFile(job.path);}));
app.get('/api/dashboard/orders/:orderNumber/layout', admin, dbRequired, wrap(async (req,res) => {if(!/^[A-Za-z0-9_.~-]{1,50}$/.test(req.params.orderNumber))return json(res,400,{error:'Nomor order tidak valid.'});const [rows]=await q('SELECT layout_file_path,layout_output_name FROM orders WHERE order_number=? LIMIT 1',[req.params.orderNumber]);if(!rows.length||!rows[0].layout_file_path)return json(res,404,{error:'Layout final belum tersedia.'});const storageRoot=path.resolve(root,'storage','layouts')+path.sep,filePath=path.resolve(rows[0].layout_file_path);if(!filePath.startsWith(storageRoot))return json(res,404,{error:'File layout tidak ditemukan.'});try{await fs.access(filePath);}catch{return json(res,404,{error:'File layout tidak ditemukan.'});}res.download(filePath,path.basename(rows[0].layout_output_name||filePath));}));

app.use('/api', (_req,res) => json(res,404,{error:'Endpoint API tidak ditemukan pada implementasi Node.js.'}));
app.use(express.static(publicDir,{
  extensions:['html'],
  index:'index.html',
  maxAge:process.env.NODE_ENV==='production'?'1h':0,
  setHeaders(res,filePath){
    const extension=path.extname(filePath);
    if(extension==='.html'){
      res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('CDN-Cache-Control','no-store');
      return;
    }
    if(['.js','.mjs','.css'].includes(extension)){
      const versioned=new URL(res.req.originalUrl,'http://localhost').searchParams.has('v');
      res.setHeader('Cache-Control',versioned?'public, max-age=31536000, immutable':'public, max-age=300, must-revalidate');
      res.removeHeader('CDN-Cache-Control');
    }
  }
}));
app.use((error,req,res,next) => {
  if(res.headersSent)return next(error);
  if(error instanceof multer.MulterError)return json(res,error.code==='LIMIT_FILE_SIZE'?413:400,{error:error.code==='LIMIT_FILE_SIZE'?'Ukuran file melebihi batas 50 MB':'File upload tidak valid.'});
  if(error instanceof SyntaxError&&'body' in error)return json(res,400,{error:'Format JSON tidak valid.'});
  console.error('Unhandled request error:',req.method,req.path,error.code||error.name);json(res,500,{error:'Terjadi kesalahan pada server.'});
});
app.use((_req,res) => {
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('CDN-Cache-Control','no-store');
  res.sendFile(path.join(publicDir,'index.html'));
});
app.listen(port, '0.0.0.0', () => console.log(`Fazima customer Node listening on ${port}`));
