/* ==========================================================
   RuAl - script.js (revisi)
   Dipakai oleh semua halaman: index (login), data, form, tabel,
   petugas, katalog.
   Sesuai modul: JavaScript & jQuery (Modul 6), AJAX + JSON (Modul 10),
   Bootstrap (Modul 5), plugin jQuery: DataTables dan jQuery Validation.
   ========================================================== */

// ---------- Tema terang/gelap mengikuti perangkat ----------
document.documentElement.setAttribute(
  "data-bs-theme",
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
);

// ---------- Konstanta & state ----------
var KEY_UBAH = "ruai_perubahan";   // perubahan lokal: pengajuan, status, katalog (tambah, ubah, hapus)
var KEY_SESI = "ruai_sesi";        // sesi login (hilang saat tab ditutup)
var MAKS_UKURAN = 2 * 1024 * 1024; // 2 MB per file
var MAKS_FILE = 3;                 // maksimal 3 file per pengajuan

// Akun demo (tanpa backend)
var AKUN = [
  {
    role: "mahasiswa", id: "2210123", sandi: "mahasiswa123",
    nama: "Rani Putri", peran: "Mahasiswa",
    detail: [
      ["NIM", "2210123"],
      ["Program studi", "Teknologi Informasi"],
      ["Email", "rani.putri@student.ac.id"]
    ]
  },
  {
    role: "petugas", id: "P-001", sandi: "petugas123",
    nama: "Budi Santoso", peran: "Petugas Laboratorium",
    detail: [
      ["ID petugas", "P-001"],
      ["Email", "budi.santoso@lab.ac.id"]
    ]
  }
];

// Halaman mana boleh dibuka siapa
var HALAMAN_ROLE = {
  login: "tamu",
  data: "mahasiswa", form: "mahasiswa", tabel: "mahasiswa",
  petugas: "petugas", katalog: "petugas"
};

var BERANDA = { mahasiswa: "data.html", petugas: "petugas.html" };

var MENU = {
  mahasiswa: [
    { hal: "data", href: "data.html", teks: "Katalog" },
    { hal: "form", href: "form.html", teks: "Form pengajuan" },
    { hal: "tabel", href: "tabel.html", teks: "Pengajuan saya" }
  ],
  petugas: [
    { hal: "petugas", href: "petugas.html", teks: "Pengajuan" },
    { hal: "katalog", href: "katalog.html", teks: "Kelola katalog" }
  ]
};

var AKUN_AKTIF = null;
var barang = [];          // dari data/barang.json (AJAX)
var pinjam = [];          // dari data/peminjaman.json (AJAX) + perubahan lokal
var PEMINJAM_LOGIN = "";
var barangDipilih = null;
var lampiranForm = [];
var tabel = null;
var filterKatalog = "semua";
var tampilPetugas = "antrean";
var tampilKatalog = "aktif";
var idHapus = null;
var idUbah = null;         // null = sedang menambah barang baru

var STATUS_PETUGAS = {
  antrean: ["menunggu"],
  aktif: ["disetujui"],
  riwayat: ["dikembalikan", "ditolak"]
};

var BADGE = {
  menunggu: "text-bg-warning",
  disetujui: "text-bg-success",
  ditolak: "text-bg-danger",
  dikembalikan: "badge-selesai"
};

var LABEL_STATUS = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dikembalikan: "Selesai"
};

var BAHASA_TABEL = {
  search: "Cari:",
  lengthMenu: "Tampilkan _MENU_ data",
  info: "Menampilkan _START_ - _END_ dari _TOTAL_ data",
  infoEmpty: "Tidak ada data",
  infoFiltered: "(disaring dari _MAX_ data)",
  emptyTable: "Belum ada data di sini.",
  zeroRecords: "Tidak ada hasil yang cocok.",
  paginate: { previous: "Sebelumnya", next: "Berikutnya" }
};

// ---------- Fungsi bantu ----------
function tglISO(selisihHari) {
  var x = new Date();
  x.setDate(x.getDate() + selisihHari);
  return x.toISOString().slice(0, 10);
}

