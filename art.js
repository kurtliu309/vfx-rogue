/* Node Rogue v2 — procedural pixel art (global VFXArt). Pure canvas, no assets. */
(function (global) {
  'use strict';

  /* ---------------- palette ---------------- */
  const P = {
    k: '#0b0d14', K: '#1a1e2c', g: '#5a6378', G: '#8a93a8', l: '#c4cad8', w: '#f4f2ea',
    r: '#e8434b', R: '#9a2430', o: '#ff8a2e', O: '#b8501c', y: '#ffd84a', Y: '#c99a1c',
    e: '#5ed38a', E: '#2a8a52', c: '#5ee0ff', C: '#2a8ab8', b: '#4a7cf0', B: '#26408a',
    p: '#b98cff', P: '#6a3cc0', m: '#ff7ab8', M: '#a83a78', n: '#a8784a', N: '#5a3a22',
    s: '#f0c49a', S: '#b07a52', t: '#7ad8c0', T: '#2a7a6a'
  };

  /* ---------------- tiny 3x5 pixel font for canvas labels ---------------- */
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
    '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
    '9': '111101111001110', ' ': '000000000000000', '.': '000000000000010', ':': '000010000010000', '!': '010010010000010',
    '-': '000000111000000', '/': '001001010100100', '?': '110001010000010', '*': '000101010101000', '#': '101111101111101',
    '%': '101001010100101', '+': '000010111010000', '$': '011110010011110'
  };
  function text(ctx, str, x, y, color, scale) {
    scale = scale || 1;
    ctx.fillStyle = color || P.w;
    str = String(str).toUpperCase();
    let cx = x;
    for (const ch of str) {
      const g = FONT[ch] || FONT['?'];
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
      cx += 4 * scale;
    }
    return cx - x;
  }
  const textW = (str, scale) => String(str).length * 4 * (scale || 1) - (scale || 1);

  /* ---------------- seeded helpers ---------------- */
  function hrand(i) { // deterministic hash -> [0,1)
    let x = (i * 374761393 + 668265263) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  function dither(ctx, x, y, w, h, c, density) {
    ctx.fillStyle = c;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const b = ((i & 1) ^ (j & 1)) ? 0.75 : 0.25;
      if (density > b) ctx.fillRect(x + i, y + j, 1, 1);
    }
  }

  /* ---------------- sprite strings ---------------- */
  // 10x10 icons. Palette letters from P; 'd' = department colour; '.' = empty.
  const ICONS = {
    box:      ['..........', '...dddd...', '..dlllld..', '.dllllldd.', '.ddddddgd.', '.dlllllgd.', '.dlllllgd.', '.dlllllg..', '.ddddddd..', '..........'],
    sculpt:   ['..........', '...dddd...', '..dssssd..', '.dsskssd..', '.dssssssd.', '.dsssssd..', '..dssssd..', '...dssd...', '....dd....', '..........'],
    hardsurf: ['..........', '..dd..dd..', '..dldddld.', '..dlllllld', '.ddlggglld', '.dlllllld.', '.dlggglld.', '.dlllllld.', '.dddddddd.', '..........'],
    terrain:  ['..........', '..........', '......d...', '.....dld..', '..d.dlllde', '.dldllllee', 'dlllleeeee', 'eeeeeeeeee', 'EEEEEEEEEE', '..........'],
    scan:     ['d........d', 'd...gg...d', '...glwg...', '..gllllg..', '..glgglg..', '..gllllg..', '...glgg...', '...gggg...', 'd........d', 'd........d'],
    plate:    ['..........', 'kkkkkkkkkk', 'kwkwkwkwkk', 'kccccccckk', 'kcceccccck', 'keeeeEeeek', 'kEEEEEEEEk', 'kwkwkwkwkk', 'kkkkkkkkkk', '..........'],
    shader:   ['..........', '...dddd...', '..dyyyyd..', '.dywyyyyd.', '.dyyyyyOd.', '.dyyyyOOd.', '.dyyyOOOd.', '..dOOOOd..', '...dddd...', '..........'],
    paint:    ['........kk', '.......kok', '......kok.', '.....kok..', '....kok...', '...knk....', '..rrk.....', '.rrrr.....', '.rrr......', '..........'],
    skin:     ['..........', '...dddd...', '..dssssd..', '.dsmssssd.', '.dsssssmd.', '.dssmsssd.', '.dsssssSd.', '..dSSSSd..', '...dddd...', '..........'],
    metal:    ['..........', '...dddd...', '..dlwwld..', '.dlwwlllld', '.dlwlllggd', '.dllllggd.', '.dlllgggd.', '..dgggg d.'.replace(' ', 'g'), '...dddd...', '..........'],
    toon:     ['..........', '...kkkk...', '..kmmmmk..', '.kmwmmmmk.', '.kmmmmmmk.', '.kmmmmMMk.', '.kmmmMMMk.', '..kMMMMk..', '...kkkk...', '..........'],
    rig:      ['....dd....', '....dd....', '..d.dd.d..', '...dddd...', '....dd....', '....dd....', '...d..d...', '..d....d..', '.dd....dd.', '..........'],
    animate:  ['.....d....', '....ddd...', '.....d..d.', '...dddddd.', '..d..d....', '.....d....', '....d.d...', '...d...d..', '..d.....dd', '..........'],
    mocap:    ['....w.....', '...www....', '..w.w.w...', '....w.....', '...w.w....', '..w...w...', 'd.d.d.d.d.', '..........', 'dddddddddd', '..........'],
    muscle:   ['..........', '..ss......', '.sSSs.....', '.sSmms....', '..smmmss..', '...smmmms.', '....sSmms.', '.....sssS.', '......ss..', '..........'],
    vellum:   ['d........d', 'dmmmmmmmmd', '.mwmmmmmm.', '.mmmmmmmm.', '..mmmmmm..', '..mmmmMm..', '...mmMm...', '...mMmm...', '....MM....', '..........'],
    groom:    ['..n.n.n.n.', '.n.n.n.n..', '.nnnnnnnn.', 'nnnnnnnnnn', 'nNnNnNnNnN', 'NnNnNnNnNn', 'ssssssssss', 'ssssssssss', '..........', '..........'],
    pyrosrc:  ['..........', '....y.....', '...yo.....', '...oyo....', '..ooyoo...', '..oOyOo...', '...OOO....', '.ggggggg..', '.gllllgg..', '..........'],
    pyro:     ['....y.....', '...yoy..y.', '..yoooy.o.', '.yooyooyo.', '.oOyyyoOo.', '.oOyyyyOo.', '..oOyyOo..', '...OOOO...', '..........', 'rrrrrrrrrr'],
    turb:     ['..........', '..ggg.....', '.g...g.gg.', '.g.o..g..g', '..gooo...g', '...ooog.g.', '..ooyoo...', '..oyyyo...', '...ooo....', '..........'],
    upres:    ['oooooooooo', 'o........o', 'o.y.y.y..o', 'o..o.o.o.o', 'o.y.y.y..o', 'o..o.o.o.o', 'o.y.y.y..o', 'o........o', 'oooooooooo', '..........'],
    flipsrc:  ['..........', '....c.....', '...ccc....', '..ccwcc...', '..cccccc..', '..cccCcc..', '...cCCc...', '.ggggggg..', '.gllllgg..', '..........'],
    flip:     ['..........', '.......w..', '......ccw.', '..c..cccc.', '.cccccCccc', 'cccCcccCcc', 'cCCcCCcCCc', 'CCCCCCCCCC', 'BBBBBBBBBB', 'rrrrrrrrrr'],
    white:    ['..w...w...', '.w.w.w.w..', '..www.ww..', '.wwwwwwww.', 'wwcwwwcwww', 'ccwcccwccc', 'cccccccccc', 'CCCCCCCCCC', '..........', '..........'],
    mesher:   ['..........', 'cCcCcCcCc.', 'C.C.C.C.C.', 'cCcCcCcCc.', 'C.C.C.C.C.', 'cCcCcCcCc.', 'C.C.C.C.C.', 'cCcCcCcCc.', '..........', '..........'],
    fracture: ['..........', '.dddddddd.', '.dlllklld.', '.dllklll..', '.dlkkllld.', '..kllkkld.', '.dllllkld.', '.dlllkll..', '.ddd.dddd.', '..........'],
    rbd:      ['.....ll...', '..l..lg...', '.lg.......', '......ll..', '..ll..lg..', '..lg......', '.ll....ll.', '.lgll..lg.', 'gggggggggg', 'rrrrrrrrrr'],
    debris:   ['..........', '.n....n...', '..n.n...n.', '.....N....', '.n.N...n..', '...n.N..n.', 'n...n..N..', '..N...n...', 'nnNnnNnnNn', '..........'],
    dust:     ['..........', '...ggg....', '.gglllg...', 'glllllllg.', 'gllggllllg', '.glllggllg', '..gllllgg.', '...ggg....', '.n.n..n.n.', '..........'],
    popsrc:   ['..........', '.p....p...', '...p.....p', '.....w....', '..p.www.p.', '.....w....', '.p.......p', '...p..p...', '..........', '..........'],
    pop:      ['..p....p..', '.pwp..pwp.', '..p.pp.p..', '....pwp...', '.p..pp..p.', 'pwp....pwp', '.p..pp..p.', '...pwwp...', '..........', 'rrrrrrrrrr'],
    trails:   ['..........', 'P.........', '.Pp.......', '..Ppp.....', '...PPppp..', '.....PPppw', '.......PPw', '..........', '..........', '..........'],
    light:    ['..........', '...yyyy...', '..yyyyyy..', '..yywyyy..', '..yyyyyy..', '...yyyy...', '....gg....', '....gg....', '...gggg...', '..........'],
    threept:  ['y........y', '.y......y.', '..y....y..', '..........', '....ss....', '...ssss...', '....ss....', '..........', '....y.....', '...yyy....'],
    hdri:     ['..cccccc..', '.cbbbbbbc.', 'cbyybbbbbc', 'cbyybbbbbc', 'cbbbbbbbbc', 'ceeeeeeeec', '.ceEEEEec.', '..cccccc..', '..........', '..........'],
    moon:     ['..........', '....www...', '...ww.....', '..ww......', '..ww......', '..ww......', '...ww.....', '....www...', '..........', '.b..b...b.'],
    firelight:['..........', '...yyy....', '..yoooy...', '..yoyoy...', '...ooo....', '..y.g.y...', '.y..g..y..', '....g.....', '...ggg....', '..........'],
    pathtrace:['w.........', '.w.....w..', '..w...w...', '...w.w....', '....w.....', '...ww.....', '..w..w....', '.w....w...', 'gggggggggg', '..........'],
    comp:     ['..........', '.ddddddd..', '.dwwwwwd..', '.dwdddddd.', '.dwdwwwwd.', '.ddd wwwd.'.replace(' ', 'w'), '...dwwwwd.', '...dddddd.', '..........', '..........'],
    plateint: ['kkkkkkkkkk', 'kccceeeeck', 'kcccdeeeck', 'kccdddeeek', 'kcccdeeeek', 'keeeeeeEek', 'kEEEEEEEEk', 'kkkkkkkkkk', '..........', '..........'],
    grade:    ['..........', '.rrr.eee..', 'rrrrreeeee', 'rrrrreeeee', '.rrrbbbe..', '..bbbbbb..', '..bbbbbb..', '...bbbb...', '..........', '..........'],
    lens:     ['..........', '...kkkk...', '..kgbbgk..', '.kgbwbbgk.', '.kgbbbbgk.', '.kgbbbbgk.', '..kgbbgk..', '...kkkk...', '.g.g.g.g.g', 'g.g.g.g.g.'],
    haze:     ['..........', '.o.o.o.o..', 'o.o.o.o.o.', '.o.o.o.o..', '..........', '.y.y.y.y..', 'y.y.y.y.y.', '.o.o.o.o..', 'oooooooooo', '..........'],
    glow:     ['....p.....', '..p.p.p...', '...ppp....', 'ppppwpppp.', '...ppp....', '..p.p.p...', '....p.....', '..........', '..........', '..........'],
    roto:     ['..........', '.d......d.', '..d....d..', '...dddd...', '..dlllld..', '.dllkkld..', '.dlllllld.', '..dddddd..', '..k..k....', '..........'],
    merge:    ['d.........', '.d........', '..d.......', '...ddddddd', '..d.......', '.d........', 'd.........', '..........', '..........', '..........'],
    collision:['..........', '.dddddddd.', '.d......d.', '.d.dddd.d.', '.d.d..d.d.', '.d.dddd.d.', '.d......d.', '.dddddddd.', '..........', '..........'],
    hda:      ['dddddddddd', 'd........d', 'd.yy..yy.d', 'd.yy..yy.d', 'd...yy...d', 'd...yy...d', 'd.yyyyyy.d', 'd........d', 'dddddddddd', '..........'],
    // misc
    star:     ['....y.....', '....y.....', '...yyy....', 'yyyyyyyyy.', '.yyyyyyy..', '..yyyyy...', '..yy.yy...', '.yy...yy..', '..........', '..........'],
    coin:     ['..........', '...yyyy...', '..yYYYYy..', '.yYyyyYYy.', '.yYyYYyYy.', '.yYyyyYYy.', '.yYYYyYYy.', '..yYYYYy..', '...yyyy...', '..........'],
    clock:    ['..........', '...llll...', '..l....l..', '.l...k..l.', '.l...k..l.', '.l..kk..l.', '.l......l.', '..l....l..', '...llll...', '..........'],
    ram:      ['..........', '..........', 'eeeeeeeeee', 'ekkekkekke', 'ekkekkekke', 'eeeeeeeeee', 'y.y.y.y.y.', '..........', '..........', '..........'],
    cpu:      ['.l.l.l.l..', 'lggggggggl', '.gkkkkkkg.', 'lgkbbbbkgl', '.gkbwwbkg.', 'lgkbbbbkgl', '.gkkkkkkg.', 'lggggggggl', '.l.l.l.l..', '..........'],
    gpu:      ['..........', 'gggggggggg', 'gkkkgkkkkg', 'gk.kgklllg', 'gkkkgkkkkg', 'gggggggggg', '.yyyy.....', '..........', '..........', '..........'],
    disk:     ['..........', '.eeeeeeee.', '.ekwwwwke.', '.ekwwwwke.', '.eeeeeeee.', '.eekkkkee.', '.eekkkkee.', '.eeeeeeee.', '..........', '..........'],
    lock:     ['..........', '...gggg...', '..g....g..', '..g....g..', '.yyyyyyyy.', '.yYYkkYYy.', '.yYYkkYYy.', '.yYYYYYYy.', '.yyyyyyyy.', '..........'],
    cat:      ['..........', '.k.....k..', '.kk...kk..', '.kkkkkkk..', '.kykkkyk..', '.kkkmkkk..', '..kkkkk...', '..kkkkkk.k', '..kkkkkkk.', '..........'],
    mail:     ['..........', 'wwwwwwwwww', 'wwlllllllw', 'wlwlllllww', 'wllwllllww'.slice(0, 10), 'wlllwwlllw', 'wllllllllw', 'wwwwwwwwww', '..........', '..........'],
    coffee:   ['...l.l....', '....l.l...', '..........', '.wwwwwww..', '.wnnnnnwww', '.wnnnnnw.w', '.wnnnnnwww', '..wwwww...', '.ggggggg..', '..........'],
    // relic icons
    guru:     ['...yyyy...', '..y....y..', '..........', '...ssss...', '..skssks..', '..ssssss..', '...smms...', '.ooooooo..', 'oooooooooo', '..........'],
    nerd:     ['..........', '..kkkkkk..', '.kwwkkwwk.', 'kkwwkkwwkk', '.kkkkkkkk.', '..ssssss..', '..ssmmss..', '...ssss...', '..........', '..........'],
    usd:      ['..........', '.bbb..bbb.', '.b.b..b.b.', '.bbbbbbbb.', '....bb....', '..cccccc..', '..c....c..', '..cccccc..', '..........', '..........'],
    farm:     ['..........', '.gggggggg.', '.gkekekeg.', '.gggggggg.', '.gkekekeg.', '.gggggggg.', '.gkekekeg.', '.gggggggg.', '..........', '..........'],
    monitor:  ['..........', 'gggg.gggg.', 'gbbg.gccg.', 'gbbg.gccg.', 'gggg.gggg.', '.gg...gg..', 'gggg.gggg.', '..........', '..........', '..........'],
    book:     ['..........', '.pppppppp.', '.pwwwwwwp.', '.pwkkkkwp.', '.pwwwwwwp.', '.pwkkkwwp.', '.pwwwwwwp.', '.pppppppp.', '.PPPPPPPP.', '..........'],
    drive:    ['..........', '.gggggggg.', '.gllllllg.', '.glkkkklg.', '.glkwwklg.', '.glkkkklg.', '.gllllleg.', '.gggggggg.', '..........', '..........'],
    lut:      ['..........', 'rrooyyeecc', 'rrooyyeecc', 'bbppmmrroo', 'bbppmmrroo', 'eeccbbppmm', 'eeccbbppmm', '..........', '..........', '..........'],
    wedge:    ['..........', '.e........', '.ee.......', '.eee......', '.eeee.....', '.eeeee....', '.eeeeyy...', '.eeeeyyrr.', '.eeeeyyrr.', '..........'],
    web:      ['..cccccc..', '.c..c..c..', 'c..c.c..c.', 'cccccccccc', 'c..c.c..c.', 'cccccccccc', 'c..c.c..c.', '.c..c..c..', '..cccccc..', '..........'],
    keys:     ['..........', 'gggggggggg', 'glglglglgg', 'gggggggggg', 'glglglglgg', 'gggggggggg', 'gllllllllg', 'gggggggggg', '..........', '..........'],
    eye:      ['..........', '..........', '...kkkk...', '.kkwwwwkk.', 'kwwwbbwwwk', 'kwwbkkbwwk', 'kwwwbbwwwk', '.kkwwwwkk.', '...kkkk...', '..........']
  };
  // fix any malformed rows
  for (const k in ICONS) ICONS[k] = ICONS[k].map(r => (r + '..........').slice(0, 10));
  ICONS.mail[4] = 'wllwllllww';

  const DEPT_COLORS = { model: '#9aa7b8', plate: '#7fc8a9', surf: '#c79a5a', char: '#e86fa3', fx: '#f08a3c', light: '#4f9cf0', comp: '#a876f0', util: '#e6e6e6' };

  function drawIcon(ctx, id, x, y, scale, deptColor) {
    const rows = ICONS[id] || ICONS.box;
    scale = scale || 1;
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const col = ch === 'd' ? (deptColor || '#e6e6e6') : (P[ch] || '#ff00ff');
        ctx.fillStyle = col;
        ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
      }
    }
  }
  const iconCache = {};
  function iconURL(id, deptColor, scale) {
    const k = id + '|' + deptColor + '|' + scale;
    if (iconCache[k]) return iconCache[k];
    if (typeof document === 'undefined') return '';
    const c = document.createElement('canvas'); c.width = 10 * scale; c.height = 10 * scale;
    const ctx = c.getContext('2d');
    drawIcon(ctx, id, 0, 0, scale, deptColor);
    return (iconCache[k] = c.toDataURL());
  }

  /* ---------------- portraits 24x24 ---------------- */
  function drawPortrait(ctx, face, x, y, s, t) {
    s = s || 1; t = t || 0;
    const R = (xx, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + xx * s, y + yy * s, w * s, h * s); };
    R(0, 0, 24, 24, face.bg || '#223');
    // subtle bg pattern
    for (let i = 0; i < 24; i += 4) R(i, 0, 1, 24, mix(face.bg || '#223344', '#000000', 0.2));
    if (face.system) {
      R(4, 7, 16, 11, '#f4f2ea'); R(4, 7, 16, 1, '#c4cad8');
      for (let i = 0; i < 8; i++) { R(4 + i, 8 + Math.floor(i * 0.6), 1, 1, '#8a93a8'); R(19 - i, 8 + Math.floor(i * 0.6), 1, 1, '#8a93a8'); }
      R(16, 4, 5, 5, '#e8434b'); R(18, 5, 1, 2, '#fff'); R(18, 8, 1, 0.01, '#fff');
      return;
    }
    if (face.cat) {
      const blink = (Math.floor(t / 2200) % 5 === 0) && (t % 2200) < 160;
      R(3, 16, 18, 8, '#1c1c24'); R(5, 6, 14, 12, '#1c1c24');
      R(5, 3, 3, 4, '#1c1c24'); R(16, 3, 3, 4, '#1c1c24'); R(6, 4, 1, 2, '#ff7ab8'); R(17, 4, 1, 2, '#ff7ab8');
      if (blink) { R(8, 11, 3, 1, '#ffd84a'); R(13, 11, 3, 1, '#ffd84a'); }
      else { R(8, 10, 3, 3, '#ffd84a'); R(13, 10, 3, 3, '#ffd84a'); R(9, 10, 1, 3, '#0b0d14'); R(14, 10, 1, 3, '#0b0d14'); }
      R(11, 14, 2, 1, '#ff7ab8');
      R(2, 13, 4, 1, '#8a93a8'); R(18, 13, 4, 1, '#8a93a8'); R(2, 15, 4, 1, '#8a93a8'); R(18, 15, 4, 1, '#8a93a8');
      return;
    }
    const skin = face.skin, shade = mix(skin, '#000000', 0.22), hair = face.hair;
    // shoulders
    R(2, 19, 20, 5, face.shirt); R(2, 19, 20, 1, mix(face.shirt, '#ffffff', 0.15));
    R(10, 17, 4, 3, shade);
    // head
    R(6, 5, 12, 13, skin); R(7, 4, 10, 1, skin); R(7, 18, 10, 1, skin);
    R(17, 7, 1, 10, shade); R(6, 16, 12, 2, mix(skin, shade, 0.4));
    // ears
    R(5, 10, 1, 3, shade); R(18, 10, 1, 3, shade);
    // hair styles
    const st = face.style || 0;
    if (st === 0) { R(6, 3, 12, 3, hair); R(6, 5, 1, 3, hair); R(17, 5, 1, 3, hair); }
    if (st === 1) { R(5, 2, 14, 4, hair); R(5, 5, 2, 4, hair); R(17, 5, 2, 3, hair); R(8, 6, 2, 1, hair); R(12, 6, 3, 1, hair); R(6, 1, 2, 1, hair); R(14, 1, 3, 1, hair); }
    if (st === 2) { R(10, 0, 4, 5, hair); R(9, 1, 6, 1, hair); R(7, 4, 10, 1, hair); }
    if (st === 3) { R(5, 2, 14, 4, hair); R(4, 5, 3, 14, hair); R(17, 5, 3, 14, hair); }
    if (st === 4) { R(6, 3, 12, 3, hair); R(9, 0, 6, 3, hair); R(5, 5, 2, 5, hair); R(17, 5, 2, 5, hair); }
    if (st === 5) { R(5, 2, 14, 4, hair); R(4, 5, 3, 9, hair); R(17, 5, 3, 9, hair); R(5, 6, 4, 1, hair); }
    // eyes (blink)
    const blink = ((Math.floor(t / 2600) + (face.style || 0)) % 4 === 0) && (t % 2600) < 140;
    if (blink) { R(8, 11, 3, 1, '#2a1a14'); R(13, 11, 3, 1, '#2a1a14'); }
    else { R(8, 10, 2, 2, '#ffffff'); R(13, 10, 2, 2, '#ffffff'); R(9, 10, 1, 2, '#1a1414'); R(14, 10, 1, 2, '#1a1414'); }
    R(8, 9, 3, 1, mix(hair, skin, 0.3)); R(13, 9, 3, 1, mix(hair, skin, 0.3));
    // nose & mouth
    R(11, 12, 1, 2, shade);
    R(10, 15, 4, 1, '#8a3a3a');
    // accessories
    if (face.acc === 'glasses') { R(7, 9, 4, 4, '#1a1a1a'); R(13, 9, 4, 4, '#1a1a1a'); R(8, 10, 2, 2, '#a8d8ff'); R(14, 10, 2, 2, '#a8d8ff'); R(11, 10, 2, 1, '#1a1a1a'); }
    if (face.acc === 'beard') { R(7, 14, 10, 4, hair); R(10, 15, 4, 1, '#8a3a3a'); R(8, 18, 8, 1, hair); }
    if (face.acc === 'cap') { R(5, 2, 14, 3, face.shirt); R(5, 5, 16, 1, mix(face.shirt, '#000000', 0.3)); }
    if (face.acc === 'earring') { R(5, 13, 1, 2, '#ffd84a'); }
    if (face.acc === 'headset') { R(4, 6, 16, 1, '#2a2a2a'); R(4, 6, 2, 8, '#2a2a2a'); R(3, 10, 3, 4, '#3a3a3a'); R(6, 15, 4, 1, '#3a3a3a'); }
  }
  const portraitCache = {};
  function portraitURL(face, size) {
    const k = JSON.stringify(face) + size;
    if (portraitCache[k]) return portraitCache[k];
    if (typeof document === 'undefined') return '';
    const c = document.createElement('canvas'); c.width = 24 * size; c.height = 24 * size;
    drawPortrait(c.getContext('2d'), face, 0, 0, size, 1);
    return (portraitCache[k] = c.toDataURL());
  }

  /* ---------------- apartment scene 320x180 ---------------- */
  function drawApartment(ctx, t, st) {
    st = st || {};
    const W = 320, H = 180;
    const night = st.night != null ? st.night : true;
    const week = st.week || 1;
    // wall
    for (let y = 0; y < 130; y++) rect(ctx, 0, y, W, 1, mix('#2a2440', '#1a1830', y / 130));
    // wallpaper stripes
    for (let x = 0; x < W; x += 16) rect(ctx, x, 0, 1, 130, 'rgba(255,255,255,0.03)');
    // floor
    for (let y = 130; y < H; y++) rect(ctx, 0, y, W, 1, mix('#3a2a22', '#22180f', (y - 130) / 50));
    for (let x = -20; x < W; x += 28) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + ((Math.floor((x + 20) / 28)) % 2) * 14, 130, 1, 50); }
    rect(ctx, 0, 128, W, 3, '#140f1a');
    // window
    const wx = 196, wy = 18, ww = 104, wh = 70;
    rect(ctx, wx - 4, wy - 4, ww + 8, wh + 8, '#4a3a2a');
    for (let y = 0; y < wh; y++) rect(ctx, wx, wy + y, ww, 1, night ? mix('#0c1030', '#2a1a48', y / wh) : mix('#7ab8f0', '#f0c8a0', y / wh));
    if (night) {
      for (let i = 0; i < 26; i++) { const sx = wx + Math.floor(hrand(i) * ww), sy = wy + Math.floor(hrand(i + 99) * 34); const tw = Math.sin(t / 400 + i) > 0.6; px(ctx, sx, sy, tw ? '#ffffff' : '#8a93c8'); }
      rect(ctx, wx + 74, wy + 8, 9, 9, '#f4f2d8'); rect(ctx, wx + 77, wy + 8, 6, 6, mix('#0c1030', '#2a1a48', 0.15));
    }
    // skyline
    for (let i = 0; i < 12; i++) {
      const bw = 6 + Math.floor(hrand(i * 3) * 10), bh = 16 + Math.floor(hrand(i * 7) * 34);
      const bx = wx + Math.floor(i * 9 - 2);
      rect(ctx, bx, wy + wh - bh, bw, bh, night ? '#121428' : '#5a6a88');
      for (let yy = wy + wh - bh + 3; yy < wy + wh - 2; yy += 4) for (let xx = bx + 1; xx < bx + bw - 1; xx += 3) {
        if (hrand(xx * 31 + yy * 7 + Math.floor(t / 4000)) < (night ? 0.35 : 0.08)) px(ctx, xx, yy, night ? '#ffd27a' : '#c8d8f0');
      }
    }
    // rain
    if (st.rain) { ctx.fillStyle = 'rgba(160,190,255,0.5)'; for (let i = 0; i < 40; i++) { const rx = wx + (hrand(i) * ww + t * 0.02 * (1 + hrand(i + 5))) % ww; const ry = wy + ((hrand(i + 40) * wh + t * 0.12) % wh); ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 3); } }
    // window frame
    rect(ctx, wx + ww / 2 - 1, wy, 2, wh, '#4a3a2a'); rect(ctx, wx, wy + wh / 2 - 1, ww, 2, '#4a3a2a');
    rect(ctx, wx - 6, wy + wh + 4, ww + 12, 4, '#5a4632');
    // plant on sill
    rect(ctx, wx + 6, wy + wh - 4, 8, 8, '#a8583a');
    for (let i = 0; i < 6; i++) { const a = -1.2 + i * 0.5 + Math.sin(t / 1400 + i) * 0.08; for (let k = 0; k < 7; k++) px(ctx, wx + 10 + Math.cos(a) * k * 0.9, wy + wh - 5 - Math.abs(Math.sin(a + 1.6)) * k, k > 4 ? '#7ad870' : '#3a9a4a'); }
    // poster
    rect(ctx, 26, 20, 40, 54, '#e9d9a8'); rect(ctx, 28, 22, 36, 40, '#1a1a2a');
    for (let i = 0; i < 18; i++) { const fx = 46 + Math.sin(i * 1.3) * 8 * (i / 18), fy = 58 - i * 2; px(ctx, fx, fy, i > 12 ? '#ffd84a' : '#ff8a2e'); px(ctx, fx + 1, fy, '#e8434b'); }
    text(ctx, 'HALCYON', 31, 65, '#3a2a1a');
    // calendar
    rect(ctx, 78, 26, 30, 30, '#f4f2ea'); rect(ctx, 78, 26, 30, 6, '#e8434b');
    for (let i = 0; i < 12; i++) { const cx = 80 + (i % 4) * 7, cy = 34 + Math.floor(i / 4) * 7; rect(ctx, cx, cy, 5, 5, i < week - 1 ? '#c4cad8' : (i === week - 1 ? '#ffd84a' : '#e0dccc')); if (i < week - 1) { px(ctx, cx + 1, cy + 1, '#e8434b'); px(ctx, cx + 3, cy + 3, '#e8434b'); px(ctx, cx + 2, cy + 2, '#e8434b'); px(ctx, cx + 3, cy + 1, '#e8434b'); px(ctx, cx + 1, cy + 3, '#e8434b'); } if ([3, 7, 11].includes(i)) rect(ctx, cx + 1, cy + 1, 3, 3, i === 11 ? '#b98cff' : '#5ed38a'); }
    // shelf with books
    rect(ctx, 122, 40, 56, 3, '#5a4632');
    const bookC = ['#e8434b', '#4a7cf0', '#5ed38a', '#ffd84a', '#b98cff', '#ff8a2e', '#c4cad8'];
    for (let i = 0; i < 11; i++) { const bh = 10 + (i * 7 % 5); rect(ctx, 124 + i * 4, 40 - bh, 3, bh, bookC[i % bookC.length]); }
    // little trophy count = reel shots
    const shots = Math.min(st.reel || 0, 8);
    for (let i = 0; i < shots; i++) { rect(ctx, 168 - i * 5, 34, 3, 6, '#ffd84a'); px(ctx, 169 - i * 5, 33, '#fff3a0'); }
    // desk
    rect(ctx, 40, 104, 150, 6, '#7a5a3a'); rect(ctx, 40, 110, 150, 2, '#4a3422');
    rect(ctx, 46, 112, 4, 20, '#4a3422'); rect(ctx, 180, 112, 4, 20, '#4a3422');
    // PC tower
    rect(ctx, 150, 76, 22, 28, '#1c1e28'); rect(ctx, 151, 77, 20, 26, '#262a38');
    for (let i = 0; i < 3; i++) { const on = Math.sin(t / 180 + i * 2) > 0; px(ctx, 154 + i * 3, 80, on ? '#5ed38a' : '#2a5a3a'); }
    rect(ctx, 153, 86, 16, 14, '#14161e');
    const fanA = t / 60;
    for (let k = 0; k < 4; k++) { const a = fanA + k * Math.PI / 2; px(ctx, 161 + Math.cos(a) * 4, 93 + Math.sin(a) * 4, st.gpuGlow ? '#5ee0ff' : '#ff7ab8'); }
    // monitors
    const mons = st.monitors || 1;
    const drawMon = (mx, my, mw, mh) => {
      rect(ctx, mx - 2, my - 2, mw + 4, mh + 4, '#14161e');
      rect(ctx, mx, my, mw, mh, '#0e1424');
      // node graph on screen
      const nodes = [[6, 8], [18, 8], [30, 8], [18, 20], [30, 20], [42, 14]];
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i], b = nodes[i + 1];
        const steps = 12;
        for (let k = 0; k < steps; k++) { const f = k / steps; px(ctx, mx + a[0] + (b[0] - a[0]) * f + 3, my + a[1] + (b[1] - a[1]) * f + 2, '#2a4a6a'); }
      }
      nodes.forEach((n, i) => { if (n[0] + 8 > mw) return; rect(ctx, mx + n[0], my + n[1], 7, 4, ['#f08a3c', '#4f9cf0', '#a876f0', '#9aa7b8', '#e86fa3', '#5ed38a'][i]); });
      // travelling pulse
      const pi = Math.floor(t / 300) % nodes.length; const pn = nodes[pi]; if (pn[0] + 8 <= mw) rect(ctx, mx + pn[0] + 2, my + pn[1] + 1, 3, 2, '#ffffff');
      rect(ctx, mx + mw / 2 - 3, my + mh + 2, 6, 6, '#14161e'); rect(ctx, mx + mw / 2 - 8, my + mh + 7, 16, 2, '#14161e');
    };
    drawMon(70, 72, 52, 26);
    if (mons > 1) drawMon(126, 78, 22, 18);
    // screen glow on wall
    ctx.fillStyle = 'rgba(80,140,255,0.06)'; ctx.fillRect(56, 60, 90, 50);
    // keyboard & mug
    rect(ctx, 76, 101, 40, 3, '#3a3e4c'); for (let i = 0; i < 9; i++) px(ctx, 78 + i * 4, 102, '#5a6378');
    rect(ctx, 124, 96, 7, 8, '#f4f2ea'); rect(ctx, 131, 98, 2, 4, '#f4f2ea'); rect(ctx, 125, 97, 5, 2, '#5a3a22');
    for (let i = 0; i < 4; i++) { const sy = 92 - ((t / 90 + i * 5) % 14); px(ctx, 126 + Math.sin(t / 300 + i) * 1.5, sy, 'rgba(255,255,255,0.35)'); }
    // lamp
    rect(ctx, 52, 82, 2, 22, '#2a2a2a'); rect(ctx, 46, 78, 14, 6, '#ffd84a'); ctx.fillStyle = 'rgba(255,216,74,0.07)'; ctx.beginPath(); ctx.moveTo(46, 84); ctx.lineTo(30, 130); ctx.lineTo(80, 130); ctx.lineTo(60, 84); ctx.fill();
    // chair
    rect(ctx, 92, 112, 26, 4, '#2a2a3a'); rect(ctx, 104, 116, 3, 12, '#1a1a24'); rect(ctx, 96, 127, 18, 2, '#1a1a24'); rect(ctx, 114, 90, 4, 24, '#2a2a3a');
    // bed corner
    rect(ctx, 236, 112, 84, 20, '#3a4a7a'); rect(ctx, 236, 108, 84, 6, '#e8e4d8'); rect(ctx, 290, 102, 26, 8, '#f4f2ea');
    // cat (Pip) on the desk or bed
    const catX = st.catOnDesk ? 136 : 262, catY = st.catOnDesk ? 101 : 116;
    drawCat(ctx, catX, catY, t, st.catOnDesk);
    // boxes if evicting
    if (st.moving) { rect(ctx, 200, 112, 26, 18, '#a8784a'); rect(ctx, 200, 118, 26, 2, '#5a3a22'); rect(ctx, 206, 98, 18, 14, '#b88858'); }
    // vignette
    const g = ctx.createRadialGradient(160, 90, 40, 160, 90, 200); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawCat(ctx, x, y, t, awake) {
    const k = '#1c1c24';
    const breathe = Math.sin(t / 600) > 0 ? 1 : 0;
    rect(ctx, x, y - 4 - breathe, 14, 6 + breathe, k);
    rect(ctx, x + 10, y - 8, 7, 6, k); rect(ctx, x + 10, y - 10, 2, 2, k); rect(ctx, x + 15, y - 10, 2, 2, k);
    rect(ctx, x + 1, y - 5 - breathe, 9, 1, '#4a4a60'); rect(ctx, x + 11, y - 9, 5, 1, '#4a4a60'); px(ctx, x + 10, y - 11, '#5a5a70'); px(ctx, x + 16, y - 11, '#5a5a70'); px(ctx, x + 11, y - 9, '#ff7ab8'); px(ctx, x + 16, y - 9, '#ff7ab8');
    if (awake || Math.sin(t / 3000) > 0.7) { px(ctx, x + 12, y - 6, '#ffd84a'); px(ctx, x + 15, y - 6, '#ffd84a'); }
    else { px(ctx, x + 12, y - 6, '#3a3a4a'); px(ctx, x + 15, y - 6, '#3a3a4a'); }
    const ta = Math.sin(t / 400) * 2;
    rect(ctx, x - 3, y - 2 + ta * 0.5, 4, 2, k); rect(ctx, x - 5, y - 4 + ta, 2, 3, k);
    if (!awake && Math.sin(t / 3000) <= 0.7) { const zz = (t / 800) % 3; text(ctx, 'Z', x + 18 + zz * 2, y - 14 - zz * 3, 'rgba(255,255,255,' + (0.6 - zz * 0.18) + ')'); }
  }

  /* ---------------- title logo ---------------- */
  function drawTitle(ctx, t) {
    const W = 320, H = 180;
    for (let y = 0; y < H; y++) rect(ctx, 0, y, W, 1, mix('#0b0d1e', '#2a1438', y / H));
    // starfield + grid floor
    for (let i = 0; i < 60; i++) px(ctx, (hrand(i) * W + t * 0.004 * (i % 3 + 1)) % W, hrand(i + 7) * 90, i % 5 ? '#4a5090' : '#ffffff');
    ctx.strokeStyle = 'rgba(255,120,200,0.25)';
    for (let i = 0; i < 12; i++) { const y = 110 + Math.pow(i / 12, 2) * 70 + ((t / 60) % 6) * (i / 12); rect(ctx, 0, Math.floor(y), W, 1, 'rgba(255,120,200,' + (0.08 + i * 0.015) + ')'); }
    for (let i = -10; i <= 10; i++) { for (let k = 0; k < 70; k++) { const yy = 110 + k; const xx = 160 + i * (6 + k * 0.9); px(ctx, xx, yy, 'rgba(255,120,200,0.12)'); } }
    // sun
    for (let y = 0; y < 40; y++) { if (y % 6 > 3 && y > 18) continue; const w = Math.sqrt(40 * 40 - (y - 40) * (y - 40)); rect(ctx, 160 - w, 70 + y, w * 2, 1, mix('#ffd84a', '#ff4a8a', y / 40)); }
    // logo letters big (scale 5)
    const s = 5;
    const str = 'NODE ROGUE';
    const w = textW(str, s);
    const x0 = Math.floor((W - w) / 2), y0 = 28;
    text(ctx, str, x0 + 2, y0 + 2, '#2a0a2a', s);
    text(ctx, str, x0, y0, '#ffffff', s);
    // flicker sparkles from letters
    for (let i = 0; i < 24; i++) { const ph = (t / 900 + hrand(i)) % 1; px(ctx, x0 + hrand(i + 3) * w, y0 + 25 + ph * 30, mix('#ffd84a', '#ff4a8a', ph)); }
    text(ctx, 'A VFX SURVIVAL ROGUELITE', Math.floor((W - textW('A VFX SURVIVAL ROGUELITE', 1)) / 2), 62, '#ffb8e0', 1);
    // little nodes travelling
    const nx = [40, 90, 140, 180, 230, 280];
    for (let i = 0; i < nx.length - 1; i++) rect(ctx, nx[i] + 8, 159, nx[i + 1] - nx[i] - 8, 1, '#5a4a8a');
    nx.forEach((x, i) => { rect(ctx, x, 155, 8, 8, ['#9aa7b8', '#c79a5a', '#f08a3c', '#4f9cf0', '#a876f0', '#ffd84a'][i]); });
    const pp = (t / 900) % (nx.length - 1); const pi = Math.floor(pp); const pf = pp - pi;
    rect(ctx, nx[pi] + 8 + (nx[pi + 1] - nx[pi] - 8) * pf, 158, 3, 3, '#ffffff');
    drawCat(ctx, 280, 150, t, true);
  }

  /* ---------------- shot viewport 160x90 ---------------- */
  // look: snapshot of stream (see engine snapshotLook) ; opts: {t, glitch, inst, flash}
  function drawShot(ctx, look, opts) {
    opts = opts || {};
    const t = opts.t || 0;
    const W = 160, H = 90;
    if (!look) {
      rect(ctx, 0, 0, W, H, '#0b0d14');
      for (let i = 0; i < 40; i++) px(ctx, hrand(i + Math.floor(t / 120)) * W, hrand(i * 3 + Math.floor(t / 120)) * H, '#1a1e2c');
      text(ctx, 'NO SIGNAL', 62, 42, '#5a6378');
      return;
    }
    const st = look.stars || {};
    const lit = look.lit, night = look.night;
    const grey = !lit;
    // ---------- background ----------
    if (look.onPlate || look.plate) {
      // plate: photographic sky & field with film feel
      for (let y = 0; y < 60; y++) rect(ctx, 0, y, W, 1, night ? mix('#0a1430', '#24305a', y / 60) : mix('#7ab0d8', '#e8d0a8', y / 60));
      for (let y = 60; y < H; y++) rect(ctx, 0, y, W, 1, night ? mix('#101810', '#060a06', (y - 60) / 30) : mix('#5a7a3a', '#3a4a22', (y - 60) / 30));
      for (let i = 0; i < 8; i++) { const tx = hrand(i) * W; rect(ctx, tx, 46 - hrand(i + 3) * 10, 3, 16, night ? '#0a120a' : '#2a3a1a'); rect(ctx, tx - 3, 40 - hrand(i + 3) * 10, 9, 9, night ? '#0e1a0e' : '#3a5a2a'); }
    } else if (night) {
      for (let y = 0; y < H; y++) rect(ctx, 0, y, W, 1, mix('#060a1e', '#1a1440', y / H));
      for (let i = 0; i < 30; i++) px(ctx, hrand(i) * W, hrand(i + 50) * 50, Math.sin(t / 300 + i) > 0.5 ? '#ffffff' : '#6a70a8');
      rect(ctx, 128, 10, 10, 10, '#f4f2d8'); rect(ctx, 131, 10, 7, 7, '#0a0e24');
    } else if (grey) {
      for (let y = 0; y < H; y++) rect(ctx, 0, y, W, 1, mix('#6a6e78', '#3a3e48', y / H));
      for (let x = 0; x < W; x += 10) rect(ctx, x, 62, 1, 28, 'rgba(0,0,0,0.12)');
      rect(ctx, 0, 62, W, 1, 'rgba(0,0,0,0.25)');
    } else {
      for (let y = 0; y < H; y++) rect(ctx, 0, y, W, 1, look.stylized ? mix('#ffb8e0', '#8ad8ff', y / H) : mix('#3a5a8a', '#d8a878', y / H));
    }
    if (look.env) {
      const c1 = grey ? '#50545e' : (night ? '#141a30' : '#4a5a7a'), c2 = grey ? '#44484f' : (night ? '#0c1222' : '#3a4a3a');
      for (let x = 0; x < W; x++) { const h1 = 20 + Math.sin(x * 0.07) * 8 + Math.sin(x * 0.19) * 4; rect(ctx, x, 62 - h1, 1, h1, c1); const h2 = 10 + Math.sin(x * 0.11 + 2) * 5; rect(ctx, x, 66 - h2, 1, h2 + 24, c2); }
    }
    // sky dressing: sun + drifting clouds on lit day shots
    if (lit && !night && !look.plate && !look.onPlate) {
      const sg = ctx.createRadialGradient(30, 22, 1, 30, 22, 26); sg.addColorStop(0, 'rgba(255,240,200,0.9)'); sg.addColorStop(0.3, 'rgba(255,220,160,0.35)'); sg.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, 70, 60);
      for (let i = 0; i < 4; i++) {
        const cxl = ((hrand(i) * 200 + t * 0.004 * (1 + i * 0.3)) % 200) - 30, cyl = 8 + i * 7;
        for (let k = 0; k < 6; k++) rect(ctx, cxl + k * 4, cyl - (k % 3 === 1 ? 2 : 0), 7, 3, look.stylized ? 'rgba(255,255,255,0.85)' : 'rgba(255,245,235,0.32)');
      }
    }
    // ground
    if (!look.onPlate && !look.plate) {
      rect(ctx, 0, 66, W, 24, grey ? '#4a4e58' : (night ? '#0e1020' : (look.stylized ? '#7ad870' : '#5a4a3a')));
      if (!grey) for (let i = 0; i < 40; i++) px(ctx, hrand(i + 70) * W, 67 + hrand(i + 90) * 22, night ? '#1a1c34' : (look.stylized ? '#a8f090' : '#6a5a46'));
    }
    // contact shadow
    if (lit && look.model) { ctx.fillStyle = night ? 'rgba(0,0,10,0.45)' : 'rgba(20,10,0,0.35)'; ctx.beginPath(); ctx.ellipse(80 + 6, 66, 26, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    const shake = (st.destr || 0) > 0 ? Math.round(Math.sin(t / 40) * Math.min(2, st.destr * 0.4)) : 0;
    // ---------- model ----------
    const cx = 80 + shake, cy = 64;
    const baseCol = grey ? '#8a8e98' : (look.tex ? (look.stylized ? '#ff7ab8' : (look.organic ? '#7a9a5a' : (look.hard ? '#8a98b0' : '#b0885a'))) : '#9a9ea8');
    const shadeCol = mix(baseCol, '#000000', lit ? 0.45 : 0.15);
    const hiCol = mix(baseCol, '#ffffff', lit ? 0.35 : 0.08);
    const outline = look.stylized ? '#1a1020' : null;
    const destr = st.destr || 0;
    const crumble = destr > 0 ? Math.min(1, destr / 5) : 0;
    if (look.model === 'organic' || st.creature) {
      const walk = look.anim || (st.creature || 0) >= 2 ? Math.sin(t / 160) : 0;
      const bob = Math.round(Math.abs(walk) * 2);
      // body
      ctx.fillStyle = baseCol; ctx.beginPath(); ctx.ellipse(cx, cy - 14 - bob, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shadeCol; ctx.fillRect(cx - 16, cy - 10 - bob, 32, 6);
      // head
      ctx.fillStyle = baseCol; ctx.beginPath(); ctx.ellipse(cx + 18, cy - 26 - bob, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
      rect(ctx, cx + 20, cy - 29 - bob, 2, 2, (st.creature || 0) >= 1 ? '#ffd84a' : '#222');
      rect(ctx, cx + 24, cy - 29 - bob, 2, 2, (st.creature || 0) >= 1 ? '#ffd84a' : '#222');
      rect(ctx, cx + 19, cy - 22 - bob, 8, 1, '#2a0a0a');
      // legs
      for (let i = 0; i < 4; i++) { const lx = cx - 12 + i * 8; const ph = walk * (i % 2 ? 1 : -1) * 3; rect(ctx, lx + ph, cy - 6 - bob, 4, 8 + bob, shadeCol); }
      if (lit) rect(ctx, cx - 10, cy - 24 - bob, 14, 2, hiCol);
      // groom fur
      if ((st.creature || 0) >= 4) for (let i = 0; i < 40; i++) { const a = hrand(i) * Math.PI; px(ctx, cx + Math.cos(a) * 18 * hrand(i + 1), cy - 14 - bob - Math.sin(a) * 13, mix(baseCol, '#ffffff', 0.3 + 0.3 * Math.sin(t / 200 + i))); }
      // cloth cape
      if ((st.creature || 0) >= 3) { for (let i = 0; i < 14; i++) { const wv = Math.sin(t / 150 + i * 0.5) * 2; rect(ctx, cx - 18 - i, cy - 22 - bob + i * 0.8 + wv, 2, 5, grey ? '#6a6e78' : '#c83a4a'); } }
      if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy - 14 - bob, 18, 12, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (look.model === 'hard' || look.model === 'scan') {
      // tower / building, crumbling with destruction
      const bw = 26, bh = 42;
      for (let y = 0; y < bh; y++) {
        const row = cy - y;
        for (let x = 0; x < bw; x++) {
          const gx = cx - bw / 2 + x;
          const hole = crumble > 0 && hrand(x * 13 + y * 7) < crumble * 0.55 && y > bh * (1 - crumble);
          if (hole) continue;
          let c = x < 4 ? shadeCol : (x > bw - 5 ? mix(baseCol, '#000000', 0.25) : baseCol);
          if (look.tex && y % 6 === 0) c = mix(c, '#000000', 0.2);
          if (look.tex && (x % 6 === 2) && (y % 6 > 1 && y % 6 < 5)) c = night ? (hrand(x + y) > 0.4 ? '#ffd27a' : '#1a2030') : '#2a3a5a';
          if (lit && x === 5) c = hiCol;
          px(ctx, gx, row, c);
        }
      }
      if (look.model === 'scan') { for (let i = 0; i < 20; i++) px(ctx, cx - 13 + hrand(i) * 26, cy - hrand(i + 9) * 42, mix(baseCol, '#3a2a1a', 0.5)); }
      if (outline) { ctx.strokeStyle = outline; ctx.strokeRect(cx - bw / 2 - 0.5, cy - bh - 0.5, bw + 1, bh + 1); }
    } else if (look.model === 'env') {
      // a big rock arch on terrain
      for (let x = -24; x <= 24; x++) { const h = 26 - Math.abs(x) * 0.6 + Math.sin(x * 0.6) * 2; const col = x < -10 ? shadeCol : (x > 12 ? mix(baseCol, '#000', 0.2) : baseCol); rect(ctx, cx + x, cy - h, 1, h, col); }
      for (let x = -8; x <= 8; x++) { const h = 12 - Math.abs(x) * 0.9; rect(ctx, cx + x, cy - h, 1, h, grey ? '#4a4e58' : '#2a2030'); }
      if (look.tex) for (let i = 0; i < 30; i++) px(ctx, cx - 22 + hrand(i) * 44, cy - 4 - hrand(i + 3) * 20, '#5a8a3a');
    } else if (look.model === 'box' || (!look.model && !look.plate)) {
      // iso cube
      const s = 16;
      for (let y = 0; y < s; y++) { rect(ctx, cx - s, cy - s + y - 6, s, 1, shadeCol); rect(ctx, cx, cy - s + y - 6, s, 1, baseCol); }
      for (let i = 0; i < s; i++) { rect(ctx, cx - s + i, cy - s - 6 - Math.floor(i / 2), 1, Math.floor(i / 2) + 1, hiCol); rect(ctx, cx + s - 1 - i, cy - s - 6 - Math.floor(i / 2), 1, Math.floor(i / 2) + 1, hiCol); }
      if (look.tex && !grey) for (let i = 0; i < 6; i++) rect(ctx, cx - s + 2 + i * 5, cy - 14, 2, 8, mix(baseCol, '#ffffff', 0.25));
      if (outline) { ctx.strokeStyle = outline; ctx.strokeRect(cx - s - 0.5, cy - s - 6.5, s * 2 + 1, s + 1); }
    }
    // ---------- FX layers ----------
    const q = (v) => Math.max(0, v);
    // destruction: debris chunks
    if (destr > 0) {
      const n = Math.floor(8 + destr * 14);
      for (let i = 0; i < n; i++) {
        const life = ((t / 1000) * (0.6 + hrand(i) * 0.8) + hrand(i + 11)) % 1;
        const vx = (hrand(i + 2) - 0.5) * 80, vy = -40 - hrand(i + 3) * 50;
        const x = cx + vx * life, y = cy - 30 + vy * life + 90 * life * life;
        const sz = destr >= 3 ? (hrand(i + 4) < 0.3 ? 2 : 1) : 2;
        rect(ctx, x, y, sz, sz, grey ? '#7a7e88' : mix('#8a7a6a', '#c4b49a', hrand(i)));
      }
      if (look.smoke || destr >= 4) {
        for (let i = 0; i < 26 + destr * 6; i++) {
          const life = ((t / 2200) + hrand(i + 50)) % 1;
          const x = cx + (hrand(i) - 0.5) * 70 * (0.4 + life), y = cy - 4 - life * 40;
          const r = 2 + life * 6;
          ctx.fillStyle = grey ? 'rgba(160,160,170,' + (0.35 * (1 - life)) + ')' : 'rgba(' + (night ? '90,90,110' : '170,150,130') + ',' + (0.4 * (1 - life)) + ')';
          ctx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), Math.round(r), Math.round(r));
        }
      }
    }
    // fire
    const fire = st.fire || 0;
    if (fire > 0) {
      const n = Math.floor(30 + fire * 45);
      const fx0 = cx, fy0 = cy - 8;
      for (let i = 0; i < n; i++) {
        const life = ((t / 700) * (0.7 + hrand(i) * 0.6) + hrand(i + 7)) % 1;
        const spread = 10 + fire * 6;
        const x = fx0 + (hrand(i + 1) - 0.5) * spread * (1 - life * 0.5) + Math.sin(t / 120 + i) * fire * 0.6 * life;
        const y = fy0 - life * (14 + fire * 9);
        const c = grey ? mix('#d8d8d8', '#6a6e78', life) : (life < 0.25 ? '#fff3a0' : (life < 0.5 ? '#ffd84a' : (life < 0.75 ? '#ff8a2e' : '#c8381c')));
        const sz = fire >= 4 ? 1 : 2;
        rect(ctx, x, y, sz, sz, c);
      }
      if (look.smoke || fire >= 3) {
        for (let i = 0; i < 20 + fire * 6; i++) { const life = ((t / 2600) + hrand(i + 300)) % 1; const x = fx0 + (hrand(i + 30) - 0.5) * 30 + life * 14; const y = fy0 - 30 - fire * 6 - life * 30; const r = 3 + life * 5; ctx.fillStyle = 'rgba(' + (grey ? '150,150,160' : '60,52,56') + ',' + (0.5 * (1 - life)) + ')'; ctx.fillRect(Math.round(x), Math.round(y), Math.round(r), Math.round(r)); }
      }
      if (lit && !grey) { const gl = ctx.createRadialGradient(fx0, fy0 - 10, 2, fx0, fy0 - 10, 30 + fire * 8); gl.addColorStop(0, 'rgba(255,140,40,' + (0.18 + fire * 0.04) + ')'); gl.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H); }
      // embers
      if (fire >= 4) for (let i = 0; i < 20; i++) { const life = ((t / 1500) + hrand(i + 900)) % 1; px(ctx, fx0 + (hrand(i) - 0.5) * 80 + life * 10, fy0 - life * 70, '#ffd84a'); }
    }
    // water
    const water = st.water || 0;
    if (water > 0) {
      const level = 70 - water * 3;
      for (let x = 0; x < W; x++) {
        const wv = Math.sin(x * 0.12 + t / 260) * (1 + water * 0.6) + Math.sin(x * 0.31 - t / 170) * water * 0.4;
        const top = Math.round(level + wv);
        rect(ctx, x, top, 1, H - top, grey ? '#6a7480' : (night ? '#14305a' : '#2a7ac8'));
        px(ctx, x, top, grey ? '#9aa4b0' : '#8ad8ff');
        if (water >= 4 && (x + Math.floor(t / 60)) % 7 === 0) px(ctx, x, top + 3, 'rgba(255,255,255,0.6)');
      }
      // big wave crest
      if (water >= 2) {
        const crestX = ((t / 22) % (W + 60)) - 30;
        for (let i = 0; i < 18 + water * 6; i++) { const a = i / (18 + water * 6) * Math.PI; const r = 10 + water * 4; rect(ctx, crestX + Math.cos(a) * r, level - Math.sin(a) * r, 2, 2, grey ? '#8a94a0' : '#3a9ae8'); }
      }
      if (water >= 3) for (let i = 0; i < 30 + water * 10; i++) { const life = ((t / 600) + hrand(i + 40)) % 1; const x = (hrand(i) * W); const y = level - 2 - life * 20 + life * life * 22; px(ctx, x, y, 'rgba(255,255,255,' + (1 - life) + ')'); }
    }
    // magic
    const magic = st.magic || 0;
    if (magic > 0) {
      const n = Math.floor(14 + magic * 16);
      for (let i = 0; i < n; i++) {
        const a = t / (500 + hrand(i) * 400) + hrand(i) * 6.28;
        const r = 10 + hrand(i + 2) * (10 + magic * 6);
        const x = cx + Math.cos(a) * r, y = cy - 22 + Math.sin(a) * r * 0.5;
        const c = grey ? '#c4c8d0' : (i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? '#b98cff' : '#5ee0ff'));
        rect(ctx, x, y, 1, 1, c);
        if (magic >= 3) { for (let k = 1; k < 4; k++) { const aa = a - k * 0.06; px(ctx, cx + Math.cos(aa) * r, cy - 22 + Math.sin(aa) * r * 0.5, grey ? 'rgba(200,200,210,0.3)' : 'rgba(185,140,255,' + (0.5 - k * 0.12) + ')'); } }
      }
      if (magic >= 4 && !grey) { const gl = ctx.createRadialGradient(cx, cy - 22, 1, cx, cy - 22, 40); gl.addColorStop(0, 'rgba(185,140,255,0.35)'); gl.addColorStop(1, 'rgba(185,140,255,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H); }
    }
    // ---------- lighting ----------
    if (lit && !grey) {
      const lg = ctx.createLinearGradient(0, 0, W, H);
      lg.addColorStop(0, night ? 'rgba(80,120,255,0.10)' : 'rgba(255,230,180,0.10)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    }
    if (night) { ctx.fillStyle = 'rgba(10,20,60,0.22)'; ctx.fillRect(0, 0, W, H); }
    // ---------- comp ----------
    if (look.final) {
      // grade
      const pol = look.polish || 0;
      ctx.fillStyle = look.stylized ? 'rgba(255,80,180,0.06)' : (night ? 'rgba(0,40,80,0.10)' : 'rgba(255,160,60,' + Math.min(0.12, 0.03 * pol) + ')');
      ctx.fillRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(80, 45, 30, 80, 45, 95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + Math.min(0.55, 0.2 + pol * 0.05) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      rect(ctx, 0, 0, W, 8, '#000'); rect(ctx, 0, H - 8, W, 8, '#000');
    }
    // anamorphic flare on hot elements when the shot is finished and polished
    if (look.final && (look.polish || 0) >= 2 && (fire >= 2 || magic >= 2)) {
      const fy = fire >= 2 ? cy - 22 : cy - 22, pulse = 0.5 + 0.5 * Math.sin(t / 380);
      ctx.fillStyle = 'rgba(' + (fire >= magic ? '255,190,110' : '190,160,255') + ',' + (0.18 + pulse * 0.12) + ')';
      ctx.fillRect(0, Math.round(fy), W, 1);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + pulse * 0.2) + ')'; ctx.fillRect(cx - 1, Math.round(fy) - 1, 3, 3);
      for (let i = 1; i <= 3; i++) { ctx.fillStyle = 'rgba(120,200,255,' + (0.12 / i) + ')'; ctx.fillRect(cx + (80 - cx) * 0.6 * i - 2, fy + (45 - fy) * 0.6 * i - 2, 4, 4); }
    }
    if (look.grain) {
      for (let i = 0; i < 260; i++) { const g = hrand(i + Math.floor(t / 50) * 977); px(ctx, hrand(i * 7 + Math.floor(t / 50)) * W, g * H, g > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)'); }
    }
    // ---------- slates ----------
    if (!lit) { rect(ctx, 2, 2, 40, 9, 'rgba(0,0,0,0.55)'); text(ctx, 'PLAYBLAST', 4, 4, '#ffd84a'); }
    else if (!look.final) { rect(ctx, 2, 2, 28, 9, 'rgba(0,0,0,0.55)'); text(ctx, 'RENDER', 4, 4, '#5ee0ff'); }
    if (look.dead || opts.glitch) {
      const gi = opts.glitch || 1;
      for (let i = 0; i < 30 * gi; i++) { const gx = hrand(i + Math.floor(t / 40)) * W, gy = hrand(i * 3 + Math.floor(t / 40)) * H; rect(ctx, gx, gy, 4 + hrand(i) * 20, 2, ['#ff00ff', '#00ffff', '#ffffff', '#000000'][i % 4]); }
      if (look.dead) { rect(ctx, 48, 36, 64, 16, '#000'); text(ctx, 'NAN NAN NAN', 59, 41, '#ff3a5a'); }
    }
    if (opts.flash) { ctx.fillStyle = 'rgba(255,255,255,' + opts.flash + ')'; ctx.fillRect(0, 0, W, H); }
  }

  /* ---------------- sim viewer (live solver) 160x90 ---------------- */
  function drawSim(ctx, sims, t) {
    // sims: [{el, f, detail, inst, diverged, done}] — draws all active sims overlaid
    const W = 160, H = 90;
    rect(ctx, 0, 0, W, H, '#10131c');
    for (let x = 0; x < W; x += 10) rect(ctx, x, 0, 1, H, '#161a26');
    for (let y = 0; y < H; y += 10) rect(ctx, 0, y, W, 1, '#161a26');
    sims.forEach((s, si) => {
      const ox = (si + 0.5) * (W / sims.length);
      const d = s.detail / 30;
      const jitter = s.inst / 100;
      const n = Math.floor(20 + s.detail * 1.6);
      const col = { fire: ['#fff3a0', '#ffd84a', '#ff8a2e', '#c8381c'], water: ['#ffffff', '#8ad8ff', '#3a9ae8', '#1a5aa8'], destr: ['#e8dcc8', '#c4b49a', '#8a7a6a', '#5a4a3a'], creature: ['#ffd0e8', '#ff7ab8', '#c83a78', '#7a1a48'], magic: ['#ffffff', '#d8c0ff', '#b98cff', '#5ee0ff'] }[s.el] || ['#fff', '#ccc', '#888', '#444'];
      for (let i = 0; i < n; i++) {
        const life = ((s.f / 48) * 3 + hrand(i)) % 1;
        let x = ox + (hrand(i + 1) - 0.5) * (14 + d * 8), y = 80 - life * (30 + d * 8);
        if (s.el === 'water') { x = ox + (hrand(i + 1) - 0.5) * 50; y = 70 - Math.abs(Math.sin(hrand(i) * 6 + s.f / 6)) * (8 + d * 4) - life * 6; }
        if (s.el === 'destr') { x = ox + (hrand(i + 1) - 0.5) * life * 70; y = 70 - life * 30 + life * life * 40; }
        if (s.el === 'magic' || s.el === 'creature') { const a = s.f / 8 + hrand(i) * 6.28; x = ox + Math.cos(a) * (6 + hrand(i + 3) * 20); y = 50 + Math.sin(a) * (6 + hrand(i + 3) * 14); }
        x += (hrand(i + s.f * 13) - 0.5) * jitter * jitter * 40;
        y += (hrand(i * 7 + s.f * 5) - 0.5) * jitter * jitter * 30;
        rect(ctx, x, y, 1, 1, col[Math.min(3, Math.floor(life * 4))]);
      }
      if (s.diverged) { for (let i = 0; i < 40; i++) rect(ctx, ox - 30 + hrand(i + t) * 60, hrand(i * 3 + t) * H, 2 + hrand(i) * 10, 1, ['#ff00ff', '#00ffff', '#ffffff'][i % 3]); text(ctx, 'NAN', ox - 6, 40, '#ff3a5a'); }
      else if (s.done) { text(ctx, 'CACHED', ox - 12, 10, '#5ed38a'); }
    });
    text(ctx, 'SIM', 3, 3, '#5a6378');
  }

  /* ---------------- endings ---------------- */
  function drawEnding(ctx, id, t) {
    const W = 320, H = 180;
    if (id === 'evicted') {
      for (let y = 0; y < H; y++) rect(ctx, 0, y, W, 1, mix('#0a0c18', '#1a1a2e', y / H));
      for (let i = 0; i < 8; i++) { const bx = i * 42, bh = 60 + hrand(i) * 50; rect(ctx, bx, 130 - bh, 38, bh, '#141628'); for (let yy = 135 - bh; yy < 126; yy += 6) for (let xx = bx + 3; xx < bx + 34; xx += 6) if (hrand(xx + yy) < 0.25) rect(ctx, xx, yy, 2, 3, '#ffd27a'); }
      rect(ctx, 0, 130, W, 50, '#22242e'); rect(ctx, 0, 130, W, 2, '#3a3c48');
      // street lamp
      rect(ctx, 220, 60, 3, 72, '#3a3c48'); rect(ctx, 212, 58, 18, 4, '#3a3c48'); const lg = ctx.createRadialGradient(221, 64, 2, 221, 100, 60); lg.addColorStop(0, 'rgba(255,220,140,0.35)'); lg.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = lg; ctx.fillRect(160, 60, 120, 120);
      // PC tower on pavement, cat on top
      rect(ctx, 200, 108, 20, 26, '#1c1e28'); rect(ctx, 202, 112, 16, 2, '#5ed38a');
      drawCat(ctx, 203, 108, t, true);
      rect(ctx, 228, 120, 26, 14, '#a8784a'); rect(ctx, 228, 126, 26, 2, '#5a3a22');
      // rain
      ctx.fillStyle = 'rgba(160,190,255,0.35)'; for (let i = 0; i < 90; i++) { const rx = (hrand(i) * W + t * 0.03) % W; const ry = (hrand(i + 40) * H + t * 0.2) % H; ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 4); }
      return;
    }
    if (id === 'dream') {
      for (let y = 0; y < H; y++) rect(ctx, 0, y, W, 1, mix('#2a1a10', '#0e0a08', y / H));
      // lobby: marble floor, poster, light beams
      rect(ctx, 0, 130, W, 50, '#d8ccb0'); for (let x = 0; x < W; x += 20) rect(ctx, x, 130, 1, 50, '#b8ac90');
      rect(ctx, 110, 16, 100, 100, '#e9d9a8'); rect(ctx, 114, 20, 92, 80, '#0e0a1a');
      // poster fire/creature
      for (let i = 0; i < 160; i++) { const life = ((t / 900) + hrand(i)) % 1; px(ctx, 160 + (hrand(i + 1) - 0.5) * 50 * (1 - life * 0.4), 92 - life * 66, life < 0.3 ? '#fff3a0' : (life < 0.6 ? '#ff8a2e' : '#c8381c')); }
      text(ctx, 'HALCYON', 160 - textW('HALCYON', 2) / 2, 103, '#3a2a1a', 2);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(255,230,170,0.06)'; ctx.beginPath(); ctx.moveTo(40 + i * 60, 0); ctx.lineTo(20 + i * 60 + 30, 180); ctx.lineTo(60 + i * 60 + 30, 180); ctx.lineTo(60 + i * 60, 0); ctx.fill(); }
      // you + cat
      rect(ctx, 236, 140, 8, 20, '#3a4a6b'); rect(ctx, 236, 132, 8, 8, '#e8b48e'); rect(ctx, 236, 130, 8, 3, '#2b1d16'); rect(ctx, 237, 160, 2, 4, '#1a1a24'); rect(ctx, 241, 160, 2, 4, '#1a1a24'); rect(ctx, 244, 142, 3, 7, '#3a4a6b');
      drawCat(ctx, 252, 163, t, true);
      rect(ctx, 0, 164, W, 16, 'rgba(0,0,0,0.08)');
      // confetti
      for (let i = 0; i < 50; i++) { const y = ((t / 20) * (0.5 + hrand(i)) + hrand(i + 3) * H) % H; px(ctx, hrand(i + 9) * W + Math.sin(t / 300 + i) * 3, y, ['#ffd84a', '#ff7ab8', '#5ee0ff', '#5ed38a'][i % 4]); }
      return;
    }
    // mid endings: apartment by day, calm
    drawApartment(ctx, t, { night: false, week: 12, reel: 6, catOnDesk: true });
    if (id === 'offer_kiln' || id === 'offer_northlight') {
      rect(ctx, 96, 60, 40, 14, '#f4f2ea'); text(ctx, 'OFFER', 105, 64, '#e8434b');
    }
  }

  global.VFXArt = { P, DEPT_COLORS, ICONS, FONT, text, textW, drawIcon, iconURL, drawPortrait, portraitURL, drawApartment, drawCat, drawTitle, drawShot, drawSim, drawEnding, mix, hrand };
})(typeof window !== 'undefined' ? window : globalThis);
