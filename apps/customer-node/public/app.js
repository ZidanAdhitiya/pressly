const $ = (selector) => document.querySelector(selector);
const page = document.body.dataset.page;

const languageKey = 'fazima-print-language';
const languageDictionary = {
  'Beranda':'Home','Produk':'Products','Kategori':'Categories','Promo':'Promos','Cara Pesan':'How to order','Riwayat Order':'Order history','Tentang Kami':'About us','Tentang':'About','Keranjang':'Cart',
  'ONLINE PRINTING PLATFORM':'ONLINE PRINTING PLATFORM','Cetak apa':'Print what','hari ini?':'today?','Cari produk':'Search products','Jelajahi produk':'Explore products',
  'KATEGORI PRODUK':'PRODUCT CATEGORIES','Pilih kebutuhan':'Choose your','cetakmu.':'printing needs.','Mulai dari promosi bisnis sampai kebutuhan personal.':'From business promotions to personal projects.',
  'Outdoor':'Outdoor','Indoor':'Indoor','A3':'A3','AREA LUAR':'OUTDOOR AREA','AREA DALAM':'INDOOR AREA','FORMAT KERTAS':'PAPER FORMAT','PILIH JENIS CETAK':'CHOOSE PRINT TYPE','Mulai dari':'Start with','kebutuhanmu.':'your needs.','Pilih area penggunaan untuk melihat produk yang paling sesuai.':'Choose an application area to see the most suitable products.','Banner, spanduk, flexi, X/Y banner, dan display yang siap tampil di luar.':'Banners, signs, flexi, X/Y banners, and displays made for outdoor use.','Poster, sticker, canvas, foto, merchandise, dan kebutuhan ruang dalam.':'Posters, stickers, canvas, photos, merchandise, and indoor needs.','Sertifikat, flyer, art paper, kartu, dan produk kertas ukuran A3.':'Certificates, flyers, art paper, cards, and A3 paper products.',
  'Dipercaya untuk kebutuhan cetak harian dan kampanye brand':'Trusted for everyday printing and brand campaigns','ETALASE PRODUK':'PRODUCT SHOWCASE','Produk paling sering':'Most frequently','dicetak.':'printed.','Gunakan foto produk asli, cek estimasi harga, lalu pilih spesifikasi pesanan.':'Browse real product photos, check estimates, then choose your order specifications.','Banner, display, dan media luar ruang.':'Banners, displays, and outdoor media.','Sticker, merchandise, dan kebutuhan ruang dalam.':'Stickers, merchandise, and indoor needs.','Kertas, flyer, sertifikat, dan cetakan format A3.':'Paper, flyers, certificates, and A3-format prints.','produk':'products',
  'PROMO HARI INI':'TODAY\'S PROMO','Cetak lebih banyak,':'Print more,','lebih hemat.':'save more.','Harga yang tampil adalah estimasi demo. Harga final dikonfirmasi setelah file diperiksa operator.':'Displayed prices are demo estimates. Final pricing is confirmed after the operator reviews your file.','Lihat produk':'View products',
  'CARA PESAN':'HOW TO ORDER','Pesan dalam':'Order in','empat langkah.':'four steps.','Dari pilih produk sampai pesanan siap diproses.':'From choosing a product to preparing your order.','Pilih produk':'Choose a product','Pilih jenis produk printing yang sesuai kebutuhan.':'Choose the printing product that fits your needs.','Atur spesifikasi':'Set specifications','Pilih ukuran, jumlah, dan finishing yang tersedia.':'Choose the available size, quantity, and finishing.','Upload desain':'Upload your design','Kirim JPG, PNG, atau PDF untuk dibuatkan preview.':'Send a JPG, PNG, or PDF to create a preview.','Checkout':'Checkout','Review keranjang dan lanjutkan proses checkout demo.':'Review your cart and continue with the demo checkout.',
  'KATA MEREKA':'WHAT THEY SAY','Cerita dari':'Stories from','pelanggan.':'our customers.','Ulasan pelanggan dari arsip':'Customer reviews from the','Fazima Print.':'Fazima Print archive.','Hubungi':'Contact','Mulai dari sini':'Start here','Buka keranjang':'Open cart','Chat CS AI':'AI CS Chat','Demo':'Demo',
  'AKUN Fazima Print':'FAZIMA PRINT ACCOUNT','Masuk untuk':'Sign in to','lanjut.':'continue.','Fitur akun masih dalam tahap demo. Form ini belum mengirim data ke server.':'Account features are still in demo mode. This form does not send data to the server.','Password':'Password','Masuk (Demo)':'Sign in (Demo)','Kembali ke katalog':'Back to catalog',
  '01 / DETAIL PESANAN':'01 / ORDER DETAILS','Atur detail':'Set your','pesananmu.':'order details.','Pilih spesifikasi, upload desain, dan masukkan pesanan ke keranjang.':'Choose specifications, upload a design, and add the order to your cart.','Spesifikasi produk':'Product specifications','Semua detail bisa diperiksa lagi di keranjang.':'You can review every detail in the cart.','Produk':'Product','Ukuran':'Size','Jumlah':'Quantity','Finishing & opsi':'Finishing & options','Desain':'Design','Pilih atau tarik file ke sini':'Choose or drag a file here','Nama pekerjaan':'Job name','Kembali':'Back','Buat preview desain':'Create design preview','Tambah ke keranjang':'Add to cart','RINGKASAN SEMENTARA':'ORDER SUMMARY','Estimasi total':'Estimated total','Butuh bantuan?':'Need help?','Buka chat':'Open chat',
  '02 / KERANJANG':'02 / CART','Review lalu':'Review and','proses.':'process.','Belum ada payment gateway. Tombol di bawah hanya mensimulasikan pengiriman pesanan.':'There is no payment gateway yet. The button below only simulates order submission.','Keranjang kosong':'Your cart is empty','+ Tambah produk':'+ Add product','TOTAL DEMO':'DEMO TOTAL','Pesanan akan langsung dikirim ke tahap proses demo tanpa pembayaran nyata.':'Your order will go directly to the demo process without a real payment.','Nama pemesan':'Customer name','Nomor WhatsApp':'WhatsApp number','Metode menerima pesanan':'Delivery method','Ambil di toko':'Pick up in store','Diantar':'Delivery','Bayar (Demo) · Proses pesanan':'Pay (Demo) · Process order','Tidak ada uang yang ditagihkan.':'No money will be charged.','Buat pesanan baru':'Create new order',
  'Pilih produk untuk':'Choose a product to','melihat ringkasan.':'see the summary.','Memuat produk…':'Loading products…','Pilih produk dulu':'Choose a product first','Pilih opsi':'Choose an option','Tanpa finishing':'No finishing','Tanpa biaya tambahan':'No additional cost','Preview mockup akan muncul di sini':'The mockup preview will appear here','Preview desain':'Design preview','Pilih file lalu buat preview.':'Choose a file, then create a preview.','Chat belum dapat menjawab. Coba lagi.':'Chat cannot answer yet. Try again.','Mengetik…':'Typing…','Tulis pertanyaan…':'Type a question…'
};
Object.assign(languageDictionary, {'Tentang Fazima':'About Fazima','Lebih dari':'More than','sekadar cetak.':'just printing.','CARA KAMI BEKERJA':'HOW WE WORK','Rapi dari':'Precise from','awal sampai akhir.':'start to finish.','KARYA & PRODUKSI':'WORK & PRODUCTION','Yang kami':'What we','kerjakan.':'create.','KUNJUNGI KAMI':'VISIT US','Datang ke':'Come to','Fazima.':'Fazima.','Temukan workshop kami':'Find our workshop','di Bandung.':'in Bandung.','Buka Google Maps ↗':'Open Google Maps ↗','DIPERCAYA':'TRUSTED BY','Oleh banyak':'For many','kebutuhan.':'needs.','Klien dan mitra dari':'Clients and partners from the','arsip Fazima Print.':'Fazima Print archive.','referensi produk':'product references','basis produksi':'production base','preview transparan':'transparent previews','PRINTING, MADE SIMPLE.':'PRINTING, MADE SIMPLE.','Menyiapkan ruang cetak':'Preparing your print space','Maksimal 50 MB':'Maximum 50 MB','Pilih produk terlebih dahulu.':'Please choose a product first.','Pilih ukuran produk terlebih dahulu.':'Please choose a product size first.','Upload file desain terlebih dahulu.':'Please upload a design file first.'});
Object.assign(languageDictionary, {'KOLEKSI BIRU':'BLUE COLLECTION','KOLEKSI KUNING':'YELLOW COLLECTION','Semua':'All','Filter: Semua':'Filter: All','Sertifikat':'Certificates','Sticker':'Stickers','Flyer / Brosur':'Flyers / Brochures','Foto / Canvas':'Photos / Canvas','Banner / Spanduk':'Banners / Signage','Merchandise':'Merchandise','Banner / Display':'Banners / Displays','Kertas':'Paper','Art Paper':'Art Paper','Geser':'Scroll','←':'←','→':'→','Estimasi harga':'Price estimate','Pesananmu':'Your order','sudah diproses.':'has been processed.','Ini hanya simulasi checkout. Belum ada pembayaran atau order nyata yang dikirim.':'This is only a checkout simulation. No payment or real order has been sent.','Pilih ukuran':'Choose a size','Jumlah unit yang ingin dicetak':'Number of units to print','opsional':'optional','Opsi file lanjutan':'Advanced file options','Mode warna':'Color mode','Format file':'File format','Perbesar kualitas':'Upscale quality','Render 2× untuk hasil lebih tajam':'Render 2× for a sharper result','Preview menampilkan satu desain sesuai ukuran yang Anda masukkan.':'The preview shows one design at the size you entered.','File siap':'File ready','Menyiapkan…':'Preparing…','Memproses…':'Processing…','Preview diproses…':'Processing preview…','Preview siap':'Preview ready','Upload desain.':'Upload your design.','Kami proses.':'We process it.','cepat dan praktis':'fast and practical','Digital printing and advertising':'Digital printing and advertising','untuk kebutuhanmu.':'for your needs.','Buat pesanan':'Create order','Pesan':'Order','Pilih':'Choose'});
Object.assign(languageDictionary, {'TENTANG FAZIMA':'ABOUT FAZIMA','Fazima Print adalah digital printing and advertising di Bandung. Kami membantu bisnis, acara, sekolah, komunitas, dan personal project mengubah ide menjadi materi visual yang siap dipakai.':'Fazima Print is a digital printing and advertising studio in Bandung. We help businesses, events, schools, communities, and personal projects turn ideas into ready-to-use visual materials.','Kami percaya proses cetak yang baik dimulai dari brief yang jelas, pilihan bahan yang tepat, dan preview yang bisa dilihat sebelum pesanan diproses.':'We believe great printing starts with a clear brief, the right materials, and a preview you can review before processing.','Contoh visual dari arsip produksi':'Visual examples from our production archive','Temukan produk untuk kebutuhanmu':'Find products for your needs','Atur spesifikasi dan upload desain setelah memilih produk.':'Set specifications and upload your design after choosing a product.','Filter produk':'Filter products','PESANANMU':'YOUR ORDER','Belum ada pesanan':'No orders yet','Pilih produk dari katalog untuk mulai.':'Choose a product from the catalog to get started.','Hapus item':'Remove item','Lokasi saat ini':'Current location','TERKUNCI':'LOCKED','Alamat pengantaran':'Delivery address','Gunakan lokasi saat ini':'Use current location','Browser akan meminta izin lokasi.':'Your browser will request location permission.','Checkout demo only':'Checkout demo only','Pesanan aman disimpan sementara':'Orders are safely saved temporarily','Chat CS AI demo tersedia di kanan bawah.':'Demo AI CS chat is available at the bottom right.','Saya bisa membantu menjelaskan ukuran dan finishing. Untuk sekarang saya masih demo.':'I can help explain sizes and finishing. For now, I am still a demo.','Halo! Ada yang ingin ditanyakan tentang produk atau pesanan?':'Hello! Do you have a question about a product or order?','Demo · belum terhubung ke AI':'Demo · not connected to AI','Fitur akun masih dalam tahap demo. Form ini belum mengirim data ke server.':'Account features are still in demo mode. This form does not send data to the server.','kamu@email.com':'you@email.com','Contoh: banner acara ulang tahun':'Example: birthday event banner','Contoh: 60x160 cm':'Example: 60x160 cm','JPG, PNG, atau PDF · maksimal 50 MB':'JPG, PNG, or PDF · maximum 50 MB','Harga final dapat disesuaikan setelah file diperiksa operator.':'Final pricing may change after the operator reviews your file.','Preview gagal dibuat':'Preview could not be created','Hasil layout siap dilihat':'Layout result is ready to view','Sedang membuat hasil layout…':'Creating your layout…','Buat ulang preview':'Create preview again','Keranjang masih kosong.':'Your cart is empty.','Isi nama dan nomor WhatsApp terlebih dahulu.':'Enter your name and WhatsApp number first.','Isi detail alamat pengantaran terlebih dahulu.':'Enter the delivery address first.','Login masih demo dan belum terhubung ke account server.':'Login is still a demo and is not connected to an account server.'});
Object.assign(languageDictionary, {'Cetak dari':'Print from','mana saja.':'anywhere.','DESKRIPSI PRODUK':'PRODUCT DESCRIPTION','TENTANG PRODUK':'ABOUT THIS PRODUCT','Detail produk':'Product details','PERSONALISASI PRODUK':'PERSONALIZE YOUR PRODUCT','Pilih spesifikasi cetak':'Choose print specifications','Atur ukuran, finishing, jumlah, dan file desain untuk produk ini.':'Set the size, finishing, quantity, and design file for this product.','File desain':'Design file','Pilih atau tarik file ke sini':'Choose or drag a file here','Lanjut ke preview & pembayaran':'Continue to preview & payment','Masukkan ke keranjang':'Add to cart','RINGKASAN PILIHAN':'YOUR SELECTION','ULASAN PELANGGAN':'CUSTOMER REVIEWS','Cerita dari pelanggan':'Customer stories','Ulasan demo dari pelanggan Fazima Print.':'Demo reviews from Fazima Print customers.','Review desain,':'Review your design,','lanjut bayar.':'then pay.','Preview diproses di halaman ini setelah detail produk disimpan.':'Your preview is processed here after the product details are saved.','Preview sedang disiapkan…':'Preparing preview…','Buat ulang preview':'Create preview again','Lanjut ke pembayaran Midtrans':'Continue to Midtrans payment','Pembayaran':'Payment','aman dan simpel.':'safe and simple.','Pilih QRIS, DANA, BCA Virtual Account, atau metode lain langsung di checkout Midtrans.':'Choose QRIS, DANA, BCA Virtual Account, or another method directly in Midtrans checkout.','Midtrans Checkout':'Midtrans Checkout','Sandbox environment':'Sandbox environment','Menyiapkan checkout Midtrans…':'Preparing Midtrans checkout…','Menyiapkan pembayaran…':'Preparing payment…','Kembali ke preview':'Back to preview','RINGKASAN ORDER':'ORDER SUMMARY','Pesanan Fazima Print':'Fazima Print order','Harga dikirim ke Midtrans dari backend customer.':'The price is sent to Midtrans from the customer backend.','Keranjang kosong':'Cart is empty','Review lalu':'Review then','proses.':'process.','Belum ada payment gateway. Tombol di bawah hanya mensimulasikan pengiriman pesanan.':'There is no payment gateway yet. The button below only simulates order submission.','PESANANMU':'YOUR ORDER','TOTAL DEMO':'DEMO TOTAL','Pesanan akan langsung dikirim ke tahap proses demo tanpa pembayaran nyata.':'Your order will go to demo processing without a real payment.','Nama pemesan':'Customer name','Nomor WhatsApp':'WhatsApp number','Metode menerima pesanan':'Delivery method','Ambil di toko':'Pick up in store','Diantar':'Delivery','Alamat pengantaran':'Delivery address','Gunakan lokasi saat ini':'Use current location','Browser akan meminta izin lokasi.':'Your browser will request location permission.','Bayar (Demo) · Proses pesanan':'Pay (Demo) · Process order','Tidak ada uang yang ditagihkan.':'No money will be charged.','DEMO BERHASIL':'DEMO COMPLETE','Pesananmu':'Your order','sudah diproses.':'has been processed.','Ini hanya simulasi checkout. Belum ada pembayaran atau order nyata yang dikirim.':'This is only a checkout simulation. No payment or real order has been submitted.','Buat pesanan baru':'Create a new order'});
Object.assign(languageDictionary, {'mana saja':'anywhere'});
Object.assign(languageDictionary, {'FAQ / PANDUAN CETAK':'FAQ / PRINT GUIDE','Punya pertanyaan':'Questions','yang sering muncul.':'we hear often.','Jawaban singkat untuk bantu pesananmu melaju dari ide sampai siap dicetak.':'Quick answers to help move your order from idea to print-ready.','Butuh bantuan langsung?':'Need direct help?','Hubungi tim Fazima':'Contact Fazima','Pertanyaan yang sering ditanyakan':'Frequently asked questions','Produk dan kategori apa saja yang tersedia?':'What products and categories are available?','Katalog terbagi menjadi Outdoor, Indoor, dan A3. Buka':'Browse Outdoor, Indoor, and A3 categories. Open','semua produk':'all products','untuk melihat pilihan cetak yang tersedia saat ini.':'to see the current print selection.','Bagaimana cara memesan dari website?':'How do I place an order on the website?','Pilih produk, atur ukuran dan spesifikasinya, lalu unggah desain. Periksa preview, masukkan produk ke keranjang, dan lanjutkan ke checkout.':'Choose a product, set its size and specifications, then upload your design. Review the preview, add it to your cart, and continue to checkout.','Apakah setiap produk punya ukuran dan bahan yang sama?':'Do all products have the same sizes and materials?','Tidak. Pilihan ukuran, bahan, jumlah, dan finishing mengikuti opsi yang tersedia pada masing-masing halaman produk.':'No. Size, material, quantity, and finishing choices depend on the options available for each product.','Format file desain apa yang bisa diunggah?':'Which design file formats can I upload?','Unggah JPG, PNG, atau PDF dengan ukuran file maksimal 50 MB. Pastikan desain dan ukuran cetak sudah sesuai sebelum membuat preview.':'Upload a JPG, PNG, or PDF up to 50 MB. Check that the design and print size are correct before creating a preview.','Apakah harga yang tampil merupakan harga final?':'Are the displayed prices final?','Harga di website merupakan estimasi. Operator akan memeriksa file dan spesifikasi pesanan, lalu mengonfirmasi harga final sebelum produksi.':'Website prices are estimates. An operator will review your file and order specifications, then confirm the final price before production.','Metode pembayaran apa yang bisa dipilih?':'Which payment methods can I use?','Metode yang aktif akan tampil di checkout Midtrans. Setelah membayar, simpan struk dan nomor order untuk referensi pesananmu.':'Available methods will appear at Midtrans checkout. After payment, keep the receipt and order number for reference.'});
Object.assign(languageDictionary, {'Harga spesial,':'Special prices,','waktu terbatas.':'for a limited time.','Pilihan produk promo yang diperbarui berkala. Harga promo berlaku pada produk yang ditandai.':'A rotating selection of promotional products. Promotional pricing applies to marked products.','Lihat promo':'Shop offer'});
// Product descriptions are rendered dynamically after the initial DOM scan.
// Keep their English copy in the same dictionary so product.html and the
// catalog remain translated when the language is switched.
Object.assign(languageDictionary, {
  'Banner besar untuk promosi dan event.':'Large-format banner for promotions and events.',
  'Praktis untuk booth dan presentasi.':'Practical for booths and presentations.',
  'Pesan jelas, terlihat dari jauh.':'A clear message that stays visible from a distance.',
  'Buat brand-mu lebih mudah diingat.':'Make your brand easier to remember.',
  'Visual yang menarik perhatian.':'Visuals that capture attention.',
  'Kesan pertama yang profesional.':'A professional first impression.',
  'Cetak sertifikat yang rapi dan tajam untuk sekolah, kantor, acara, dan penghargaan.':'Clean, sharp certificate printing for schools, offices, events, and awards.',
  'Stiker chromo dengan warna kuat untuk label, kemasan, dan kebutuhan promosi.':'Chromo stickers with bold colors for labels, packaging, and promotions.',
  'Flyer dan brosur dengan detail teks yang jelas untuk promosi bisnis dan event.':'Flyers and brochures with clear text detail for business promotions and events.',
  'Cetak foto atau artwork di canvas untuk dekorasi ruang dan hadiah personal.':'Print photos or artwork on canvas for room decor and personal gifts.',
  'Media flexi ekonomis untuk banner dan spanduk dengan warna yang tetap terlihat dari jauh.':'Economical flexi media for banners and signage with colors that remain visible from a distance.',
  'Flexi 280gsm yang lebih solid untuk banner promosi dan signage outdoor.':'More solid 280gsm flexi for promotional banners and outdoor signage.',
  'Kertas kado custom dengan desain pilihanmu untuk kebutuhan personal dan bisnis.':'Custom gift wrap with your chosen design for personal and business needs.',
  'Flexi tebal untuk spanduk outdoor yang membutuhkan material lebih kokoh.':'Thick flexi for outdoor signage that needs a sturdier material.',
  'Gantungan kunci custom sebagai merchandise acara, komunitas, dan brand.':'Custom keychains as merchandise for events, communities, and brands.',
  'ID card custom untuk identitas acara, sekolah, kantor, dan komunitas.':'Custom ID cards for events, schools, offices, and communities.',
  'Mini banner praktis untuk meja, booth, kasir, dan display promosi.':'Practical mini banners for tables, booths, counters, and promotional displays.',
  'Mug custom dengan desain pilihanmu untuk hadiah atau merchandise brand.':'Custom mugs with your chosen design for gifts or branded merchandise.',
  'Roll up banner siap pakai untuk booth, presentasi, dan kebutuhan promosi indoor.':'Ready-to-use roll-up banners for booths, presentations, and indoor promotions.',
  'Stiker meteran custom untuk branding kendaraan, etalase, dan permukaan luas.':'Custom meter stickers for vehicle, storefront, and large-surface branding.',
  'Stiker one way untuk kaca dengan tampilan promosi yang tetap nyaman dilihat dari dalam.':'One-way window stickers with promotional graphics that remain comfortable to view from inside.',
  'Stiker transparan untuk label dan branding dengan tampilan bersih.':'Transparent stickers for clean-looking labels and branding.',
  'Stiker vinyl tahan lama untuk label, merchandise, dan kebutuhan branding.':'Durable vinyl stickers for labels, merchandise, and branding.',
  'X/Y banner portable untuk event, booth, presentasi, dan promosi luar ruang.':'Portable X/Y banners for events, booths, presentations, and outdoor promotions.',
  'Art paper ringan untuk flyer, sertifikat, dan kebutuhan cetak sehari-hari.':'Lightweight art paper for flyers, certificates, and everyday print needs.',
  'Art paper dengan hasil warna lebih solid untuk materi promosi dan kartu.':'Art paper with richer color results for promotional materials and cards.',
  'Art paper serbaguna untuk flyer, brosur, dan materi komunikasi brand.':'Versatile art paper for flyers, brochures, and brand communications.',
  'Art paper tebal untuk kartu, cover, dan cetakan premium.':'Thick art paper for cards, covers, and premium prints.',
  'Art paper premium dengan hasil kokoh untuk kebutuhan kartu dan display kertas.':'Premium art paper with a sturdy finish for cards and paper displays.',
  'Tripod banner yang mudah dipasang untuk acara, booth, dan display promosi.':'Easy-to-set-up tripod banners for events, booths, and promotional displays.',
  ' terjual':' sold','terjual':'sold'
});
Object.assign(languageDictionary, {
  'Alurnya sederhana':'The flow is simple','Isi detail di sini → lihat preview di halaman order → pilih pembayaran.':'Enter details here → view the preview on the order page → choose payment.','Detail produk dan pilihan spesifikasi akan muncul di sini.':'Product details and specification options will appear here.','Hasil preview dari desain yang kamu upload.':'Preview result from your uploaded design.','Menyiapkan preview desain…':'Preparing design preview…','Preview sedang disiapkan…':'Preparing preview…','Pembayaran ini masih simulasi. Tidak ada uang yang ditagihkan.':'This payment is still a simulation. No payment will be charged.','Kembali ke pilihan pembayaran':'Back to payment options','Kembali ke detail':'Back to details','Total terjual':'Total sold','berdasarkan ulasan pelanggan':'based on customer reviews','Hasil cetaknya tajam dan warnanya sesuai desain. Prosesnya juga cepat.':'The print is sharp and the colors match the design. The process is fast too.','Finishing-nya rapi, packaging aman, dan preview sangat membantu sebelum pesan.':'The finishing is neat, the packaging is secure, and the preview is very helpful before ordering.','Produk sesuai kebutuhan untuk event. Admin responsif dan mudah diajak diskusi.':'The product fit our event needs. The admin was responsive and easy to discuss details with.','hari lalu':'days ago','minggu lalu':'weeks ago','Preview desain pesanan':'Order design preview','Produk Fazima Print':'Fazima Print product','FAZIMA PRINT PRODUCT':'FAZIMA PRINT PRODUCT'
});
Object.assign(languageDictionary, {
  'Cari banner, sticker, brosur, kartu nama...':'Search for banners, stickers, brochures, business cards...',
  'Nama kamu':'Your name','Tulis alamat lengkap pengantaran':'Enter the full delivery address','Akurasi':'Accuracy','meter':'meters','Satuan':'Unit','meter (m)':'meters (m)','sentimeter (cm)':'centimeters (cm)','milimeter (mm)':'millimeters (mm)','Contoh: 1':'Example: 1','Contoh: 3':'Example: 3','Contoh: banner acara ulang tahun':'Example: birthday event banner','Contoh: 60x160 cm':'Example: 60x160 cm',
  'Laba-laba interaktif. Tarik lalu lepaskan untuk melihatnya memantul.':'Interactive spider. Drag and release it to see it bounce.','Peta lokasi Fazima Print':'Fazima Print location map','5 dari 5 bintang':'5 out of 5 stars','Produk populer':'Popular products','Contoh hasil digital printing Fazima Print':'Example of Fazima Print digital printing','Produk cetak outdoor':'Outdoor printing products','Produk cetak indoor':'Indoor printing products','Produk cetak A3':'A3 printing products','Klien Fazima Print':'Fazima Print client',
  'Finishing belum tersedia untuk produk ini.':'Finishing is not available for this product.','Aturan ukuran sticker':'Sticker size rules','Kapasitas otomatis di A3:':'Automatic A3 capacity:','pcs per lembar':'pcs per sheet','Preview menampilkan satu desain sesuai ukuran yang Anda masukkan.':'The preview shows one design at the size you entered.','Jika ukuran/bentuk ingin mengikuti desain (contoh logo Apple), upload gambar PNG dengan background transparan.':'If the size or shape should follow the design, upload a PNG with a transparent background.',
  'Pilih produk untuk':'Choose a product to','melihat ringkasan.':'see the summary.','Luas cetak':'Print area','Harga / lembar':'Price / sheet','Tarif / m³':'Rate / m³','Jumlah':'Quantity','unit':'units','lembar':'sheets','Preview sedang diproses…':'Preview is being processed…','Sedang membuat hasil layout…':'Creating your layout…','Hasil layout siap dilihat':'Layout result is ready to view','Buat ulang preview':'Create preview again',
  'Preview sudah kedaluwarsa. Silakan proses ulang.':'The preview has expired. Please process it again.','File tidak ditemukan':'File not found','Endpoint tidak ditemukan':'Endpoint not found','Gunakan application/json':'Use application/json','Signature notification tidak valid':'Invalid notification signature','File belum bisa disimpan sementara. Coba lagi.':'The file could not be saved temporarily. Please try again.'
});
Object.assign(languageDictionary, {
  'Detail produk akan muncul di sini.':'Product details will appear here.',
  'Produk ini dicetak dengan material pilihan Fazima Print untuk hasil yang rapi, tajam, dan siap digunakan sesuai kebutuhanmu.':'Printed with selected Fazima Print materials for a clean, sharp result ready for your needs.',
  'Hasil tajam':'Sharp output','Dicek operator':'Operator checked','Preview sebelum bayar':'Preview before payment',
  'Harga mulai dari':'Starting from','Rating pelanggan':'Customer rating','Pengalaman cetak yang konsisten':'Consistent printing experience','File diperiksa sebelum produksi':'File checked before production','Preview dahulu':'Preview first','Lihat hasil layout sebelum bayar':'See the layout before payment',
  'terjual':'sold','Jumlah unit yang ingin dicetak':'Number of units to print','Kapasitas otomatis di A3:':'Automatic A3 capacity:','pcs per lembar':'pcs per sheet','Aturan ukuran sticker':'Sticker size rules','Kertas A3 dan jumlah muatan dihitung otomatis.':'A3 sheet and capacity are calculated automatically.','Satu desain, bukan pengulangan bulk.':'One design, not a bulk repetition.','Bentuk sticker':'Sticker shape','Ukuran sticker':'Sticker size','Mengikuti desain':'Follow the design','Kotak':'Square','Bulat':'Round','Jika ukuran/bentuk ingin mengikuti desain (contoh logo Apple), upload gambar PNG dengan background transparan.':'If the size or shape should follow the design (for example, an Apple logo), upload a PNG with a transparent background.',
  'Orientasi preview':'Preview orientation','Pilih arah panjang desain.':'Choose the direction of the design.','Horizontal':'Horizontal','Vertikal':'Vertical','Pilih opsi produk':'Choose product options','Sesuaikan ukuran, finishing, jumlah, dan desainmu.':'Adjust the size, finishing, quantity, and design.','Atur semua kebutuhan cetakmu di sini.':'Set all your printing needs here.','File siap':'File ready','Pilih file untuk melanjutkan.':'Choose a file to continue.','Pilih file lalu buat preview.':'Choose a file, then create a preview.','Pilih pembayaran':'Choose payment','Selesaikan pembayaran demo sesuai metode pilihanmu.':'Complete the demo payment using your chosen method.','Midtrans Sandbox belum aktif':'Midtrans Sandbox is not active','Midtrans belum dikonfigurasi':'Midtrans is not configured','Pembayaran diproses oleh Midtrans':'Payment is processed by Midtrans','Buka checkout Midtrans':'Open Midtrans checkout','Menyiapkan checkout…':'Preparing checkout…','Pembayaran masih menunggu.':'Payment is still pending.','Pembayaran gagal.':'Payment failed.','Midtrans tidak dapat dihubungi':'Midtrans could not be reached','Snap.js gagal dimuat.':'Snap.js failed to load.'
});
Object.assign(languageDictionary, {
  'TAMBAH KE KERANJANG':'ADD TO CART','Pilih spesifikasi cetak sebelum menambahkan produk.':'Choose print specifications before adding the product.','Jumlah unit yang ingin dicetak':'Number of units to print','Finishing':'Finishing','Opsi sticker':'Sticker options','Kapasitas A3 dihitung otomatis berdasarkan ukuran sticker.':'A3 capacity is calculated automatically from the sticker size.','File desain':'Design file','Pilih file desain':'Choose a design file','Opsi file lanjutan':'Advanced file options','Batal':'Cancel','Tambah ke keranjang':'Add to cart','Ukuran file maksimal 50 MB.':'Maximum file size is 50 MB.','Produk belum dapat dimuat.':'Products could not be loaded.','Preview gagal dibuat.':'Preview could not be created.'
});
Object.assign(languageDictionary, {'File siap ditambahkan':'File ready to add','Memproses preview':'Processing preview'});
Object.assign(languageDictionary, {
  'Memuat Fazima Print':'Loading Fazima Print','Pilih bahasa':'Choose language','Buka menu':'Open menu','Tutup chat':'Close chat','Aktifkan dark mode':'Enable dark mode','Nonaktifkan dark mode':'Disable dark mode',
  'Banner':'Banner','X-Banner':'X-Banner','Spanduk':'Signage','Sticker':'Sticker','Poster':'Poster','Kartu Nama':'Business Card','Cetak Sertifikat':'Certificate Printing','Stiker Chromo A3+':'Chromo Sticker A3+','Cetak Flyer/Brosur':'Flyer/Brochure Printing','Canvas Custom':'Custom Canvas','Cetak Kertas Kado':'Custom Gift Wrap','Gantungan Kunci':'Keychain','Stiker Meteran':'Meter Sticker','Stiker One Way':'One-Way Sticker','Stiker Transparan A3':'Transparent Sticker A3','Stiker Vinyl A3+':'Vinyl Sticker A3+','X/Y Banner':'X/Y Banner','Tripod Banner':'Tripod Banner',
  'Sertifikat':'Certificates','Sticker':'Stickers','Flyer / Brosur':'Flyers / Brochures','Foto / Canvas':'Photos / Canvas','Banner / Spanduk':'Banners / Signage','Banner / Display':'Banners / Displays','Kertas':'Paper',
  'Tidak ada uang yang ditagihkan.':'No payment will be charged.','Checkout demo only':'Secure checkout via Midtrans','Checkout demo':'Checkout','Pesanan aman disimpan sementara':'Orders are saved temporarily',
  'Browser ini tidak mendukung lokasi.':'This browser does not support location.','Meminta izin lokasi…':'Requesting location permission…','Lokasi berhasil digunakan. Tambahkan detail alamat bila perlu.':'Location used successfully. Add address details if needed.','Lokasi tidak dapat diakses. Isi alamat secara manual.':'Location could not be accessed. Enter the address manually.',
  'Pilih ukuran sticker terlebih dahulu.':'Please choose a sticker size first.','Jumlah pesanan minimal 1.':'Order quantity must be at least 1.','File belum bisa disimpan sementara. Coba lagi.':'The file could not be saved temporarily. Please try again.','File desain sementara sudah tidak tersedia.':'The temporary design file is no longer available.','Kembali ke deskripsi produk dan upload ulang.':'Return to the product description and upload it again.','Preview belum dapat diproses.':'The preview could not be processed yet.','Preview siap dilihat':'Preview ready to view','Preview gagal dibuat.':'Preview could not be created.','Server belum siap.':'The server is not ready yet.','Produk belum dapat dimuat.':'Products could not be loaded.','File desain':'Design file','Tanpa finishing':'No finishing','Tidak ada biaya tambahan':'No additional cost','Hanya area cetak':'Print area only','Laminasi matte halus':'Smooth matte lamination','Area lipat / selongsong':'Fold / sleeve area','Siap untuk roll banner':'Ready for roll banner',
  'Nomor order:':'Order number:','akan dibuat':'will be created','Memproses preview…':'Processing preview…','Menyiapkan checkout…':'Preparing checkout…','Midtrans Sandbox belum aktif':'Midtrans Sandbox is not active','Midtrans belum dikonfigurasi':'Midtrans is not configured','Pembayaran diproses oleh Midtrans':'Payment is processed by Midtrans','Nomor order Anda akan dicantumkan pada struk pembayaran.':'Your order number will appear on the payment receipt.','Buka checkout Midtrans':'Open Midtrans checkout','Pembayaran masih menunggu.':'Payment is still pending.','Pembayaran gagal.':'Payment failed.','Midtrans tidak dapat dihubungi':'Midtrans could not be reached','Snap.js gagal dimuat.':'Snap.js failed to load.','Nama boleh kosong; nomor WhatsApp hanya opsional.':'Name may be left blank; WhatsApp is optional.','Selesaikan pembayaran melalui Midtrans dan simpan struk dengan nomor order Anda.':'Complete payment through Midtrans and save the receipt with your order number.','Pesanan ditambahkan ke keranjang.':'Order added to cart.','Pesanan sudah masuk ke keranjang.':'Order has been added to the cart.','Struk pembayaran siap digunakan':'Payment receipt is ready to use','Simpan nomor order ini. Nomor tersebut menjadi kunci untuk mengambil pesanan Anda.':'Save this order number. It is the key for picking up your order.','PEMBAYARAN BERHASIL':'PAYMENT SUCCESSFUL','Buat pesanan baru':'Create new order','Preview gagal:':'Preview failed:','Preview gagal dibuat':'Preview could not be created','Fazima Print · Keranjang':'Fazima Print · Cart','Fazima Print · Deskripsi Produk':'Fazima Print · Product Description','Fazima Print · Checkout':'Fazima Print · Checkout','Fazima Print · Midtrans Checkout':'Fazima Print · Midtrans Checkout','Fazima Print · Masuk':'Fazima Print · Sign In'
});
Object.assign(languageDictionary, {
  'Matik':'Matte','Selongsong':'Sleeve','Roll Banner':'Roll-up banner','Membuat preview…':'Creating preview…','Struk pembayaran':'Payment receipt','siap digunakan.':'ready to use.','Jumlah lembar A3 yang ingin dicetak':'Number of A3 sheets to print','Jumlah sticker One Way':'Number of One-Way stickers','Sticker One Way':'One-Way Sticker','Kapasitas otomatis di A3:':'Automatic A3 capacity:','pcs per lembar':'pcs per sheet','Preview menampilkan satu desain sesuai ukuran yang Anda masukkan.':'The preview shows one design at the size you entered.','Kertas A3 dan jumlah muatan dihitung otomatis.':'A3 paper and capacity are calculated automatically.','Satu desain, bukan pengulangan bulk.':'One design, not a bulk repetition.','Bentuk sticker':'Sticker shape','Kotak':'Square','Bulat':'Round','Mengikuti desain':'Follow the design','Jika ukuran/bentuk ingin mengikuti desain (contoh logo Apple), upload gambar PNG dengan background transparan.':'If the size or shape should follow the design (for example, an Apple logo), upload a PNG with a transparent background.','Bahasa Indonesia':'Indonesian','Pilih bahasa':'Choose language',
  'Luar biasa pake banget ,,saya diluar kota bisa pesen dan bisa titip dipaketkan sekalian pula,,keren deeh. makasih service excellent nya,,, sukses terus FAZIMA Print':'Excellent service. I am outside the city, yet I could order and have it packed for delivery too. Amazing. Thank you, and continued success to FAZIMA Print.','Barang sudah selesai di produksi ,, kualitas warna sangat bagus dan kualitas bahannya juga sangat relevan .. Semoga semakin maju bisnisnya .. Thanks 👍':'The product is finished, the color quality is excellent, and the material quality is just right. Wishing the business continued growth. Thanks 👍','Alhamdulillah keren bangett pelayananya, bisa sat set. Admin ramah sekali dan sangat membantu proses pemesanan. Harga terjangkau. sukses selalu FAZIMA Print 😊':'Wonderful service—fast and easy. The admin was friendly and very helpful throughout the order. Affordable prices. Continued success to FAZIMA Print 😊'
});
Object.assign(languageDictionary, {'Luas cetak':'Print area','Harga / m³':'Price / m³','Harga / lembar':'Price / sheet','Tarif / m³':'Rate / m³','Sticker / lembar':'Sticker / sheet','Sticker / lembar A3':'Sticker / A3 sheet','unit':'units','File desain':'Design file','meter':'meters','sentimeter':'centimeters','milimeter':'millimeters','Lebar':'Width','Tinggi':'Height','Satuan':'Unit'});
Object.assign(languageDictionary, {'⌖ Lokasi saat ini':'⌖ Current location','⌖ Gunakan lokasi saat ini':'⌖ Use current location','Ada yang ingin ditanyakan tentang keranjang?':'Do you have a question about your cart?','← Kembali ke katalog':'← Back to catalog','02 / PREVIEW & PEMBAYARAN':'02 / PREVIEW & PAYMENT','(opsional)':'(optional)','PREVIEW DESAIN':'DESIGN PREVIEW','Preview & pilih pembayaran':'Preview & choose payment','Pilih opsi pembayaran':'Choose payment options','FILE DESAIN':'DESIGN FILE','Pilih opsi untuk':'Choose options for'});
Object.assign(languageDictionary, {'Harga final dikonfirmasi setelah file diperiksa operator.':'Final pricing is confirmed after the operator reviews your file.','Pembayaran dibuka melalui checkout Midtrans. Simpan struk dan nomor order untuk pengambilan pesanan.':'Payment opens through Midtrans checkout. Save the receipt and order number to collect your order.','TOTAL PEMBAYARAN':'TOTAL PAYMENT','Pembayaran aman via Midtrans':'Secure payment via Midtrans','Pembayaran ini masih simulasi. Tidak ada uang yang ditagihkan.':'This payment is a simulation. No money will be charged.','simulasi pembayaran':'payment simulation','Checkout demo only':'Secure checkout via Midtrans'});
Object.assign(languageDictionary, {'Tambahkan detail alamat':'Add address details','Set MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY pada backend, lalu restart server.':'Set MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY in the backend, then restart the server.','QRIS, DANA, BCA Virtual Account, dan metode yang aktif di akun merchant akan muncul di checkout.':'QRIS, DANA, BCA Virtual Account, and the payment methods enabled for the merchant account will appear at checkout.','Lanjut ke pembayaran Midtrans':'Continue to Midtrans payment','Pilih pembayaran':'Choose payment','Bayar dengan Midtrans':'Pay with Midtrans','Pembayaran dibuka melalui checkout Midtrans.':'Payment opens through Midtrans checkout.','Simpan struk dan nomor order untuk pengambilan pesanan.':'Save the receipt and order number to collect your order.','Nama boleh kosong; nomor WhatsApp hanya opsional.':'Name may be left blank; WhatsApp is optional.','Selesaikan pembayaran melalui Midtrans dan simpan struk dengan nomor order Anda.':'Complete payment through Midtrans and save the receipt with your order number.','Pembayaran masih menunggu.':'Payment is still pending.','Pembayaran gagal.':'Payment failed.','Menyiapkan checkout…':'Preparing checkout…','Buka checkout Midtrans':'Open Midtrans checkout'});
Object.assign(languageDictionary, {'Masuk':'Sign in','Masuk sekali,':'Sign in once,','lanjut cetak.':'keep printing.','Masuk dengan akun Google untuk mendapatkan promo member, menyimpan pesanan, dan melihat riwayat order dengan lebih praktis.':'Sign in with Google to get member offers, save orders, and view your order history more easily.','Lanjut dengan Google':'Continue with Google','Login cepat dan aman melalui Google':'Fast and secure login through Google','Dapatkan promo member':'Get member offers'});
function currentLanguage() { return localStorage.getItem(languageKey) === 'en' ? 'en' : 'id'; }
function translateValue(value, language) { if (language !== 'en') return value; if (languageDictionary[value]) return languageDictionary[value]; if (/^\d+[+] terjual$/.test(value)) return value.replace(' terjual', ' sold'); if (/^\d+ items? di keranjang$/.test(value)) return value.replace(' di keranjang', ' in cart'); if (/^\d+ unit$/.test(value)) return value.replace(' unit', ' units'); if (/^(.+) · (\d+) unit$/.test(value)) return value.replace(/ · (\d+) unit$/, ' · $1 units'); if (value.startsWith('Preview ')) return `Preview ${translateValue(value.slice(8), language)}`; if (value.startsWith('Preview gagal:')) return `Preview failed:${value.slice('Preview gagal:'.length)}`; if (value.startsWith('Lokasi saat ini:')) return `Current location:${value.slice('Lokasi saat ini:'.length)}`; if (value.startsWith('Akurasi ±')) return value.replace('Akurasi ±', 'Accuracy ±').replace(/ meter$/, ' meters'); if (value.startsWith('Filter: ')) return `Filter: ${translateValue(value.slice(8), language)}`; if (value.startsWith('Mulai ')) return value.replace('Mulai ', 'From '); return value; }
function containsIndonesianCopy(node) {
  if (node.nodeType === Node.TEXT_NODE) return Boolean(languageDictionary[node.textContent.trim()]);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) if (languageDictionary[walker.currentNode.textContent.trim()]) return true;
  return false;
}
function translatePage(language = currentLanguage()) {
  document.documentElement.lang = language === 'en' ? 'en' : 'id';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (node.parentElement.closest('script,style,.brand,.language-switcher')) return;
    const original = node.__fpOriginalText || node.textContent.trim();
    if (!original) return;
    node.__fpOriginalText = original;
    const translated = translateValue(original, language);
    if (node.textContent.trim() === translated) return;
    node.textContent = node.textContent.replace(node.textContent.trim(), translated);
  });
  document.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach((node) => ['placeholder','aria-label','title','alt'].forEach((attribute) => {
    if (!node.hasAttribute(attribute)) return;
    const original = node.dataset[`fpOriginal${attribute.replace('-', '')}`] || node.getAttribute(attribute);
    node.dataset[`fpOriginal${attribute.replace('-', '')}`] = original;
    node.setAttribute(attribute, translateValue(original, language));
  }));
  document.querySelectorAll('textarea').forEach((node) => {
    if (!node.value) return;
    node.value = node.value.replace(/^Lokasi saat ini:/, language === 'en' ? 'Current location:' : 'Lokasi saat ini:').replace(/^Akurasi ±(\d+) meters?$/m, language === 'en' ? 'Accuracy ±$1 meters' : 'Akurasi ±$1 meter');
  });
}
function setupLanguageSwitcher() {
  const actions = document.querySelector('.header-actions');
  if (!actions || actions.querySelector('.language-switcher')) return;
  const switcher = document.createElement('div');
  switcher.className = 'language-switcher';
  switcher.innerHTML = '<button class="language-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="language-globe" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"></path></svg></span><b class="language-current">ID</b><span class="language-chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4"></path></svg></span></button><div class="language-menu" role="listbox" aria-label="Pilih bahasa"><button type="button" data-language="id" role="option"><b>ID</b><span>Indonesian</span><i>✓</i></button><button type="button" data-language="en" role="option"><b>EN</b><span>English</span><i>✓</i></button></div>';
  actions.appendChild(switcher);
  const trigger = switcher.querySelector('.language-trigger');
  const setLanguage = (language) => { localStorage.setItem(languageKey, language); translatePage(language); const pageTitles = {home:'Fazima Print · Digital Printing Bandung', about:'Fazima Print · About Us', product:'Fazima Print · Product Description', order:'Fazima Print · Product Details', cart:'Fazima Print · Cart', payment:'Fazima Print · Midtrans Checkout', login:'Fazima Print · Sign In'}; const pageTitlesId = {home:'Fazima Print · Digital Printing Bandung', about:'Fazima Print · Tentang Kami', product:'Fazima Print · Deskripsi Produk', order:'Fazima Print · Detail produk', cart:'Fazima Print · Keranjang', payment:'Fazima Print · Midtrans Checkout', login:'Fazima Print · Masuk'}; if (pageTitles[page]) document.title = language === 'en' ? pageTitles[page] : pageTitlesId[page]; const selectedProduct = $('#product')?.value; if (selectedProduct && typeof setProductInfo === 'function') setProductInfo(selectedProduct); switcher.querySelector('.language-current').textContent = language === 'en' ? 'EN' : 'ID'; switcher.querySelectorAll('[data-language]').forEach((option) => { const active = option.dataset.language === language; option.classList.toggle('active', active); option.setAttribute('aria-selected', String(active)); }); switcher.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', () => { const open = switcher.classList.toggle('open'); trigger.setAttribute('aria-expanded', String(open)); });
  switcher.querySelectorAll('[data-language]').forEach((option) => option.addEventListener('click', () => setLanguage(option.dataset.language)));
  document.addEventListener('click', (event) => { if (!switcher.contains(event.target)) { switcher.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); } });
  setLanguage(currentLanguage());
  if (window.MutationObserver) { const observer = new MutationObserver((mutations) => { if (currentLanguage() !== 'en') return; const hasNewIndonesianCopy = mutations.some((mutation) => [...mutation.addedNodes].some((node) => !node.closest?.('.language-switcher') && containsIndonesianCopy(node))); if (hasNewIndonesianCopy) translatePage('en'); }); observer.observe(document.body, {childList:true, subtree:true}); }
}
let catalog = [
  ['Banner', 'Banner outdoor', 'Rp 35.000', 'banner', 'Banner besar untuk promosi dan event.', 'assets/real/products/banner.jpg'],
  ['X-Banner', 'Display portable', 'Rp 85.000', 'x-banner', 'Praktis untuk booth dan presentasi.', 'assets/real/products/x-banner.jpg'],
  ['Spanduk', 'Spanduk promosi', 'Rp 25.000', 'spanduk', 'Pesan jelas, terlihat dari jauh.', 'assets/real/products/spanduk.jpg'],
  ['Sticker', 'Sticker custom', 'Rp 15.000', 'sticker', 'Buat brand-mu lebih mudah diingat.', 'assets/real/products/sticker.jpg'],
  ['Poster', 'Poster print', 'Rp 20.000', 'poster', 'Visual yang menarik perhatian.', 'assets/real/products/poster.jpg'],
  ['Kartu Nama', 'Kartu nama', 'Rp 30.000', 'kartu-nama', 'Kesan pertama yang profesional.', 'assets/real/products/kartu-nama.jpg'],
];
let showcaseProducts = [
  {name:'Cetak Sertifikat', slug:'cetak-sertif', category:'biru', type:'Sertifikat', price:'Rp5.000', unit:'pcs', image:'jpg'},
  {name:'Stiker Chromo A3+', slug:'cromo-fz-edited', category:'biru', type:'Sticker', price:'Rp5.000', unit:'pcs', image:'jpg'},
  {name:'Cetak Flyer/Brosur', slug:'flyer-brosur', category:'biru', type:'Flyer / Brosur', price:'Rp1.000', unit:'pcs', image:'jpg'},
  {name:'Canvas Custom', slug:'foto-sampul-canvas', category:'biru', type:'Foto / Canvas', price:'Rp30.000', unit:'pcs', image:'jpg'},
  {name:'Spanduk Banner', slug:'spanduk-banner', category:'outdoor', type:'Banner / Spanduk', price:'Rp25.000', unit:'m³', imagePath:'assets/real/products/spanduk.jpg', image:'jpg', materials:['Flexi China 260','Flexi China 330','Korea 440']},
  {name:'Cetak Kertas Kado', slug:'foto-utama-kado', category:'biru', type:'Kertas', price:'Rp5.000', unit:'pcs', image:'jpg'},
  {name:'Gantungan Kunci', slug:'ganci', category:'biru', type:'Merchandise', price:'Rp2.800', unit:'pcs', image:'jpg'},
  {name:'ID Card', slug:'id-card', category:'biru', type:'ID Card', price:'Rp12.500', unit:'pcs', image:'jpg'},
  {name:'Mini Banner', slug:'mini-banner', category:'biru', type:'Banner / Display', price:'Rp30.000', unit:'pcs', image:'jpg'},
  {name:'Mug Custom', slug:'mug-custom', category:'biru', type:'Merchandise', price:'Rp20.000', unit:'pcs', image:'jpg'},
  {name:'Roll Up Banner', slug:'roll-up-banner', category:'biru', type:'Banner / Display', price:'Rp220.000', unit:'pcs', image:'jpg'},
  {name:'Stiker Meteran', slug:'sticker-transparant-meteran', category:'biru', type:'Sticker', price:'Rp70.000', unit:'pcs', image:'jpg'},
  {name:'Stiker One Way', slug:'stiker-oneway', category:'biru', type:'Sticker', price:'Rp90.000', unit:'pcs', image:'jpg'},
  {name:'Stiker Transparan A3', slug:'stiker-transparant-a3', category:'biru', type:'Sticker', price:'Rp90.000', unit:'pcs', image:'jpg'},
  {name:'Stiker Vinyl A3+', slug:'vinyl-a3', category:'biru', type:'Sticker', price:'Rp12.500', unit:'pcs', image:'jpg'},
  {name:'X/Y Banner', slug:'x-y-banner', category:'biru', type:'Banner / Display', price:'Rp75.000', unit:'pcs', image:'jpg'},
  {name:'Art Paper 120gsm', slug:'foto-utama-ap120', category:'kuning', type:'Art Paper', price:'Rp3.000', unit:'pcs', image:'jpg'},
  {name:'Art Paper 210gsm', slug:'foto-utama-copy-0', category:'kuning', type:'Art Paper', price:'Rp4.000', unit:'pcs', image:'jpg'},
  {name:'Art Paper 150gsm', slug:'foto-utama', category:'kuning', type:'Art Paper', price:'Rp3.500', unit:'pcs', image:'jpg'},
  {name:'Art Paper 260gsm', slug:'tokopedia-mesin-laser-a3-260', category:'kuning', type:'Art Paper', price:'Rp5.000', unit:'pcs', image:'jpg'},
  {name:'Art Paper 310gsm', slug:'tokopedia-mesin-laser-a3-310', category:'kuning', type:'Art Paper', price:'Rp6.000', unit:'pcs', image:'jpg'},
  {name:'Tripod Banner', slug:'tripod-banner', category:'kuning', type:'Banner / Display', price:'Rp25.000', unit:'pcs', image:'jpg'},
];
const finishing = [['', 'Tanpa finishing', 'Hanya area cetak', 'Tidak ada biaya tambahan'], ['Matik', 'Matik', 'Laminasi matte halus', 'Tanpa biaya tambahan'], ['Selongsong', 'Selongsong', 'Area lipat / selongsong', 'Tanpa biaya tambahan'], ['Roll Banner', 'Roll Banner', 'Siap untuk roll banner', 'Tanpa biaya tambahan']];
const finishingProducts = new Set(showcaseProducts.filter((product) => product.type.includes('Banner') || product.type.includes('Spanduk')).map((product) => product.name).concat(['Banner', 'X-Banner', 'Spanduk']));
let basePrices = {Banner:35000,'X-Banner':85000,Spanduk:25000,'Spanduk Banner':25000,Sticker:15000,Poster:20000,'Kartu Nama':30000,'Cetak Sertifikat':5000,'Stiker Chromo A3+':5000,'Cetak Flyer/Brosur':1000,'Canvas Custom':30000,'Cetak Kertas Kado':5000,'Gantungan Kunci':2800,'ID Card':12500,'Mini Banner':30000,'Mug Custom':20000,'Roll Up Banner':220000,'Stiker Meteran':70000,'Stiker One Way':90000,'Stiker Transparan A3':90000,'Stiker Vinyl A3+':12500,'X/Y Banner':75000,'Art Paper 120gsm':3000,'Art Paper 210gsm':4000,'Art Paper 150gsm':3500,'Art Paper 260gsm':5000,'Art Paper 310gsm':6000,'Tripod Banner':25000};
function promoSortValue(product) { return [...product.name].reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 11), 0) % 997; }
let promoProducts = [];
let promoProductMap = new Map();
let promoTimerSettings = {enabled:true, visible:true, ends_at:null, mode:'one_time'};
function promoInfo(name) { return promoProductMap.get(name); }
function priceForProduct(name) { const promo = promoInfo(name); return promo?.promoPrice || basePrices[name] || 0; }
let dbCatalogRows = [];
let storefrontCategories = [];
let categoryBoxVisuals = {};
let categoryOrder = ['Outdoor', 'Indoor', 'A3'];
let categoryDescriptions = {Outdoor: 'Banner, display, dan media luar ruang.', Indoor: 'Sticker, merchandise, dan kebutuhan ruang dalam.', A3: 'Kertas, flyer, sertifikat, dan cetakan format A3.'};
async function hydrateCatalogFromDatabase() {
  const [rows, categories, timer, categoryVisuals] = await Promise.all([api('/api/catalog'), api('/api/categories'), api('/api/promo-settings'), api('/api/category-box-visuals').catch(() => ({items:[]}))]);
  if (!Array.isArray(rows) || !rows.length) throw new Error('Katalog MySQL kosong. Import schema.sql terlebih dahulu.');
  storefrontCategories = Array.isArray(categories) ? categories : [];
  categoryBoxVisuals = Object.fromEntries((Array.isArray(categoryVisuals?.items) ? categoryVisuals.items : []).map((item) => [item.name, item]));
  promoTimerSettings = timer && typeof timer === 'object' ? timer : promoTimerSettings;
  if (storefrontCategories.length) {
    categoryOrder = storefrontCategories.map((category) => category.name);
    categoryDescriptions = Object.fromEntries(storefrontCategories.map((category) => [category.name, category.description || `Produk kategori ${category.name}.`]));
  }
  dbCatalogRows = rows.map((row) => ({ ...row, image_path: productImagePath(row) }));
  basePrices = Object.fromEntries(rows.map((row) => [row.name, Number(row.base_price || 0)]));
  catalog = rows.map((row) => [row.name, row.product_type, money(row.base_price), productClass(row.name), row.product_type, productImagePath(row)]);
  showcaseProducts = rows.filter((row) => /^(assets\/products|assets\/real\/products)\//.test(String(row.image_path || ''))).map((row) => ({
    id: row.id, name: row.name, slug: row.slug, category: row.category, type: row.product_type,
    price: money(row.price ?? row.base_price), basePrice: Number(row.base_price || 0), sales_count: Number(row.sales_count || 0), kind: row.kind, unit: row.unit, materials: row.materials || [], image: String(productImagePath(row)).split('.').pop(), imagePath: productImagePath(row),
  }));
  promoProducts = promoTimerSettings.visible === false ? [] : rows.filter((row) => row.promo_id).map((row) => ({
    name: row.name, slug: row.slug, category: row.category, type: row.product_type, unit: row.unit,
    image: String(row.image_path).split('.').pop(), imagePath: row.image_path, originalPrice: Number(row.original_price ?? row.base_price),
    promoPrice: Number(row.promo_price), discount: Number(row.discount || row.discount_percent || 0), endsAt: row.promo_ends_at,
  }));
  promoProductMap = new Map(promoProducts.map((row) => [row.name, row]));
  products = rows.map((row) => ({name: row.name, sizes: row.sizes || [], materials: row.materials || [], kind: row.kind}));
}
const productImageById = {
  1:'assets/products/biru/cetak-sertif.jpg',2:'assets/products/biru/cromo-fz-edited.jpg',3:'assets/products/biru/flyer-brosur.jpg',4:'assets/products/biru/foto-sampul-canvas.jpg',5:'assets/real/products/spanduk.jpg',6:'assets/products/biru/foto-utama-kado.jpg',7:'assets/products/biru/ganci.jpg',8:'assets/products/biru/id-card.jpg',9:'assets/products/biru/mini-banner.jpg',10:'assets/products/biru/mug-custom.jpg',11:'assets/products/biru/roll-up-banner.jpg',12:'assets/products/biru/sticker-transparant-meteran.jpg',13:'assets/products/biru/stiker-oneway.jpg',14:'assets/products/biru/stiker-transparant-a3.jpg',15:'assets/products/biru/vinyl-a3.jpg',16:'assets/products/biru/x-y-banner.jpg',17:'assets/products/kuning/foto-utama-ap120.jpg',18:'assets/products/kuning/foto-utama-copy-0.jpg',19:'assets/products/kuning/foto-utama.jpg',20:'assets/products/kuning/tokopedia-mesin-laser-a3-260.jpg',21:'assets/products/kuning/tokopedia-mesin-laser-a3-310.jpg',22:'assets/products/kuning/tripod-banner.jpg',23:'assets/real/products/banner.jpg',24:'assets/real/products/x-banner.jpg',25:'assets/real/products/spanduk.jpg',26:'assets/real/products/sticker.jpg',27:'assets/real/products/poster.jpg',28:'assets/real/products/kartu-nama.jpg',42:'assets/products/a3/polaroid.png'
};
function productImagePath(row) {
  const candidate=String(row?.image_path||'').replace(/^\//,'');
  if(/^assets\/(?:products|real\/products)\/[\w./-]+$/.test(candidate))return candidate;
  return productImageById[Number(row?.id)]||'assets/real/products/banner.jpg';
}
function renderUniversalProductCard(row, categoryLabel=row.category||'Produk', groupIndex=0, index=0) {
  const promo=promoInfo(row.name), price=promo?money(promo.promoPrice):money(row.promo_price??row.basePrice??row.base_price??row.price), original=promo?`<del>${money(promo.originalPrice)}</del>`:'', unit=String(row.unit||'pcs');
  const sold=showcaseStats(row).sold;
  return `<article class="showcase-card${promo?' has-promo':''}" data-product="${escapeHtml(row.name)}" data-product-category="${escapeHtml(categoryLabel)}" style="--delay:${groupIndex*80+index*25}ms"><div class="showcase-card-media"><img src="/${productImagePath(row)}" alt="${escapeHtml(row.name)}" loading="lazy">${promo?`<span class="showcase-promo-ribbon">-${promo.discount}% PROMO</span>`:''}</div><div class="showcase-card-body"><span class="product-type">${escapeHtml(row.product_type||row.type||'Produk')}</span><h3>${escapeHtml(row.name)}</h3><div class="showcase-rating"><span>${sold} terjual</span></div><div class="showcase-meta">${original}<strong class="${promo?'showcase-promo-price':''}">${price}</strong><small>/ ${escapeHtml(unit)}</small></div><div class="showcase-card-actions"><button type="button" class="product-order" data-product="${escapeHtml(row.name)}">Pesan sekarang</button><button type="button" class="product-cart" data-product="${escapeHtml(row.name)}">Tambah ke keranjang</button></div></div></article>`;
}
function bindUniversalProductCards(root) {
  root.querySelectorAll('.showcase-card').forEach((card)=>{
    const open=()=>{location.href=`product.html?product=${encodeURIComponent(card.dataset.product||'')}`;};
    card.addEventListener('click',(event)=>{if(!event.target.closest('button'))open();});
    card.querySelector('.product-order')?.addEventListener('click',(event)=>{event.stopPropagation();open();});
    card.querySelector('.product-cart')?.addEventListener('click',(event)=>{event.stopPropagation();openQuickAdd(event.currentTarget.dataset.product);});
  });
}
let activeFeaturedCategorySlug = '';
let activeFeaturedCategoryName = '';
function renderFeaturedCategoryLinks() {
  const node=$('#featuredCategoryLinks'); if(!node)return;
  const icons={outdoor:'<path d="M3 19h18L12 5 3 19Z"/><path d="M12 13v6m-3 0 3-4 3 4"/>',indoor:'<path d="M4 20V8l8-5 8 5v12H4Z"/><path d="M9 20v-6h6v6m-6-9h.01m6 0h.01"/>',a3:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7m-7 3h7"/>'};
  const categories=storefrontCategories.length?storefrontCategories:[...new Set(dbCatalogRows.map((row)=>String(row.category||'')).filter(Boolean))].map((slug)=>({slug,name:slug.toLowerCase()==='a3'?'A3':slug.charAt(0).toUpperCase()+slug.slice(1)}));
  const categoryDescription=(category)=>{const key=`${category.slug||''} ${category.name||''}`.toLowerCase();if(key.includes('outdoor'))return 'Banner, spanduk, dan media cetak untuk kebutuhan luar ruang.';if(key.includes('indoor'))return 'Sticker, poster, canvas, dan merchandise untuk kebutuhan dalam ruang.';if(key.includes('a3'))return 'Flyer, sertifikat, dan berbagai cetakan kertas format A3.';return String(category.description||categoryDescriptions[category.name]||`Pilihan produk ${category.name} untuk kebutuhan cetakmu.`).trim();};
  const allButton=`<button type="button" class="featured-category-link featured-category-link-all" data-category-tone="all" data-featured-category="__all__" data-category-name="__all__" aria-pressed="false"><span class="featured-category-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg></span><span class="featured-category-content"><span class="featured-category-heading"><b>Lihat semua</b><small>${showcaseProducts.length||dbCatalogRows.length} produk</small></span><span class="featured-category-description">Tampilkan semua pilihan Outdoor, Indoor, dan A3 sekaligus.</span></span></button>`;
  node.innerHTML=allButton+categories.map((category)=>`<button type="button" class="featured-category-link" data-category-tone="${escapeHtml(String(category.slug||'')+' '+String(category.name||'')).toLowerCase()}" data-featured-category="${escapeHtml(category.slug)}" data-category-name="${escapeHtml(category.name)}" aria-pressed="false"><span class="featured-category-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[String(category.slug||'').toLowerCase()]||icons.a3}</svg></span><span class="featured-category-heading"><b>${escapeHtml(category.name)}</b><small>${Number(category.product_count||dbCatalogRows.filter((row)=>row.category===category.slug).length)} produk</small></span><p class="featured-category-description">${escapeHtml(categoryDescription(category))}</p></button>`).join('');
  const normalizeCategory=(value)=>String(value||'').trim().toLowerCase();
  const applyCategory=(button,scroll=false)=>{
    if(!button)return;
    const panels=Array.from($('#catalog')?.querySelectorAll('.showcase-category-panel[data-showcase-category]')||[]);
    const showAll=button.dataset.featuredCategory==='__all__';
    const selected=showAll?'':String(button.dataset.featuredCategory||'');
    const selectedName=showAll?'':String(button.dataset.categoryName||selected);
    activeFeaturedCategorySlug=selected;
    activeFeaturedCategoryName=selectedName;
    node.querySelectorAll('[data-featured-category]').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));
    panels.forEach((panel)=>{panel.hidden=!showAll&&normalizeCategory(panel.dataset.showcaseCategory)!==normalizeCategory(selectedName);});
    if(scroll)$('#products')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  node.onclick=(event)=>{
    const button=event.target.closest?.('[data-featured-category]');
    if(!button||!node.contains(button))return;
    event.preventDefault();
    applyCategory(button,true);
  };
  const panels=Array.from($('#catalog')?.querySelectorAll('.showcase-category-panel[data-showcase-category]')||[]);
  const initialButton=node.querySelector('[data-featured-category="__all__"]')||[...node.querySelectorAll('[data-featured-category]')].find((button)=>normalizeCategory(button.dataset.categoryName)===normalizeCategory(panels[0]?.dataset.showcaseCategory))||node.querySelector('[data-featured-category]');
  applyCategory(initialButton);
}
const defaultUnits = {Banner:'m','X-Banner':'m',Spanduk:'m',Sticker:'cm',Poster:'cm','Kartu Nama':'cm'};
function productKind(name) { return products.find((entry) => entry.name === name)?.kind || (name === 'Sticker' ? 'sticker' : 'custom'); }
function isStickerProduct(name) { return productKind(name) === 'sticker'; }
const stickerBulkProducts = new Set(['Sticker','Stiker Chromo A3+','Stiker Meteran','Stiker Transparan A3','Stiker Vinyl A3+']);
const stickerSingleProducts = new Set(['Stiker One Way']);
function isBulkSticker(name) { return stickerBulkProducts.has(name); }
const sizeLimitsM2 = {Banner:[0.25,1000], 'X-Banner':[0.3,100], Spanduk:[0.25,1000], Sticker:[0.0004,10], Poster:[0.01,100], 'Kartu Nama':[0.0002,0.1]};
let products = [];
let selectedFinishing = '';
let previewResult = null;

async function api(path, options = {}) { const response = await fetch(path, options); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `Request gagal (${response.status})`); return body; }
function toast(message) { const node = $('#toast'); if (!node) return; node.classList.remove('success'); node.textContent = message; node.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => node.classList.remove('show'), 6500); node.onpointerenter = () => clearTimeout(window.toastTimer); node.onpointerleave = () => { clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => node.classList.remove('show'), 1500); }; }
function successToast(message, linkText = '', linkHref = 'cart.html') { const node = $('#toast'); if (!node) return; node.innerHTML = `<span>${escapeHtml(message)}</span>${linkText ? `<a href="${escapeHtml(linkHref)}">${escapeHtml(linkText)}</a>` : ''}`; node.classList.add('success', 'show'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => node.classList.remove('show'), 5200); }
function productClass(product) { return product.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
function money(value) { return `Rp ${Math.round(value).toLocaleString('id-ID')}`; }
function refreshCustomSelect(select) { const wrapper = select?.nextElementSibling; if (!select || !wrapper?.classList.contains('custom-select')) return; const options = [...select.options]; const selected = select.options[select.selectedIndex]; wrapper.querySelector('.custom-select-button').textContent = selected?.textContent || 'Pilih opsi'; wrapper.querySelector('.custom-select-menu').innerHTML = options.map((option) => `<button type="button" class="custom-select-option ${option.selected ? 'selected' : ''}" data-value="${escapeHtml(option.value)}" role="option" aria-selected="${option.selected}">${escapeHtml(option.textContent)}</button>`).join(''); wrapper.querySelectorAll('.custom-select-option').forEach((option) => option.addEventListener('click', () => { select.value = option.dataset.value; select.dispatchEvent(new Event('change', {bubbles:true})); wrapper.classList.remove('open'); })); }
function enhanceSelect(select) { if (!select || select.dataset.customized) { refreshCustomSelect(select); return; } select.dataset.customized = 'true'; select.hidden = true; const wrapper = document.createElement('div'); wrapper.className = 'custom-select'; wrapper.innerHTML = '<button type="button" class="custom-select-button" aria-haspopup="listbox" aria-expanded="false">Pilih opsi</button><div class="custom-select-menu" role="listbox"></div>'; select.after(wrapper); wrapper.querySelector('.custom-select-button').addEventListener('click', () => { const open = wrapper.classList.toggle('open'); wrapper.querySelector('.custom-select-button').setAttribute('aria-expanded', String(open)); document.querySelectorAll('.custom-select.open').forEach((other) => { if (other !== wrapper) other.classList.remove('open'); }); }); select.addEventListener('change', () => refreshCustomSelect(select)); refreshCustomSelect(select); }
function setupCustomSelects() { document.querySelectorAll('select:not(#catalogSort)').forEach(enhanceSelect); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])); }

