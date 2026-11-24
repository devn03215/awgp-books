/**
 * In-browser OCR review: load volunteer zip, edit one page at a time, submit ocr-corrected.txt.
 */
(function () {
  function t(key, fallback) {
    return (window.AWGP_BOOKS_t || function (k, f) { return f != null ? f : k; })(key, fallback);
  }

  function withLang(href) {
    return (window.AWGP_BOOKS_withLang || function (h) { return h; })(href, window.AWGP_BOOKS_LANG);
  }

  function readBookId() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = (params.get('id') || '').trim();
    if (fromQuery) return fromQuery;
    var hash = (window.location.hash || '').replace(/^#/, '');
    if (hash.indexOf('id=') === 0) return decodeURIComponent(hash.slice(3)).trim();
    if (/^[0-9a-f-]{36}$/i.test(hash)) return hash;
    return '';
  }

  var bookId = readBookId();
  var config = null;
  var book = null;
  var zip = null;
  var pages = [];
  var current = 0;
  var blobUrls = {};
  var saveTimer = 0;
  var dirty = false;

  var els = {
    title: document.getElementById('book-title'),
    back: document.getElementById('back-link'),
    stage: document.getElementById('stage'),
    loadMsg: document.getElementById('load-msg'),
    progress: document.getElementById('progress-fill'),
    workspace: document.getElementById('workspace'),
    img: document.getElementById('page-img'),
    noImage: document.getElementById('no-image'),
    text: document.getElementById('page-text'),
    pageLabel: document.getElementById('page-label'),
    prev: document.getElementById('prev-btn'),
    next: document.getElementById('next-btn'),
    name: document.getElementById('volunteer-name'),
    submit: document.getElementById('submit-btn'),
    status: document.getElementById('save-status')
  };

  els.back.setAttribute('href', withLang('index.html'));

  function setStatus(msg, kind) {
    els.status.textContent = msg || '';
    els.status.className = 'status-line' + (kind ? ' ' + kind : '');
  }

  function draftKey() {
    return 'awgp-ocr-edit:' + bookId;
  }

  function persistDraft() {
    try {
      var body = {};
      pages.forEach(function (p) { body[String(p.n)] = p.text; });
      localStorage.setItem(draftKey(), JSON.stringify({ pages: body, at: Date.now() }));
      setStatus(t('edit.draftSaved'), 'ok');
    } catch (e) {
      setStatus(t('edit.draftSaveFailed'), 'error');
    }
  }

  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistDraft, 400);
  }

  function parsePages(text) {
    var re = /===== PAGE (\d+) =====/g;
    var matches = [];
    var m;
    while ((m = re.exec(text))) {
      matches.push({ n: Number(m[1]), index: m.index, end: m.index + m[0].length });
    }
    if (!matches.length) {
      return [{ n: 1, text: String(text || '').trim() }];
    }
    var out = [];
    for (var i = 0; i < matches.length; i++) {
      var start = matches[i].end;
      var end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      out.push({
        n: matches[i].n,
        text: text.slice(start, end).replace(/^\s+|\s+$/g, '')
      });
    }
    return out;
  }

  function joinPages() {
    return pages
      .map(function (p) {
        return '===== PAGE ' + p.n + ' =====\n\n' + (p.text || '') + '\n';
      })
      .join('\n');
  }

  function findZipEntry(zipFile, matcher) {
    var names = Object.keys(zipFile.files);
    for (var i = 0; i < names.length; i++) {
      var entry = zipFile.files[names[i]];
      if (entry.dir) continue;
      var path = names[i].replace(/\\/g, '/');
      if (matcher(path, path.split('/').pop() || '')) return entry;
    }
    return null;
  }

  function findDraftEntry(zipFile) {
    return (
      findZipEntry(zipFile, function (_p, base) { return base.toLowerCase() === 'ocr-corrected.txt'; }) ||
      findZipEntry(zipFile, function (_p, base) { return base.toLowerCase() === 'ocr-draft.txt'; })
    );
  }

  function pageImageEntry(pageNum) {
    var padded = String(pageNum).padStart(3, '0');
    var re = new RegExp('(?:^|/)pages/page_0*' + pageNum + '\\.(png|jpe?g|webp)$', 'i');
    var rePad = new RegExp('(?:^|/)pages/page_' + padded + '\\.(png|jpe?g|webp)$', 'i');
    return (
      findZipEntry(zip, function (path) { return rePad.test(path) || re.test(path); })
    );
  }

  function showPage(index) {
    if (!pages.length) return;
    current = Math.max(0, Math.min(index, pages.length - 1));
    var page = pages[current];
    els.text.value = page.text;
    els.pageLabel.textContent = t('edit.pageOf')
      .replace('__PAGE__', String(page.n))
      .replace('__TOTAL__', String(pages.length));
    els.prev.disabled = current === 0;
    els.next.disabled = current === pages.length - 1;
    els.img.hidden = true;
    els.noImage.hidden = true;
    els.img.removeAttribute('src');

    var entry = pageImageEntry(page.n);
    if (!entry) {
      els.noImage.hidden = false;
      return;
    }
    var cacheKey = String(page.n);
    var apply = function (url) {
      els.img.src = url;
      els.img.alt = t('edit.scanAlt').replace('__PAGE__', String(page.n));
      els.img.hidden = false;
    };
    if (blobUrls[cacheKey]) {
      apply(blobUrls[cacheKey]);
      return;
    }
    entry.async('blob').then(function (blob) {
      var url = URL.createObjectURL(blob);
      blobUrls[cacheKey] = url;
      if (pages[current] && pages[current].n === page.n) apply(url);
    }).catch(function () {
      if (pages[current] && pages[current].n === page.n) els.noImage.hidden = false;
    });
  }

  function applyPlaceholder() {
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', t(key, el.getAttribute('placeholder')));
    });
  }

  function fail(message) {
    els.stage.innerHTML = '<p class="error">' + message + '</p>';
  }

  function setProgress(frac, message) {
    els.loadMsg.textContent = message;
    els.progress.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  }

  function fetchZip(url, onProgress) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error(t('edit.zipHttpFailed').replace('__STATUS__', String(res.status)));
      var total = Number(res.headers.get('content-length') || 0);
      if (!res.body || !res.body.getReader) return res.arrayBuffer();
      var reader = res.body.getReader();
      var chunks = [];
      var received = 0;
      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            var out = new Uint8Array(received);
            var offset = 0;
            chunks.forEach(function (c) {
              out.set(c, offset);
              offset += c.length;
            });
            return out.buffer;
          }
          chunks.push(result.value);
          received += result.value.length;
          if (total) onProgress(received / total);
          return pump();
        });
      }
      return pump();
    });
  }

  function submitCorrected() {
    var name = (els.name.value || '').trim();
    if (name.length < 2) {
      setStatus(t('msg.nameShort'), 'error');
      return;
    }
    if (!config || !config.submitOcrCorrectedUrl) {
      setStatus(t('msg.uploadUrlMissing'), 'error');
      return;
    }
    pages[current].text = els.text.value;
    persistDraft();
    var blob = new Blob([joinPages()], { type: 'text/plain;charset=utf-8' });
    var file = new File([blob], 'ocr-corrected.txt', { type: 'text/plain' });
    var form = new FormData();
    form.append('book_id', bookId);
    form.append('submitted_by', name);
    form.append('file', file, 'ocr-corrected.txt');
    els.submit.disabled = true;
    setStatus(t('msg.uploading'));
    fetch(config.submitOcrCorrectedUrl, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: 'Bearer ' + config.supabaseAnonKey
      },
      body: form
    })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) throw new Error(body.error || t('msg.uploadHttpFailed').replace('__STATUS__', String(r.status)));
          return body;
        });
      })
      .then(function () {
        try { localStorage.removeItem(draftKey()); } catch (e) {}
        dirty = false;
        setStatus(t('msg.uploaded'), 'ok');
      })
      .catch(function (err) {
        setStatus(err.message || t('msg.uploadFailed'), 'error');
      })
      .finally(function () {
        els.submit.disabled = false;
      });
  }

  function bind() {
    els.prev.addEventListener('click', function () {
      pages[current].text = els.text.value;
      showPage(current - 1);
    });
    els.next.addEventListener('click', function () {
      pages[current].text = els.text.value;
      showPage(current + 1);
    });
    els.text.addEventListener('input', function () {
      pages[current].text = els.text.value;
      scheduleSave();
    });
    els.submit.addEventListener('click', submitCorrected);
    window.addEventListener('keydown', function (ev) {
      if (ev.target === els.text) return;
      if (ev.key === 'ArrowLeft') els.prev.click();
      if (ev.key === 'ArrowRight') els.next.click();
    });
    window.addEventListener('beforeunload', function (ev) {
      if (!dirty) return;
      persistDraft();
      ev.preventDefault();
      ev.returnValue = '';
    });
  }

  applyPlaceholder();
  bind();

  if (!/^[0-9a-f-]{36}$/i.test(bookId)) {
    fail(t('edit.missingBook'));
    return;
  }

  Promise.all([
    fetch('config.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(t('msg.configMissing'));
      return r.json();
    }),
    fetch('manifest.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(t('msg.manifestMissing'));
      return r.json();
    })
  ])
    .then(function (results) {
      config = results[0];
      var manifest = results[1];
      book = (manifest.books || []).find(function (b) { return b.id === bookId; });
      if (!book) throw new Error(t('edit.bookNotFound'));
      if (!book.edit_online) throw new Error(t('edit.notEnabled'));
      els.title.textContent = (book.title || '').replace(/^[A-Z]{3,7}\d{2,4}\s+/, '') || book.title;
      setProgress(0.02, t('edit.loadingPackage'));
      return fetchZip(book.download_url, function (frac) {
        setProgress(0.05 + frac * 0.7, t('edit.downloading').replace('__PCT__', String(Math.round(frac * 100))));
      });
    })
    .then(function (buf) {
      setProgress(0.8, t('edit.unpacking'));
      return JSZip.loadAsync(buf);
    })
    .then(function (loaded) {
      zip = loaded;
      var draft = findDraftEntry(zip);
      if (!draft) throw new Error(t('edit.noDraft'));
      return draft.async('string');
    })
    .then(function (text) {
      pages = parsePages(text);
      var restored = false;
      try {
        var raw = localStorage.getItem(draftKey());
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.pages) {
            pages.forEach(function (p) {
              var key = String(p.n);
              if (Object.prototype.hasOwnProperty.call(parsed.pages, key)) {
                p.text = parsed.pages[key];
                restored = true;
              }
            });
          }
        }
      } catch (e) {}
      els.stage.hidden = true;
      els.workspace.classList.add('is-open');
      showPage(0);
      if (restored) setStatus(t('edit.draftRestored'), 'ok');
      else setStatus(t('edit.ready'));
    })
    .catch(function (err) {
      fail(err.message || t('edit.loadFailed'));
    });
})();
