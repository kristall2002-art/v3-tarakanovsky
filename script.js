/* Нотариус Таракановский — оформление №3.
   Ванильный JS, без библиотек. Кинематографический скролл-риг адаптирован
   из художественной спецификации Meez «Mostar Guide»: sticky-сцена, слои с
   параллаксом на CSS-переменных, слайдер карточек, кросс-фейд текстовых панелей. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;

  /* ---------- helpers (та же математика, что в спецификации Mostar Guide) ---------- */
  function clamp(v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, v)); }
  function smoothstep(e0, e1, v) { if (e1 <= e0) return v >= e0 ? 1 : 0; var x = clamp((v - e0) / (e1 - e0)); return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(s, a, b, c, d) { var enter = smoothstep(a, b, s), exit = smoothstep(c, d, s); return enter * (1 - exit); }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- a11y: размер шрифта и контрастный режим (отключает параллакс) ---------- */
  var FS_KEY = 'nb3_fs', CT_KEY = 'nb3_contrast';
  function applyFontScale(v) { root.style.setProperty('--fs-scale', v); try { localStorage.setItem(FS_KEY, v); } catch (e) {} }
  function initA11y() {
    var saved = 1; try { saved = parseFloat(localStorage.getItem(FS_KEY)) || 1; } catch (e) {}
    applyFontScale(saved);
    $$('[data-fs]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cur = parseFloat(getComputedStyle(root).getPropertyValue('--fs-scale')) || 1;
        var next = clamp(cur + (b.getAttribute('data-fs') === 'up' ? 0.08 : -0.08), 0.85, 1.4);
        applyFontScale(next);
      });
    });
    var wantContrast = false; try { wantContrast = localStorage.getItem(CT_KEY) === '1'; } catch (e) {}
    if (wantContrast) setContrast(true);
    $$('[data-contrast]').forEach(function (b) {
      b.addEventListener('click', function () { setContrast(!document.body.classList.contains('a11y-contrast')); });
    });
  }
  function setContrast(on) {
    document.body.classList.toggle('a11y-contrast', on);
    try { localStorage.setItem(CT_KEY, on ? '1' : '0'); } catch (e) {}
    updateMotionMode();
  }
  function updateMotionMode() {
    var off = reduceMotion || document.body.classList.contains('a11y-contrast');
    root.classList.toggle('no-parallax', off);
    if (off) { stopEngine(); } else { startEngine(); }
  }

  /* ---------- header solid on scroll + mobile nav ---------- */
  function initHeader() {
    var h = $('.site-header');
    function onScroll() { if (h) h.classList.toggle('solid', window.scrollY > 30); }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    var burger = $('.burger'), mnav = $('#mnav');
    if (burger && mnav) {
      burger.addEventListener('click', function () { mnav.classList.add('open'); });
      $$('.mnav-close, .mnav-bg', mnav).forEach(function (el) { el.addEventListener('click', function () { mnav.classList.remove('open'); }); });
      $$('a', mnav).forEach(function (a) { a.addEventListener('click', function () { mnav.classList.remove('open'); }); });
    }
  }

  /* ---------- accordions: услуги и faq ---------- */
  function initAccordion(sel, itemSel, btnSel) {
    $$(sel).forEach(function (list) {
      list.addEventListener('click', function (e) {
        var btn = e.target.closest(btnSel); if (!btn) return;
        var item = btn.closest(itemSel);
        item.classList.toggle('open');
        btn.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
      });
    });
  }

  /* ---------- milestone slider ---------- */
  var mileIndex = 0, mileCount = 0, mileStep = 0, mileTrack;
  function initMileSlider() {
    mileTrack = $('.mile-track'); if (!mileTrack) return;
    var cards = $$('.mile-card', mileTrack); mileCount = cards.length;
    function measure() {
      if (!cards.length) return;
      var r0 = cards[0].getBoundingClientRect(), r1 = cards[1] ? cards[1].getBoundingClientRect() : null;
      mileStep = r1 ? (r1.left - r0.left) : (r0.width + 18);
    }
    measure(); window.addEventListener('resize', measure);
    function apply(jump) {
      mileTrack.classList.toggle('jump', !!jump);
      root.style.setProperty('--mile-shift', (-mileIndex * mileStep) + 'px');
    }
    $('.mile-prev') && $('.mile-prev').addEventListener('click', function () { mileIndex = (mileIndex - 1 + mileCount) % mileCount; apply(false); });
    $('.mile-next') && $('.mile-next').addEventListener('click', function () { mileIndex = (mileIndex + 1) % mileCount; apply(false); });
    apply(true);
  }

  /* ---------- мягкое появление блоков при прокрутке (IntersectionObserver) ----------
     Работает одинаково при скролле мышью и при свайпе с телефона — эффект зависит
     только от положения блока на экране, а не от наведения курсора. Срабатывает
     один раз на блок (без повторных мельканий), полностью отключается в
     prefers-reduced-motion (см. styles.css) и в режиме для слабовидящих. */
  function initReveal() {
    var sel = ['.sec-head', '.about-text', '.about-photo', '.step', '.svc-cat',
      '.rsum', '.rev', '.fq', '.c-list', '.form-card', '.foot-top'];
    var items = $$(sel.join(','));
    if (!items.length) return;
    items.forEach(function (el) { el.classList.add('reveal'); });
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(function (el) {
      var within = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = (Math.min(within, 5) * 70) + 'ms';
      io.observe(el);
    });
  }

  /* ---------- сценический движок (параллакс, зависящий от прогресса скролла) ---------- */
  var stageEl, rafId = null, running = false;
  function setVars(map) { for (var k in map) root.style.setProperty(k, map[k]); }
  function frame() {
    rafId = null;
    if (!stageEl) return;
    var rect = stageEl.parentNode.getBoundingClientRect(); // .cinema-scroll
    var total = stageEl.parentNode.offsetHeight - window.innerHeight;
    var s = total > 0 ? clamp(-rect.top / total) : 0;

    var activeHero = 1 - smoothstep(0.14, 0.23, s); // виден сразу при загрузке, гаснет при скролле
    var exitP = smoothstep(0.10, 0.23, s);
    var activeMile = seg(s, 0.13, 0.20, 0.44, 0.50);
    var mEnter = smoothstep(0.13, 0.20, s), mExit = smoothstep(0.44, 0.50, s);
    var activeIntro = seg(s, 0.49, 0.56, 0.72, 0.80);
    var iEnter = smoothstep(0.49, 0.56, s), iExit = smoothstep(0.72, 0.80, s);
    var activeP1 = seg(s, 0.76, 0.82, 0.88, 0.92);
    var p1Enter = smoothstep(0.76, 0.82, s), p1Exit = smoothstep(0.88, 0.92, s);
    var activeP2 = smoothstep(0.90, 0.96, s);

    setVars({
      '--sky-b': (1 - 0.22 * activeMile - 0.12 * Math.max(activeIntro, activeP1, activeP2)).toFixed(3),
      '--mid-y': (14 - 20 * s).toFixed(2) + 'vh',
      '--mid-scale': (1.02 + 0.10 * s).toFixed(3),
      '--fore-y': (20 - 32 * s).toFixed(2) + 'vh',
      '--fore-scale': (1.04 + 0.18 * s).toFixed(3),
      '--kicker-op': activeHero.toFixed(3),
      '--kicker-y': (-40 * smoothstep(0.06, 0.18, s)).toFixed(1) + 'px',
      '--title-op': activeHero.toFixed(3),
      '--title-y': (-90 * exitP).toFixed(1) + 'px',
      '--title-scale': (1 - 0.15 * exitP).toFixed(3),
      '--mile-op': activeMile.toFixed(3),
      '--mile-enter': (lerp(60, 0, mEnter) + lerp(0, -60, mExit)).toFixed(1) + 'vw',
      '--mile-y': (lerp(40, 0, mEnter) + lerp(0, -20, mExit)).toFixed(1) + 'px',
      '--mile-scale': (lerp(0.94, 1, mEnter) - lerp(0, 0.04, mExit)).toFixed(3),
      '--mile-nav-op': activeMile.toFixed(3),
      '--intro-op': activeIntro.toFixed(3),
      '--intro-y': (lerp(30, 0, iEnter) - lerp(0, 30, iExit)).toFixed(1) + 'px',
      '--p-y': (lerp(40, 0, p1Enter) - lerp(0, 30, p1Exit)).toFixed(1) + 'px',
      '--p-op': activeP1.toFixed(3),
      '--p2-y': (lerp(40, 0, smoothstep(0.90, 0.98, s))).toFixed(1) + 'px',
      '--p2-op': activeP2.toFixed(3),
      '--hint-op': (1 - smoothstep(0, 0.05, s)).toFixed(3)
    });
    $('.mile-nav-wrap') && $('.mile-nav-wrap').classList.toggle('ready', activeMile > 0.5);
    if (running) rafId = requestAnimationFrame(frame);
  }
  function startEngine() {
    stageEl = $('.stage'); if (!stageEl || running) return;
    running = true;
    window.addEventListener('scroll', onScrollTick, { passive: true });
    window.addEventListener('resize', onScrollTick);
    frame();
  }
  function stopEngine() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('scroll', onScrollTick);
    window.removeEventListener('resize', onScrollTick);
  }
  function onScrollTick() { if (!rafId && running) rafId = requestAnimationFrame(frame); }

  /* ---------- информационная модалка: тарифы / документы / разъяснения / польза / ПДн ----------
     Данные — content.json, перенесённый дословно с сайта конторы. */
  var INFO_TABS = [['tariffs', 'Тарифы'], ['docs', 'Какие документы нужны'], ['articles', 'Разъяснения нотариуса'],
                    ['useful', 'Полезная информация'], ['pdn', 'Обработка персональных данных']];
  var infoData = null, infoTab = '';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pars(list) { return (list || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join(''); }
  function filesHtml(list) {
    return (list || []).map(function (f) { return '<a class="info-f" href="' + esc(f.url) + '" target="_blank" rel="noopener">↓ ' + esc(f.title || 'Файл') + '</a>'; }).join('');
  }
  function acc(title, inner) {
    return '<div class="info-i"><button type="button" aria-expanded="false"><span>' + esc(title) + '</span><span>+</span></button><div>' + inner + '</div></div>';
  }
  function infoHas(id, c) {
    if (id === 'tariffs') { var tf = c.tariffs || {}; return !!((tf.rows || []).length || tf.intro || (tf.files || []).length); }
    if (id === 'docs') return !!(c.docs || []).length;
    if (id === 'articles') return !!(c.articles || []).length;
    if (id === 'useful') return !!((c.useful || []).length || ((c.history || {}).paragraphs || []).length);
    if (id === 'pdn') return (((c.pdn || {}).paragraphs) || []).length > 0;
    return false;
  }
  function infoBody(id, c) {
    var out = '';
    if (id === 'tariffs') {
      var tf = c.tariffs || {}, inner = pars(tf.intro ? [tf.intro] : []);
      if ((tf.rows || []).length) {
        inner += '<table><tbody>' + tf.rows.map(function (r) {
          return '<tr><td>' + esc(r.service) + '</td><td>' + esc(r.tariff) + '</td><td>' + esc(r.upth) + '</td><td>' + esc(r.total) + '</td></tr>';
        }).join('') + '</tbody></table>';
      }
      inner += filesHtml(tf.files) + pars(tf.note ? [tf.note] : []);
      out = acc(tf.title || 'Тарифы', inner);
    } else if (id === 'docs') {
      out = (c.docs || []).map(function (d) {
        var inner = pars(d.intro ? [d.intro] : []);
        (d.sections || []).forEach(function (sec) {
          if (sec.title) inner += '<h4>' + esc(sec.title) + '</h4>';
          if (sec.text) inner += '<p>' + esc(sec.text) + '</p>';
          if ((sec.items || []).length) inner += '<ul>' + sec.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
        });
        return acc(d.title, inner + filesHtml(d.files));
      }).join('');
    } else if (id === 'articles') {
      out = (c.articles || []).map(function (a) {
        var head = a.title ? ((a.date ? a.date + ' · ' : '') + a.title) : (a.date || 'Разъяснение');
        return acc(head, pars(a.paragraphs) + filesHtml(a.files));
      }).join('');
    } else if (id === 'useful') {
      out = (c.useful || []).map(function (u) {
        var inner = pars(u.text ? [u.text] : []);
        (u.entries || []).forEach(function (e) {
          var bits = [];
          if (e.address) bits.push(esc(e.address));
          (e.phones || []).forEach(function (ph) { bits.push('<a href="tel:' + esc(String(ph).replace(/[^+\d]/g, '')) + '">' + esc(ph) + '</a>'); });
          if (e.email) bits.push('<a href="mailto:' + esc(e.email) + '">' + esc(e.email) + '</a>');
          if (e.url) bits.push('<a href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.url) + '</a>');
          inner += '<p><b>' + esc(e.name) + '</b><br>' + bits.join('<br>') + '</p>';
        });
        return acc(u.title, inner);
      }).join('');
      var h = c.history || {};
      if ((h.paragraphs || []).length) out += acc(h.title || 'История дома', pars(h.paragraphs));
    } else if (id === 'pdn') {
      var pd = c.pdn || {};
      out = acc(pd.title || 'Обработка персональных данных', pars(pd.paragraphs));
    }
    return out;
  }
  function renderInfo() {
    var tabsEl = $('#infoTabs'), bodyEl = $('#infoBody'); if (!tabsEl || !bodyEl || !infoData) return;
    var avail = INFO_TABS.filter(function (x) { return infoHas(x[0], infoData); });
    if (!avail.length) return;
    if (!infoTab || avail.map(function (x) { return x[0]; }).indexOf(infoTab) < 0) infoTab = avail[0][0];
    tabsEl.innerHTML = avail.map(function (x) {
      return '<button type="button" role="tab" data-itab="' + x[0] + '" aria-selected="' + (x[0] === infoTab) + '">' + esc(x[1]) + '</button>';
    }).join('');
    bodyEl.innerHTML = infoBody(infoTab, infoData);
    var first = $('.info-i', bodyEl);
    if (first) { first.classList.add('open'); $('button', first).setAttribute('aria-expanded', 'true'); }
  }
  function openModal(id) { var m = $('#' + id); if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; } }
  function closeModals() { $$('.modal').forEach(function (m) { m.classList.remove('open'); }); document.body.style.overflow = ''; }
  function openInfo(tab) {
    openModal('infoModal');
    function ready() { if (tab) infoTab = tab; renderInfo(); }
    if (infoData) { ready(); return; }
    fetch('content.json').then(function (r) { return r.json(); }).then(function (j) { infoData = j; ready(); }).catch(function () { infoData = {}; ready(); });
  }
  function initModals() {
    $$('[data-info]').forEach(function (b) { b.addEventListener('click', function () { openInfo(b.getAttribute('data-info')); }); });
    $$('[data-close]').forEach(function (b) { b.addEventListener('click', closeModals); });
    $$('.modal-bg').forEach(function (b) { b.addEventListener('click', closeModals); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModals(); });
    var tabsEl = $('#infoTabs');
    if (tabsEl) tabsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-itab]'); if (!b) return;
      infoTab = b.getAttribute('data-itab'); renderInfo(); $('#infoBody').scrollTop = 0;
    });
    var bodyEl = $('#infoBody');
    if (bodyEl) bodyEl.addEventListener('click', function (e) {
      var b = e.target.closest('.info-i > button'); if (!b) return;
      var it = b.parentNode, open = it.classList.toggle('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- форма записи (mailto) ---------- */
  function initForm() {
    var f = $('#bookForm'); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#fName').value.trim(), phone = $('#fPhone').value.trim(), svc = $('#fService');
      var digits = phone.replace(/\D/g, ''), ok = true;
      $('#fName').closest('.fld').classList.toggle('err', name.length < 2); if (name.length < 2) ok = false;
      $('#fPhone').closest('.fld').classList.toggle('err', digits.length < 10); if (digits.length < 10) ok = false;
      svc.closest('.fld').classList.toggle('err', !svc.value); if (!svc.value) ok = false;
      if (!ok) return;
      var svcName = svc.options[svc.selectedIndex].textContent;
      var lines = ['Заявка на приём с сайта Нотариус Таракановский', '',
        'Нотариус: Таракановский Леонид Феликсович',
        'Имя: ' + name, 'Телефон: ' + phone, 'Услуга: ' + svcName,
        'Удобное время: ' + ($('#fTime').value.trim() || '—'),
        'Комментарий: ' + ($('#fComment').value.trim() || '—'), '',
        'Сайт: ' + location.href];
      window.location.href = 'mailto:site_vseti@mail.ru?subject=' + encodeURIComponent('Запись к нотариусу — Таракановский') +
        '&body=' + encodeURIComponent(lines.join('\n'));
      var ok2 = $('#fOk'); ok2.textContent = 'Письмо сформировано и открыто в почтовом клиенте. Если не открылось — позвоните +7 (812) 315-25-23.'; ok2.classList.add('show');
    });
    $$('input,select,textarea', f).forEach(function (el) { el.addEventListener('input', function () { el.closest('.fld').classList.remove('err'); }); });
  }

  function init() {
    initA11y(); initHeader(); initForm(); initModals(); initMileSlider(); initReveal();
    initAccordion('.svc-grid', '.svc-cat', '.svc-cat > button');
    initAccordion('.faq', '.fq', '.fq > button');
    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
    updateMotionMode();
    if (window.matchMedia) {
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) { reduceMotion = e.matches; updateMotionMode(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