function cartItems() { try { return JSON.parse(localStorage.getItem('fazima-print-cart') || '[]'); } catch (_) { return []; } }
function saveCart(items) { localStorage.setItem('fazima-print-cart', JSON.stringify(items)); updateCartCount(); }
function updateCartCount() { document.querySelectorAll('[data-cart-count]').forEach((node) => { const count = cartItems().reduce((sum, item) => sum + Number(item.quantity || 1), 0); node.textContent = count; }); }



function setupTheme() {
  document.body.classList.remove('dark-theme');
  // Every customer page already loads arc-ui.css in <head>. Do not append a
  // second copy here: duplicate styles made the cascade depend on load timing.
  const themeLinks = [...document.querySelectorAll('link[rel="stylesheet"][href*="arc-ui.css"]')];
  themeLinks.slice(1).forEach((link) => link.remove());
  if (!themeLinks.length) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'arc-ui.css?v=20260904-css-audit';
    document.head.appendChild(link);
  }
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => button.remove());
}

function setupChat() {
  const chatPanel = $('.chat-panel');
  if (!chatPanel) return;
  const sessionKey = 'fazima-chat-session-id';
  const sessionsKey = 'fazima-chat-sessions';
  const makeSessionId = () => globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'chat-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  let sessionId = localStorage.getItem(sessionKey) || makeSessionId();
  localStorage.setItem(sessionKey, sessionId);
  let savedSessions = [];
  try { const stored = JSON.parse(localStorage.getItem(sessionsKey) || '[]'); if (Array.isArray(stored)) savedSessions = [...new Set(stored.filter((id) => typeof id === 'string' && id))].slice(0, 12); }
  catch (_) { localStorage.removeItem(sessionsKey); }
  const localMessagesKey = (id) => 'fazima-chat-messages-' + id;
  const readLocalMessages = (id) => { try { const value = JSON.parse(localStorage.getItem(localMessagesKey(id)) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } };
  const saveLocalMessages = (id, items) => { try { localStorage.setItem(localMessagesKey(id), JSON.stringify(items.slice(-200))); } catch (error) { console.warn('Riwayat chat tidak dapat disimpan di perangkat:', error); } };
  const saveSessionList = () => { try { localStorage.setItem(sessionsKey, JSON.stringify(savedSessions.slice(0, 12))); } catch (error) { console.warn('Daftar sesi chat tidak dapat disimpan:', error); } };
  let history = [];
  const chatHead = chatPanel.querySelector('.chat-head');
  if (!document.querySelector('#fazima-chat-history-style')) {
    const style = document.createElement('style'); style.id = 'fazima-chat-history-style';
    style.textContent = '.chat-panel-controls{display:flex;gap:6px;margin-left:auto}.chat-panel-controls button{border:1px solid rgba(20,34,31,.2);background:#fff;color:#19312b;border-radius:999px;padding:5px 8px;font-size:10px;cursor:pointer}.chat-panel-controls .chat-new-session{background:#ef7048;color:#fff;border-color:#ef7048}.chat-session-history{padding:9px 12px;border-bottom:1px solid rgba(20,34,31,.12);background:#f6f5ef}.chat-history-title{font-size:10px;font-weight:700;color:#7d877f;margin-bottom:7px}.chat-history-list{display:grid;gap:6px;max-height:140px;overflow:auto}.chat-history-item{display:block;width:100%;border:1px solid #d9ddd5;background:#fff;border-radius:8px;padding:8px 9px;text-align:left;cursor:pointer}.chat-history-item.active{border-color:#ef7048;box-shadow:0 0 0 2px #ef704822}.chat-history-item b,.chat-history-item small{display:block;font-size:10px}.chat-history-item small{color:#9aa39c;font-family:monospace;margin-top:2px}.chat-history-empty{display:block;padding:6px;color:#7d877f;font-size:11px}.chat-panel .chat-head{display:flex;align-items:center;gap:8px}';
    document.head.appendChild(style);
  }
  if (chatHead && !chatPanel.querySelector('.chat-history-toggle')) {
    const controls = document.createElement('div'); controls.className = 'chat-panel-controls';
    controls.innerHTML = '<button type="button" class="chat-history-toggle"><b>Riwayat</b></button><button type="button" class="chat-new-session"><b>Baru</b></button>';
    chatHead.appendChild(controls);
    const buttonStyle = document.createElement('style');
    buttonStyle.textContent = '.chat-panel .chat-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:10px!important}.chat-panel .chat-head>div:first-child{min-width:0}.chat-panel .chat-head>[data-close-chat]{order:2;width:36px!important;height:36px!important;display:grid!important;place-items:center!important;flex:none!important;border:1px solid #dce5df!important;border-radius:10px!important;background:#fff!important;color:#19312b!important}.chat-panel-controls{order:3;grid-column:1/-1;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:2px 0 0!important;width:100%!important}.chat-panel-controls button{display:flex!important;align-items:center;justify-content:center;gap:7px;height:42px!important;min-width:0!important;padding:0 12px!important;border:1px solid #d5e0d8!important;border-radius:10px!important;background:#f4f7f3!important;color:#19312b!important;font-size:12px!important;font-weight:800!important;line-height:1!important;box-shadow:none!important;cursor:pointer!important}.chat-panel-controls .chat-new-session{background:#ef7048!important;border-color:#ef7048!important;color:#fff!important}';
    document.head.appendChild(buttonStyle);
    const historyPanel = document.createElement('div'); historyPanel.className = 'chat-session-history'; historyPanel.hidden = true;
    historyPanel.innerHTML = '<div class="chat-history-title">Percakapan tersimpan</div><div class="chat-history-list"></div>';
    chatPanel.insertBefore(historyPanel, chatPanel.querySelector('.chat-messages'));
    controls.querySelector('.chat-history-toggle').addEventListener('click', async () => { historyPanel.hidden = !historyPanel.hidden; if (!historyPanel.hidden) await renderSavedSessions(); });
    controls.querySelector('.chat-new-session').addEventListener('click', () => {
      sessionId = makeSessionId(); localStorage.setItem(sessionKey, sessionId); history = []; historyPanel.hidden = true;
      const messages = $('.chat-messages'); if (messages) messages.innerHTML = '<p class="chat-bubble bot">Halo! Sesi baru siap. Ada yang ingin ditanyakan?</p>';
    });
  }
  const renderMessages = (items) => {
    const target = $('.chat-messages'); if (!target) return;
    target.innerHTML = items.length ? items.map((item) => '<p class="chat-bubble ' + (item.role === 'user' ? 'user' : 'bot') + '">' + escapeHtml(item.message || item.text || '') + '</p>').join('') : '<p class="chat-bubble bot">Halo! Ada yang ingin ditanyakan tentang produk atau pesanan?</p>';
    target.scrollTop = target.scrollHeight;
  };
  const fetchMessages = async (id) => {
    try { const items = await api('/api/chat/sessions/' + encodeURIComponent(id)); if (Array.isArray(items) && items.length) return {items, failed:false}; return {items:readLocalMessages(id), failed:false}; }
    catch (error) { console.warn('Riwayat chat gagal dimuat dari server:', error); return {items:readLocalMessages(id), failed:true}; }
  };
  const loadSession = async (id = sessionId) => {
    const target = $('.chat-messages'); if (target) target.innerHTML = '<p class="chat-bubble bot">Memuat riwayat...</p>';
    const result = await fetchMessages(id);
    if (id !== sessionId) return;
    history = result.items.filter((item) => item.role === 'user' || item.role === 'model').map((item) => ({role:item.role, text:item.message || item.text || ''}));
    renderMessages(result.items);
    if (result.failed && !result.items.length && savedSessions.includes(id)) toast('Riwayat chat tidak dapat dimuat. Periksa koneksi lalu coba lagi.');
    if (chatPanel.querySelector('.chat-session-history:not([hidden])')) await renderSavedSessions();
  };
  const renderSavedSessions = async () => {
    const list = chatPanel.querySelector('.chat-history-list'); if (!list) return;
    if (!savedSessions.length) { list.innerHTML = '<small class="chat-history-empty">Belum ada percakapan tersimpan.</small>'; return; }
    list.innerHTML = '<small class="chat-history-empty">Memuat percakapan...</small>';
    const results = await Promise.all(savedSessions.map(async (id) => ({id, ...(await fetchMessages(id))})));
    const available = results.filter(({items,failed}) => items.length || failed);
    savedSessions = available.map(({id}) => id); saveSessionList();
    if (!available.length) { list.innerHTML = '<small class="chat-history-empty">Belum ada percakapan tersimpan.</small>'; return; }
    list.innerHTML = available.map(({id,items,failed}) => {
      const first = items.find((item) => item.role === 'user');
      const title = first ? (first.message || first.text || 'Percakapan') : (failed ? 'Riwayat belum dapat dimuat' : 'Percakapan');
      const preview = title.length > 42 ? title.slice(0, 42) + '...' : title;
      return '<button type="button" data-chat-session="' + escapeHtml(id) + '" class="chat-history-item ' + (id === sessionId ? 'active' : '') + '"><b>' + escapeHtml(preview) + '</b><small>' + (items.length || 0) + ' pesan � ' + escapeHtml(id.slice(0, 8)) + '</small></button>';
    }).join('');
    list.querySelectorAll('[data-chat-session]').forEach((button) => button.addEventListener('click', async () => { sessionId = button.dataset.chatSession; localStorage.setItem(sessionKey, sessionId); await loadSession(sessionId); }));
  };
  document.querySelectorAll('[data-open-chat]').forEach((button) => button.addEventListener('click', async (event) => { event.preventDefault(); chatPanel.hidden = false; await loadSession(); }));
  document.querySelectorAll('[data-close-chat]').forEach((button) => button.addEventListener('click', () => { chatPanel.hidden = true; }));
  const form = $('.chat-form');
  if (form) form.addEventListener('submit', async (event) => {
    event.preventDefault(); const input = form.querySelector('input'); const text = input.value.trim(); if (!text) return;
    const messages = $('.chat-messages'); const submit = form.querySelector('button'); if (!messages) return;
    messages.insertAdjacentHTML('beforeend', '<p class="chat-bubble user">' + escapeHtml(text) + '</p><p class="chat-bubble bot chat-pending">Mengetik...</p>');
    input.value = ''; input.disabled = true; if (submit) submit.disabled = true; messages.scrollTop = messages.scrollHeight;
    try {
      const result = await api('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:text, history, session_id:sessionId})});
      const pending = messages.querySelector('.chat-pending'); if (pending) { pending.classList.remove('chat-pending'); pending.textContent = result.answer; }
      history.push({role:'user', text}, {role:'model', text:result.answer});
      saveLocalMessages(sessionId, history.map((item) => ({role:item.role, message:item.text})));
      if (!savedSessions.includes(sessionId)) { savedSessions.unshift(sessionId); savedSessions = savedSessions.slice(0, 12); saveSessionList(); }
      if (chatPanel.querySelector('.chat-session-history:not([hidden])')) await renderSavedSessions();
    } catch (error) {
      const pending = messages.querySelector('.chat-pending'); if (pending) { pending.classList.remove('chat-pending'); pending.textContent = error.message || 'Chat belum dapat menjawab. Coba lagi.'; }
    } finally { input.disabled = false; if (submit) submit.disabled = false; input.focus(); messages.scrollTop = messages.scrollHeight; }
  });
}function setupMobileMenu() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  let nav = header.querySelector('.main-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'main-nav';
    nav.dataset.mobileGenerated = 'true';
    nav.innerHTML = '<a href="/">Beranda</a><a href="about.html">Tentang</a><a href="cart.html">Keranjang</a>';
    header.insertBefore(nav, header.querySelector('.header-actions'));
  }
  let button = header.querySelector('.mobile-menu');
  if (!button) {
    button = document.createElement('button');
    button.className = 'icon-button mobile-menu';
    button.type = 'button';
    button.textContent = '☰';
    header.appendChild(button);
  }
  nav.id = nav.id || `${page}-navigation`;
  button.setAttribute('aria-controls', nav.id);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Buka menu');
  const setOpen = (open) => {
    nav.classList.toggle('mobile-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  };
  button.addEventListener('click', () => setOpen(!nav.classList.contains('mobile-open')));
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
}
function setupMobileSearchToggle() {
  const header = document.querySelector('.site-header--clean');
  const toggle = header?.querySelector('.mobile-search-toggle');
  const search = header?.querySelector('.navbar-search');
  if (!header || !toggle || !search || toggle.dataset.ready) return;
  toggle.dataset.ready = 'true';
  const setOpen = (open) => {
    header.classList.toggle('mobile-search-open', open);
    document.body.classList.toggle('mobile-search-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Sembunyikan pencarian' : 'Tampilkan pencarian');
    if (open) search.querySelector('input')?.focus();
  };
  toggle.addEventListener('click', () => setOpen(!header.classList.contains('mobile-search-open')));
}
function setupSpiderInteraction() {
  const spider = document.querySelector('.comic-spider');
  if (!spider || spider.dataset.interactive) return;
  spider.dataset.interactive = 'true';
  spider.title = 'Tarik laba-laba, lalu lepaskan';
  spider.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    spider.classList.add('interactive-ready', 'is-dragging');
    spider.setPointerCapture(event.pointerId);
    const baseHeight = parseFloat(getComputedStyle(spider).height);
    const anchor = spider.getBoundingClientRect();
    const anchorX = anchor.left + anchor.width / 2;
    const anchorY = anchor.top;
    const initialEndpoint = {x: anchorX, y: anchorY + baseHeight};
    const grabOffset = {x: initialEndpoint.x - event.clientX, y: initialEndpoint.y - event.clientY};
    const state = {x: 0, y: baseHeight, vx: 0, vy: 0, lastX: event.clientX, lastY: event.clientY, raf: 0};
    const draw = () => {
      spider.style.height = `${Math.max(18, Math.hypot(state.x, state.y))}px`;
      spider.style.setProperty('--spider-angle', `${Math.atan2(-state.x, state.y) * 180 / Math.PI}deg`);
    };
    const stopSpring = () => { if (state.raf) cancelAnimationFrame(state.raf); state.raf = 0; };
    const springBack = (time) => {
      if (!state.lastTime) state.lastTime = time;
      const dt = Math.min((time - state.lastTime) / 1000, .032);
      state.lastTime = time;
      state.vx += (-145 * state.x - 19 * state.vx) * dt;
      state.vy += (-145 * (state.y - baseHeight) - 19 * state.vy) * dt;
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      draw();
      if (Math.abs(state.x) < .25 && Math.abs(state.y - baseHeight) < .25 && Math.abs(state.vx) < 1 && Math.abs(state.vy) < 1) {
        spider.style.height = '';
        spider.style.removeProperty('--spider-angle');
        spider.classList.remove('is-returning');
        state.raf = 0;
        return;
      }
      state.raf = requestAnimationFrame(springBack);
    };
    const move = (moveEvent) => {
      state.x = moveEvent.clientX + grabOffset.x - anchorX;
      state.y = moveEvent.clientY + grabOffset.y - anchorY;
      state.vx = (moveEvent.clientX - state.lastX) * 8;
      state.vy = (moveEvent.clientY - state.lastY) * 8;
      state.lastX = moveEvent.clientX;
      state.lastY = moveEvent.clientY;
      draw();
    };
    const release = (releaseEvent) => {
      if (spider.hasPointerCapture(releaseEvent.pointerId)) spider.releasePointerCapture(releaseEvent.pointerId);
      spider.removeEventListener('pointermove', move);
      spider.removeEventListener('pointerup', release);
      spider.removeEventListener('pointercancel', release);
      spider.classList.remove('is-dragging');
      spider.classList.add('is-returning');
      stopSpring();
      state.lastTime = 0;
      state.raf = requestAnimationFrame(springBack);
    };
    spider.addEventListener('pointermove', move);
    spider.addEventListener('pointerup', release);
    spider.addEventListener('pointercancel', release);
  });
}
function setupAnimations() { const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), {threshold:.12}); document.querySelectorAll('.reveal').forEach((node) => observer.observe(node)); document.querySelectorAll('.product-card').forEach((card) => card.addEventListener('pointermove', (event) => { const rect = card.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width - .5) * 5; const y = ((event.clientY - rect.top) / rect.height - .5) * -5; card.style.transform = `perspective(700px) rotateX(${y}deg) rotateY(${x}deg) translateY(-5px)`; })); document.querySelectorAll('.product-card').forEach((card) => card.addEventListener('pointerleave', () => { card.style.transform = ''; })); setupSpiderInteraction(); }

