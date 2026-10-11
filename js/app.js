/* ═══════════════════════════════════════════════════════════════════════
   ВЕРНИСАЖ — поведение главной: каталог из data.js (правится в
   panel.html), фильтр и поиск, строки предложений, цифры первого экрана,
   появление при прокрутке, подгонка огромного слова в подвале.

   Раздел, добавленный в панели, появляется на сайте сам: кнопки фильтра
   и списки строятся из CATEGORIES, строки — из OFFERS.
   Скульптура первого экрана — отдельный модуль js/hero3d.js.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Каталог объявлен глобальными const (data.php или data.js), а const мимо
     window не переприсвоить — работаем с локальными копиями. На адресе
     index.html?draft=1 подставляется черновик из панели («Предпросмотр»). */
  var site   = typeof SITE       !== 'undefined' ? SITE       : {};
  var cats   = typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];
  var offers = typeof OFFERS     !== 'undefined' ? OFFERS     : [];
  if (/[?&]draft/.test(location.search)) {
    try {
      var draftFile = localStorage.getItem('vernissage_admin_draft:file');
      if (draftFile) {
        var d = new Function(draftFile + '\n;return { SITE: SITE, CATEGORIES: CATEGORIES, OFFERS: OFFERS };')();
        site = d.SITE || site; cats = d.CATEGORIES || cats; offers = d.OFFERS || offers;
      }
    } catch (e) { /* битый черновик — показываем боевой каталог */ }
  }
  offers = offers.filter(function (o) { return o && !o.hidden; });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; }
  function offersWord(n) { return plural(n, 'предложение', 'предложения', 'предложений'); }
  function okLink(u) { return /^https?:\/\//i.test(u || ''); }
  function erid(u) { var m = /[?&]erid=([^&#]+)/i.exec(u || ''); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return m[1]; } }
  var OUT = '<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-out"/></svg>';
  var CHECK = '<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>';

  /* ── тексты сайта из панели ───────────────────────────────────────── */
  var brand = String(site.brand == null ? '' : site.brand).trim() || 'Вернисаж';
  var latin = /^[\x20-\x7E]+$/.test(brand);
  $$('[data-brand]').forEach(function (n) { n.textContent = brand; if (latin) n.setAttribute('lang', 'en'); else n.removeAttribute('lang'); });
  $$('[data-brand-text]').forEach(function (n) { n.textContent = brand; });
  $$('[data-brand-q]').forEach(function (n) { n.textContent = '«' + brand + '»'; });

  /* Телеграм для связи — ник или ссылка t.me; кривое значение не печатаем */
  var tg = String(site.telegram || '').trim(), tgNick = '';
  var tm = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{4,32})\/?$/i.exec(tg) || /^@?([A-Za-z0-9_]{4,32})$/.exec(tg);
  if (tm) tgNick = tm[1];
  ['#hdr-tg', '#ftr-tg'].forEach(function (s) {
    var a = $(s);
    if (!a || !tgNick) return;
    a.href = 'https://t.me/' + tgNick;
    a.innerHTML = '@' + esc(tgNick) + '<span class="vh"> — Telegram (откроется в новой вкладке)</span>';
    a.hidden = false;
  });

  var byCat = {};
  cats.forEach(function (c) { byCat[c.id] = offers.filter(function (o) { return o.cat === c.id; }); });
  var nonEmpty = cats.filter(function (c) { return byCat[c.id].length; });
  var live = offers.filter(function (o) { return byCat[o.cat]; });
  var firms = {};
  live.forEach(function (o) { firms[String(o.partner || '').trim().toLowerCase()] = 1; });
  var nFirms = Object.keys(firms).length;

  document.title = 'Займы и карты онлайн — ' + live.length + ' ' + offersWord(live.length) + ' банков и МФО | ' + brand;

  /* ── первый экран: курсивная строка и большой блок «01–24 / МФО / 2026» ── */
  var tagline = $('#tagline');
  if (tagline) {
    var tl = String(site.tagline || '').trim();
    if (tl) tagline.textContent = tl;
    else tagline.innerHTML = '<span class="ln">' + live.length + ' ' + offersWord(live.length) + '</span> <span class="ln">банков и МФО</span>';
  }
  /* главный раздел — займы, если они есть; иначе первый непустой */
  var SHORT = { mfo: 'МФО', credit: 'Карт', debit: 'Карт' };
  var main = byCat.mfo && byCat.mfo.length ? cats.filter(function (c) { return c.id === 'mfo'; })[0] : nonEmpty[0];
  if (main) {
    var n = byCat[main.id].length;
    /* у своего раздела из панели длинное название в огромный кегль не влезет */
    var word = SHORT[main.id] || 'Шт';
    $('#big-range').textContent = '01–' + String(n).padStart(2, '0');
    $('#big-word').textContent = word;
    $('#big-text').textContent = main.id === 'mfo'
      ? 'В подборке ' + n + ' ' + plural(n, 'займ', 'займа', 'займов') + ' от МФО'
      : 'В разделе «' + main.label + '» ' + n + ' ' + offersWord(n);
  }
  var yr = String(new Date().getFullYear());
  $('#big-year').textContent = yr;
  var year = $('#year'); if (year) year.textContent = yr;

  var stats = $('#stats');
  if (stats) {
    stats.innerHTML =
      '<li><b>' + live.length + '</b> <span>' + offersWord(live.length) + '</span></li>' +
      '<li><b>' + nFirms + '</b> <span>' + plural(nFirms, 'компания', 'компании', 'компаний') + '</span></li>' +
      '<li><b>' + nonEmpty.length + '</b> <span>' + plural(nonEmpty.length, 'раздел', 'раздела', 'разделов') + '</span></li>';
  }

  /* разделов, которых нет в каталоге, в меню и подвале быть не должно */
  $$('a[href^="#cat-"]').forEach(function (a) {
    var id = a.getAttribute('href').slice(5);
    if (!byCat[id] || !byCat[id].length) (a.closest('li') || a).hidden = true;
  });

  /* ── поиск: синонимы, которые люди реально набирают ───────────────── */
  var ALIASES = {
    'т-банк': 'тинькофф тинькоф tinkoff tbank т банк тбанк', 'т-мобайл': 'тинькофф tinkoff mobile т мобайл тмобайл симка',
    'альфа-банк': 'alfa альфабанк', 'ozon банк': 'озон озонбанк', 'втб': 'vtb', 'сбербанк': 'сбер sber sberbank',
    'совкомбанк': 'совком sovcombank халва', 'отп банк': 'otp', 'псб': 'промсвязьбанк psb', 'ак барс банк': 'акбарс ak bars',
    'уралсиб': 'uralsib', 'убрир': 'ubrir уральский', 'фора-банк': 'фора fora', 'банк зенит': 'зенит zenit',
    'кредит европа банк': 'credit europe кредитевропа', 'займер': 'zaymer zaimer', 'moneyman': 'манимен мани мэн манимэн money man',
    'а деньги': 'аденьги adengi а-деньги', 'max.credit': 'макс кредит maxcredit макскредит', 'умные наличные': 'smartcash смарткэш',
    'свои люди': 'svoi ludi', 'joymoney': 'джоймани джой мани joy money', 'мигкредит': 'migcredit миг кредит', 'platiza': 'платиза',
    'лайм-займ': 'lime лайм limezaim', 'webbankir': 'веббанкир вэббанкир вебанкир', 'до зарплаты': 'dozarplati',
    'деньги сразу': 'dengisrazu', 'деньги на дом': 'denginadom', 'rocketman': 'рокетмэн рокетмен', 'быстроденьги': 'bistrodengi быстро деньги',
    'смс финанс': 'sms finance smsfinance', 'срочно деньги': 'srochnodengi', 'zaymigo': 'займиго', 'турбозайм': 'turbozaim турбо',
    'oneclickmoney': 'ванкликмани ван клик мани one click', 'надо денег': 'nadodeneg', 'центрофинанс': 'centrofinans центро',
    'привет, сосед': 'привет сосед privet sosed'
  };
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim(); }
  live.forEach(function (o) {
    o._hay = ' ' + norm([o.partner, o.title, o.tag, o.headline, ALIASES[String(o.partner || '').toLowerCase()] || ''].join(' ')) + ' ';
  });
  function matches(o, q) { return !q || q.split(' ').every(function (w) { return o._hay.indexOf(w) !== -1; }); }

  /* ── логотип банка: квадратная плитка с рамкой 1 px ───────────────────
     Название стоит рядом текстом — картинке подпись не нужна (alt="").
     Векторный знак без фона (svg) — с полями; растровая иконка — во всю
     плитку. Логотипа нет — чёрная плитка с первой буквой названия. */
  function logo(o) {
    var src = String(o.logo || '').trim();
    var safe = /^(\.?\/?img\/|https:\/\/|data:image\/(png|jpe?g|webp|gif|svg\+xml);)/i.test(src);
    if (src && safe) {
      /* svg-знак без фона — на белом с полями; «-badge.svg» — готовый значок во весь круг */
      var mark = (/\.svg(\?|#|$)/i.test(src) && !/-badge\.svg/i.test(src)) || /^data:image\/svg/i.test(src);
      return '<span class="row__logo' + (mark ? ' is-mark' : '') + '" data-ch="' + esc(initial(o)) + '"><img src="' + esc(src) + '" alt="" width="64" height="64" loading="lazy" decoding="async"></span>';
    }
    return '<span class="row__logo is-mono" aria-hidden="true">' + esc(initial(o)) + '</span>';
  }
  function initial(o) { return String(o.partner || o.title || '?').trim().charAt(0).toUpperCase(); }
  /* файл логотипа не нашёлся (опечатка в панели) — вместо пустой рамки буква */
  document.addEventListener('error', function (e) {
    var img = e.target, box = img && img.parentNode;
    if (!img || img.tagName !== 'IMG' || !box || !box.classList || !box.classList.contains('row__logo')) return;
    box.className = 'row__logo is-mono'; box.setAttribute('aria-hidden', 'true'); box.textContent = box.getAttribute('data-ch') || '?';
  }, true);

  /* ── строка предложения ───────────────────────────────────────────── */
  function cap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function row(o, c, i) {
    var cta = c.cta || 'Оформить';
    var ad = erid(o.url);
    /* имя ссылки: видимые слова первыми (голосовое управление), дальше —
       продукт и банк: у одного банка бывает несколько предложений */
    var name = esc(o.title) + (o.partner ? ', ' + esc(o.partner) : '');
    var act = okLink(o.url)
      ? '<a class="cta" href="' + esc(o.url) + '" target="_blank" rel="sponsored noopener">' + esc(cta) + '<span class="vh"> — ' + name + ' (откроется в новой вкладке)</span>' + OUT + '</a>'
      : '<p class="row__soon">Ссылка скоро</p>';
    var specs = (o.specs || []).filter(function (p) { return p && (p[0] || p[1]); });
    return '<li class="row' + (okLink(o.url) ? ' has-link' : '') + '" id="ofr-' + esc(c.id) + '-' + i + '">' +
      '<span class="row__n" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' +
      logo(o) +
      /* продукт — внутри заголовка: у одного банка бывает по три предложения,
         и в списке заголовков «Т-Банк, Т-Банк, Т-Банк» ничего бы не значило */
      '<div class="row__name"><h4><span class="row__partner">' + esc(o.partner || o.title) + '</span>' + (o.partner && o.title ? ' <span class="row__title">' + esc(o.title) + '</span>' : '') + '</h4></div>' +
      '<div class="row__info">' +
        /* крупная строка, повторяющая название продукта, — лишний шум */
        (o.headline && norm(o.headline) !== norm(o.title) ? '<p class="row__head">' + esc(o.headline) + '</p>' : '') +
        (o.note ? '<p class="row__note">' + esc(cap(o.note)) + '.</p>' : '') +
        (specs.length ? '<dl class="specs">' + specs.map(function (p) { return '<div><dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      '</div>' +
      '<img class="row__chip" src="img/sculpt/chip.webp" alt="" width="320" height="199" loading="lazy" decoding="async">' +
      '<div class="row__act"><p class="ad">Реклама' + (ad ? ' · erid ' + esc(ad) : '') + '</p>' + act + '</div>' +
    '</li>';
  }

  /* ── каталог: фильтр + поиск ──────────────────────────────────────── */
  var filtersBox = $('#filters'), sectionsBox = $('#sections'), input = $('#q'), clearBtn = $('#q-clear');
  var empty = $('#empty'), emptyText = $('#empty-text'), countSt = $('#count-status');
  var active = 'all', query = '', countT = 0;

  function cnt(k) { return '<span class="fbtn__n">' + k + '<span class="vh"> ' + offersWord(k) + '</span></span>'; }
  function hitWord(k) { return plural(k, 'совпадение', 'совпадения', 'совпадений'); }

  if (filtersBox && sectionsBox) {
    filtersBox.innerHTML = '<button class="fbtn" type="button" data-f="all" data-name="Все разделы" aria-pressed="true">' + CHECK + 'Все ' + cnt(live.length) + '</button>' +
      nonEmpty.map(function (c) {
        return '<button class="fbtn" type="button" data-f="' + esc(c.id) + '" data-name="' + esc(c.label) + '" aria-pressed="false">' + CHECK + esc(c.label) + ' ' + cnt(byCat[c.id].length) + '</button>';
      }).join('');
    sectionsBox.innerHTML = nonEmpty.map(function (c) {
      return '<section class="cat" id="cat-' + esc(c.id) + '" data-cat="' + esc(c.id) + '">' +
        '<div class="cat__head"><h3 id="h-' + esc(c.id) + '">' + esc(c.label) + '</h3><span class="cat__n">' + byCat[c.id].length + '<span> ' + offersWord(byCat[c.id].length) + '</span></span></div>' +
        '<ol class="rows" role="list">' + byCat[c.id].map(function (o, i) { return row(o, c, i); }).join('') + '</ol></section>';
    }).join('') || '<p class="state">Предложений пока нет — загляните позже.</p>';
    nonEmpty.forEach(function (c) {
      $$('#cat-' + c.id + ' .row').forEach(function (el, i) { el._o = byCat[c.id][i]; });
    });
  }

  function found(id) { return (byCat[id] || []).filter(function (o) { return matches(o, query); }).length; }
  function apply() {
    var shown = 0;
    $$('.fbtn', filtersBox).forEach(function (b) {
      var f = b.getAttribute('data-f');
      b.setAttribute('aria-pressed', String(f === active));
      var k = f === 'all' ? nonEmpty.reduce(function (s, c) { return s + (query ? found(c.id) : byCat[c.id].length); }, 0)
                          : (query ? found(f) : byCat[f].length);
      var box = b.lastElementChild;
      box.firstChild.nodeValue = String(k);
      box.lastElementChild.textContent = ' ' + (query ? hitWord(k) : offersWord(k));
    });
    $$('.cat', sectionsBox).forEach(function (s) {
      var on = active === 'all' || s.getAttribute('data-cat') === active, k = 0;
      $$('.row', s).forEach(function (el) { var m = on && matches(el._o, query); el.hidden = !m; if (m) k++; });
      s.hidden = !on || !k;
      var head = s.querySelector('.cat__n');
      if (head) { head.firstChild.nodeValue = String(query ? k : byCat[s.getAttribute('data-cat')].length); head.lastElementChild.textContent = ' ' + (query ? hitWord(k) : offersWord(k)); }
      shown += k;
    });
    if (empty) {
      empty.hidden = !!shown;
      if (!shown) {
        var label = active === 'all' ? 'во всех разделах' : 'в разделе «' + $('.fbtn[data-f="' + active + '"]', filtersBox).getAttribute('data-name') + '»';
        var elsewhere = active !== 'all' && nonEmpty.some(function (c) { return found(c.id); });
        emptyText.textContent = query
          ? 'По запросу «' + input.value.trim() + '» ' + label + ' ничего нет.' + (elsewhere ? ' Есть совпадения в других разделах — нажмите «Все» в фильтре.' : '')
          : 'В этом разделе пока нет предложений.';
      }
    }
    if (clearBtn) clearBtn.hidden = !input.value;
    return shown;
  }
  function status(text, now) {
    clearTimeout(countT);
    if (now) { countSt.textContent = ''; countT = setTimeout(function () { countSt.textContent = text(); }, 120); }
    else countT = setTimeout(function () { countSt.textContent = text(); }, 600);
  }
  function statusText() {
    var shown = $$('.row:not([hidden])', sectionsBox).length;
    var name = ($('.fbtn[data-f="' + active + '"]', filtersBox) || { getAttribute: function () { return ''; } }).getAttribute('data-name');
    var where = active === 'all' ? 'во всех разделах' : 'в разделе «' + name + '»';
    var t = (query ? 'Найдено ' : 'Показано ') + where + ': ' + shown + ' ' + offersWord(shown);
    /* подсказку из пустого состояния дублируем в живую область — иначе её не услышать */
    if (!shown && query) {
      t += active !== 'all' && nonEmpty.some(function (c) { return found(c.id); })
        ? '. Есть совпадения в других разделах — нажмите «Все» в фильтре.'
        : '. Сбросить поиск — кнопка ниже.';
    }
    return t;
  }
  function setFilter(f, announce) {
    active = f; apply();
    if (announce) status(statusText, true);
    else { clearTimeout(countT); countSt.textContent = ''; }   /* старый текст статуса врал бы о том, что показано */
  }

  /* переход к разделу из меню, подвала и первого экрана — всегда одинаковый:
     показываем все разделы, прокручиваем и ставим фокус на заголовок раздела */
  function goToCat(f) {
    var sec = document.getElementById('cat-' + f), h = sec && sec.querySelector('h3');
    if (!h) return false;
    var hadQuery = !!query;
    if (hadQuery) { input.value = ''; query = ''; }
    /* setFilter чистит и живую область, и отложенное объявление старого поиска */
    if (hadQuery || sec.hidden || active !== 'all') setFilter('all', false); else apply();
    sec.scrollIntoView({ block: 'start', behavior: reduceMq.matches ? 'auto' : 'smooth' });
    h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
    h.addEventListener('blur', function () { h.removeAttribute('tabindex'); }, { once: true });
    try { history.replaceState(null, '', '#cat-' + f); } catch (e) { /* file:// */ }
    return true;
  }

  document.addEventListener('click', function (e) {
    var fb = e.target.closest('.fbtn');
    if (fb) { setFilter(fb.getAttribute('data-f'), true); return; }
    /* мышью можно нажать по названию или условиям — сработает кнопка строки.
       Клавиатура ходит только по самой кнопке; выделение текста не уводит на сайт партнёра */
    var r = e.target.closest('.row.has-link .row__name, .row.has-link .row__info, .row.has-link .row__logo');
    if (r && !e.target.closest('a, button, input, label, summary') && !String(window.getSelection ? getSelection() : '')) {
      var go = r.closest('.row').querySelector('.cta'); if (go) go.click(); return;
    }
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var m = /^#cat-(.+)$/.exec(a.getAttribute('href'));
    if (m) { if (goToCat(m[1])) e.preventDefault(); return; }
    if (a.getAttribute('href') === '#catalog' && (active !== 'all' || query)) { input.value = ''; query = ''; setFilter('all', true); }
  });

  if (input) {
    input.addEventListener('input', function () { query = norm(input.value); apply(); status(statusText, false); });
    $('#find-form').addEventListener('submit', function (e) { e.preventDefault(); status(statusText, true); });
    /* крестик чистит только поиск, выбранный раздел остаётся */
    clearBtn.addEventListener('click', function () { input.value = ''; query = ''; apply(); status(statusText, true); input.focus(); });
    $('#reset').addEventListener('click', function () { input.value = ''; query = ''; setFilter('all', true); input.focus(); });
  }

  /* ── шапка: линия при прокрутке и реальная высота ─────────────────── */
  var hdr = $('#hdr');
  var onScroll = function () { hdr.classList.toggle('is-stuck', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var measure = function () { document.documentElement.style.setProperty('--hdr', hdr.offsetHeight + 'px'); };
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(hdr);
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ссылка меню, получившая фокус, не прячется за край прокручиваемой строки */
  var navBox = $('.hdr__nav');
  if (navBox) navBox.addEventListener('focusin', function (e) {
    if (navBox.scrollWidth <= navBox.clientWidth) return;
    var r = e.target.getBoundingClientRect(), b = navBox.getBoundingClientRect(), pad = 28;
    if (r.left < b.left + pad) navBox.scrollLeft -= b.left + pad - r.left;
    else if (r.right > b.right - pad) navBox.scrollLeft += r.right - b.right + pad;
  });

  /* ── гигантское слово в подвале: ровно на ширину колонки ──────────── */
  var word = $('#ftr-word'), wordSpan = word && word.querySelector('span');
  function fitWord() {
    if (!word) return;
    word.style.setProperty('--fw', '100px');
    var w = wordSpan.scrollWidth, box = word.clientWidth;
    if (w > 0 && box > 0) word.style.setProperty('--fw', (100 * box / w).toFixed(2) + 'px');
  }
  fitWord();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWord);
  if ('ResizeObserver' in window && word) new ResizeObserver(fitWord).observe(word);

  /* ── появление при прокрутке ──────────────────────────────────────── */
  if ('IntersectionObserver' in window && !reduceMq.matches) {
    var rv = $$('.rv');
    var show = function (el) { el.classList.add('is-in'); };
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { show(x.target); io.unobserve(x.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
    document.documentElement.classList.add('io');
    /* фокус, поиск по странице и печать не должны упираться в невидимый текст */
    document.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('.rv'); if (el) show(el); });
    window.addEventListener('beforeprint', function () { rv.forEach(show); });
    window.addEventListener('hashchange', function () { rv.forEach(show); });
  }

  /* пришли по ссылке на раздел (#cat-mfo) — показываем его */
  var hm = /^#cat-(.+)$/.exec(location.hash);
  if (hm && byCat[hm[1]]) setTimeout(function () { goToCat(hm[1]); }, 0);
})();
