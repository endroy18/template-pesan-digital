// Generator pesan undangan WhatsApp — logika aplikasi (frontend only).

(function () {
  "use strict";

  const CONFIG = window.APP_CONFIG;
  const STORAGE_KEY = "wa-invite-generator:v1";

  // ---------- State ----------
  const state = {
    event: {
      bride: "",
      groom: "",
      akadDate: "",
      akadTime: "",
      resepsiDate: "",
      resepsiTime: "",
      location: "",
      maps: "",
      link: "",
    },
    eventType: "islam",
    templateId: "formal",
    customText: "",
    aiText: "",
    aiPrompt: "",
    guests: [],
    previewGuestId: null,
  };

  // ---------- Utils ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  function formatDate(dateStr, timeStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    let out = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (timeStr) out += `, ${timeStr.replace(":", ".")} WIB`;
    return out;
  }

  function coupleName() {
    const b = state.event.bride.trim();
    const g = state.event.groom.trim();
    if (b && g) return `${b} & ${g}`;
    return b || g || "{pengantin}";
  }

  function firstWord(name) {
    return String(name || "").trim().split(/\s+/)[0] || "";
  }

  function coupleFirstNames() {
    const b = firstWord(state.event.bride);
    const g = firstWord(state.event.groom);
    if (b && g) return `${g} & ${b}`;
    return g || b || coupleName();
  }

  function phoneDigits(phone) {
    return String(phone ?? "").replace(/\D/g, "");
  }

  // ---------- Persistensi ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state.event = { ...state.event, ...(parsed.event || {}) };
      state.eventType = parsed.eventType || "islam";
      state.templateId = parsed.templateId || "formal";
      state.customText = (parsed.customText || "").replace(/\{akad\}/g, "{acara}");
      state.aiText = parsed.aiText || "";
      state.aiPrompt = parsed.aiPrompt || "";
      state.guests = Array.isArray(parsed.guests) ? parsed.guests : [];
      state.previewGuestId = parsed.previewGuestId || null;
    } catch (e) {
      /* abaikan data korup */
    }
    if (!CONFIG.eventTypes.some((x) => x.id === state.eventType)) {
      state.eventType = "islam";
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage penuh / tidak tersedia */
    }
  }

  // ---------- Data tamu ----------
  function addGuest({ name, greeting, phone }) {
    const id = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    state.guests.push({ id, name: name.trim(), greeting: greeting.trim(), phone: phone.trim() });
    if (!state.previewGuestId) state.previewGuestId = id;
    save();
    renderGuests();
    renderPreview();
    updateBulk();
  }

  function updateGuest(id, patch) {
    const g = state.guests.find((x) => x.id === id);
    if (!g) return;
    Object.assign(g, patch);
    save();
    renderGuests();
    renderPreview();
    updateBulk();
  }

  function removeGuest(id) {
    state.guests = state.guests.filter((x) => x.id !== id);
    if (state.previewGuestId === id) {
      state.previewGuestId = state.guests.length ? state.guests[0].id : null;
    }
    save();
    renderGuests();
    renderPreview();
    updateBulk();
  }

  function getGuest(id) {
    return state.guests.find((x) => x.id === id) || null;
  }

  // ---------- Template & render pesan ----------
  function currentType() {
    return CONFIG.eventTypes.find((x) => x.id === state.eventType) || CONFIG.eventTypes[0];
  }

  function currentTemplateText() {
    if (state.templateId === "custom") return state.customText;
    if (state.templateId === "ai") return state.aiText;
    const t = currentType().templates.find((x) => x.id === state.templateId);
    return t ? t.text : "";
  }

  function buildMessage(guest) {
    const e = state.event;
    const data = {
      s: (guest && guest.greeting.trim()) || "Bapak/Ibu",
      nama: (guest && guest.name.trim()) || "",
      nama_url: encodeURIComponent((guest && guest.name.trim()) || ""),
      pengantin: coupleName(),
      panggilan: coupleFirstNames(),
      acara: formatDate(e.akadDate, e.akadTime),
      resepsi: formatDate(e.resepsiDate, e.resepsiTime),
      lokasi: e.location.trim(),
      maps: e.maps.trim(),
      link: e.link.trim(),
    };

    let text = currentTemplateText();
    for (const [key, val] of Object.entries(data)) {
      text = text.split("{" + key + "}").join(val);
    }

    // Rapikan: trim tiap baris, pertahankan satu baris kosong sebagai jarak
    // antar paragraf (lebih dari satu dilipat), rapatkan spasi ganda dan
    // spasi sebelum tanda baca.
    text = text
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .replace(/ {2,}/g, " ")
      .replace(/ +([!?.,;:])/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return text;
  }

  function waLink(phone, message) {
    const text = encodeURIComponent(message);
    if (phone) return `https://wa.me/${phone}?text=${text}`;
    return `https://api.whatsapp.com/send?text=${text}`;
  }

  // ---------- Render ----------
  function renderPreview() {
    const guest = getGuest(state.previewGuestId);
    const message = buildMessage(guest);
    const phone = guest ? phoneDigits(guest.phone) : "";
    const link = waLink(phone, message);

    $("#preview-name").textContent = guest ? guest.name || "Tanpa nama" : "Contoh tamu";
    $("#preview-meta").textContent = guest ? `Sapaan: ${guest.greeting || "—"} · ${phone ? "+" + phone : "tanpa nomor"}` : "Belum ada tamu — isi dulu atau lihat contoh";
    $("#preview-bubble").innerHTML = formatWhatsApp(message);

    const now = new Date();
    $("#preview-time").textContent =
      String(now.getHours()).padStart(2, "0") + "." + String(now.getMinutes()).padStart(2, "0");

    $("#out-link").value = link;
    $("#out-message").value = message;

    const previewEmpty = $("#preview-empty");
    if (previewEmpty) previewEmpty.hidden = !!message;
  }

  // Konversi markdown WhatsApp (*bold*, _italic_, ~coret~, `mono`) ke HTML untuk preview.
  function formatWhatsApp(text) {
    const safe = esc(text);
    return safe
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/~([^~]+)~/g, "<del>$1</del>")
      .replace(/\n/g, "<br>");
  }

  function renderGuests() {
    const list = $("#guest-list");
    const empty = $("#guest-empty");
    const select = $("#preview-guest");
    const current = state.previewGuestId;

    if (!state.guests.length) {
      list.innerHTML = "";
      if (empty) empty.hidden = false;
      select.innerHTML = '<option value="">— Belum ada tamu —</option>';
      return;
    }
    if (empty) empty.hidden = true;

    select.innerHTML = state.guests
      .map((g) => `<option value="${g.id}">${esc(g.name || "Tanpa nama")}</option>`)
      .join("");
    select.value = current || state.guests[0].id;

    list.innerHTML = state.guests
      .map(
        (g) => `
      <li class="guest-item${current === g.id ? " selected" : ""}" data-id="${g.id}">
        <span class="guest-check" aria-hidden="true">✓</span>
        <div class="guest-info">
          <div class="guest-name">${esc(g.name || "Tanpa nama")}</div>
          <div class="guest-sub">${esc(g.greeting || "—")}${g.phone ? " · +" + esc(phoneDigits(g.phone)) : ""}</div>
        </div>
        <div class="guest-actions">
          <button class="icon-btn" data-action="edit" title="Edit">✎</button>
          <button class="icon-btn danger" data-action="delete" title="Hapus">✕</button>
        </div>
      </li>`
      )
      .join("");
  }

  function renderEventType() {
    const wrap = $("#event-type");
    wrap.innerHTML = CONFIG.eventTypes
      .map(
        (t) => `
      <button type="button" class="seg-btn${state.eventType === t.id ? " active" : ""}" data-type="${t.id}">
        ${esc(t.label)}
      </button>`
      )
      .join("");
  }

  function renderLabels() {
    const type = currentType();
    const label = type.ceremonyLabel;
    const dateLbl = $("#lbl-akad-date");
    const timeLbl = $("#lbl-akad-time");
    if (dateLbl) dateLbl.textContent = "Tanggal " + label;
    if (timeLbl) timeLbl.textContent = "Jam " + label;

    // Sembunyikan kolom resepsi untuk jenis acara yang tidak memakainya (mis. Kristen).
    const hideResepsi = !!type.hideResepsi;
    ["#resepsi-date-field", "#resepsi-time-field"].forEach((sel) => {
      const el = $(sel);
      if (el) el.hidden = hideResepsi;
    });
  }

  function renderTemplateButtons() {
    const wrap = $("#template-options");
    const all = [
      { id: "ai", name: "✨ AI", description: "Buat otomatis dengan Gemini" },
      ...currentType().templates,
      { id: "custom", name: "Kustom", description: "Template buatan sendiri" },
    ];
    wrap.innerHTML = all
      .map(
        (t) => `
      <button type="button" class="tpl-chip${state.templateId === t.id ? " active" : ""}" data-tpl="${t.id}">
        <span class="tpl-name">${esc(t.name)}</span>
        <span class="tpl-desc">${esc(t.description)}</span>
      </button>`
      )
      .join("");

    const editor = $("#template-editor");
    const editorNote = $("#template-editor-note");
    const aiPanel = $("#ai-panel");

    const isCustom = state.templateId === "custom";
    const isAI = state.templateId === "ai";

    editor.hidden = !isCustom;
    if (editorNote) editorNote.hidden = !isCustom;
    if (isCustom) editor.value = state.customText;

    if (aiPanel) {
      aiPanel.hidden = !isAI;
      if (isAI) {
        $("#ai-prompt").value = state.aiPrompt;
        $("#ai-result").value = state.aiText;
      }
    }
  }

  function renderPlaceholders() {
    const wrap = $("#placeholder-list");
    wrap.innerHTML = CONFIG.placeholders
      .map(
        (p) => `
      <button type="button" class="ph-chip" data-ph="${esc(p.key)}" title="${esc(p.desc)}">
        <code>${esc(p.key)}</code><span>${esc(p.label)}</span>
      </button>`
      )
      .join("");
  }

  function updateBulk() {
    const count = state.guests.length;
    $("#guest-count").textContent = count ? `${count} tamu` : "belum ada tamu";
    $("#bulk-actions").hidden = count === 0;
  }

  function syncFormToState() {
    const e = state.event;
    e.bride = $("#f-bride").value;
    e.groom = $("#f-groom").value;
    e.akadDate = $("#f-akad-date").value;
    e.akadTime = $("#f-akad-time").value;
    e.resepsiDate = $("#f-resepsi-date").value;
    e.resepsiTime = $("#f-resepsi-time").value;
    e.location = $("#f-location").value;
    e.maps = $("#f-maps").value;
    e.link = $("#f-link").value;
  }

  function syncFormFromState() {
    const e = state.event;
    $("#f-bride").value = e.bride;
    $("#f-groom").value = e.groom;
    $("#f-akad-date").value = e.akadDate;
    $("#f-akad-time").value = e.akadTime;
    $("#f-resepsi-date").value = e.resepsiDate;
    $("#f-resepsi-time").value = e.resepsiTime;
    $("#f-location").value = e.location;
    $("#f-maps").value = e.maps;
    $("#f-link").value = e.link;
  }

  function renderAll() {
    syncFormFromState();
    renderEventType();
    renderLabels();
    renderTemplateButtons();
    renderPlaceholders();
    renderGuests();
    renderPreview();
    updateBulk();
  }

  // ---------- Mode AI ----------
  async function generateWithAI() {
    const type = currentType();
    const system = [
      "Anda menulis template pesan undangan WhatsApp dalam bahasa Indonesia.",
      "Jenis acara: " + type.label + " (" + type.ceremonyLabel + ").",
      "",
      "HANYA gunakan placeholder berikut (dari Data Acara & Daftar Tamu), jangan buat placeholder lain:",
      "Data acara: {pengantin} = nama lengkap pasangan, {panggilan} = nama depan/panggilan, {acara}, {resepsi}, {lokasi}, {maps}, {link}.",
      "Daftar tamu: {s} = sapaan (Bapak/Ibu/Saudara/i), {nama} = nama lengkap tamu, {nama_url} = nama tamu untuk URL.",
      "Untuk link undangan, gunakan \"{link}?to={nama_url}\".",
      "",
      "Aturan agar pesan tidak berulang:",
      "- Sapaan & nama tamu cukup disebut SEKALI di awal, jangan diulang di tengah/akhir.",
      "- Nama pengantin pilih salah satu: {pengantin} ATAU {panggilan}, jangan keduanya.",
      "- Jangan mengulang tanggal, lokasi, atau link lebih dari satu kali.",
      "",
      "Selain itu, silakan berkreasi dengan gaya bahasa, sapaan, emoji, dan struktur pesan.",
      "Format WhatsApp: *teks* untuk huruf tebal. Jangan gunakan markdown lain.",
      "Pisahkan antar bagian dengan satu baris kosong agar mudah dibaca.",
      "Keluarkan HANYA teks pesan, tanpa pembuka atau penjelasan.",
    ].join("\n");

    const user = state.aiPrompt.trim() ||
      "Buat template pesan undangan pernikahan yang sopan dan hangat.";

    const btn = $("#ai-generate");
    const statusEl = $("#ai-status");
    btn.disabled = true;
    statusEl.textContent = "Sedang membuat pesan…";

    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: system + "\n\n" + user }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || "HTTP " + resp.status);
      }

      const text = (json.text || "").trim();
      if (!text) throw new Error("Respons AI kosong.");

      state.aiText = text;
      save();
      $("#ai-result").value = text;
      renderPreview();
      statusEl.textContent = "Berhasil. Silakan edit bila perlu.";
      toast("Template AI dibuat ✓");
    } catch (e) {
      statusEl.textContent = "Gagal: " + (e.message || e);
      toast("Gagal memanggil Gemini");
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- Aksi bulk ----------
  function copyText(text, label) {
    const done = () => toast(label + " disalin ✓");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
      toast("Gagal menyalin");
    }
    document.body.removeChild(ta);
  }

  function copyAll() {
    const lines = state.guests.map((g) => {
      const msg = buildMessage(g);
      const link = waLink(phoneDigits(g.phone), msg);
      return `— ${g.name || "Tanpa nama"} —\n${msg}\n${link}`;
    });
    copyText(lines.join("\n\n"), "Semua pesan");
  }

  function exportCSV() {
    const header = ["Nama", "Sapaan", "Nomor", "Pesan", "Link"];
    const rows = state.guests.map((g) => {
      const msg = buildMessage(g);
      const link = waLink(phoneDigits(g.phone), msg);
      return [g.name, g.greeting, g.phone, msg, link];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((c) => '"' + String(c ?? "").replace(/"/g, '""') + '"').join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pesan-undangan.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV diunduh ✓");
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // ---------- Event binding ----------
  function bindEvents() {
    // Form data acara
    $$("#event-form input").forEach((inp) => {
      inp.addEventListener("input", () => {
        syncFormToState();
        save();
        renderPreview();
      });
    });

    // Pilih jenis acara
    $("#event-type").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-type]");
      if (!btn) return;
      if (state.eventType === btn.dataset.type) return;
      state.eventType = btn.dataset.type;
      state.templateId = "formal";
      save();
      renderEventType();
      renderLabels();
      renderTemplateButtons();
      renderPreview();
    });

    // Pilih template
    $("#template-options").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-tpl]");
      if (!btn) return;
      state.templateId = btn.dataset.tpl;
      save();
      renderTemplateButtons();
      renderPreview();
    });

    // Editor template kustom
    $("#template-editor").addEventListener("input", (ev) => {
      state.customText = ev.target.value;
      save();
      renderPreview();
    });

    // Mode AI
    $("#ai-prompt").addEventListener("input", (ev) => {
      state.aiPrompt = ev.target.value;
      save();
    });
    $("#ai-result").addEventListener("input", (ev) => {
      state.aiText = ev.target.value;
      save();
      renderPreview();
    });
    $("#ai-generate").addEventListener("click", generateWithAI);

    // Klik placeholder -> sisipkan ke editor kustom
    $("#placeholder-list").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-ph]");
      if (!btn) return;
      const isAI = state.templateId === "ai";
      if (state.templateId !== "custom" && !isAI) {
        // Pindah ke mode kustom dengan teks template aktif.
        state.customText = currentTemplateText();
        state.templateId = "custom";
        renderTemplateButtons();
      }
      const editor = isAI ? $("#ai-result") : $("#template-editor");
      editor.focus();
      const ph = btn.dataset.ph;
      const start = editor.selectionStart ?? editor.value.length;
      const end = editor.selectionEnd ?? editor.value.length;
      editor.value = editor.value.slice(0, start) + ph + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = start + ph.length;
      if (isAI) state.aiText = editor.value;
      else state.customText = editor.value;
      save();
      renderPreview();
    });

    // Tambah tamu
    $("#guest-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const name = $("#g-name").value;
      if (!name.trim()) {
        toast("Nama tamu wajib diisi");
        return;
      }
      addGuest({
        name,
        greeting: $("#g-greeting").value,
        phone: $("#g-phone").value,
      });
      $("#g-name").value = "";
      $("#g-phone").value = "";
      $("#g-name").focus();
    });

    // Aksi per tamu (edit/hapus) & pilih preview
    $("#guest-list").addEventListener("click", (ev) => {
      const item = ev.target.closest(".guest-item");
      if (!item) return;
      const id = item.dataset.id;
      const action = ev.target.closest("[data-action]")?.dataset.action;
      if (action === "delete") {
        removeGuest(id);
      } else if (action === "edit") {
        openEdit(id);
      } else {
        state.previewGuestId = id;
        save();
        renderPreview();
        renderGuests();
      }
    });

    $("#preview-guest").addEventListener("change", (ev) => {
      state.previewGuestId = ev.target.value || null;
      save();
      renderGuests();
      renderPreview();
    });

    // Output actions
    $("#copy-message").addEventListener("click", () => copyText($("#out-message").value, "Pesan"));
    $("#copy-link").addEventListener("click", () => copyText($("#out-link").value, "Link"));
    $("#send-wa").addEventListener("click", () => {
      window.open($("#out-link").value, "_blank", "noopener");
    });
    $("#copy-all").addEventListener("click", copyAll);
    $("#export-csv").addEventListener("click", exportCSV);
    $("#reset").addEventListener("click", () => {
      if (!confirm("Hapus semua data tersimpan dan mulai dari awal?")) return;
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }

  // ---------- Modal edit tamu ----------
  function openEdit(id) {
    const g = getGuest(id);
    if (!g) return;
    $("#edit-name").value = g.name;
    $("#edit-greeting").value = g.greeting;
    $("#edit-phone").value = g.phone;
    $("#edit-modal").dataset.id = id;
    $("#edit-modal").showModal();
  }

  function bindEditModal() {
    $("#edit-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const id = $("#edit-modal").dataset.id;
      updateGuest(id, {
        name: $("#edit-name").value,
        greeting: $("#edit-greeting").value,
        phone: $("#edit-phone").value,
      });
      $("#edit-modal").close();
    });
    $("#edit-cancel").addEventListener("click", () => $("#edit-modal").close());
  }

  // ---------- Init ----------
  function init() {
    load();
    bindEvents();
    bindEditModal();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