function showcaseCard(product, index) {
  const image = `/${product.imagePath || `assets/products/${product.category}/${product.slug}.${product.image}`}`;
  return `<article class="showcase-card reveal" style="--delay:${index * 35}ms"><img src="${image}" alt="${escapeHtml(product.name)}"><div class="showcase-card-body"><span class="product-type">${escapeHtml(product.type)}</span><h3>${escapeHtml(product.name)}</h3><div class="showcase-meta"><strong>${escapeHtml(product.price)}</strong><small>/ ${escapeHtml(product.unit)}</small></div><div class="product-bottom"><button type="button" data-product="${escapeHtml(product.name)}">Pilih</button></div></div></article>`;
}
function catalogCategory(product) {
  const match = storefrontCategories.find((category) => category.slug === product.category || category.name.toLowerCase() === String(product.category || '').toLowerCase());
  return match?.name || product.category || 'Indoor';
}
function showcaseStats(product) { return {rating: '4.9', sold: Number(product.sales_count || 0).toLocaleString('id-ID')}; }
let quickAddProduct = '';
let quickAddModal = null;
let quickAddProductsPromise = null;
function quickAddProductData(name) { return products.find((item) => item.name === name) || {name, sizes: name === 'Sticker' ? ['A3'] : ['Custom'], kind: productKind(name)}; }
function quickAddSizeValue(form) {
  const preset = form.querySelector('[name="quick_size_preset"]');
  if (preset.value !== 'Custom') return preset.value;
  const width = form.querySelector('[name="quick_width"]').value;
  const height = form.querySelector('[name="quick_height"]').value;
  return width && height ? `${width}x${height} ${form.querySelector('[name="quick_unit"]').value}` : '';
}
function quickAddIsBanner(name) { return productKind(name) === 'banner' || finishingProducts.has(name); }
function quickAddIsSticker(name) { return isStickerProduct(name) || quickAddProductData(name).kind === 'sticker'; }
function openQuickAdd(name) {
  quickAddProduct = name;
  const render = () => { renderQuickAddModal(name); quickAddModal.hidden = false; document.body.classList.add('modal-open'); quickAddModal.querySelector('[name="quick_size_preset"]')?.focus(); };
  if (products.length) render();
  else { quickAddProductsPromise ||= api('/api/products').then((items) => { products = items; return items; }); quickAddProductsPromise.then(render).catch(() => toast('Produk belum dapat dimuat.')); }
}
function closeQuickAdd() { if (!quickAddModal) return; quickAddModal.hidden = true; document.body.classList.remove('modal-open'); }
function renderQuickAddModal(name) {
  if (!quickAddModal) {
    quickAddModal = document.createElement('section');
    quickAddModal.className = 'quick-add-modal';
    quickAddModal.hidden = true;
    quickAddModal.setAttribute('role', 'dialog');
    quickAddModal.setAttribute('aria-modal', 'true');
    document.body.appendChild(quickAddModal);
  }
  const item = quickAddProductData(name);
  const banner = quickAddIsBanner(name);
  const sticker = quickAddIsSticker(name);
  const sizes = item.sizes?.length ? item.sizes : ['Custom'];
  quickAddModal.innerHTML = `<div class="quick-add-backdrop" data-quick-close></div><form class="quick-add-card" id="quickAddForm"><button class="quick-add-close" type="button" data-quick-close aria-label="Tutup">×</button><div class="quick-add-heading"><span class="eyebrow">TAMBAH KE KERANJANG</span><h2>${escapeHtml(name)}</h2><p>Pilih spesifikasi cetak sebelum menambahkan produk.</p></div><div class="quick-add-fields"><label>Ukuran<select name="quick_size_preset" required>${sizes.map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join('')}</select></label><label>Jumlah<input name="quick_quantity" type="number" min="1" value="1" required><small>Jumlah unit yang ingin dicetak</small></label></div><div class="quick-custom-size" hidden><label>Lebar<input name="quick_width" type="number" min="0.01" step="any"></label><label>Tinggi<input name="quick_height" type="number" min="0.01" step="any"></label><label>Satuan<select name="quick_unit"><option value="m">meter (m)</option><option value="cm">sentimeter (cm)</option><option value="mm">milimeter (mm)</option></select></label></div>${banner ? `<fieldset class="quick-add-section"><legend>Finishing</legend><div class="quick-finishing-options">${finishing.map(([value, title, text, price], index) => `<label><input type="radio" name="quick_finishing" value="${escapeHtml(value)}" ${index === 0 ? 'checked' : ''}><span><b>${escapeHtml(title)}</b><small>${escapeHtml(text)}</small></span><strong>${escapeHtml(price)}</strong></label>`).join('')}</div></fieldset><fieldset class="quick-add-section"><legend>Orientasi preview</legend><div class="quick-choice-row"><label><input type="radio" name="quick_orientation" value="horizontal" checked><span>Horizontal</span></label><label><input type="radio" name="quick_orientation" value="vertical"><span>Vertikal</span></label></div></fieldset>` : ''}${sticker ? `<fieldset class="quick-add-section"><legend>Opsi sticker</legend><div class="quick-add-fields"><label>Bentuk sticker<select name="quick_sticker_shape"><option value="Kotak">Kotak</option><option value="Bulat">Bulat</option><option value="Custom">Mengikuti desain</option></select></label><label>Ukuran sticker<select name="quick_sticker_size"><option value="5x5 cm">5 × 5 cm</option><option value="7x7 cm">7 × 7 cm</option><option value="10x10 cm">10 × 10 cm</option></select></label></div><p class="quick-help">Kapasitas A3 dihitung otomatis berdasarkan ukuran sticker.</p></fieldset>` : ''}<fieldset class="quick-add-section"><legend>File desain</legend><label class="quick-upload"><input name="quick_file" type="file" accept=".jpg,.jpeg,.png,.pdf" required><strong>Pilih file desain</strong><span>JPG, PNG, atau PDF · maksimal 50 MB</span></label></fieldset><details class="quick-advanced"><summary>Opsi file lanjutan</summary><div class="quick-add-fields"><label>Mode warna<select name="quick_color"><option>Original</option><option>RGB</option><option>CMYK</option><option>Grayscale</option></select></label><label>Format file<select name="quick_format"><option>PNG</option><option>JPG</option><option>PDF</option></select></label></div><label class="quick-check"><input name="quick_scale" type="checkbox" checked><span><b>Perbesar kualitas</b><small>Render 2× untuk hasil lebih tajam</small></span></label></details><div class="quick-add-error" role="alert" hidden></div><div class="quick-add-actions"><button class="secondary" type="button" data-quick-close>Batal</button><button class="primary" type="submit">Tambah ke keranjang</button></div></form>`;
  const form = quickAddModal.querySelector('#quickAddForm');
  const preset = form.querySelector('[name="quick_size_preset"]');
  const custom = quickAddModal.querySelector('.quick-custom-size');
  const syncCustom = () => { custom.hidden = preset.value !== 'Custom'; };
  preset.addEventListener('change', syncCustom); syncCustom();
  quickAddModal.querySelectorAll('[data-quick-close]').forEach((button) => button.addEventListener('click', closeQuickAdd));
  const fileInput = form.querySelector('[name="quick_file"]');
  fileInput.addEventListener('change', () => {
    const upload = form.querySelector('.quick-upload');
    const title = upload.querySelector('strong');
    const meta = upload.querySelector('span');
    const file = fileInput.files[0];
    upload.classList.toggle('has-file', Boolean(file));
    if (file) { title.textContent = 'File siap ditambahkan'; meta.textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`; }
    else { title.textContent = 'Pilih file desain'; meta.textContent = 'JPG, PNG, atau PDF · maksimal 50 MB'; }
  });
  form.addEventListener('submit', submitQuickAdd);
  translatePage(currentLanguage());
}
async function submitQuickAdd(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorNode = form.querySelector('.quick-add-error');
  const size = quickAddSizeValue(form);
  const file = form.querySelector('[name="quick_file"]').files[0];
  if (!size || !file) { errorNode.textContent = !size ? 'Pilih ukuran produk terlebih dahulu.' : 'Upload file desain terlebih dahulu.'; errorNode.hidden = false; return; }
  if (file.size > 50 * 1024 * 1024) { errorNode.textContent = 'Ukuran file maksimal 50 MB.'; errorNode.hidden = false; return; }
  const button = form.querySelector('[type="submit"]'); button.disabled = true; button.setAttribute('aria-busy', 'true'); button.innerHTML = '<span class="quick-submit-loader" aria-hidden="true"><span class="quick-rocket">🚀</span><span class="quick-projectile quick-projectile-one"></span><span class="quick-projectile quick-projectile-two"></span></span><span>Memproses preview</span>'; form.classList.add('is-processing'); errorNode.hidden = true;
  const payload = new FormData();
  payload.set('product', quickAddProduct); payload.set('size', size); payload.set('quantity', form.querySelector('[name="quick_quantity"]').value); payload.set('customer', 'quick cart');
  payload.set('finishing', form.querySelector('[name="quick_finishing"]:checked')?.value || ''); payload.set('color_mode', form.querySelector('[name="quick_color"]')?.value || 'Original'); payload.set('output_format', form.querySelector('[name="quick_format"]')?.value || 'PNG'); payload.set('scale_up', form.querySelector('[name="quick_scale"]')?.checked ? 'true' : 'false');
  payload.set('preview_orientation', form.querySelector('[name="quick_orientation"]:checked')?.value || 'horizontal'); payload.set('sticker_shape', form.querySelector('[name="quick_sticker_shape"]')?.value || ''); payload.set('sticker_size', form.querySelector('[name="quick_sticker_size"]')?.value || ''); payload.set('file', file);
  try {
    const result = await api('/api/layouts', {method:'POST', body:payload});
    const quantity = Number(form.querySelector('[name="quick_quantity"]').value || 1);
    const selectedFinish = finishing.find((entry) => entry[0] === (form.querySelector('[name="quick_finishing"]:checked')?.value || '')) || finishing[0];
    const item = quickAddProductData(quickAddProduct); const parsed = parseSize(size); const area = sizeAreaM2(size); const kind = productKind(quickAddProduct); const price = basePrices[quickAddProduct] || 0;
    const total = kind === 'sticker' ? (size === 'A3' ? 30000 : 15000) * quantity : item.kind && !['banner','sticker'].includes(item.kind) ? price * quantity : price * area * quantity;
    const items = cartItems();
    items.push({product:quickAddProduct, size, area, quantity, kind, price, priceUnit:item.unit || (kind === 'sticker' ? 'lembar' : 'm³'), stickerCount:0, finish:selectedFinish[1], finishing:selectedFinish[0], file:file.name, total, id:result.id, output_name:result.output_name, preview_url:result.preview_url, download_url:result.download_url, created:Date.now()});
    saveCart(items); closeQuickAdd(); successToast('Pesanan ditambahkan ke keranjang.', 'Cek keranjang');
  } catch (error) { errorNode.textContent = error.message || 'Preview gagal dibuat.'; errorNode.hidden = false; } finally { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = 'Tambah ke keranjang'; form.classList.remove('is-processing'); }
}
function renderPromotions() {
  const node = $('#promoProducts');
  if (!node) return;
  const english = currentLanguage() === 'en';
  node.innerHTML = promoProducts.map((product, index) => `<a class="promo-product-card promo-product-card-${index + 1}" href="product.html?product=${encodeURIComponent(product.name)}"><div class="promo-product-image"><img src="/${product.imagePath || `assets/products/${product.category}/${product.slug}.${product.image}`}" alt="${escapeHtml(product.name)}" loading="lazy"><span>-${product.discount}%</span></div><div class="promo-product-copy"><small>${escapeHtml(product.type)}</small><h3>${escapeHtml(product.name)}</h3><div class="promo-price"><del>${money(product.originalPrice)}</del><strong>${money(product.promoPrice)}</strong><span>/${escapeHtml(product.unit)}</span></div><span class="promo-product-link">${english ? 'Shop offer' : 'Lihat promo'} <b>↗</b></span></div></a>`).join('');
}
function setupPromoCountdown() {
  const root = $('[data-promo-countdown]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  const section = root.closest('#promos');
  let deadline = promoTimerSettings.ends_at ? new Date(promoTimerSettings.ends_at) : null;
  const sync = async () => {
    try {
      const latest = await api('/api/promo-settings');
      promoTimerSettings = latest;
      const visible = latest.visible !== false;
      if (section) section.hidden = !visible;
      deadline = latest.ends_at ? new Date(latest.ends_at) : null;
      if (visible && deadline && !Number.isNaN(deadline.getTime())) root.classList.remove('is-ended');
    } catch (_) { /* Keep the last valid countdown visible during a transient API failure. */ }
  };
  if (section) section.hidden = promoTimerSettings.visible === false;
  if (!deadline) { root.hidden = true; return; }
  const update = () => {
    const remaining = Math.max(0, deadline.getTime() - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    [['days', days], ['hours', hours], ['minutes', minutes], ['seconds', seconds]].forEach(([key, value]) => { const node = root.querySelector(`[data-promo-${key}]`); if (node) node.textContent = String(value).padStart(2, '0'); });
    if (!remaining) { root.classList.add('is-ended'); root.querySelector('span').textContent = 'Promo berakhir'; sync(); }
  };
  update(); window.setInterval(update, 1000); window.setInterval(sync, 30000);
}
const categoryPromoLines = {
  Outdoor: 'Siap tampil di ruang terbuka.',
  Indoor: 'Rapi untuk ruang dan brand kamu.',
  A3: 'Detail tajam untuk kebutuhan harian.'
};
function categoryPromoBackground(visual, category) {
  const fallback = String(category).toLowerCase() === 'outdoor' ? 'assets/real/products/banner.jpg' : 'assets/real/gallery/gallery-2.jpeg';
  const image = /^assets\/(?:real\/gallery|real\/products)\/[\w./-]+$/.test(String(visual?.image || '')) ? visual.image : fallback;
  const shade = visual?.shadow === false ? '' : 'linear-gradient(155deg,rgba(20,36,59,.1) 12%,rgba(20,36,59,.92) 86%),';
  return `background-image:${shade}url("/${image}");background-position:center;background-size:cover`;
}
function renderCatalog() {
  const node = $('#catalog');
  if (!node) return;
  if (!dbCatalogRows.length) { node.innerHTML = '<div class="catalog-load-error"><b>Katalog belum dapat dimuat.</b><span>Data produk dari database belum tersedia. Muat ulang halaman atau coba beberapa saat lagi.</span><a href="catalog.html">Buka semua produk</a></div>'; return; }
  const groups = categoryOrder.map((category) => ({category, products: showcaseProducts.filter((product) => catalogCategory(product) === category).sort((a,b)=>Number(b.sales_count||0)-Number(a.sales_count||0)||Number(a.id||0)-Number(b.id||0)), visual:categoryBoxVisuals[category]})).filter((group) => group.products.length);
  node.innerHTML = groups.map((group, groupIndex) => `<section class="showcase-category-panel" data-showcase-category="${group.category}"><div class="showcase-heading"><div class="showcase-category-title"><div><p class="eyebrow">${group.category}</p><h3>${categoryDescriptions[group.category]}</h3></div></div></div><div class="showcase-category-promo" data-category-promo="${escapeHtml(group.category)}" style="${escapeHtml(categoryPromoBackground(group.visual, group.category))}"><span>FAZIMA PRINT &middot; ${escapeHtml(group.category)}</span><strong>Print yang<br>siap dipakai.</strong><small>${escapeHtml(categoryPromoLines[group.category] || 'Hasil rapi untuk kebutuhan kamu.')}</small></div><div class="showcase-track">${group.products.map((product,index)=>renderUniversalProductCard(product,group.category,groupIndex,index)).join('')}</div></section>`).join('');
  bindUniversalProductCards(node);
  setupAnimations();
}
function setupProductSearch() {
  const input = $('#productSearch');
  const box = $('#searchSuggestions');
  const catalogNode = $('#catalog');
  if (!input || !box) return;
  let matches = [];
  let activeIndex = 0;
  const openMatch = (item) => { if (item) location.href = `product.html?product=${encodeURIComponent(item.name)}`; };
  const paintActive = () => {
    box.querySelectorAll('[data-search-product]').forEach((button, index) => {
      const selected = index === activeIndex;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
  };
  const update = () => {
    const query = input.value.trim().toLowerCase();
    if (catalogNode) {
      document.querySelectorAll('.showcase-card').forEach((card) => { card.hidden = Boolean(query) && !card.textContent.toLowerCase().includes(query); });
      catalogNode.querySelectorAll('.showcase-category-panel').forEach((panel) => {
        const panelCategory=String(panel.dataset.showcaseCategory||'').trim().toLowerCase();
        const selectedNames=[activeFeaturedCategorySlug,activeFeaturedCategoryName].filter(Boolean).map((value)=>String(value).trim().toLowerCase());
        const categoryVisible=!selectedNames.length||selectedNames.includes(panelCategory);
        panel.hidden=!categoryVisible||(Boolean(query)&&![...panel.querySelectorAll('.showcase-card')].some((card)=>!card.hidden));
      });
    }
    if (page === 'catalog') {
      const catalogSearch = $('#catalogSearch');
      if (catalogSearch && catalogSearch.value !== input.value) { catalogSearch.value = input.value; catalogSearch.dispatchEvent(new Event('input', {bubbles:true})); }
    }
    matches = showcaseProducts
      .filter((item) => `${item.name} ${item.type}`.toLowerCase().includes(query))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aRank = aName === query ? 0 : aName.startsWith(query) ? 1 : 2;
        const bRank = bName === query ? 0 : bName.startsWith(query) ? 1 : 2;
        return aRank - bRank || aName.localeCompare(bName);
      })
      .slice(0, 5);
    activeIndex = 0;
    box.innerHTML = matches.map((item, index) => `<button type="button" role="option" aria-selected="${index === 0}" data-search-product="${escapeHtml(item.name)}">${escapeHtml(item.name)} <small>· ${escapeHtml(item.type)}</small></button>`).join('');
    box.hidden = !query || !matches.length;
    box.querySelectorAll('[data-search-product]').forEach((button, index) => button.addEventListener('click', () => openMatch(matches[index])));
    paintActive();
  };
  input.addEventListener('input', update);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); activeIndex = (activeIndex + 1) % matches.length; paintActive(); }
    if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); activeIndex = (activeIndex - 1 + matches.length) % matches.length; paintActive(); }
    if (event.key === 'Escape') { box.hidden = true; }
    if (event.key === 'Enter' && page === 'catalog') { event.preventDefault(); box.hidden = true; $('#catalogSearch')?.dispatchEvent(new Event('input', {bubbles:true})); }
    else if (event.key === 'Enter' && matches.length) { event.preventDefault(); openMatch(matches[activeIndex]); }
    else if (event.key === 'Enter' && input.value.trim() && page !== 'home' && page !== 'catalog') { event.preventDefault(); location.href = `catalog.html?q=${encodeURIComponent(input.value.trim())}`; }
  });
}
function setupHeroSlider() { const frame = document.querySelector('.hero-image-main'); if (!frame || frame.dataset.sliderReady) return; const first = frame.querySelector('img'); if (!first) return; const hero = frame.closest('.hero'); if (hero) { const runner = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); runner.classList.add('hero-border-runner'); runner.setAttribute('aria-hidden', 'true'); runner.innerHTML = '<rect x="1.5" y="1.5" width="1" height="1" rx="34" pathLength="100"></rect>'; hero.appendChild(runner); const path = runner.querySelector('rect'); const syncRunner = () => { const width = Math.max(1, Math.round(hero.getBoundingClientRect().width)); const height = Math.max(1, Math.round(hero.getBoundingClientRect().height)); const stroke = 3; const radius = window.matchMedia('(max-width: 680px)').matches ? 26 : 34; runner.setAttribute('viewBox', `0 0 ${width} ${height}`); path.setAttribute('x', String(stroke / 2)); path.setAttribute('y', String(stroke / 2)); path.setAttribute('width', String(Math.max(1, width - stroke))); path.setAttribute('height', String(Math.max(1, height - stroke))); path.setAttribute('rx', String(Math.min(radius - stroke / 2, (width - stroke) / 2, (height - stroke) / 2))); }; syncRunner(); if (window.ResizeObserver) new ResizeObserver(syncRunner).observe(hero); else window.addEventListener('resize', syncRunner); } const images = ['assets/real/gallery/gallery-2.jpeg', 'assets/real/gallery/gallery-1.jpeg', 'assets/real/gallery/gallery-3.jpeg', 'assets/real/gallery/gallery-4.jpeg', 'assets/real/products/banner.jpg']; frame.dataset.sliderReady = 'true'; frame.classList.add('hero-slider'); const slides = [first, ...images.slice(1).map((src, index) => { const image = document.createElement('img'); image.src = src; image.alt = ['Contoh hasil digital printing', 'Hasil cetak Fazima Print', 'Inspirasi produk printing', 'Banner printing Fazima Print'][index]; image.loading = 'lazy'; frame.appendChild(image); return image; })]; slides.forEach((slide, index) => { slide.classList.add('hero-slide'); slide.classList.toggle('active', index === 0); slide.setAttribute('aria-hidden', String(index !== 0)); }); let active = 0; window.setInterval(() => { if (document.hidden) return; slides[active].classList.remove('active'); slides[active].setAttribute('aria-hidden', 'true'); active = (active + 1) % slides.length; slides[active].classList.add('active'); slides[active].setAttribute('aria-hidden', 'false'); }, 7000); }

function ensureCustomSizeFields() { if ($('#customSizeFields')) return; const preset = $('#sizePreset'); const wrap = document.createElement('div'); wrap.id = 'customSizeFields'; wrap.className = 'custom-size-fields'; wrap.hidden = true; wrap.innerHTML = '<label>Panjang (P)<input id="sizeWidth" type="number" min="0.01" step="any" placeholder="Contoh: 1" aria-label="Panjang desain"></label><label>Lebar (L)<input id="sizeHeight" type="number" min="0.01" step="any" placeholder="Contoh: 3" aria-label="Lebar desain"></label><label>Satuan ukuran<select id="sizeUnit"><option value="m">meter (m)</option><option value="cm">sentimeter (cm)</option><option value="mm">milimeter (mm)</option></select></label>'; preset.closest('.field-grid').after(wrap); ['sizeWidth','sizeHeight'].forEach((id) => document.getElementById(id).addEventListener('input', syncSize)); document.getElementById('sizeUnit').addEventListener('change', syncSize); }
function parseSize(value) { const match = String(value || '').match(/^\s*([\d.,]+)\s*[x×]\s*([\d.,]+)\s*(cm|mm|m)?\s*$/i); if (!match) return null; const unit = (match[3] || 'cm').toLowerCase(); return {width:Number(match[1].replace(',','.')), height:Number(match[2].replace(',','.')), unit}; }
function sizeAreaM2(value) { const named = {A4:.21*.297, A3:.297*.42, A2:.42*.594}; if (named[value]) return named[value]; const parsed = parseSize(value); if (!parsed || !parsed.width || !parsed.height) return 0; const factor = {m:1,cm:.01,mm:.001}[parsed.unit]; return parsed.width * parsed.height * factor * factor; }
function isDimensionalProduct(name) { const unit=String(dbCatalogRows.find((entry)=>entry.name===name)?.unit||'').toLowerCase(); return /^m(?:2|\^2)$/.test(unit) || (unit.startsWith('m')&&unit.charCodeAt(1)===178); }
function sizeWarning(product, size) { const area = sizeAreaM2(size); if (!product || !area) return ''; const [minimum, maximum] = sizeLimitsM2[product] || [.0001,1000]; if (area < minimum) return `Ukuran terlalu kecil untuk ${product}. Pilih ukuran yang lebih besar agar dapat diproses.`; if (area > maximum) return `Ukuran terlalu besar untuk ${product}. Pilih ukuran yang lebih kecil agar dapat diproses.`; return ''; }
function getStickerSizeValue() { const select = document.querySelector('[name="sticker_size"]'); return select?.value || ''; }
function getMaterialValue() { return document.querySelector('[name="material"]')?.value || ''; }
function syncStickerCapacity() { if (!isBulkSticker($('#product')?.value)) return 0; const value = getStickerSizeValue(); const match = value.match(/([\d.]+)\s*[×x]\s*([\d.]+)/); if (!match || $('#size')?.value !== 'A3') return 0; const gap = 0.3; return Math.max(1, Math.floor((29.7 + gap) / (Number(match[1]) + gap)) * Math.floor((42 + gap) / (Number(match[2]) + gap))); }
function renderSizes(name) { const item = products.find((entry) => entry.name === name); const select = $('#sizePreset'); if (!select) return; ensureCustomSizeFields(); $('#sizeWidth').value=''; $('#sizeHeight').value=''; select.innerHTML = item ? `<option value="">Pilih ukuran</option>${item.sizes.map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join('')}` : '<option value="">Pilih produk dulu</option>'; $('#sizeUnit').value = defaultUnits[name] || 'cm'; syncSize(); renderFinishing(name); renderProductExtras(name); updateSummary(); }
function syncSize() { const preset = $('#sizePreset'); const size = $('#size'); if (!preset || !size) return; const custom = $('#customSizeFields'); const isCustom = preset.value === 'Custom', productName = $('#product')?.value || '', dimensional = isDimensionalProduct(productName); if (custom) custom.hidden = !(isCustom || dimensional); if (dimensional) { const named={A4:{width:21,height:29.7,unit:'cm'},A3:{width:29.7,height:42,unit:'cm'},A2:{width:42,height:59.4,unit:'cm'}}; const selected=parseSize(preset.value)||named[preset.value]; const widthInput=$('#sizeWidth'),heightInput=$('#sizeHeight'),unitInput=$('#sizeUnit'); if (!isCustom && selected && widthInput && heightInput) { widthInput.value=selected.width; heightInput.value=selected.height; unitInput.value=selected.unit; } const width=widthInput?.value||'',height=heightInput?.value||'',unit=unitInput?.value||'m'; size.value=width&&height?`${width}x${height} ${unit}`:(preset.value==='Custom'?'':preset.value); } else if (isCustom) { const width = $('#sizeWidth')?.value || ''; const height = $('#sizeHeight')?.value || ''; const unit = $('#sizeUnit')?.value || 'cm'; size.value = width && height ? `${width}x${height} ${unit}` : ''; } else size.value = preset.value; const warning = sizeWarning(productName, size.value); if ($('#sizeWarning')) { $('#sizeWarning').textContent = warning; $('#sizeWarning').hidden = !warning; } refreshCustomSelect(preset); syncStickerCapacity(); updateSummary(); }
function renderSelectedProduct(name) { const node = $('#selectedProduct'); const item = catalog.find((entry) => entry[0] === name); const showcase = showcaseProducts.find((entry) => entry.name === name); if (!node) { return; } if (!item && !showcase) { node.hidden = true; return; } node.hidden = false; const image = showcase ? `/${showcase.imagePath}` : item[5] || `assets/mockups/${item[3]}.png`; node.innerHTML = `<img src="${image}" alt=""><div><b>${escapeHtml(name)}</b><span>${escapeHtml(item?.[4] || `${showcase.type} · ${showcase.price} / ${showcase.unit}`)}</span></div>`; }
function renderFinishing(name) { const node = $('#finishingOptions'); if (!node) return; if (!finishingProducts.has(name)) { selectedFinishing = ''; node.innerHTML = '<p class="finishing-unavailable">Finishing belum tersedia untuk produk ini.</p>'; return; } node.innerHTML = finishing.map(([value, title, text, price], index) => `<label class="finish-option ${selectedFinishing === value ? 'selected' : ''}"><input type="radio" name="finishing" value="${value}" ${selectedFinishing === value || (!selectedFinishing && index === 0) ? 'checked' : ''}><span class="finish-icon">${value === '' ? '○' : value === 'Matik' ? '✦' : value === 'Selongsong' ? '⌁' : '▣'}</span><span class="finish-copy"><b>${title}</b><small>${text}</small></span><strong>${price}</strong></label>`).join(''); selectedFinishing = node.querySelector('input:checked')?.value || ''; node.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => { selectedFinishing = input.value; previewResult = null; node.querySelectorAll('.finish-option').forEach((option) => option.classList.toggle('selected', option.querySelector('input').checked)); updateSummary(); })); }
function renderProductExtras(name) { const node = $('#productExtras'); if (!node) return; if (!isStickerProduct(name)) { node.hidden = true; node.innerHTML = ''; return; } const bulk = isBulkSticker(name); const quantityLabel = $('#quantity')?.closest('label'); if (quantityLabel) { const helper = quantityLabel.querySelector('.helper'); if (helper) helper.textContent = bulk ? 'Jumlah lembar A3 yang ingin dicetak' : 'Jumlah sticker One Way'; } node.hidden = false; node.innerHTML = `<div class="extras-heading"><b>${bulk ? 'Aturan ukuran sticker' : 'Sticker One Way'}</b><span>${bulk ? 'Kertas A3 dan jumlah muatan dihitung otomatis.' : 'Satu desain, bukan pengulangan bulk.'}</span></div>${bulk ? '<div class="field-grid"><label>Bentuk sticker<select name="sticker_shape"><option value="Kotak">Kotak</option><option value="Bulat">Bulat</option><option value="Custom">Mengikuti desain</option></select></label><label>Ukuran sticker<select name="sticker_size"><option value="5x5 cm">5 × 5 cm</option><option value="7x7 cm">7 × 7 cm</option><option value="10x10 cm">10 × 10 cm</option></select></label></div><p class="sticker-capacity-note">Kapasitas otomatis di A3: <b id="stickerCapacity">-</b> pcs per lembar</p>' : '<p class="sticker-capacity-note">Preview menampilkan satu desain sesuai ukuran yang Anda masukkan.</p>'}<p class="sticker-custom-hint">Jika ukuran/bentuk ingin mengikuti desain (contoh logo Apple), upload gambar PNG dengan background transparan.</p>`; setupCustomSelects(); const sizeSelect = node.querySelector('[name="sticker_size"]'); const shapeSelect = node.querySelector('[name="sticker_shape"]'); const refresh = () => { const capacity = syncStickerCapacity(); const capacityNode = $('#stickerCapacity'); if (capacityNode) capacityNode.textContent = capacity || '-'; updateSummary(); }; sizeSelect?.addEventListener('change', () => { previewResult = null; refresh(); }); shapeSelect?.addEventListener('change', () => { previewResult = null; refresh(); }); refresh(); }
function getOrderData() { const product = $('#product')?.value || ''; const size = $('#size')?.value || 'Belum dipilih'; const quantity = Number($('#quantity')?.value || 1); const finish = finishing.find((item) => item[0] === selectedFinishing) || finishing[0]; const area = sizeAreaM2(size); const stickerCount = product === 'Sticker' ? syncStickerCapacity() : 0; const areaPrice = (basePrices[product] || 0) * area; const stickerSheetPrice = size === 'A3' ? 30000 : 15000; const total = product === 'Sticker' ? stickerSheetPrice * quantity : areaPrice * quantity; return {product, size, area, unit: parseSize(size)?.unit || '', quantity, stickerCount, finish: finish[1], finishing: selectedFinishing, file: $('#file')?.files[0]?.name || 'Belum ada file', total}; }
function updateSummary() { const node = $('#liveSummary'); const total = $('#estimatedTotal'); if (!node || !total) return; const data = getOrderData(); if (!data.product) { node.innerHTML = '<div class="summary-empty">Pilih produk untuk<br>melihat ringkasan.</div>'; total.textContent = 'Rp 0'; return; } const stickerLine = data.product === 'Sticker' ? `<div class="summary-line"><span>Sticker / lembar</span><b>${data.stickerCount || '-'} pcs</b></div>` : ''; const priceLabel = data.product === 'Sticker' ? 'Harga / lembar' : 'Tarif / m³'; const priceValue = data.product === 'Sticker' ? (data.size === 'A3' ? 30000 : 15000) : basePrices[data.product] || 0; const catalogItem = catalog.find((item) => item[0] === data.product); node.innerHTML = `<div class="summary-product"><img src="${catalogItem?.[5] || `assets/mockups/${productClass(data.product)}.png`}" alt=""><div><b>${escapeHtml(data.product)}</b><span>${escapeHtml(data.size)}</span></div></div><div class="summary-line"><span>Luas cetak</span><b>${data.area.toFixed(4)} m³</b></div><div class="summary-line"><span>${priceLabel}</span><b>${money(priceValue)}</b></div>${stickerLine}<div class="summary-line"><span>Finishing</span><b>${escapeHtml(data.finish)}</b></div><div class="summary-line"><span>Jumlah</span><b>${data.quantity} unit</b></div>`; total.textContent = money(data.total); }
function validOrder() { const data = getOrderData(); const warning = sizeWarning(data.product, data.size); if (!data.product) return toast('Pilih produk terlebih dahulu.'); if (!data.size || data.size === 'Belum dipilih') return toast('Pilih ukuran produk terlebih dahulu.'); if (warning) { toast(warning); return false; } if (data.product === 'Sticker' && !getStickerSizeValue()) return toast('Isi ukuran custom sticker terlebih dahulu.'); if (!$('#quantity')?.value || data.quantity < 1) return toast('Jumlah pesanan minimal 1.'); if (!$('#file')?.files[0]) return toast('Upload file desain terlebih dahulu.'); return true; }
async function preparePreview() { if (previewResult) return previewResult; if (!validOrder()) return null; const form = $('#layoutForm'); const button = $('.preview-step'); const panel = $('#designPreview'); const payload = new FormData(form); payload.set('customer', form.querySelector('[name="customer"]')?.value || 'preview customer'); payload.set('scale_up', form.querySelector('[name="scale_up"]')?.checked ? 'true' : 'false'); if (form.querySelector('[name="sticker_size"]')) payload.set('sticker_size', getStickerSizeValue()); button.disabled = true; button.textContent = 'Membuat preview…'; panel.hidden = false; $('#previewStatus').textContent = 'Sedang membuat hasil layout…'; try { previewResult = await api('/api/layouts', {method:'POST', body:payload}); $('#mockupPreviewImage').src = `${previewResult.preview_url}?v=${Date.now()}`; $('#mockupPreviewImage').hidden = false; $('.preview-loading').hidden = true; $('#previewStatus').textContent = 'Hasil layout siap dilihat'; $('#addToCart').hidden = false; return previewResult; } catch (error) { $('#previewStatus').textContent = 'Preview gagal dibuat'; toast(error.message); return null; } finally { button.disabled = false; button.textContent = 'Buat ulang preview'; } }
function addCurrentToCart() { if (!previewResult || !validOrder()) return; const data = getOrderData(); const item = {...data, id: previewResult.id, output_name: previewResult.output_name, preview_url: previewResult.preview_url, download_url: previewResult.download_url, created: Date.now()}; const items = cartItems(); items.push(item); saveCart(items); toast('Pesanan ditambahkan ke keranjang.'); setTimeout(() => { window.location.href = 'cart.html'; }, 500); }

function initOrder() { const form = $('#layoutForm'); if (!form) return; const requested = new URLSearchParams(location.search).get('product'); $('#product').addEventListener('change', (event) => { selectedFinishing = ''; previewResult = null; renderSizes(event.target.value); renderSelectedProduct(event.target.value); }); $('#sizePreset').addEventListener('change', () => { previewResult = null; syncSize(); }); $('#sizeCustom').addEventListener('input', () => { previewResult = null; syncSize(); }); $('#quantity').addEventListener('input', updateSummary); $('#file').addEventListener('change', (event) => { previewResult = null; $('#addToCart').hidden = true; const file = event.target.files[0]; if (file) { $('#fileName').textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`; $('#designPreview').hidden = false; $('#previewTitle').textContent = file.name; $('#previewMeta').textContent = `${(file.size / 1048576).toFixed(2)} MB · ${file.type || 'file desain'}`; } }); $('.preview-step').addEventListener('click', preparePreview); $('#addToCart').addEventListener('click', addCurrentToCart); api('/api/products').then((items) => { products = items; $('#product').innerHTML = '<option value="">Pilih produk</option>' + items.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join(''); if (requested && products.some((item) => item.name === requested)) { $('#product').value = requested; renderSizes(requested); renderSelectedProduct(requested); } }).catch(() => toast('Server belum siap.')); }