function fmtTgl(s) {
  return new Date(s + "T00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function rentangTgl(l) {
  return fmtTgl(l.mulai) + (l.mulai !== l.selesai ? " - " + fmtTgl(l.selesai) : "");
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function kb(n) {
  return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
}

function cariBarang(id) {
  return barang.filter(function (b) { return b.id === id; })[0];
}

function cariPinjam(id) {
  return pinjam.filter(function (l) { return l.id === id; })[0];
}

function tersedia(b) {
  var dipakai = pinjam
    .filter(function (l) { return l.barang === b.id && l.status === "disetujui"; })
    .reduce(function (a, l) { return a + l.jumlah; }, 0);
  return b.stok - dipakai;
}

function toast(teks) {
  $("#toastApp .toast-body").text(teks);
  bootstrap.Toast.getOrCreateInstance(document.getElementById("toastApp"), { delay: 2600 }).show();
}

function badgeStatus(s) {
  return '<span class="badge rounded-pill ' + BADGE[s] + '">' + LABEL_STATUS[s] + "</span>";
}

function inisial(nama) {
  return nama.split(" ").slice(0, 2).map(function (k) { return k.charAt(0); }).join("").toUpperCase();
}

function lampiranHtml(l) {
  var f = l.lampiran || [];
  if (!f.length) return '<span class="ket small">Tanpa lampiran</span>';
  return f.map(function (x, i) {
    return '<span class="chip"><b>' + (x.tipe === "application/pdf" ? "PDF" : "IMG") + "</b>" +
      esc(x.nama) + " <small>" + kb(x.ukuran) + "</small>" +
      '<button type="button" class="btn btn-link btn-sm p-0 btn-lihat" data-id="' + l.id +
      '" data-idx="' + i + '">Lihat</button></span>';
  }).join("");
}

// ---------- Perubahan lokal (localStorage) ----------
// Data dasar SELALU diambil dari JSON lewat AJAX. Yang disimpan di browser hanya
// perubahan: pengajuan baru, status, serta barang yang ditambah, diubah, atau dihapus.
function bacaPerubahan() {
  try {
    var p = JSON.parse(localStorage.getItem(KEY_UBAH));
    if (p && typeof p === "object") {
      p.baru = p.baru || [];
      p.status = p.status || {};
      p.hapus = p.hapus || {};
      p.tambah = p.tambah || [];
      p.edit = p.edit || {};
      return p;
    }
  } catch (e) { /* pakai bawaan */ }
  return { baru: [], status: {}, hapus: {}, tambah: [], edit: {} };
}

function simpanPerubahan(p) {
  try {
    localStorage.setItem(KEY_UBAH, JSON.stringify(p));
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- Sesi login & hak akses ----------
function bacaSesi() {
  try {
    var s = JSON.parse(sessionStorage.getItem(KEY_SESI));
    if (s && s.role && s.id) {
      return AKUN.filter(function (a) { return a.role === s.role && a.id === s.id; })[0] || null;
    }
  } catch (e) { /* belum login */ }
  return null;
}

// Mengembalikan true kalau halaman boleh dilanjutkan
function jagaAkses(hal) {
  var akun = bacaSesi();
  var aturan = HALAMAN_ROLE[hal];

  if (hal === "login") {
    if (akun) { window.location.replace(BERANDA[akun.role]); return false; }
    return true;
  }
  if (!akun) { window.location.replace("index.html"); return false; }
  if (aturan !== "semua" && aturan !== akun.role) {
    window.location.replace(BERANDA[akun.role]);
    return false;
  }
  AKUN_AKTIF = akun;
  PEMINJAM_LOGIN = akun.role === "mahasiswa" ? akun.nama + " / " + akun.id : "";
  return true;
}

function keluar() {
  try { sessionStorage.removeItem(KEY_SESI); } catch (e) { /* abaikan */ }
  window.location.href = "index.html";
}

// ---------- Navbar: menu + akun profil di kanan atas ----------
function renderNavbar(hal) {
  var a = AKUN_AKTIF;

  $("#navMenu").html(MENU[a.role].map(function (m) {
    var aktif = m.hal === hal;
    return '<li class="nav-item"><a class="nav-link' + (aktif ? " active" : "") + '" href="' + m.href + '"' +
      (aktif ? ' aria-current="page"' : "") + ">" + m.teks + "</a></li>";
  }).join(""));

  $(".navbar-brand").attr("href", BERANDA[a.role]);

  var detail = a.detail.map(function (d) {
    return "<dt>" + esc(d[0]) + "</dt><dd>" + esc(d[1]) + "</dd>";
  }).join("");

  $("#akunMenu").html(
    '<div class="dropdown">' +
      '<button type="button" class="btn btn-akun" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Menu akun ' + esc(a.nama) + '">' +
        '<span class="avatar">' + inisial(a.nama) + "</span>" +
        '<span class="fw-semibold">' + esc(a.nama.split(" ")[0]) + "</span>" +
      "</button>" +
      '<div class="dropdown-menu dropdown-menu-end akun-panel p-0">' +
        '<div class="akun-kepala"><span class="avatar avatar-lg">' + inisial(a.nama) + "</span>" +
          '<div><div class="fw-bold">' + esc(a.nama) + '</div><span class="badge rounded-pill badge-role">' + esc(a.peran) + "</span></div></div>" +
        '<dl class="akun-detail">' + detail + "</dl>" +
        '<div class="akun-aksi"><button type="button" class="btn btn-outline-primary w-100 btn-keluar">Keluar</button></div>' +
      "</div>" +
    "</div>"
  );

  $(".btn-keluar").on("click", keluar);
}

// ---------- AJAX: memuat data JSON (setiap halaman dibuka) ----------
function muatData() {
  var d = $.Deferred();

  $.when(
    $.ajax({ url: "data/barang.json", dataType: "json", cache: false }),
    $.ajax({ url: "data/peminjaman.json", dataType: "json", cache: false })
  )
    .done(function (r1, r2) {
      var ubah = bacaPerubahan();

      // Barang dasar (JSON) + perubahan (Update) + barang baru (Create)
      barang = r1[0].map(function (b) {
        var e = ubah.edit[b.id];
        if (e) { b.nama = e.nama; b.lokasi = e.lokasi; b.stok = e.stok; }
        return b;
      }).concat(ubah.tambah);
      barang.forEach(function (b) {
        b.dihapus = ubah.hapus[b.id] || null; // berisi alasan kalau sudah dihapus
      });

      var dasar = r2[0].map(function (x) {
        x.mulai = tglISO(x.mulaiHari);
        x.selesai = tglISO(x.selesaiHari);
        delete x.mulaiHari;
        delete x.selesaiHari;
        return x;
      });
      dasar.forEach(function (l) {
        if (ubah.status[l.id]) l.status = ubah.status[l.id];
      });
      pinjam = ubah.baru.concat(dasar);

      d.resolve();
    })
    .fail(function () { d.reject(); });

  return d.promise();
}

// ---------- Pratinjau lampiran ----------
function dataUrlKeBlobUrl(dataUrl) {
  var bagian = dataUrl.split(",");
  var mime = bagian[0].match(/:(.*?);/)[1];
  var bin = atob(bagian[1]);
  var u8 = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([u8], { type: mime }));
}

function bukaPratinjau(idPinjam, idx) {
  var f = cariPinjam(idPinjam).lampiran[idx];
  $("#lihatJudul").text(f.nama);
  if (f.tipe === "application/pdf") {
    $("#lihatIsi").html('<iframe class="pdf-frame" title="' + esc(f.nama) + '" src="' + dataUrlKeBlobUrl(f.url) + '"></iframe>');
  } else {
    $("#lihatIsi").html('<img class="img-fluid rounded" alt="' + esc(f.nama) + '" src="' + f.url + '">');
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById("modalLihat")).show();
}

function eventBersama() {
  $(document).on("click", ".btn-lihat", function () {
    bukaPratinjau(+$(this).data("id"), +$(this).data("idx"));
  });
  $("#modalLihat").on("hidden.bs.modal", function () { $("#lihatIsi").empty(); });
  $("#btnReset").on("click", function (e) {
    e.preventDefault();
    localStorage.removeItem(KEY_UBAH);
    location.reload();
  });
}

/* ==========================================================
   HALAMAN LOGIN (index.html) + plugin jQuery Validation
   ========================================================== */
function tampilError(teks) {
  $("#fErr").text(teks).removeClass("d-none").hide().fadeIn(150);
}

function initLogin() {
  function aturPeran(p) {
    var mhs = p === "mahasiswa";
    $("#lblId").text(mhs ? "NIM" : "ID petugas");
    $("#fId").attr("placeholder", mhs ? "Contoh: 2210123" : "Contoh: P-001").val("");
    $("#fSandi").val("");
    $("#hintDemo").html(
      "Akun demo: <b>" + (mhs ? "2210123" : "P-001") + "</b> / sandi <b>" + (mhs ? "mahasiswa123" : "petugas123") + "</b>"
    );
    $("#fErr").addClass("d-none");
    var v = $("#formLogin").data("validator");
    if (v) v.resetForm();
    $("#formLogin .is-invalid").removeClass("is-invalid");
  }

  $("input[name=peran]").on("change", function () { aturPeran(this.value); });
  aturPeran($("input[name=peran]:checked").val());

  $("#btnIsi").on("click", function () {
    var p = $("input[name=peran]:checked").val();
    var a = AKUN.filter(function (x) { return x.role === p; })[0];
    $("#fId").val(a.id).removeClass("is-invalid");
    $("#fSandi").val(a.sandi).removeClass("is-invalid");
    $("#formLogin .invalid-feedback").remove();
  });

  $("#formLogin").validate({
    errorElement: "div",
    errorClass: "is-invalid",
    validClass: "",
    errorPlacement: function (error, el) {
      error.addClass("invalid-feedback");
      error.insertAfter(el);
    },
    rules: {
      id: { required: true },
      sandi: { required: true, minlength: 6 }
    },
    messages: {
      id: { required: "NIM atau ID petugas wajib diisi." },
      sandi: { required: "Kata sandi wajib diisi.", minlength: "Minimal 6 karakter." }
    },
    submitHandler: function () {
      var peran = $("input[name=peran]:checked").val();
      var id = $("#fId").val().trim();
      var sandi = $("#fSandi").val();
      var akun = AKUN.filter(function (a) {
        return a.role === peran && a.id.toLowerCase() === id.toLowerCase() && a.sandi === sandi;
      })[0];

      if (!akun) {
        return tampilError("NIM/ID atau kata sandi tidak cocok untuk peran yang dipilih. Periksa lagi, atau pakai akun demo di bawah.");
      }
      try { sessionStorage.setItem(KEY_SESI, JSON.stringify({ role: akun.role, id: akun.id })); } catch (e) { /* abaikan */ }
      window.location.href = BERANDA[akun.role];
    }
  });
}

/* ==========================================================
   HALAMAN DATA (katalog mahasiswa)
   ========================================================== */
function renderKatalog() {
  var html = barang
    .filter(function (b) { return !b.dihapus && (filterKatalog === "semua" || b.tipe === filterKatalog); })
    .map(function (b) {
      var t = tersedia(b);
      var ruang = b.tipe === "ruangan";
      var info = ruang ? (t ? "Tersedia" : "Sedang dipakai") : "Tersedia " + t + " dari " + b.stok;
      var tombol = t
        ? '<a class="btn btn-primary align-self-start mt-auto" href="form.html?barang=' + b.id + '">Ajukan pinjam</a>'
        : '<button type="button" class="btn btn-primary align-self-start mt-auto" disabled>Ajukan pinjam</button>';
      return '<div class="col-sm-6 col-lg-4">' +
        '<div class="card item-card ' + (ruang ? "ruang" : "") + ' h-100"><div class="card-body d-flex flex-column gap-1">' +
        '<h3 class="h5 card-title mb-0">' + esc(b.nama) + "</h3>" +
        '<div class="ket small">' + esc(b.lokasi) + "</div>" +
        '<div class="stok fw-semibold small mb-2 ' + (t ? "" : "habis") + '">' + info + "</div>" +
        tombol + "</div></div></div>";
    }).join("");
  $("#katalog").html(html || '<div class="col-12"><p class="ket">Belum ada barang di kategori ini.</p></div>');
}

function initData() {
  renderKatalog();
  $(".filter-btn").on("click", function () {
    filterKatalog = $(this).data("filter");
    $(".filter-btn").removeClass("active");
    $(this).addClass("active");
    renderKatalog();
  });
}

/* ==========================================================
   HALAMAN FORM (pengajuan) + plugin jQuery Validation
   ========================================================== */
function gambarChipForm() {
  $("#fDaftar").html(lampiranForm.map(function (f, i) {
    return '<span class="chip"><b>' + (f.tipe === "application/pdf" ? "PDF" : "IMG") + "</b>" + esc(f.nama) +
      " <small>" + kb(f.ukuran) + '</small><button type="button" class="btn btn-link btn-sm p-0 btn-hapus" data-i="' +
      i + '" aria-label="Hapus ' + esc(f.nama) + '">Hapus</button></span>';
  }).join(""));
}

function bacaFile(f) {
  return new Promise(function (resolve) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.readAsDataURL(f);
  });
}

async function pilihFile(daftar) {
  $("#fErr").addClass("d-none");
  for (var i = 0; i < daftar.length; i++) {
    var f = daftar[i];
    if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(f.type)) {
      tampilError('"' + f.name + '" bukan JPG, PNG, atau PDF.');
      continue;
    }
    if (f.size > MAKS_UKURAN) {
      tampilError('"' + f.name + '" lebih dari 2 MB. Kecilkan ukurannya dulu.');
      continue;
    }
    if (lampiranForm.length >= MAKS_FILE) {
      tampilError("Maksimal 3 file per pengajuan.");
      break;
    }
    lampiranForm.push({ nama: f.name, ukuran: f.size, tipe: f.type, url: await bacaFile(f) });
  }
  gambarChipForm();
}

function pilihBarang(id) {
  barangDipilih = id ? cariBarang(+id) : null;
  if (!barangDipilih) {
    $("#infoBarang").text("Pilih alat atau ruangan yang ingin dipinjam.");
    $("#grupJumlah").show();
    return;
  }
  var ruang = barangDipilih.tipe === "ruangan";
  var t = tersedia(barangDipilih);
  $("#infoBarang").text(barangDipilih.lokasi + " · " + (ruang ? (t ? "Tersedia" : "Sedang dipakai") : "Tersedia " + t + " dari " + barangDipilih.stok));
  $("#fJumlah").val(1).attr("max", t);
  $("#grupJumlah").toggle(!ruang);
}

function kirimPengajuan() {
  var ruang = barangDipilih.tipe === "ruangan";
  if (!lampiranForm.length) return tampilError("Lampirkan minimal satu surat atau bukti pendukung.");

  var ubah = bacaPerubahan();
  var baru = {
    id: pinjam.reduce(function (m, l) { return Math.max(m, l.id); }, 0) + 1,
    barang: barangDipilih.id,
    jumlah: ruang ? 1 : +$("#fJumlah").val(),
    peminjam: PEMINJAM_LOGIN,
    mulai: $("#fMulai").val(),
    selesai: $("#fSelesai").val(),
    keperluan: $("#fKeperluan").val().trim(),
    status: "menunggu",
    lampiran: lampiranForm
  };
  ubah.baru.unshift(baru);

  if (!simpanPerubahan(ubah)) {
    return tampilError("Penyimpanan browser penuh. Kecilkan ukuran lampiran atau kurangi jumlah file.");
  }
  try { sessionStorage.setItem("ruai_toast", "Pengajuan terkirim, menunggu persetujuan"); } catch (e) { /* abaikan */ }
  window.location.href = "tabel.html";
}

function initForm() {
  // Isi pilihan barang dari data JSON (hasil AJAX); barang yang dihapus tidak muncul
  var opsi = function (tipe) {
    return barang.filter(function (b) { return b.tipe === tipe && !b.dihapus; }).map(function (b) {
      var habis = tersedia(b) < 1;
      return '<option value="' + b.id + '"' + (habis ? " disabled" : "") + ">" + esc(b.nama) +
        (habis ? " (tidak tersedia)" : "") + "</option>";
    }).join("");
  };
  $("#fBarang").html('<option value="">Pilih alat atau ruangan</option>' +
    '<optgroup label="Alat">' + opsi("alat") + "</optgroup>" +
    '<optgroup label="Ruangan">' + opsi("ruangan") + "</optgroup>");

  var awal = new URLSearchParams(window.location.search).get("barang");
  var b0 = awal ? cariBarang(+awal) : null;
  if (b0 && !b0.dihapus) $("#fBarang").val(awal);
  pilihBarang($("#fBarang").val());

  // Nama / NIM diambil dari akun yang sedang login
  $("#fNama").val(PEMINJAM_LOGIN);
  $("#fMulai").val(tglISO(1));
  $("#fSelesai").val(tglISO(1));

  $("#fBarang").on("change", function () { pilihBarang($(this).val()); });

  $("#fFile").on("change", function () {
    var daftar = Array.prototype.slice.call(this.files);
    this.value = "";
    pilihFile(daftar);
  });

  $("#fDaftar").on("click", ".btn-hapus", function () {
    lampiranForm.splice(+$(this).data("i"), 1);
    gambarChipForm();
  });

  $("#btnBatal").on("click", function () { window.location.href = "data.html"; });

  // ----- Plugin jQuery Validation -----
  $.validator.addMethod("tglSetelah", function (nilai, el, param) {
    var awalTgl = $(param).val();
    return !nilai || !awalTgl || nilai >= awalTgl;
  }, "Tanggal kembali harus sama atau setelah tanggal pinjam.");

  $.validator.addMethod("maksTersedia", function (nilai) {
    return !barangDipilih || +nilai <= tersedia(barangDipilih);
  }, function () {
    return "Jumlah maksimal " + (barangDipilih ? tersedia(barangDipilih) : 0) + ".";
  });

  $("#formPinjam").validate({
    errorElement: "div",
    errorClass: "is-invalid",
    validClass: "",
    errorPlacement: function (error, el) {
      error.addClass("invalid-feedback");
      error.insertAfter(el);
    },
    rules: {
      barang: { required: true },
      jumlah: { required: true, digits: true, min: 1, maksTersedia: true },
      mulai: { required: true, date: true },
      selesai: { required: true, date: true, tglSetelah: "#fMulai" },
      keperluan: { required: true, minlength: 5 }
    },
    messages: {
      barang: { required: "Pilih alat atau ruangan." },
      jumlah: { required: "Jumlah wajib diisi.", digits: "Isi dengan angka bulat.", min: "Jumlah minimal 1." },
      mulai: { required: "Tanggal pinjam wajib diisi." },
      selesai: { required: "Tanggal kembali wajib diisi." },
      keperluan: { required: "Keperluan wajib diisi.", minlength: "Jelaskan keperluan minimal 5 karakter." }
    },
    submitHandler: function () {
      kirimPengajuan();
    }
  });
}

/* ==========================================================
   HALAMAN TABEL (pengajuan saya) + plugin DataTables
   ========================================================== */
function initTabel() {
  var milikku = pinjam.filter(function (l) { return l.peminjam === PEMINJAM_LOGIN; });

  tabel = $("#tabelSaya").DataTable({
    data: milikku,
    order: [],
    pageLength: 5,
    lengthChange: false,
    language: BAHASA_TABEL,
    columns: [
      { title: "Barang / ruangan", data: null, render: function (d, t, l) { return esc(cariBarang(l.barang).nama); } },
      { title: "Jumlah", data: "jumlah" },
      { title: "Tanggal", data: null, render: function (d, t, l) { return t === "display" ? rentangTgl(l) : l.mulai; } },
      { title: "Keperluan", data: null, render: function (d, t, l) { return esc(l.keperluan); } },
      { title: "Lampiran", data: null, orderable: false, render: function (d, t, l) { return t === "display" ? lampiranHtml(l) : ""; } },
      { title: "Status", data: null, render: function (d, t, l) { return t === "display" ? badgeStatus(l.status) : l.status; } }
    ]
  });

  try {
    var pesan = sessionStorage.getItem("ruai_toast");
    if (pesan) {
      sessionStorage.removeItem("ruai_toast");
      toast(pesan);
    }
  } catch (e) { /* abaikan */ }
}

/* ==========================================================
   HALAMAN PETUGAS (pengajuan) + plugin DataTables
   ========================================================== */
function hitungStatus(s) {
  return pinjam.filter(function (l) { return l.status === s; }).length;
}

function perbaruiStatistik() {
  $("#statMenunggu").text(hitungStatus("menunggu"));
  $("#statAktif").text(hitungStatus("disetujui"));
  $("#statKembali").text(hitungStatus("dikembalikan"));
}

function isiTabelPetugas() {
  var data = pinjam.filter(function (l) { return STATUS_PETUGAS[tampilPetugas].indexOf(l.status) !== -1; });
  tabel.clear().rows.add(data).draw();
  perbaruiStatistik();
}

function tombolAksi(l) {
  if (l.status === "menunggu") {
    return '<div class="aksi-group">' +
      '<button type="button" class="btn btn-success btn-sm btn-aksi btn-setuju" data-id="' + l.id + '">Setujui</button>' +
      '<button type="button" class="btn btn-danger btn-sm btn-aksi btn-tolak" data-id="' + l.id + '">Tolak</button>' +
      "</div>";
  }
  if (l.status === "disetujui") {
    return '<div class="aksi-group">' +
      '<button type="button" class="btn btn-primary btn-sm btn-aksi btn-selesai btn-kembali" data-id="' + l.id + '">Selesai Peminjaman</button>' +
      "</div>";
  }
  return '<span class="ket small">-</span>';
}

function gambarTabelPetugas() {
  tabel = $("#tabelPetugas").DataTable({
    data: [],
    order: [],
    pageLength: 5,
    lengthChange: false,
    language: BAHASA_TABEL,
    columns: [
      { title: "Peminjam", data: null, render: function (d, t, l) { return esc(l.peminjam); } },
      { title: "Barang / ruangan", data: null, render: function (d, t, l) { return esc(cariBarang(l.barang).nama); } },
      { title: "Jumlah", data: "jumlah" },
      { title: "Tanggal", data: null, render: function (d, t, l) { return t === "display" ? rentangTgl(l) : l.mulai; } },
      { title: "Keperluan", data: null, render: function (d, t, l) { return esc(l.keperluan); } },
      { title: "Lampiran", data: null, orderable: false, render: function (d, t, l) { return t === "display" ? lampiranHtml(l) : ""; } },
      { title: "Status", data: null, render: function (d, t, l) { return t === "display" ? badgeStatus(l.status) : l.status; } },
      { title: "Aksi", data: null, orderable: false, render: function (d, t, l) { return t === "display" ? tombolAksi(l) : ""; } }
    ]
  });
}

// Simpan status ke objek perubahan (dipakai ubahStatus dan hapus barang)
function setStatusLokal(ubah, l, statusBaru) {
  var punyaBaru = ubah.baru.filter(function (x) { return x.id === l.id; })[0];
  if (punyaBaru) punyaBaru.status = statusBaru; // pengajuan buatan mahasiswa
  else ubah.status[l.id] = statusBaru;          // data awal dari JSON
  l.status = statusBaru;
}

function ubahStatus(id, statusBaru, pesan) {
  var l = cariPinjam(id);
  var ubah = bacaPerubahan();
  var lama = l.status;

  setStatusLokal(ubah, l, statusBaru);
  if (!simpanPerubahan(ubah)) {
    l.status = lama;
    toast("Gagal menyimpan perubahan");
    return;
  }
  isiTabelPetugas();
  toast(pesan);
}

function initPetugas() {
  gambarTabelPetugas();
  isiTabelPetugas();

  $(".tab-btn").on("click", function () {
    tampilPetugas = $(this).data("view");
    $(".tab-btn").removeClass("active").attr("aria-selected", "false");
    $(this).addClass("active").attr("aria-selected", "true");
    isiTabelPetugas();
  });

  $("#tabelPetugas").on("click", ".btn-setuju", function () {
    var l = cariPinjam(+$(this).data("id"));
    if (l.jumlah > tersedia(cariBarang(l.barang))) {
      toast("Stok tidak cukup untuk disetujui");
      return;
    }
    ubahStatus(l.id, "disetujui", "Pengajuan disetujui");
  });

  $("#tabelPetugas").on("click", ".btn-tolak", function () {
    ubahStatus(+$(this).data("id"), "ditolak", "Pengajuan ditolak");
  });

  $("#tabelPetugas").on("click", ".btn-kembali", function () {
    ubahStatus(+$(this).data("id"), "dikembalikan", "Peminjaman selesai, stok bertambah");
  });
}

/* ==========================================================
   HALAMAN KATALOG PETUGAS: hapus barang rusak / tidak tersedia
   ========================================================== */
function jumlahStatusBarang(idBarang, status) {
  return pinjam.filter(function (l) { return l.barang === idBarang && l.status === status; }).length;
}

function tombolKatalog(b) {
  if (b.dihapus) {
    return '<button type="button" class="btn btn-outline-primary btn-sm btn-aksi btn-pulihkan" data-id="' + b.id + '">Pulihkan</button>';
  }
  var ubahBtn = '<button type="button" class="btn btn-outline-primary btn-sm btn-aksi btn-ubah-barang" data-id="' + b.id + '">Ubah</button>';
  var hapusBtn = jumlahStatusBarang(b.id, "disetujui") > 0
    ? '<button type="button" class="btn btn-outline-danger btn-sm btn-aksi" disabled ' +
      'title="Masih ada peminjaman aktif. Selesaikan dulu di halaman Pengajuan.">Hapus</button>'
    : '<button type="button" class="btn btn-outline-danger btn-sm btn-aksi btn-hapus-barang" data-id="' + b.id + '">Hapus</button>';
  return '<div class="aksi-group">' + ubahBtn + hapusBtn + "</div>";
}

function isiTabelKatalog() {
  var data = barang.filter(function (b) { return tampilKatalog === "aktif" ? !b.dihapus : !!b.dihapus; });
  tabel.clear().rows.add(data).draw();
  $("#jmlAktif").text(barang.filter(function (b) { return !b.dihapus; }).length);
  $("#jmlHapus").text(barang.filter(function (b) { return !!b.dihapus; }).length);
}

function gambarTabelKatalog() {
  tabel = $("#tabelKatalog").DataTable({
    data: [],
    order: [],
    pageLength: 6,
    lengthChange: false,
    language: BAHASA_TABEL,
    columns: [
      { title: "Barang / ruangan", data: null, render: function (d, t, b) { return esc(b.nama); } },
      { title: "Jenis", data: "tipe", render: function (d) { return d === "alat" ? "Alat" : "Ruangan"; } },
      { title: "Lokasi", data: null, render: function (d, t, b) { return esc(b.lokasi); } },
      { title: "Stok", data: null, render: function (d, t, b) { return t === "display" ? tersedia(b) + " dari " + b.stok : b.stok; } },
      {
        title: "Keterangan", data: null, orderable: false,
        render: function (d, t, b) { return b.dihapus ? esc(b.dihapus) : '<span class="ket small">Tampil di katalog</span>'; }
      },
      { title: "Aksi", data: null, orderable: false, render: function (d, t, b) { return t === "display" ? tombolKatalog(b) : ""; } }
    ]
  });
}

// ----- Create & Update barang (modal form) -----
function aturFormBarang() {
  var ruang = $("#bTipe").val() === "ruangan";
  $("#grupStok").toggle(!ruang);
  $("#bLokasi").attr("placeholder", ruang ? "Contoh: Gedung C, lantai 1 · 30 PC" : "Contoh: Lab Komputer");
}

function bukaFormBarang(b) {
  idUbah = b ? b.id : null;
  $("#barangJudul").text(b ? "Ubah barang" : "Tambah barang");
  $("#bNama").val(b ? b.nama : "");
  $("#bTipe").val(b ? b.tipe : "alat").prop("disabled", !!b);
  $("#bLokasi").val(b ? b.lokasi : "");
  $("#bStok").val(b ? b.stok : 1);
  aturFormBarang();
  var v = $("#formBarang").data("validator");
  if (v) v.resetForm();
  $("#formBarang .is-invalid").removeClass("is-invalid");
  bootstrap.Modal.getOrCreateInstance(document.getElementById("modalBarang")).show();
}

function simpanBarang() {
  var tipe = $("#bTipe").val();
  var data = {
    nama: $("#bNama").val().trim(),
    lokasi: $("#bLokasi").val().trim(),
    stok: tipe === "ruangan" ? 1 : +$("#bStok").val()
  };
  var ubah = bacaPerubahan();
  var b;

  if (idUbah === null) {
    b = {
      id: barang.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1,
      nama: data.nama, tipe: tipe, stok: data.stok, lokasi: data.lokasi, dihapus: null
    };
    ubah.tambah.push({ id: b.id, nama: b.nama, tipe: b.tipe, stok: b.stok, lokasi: b.lokasi });
  } else {
    b = cariBarang(idUbah);
    var baru = ubah.tambah.filter(function (x) { return x.id === b.id; })[0];
    if (baru) { baru.nama = data.nama; baru.lokasi = data.lokasi; baru.stok = data.stok; }
    else ubah.edit[b.id] = data;
  }

  if (!simpanPerubahan(ubah)) {
    toast("Gagal menyimpan perubahan");
    return;
  }
  if (idUbah === null) barang.push(b);
  else { b.nama = data.nama; b.lokasi = data.lokasi; b.stok = data.stok; }

  bootstrap.Modal.getOrCreateInstance(document.getElementById("modalBarang")).hide();
  tampilKatalog = "aktif";
  $(".tab-btn").removeClass("active").attr("aria-selected", "false");
  $('.tab-btn[data-view="aktif"]').addClass("active").attr("aria-selected", "true");
  isiTabelKatalog();
  toast(idUbah === null ? "Barang ditambahkan ke katalog" : "Perubahan disimpan");
}

function initFormBarang() {
  $("#btnTambah").on("click", function () { bukaFormBarang(null); });
  $("#tabelKatalog").on("click", ".btn-ubah-barang", function () {
    bukaFormBarang(cariBarang(+$(this).data("id")));
  });
  $("#bTipe").on("change", aturFormBarang);

  $.validator.addMethod("minDipakai", function (nilai) {
    if (idUbah === null || $("#bTipe").val() === "ruangan") return true;
    var b = cariBarang(idUbah);
    return +nilai >= b.stok - tersedia(b);
  }, function () {
    var b = cariBarang(idUbah);
    return "Stok tidak boleh kurang dari " + (b.stok - tersedia(b)) + " (sedang dipinjam).";
  });

  $("#formBarang").validate({
    errorElement: "div",
    errorClass: "is-invalid",
    validClass: "",
    errorPlacement: function (error, el) {
      error.addClass("invalid-feedback");
      error.insertAfter(el);
    },
    rules: {
      nama: { required: true, minlength: 3 },
      lokasi: { required: true, minlength: 3 },
      stok: { required: { depends: function () { return $("#bTipe").val() === "alat"; } }, digits: true, min: 1, minDipakai: true }
    },
    messages: {
      nama: { required: "Nama barang wajib diisi.", minlength: "Minimal 3 karakter." },
      lokasi: { required: "Lokasi wajib diisi.", minlength: "Minimal 3 karakter." },
      stok: { required: "Stok wajib diisi.", digits: "Isi dengan angka bulat.", min: "Stok minimal 1." }
    },
    submitHandler: function () { simpanBarang(); }
  });
}

function initKatalog() {
  initFormBarang();
  gambarTabelKatalog();
  isiTabelKatalog();

  $(".tab-btn").on("click", function () {
    tampilKatalog = $(this).data("view");
    $(".tab-btn").removeClass("active").attr("aria-selected", "false");
    $(this).addClass("active").attr("aria-selected", "true");
    isiTabelKatalog();
  });

  $("#tabelKatalog").on("click", ".btn-hapus-barang", function () {
    var b = cariBarang(+$(this).data("id"));
    var menunggu = jumlahStatusBarang(b.id, "menunggu");
    idHapus = b.id;
    $("#hapusNama").text(b.nama);
    $("#hapusPeringatan")
      .toggleClass("d-none", !menunggu)
      .text(menunggu + " pengajuan yang masih menunggu untuk barang ini akan otomatis ditolak.");
    $("#hapusAlasan").val("Barang rusak");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalHapus")).show();
  });

  $("#btnKonfirmasiHapus").on("click", function () {
    var b = cariBarang(idHapus);
    var alasan = $("#hapusAlasan").val();
    var ubah = bacaPerubahan();
    var tolak = pinjam.filter(function (l) { return l.barang === b.id && l.status === "menunggu"; });

    ubah.hapus[b.id] = alasan;
    tolak.forEach(function (l) { setStatusLokal(ubah, l, "ditolak"); });

    if (!simpanPerubahan(ubah)) {
      toast("Gagal menyimpan perubahan");
      return;
    }
    b.dihapus = alasan;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalHapus")).hide();
    isiTabelKatalog();
    toast("Barang dihapus dari katalog");
  });

  $("#tabelKatalog").on("click", ".btn-pulihkan", function () {
    var b = cariBarang(+$(this).data("id"));
    var ubah = bacaPerubahan();
    delete ubah.hapus[b.id];
    if (!simpanPerubahan(ubah)) {
      toast("Gagal menyimpan perubahan");
      return;
    }
    b.dihapus = null;
    isiTabelKatalog();
    toast("Barang dikembalikan ke katalog");
  });
}

/* ==========================================================
   Mulai saat dokumen siap
   ========================================================== */
$(document).ready(function () {
  var hal = $("body").data("halaman");
  if (!jagaAkses(hal)) return;

  eventBersama();

  if (hal === "login") {
    initLogin();
    return;
  }

  renderNavbar(hal);

  muatData()
    .done(function () {
      if (hal === "data") initData();
      else if (hal === "form") initForm();
      else if (hal === "tabel") initTabel();
      else if (hal === "petugas") initPetugas();
      else if (hal === "katalog") initKatalog();
    })
    .fail(function () {
      $("#alertError").removeClass("d-none").hide().fadeIn(200);
    });
});
