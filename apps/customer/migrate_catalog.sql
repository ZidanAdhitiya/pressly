-- Run once as a database administrator in fazima_print_customer.
-- The application user intentionally does not receive ALTER/CREATE privileges.
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT NULL;

CREATE TABLE IF NOT EXISTS product_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id), UNIQUE KEY uq_product_categories_slug (slug), UNIQUE KEY uq_product_categories_name (name)
) ENGINE=InnoDB;

INSERT INTO product_categories (slug, name, sort_order) VALUES
  ('outdoor', 'Outdoor', 10), ('indoor', 'Indoor', 20), ('a3', 'A3', 30)
ON DUPLICATE KEY UPDATE name=VALUES(name), sort_order=VALUES(sort_order), is_active=1;

UPDATE products SET category = CASE
  WHEN name IN ('Spanduk Banner','Flexi China 260gsm','Flexi China 280gsm','Flexi China 440gsm','Mini Banner','Roll Up Banner','Tripod Banner','X/Y Banner','Banner','X-Banner','Spanduk') THEN 'outdoor'
  WHEN name IN ('Cetak Sertifikat','Stiker Chromo A3+','Cetak Flyer/Brosur','Cetak Kertas Kado','ID Card','Stiker Transparan A3','Stiker Vinyl A3+','Art Paper 120gsm','Art Paper 150gsm','Art Paper 210gsm','Art Paper 260gsm','Art Paper 310gsm','Poster','Kartu Nama') THEN 'a3'
  ELSE 'indoor'
END;

UPDATE product_categories SET is_active=0 WHERE slug IN ('biru','kuning');

UPDATE products SET description = CASE name
  WHEN 'Cetak Sertifikat' THEN 'Cetak sertifikat yang rapi dan tajam untuk sekolah, kantor, acara, dan penghargaan.'
  WHEN 'Stiker Chromo A3+' THEN 'Stiker chromo dengan warna kuat untuk label, kemasan, dan kebutuhan promosi.'
  WHEN 'Cetak Flyer/Brosur' THEN 'Flyer dan brosur dengan detail teks yang jelas untuk promosi bisnis dan event.'
  WHEN 'Spanduk Banner' THEN 'Spanduk banner dengan pilihan bahan untuk kebutuhan promosi outdoor.'
  WHEN 'Canvas Custom' THEN 'Cetak foto atau artwork di canvas untuk dekorasi ruang dan hadiah personal.'
  WHEN 'Flexi China 260gsm' THEN 'Media flexi ekonomis untuk banner dan spanduk dengan warna yang tetap terlihat dari jauh.'
  WHEN 'Flexi China 280gsm' THEN 'Flexi 280gsm yang lebih solid untuk banner promosi dan signage outdoor.'
  WHEN 'Cetak Kertas Kado' THEN 'Kertas kado custom dengan desain pilihanmu untuk kebutuhan personal dan bisnis.'
  WHEN 'Flexi China 440gsm' THEN 'Flexi tebal untuk spanduk outdoor yang membutuhkan material lebih kokoh.'
  WHEN 'Gantungan Kunci' THEN 'Gantungan kunci custom sebagai merchandise acara, komunitas, dan brand.'
  WHEN 'ID Card' THEN 'ID card custom untuk identitas acara, sekolah, kantor, dan komunitas.'
  WHEN 'Mini Banner' THEN 'Mini banner praktis untuk meja, booth, kasir, dan display promosi.'
  WHEN 'Mug Custom' THEN 'Mug custom dengan desain pilihanmu untuk hadiah atau merchandise brand.'
  WHEN 'Roll Up Banner' THEN 'Roll up banner siap pakai untuk booth, presentasi, dan kebutuhan promosi indoor.'
  WHEN 'Stiker Meteran' THEN 'Stiker meteran custom untuk branding kendaraan, etalase, dan permukaan luas.'
  WHEN 'Stiker One Way' THEN 'Stiker one way untuk kaca dengan tampilan promosi yang tetap nyaman dilihat dari dalam.'
  WHEN 'Stiker Transparan A3' THEN 'Stiker transparan untuk label dan branding dengan tampilan bersih.'
  WHEN 'Stiker Vinyl A3+' THEN 'Stiker vinyl tahan lama untuk label, merchandise, dan kebutuhan branding.'
  WHEN 'X/Y Banner' THEN 'X/Y banner portable untuk event, booth, presentasi, dan promosi luar ruang.'
  WHEN 'Art Paper 120gsm' THEN 'Art paper ringan untuk flyer, sertifikat, dan kebutuhan cetak sehari-hari.'
  WHEN 'Art Paper 210gsm' THEN 'Art paper dengan hasil warna lebih solid untuk materi promosi dan kartu.'
  WHEN 'Art Paper 150gsm' THEN 'Art paper serbaguna untuk flyer, brosur, dan materi komunikasi brand.'
  WHEN 'Art Paper 260gsm' THEN 'Art paper tebal untuk kartu, cover, dan cetakan premium.'
  WHEN 'Art Paper 310gsm' THEN 'Art paper premium dengan hasil kokoh untuk kebutuhan kartu dan display kertas.'
  WHEN 'Tripod Banner' THEN 'Tripod banner yang mudah dipasang untuk acara, booth, dan display promosi.'
  ELSE description END
WHERE description IS NULL OR description='';