function renderCart() { const node = $('#cartItems'); if (!node) return; const items = cartItems(); const heading = $('#cartHeading'); const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0); if (heading) heading.textContent = items.length ? `${items.length} item${items.length > 1 ? 's' : ''} di keranjang` : 'Keranjang kosong'; $('#cartTotal').textContent = money(total); node.innerHTML = items.length ? items.map((item, index) => `<article class="cart-item"><img src="${escapeHtml(item.preview_url || `assets/mockups/${productClass(item.product)}.png`)}" alt="Preview ${escapeHtml(item.product)}"><div><span class="product-type">${escapeHtml(item.product)}</span><h3>${escapeHtml(item.size)}</h3><p>${escapeHtml(item.file)} · ${escapeHtml(item.finish)} · ${item.quantity} unit</p><b>${money(item.total)}</b></div><button type="button" data-remove="${index}" aria-label="Hapus item">×</button></article>`).join('') : '<div class="cart-empty"><span>🛒</span><h3>Belum ada pesanan</h3><p>Pilih produk dari katalog untuk mulai.</p><a class="primary" href="/">Lihat produk</a></div>'; node.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { const next = cartItems(); next.splice(Number(button.dataset.remove), 1); saveCart(next); renderCart(); })); }
function cartPaymentOrderId() { return `FZ-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
function cartPaymentDraft() {
  const items = cartItems();
  const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const deliveryMode = document.querySelector('input[name="delivery"]:checked')?.value || 'pickup';
  return {order_id:cartPaymentOrderId(), product:'Fazima Print cart', size:`${items.length} item`, quantity:1, total, items, customer:$('#contactName')?.value.trim() || '', phone:$('#contactPhone')?.value.trim() || '', delivery:deliveryMode === 'pickup' ? 'pickup' : 'delivery', shipping_mode:deliveryMode === 'gosend' ? 'gosend' : 'courier', address:$('#address')?.value.trim() || ''};
}
function initCart() {
  renderCart();
  const checkout = $('#demoCheckout');
  if (!checkout) return;
  const profileKey = 'fazima-print-checkout-profile';
  const totalLabel = document.querySelector('.checkout-card .summary-label');
  if (totalLabel) totalLabel.textContent = 'TOTAL PRODUK';
  if (!document.querySelector('#checkoutLocationStyle')) { const style = document.createElement('style'); style.id = 'checkoutLocationStyle'; style.textContent = '#currentLocationMap{display:inline-block;margin:7px 0;color:#176957;font-size:12px;font-weight:700}.checkout-autofill{margin:0 0 12px}.address-section #addressLabel small{display:block;margin-top:6px;color:#718087;font-size:11px;line-height:1.5}#payDemoCheckout{display:block;width:100%;margin-top:10px}'; document.head.appendChild(style); }
  if (!document.querySelector('#checkoutSpacingStyle')) {
    const style = document.createElement('style');
    style.id = 'checkoutSpacingStyle';
    style.textContent = '.location-actions{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 16px}.detected-location{margin:12px 0 18px!important}.location-actions button{min-height:40px}#toast.show{pointer-events:auto;user-select:text;-webkit-user-select:text;cursor:text}';
    document.head.appendChild(style);
  }
  const addressSection = $('#addressSection');
  const locationButton = $('#useLocation');
  const cancelLocationButton = document.createElement('button');
  cancelLocationButton.id = 'cancelLocation';
  cancelLocationButton.type = 'button';
  cancelLocationButton.className = 'secondary small-button';
  cancelLocationButton.textContent = 'Batalkan lokasi';
  cancelLocationButton.hidden = true;
  const locationActions = document.createElement('div');
  locationActions.className = 'location-actions';
  if (locationButton) locationActions.append(locationButton);
  locationActions.append(cancelLocationButton);
  if (addressSection) addressSection.replaceChildren(locationActions, $('#detectedLocation'), $('#locationStatus'), $('#addressLabel'));
  $('#contactName')?.setAttribute('autocomplete', 'name');
  $('#contactPhone')?.setAttribute('autocomplete', 'tel');
  checkout.textContent = 'Bayar';
  const headerTrust = document.querySelector('.header-trust'); if (headerTrust) headerTrust.innerHTML = '<i></i> Pembayaran aman via Midtrans';
  const summaryLabel = document.querySelector('.checkout-card .summary-label'); if (summaryLabel) summaryLabel.textContent = 'TOTAL PRODUK';
  const checkoutCopy = document.querySelector('.checkout-card > p:not(.summary-label):not(.demo-note)'); if (checkoutCopy) checkoutCopy.textContent = 'Lanjutkan ke checkout Midtrans atau simpan order langsung dengan Pay Demo.';
  const note = document.querySelector('.demo-note'); if (note) note.textContent = 'Pay Demo menyimpan order ke sistem tanpa memproses pembayaran.';
  const intro = document.querySelector('.page-title > p:last-child'); if (intro) intro.textContent = 'Pilih Bayar untuk checkout Midtrans atau Pay Demo untuk menyimpan order tanpa pembayaran.';
  const saveContactProfile = () => {
    try {
      const old = JSON.parse(localStorage.getItem(profileKey) || '{}') || {};
      localStorage.setItem(profileKey, JSON.stringify({...old, customer:$('#contactName')?.value.trim() || '', phone:$('#contactPhone')?.value.trim() || ''}));
    } catch (_) {}
  };
  $('#contactName')?.addEventListener('input', saveContactProfile);
  $('#contactPhone')?.addEventListener('input', saveContactProfile);
  const autoFillButton = $('#autoFillCheckout');
  if (autoFillButton) autoFillButton.addEventListener('click', (event) => {
    event.preventDefault();
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(profileKey) || '{}') || {}; } catch (_) {}
    let account = {};
    try { account = JSON.parse(localStorage.getItem('fazima-print-auth-user') || '{}') || {}; } catch (_) {}
    const nameInput = $('#contactName');
    const phoneInput = $('#contactPhone');
    if (nameInput) nameInput.value = saved.customer || account.displayName || nameInput.value.trim() || 'Pelanggan Demo';
    if (phoneInput) phoneInput.value = saved.phone || phoneInput.value.trim() || '081234567890';
    saveContactProfile();
  });
  let currentCoordinates = null;
  let currentLocationLabel = '';
  let locationRequestId = 0;
  const setDeliveryMode = (mode) => { const delivery = mode !== 'pickup'; const gosend = mode === 'gosend'; $('#addressSection').hidden = !delivery; $('#storePickupPanel').hidden = delivery; $('#address').required = false; $('#gosendCodNotice').hidden = !gosend; const deliveryNote = $('#deliveryCostNote'); if (deliveryNote) deliveryNote.hidden = mode !== 'delivery'; document.querySelector('.shipping-area-label')?.toggleAttribute('hidden', mode !== 'delivery'); document.querySelector('#shippingAreaResults')?.toggleAttribute('hidden', mode !== 'delivery'); document.querySelector('#shippingAreaStatus')?.toggleAttribute('hidden', mode !== 'delivery'); document.querySelector('#shippingRates')?.toggleAttribute('hidden', mode !== 'delivery'); if (mode !== 'delivery') { window.fazimaSelectedShippingQuote = null; document.querySelector('.cart-shipping-summary')?.setAttribute('hidden', ''); } };
  document.querySelectorAll('input[name="delivery"]').forEach((input) => input.addEventListener('change', () => setDeliveryMode(input.value)));
  setDeliveryMode(document.querySelector('input[name="delivery"]:checked')?.value || 'pickup');
  $('#useLocation')?.addEventListener('click', () => {
    const status = $('#locationStatus');
    if (!navigator.geolocation) { status.textContent = 'Browser ini tidak mendukung lokasi.'; return; }
    const requestId = ++locationRequestId;
    locationButton.hidden = true;
    cancelLocationButton.hidden = false;
    status.textContent = 'Meminta izin lokasi...';
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (requestId !== locationRequestId) return;
      const {latitude, longitude, accuracy} = position.coords;
      currentCoordinates = {latitude, longitude};
      let mapLink = $('#currentLocationMap');
      if (!mapLink) { mapLink = document.createElement('a'); mapLink.id = 'currentLocationMap'; mapLink.target = '_blank'; mapLink.rel = 'noopener'; $('#detectedLocation').insertAdjacentElement('afterend', mapLink); }
      mapLink.href = `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;
      mapLink.textContent = 'Lihat titik lokasi di Google Maps';
      $('#detectedLocation').hidden = false;
      $('#locationResult').value = `Koordinat ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (akurasi +/-${Math.round(accuracy)} m)\nMencari provinsi, kota, jalan, dan nama tempat...`;
      currentLocationLabel = '';
      status.textContent = 'Mencari rincian alamat...';
      try {
        const place = await api(`/api/location/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
        if (requestId !== locationRequestId) return;
        const a = place.address || {};
        const province = a.state || a.province || a.region || '';
        const city = a.city || a.town || a.municipality || a.county || a.village || '';
        const district = a.city_district || a.district || a.suburb || a.neighbourhood || '';
        const street = [a.road || a.pedestrian || a.residential || a.street, a.house_number].filter(Boolean).join(' ');
        const name = place.name || a.amenity || a.shop || a.tourism || a.building || a.neighbourhood || a.suburb || '';
        const lines = [name, street, district, city, province, a.postcode].filter((value, index, all) => value && all.indexOf(value) === index);
        currentLocationLabel = lines.join(', ') || place.display_name || '';
        $('#locationResult').value = `${currentLocationLabel || 'Alamat rinci belum ditemukan'}\nKoordinat ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (akurasi +/-${Math.round(accuracy)} m)`;
        status.textContent = currentLocationLabel ? 'Lokasi ditemukan. Tambahkan detail rumah atau patokan bila perlu.' : 'Koordinat ditemukan. Tambahkan detail alamat secara manual.';
      } catch (error) {
        if (requestId !== locationRequestId) return;
        currentLocationLabel = `Koordinat ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        $('#locationResult').value = `${currentLocationLabel} (akurasi +/-${Math.round(accuracy)} m)`;
        status.textContent = `${error.message} Titik koordinat tetap tersimpan.`;
      }
    }, () => {
      if (requestId !== locationRequestId) return;
      locationButton.hidden = false;
      cancelLocationButton.hidden = true;
      status.textContent = 'Lokasi tidak dapat diakses. Izinkan lokasi lalu coba lagi.';
    }, {enableHighAccuracy:true, timeout:15000, maximumAge:60000});
  });
  cancelLocationButton.addEventListener('click', () => {
    locationRequestId += 1;
    currentCoordinates = null;
    currentLocationLabel = '';
    $('#detectedLocation').hidden = true;
    $('#locationResult').value = '';
    $('#currentLocationMap')?.remove();
    locationButton.hidden = false;
    cancelLocationButton.hidden = true;
    $('#locationStatus').textContent = 'Penggunaan lokasi dibatalkan. Anda dapat mengisi alamat secara manual.';
  });
  const saveCartOrder = async (forPayment = false) => {
    const items = cartItems(); if (!items.length) throw new Error('Keranjang masih kosong.');
    const deliveryMode = document.querySelector('input[name="delivery"]:checked')?.value || 'pickup';
    const delivery = deliveryMode === 'pickup' ? 'pickup' : 'delivery';
    if (delivery !== 'pickup' && !currentCoordinates && !$('#address')?.value.trim()) throw new Error('Gunakan lokasi saat ini atau isi detail alamat pengantaran terlebih dahulu.');
    const draft = cartPaymentDraft();
    const addressDetail = $('#address')?.value.trim() || '';
    draft.delivery = delivery;
    draft.shipping_mode = deliveryMode === 'gosend' ? 'gosend' : 'courier';
    draft.location_label = delivery === 'delivery' ? currentLocationLabel : '';
    draft.address_detail = delivery === 'delivery' ? addressDetail : '';
    draft.address = delivery === 'delivery' ? [draft.location_label, addressDetail].filter(Boolean).join('\n') : '';
    draft.latitude = currentCoordinates?.latitude ?? null;
    draft.longitude = currentCoordinates?.longitude ?? null;
    const saved = await api('/api/orders', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(draft)});
    try { localStorage.setItem(profileKey, JSON.stringify({customer:draft.customer, phone:draft.phone, delivery:draft.delivery})); } catch (_) {}
    draft.order_id = saved.order_id; draft.total = saved.grand_total;
    saveLocalOrderHistory(draft);
    saveAccountCheckoutHistory(draft);
    if (forPayment) {
      try { localStorage.setItem(paymentDraftKey, JSON.stringify(draft)); }
      catch (_) { throw new Error('Order tersimpan, tetapi browser tidak dapat menyiapkan data pembayaran. Buka halaman Riwayat Order untuk melihat order.'); }
    }
    return draft;
  };
  checkout.addEventListener('click', async () => {
    checkout.disabled = true;
    try {
      const draft = await saveCartOrder(true);
      location.href = `payment.html?source=cart&order_id=${encodeURIComponent(draft.order_id)}`;
    } catch (error) { toast(error.message || 'Order belum dapat disimpan.'); checkout.disabled = false; }
  });
  $('#payDemoCheckout')?.addEventListener('click', async (event) => {
    const button = event.currentTarget; button.disabled = true;
    try {
      const draft = await saveCartOrder();
      const modal = $('#demoModal');
      modal.querySelector('.eyebrow').textContent = 'ORDER DEMO TERSIMPAN';
      modal.querySelector('h2').innerHTML = 'Order masuk<br><em>ke sistem.</em>';
      modal.querySelector('.success-card > p:not(.eyebrow)').textContent = 'Order tersimpan ke database dan tampil di halaman Order Web Kasir. Pay Demo tidak memproses pembayaran.';
      $('#demoOrderNumber').textContent = draft.order_id;
      modal.hidden = false; document.body.classList.add('modal-open');
    } catch (error) { toast(error.message || 'Order demo belum dapat disimpan.'); }
    finally { button.disabled = false; }
  });
  $('#newOrder')?.addEventListener('click', () => { saveCart([]); location.href = '/'; });
  document.querySelector('.modal-close')?.addEventListener('click', () => { $('#demoModal').hidden = true; document.body.classList.remove('modal-open'); });
  const params = new URLSearchParams(location.search); if (params.get('payment') === 'success') showPaymentReceipt(params.get('order_id'));
}
// Keep cart content translated even when it is rendered after the initial DOM scan.
function renderCart() {
  const node = $('#cartItems'); if (!node) return;
  const items = cartItems(); const heading = $('#cartHeading'); const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  if (heading) heading.textContent = translateValue(items.length ? `${items.length} item${items.length > 1 ? 's' : ''} di keranjang` : 'Keranjang kosong', currentLanguage());
  $('#cartTotal').textContent = money(total);
  node.innerHTML = items.length ? items.map((item, index) => `<article class="cart-item"><img src="${escapeHtml(item.preview_url || `assets/mockups/${productClass(item.product)}.png`)}" alt="${escapeHtml(translateValue(`Preview ${item.product}`, currentLanguage()))}"><div><span class="product-type">${escapeHtml(translateValue(item.product, currentLanguage()))}</span><h3>${escapeHtml(item.size)}</h3><p>${escapeHtml(item.file)} · ${escapeHtml(translateValue(item.finish, currentLanguage()))} · ${item.quantity} ${translateValue('unit', currentLanguage())}</p><b>${money(item.total)}</b></div><button type="button" data-remove="${index}" aria-label="${translateValue('Hapus item', currentLanguage())}">×</button></article>`).join('') : `<div class="cart-empty"><span>🛒</span><h3>${translateValue('Belum ada pesanan', currentLanguage())}</h3><p>${translateValue('Pilih produk dari katalog untuk mulai.', currentLanguage())}</p><a class="primary" href="/">${translateValue('Lihat produk', currentLanguage())}</a></div>`;
  node.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { const next = cartItems(); next.splice(Number(button.dataset.remove), 1); saveCart(next); renderCart(); }));
}

