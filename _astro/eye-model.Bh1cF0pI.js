/* ==========================================================================
   Modele edukacyjne. Bez zależności, ładowane tylko na stronach narzędzi.
   Zasady wspólne: wynik tekstowy jest źródłem prawdy, SVG go tylko pokazuje;
   nic nie jest zapisywane, nie trafia do URL-a ani do analityki; żadnego
   doboru produktu, wyceny ani diagnozy. Bez JS zostaje wyjaśnienie,
   przykład i kontakt — kontrolki wstrzykujemy dopiero tutaj, żeby nie
   zostawiać martwych suwaków.
   ========================================================================== */
export function mountEyeModels(scope) {

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function pl(x, d) { return x.toFixed(d).replace('.', ','); }

  /* ------------------------------------------- JAK SOCZEWKA ZMIENIA BIEG -- */
  /* Uproszczony model optyczny na STAŁYM przykładzie. Użytkownik wybiera
     przykład, nie swoją wadę; nie pytamy o receptę, nie oceniamy, nie
     zapisujemy. Siatkówka, układ optyczny i ognisko to kotwice wektorowe —
     promienie są liczone, nie rysowane na oko. */
  /* Współrzędne pochodzą z POMIARU dostarczonej grafiki (1693×929), a nie
     odwrotnie: to model kalibruje się do rysunku. Zmierzone niezależnie —
     v2: rogówka 375, siatkówka 1202, oś 458,0 przy deklarowanych 376,5 / 1202 / 457,5.
     Po regeneracji obrazu wystarczy przemierzyć i podstawić te trzy liczby. */
  var AXIS = 457.5, LENS_X = 170, EYE_X = 606, RETINA_X = 1202, END_X = 1660;
  var VB_W = 1693, VB_H = 929;
  var GAP = EYE_X - LENS_X;              /* odstęp soczewka okularowa — oko */
  var K = 0.0001322667;                  /* jednostki mocy na dioptrię */
  var EYES = {
    myopia:    { P: 0.0020161290, fix: -3, name: 'Krótkowzroczność',
                 zero: 'Bez soczewki okularowej światło skupia się przed siatkówką.' },
    hyperopia: { P: 0.0011980427, fix:  3, name: 'Nadwzroczność (potocznie: dalekowzroczność)',
                 zero: 'Bez soczewki okularowej światło skupiałoby się za siatkówką.' }
  };
  var HEIGHTS = [347.5, 402.5, 512.5, 567.5];

  function focusOf(P, D) {
    var C = D * K;
    var V2 = C ? C / (1 - GAP * C) : 0;
    var V3 = V2 + P;
    return V3 > 0 ? EYE_X + 1 / V3 : Infinity;
  }

  /* Ilustracja jest rastrem w tym samym viewBox co promienie — brak crop,
     brak przeskalowania, więc warstwy nie mogą się rozjechać. Oś optyczna
     jest już wrysowana w grafikę, więc nie dokładamy własnej. */
  function eyeArt(src) {
    return '<image href="' + src + '" x="0" y="0" width="' + VB_W +
           '" height="' + VB_H + '" preserveAspectRatio="xMidYMid meet"/>';
  }

  function eyeModel(root) {
    var host = root.querySelector('[data-tool-controls]');
    var fig  = root.querySelector('[data-tool-fig]');
    var out  = root.querySelector('[data-tool-out]');
    if (!host || !fig || !out) return;
    var art = fig.getAttribute('data-eye-art') || '/media/tools/eye-diagram.png';
    host.innerHTML = '';

    var kind = 'myopia', power = 0, announce;

    /* wybór przykładu: dwa radio w fieldset, nie przełącznik */
    var fs = el('fieldset', { 'class': 'tool__fs' });
    fs.appendChild(el('legend', { 'class': 'tool__label' }, 'Przykład optyczny'));
    var opts = el('div', { 'class': 'tool__idx' });
    Object.keys(EYES).forEach(function (key) {
      var id = 'ex' + key;
      var w = el('span', { 'class': 'tool__radio' });
      var r = el('input', { type: 'radio', name: 'przyklad', id: id, value: key });
      if (key === kind) r.checked = true;
      var l = el('label', { 'for': id }, EYES[key].name);
      r.addEventListener('change', function () { kind = key; power = 0; sync(); render(); });
      w.appendChild(r); w.appendChild(l); opts.appendChild(w);
    });
    fs.appendChild(opts); host.appendChild(fs);

    var row = el('div', { 'class': 'tool__row' });
    row.appendChild(el('label', { 'for': 'pw', 'class': 'tool__label' }, 'Moc przykładowej soczewki'));
    var line = el('div', { 'class': 'tool__line' });
    var rng = el('input', { type: 'range', id: 'pw', min: -6, max: 6, step: 0.25, value: 0 });
    var num = el('input', { type: 'number', min: -6, max: 6, step: 0.25, value: 0,
                            'class': 'tool__num', 'aria-label': 'Moc przykładowej soczewki w dioptriach' });
    line.appendChild(rng); line.appendChild(num); line.appendChild(el('span', { 'class': 'tool__unit' }, 'D'));
    row.appendChild(line);
    var scale = el('div', { 'class': 'tool__scale' });
    ['−6 D', '0', '+6 D'].forEach(function (t) { scale.appendChild(el('span', null, t)); });
    row.appendChild(scale);
    host.appendChild(row);

    function sync() { rng.value = power; num.value = power; }
    rng.addEventListener('input', function () { power = parseFloat(rng.value); num.value = power; render(); });
    num.addEventListener('input', function () {
      var v = parseFloat(num.value);
      if (!isNaN(v)) { power = Math.max(-6, Math.min(6, v)); rng.value = power; render(); }
    });

    var pending = 0;
    function render() {
      if (pending) return;                       /* scalamy aktualizacje w jedną klatkę */
      pending = requestAnimationFrame(function () { pending = 0; draw(); });
    }

    function draw() {
      var eye = EYES[kind];
      var fx = focusOf(eye.P, power);
      var onRetina = isFinite(fx) && Math.abs(fx - RETINA_X) < 0.5;

      var rays = '';
      HEIGHTS.forEach(function (y) {
        var o = y - AXIS;
        var C = power * K;
        var yEye = AXIS + o * (1 - GAP * C);      /* wysokość na układzie optycznym oka */
        var seg = 'M20,' + y + ' L' + LENS_X + ',' + y + ' L' + EYE_X + ',' + yEye.toFixed(2);
        if (!isFinite(fx)) {
          rays += '<path d="' + seg + ' L' + END_X + ',' + (yEye + o * 0.5).toFixed(2) +
                  '" class="tool__ray" fill="none" stroke-width="2.2" vector-effect="non-scaling-stroke"/>';
          return;
        }
        var slope = (AXIS - yEye) / (fx - EYE_X);
        var yAt = function (x) { return yEye + slope * (x - EYE_X); };
        var stop = Math.min(RETINA_X, END_X);
        rays += '<path d="' + seg + ' L' + stop + ',' + yAt(stop).toFixed(2) +
                '" class="tool__ray" fill="none" stroke-width="2.2" vector-effect="non-scaling-stroke"/>';
        if (fx > RETINA_X) {                      /* ognisko za siatkówką — przedłużenie */
          var e = Math.min(fx, END_X);
          rays += '<path d="M' + stop + ',' + yAt(stop).toFixed(2) + ' L' + e + ',' + yAt(e).toFixed(2) +
                  '" class="tool__ray" fill="none" stroke-width="1.6" stroke-dasharray="5 5" opacity=".65"' +
                  ' vector-effect="non-scaling-stroke"/>';
        }
      });

      /* soczewka okularowa w stałej płaszczyźnie x=70 */
      var spec = '';
      if (power !== 0) {
        var bow = power < 0 ? 22 : -22, h = 330;
        spec = '<path d="M' + (LENS_X - 24) + ',' + (AXIS - h / 2) + ' q' + bow + ',' + (h / 2) + ' 0,' + h +
               ' l48,0 q' + (-bow) + ',' + (-h / 2) + ' 0,' + (-h) + ' Z"' +
               ' class="tool__lens" stroke-width="2.4" vector-effect="non-scaling-stroke"/>';
      }

      /* Stały punkt odniesienia: bez niego użytkownik nie wie, do czego dąży.
         Wyraźnie odróżniony od ruchomego markera ogniska. */
      var target =
        '<circle data-target class="tool__target" cx="' + RETINA_X + '" cy="' + AXIS + '" r="26"' +
        ' stroke-width="3" stroke-dasharray="6 6" opacity=".75" vector-effect="non-scaling-stroke"/>' +
        '<circle data-target class="tool__target--dot" cx="' + RETINA_X + '" cy="' + AXIS + '" r="5" opacity=".75"/>';

      var marker = isFinite(fx) && fx < END_X
        ? '<circle data-focus class="tool__marker ' + (onRetina ? 'tool__marker--on' : 'tool__marker--off') + '" cx="' + fx.toFixed(2) + '" cy="' + AXIS + '" r="14" stroke-width="4"/>'
        : '';

      fig.innerHTML = eyeArt(art) + spec + rays + target + marker;

      var msg;
      if (power === 0) msg = eye.zero;
      else if (onRetina) msg = 'W tym przykładzie soczewka ' + pl(power, 2) + ' D kieruje światło na siatkówkę.';
      else if (fx < RETINA_X) msg = 'Przy soczewce ' + pl(power, 2) + ' D światło skupia się przed siatkówką.';
      else msg = 'Przy soczewce ' + pl(power, 2) + ' D światło skupiałoby się za siatkówką.';
      out.textContent = msg;

      clearTimeout(announce);
      announce = setTimeout(function () {
        var live = root.querySelector('[data-tool-live]');
        if (live) live.textContent = msg;
      }, 400);
    }

    root.classList.add('tool--live');
    draw();
  }

  var map = { eye: eyeModel };
  (scope || document).querySelectorAll('[data-tool]').forEach(function (root) {
    var fn = map[root.getAttribute('data-tool')];
    if (fn) try { fn(root); } catch (e) { /* zostaje wersja statyczna */ }
  });
}