function launchMidtransCheckout(transaction, callbacks) {
  if (!transaction?.token) throw new Error('Midtrans tidak mengembalikan token pembayaran.');
  if (window.snap?.pay) { window.snap.pay(transaction.token, callbacks); return; }
  if (transaction.redirect_url) { window.location.assign(transaction.redirect_url); return; }
  throw new Error('Checkout Midtrans belum tersedia. Muat ulang halaman dan coba lagi.');
}

function initCartPayment() {
  const draft = JSON.parse(localStorage.getItem(paymentDraftKey) || localStorage.getItem(productDraftKey) || 'null');
  if (!draft?.total) { location.replace('cart.html'); return; }
  if ($('#paymentTotal')) $('#paymentTotal').textContent = money(draft.total);
  if ($('#paymentOrderSummary')) { const items = draft.items || [{product:draft.product, size:draft.size, quantity:draft.quantity, total:draft.total}]; $('#paymentOrderSummary').innerHTML = items.map((item) => `<div><b>${escapeHtml(item.product)}</b><span>${escapeHtml(item.size || '')} · ${Number(item.quantity || 1)} unit</span></div>`).join(''); }
  const orderIdNode = $('#paymentOrderId'); if (orderIdNode) orderIdNode.textContent = `Nomor order: ${draft.order_id || 'akan dibuat'}`;
  const details = $('#paymentDetails'); const button = $('#payButton'); if (!details || !button) return;
  const statusButton = document.createElement('button'); statusButton.type = 'button'; statusButton.className = 'secondary payment-status-button'; statusButton.textContent = 'Cek status transaksi'; statusButton.addEventListener('click', async () => { if (!draft.order_id) return toast('Nomor order belum tersedia.'); statusButton.disabled = true; statusButton.textContent = 'Mengecek status…'; try { const result = await api(`/api/payments/status/${encodeURIComponent(draft.order_id)}`); const status = result.transaction_status || 'unknown'; statusButton.textContent = `Status Midtrans: ${status}`; toast(`Status transaksi: ${status}`); } catch (error) { statusButton.disabled = false; statusButton.textContent = 'Cek status transaksi'; toast(error.message || 'Status belum tersedia.'); } }); button.insertAdjacentElement('afterend', statusButton);
  api('/api/payments/config').then((gateway) => {
    const methodList = gateway.payment_methods?.map((method) => method.label).join(' · ');
    if (!gateway.configured) { details.innerHTML = '<div class="midtrans-not-configured"><b>Midtrans Sandbox belum aktif</b><span>Set MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY pada backend, lalu restart server.</span></div>'; button.disabled = true; button.textContent = 'Midtrans belum dikonfigurasi'; return; }
    details.innerHTML = `<div class="midtrans-ready"><b>Pembayaran diproses oleh Midtrans</b><span>Nomor order Anda akan dicantumkan pada struk pembayaran.</span></div>${methodList ? `<div class="payment-methods-note"><b>Available payment methods</b><span>${escapeHtml(methodList)}</span></div>` : ''}`;
    const script = document.createElement('script'); script.src = gateway.snap_js; script.setAttribute('data-client-key', gateway.client_key); document.head.appendChild(script);
    script.onload = () => { button.disabled = false; button.textContent = window.snap?.pay ? 'Buka checkout Midtrans' : 'Lanjut ke checkout Midtrans'; if (!window.snap?.pay) details.innerHTML += '<span class="midtrans-error">Snap popup tidak siap. Checkout akan dibuka melalui halaman Midtrans.</span>'; };
    script.onerror = () => { details.innerHTML += '<span class="midtrans-error">Snap.js gagal dimuat. Checkout tetap bisa dilanjutkan melalui halaman Midtrans.</span>'; button.disabled = false; button.textContent = 'Lanjut ke checkout Midtrans'; };
    button.addEventListener('click', async () => { button.disabled = true; button.textContent = 'Menyiapkan checkout…'; try { const items = draft.items || [{product:draft.product, quantity:draft.quantity || 1, total:draft.total}]; const transaction = await api('/api/payments/snap-token', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({order_id:draft.order_id, gross_amount:Math.round(draft.total), item_details:items.map((item) => ({id:item.product, price:Math.max(1, Math.round(Number(item.total || 0) / Math.max(1, Number(item.quantity || 1)))), quantity:Number(item.quantity || 1), name:item.product})), customer_details:{first_name:draft.customer || 'Guest', phone:draft.phone || undefined}})}); launchMidtransCheckout(transaction, {onSuccess:() => { localStorage.removeItem(paymentDraftKey); window.location.assign(`cart.html?payment=success&order_id=${encodeURIComponent(transaction.order_id)}`); }, onPending:() => { button.disabled=false; button.textContent='Buka checkout Midtrans'; toast('Pembayaran masih menunggu.'); }, onError:() => { button.disabled=false; button.textContent='Buka checkout Midtrans'; toast('Pembayaran gagal.'); }, onClose:() => {button.disabled=false;button.textContent='Buka checkout Midtrans';}}); } catch (error) { button.disabled=false; button.textContent='Buka checkout Midtrans'; toast(error.message); } });
  }).catch((error) => { details.innerHTML = `<div class="midtrans-not-configured"><b>Midtrans tidak dapat dihubungi</b><span>${escapeHtml(error.message)}</span></div>`; button.disabled = true; });
  $('#backToReview')?.addEventListener('click', () => { location.href = draft.items ? 'cart.html' : `order.html?stage=review&product=${encodeURIComponent(draft.product)}`; });
}

function getShowcaseOrderData() { const product = $('#product')?.value || ''; const size = $('#size')?.value || 'Belum dipilih'; const quantity = Number($('#quantity')?.value || 1); const finish = finishing.find((item) => item[0] === selectedFinishing) || finishing[0]; const item = showcaseProducts.find((entry) => entry.name === product); const kind = productKind(product); const area = sizeAreaM2(size); const legacyAreaProduct = ['Banner', 'X-Banner', 'Spanduk', 'Spanduk Banner', 'Poster', 'Kartu Nama'].includes(product); const price = item ? priceForProduct(product) : kind === 'sticker' ? (size === 'A3' ? 30000 : 15000) : basePrices[product] || 0; const total = kind === 'sticker' ? price * quantity : item || !legacyAreaProduct ? price * quantity : price * area * quantity; return {product, size, material:getMaterialValue(), quantity, area, kind, price, priceUnit: item?.unit || (kind === 'sticker' ? 'lembar' : 'm³'), stickerCount: isBulkSticker(product) ? syncStickerCapacity() : 0, finish: finish[1], finishing: selectedFinishing, file: $('#file')?.files[0]?.name || 'Belum ada file', total}; }
const originalGetOrderData = getOrderData;
function getOrderData() { return getShowcaseOrderData(); }
function updateSummary() { const node = $('#liveSummary'); const total = $('#estimatedTotal'); if (!node || !total) return; const data = getOrderData(); if (!data.product) { node.innerHTML = '<div class="summary-empty">Pilih produk untuk<br>melihat ringkasan.</div>'; total.textContent = 'Rp 0'; return; } const item = showcaseProducts.find((entry) => entry.name === data.product); const catalogItem = catalog.find((entry) => entry[0] === data.product); const image = item ? `/${item.imagePath}` : catalogItem?.[5] || `assets/mockups/${productClass(data.product)}.png`; const stickerLine = isBulkSticker(data.product) ? `<div class="summary-line"><span>Sticker / lembar A3</span><b>${data.stickerCount || '-'} pcs</b></div>` : ''; const materialLine = data.material ? `<div class="summary-line"><span>Bahan</span><b>${escapeHtml(data.material)}</b></div>` : ''; node.innerHTML = `<div class="summary-product"><img src="${image}" alt=""><div><b>${escapeHtml(data.product)}</b><span>${escapeHtml(data.size)}</span></div></div>${materialLine}<div class="summary-line"><span>Luas cetak</span><b>${data.area.toFixed(4)} m³</b></div><div class="summary-line"><span>Harga / ${escapeHtml(data.priceUnit)}</span><b>${money(data.price)}</b></div>${stickerLine}<div class="summary-line"><span>Finishing</span><b>${escapeHtml(data.finish)}</b></div><div class="summary-line"><span>Jumlah</span><b>${data.quantity} unit</b></div>`; total.textContent = money(data.total); }
function validOrder() { const data = getOrderData(); const warning = sizeWarning(data.product, data.size); if (!data.product) return toast('Pilih produk terlebih dahulu.'); if (!data.size || data.size === 'Belum dipilih') return toast('Pilih ukuran produk terlebih dahulu.'); if (warning) { toast(warning); return false; } if (isBulkSticker(data.product) && !getStickerSizeValue()) return toast('Pilih ukuran sticker terlebih dahulu.'); if (!$('#quantity')?.value || data.quantity < 1) return toast('Jumlah pesanan minimal 1.'); if (!$('#file')?.files[0]) return toast('Upload file desain terlebih dahulu.'); return true; }

function renderProductExtras(name) {
  const node = $('#productExtras');
  if (!node) return;
  if (productKind(name) === 'banner') {
    const item = products.find((entry) => entry.name === name);
    const materials = item?.materials || [];
    node.hidden = false;
    node.innerHTML = `${materials.length ? `<label class="material-choice"><span>Bahan</span><select name="material" required>${materials.map((material) => `<option value="${escapeHtml(material)}">${escapeHtml(material)}</option>`).join('')}</select></label>` : ''}<div class="extras-heading"><b>Orientasi preview</b><span>Pilih arah panjang desain.</span></div><fieldset class="banner-orientation-picker"><legend class="sr-only">Orientasi preview</legend><label class="orientation-choice"><input type="radio" name="preview_orientation" value="horizontal" checked><span class="orientation-visual orientation-horizontal"><i></i></span><b>Horizontal</b></label><label class="orientation-choice"><input type="radio" name="preview_orientation" value="vertical"><span class="orientation-visual orientation-vertical"><i></i></span><b>Vertikal</b></label></fieldset>`;
    node.querySelectorAll('[name="preview_orientation"]').forEach((input) => input.addEventListener('change', () => { previewResult = null; }));
    node.querySelector('[name="material"]')?.addEventListener('change', () => { previewResult = null; updateSummary(); });
    return;
  }
  if (!isStickerProduct(name)) { node.hidden = true; node.innerHTML = ''; return; }
  const bulk = isBulkSticker(name);
  node.hidden = false;
  node.innerHTML = `<div class="extras-heading"><b>${bulk ? 'Aturan ukuran sticker' : 'Sticker One Way'}</b><span>${bulk ? 'Kertas A3 dan jumlah muatan dihitung otomatis.' : 'Satu desain, bukan pengulangan bulk.'}</span></div>${bulk ? '<div class="field-grid"><label>Bentuk sticker<select name="sticker_shape"><option value="Kotak">Kotak</option><option value="Bulat">Bulat</option><option value="Custom">Mengikuti desain</option></select></label><label>Ukuran sticker<select name="sticker_size"><option value="5x5 cm">5 × 5 cm</option><option value="7x7 cm">7 × 7 cm</option><option value="10x10 cm">10 × 10 cm</option></select></label></div><p class="sticker-capacity-note">Kapasitas otomatis di A3: <b id="stickerCapacity">-</b> pcs per lembar</p>' : '<p class="sticker-capacity-note">Preview menampilkan satu desain sesuai ukuran yang Anda masukkan.</p>'}<p class="sticker-custom-hint">Jika ukuran/bentuk ingin mengikuti desain (contoh logo Apple), upload gambar PNG dengan background transparan.</p>`;
  setupCustomSelects();
  const refresh = () => { const capacityNode = $('#stickerCapacity'); if (capacityNode) capacityNode.textContent = syncStickerCapacity() || '-'; updateSummary(); };
  node.querySelector('[name="sticker_size"]')?.addEventListener('change', () => { previewResult = null; refresh(); });
  node.querySelector('[name="sticker_shape"]')?.addEventListener('change', () => { previewResult = null; refresh(); });
  refresh();
}

async function preparePreview() {
  if (previewResult) return previewResult;
  if (!validOrder()) return null;
  const form = $('#layoutForm');
  const button = $('.preview-step');
  const panel = $('#designPreview');
  const shell = panel?.querySelector('.mockup-preview-shell');
  const product = form.querySelector('[name="product"]')?.value || '';
  const loading = panel?.querySelector('.preview-loading');
  const image = $('#mockupPreviewImage');
  shell?.classList.remove('preview-glossy');
  image.hidden = true;
  loading.hidden = false;
  loading.classList.add('comic-loading');
  loading.innerHTML = '<span class="preview-loader-visual" aria-hidden="true"><i class="preview-loader-sheet preview-loader-sheet-back"></i><i class="preview-loader-sheet preview-loader-sheet-front"></i><i class="preview-loader-spark">✦</i></span><strong class="preview-loader-text">Menyiapkan…</strong>';
  const payload = new FormData(form);
  payload.set('customer', form.querySelector('[name="customer"]')?.value || 'preview customer');
  payload.set('scale_up', form.querySelector('[name="scale_up"]')?.checked ? 'true' : 'false');
  if (form.querySelector('[name="sticker_size"]')) payload.set('sticker_size', getStickerSizeValue());
  button.disabled = true;
  button.textContent = 'Memproses preview';
  panel.hidden = false;
  $('#previewStatus').textContent = 'Preview diproses…';
  try {
    previewResult = await api('/api/layouts', {method:'POST', body:payload});
    $('#mockupPreviewImage').src = `${previewResult.preview_url}?v=${Date.now()}`;
    image.hidden = false;
    loading.hidden = true;
    loading.classList.remove('comic-loading');
    shell?.classList.add('preview-glossy');
    $('#previewStatus').textContent = 'Preview siap';
    $('#addToCart').hidden = false;
    return previewResult;
  } catch (error) {
    $('#previewStatus').textContent = 'Preview gagal dibuat';
    toast(error.message);
    return null;
  } finally {
    button.disabled = false;
    button.textContent = 'Buat ulang preview';
  }
}

function setupPreviewPlaceholder() {
  const loading = document.querySelector('.preview-loading');
  const image = $('#mockupPreviewImage');
  if (!loading || !image) return;
  loading.innerHTML = '<span class="preview-idle-icon" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M16 45 25 19l25-8-8 25-26 9Z"></path><path d="m25 19 17 17M16 45l11-12"></path><circle cx="45" cy="17" r="3"></circle></svg></span><strong>File siap</strong>';
  image.hidden = true;
  document.querySelector('#file')?.addEventListener('change', () => {
    document.querySelector('.mockup-preview-shell')?.classList.remove('preview-glossy');
    image.hidden = true;
    loading.hidden = false;
    loading.classList.remove('comic-loading');
    image.removeAttribute('src');
    loading.innerHTML = '<span class="preview-idle-icon" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M16 45 25 19l25-8-8 25-26 9Z"></path><path d="m25 19 17 17M16 45l11-12"></path><circle cx="45" cy="17" r="3"></circle></svg></span><strong>File siap</strong>';
  });
}
setupPreviewPlaceholder();

function setupFazimaLoadingScreen() {
  if (!document.querySelector('.fp-loading-screen')) {
    document.body.insertAdjacentHTML('afterbegin', `<div class="fp-loading-screen" role="status" aria-live="polite" aria-label="Memuat Fazima Print"><div class="fp-loader-stage"><div class="fp-loader-mark"><span class="fp-loader-ring"></span><span class="fp-loader-sheet fp-loader-sheet-back"></span><span class="fp-loader-sheet fp-loader-sheet-front"></span><img class="fp-loader-cut" src="assets/real/branding/favicon.png" alt="Fazima Print"></div><div class="fp-loader-copy"><span>PRINTING, MADE SIMPLE.</span></div><div class="fp-loader-progress"><i></i></div><p class="fp-loader-status">Menyiapkan ruang cetak<span class="fp-loader-dots">...</span></p></div></div>`);
  }
  const screen = document.querySelector('.fp-loading-screen');
  const start = performance.now();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    screen.classList.add('is-ready');
    window.setTimeout(() => screen.remove(), 520);
  };
  const afterDomReady = () => window.setTimeout(close, Math.max(0, 220 - (performance.now() - start)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', afterDomReady, {once:true});
  else afterDomReady();
  window.setTimeout(close, 1000);
}
setupFazimaLoadingScreen();

const productDraftKey = 'fazima-print-product-draft';
const paymentDraftKey = 'fazima-print-payment-draft';
function productMeta(name) {
  const showcase = showcaseProducts.find((item) => item.name === name);
  const promo = promoInfo(name);
  const legacy = catalog.find((item) => item[0] === name);
  const descriptions = { 'Cetak Sertifikat':'Cetak sertifikat yang rapi dan tajam untuk sekolah, kantor, acara, dan penghargaan.', 'Stiker Chromo A3+':'Stiker chromo dengan warna kuat untuk label, kemasan, dan kebutuhan promosi.', 'Cetak Flyer/Brosur':'Flyer dan brosur dengan detail teks yang jelas untuk promosi bisnis dan event.', 'Canvas Custom':'Cetak foto atau artwork di canvas untuk dekorasi ruang dan hadiah personal.', 'Flexi China 260gsm':'Media flexi ekonomis untuk banner dan spanduk dengan warna yang tetap terlihat dari jauh.', 'Flexi China 280gsm':'Flexi 280gsm yang lebih solid untuk banner promosi dan signage outdoor.', 'Cetak Kertas Kado':'Kertas kado custom dengan desain pilihanmu untuk kebutuhan personal dan bisnis.', 'Flexi China 440gsm':'Flexi tebal untuk spanduk outdoor yang membutuhkan material lebih kokoh.', 'Gantungan Kunci':'Gantungan kunci custom sebagai merchandise acara, komunitas, dan brand.', 'ID Card':'ID card custom untuk identitas acara, sekolah, kantor, dan komunitas.', 'Mini Banner':'Mini banner praktis untuk meja, booth, kasir, dan display promosi.', 'Mug Custom':'Mug custom dengan desain pilihanmu untuk hadiah atau merchandise brand.', 'Roll Up Banner':'Roll up banner siap pakai untuk booth, presentasi, dan kebutuhan promosi indoor.', 'Stiker Meteran':'Stiker meteran custom untuk branding kendaraan, etalase, dan permukaan luas.', 'Stiker One Way':'Stiker one way untuk kaca dengan tampilan promosi yang tetap nyaman dilihat dari dalam.', 'Stiker Transparan A3':'Stiker transparan untuk label dan branding dengan tampilan bersih.', 'Stiker Vinyl A3+':'Stiker vinyl tahan lama untuk label, merchandise, dan kebutuhan branding.', 'X/Y Banner':'X/Y banner portable untuk event, booth, presentasi, dan promosi luar ruang.', 'Art Paper 120gsm':'Art paper ringan untuk flyer, sertifikat, dan kebutuhan cetak sehari-hari.', 'Art Paper 210gsm':'Art paper dengan hasil warna lebih solid untuk materi promosi dan kartu.', 'Art Paper 150gsm':'Art paper serbaguna untuk flyer, brosur, dan materi komunikasi brand.', 'Art Paper 260gsm':'Art paper tebal untuk kartu, cover, dan cetakan premium.', 'Art Paper 310gsm':'Art paper premium dengan hasil kokoh untuk kebutuhan kartu dan display kertas.', 'Tripod Banner':'Tripod banner yang mudah dipasang untuk acara, booth, dan display promosi.'};
  const databaseDescription = dbCatalogRows.find((row) => row.name === name)?.description;
  const soldCount=Number(showcase?.sales_count||0);
  return {name, description: databaseDescription || '', rating: '', sold: soldCount.toLocaleString('id-ID'), price: promo ? money(promo.promoPrice) : showcase?.price || legacy?.[2] || 'Rp 0', originalPrice: promo ? money(promo.originalPrice) : '', discount: promo?.discount || 0, image: showcase ? `/${showcase.imagePath}` : legacy?.[5]};
}
function productLongDescription(name) { return productMeta(name).description; }
// The detailed product paragraph has its own longer copy and therefore needs
// an explicit English source, not only exact-string DOM replacement.
const productLongEnglish = {
  'Cetak Sertifikat':'Certificate printing for schools, offices, seminars, and awards. Small text stays readable with clean, neat color output.',
  'Stiker Chromo A3+':'Chromo stickers with a smooth surface and bold colors for product labels, packaging, merchandise, and promotions.',
  'Cetak Flyer/Brosur':'Flyers and brochures for business promotions, menus, events, or service information. A4 and A3 sizes support both small and bulk orders.',
  'Canvas Custom':'Print photos or artwork on canvas for room decor, gifts, and personal displays. The canvas texture keeps image details vivid.',
  'Flexi China 260gsm':'Economical 260gsm flexi for banners, signage, and long-distance promotions. Suitable for short campaigns, events, and outdoor use.',
  'Flexi China 280gsm':'280gsm flexi with a more solid material for promotional banners and sturdier signage.',
  'Flexi China 440gsm':'440gsm flexi for large signage that needs a thick, more durable material outdoors.',
  'Cetak Kertas Kado':'Custom gift wrap with your chosen design for gifts, business packaging, and seasonal needs.',
  'Gantungan Kunci':'Custom keychain merchandise for events, communities, schools, and brands. Easy to share as a lasting brand reminder.',
  'ID Card':'ID cards for committees, employees, schools, communities, and events. Custom formats help match your organization’s visual identity.',
  'Mini Banner':'Mini banners for counters, booths, registration desks, and small displays that still need a clear promotional message.',
  'Mug Custom':'Custom mugs for gifts, souvenirs, offices, and merchandise. Use artwork or logos with clear contrast.',
  'Roll Up Banner':'Roll-up banners for booths and indoor presentations. Easy to carry, quick to set up, and simple to store after an event.',
  'Stiker Meteran':'Meter stickers for vehicle, glass, storefront, and large-surface branding. Pricing is calculated by the required surface area.',
  'Stiker One Way':'One-way window stickers show promotional messaging outside while keeping the inside view comfortable.',
  'Stiker Transparan A3':'Transparent stickers for light, clean labels and branding with minimal white backing.',
  'Stiker Vinyl A3+':'Vinyl stickers for labels, merchandise, and branding that need a more durable material than standard paper.',
  'X/Y Banner':'Portable X/Y banners for booths, presentations, events, and promotions that need quick setup in different locations.',
  'Art Paper 120gsm':'Lightweight art paper for flyers, certificates, inserts, and everyday communications with sharp color output.',
  'Art Paper 150gsm':'Versatile art paper with a balanced weight for brochures, flyers, information cards, and promotional materials.',
  'Art Paper 210gsm':'More substantial art paper for promotional materials, cards, covers, and a more premium feel.',
  'Art Paper 260gsm':'Thick art paper for cards, covers, invitations, and materials that need a sturdier sheet.',
  'Art Paper 310gsm':'Premium art paper for cards and covers, with the heaviest character in the art paper range.',
  'Tripod Banner':'Tripod banners for events, booths, and promotional displays that need flexible setup without permanent installation.'
};
function setProductInfo(name) {
  const meta = productMeta(name);
  const displayName = translateValue(meta.name, currentLanguage());
  if ($('#productInfoName')) $('#productInfoName').textContent = displayName;
  if ($('#productInfoDescription')) $('#productInfoDescription').textContent = meta.description;
  if ($('#productInfoImage') && meta.image) { $('#productInfoImage').src = meta.image; $('#productInfoImage').alt = displayName; }
  if ($('#productRating')) $('#productRating').textContent = meta.rating ? `${meta.rating} ★★★★★` : 'Rating belum tersedia';
  if ($('#productSold')) $('#productSold').textContent = meta.sold;
  if ($('#productInfoPrice')) $('#productInfoPrice').textContent = meta.price;
  if ($('#productInfoOriginalPrice')) { $('#productInfoOriginalPrice').textContent = meta.originalPrice; $('#productInfoOriginalPrice').hidden = !meta.originalPrice; }
  if ($('#productPromoBadge')) { $('#productPromoBadge').textContent = meta.discount ? `-${meta.discount}%` : ''; $('#productPromoBadge').hidden = !meta.discount; }
  if ($('#productLongDescription')) $('#productLongDescription').textContent = currentLanguage() === 'en' ? (productLongEnglish[name] || translateValue(productLongDescription(name), 'en')) : productLongDescription(name);
}
function saveProductDraft(result) {
  const data = getOrderData();
  const form = $('#layoutForm');
  localStorage.setItem(productDraftKey, JSON.stringify({
    ...data, id: result.id, output_name: result.output_name, preview_url: result.preview_url, download_url: result.download_url,
    created: Date.now(), customer: form?.querySelector('[name="customer"]')?.value || '', note:form?.querySelector('[name="note"]')?.value?.trim() || '', color_mode: form?.querySelector('[name="color_mode"]')?.value || 'Original', output_format: form?.querySelector('[name="output_format"]')?.value || 'PNG', scale_up: Boolean(form?.querySelector('[name="scale_up"]')?.checked), sticker_shape: form?.querySelector('[name="sticker_shape"]')?.value || '', sticker_size: getStickerSizeValue()
  }));
}
function openDraftDb() {
  return new Promise((resolve, reject) => { const request = indexedDB.open('fazima-print-drafts', 1); request.onupgradeneeded = () => request.result.createObjectStore('files'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function saveDescriptionDraft() {
  const form = $('#layoutForm'); const file = $('#file')?.files[0];
  if (!validOrder()) return false;
  const data = getOrderData();
  const draft = {...data, product:data.product, created:Date.now(), customer:form?.querySelector('[name="customer"]')?.value || '', note:form?.querySelector('[name="note"]')?.value?.trim() || '', color_mode:form?.querySelector('[name="color_mode"]')?.value || 'Original', output_format:form?.querySelector('[name="output_format"]')?.value || 'PNG', scale_up:Boolean(form?.querySelector('[name="scale_up"]')?.checked), sticker_shape:form?.querySelector('[name="sticker_shape"]')?.value || '', sticker_size:getStickerSizeValue(), file:file?.name || ''};
  try { const db = await openDraftDb(); await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(file, 'current'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); localStorage.setItem(productDraftKey, JSON.stringify({...draft, preview_orientation:form?.querySelector('[name="preview_orientation"]:checked')?.value || 'horizontal'})); return true; } catch (_) { toast('File belum bisa disimpan sementara. Coba lagi.'); return false; }
}
async function loadDraftFile() {
  try { const db = await openDraftDb(); return await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readonly'); const request = tx.objectStore('files').get('current'); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); } catch (_) { return null; }
}
function cartItemFromDraft(draft) { return {product:draft.product, size:draft.size, area:draft.area, quantity:draft.quantity, kind:draft.kind, price:draft.price, priceUnit:draft.priceUnit, stickerCount:draft.stickerCount, finish:draft.finish, finishing:draft.finishing, file:draft.file, note:draft.note||'', total:draft.total, id:draft.id, output_name:draft.output_name, preview_url:draft.preview_url, download_url:draft.download_url, created:draft.created || Date.now()}; }
function notifyCartAdded() {
  const node = $('#toast');
  if (!node) return;
  successToast('Pesanan sudah masuk ke keranjang.', 'Cek keranjang');
}
async function addDescriptionToCart() {
  if (!previewResult) { const result = await preparePreview(); if (!result) return; saveProductDraft(result); }
  else if (!localStorage.getItem(productDraftKey)) saveProductDraft(previewResult);
  if (!validOrder()) return;
  const draft = JSON.parse(localStorage.getItem(productDraftKey) || 'null');
  if (!draft) return;
  const items = cartItems(); items.push(cartItemFromDraft(draft)); saveCart(items); notifyCartAdded();
}
function renderReviewSummary(draft) {
  const node = $('#reviewSummary'); if (!node) return;
  node.innerHTML = `<div class="summary-product"><div><b>${escapeHtml(draft.product)}</b><span>${escapeHtml(draft.size)}</span></div></div><div class="summary-line"><span>File desain</span><b>${escapeHtml(draft.file || 'File desain')}</b></div>${draft.note?`<div class="summary-line"><span>Catatan</span><b>${escapeHtml(draft.note)}</b></div>`:''}<div class="summary-line"><span>Finishing</span><b>${escapeHtml(draft.finish || 'Tanpa finishing')}</b></div><div class="summary-line"><span>Jumlah</span><b>${draft.quantity} unit</b></div>`;
  if ($('#reviewTotal')) $('#reviewTotal').textContent = money(draft.total);
}
function showStage(stage) {
  const description = $('#descriptionView'); const info = $('#productInfo'); const review = $('#reviewView'); const payment = $('#paymentView');
  if (description) description.hidden = stage !== 'description';
  if (info) info.hidden = stage !== 'description';
  if (review) review.hidden = stage !== 'review';
  if (payment) payment.hidden = stage !== 'payment';
}
function initDescription() {
  const form = $('#layoutForm'); if (!form) return;
  showStage('description');
  if (page === 'product') {
    document.title = 'Fazima Print · Deskripsi Produk';
    const label = document.querySelector('.product-detail-label'); if (label) label.textContent = 'DESKRIPSI PRODUK';
    const kicker = document.querySelector('.product-info-kicker'); if (kicker) kicker.textContent = 'PRODUCT DESCRIPTION';
    const heading = form.querySelector('.form-heading h2, .form-heading h3'); if (heading) heading.textContent = 'Pilih opsi produk';
    const headingCopy = form.querySelector('.form-heading p'); if (headingCopy) headingCopy.textContent = 'Sesuaikan ukuran, finishing, jumlah, dan desainmu.';
  }
  const requested = new URLSearchParams(location.search).get('product');
  const productSelect = $('#product');
  productSelect.addEventListener('change', (event) => { selectedFinishing = ''; previewResult = null; renderSizes(event.target.value); renderSelectedProduct(event.target.value); setProductInfo(event.target.value); });
  $('#sizePreset').addEventListener('change', () => { previewResult = null; syncSize(); });
  $('#sizeCustom').addEventListener('input', () => { previewResult = null; syncSize(); });
  $('#quantity').addEventListener('input', updateSummary);
  $('#additionalNote')?.addEventListener('input', () => { previewResult = null; updateSummary(); });
  form.addEventListener('input',(event)=>{if(!['sizeWidth','sizeHeight'].includes(event.target.id))return;if(isDimensionalProduct($('#product')?.value)&&$('#sizePreset').value!=='Custom')$('#sizePreset').value='Custom';previewResult=null;syncSize();});
  $('#file').addEventListener('change', (event) => { previewResult = null; $('#addToCart').hidden = true; const file = event.target.files[0]; if (file) { const allowed=/\.(jpe?g|png|pdf)$/i.test(file.name); if(!allowed||file.size>50*1024*1024){event.target.value='';$('#fileName').textContent='JPG, PNG, atau PDF · maksimal 50 MB';$('#designPreview').hidden=true;return toast(!allowed?'Format file harus JPG, PNG, atau PDF.':'Ukuran file maksimal 50 MB.');} $('#fileName').textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`; $('#designPreview').hidden = false; $('#previewTitle').textContent = file.name; $('#previewMeta').textContent = `${(file.size / 1048576).toFixed(2)} MB · ${file.type || 'file desain'}`; } });
  $('.preview-step').addEventListener('click', async () => { const saved = await saveDescriptionDraft(); if (saved) location.href = `order.html?stage=review&product=${encodeURIComponent($('#product').value)}`; });
  $('#addToCart').addEventListener('click', addDescriptionToCart);
  api('/api/products').then((items) => { products = items; productSelect.innerHTML = '<option value="">Pilih produk</option>' + items.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join(''); const name = requested && products.some((item) => item.name === requested) ? requested : ''; if (name) { productSelect.value = name; renderSizes(name); renderSelectedProduct(name); setProductInfo(name); } }).catch(() => toast('Server belum siap.'));
}
async function hydrateReviewDraft(draft) {
  const form = $('#layoutForm'); if (!form) return false;
  const items = await api('/api/products'); products = items;
  const productSelect = $('#product'); productSelect.innerHTML = '<option value="">Pilih produk</option>' + items.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join(''); productSelect.value = draft.product; renderSizes(draft.product);
  const preset = $('#sizePreset'); if ([...preset.options].some((option) => option.value === draft.size)) preset.value = draft.size; else { preset.value = 'Custom'; ensureCustomSizeFields(); const parsed = parseSize(draft.size); if (parsed) { $('#sizeWidth').value = parsed.width; $('#sizeHeight').value = parsed.height; $('#sizeUnit').value = parsed.unit; } } syncSize();
  $('#quantity').value = draft.quantity || 1; $('#quantity').dispatchEvent(new Event('input', {bubbles:true}));
  const finish = [...document.querySelectorAll('#finishingOptions input')].find((input) => input.value === (draft.finishing || '')); if (finish) { finish.checked = true; finish.dispatchEvent(new Event('change', {bubbles:true})); }
  const customer = form.querySelector('[name="customer"]'); if (customer) customer.value = draft.customer || '';
  const color = form.querySelector('[name="color_mode"]'); if (color) color.value = draft.color_mode || 'Original'; const output = form.querySelector('[name="output_format"]'); if (output) output.value = draft.output_format || 'PNG'; const scale = form.querySelector('[name="scale_up"]'); if (scale) scale.checked = draft.scale_up !== false;
  const file = await loadDraftFile(); if (!file) { toast('File desain sementara sudah tidak tersedia.'); return false; } const input = $('#file'); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; $('#fileName').textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`; return true;
}
async function createReviewPreview(draft) {
  const file = await loadDraftFile();
  if (!file) throw new Error('File desain sementara sudah tidak tersedia. Kembali ke deskripsi produk dan upload ulang.');
  const payload = new FormData();
  payload.append('product', draft.product);
  payload.append('size', draft.size);
  payload.append('material', draft.material || '');
  payload.append('quantity', String(draft.quantity || 1));
  payload.append('finishing', draft.finishing || '');
  payload.append('customer', draft.customer || 'preview customer');
  payload.append('color_mode', draft.color_mode || 'Original');
  payload.append('output_format', draft.output_format || 'PNG');
  payload.append('scale_up', draft.scale_up === false ? 'false' : 'true');
  if (draft.preview_orientation) payload.append('preview_orientation', draft.preview_orientation);
  if (draft.sticker_shape) payload.append('sticker_shape', draft.sticker_shape);
  if (draft.sticker_size) payload.append('sticker_size', draft.sticker_size);
  payload.append('file', file, file.name || draft.file || 'design.png');
  const status = $('#reviewPreviewStatus');
  const reviewShell = document.querySelector('.review-preview .mockup-preview-shell');
  const reviewImage = $('#reviewPreviewImage');
  const reviewEmpty = $('#reviewPreviewEmpty');
  reviewShell?.classList.remove('preview-glossy');
  if (reviewImage) { reviewImage.hidden = true; reviewImage.removeAttribute('src'); }
  if (reviewEmpty) { reviewEmpty.hidden = false; reviewEmpty.textContent = 'Preview sedang diproses…'; }
  if (status) status.textContent = 'Preview sedang diproses…';
  const result = await api('/api/layouts', {method:'POST', body:payload});
  if ($('#reviewPreviewImage')) { $('#reviewPreviewImage').src = `${result.preview_url}?v=${Date.now()}`; $('#reviewPreviewImage').hidden = false; }
  if ($('#reviewPreviewEmpty')) $('#reviewPreviewEmpty').hidden = true;
  reviewShell?.classList.add('preview-glossy');
  if (status) status.textContent = 'Preview siap dilihat';
  localStorage.setItem(productDraftKey, JSON.stringify({...draft, ...result}));
  return result;
}
async function initReview() {
  const draft = JSON.parse(localStorage.getItem(productDraftKey) || 'null');
  if (!draft?.product) { location.replace(`product.html?product=${encodeURIComponent(new URLSearchParams(location.search).get('product') || '')}`); return; }
  showStage('review'); setProductInfo(draft.product); renderReviewSummary(draft);
  if ($('#reviewFileName')) $('#reviewFileName').textContent = draft.file || 'File desain';
  const renderPreview = async () => { try { const result = await createReviewPreview(draft); if (result && $('#reviewPreviewStatus')) $('#reviewPreviewStatus').textContent = 'Preview siap dilihat'; } catch (error) { if ($('#reviewPreviewStatus')) $('#reviewPreviewStatus').textContent = `Preview gagal: ${error.message || 'coba lagi'}`; if ($('#reviewPreviewEmpty')) $('#reviewPreviewEmpty').hidden = false; toast(error.message || 'Preview belum dapat diproses.'); } };
  $('#retryReviewPreview')?.addEventListener('click', renderPreview);
  await renderPreview();
  if ($('#continueCheckout')) $('#continueCheckout').textContent = 'Lanjut ke checkout';
  $('#continueCheckout').addEventListener('click', () => {
    const button = $('#continueCheckout');
    if (button.disabled) return;
    const latestDraft = JSON.parse(localStorage.getItem(productDraftKey) || 'null');
    if (!latestDraft?.id || !latestDraft.preview_url) {
      toast('Preview desain belum siap. Coba buat ulang preview sebelum melanjutkan.');
      return;
    }
    button.disabled = true;
    button.textContent = 'Membuka keranjang?';
    try {
      const items = cartItems();
      items.push(cartItemFromDraft(latestDraft));
      saveCart(items);
      location.href = 'cart.html';
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Lanjut ke checkout';
      toast(error.message || 'Produk belum dapat ditambahkan ke keranjang.');
    }
  });
  $('#backToDescription').addEventListener('click', () => { location.href = `product.html?product=${encodeURIComponent(draft.product)}`; });
}
function initPayment() {
  const draft = JSON.parse(localStorage.getItem(paymentDraftKey) || localStorage.getItem(productDraftKey) || 'null');
  if (!draft?.product) { location.replace('/'); return; }
  showStage('payment');
  if ($('#paymentTotal')) $('#paymentTotal').textContent = money(draft.total);
  if ($('#paymentOrderSummary')) $('#paymentOrderSummary').innerHTML = `<b>${escapeHtml(draft.product)}</b><span>${escapeHtml(draft.size)} · ${draft.quantity} unit</span><small>${escapeHtml(draft.finish || 'Tanpa finishing')}</small>`;
  const details = $('#paymentDetails'); const button = $('#payButton');
  api('/api/payments/config').then((gateway) => {
    if (!gateway.configured) { details.innerHTML = '<div class="midtrans-not-configured"><b>Midtrans Sandbox belum aktif</b><span>Set MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY pada backend, lalu restart server.</span></div>'; button.disabled = true; button.textContent = 'Midtrans belum dikonfigurasi'; return; }
    details.innerHTML = '<div class="midtrans-ready"><b>Pembayaran diproses oleh Midtrans</b><span>QRIS, DANA, BCA Virtual Account, dan metode yang aktif di akun merchant akan muncul di checkout.</span></div>';
    const script = document.createElement('script'); script.src = gateway.snap_js; script.setAttribute('data-client-key', gateway.client_key); document.head.appendChild(script);
    script.onload = () => { button.disabled = false; button.textContent = window.snap?.pay ? 'Buka checkout Midtrans' : 'Lanjut ke checkout Midtrans'; if (!window.snap?.pay) details.innerHTML += '<span class="midtrans-error">Snap popup tidak siap. Checkout akan dibuka melalui halaman Midtrans.</span>'; };
    script.onerror = () => { details.innerHTML += '<span class="midtrans-error">Snap.js gagal dimuat. Checkout tetap bisa dilanjutkan melalui halaman Midtrans.</span>'; button.disabled = false; button.textContent = 'Lanjut ke checkout Midtrans'; };
    button.addEventListener('click', async () => { button.disabled = true; button.textContent = 'Menyiapkan checkout…'; try { const amount = Math.max(1000, Math.round(Number(draft.total || 0))); const transaction = await api('/api/payments/snap-token', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({order_id:`FZ-${Date.now()}`, gross_amount:amount, item_details:[{id:draft.product, price:amount, quantity:1, name:draft.product}], customer_details:{first_name:draft.customer || 'Customer Fazima'}})}); launchMidtransCheckout(transaction, {onSuccess:() => { window.location.assign(`${transaction.finish_url}?order_id=${encodeURIComponent(transaction.order_id)}&transaction_status=settlement`); }, onPending:() => toast('Pembayaran masih menunggu.'), onError:() => {button.disabled=false;button.textContent='Buka checkout Midtrans';toast('Pembayaran gagal.');}, onClose:() => {button.disabled=false;button.textContent='Buka checkout Midtrans';}}); } catch (error) { button.disabled=false; button.textContent='Buka checkout Midtrans'; toast(error.message); } });
  }).catch((error) => { details.innerHTML = `<div class="midtrans-not-configured"><b>Midtrans tidak dapat dihubungi</b><span>${escapeHtml(error.message)}</span></div>`; button.disabled = true; });
  $('#backToReview').addEventListener('click', () => { location.href = `order.html?stage=review&product=${encodeURIComponent(draft.product)}`; });
}
function initOrder() {
  const params = new URLSearchParams(location.search); const stage = params.get('stage'); const product = params.get('product') || '';
  if (!stage) { location.replace(`product.html?product=${encodeURIComponent(product)}`); return; }
  if (stage === 'review') initReview(); else if (stage === 'payment') initPayment(); else initDescription();
}

// Final hero implementation: clean image field with explicit manual controls.
function setupHeroSliderLegacyV2() {
  const frame = document.querySelector('.hero-image-main');
  if (!frame || frame.dataset.sliderReady) return;
  const first = frame.querySelector('img');
  if (!first) return;
  const images = ['assets/real/gallery/gallery-1.jpeg', 'assets/real/gallery/gallery-3.jpeg', 'assets/real/gallery/gallery-4.jpeg', 'assets/real/products/banner.jpg'];
  const slides = [first, ...images.map((src, index) => { const image = document.createElement('img'); image.src = src; image.alt = ['Hasil cetak Fazima Print', 'Inspirasi produk printing', 'Banner printing Fazima Print', 'Contoh hasil digital printing'][index]; image.loading = 'lazy'; frame.appendChild(image); return image; })];
  let active = 0;
  const show = (next) => { active = (next + slides.length) % slides.length; slides.forEach((slide, index) => { slide.classList.toggle('active', index === active); slide.setAttribute('aria-hidden', String(index !== active)); }); };
  frame.dataset.sliderReady = 'true'; frame.classList.add('hero-slider'); show(0);
  document.querySelector('.hero-slider-prev')?.addEventListener('click', () => show(active - 1));
  document.querySelector('.hero-slider-next')?.addEventListener('click', () => show(active + 1));
  window.setInterval(() => { if (!document.hidden) show(active + 1); }, 7000);
}
function setupHeroArrowControlsLegacy() {
  const frame = document.querySelector('.hero-image-main'); const slides = [...document.querySelectorAll('.hero-image-main .hero-slide')];
  if (!frame || slides.length < 2 || frame.dataset.arrowControlsReady) return;
  let active = slides.findIndex((slide) => slide.classList.contains('active')); if (active < 0) active = 0;
  const show = (next) => { active = (next + slides.length) % slides.length; slides.forEach((slide, index) => { slide.classList.toggle('active', index === active); slide.setAttribute('aria-hidden', String(index !== active)); }); };
  const bind = (selector, step) => document.querySelector(selector)?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); show(active + step); });
  bind('.hero-slider-prev', -1); bind('.hero-slider-next', 1); frame.dataset.arrowControlsReady = 'true';
}

// Single source of truth for the landing-page hero. The older slider helpers
// remain above for compatibility with previous page experiments, but the boot
// path below deliberately uses this isolated implementation only.
async function setupHeroSliderFinal() {
  const hero = document.querySelector('.landing-hero');
  const frame = hero?.querySelector('.landing-hero-frame');
  const previous = hero?.querySelector('.landing-hero-control-prev');
  const next = hero?.querySelector('.landing-hero-control-next');
  const first = frame?.querySelector('img');
  if (!hero || !frame || !first || frame.dataset.finalSliderReady) return;
  frame.dataset.finalSliderReady = 'loading';

  const border = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  border.classList.add('landing-hero-lightline');
  border.setAttribute('aria-hidden', 'true');
  border.innerHTML = '<rect x="2" y="2" width="1" height="1" rx="28" pathLength="100"></rect>';
  frame.appendChild(border);
  const borderRect = border.querySelector('rect');
  const syncBorder = () => {
    const width = Math.max(1, frame.clientWidth);
    const height = Math.max(1, frame.clientHeight);
    border.setAttribute('viewBox', `0 0 ${width} ${height}`);
    borderRect.setAttribute('width', String(Math.max(1, width - 4)));
    borderRect.setAttribute('height', String(Math.max(1, height - 4)));
    borderRect.setAttribute('rx', window.matchMedia('(max-width: 680px)').matches ? '20' : '28');
  };
  syncBorder();
  if (window.ResizeObserver) new ResizeObserver(syncBorder).observe(frame);

  let heroSlides = [];
  try {
    const settings = await api('/api/hero-images');
    if (Array.isArray(settings.slides)) heroSlides = settings.slides.filter((slide) => slide?.image);
  } catch (error) { console.warn('Hero images unavailable; using built-in images.', error); }
  if (!heroSlides.length) heroSlides = [
    {image:'assets/real/gallery/hero-4cbf29e1768892df6fa6da5a.png', alt:'layout website (1600 x 700 piksel) (2)'},
    {image:'assets/real/gallery/hero-ecca5ea407f7e933d8525638.png', alt:'layout website (1600 x 700 piksel) (1)'},
    {image:'assets/real/gallery/hero-a81a5479e415d574c8c2e7ac.png', alt:'layout website (1600 x 700 piksel)'}
  ];
  first.src = heroSlides[0].image;
  first.alt = heroSlides[0].alt || 'Fazima Print';
  first.classList.add('landing-hero-slide');
  const slides = [first, ...heroSlides.slice(1).map((slide) => {
    const image = document.createElement('img');
    image.src = slide.image;
    image.alt = slide.alt || 'Fazima Print';
    image.loading = 'lazy';
    image.className = 'landing-hero-slide';
    frame.appendChild(image);
    return image;
  })];
  let active = 0;
  const show = (index) => {
    active = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === active;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });
  };
  const move = (step) => { show(active + step); };
  previous?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); move(-1); });
  next?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); move(1); });
  hero.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  });
  hero.tabIndex = 0;
  frame.dataset.finalSliderReady = 'true';
  frame.classList.add('landing-hero-slider');
  show(0);
  window.setInterval(() => { if (!document.hidden) move(1); }, 7000);
}

const favoriteStorageKey = 'fazima-print-favorites';

function readFavoriteProducts() {
  try {
    const stored = JSON.parse(localStorage.getItem(favoriteStorageKey) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter((item) => typeof item === 'string') : []);
  } catch (error) {
    return new Set();
  }
}

function setupCatalogFavorites() {
  document.querySelectorAll('#catalog .showcase-card').forEach((card) => {
    if (card.querySelector('.product-favorite')) return;
    const product = card.dataset.product;
    const media = card.querySelector('.showcase-card-media');
    if (!product || !media) return;

    const button = document.createElement('button');
    button.className = 'product-favorite';
    button.type = 'button';
    button.dataset.favoriteProduct = product;
    button.setAttribute('aria-label', `Simpan ${product} ke favorit`);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const favorites = readFavoriteProducts();
      if (favorites.has(product)) favorites.delete(product);
      else favorites.add(product);
      localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites]));
      syncFavoriteState();
    });

    const syncFavoriteState = () => {
      const active = readFavoriteProducts().has(product);
      button.classList.toggle('is-favorite', active);
      button.textContent = active ? '♥' : '♡';
      button.setAttribute('aria-pressed', String(active));
    };

    media.prepend(button);
    syncFavoriteState();
  });
}

// Catalog cards are rendered asynchronously and refreshed by search/filter updates.
const catalogFavoritesNode = document.querySelector('#catalog');
if (catalogFavoritesNode) {
  setupCatalogFavorites();
  new MutationObserver(setupCatalogFavorites).observe(catalogFavoritesNode, { childList: true, subtree: true });
}

function getShowcaseOrderData() {
  const product = $('#product')?.value || '', size = $('#size')?.value || 'Belum dipilih';
  const quantity = Number($('#quantity')?.value || 1), finish = finishing.find((item) => item[0] === selectedFinishing) || finishing[0];
  const item = showcaseProducts.find((entry) => entry.name === product), dimensional = isDimensionalProduct(product);
  const area = sizeAreaM2(size), price = item ? priceForProduct(product) : Number(basePrices[product] || 0);
  return {product, size, area, dimensional, kind:productKind(product), material:getMaterialValue(), quantity, price,
    priceUnit:dimensional ? 'm'+String.fromCharCode(178) : String(item?.unit || 'pcs'),
    stickerCount:isBulkSticker(product) ? syncStickerCapacity() : 0, finish:finish[1], finishing:selectedFinishing,
    file:$('#file')?.files[0]?.name || 'Belum ada file', note:$('#additionalNote')?.value?.trim() || '',
    total:(dimensional ? price * area : price) * quantity};
}
function updateSummary() {
  const node = $('#liveSummary'), total = $('#estimatedTotal'); if (!node || !total) return;
  const data = getOrderData(); if (!data.product) { node.innerHTML='<div class="summary-empty">Pilih produk untuk<br>melihat ringkasan.</div>'; total.textContent='Rp 0'; return; }
  const item = showcaseProducts.find((entry) => entry.name === data.product), row = dbCatalogRows.find((entry) => entry.name === data.product);
  const image = item ? `/${item.imagePath}` : row?.image_path || `assets/mockups/${productClass(data.product)}.png`;
  const material = data.material ? `<div class="summary-line"><span>Bahan</span><b>${escapeHtml(data.material)}</b></div>` : '';
  const area = data.dimensional ? `<div class="summary-line"><span>Luas cetak</span><b>${data.area.toFixed(4)} m²</b></div>` : '';
  const sticker = isBulkSticker(data.product) ? `<div class="summary-line"><span>Sticker / lembar A3</span><b>${data.stickerCount || '-'} pcs</b></div>` : '';
  const unit = data.dimensional ? 'pesanan' : (item?.unit || 'pcs');
  const fileLine=data.file&&data.file!=='Belum ada file'?`<div class="summary-line"><span>File desain</span><b>${escapeHtml(data.file)}</b></div>`:'';
  const noteLine=data.note?`<div class="summary-line"><span>Catatan</span><b>${escapeHtml(data.note)}</b></div>`:'';
  const sizeLabel=data.size&&data.size!=='Belum dipilih'?`<span>${escapeHtml(data.size)}</span>`:'';
  node.innerHTML=`<div class="summary-product"><img src="/${String(image).replace(/^\//,'')}" alt=""><div><b>${escapeHtml(data.product)}</b>${sizeLabel}</div></div>${material}${area}<div class="summary-line"><span>Harga / ${escapeHtml(data.priceUnit)}</span><b>${money(data.price)}</b></div>${sticker}<div class="summary-line"><span>Finishing</span><b>${escapeHtml(data.finish)}</b></div><div class="summary-line"><span>Jumlah</span><b>${data.quantity} ${escapeHtml(unit)}</b></div>${fileLine}${noteLine}`;
  total.textContent=money(data.total);
}
function validOrder() {
  const data=getOrderData(), warning=sizeWarning(data.product,data.size);
  if(!data.product)return toast('Pilih produk terlebih dahulu.');
  if(!data.size||data.size==='Belum dipilih')return toast(data.dimensional?'Isi panjang (P) dan lebar (L) desain terlebih dahulu.':'Pilih ukuran produk terlebih dahulu.');
  if(warning){toast(warning);return false;}
  if(data.dimensional&&(!data.area||(data.size==='Custom'&&(!$('#sizeWidth')?.value||!$('#sizeHeight')?.value))))return toast('Isi panjang (P) dan lebar (L) desain terlebih dahulu.');
  if(isBulkSticker(data.product)&&!getStickerSizeValue())return toast('Isi ukuran custom sticker terlebih dahulu.');
  if(!$('#quantity')?.value||data.quantity<1||!Number.isInteger(data.quantity))return toast('Jumlah pesanan harus bilangan bulat minimal 1.');
  if(!$('#file')?.files[0])return toast('Upload file desain terlebih dahulu.'); return true;
}
function renderFeaturedProducts() {
  const node=$('#featuredProducts'); if(!node)return;
  if(!dbCatalogRows.length){node.innerHTML='<div class="catalog-load-error"><b>Produk pilihan belum dapat dimuat.</b><span>Database produk belum merespons. Silakan muat ulang halaman.</span></div>';return;}
  const selected=[...dbCatalogRows].sort((a,b)=>Number(b.sales_count||0)-Number(a.sales_count||0)||Number(a.id)-Number(b.id)).slice(0,4);
  node.innerHTML=selected.map((row,index)=>renderUniversalProductCard(row,row.category,0,index)).join('');
  bindUniversalProductCards(node);
  renderFeaturedCategoryLinks();
}

function setupCatalogPage() {
  if(page!=='catalog')return;
  const grid=$('#catalogPageGrid'), groupsNode=$('#categoryGroups'), count=$('#catalogResultCount'), allCount=$('#allCategoryCount'), sort=$('#catalogSort'), searchA=$('#catalogSearch'), searchB=$('#catalogSearchMobile'), notice=$('#catalogSortNotice');
  if(!grid)return;
  const initialQuery=new URLSearchParams(location.search).get('q')||'';
  if(searchA)searchA.value=initialQuery;if(searchB)searchB.value=initialQuery;if($('#productSearch'))$('#productSearch').value=initialQuery;
  if(!dbCatalogRows.length){grid.innerHTML='<div class="catalog-page-empty"><b>Katalog produk belum dapat dimuat.</b><p>Database produk tidak merespons. Periksa koneksi lalu muat ulang halaman.</p><a href="/">Kembali ke beranda</a></div>';if(count)count.textContent='Data tidak tersedia';return;}
  let selectedMain='all',selectedSub='';let sortDirection='asc';const sortAsc=$('#catalogSortAsc'),sortDesc=$('#catalogSortDesc');const updateSortDirection=()=>{sortAsc?.setAttribute('aria-pressed',String(sortDirection==='asc'));sortDesc?.setAttribute('aria-pressed',String(sortDirection==='desc'));};const setSortDirection=(direction)=>{sortDirection=direction;if(sort?.value==='price-low'||sort?.value==='price-high')sort.value=direction==='desc'?'price-high':'price-low';updateSortDirection();render();};
  const mainCategories=[...new Set(dbCatalogRows.map((r)=>String(r.category||'Lainnya')))].sort((a,b)=>a.localeCompare(b));
  const mainLabel=(key)=>storefrontCategories.find((category)=>category.slug===key||String(category.name||'').toLowerCase()===key.toLowerCase())?.name||key.charAt(0).toUpperCase()+key.slice(1);
  const subcategories=[...new Set(dbCatalogRows.map((r)=>String(r.product_type||'Produk')))].sort((a,b)=>a.localeCompare(b));
  const byMain=(key)=>dbCatalogRows.filter((r)=>String(r.category||'Lainnya')===key);
  const renderCategories=()=>{groupsNode.innerHTML=mainCategories.map((main)=>{const subs=[...new Set(byMain(main).map((r)=>String(r.product_type||'Produk')))].sort((a,b)=>a.localeCompare(b));return `<section class="category-group"><button class="category-group-title ${selectedMain===main&&!selectedSub?'active':''}" type="button" data-main="${escapeHtml(main)}"><span>${escapeHtml(mainLabel(main))}</span><small>${byMain(main).length}</small></button><div class="subcategory-list">${subs.map((sub)=>`<button class="subcategory-option ${selectedMain===main&&selectedSub===sub?'active':''}" type="button" data-sub="${escapeHtml(sub)}" data-parent="${escapeHtml(main)}">${escapeHtml(sub)}</button>`).join('')}</div></section>`}).join('');
    groupsNode.querySelectorAll('[data-main]').forEach((button)=>button.addEventListener('click',()=>{selectedMain=button.dataset.main;selectedSub='';renderCategories();render();document.querySelectorAll('[data-category]').forEach((b)=>b.classList.toggle('active',b.dataset.category===selectedMain));}));
    groupsNode.querySelectorAll('[data-sub]').forEach((button)=>button.addEventListener('click',()=>{selectedMain=button.dataset.parent;selectedSub=button.dataset.sub;renderCategories();render();document.querySelectorAll('[data-category]').forEach((b)=>b.classList.toggle('active',b.dataset.category===selectedMain));}));};
  const card=(r,index)=>renderUniversalProductCard(r,mainLabel(String(r.category||'')),0,index);
  function render(){const q=(searchB?.value||searchA?.value||'').trim().toLowerCase();let rows=dbCatalogRows.filter((r)=>(selectedMain==='all'||String(r.category)===selectedMain)&&(!selectedSub||String(r.product_type)===selectedSub)&&(!q||`${r.name} ${r.product_type} ${r.category}`.toLowerCase().includes(q)));
    const mode=sort?.value||'name';const collator=new Intl.Collator('id',{numeric:true,sensitivity:'base'});const price=(row)=>Number(row.promo_price??row.base_price)||0;const dateValue=(row)=>Date.parse(row.created_at||'')||Number(row.id||0);const compare=(a,b)=>{if(mode==='best')return Number(a.sales_count||0)-Number(b.sales_count||0);if(mode==='newest')return dateValue(a)-dateValue(b);if(mode==='price-low'||mode==='price-high')return price(a)-price(b);return collator.compare(a.name,b.name);};const direction=sortDirection==='asc'?1:-1;rows.sort((a,b)=>direction*compare(a,b)||collator.compare(a.name,b.name)||Number(a.id||0)-Number(b.id||0));
    if(count)count.textContent=`${rows.length} produk`;if(allCount)allCount.textContent=dbCatalogRows.length;
    grid.innerHTML=rows.length?rows.map(card).join(''):'<div class="catalog-page-empty"><b>Produk tidak ditemukan.</b><p>Coba kata kunci atau kategori lain.</p></div>';bindUniversalProductCards(grid);
    if(notice){notice.hidden=mode!=='best';notice.textContent=mode==='best'?'Urutan memakai jumlah item dari order website dan invoice kasir yang tercatat; produk tanpa transaksi tercatat ditampilkan setelahnya.':'';}
    grid.querySelectorAll('[data-open-product]').forEach((el)=>{const open=()=>location.href=`product.html?product=${encodeURIComponent(el.dataset.openProduct)}`;el.addEventListener('click',(e)=>{if(e.target.closest('a'))return;open();});el.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}})});
  }
  renderCategories();render();updateSortDirection();
  document.querySelector('[data-category="all"]')?.addEventListener('click',()=>{selectedMain='all';selectedSub='';renderCategories();render();document.querySelectorAll('[data-category]').forEach((b)=>b.classList.toggle('active',b.dataset.category==='all'));});
  sort?.addEventListener('change',()=>{sortDirection=['best','newest','price-high'].includes(sort.value)?'desc':'asc';updateSortDirection();render();});sortAsc?.addEventListener('click',()=>setSortDirection('asc'));sortDesc?.addEventListener('click',()=>setSortDirection('desc'));searchA?.addEventListener('input',()=>{if(searchB)searchB.value=searchA.value;render();});searchB?.addEventListener('input',()=>{if(searchA)searchA.value=searchB.value;render();});
  $('#categoryDrawerToggle')?.addEventListener('click',(e)=>{const open=e.currentTarget.getAttribute('aria-expanded')!=='true';e.currentTarget.setAttribute('aria-expanded',String(open));e.currentTarget.closest('.category-sidebar')?.classList.toggle('open',open);});
}

const localOrderHistoryKey = 'fazima-print-order-history';
function saveLocalOrderHistory(draft) {
  try {
    if (!draft?.order_id) return;
    const entries = JSON.parse(localStorage.getItem(localOrderHistoryKey) || '[]');
    const history = Array.isArray(entries) ? entries : [];
    if (history.some((entry) => entry.order_id === draft.order_id)) return;
    const items = (draft.items || [{product:draft.product, size:draft.size, quantity:draft.quantity}]).map((item) => ({product:item.product || '', size:item.size || '', quantity:Number(item.quantity || 1)}));
    history.unshift({order_id:draft.order_id, created_at:Date.now(), total:Number(draft.total || 0), customer:draft.customer || '', items, status:'pending_payment'});
    localStorage.setItem(localOrderHistoryKey, JSON.stringify(history.slice(0,100)));
  } catch (error) { console.warn('Riwayat order tidak dapat disimpan di perangkat:', error); }
}
function initOrderHistory() {
  const list = $('#orderHistoryList');
  const count = $('#historyCount');
  const form = $('#trackOrderForm');
  const input = $('#trackOrderId');
  const detail = $('#trackedOrder');
  if (!list || !count || !form || !input || !detail) return;
  const readArray = (key) => { try { const value=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(value)?value:[]; } catch (_) { return []; } };
  const historyById = new Map();
  const merge = (entry) => { if(entry?.order_id&&!historyById.has(entry.order_id))historyById.set(entry.order_id,entry); };
  readArray(localOrderHistoryKey).forEach(merge);
  try {
    const account=JSON.parse(localStorage.getItem('fazima-print-auth-user')||'{}')||{};
    const identity=account.uid||account.email?.toLowerCase();
    if(identity)readArray(`fazima-print-checkout-history:${identity}`).forEach(merge);
  } catch (_) {}
  try { const draft=JSON.parse(localStorage.getItem(paymentDraftKey)||'null'); if(draft?.order_id)merge({order_id:draft.order_id,created_at:draft.created_at||Date.now(),total:draft.total,items:draft.items||[{product:draft.product,size:draft.size,quantity:draft.quantity}],status:'pending_payment'}); } catch (_) {}
  const entries=[...historyById.values()].sort((a,b)=>Number(b.created_at||0)-Number(a.created_at||0));
  const dateLabel=(value)=>{const date=new Date(Number(value)||Date.now());return Number.isNaN(date.getTime())?'-':date.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});};
  const renderList=()=>{
    count.textContent=`${entries.length} order`;
    if(!entries.length){list.innerHTML='<div class="history-message"><strong>Belum ada order tersimpan di perangkat ini.</strong><span>Order yang berhasil checkout dari perangkat ini akan muncul di sini.</span><a class="secondary" href="/#products">Lihat produk</a></div>';return;}
    list.innerHTML=entries.map((entry)=>{
      const products=(entry.items||[]).map((item)=>`${item.product||'Pesanan'}${item.size?` ? ${item.size}`:''}`).join(', ')||'Pesanan Fazima Print';
      return `<article class="order-history-item"><div class="history-order-main"><strong>${escapeHtml(entry.order_id)}</strong><small>${escapeHtml(products)} ? ${dateLabel(entry.created_at)}</small></div><div class="history-order-side"><span class="order-status">${escapeHtml(entry.status||'Order tersimpan')}</span><strong>${money(Number(entry.total||0))}</strong><button class="small-button" type="button" data-track-order="${escapeHtml(entry.order_id)}">Lihat status</button></div></article>`;
    }).join('');
    list.querySelectorAll('[data-track-order]').forEach((button)=>button.addEventListener('click',()=>{input.value=button.dataset.trackOrder;trackOrder(button.dataset.trackOrder);}));
  };
  const trackOrder=async(orderNumber)=>{
    detail.innerHTML='<div class="tracked-order"><div class="tracked-order-main"><strong>Memeriksa order...</strong></div></div>';
    try{
      const order=await api(`/api/orders/${encodeURIComponent(orderNumber)}`);
      const payment=order.transaction_status||'Belum dibayar';
      const status=order.status||order.workflow_status||'Menunggu';
      const products=(order.items||[]).map((item)=>`${item.product_name||'Pesanan'}${item.size_label?` ? ${item.size_label}`:''} ? ${item.quantity||1}`).join('<br>')||'Detail produk tidak tersedia';
      detail.innerHTML=`<article class="tracked-order"><div class="tracked-order-main"><strong>${escapeHtml(order.order_number||orderNumber)}</strong><small>${escapeHtml(products)}</small><small>Status order: ${escapeHtml(status)} ? Pembayaran: ${escapeHtml(payment)}</small></div><div class="tracked-order-side"><span class="order-status">${escapeHtml(payment)}</span><strong>${money(Number(order.grand_total||0))}</strong></div></article>`;
      const saved=entries.find((entry)=>entry.order_id===orderNumber); if(saved){saved.status=payment;localStorage.setItem(localOrderHistoryKey,JSON.stringify(entries.slice(0,100)));}
    }catch(error){detail.innerHTML=`<div class="history-message history-error"><strong>Order belum dapat ditemukan</strong><span>${escapeHtml(error.message||'Periksa nomor order dan coba lagi.')}</span></div>`;}
  };
  form.addEventListener('submit',(event)=>{event.preventDefault();const orderNumber=input.value.trim();if(orderNumber)trackOrder(orderNumber);});
  renderList();
  const orderNumber=new URLSearchParams(location.search).get('order_id');
  if(orderNumber){input.value=orderNumber;trackOrder(orderNumber);}
}

function saveAccountCheckoutHistory(draft) {
  try {
    const account = JSON.parse(localStorage.getItem('fazima-print-auth-user') || '{}') || {};
    const identity = account.uid || account.email?.toLowerCase();
    if (!identity || !draft?.order_id) return;
    const key = `fazima-print-checkout-history:${identity}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    const entries = Array.isArray(history) ? history : [];
    if (entries.some((entry) => entry.order_id === draft.order_id)) return;
    const items = (draft.items || [{product:draft.product, size:draft.size, quantity:draft.quantity}]).map((item) => ({product:item.product || '', size:item.size || '', quantity:Number(item.quantity || 1)}));
    entries.unshift({order_id:draft.order_id, created_at:Date.now(), total:Number(draft.total || 0), items});
    localStorage.setItem(key, JSON.stringify(entries.slice(0,100)));
  } catch (error) { console.warn('Riwayat checkout tidak dapat disimpan di perangkat:', error); }
}

function setupAccountHeader() {
  const fallbackAvatar = () => {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'profile-avatar-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.6-3.2 3.3-5 7-5s6.4 1.8 7 5"></path>';
    return icon;
  };
  const render = () => {
    let account = {};
    try { account = JSON.parse(localStorage.getItem('fazima-print-auth-user') || '{}') || {}; } catch (_) {}
    const label = account.displayName || account.email;
    if (!label) return;
    document.querySelectorAll('.login-link').forEach((link) => {
      link.replaceChildren();
      if (account.photoURL) {
        const photo = document.createElement('img');
        photo.className = 'profile-avatar-photo';
        photo.alt = '';
        photo.src = account.photoURL;
        photo.addEventListener('error', () => link.replaceChildren(fallbackAvatar()), {once:true});
        link.append(photo);
      } else {
        link.append(fallbackAvatar());
      }
      link.href = '/profile.html';
      link.classList.add('is-signed-in');
      link.setAttribute('aria-label', `Profil ${label}`);
      link.title = account.email || label;
    });
  };
  render();
  window.addEventListener('fazima:account-updated', render);
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.login-link');
    if (!link) return;
    let account = {};
    try { account = JSON.parse(localStorage.getItem('fazima-print-auth-user') || '{}') || {}; } catch (_) {}
    if (account.uid || account.email) {
      event.preventDefault();
      window.location.assign('/profile.html');
    }
  }, true);
}
setupAccountHeader();

// Boot only after every state constant and final flow function exists.
async function bootCustomerApp() {
  try { await hydrateCatalogFromDatabase(); }
  catch (error) { console.error('MySQL catalog unavailable:', error); toast(error.message || 'Katalog database belum siap.'); }
  document.querySelectorAll('.main-nav').forEach((nav) => {
    nav.querySelectorAll('a').forEach((link) => { if (/^(Produk|Kategori)$/i.test(link.textContent.trim())) { link.href='catalog.html'; link.textContent='Semua Produk'; } });
    if (!nav.querySelector('a[href="catalog.html"]')) { const link=document.createElement('a');link.href='catalog.html';link.textContent='Semua Produk';nav.prepend(link); }
    if (!nav.querySelector('a[href="order-history.html"]')) { const link = document.createElement('a'); link.href = 'order-history.html'; link.textContent = 'Riwayat Order'; nav.appendChild(link); }
  });
  updateCartCount(); setupTheme(); setupChat(); setupMobileMenu(); setupMobileSearchToggle(); setupCustomSelects(); setupProductSearch();
  document.querySelectorAll('label.drop input[type="file"]').forEach((input) => input.addEventListener('change', () => { const drop = input.closest('.drop'); const hasFile = Boolean(input.files?.length); drop?.classList.toggle('has-file', hasFile); const title = drop?.querySelector('strong'); if (title) title.textContent = hasFile ? 'File siap ditambahkan' : 'Pilih atau tarik file ke sini'; }));
  new MutationObserver(() => document.querySelectorAll('select:not([data-customized]):not(#catalogSort)').forEach(enhanceSelect)).observe(document.body, {childList:true, subtree:true});
  if (page === 'home') { renderPromotions(); setupPromoCountdown(); renderCatalog(); renderFeaturedProducts(); setupHeroSliderFinal(); }
  if (page === 'catalog') setupCatalogPage();
  if (page === 'product') initDescription();
  if (page === 'order') initOrder();
  if (page === 'payment') initCartPayment();
  if (page === 'cart') initCart();
  // Google sign-in is initialized by firebase-auth.js (ES module).
  if (page === 'order-history') initOrderHistory();
  setupAnimations();
  try { setupLanguageSwitcher(); } catch (error) { console.error('Language switcher failed to initialize:', error); }
}
bootCustomerApp();
