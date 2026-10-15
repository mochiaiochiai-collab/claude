'use strict';

// 家族まとめ占い：四柱推命（年柱・月柱・日柱）と西洋占星術（太陽星座・月星座）を組み合わせる。
// 生まれた時刻は使わへんので、時柱・アセンダントは出さず、月星座は日本時間の正午で計算する。

(function (root) {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 暦の計算 ----------

  // グレゴリオ暦の日付 → ユリウス通日（その日の正午UT）
  function jdn(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  function parseDigits(digits) {
    if (!/^\d{8}$/.test(digits)) return null;
    const y = Number(digits.slice(0, 4)), m = Number(digits.slice(4, 6)), d = Number(digits.slice(6, 8));
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    if (y < 1900 || dt > new Date()) return null;
    return { y, m, d };
  }

  // ---------- 四柱推命 ----------

  const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const STEM_READ = ['きのえ', 'きのと', 'ひのえ', 'ひのと', 'つちのえ', 'つちのと', 'かのえ', 'かのと', 'みずのえ', 'みずのと'];
  const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const GOGYO = ['木', '火', '土', '金', '水'];
  const stemEl = s => Math.floor(s / 2); // 甲乙=木, 丙丁=火, 戊己=土, 庚辛=金, 壬癸=水
  const BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]; // 子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水

  // ---------- 太陽の位置（節入り・太陽星座の判定に使う） ----------

  const RAD = Math.PI / 180;
  const norm = x => ((x % 360) + 360) % 360;
  // 日本時間の y/m/d hour時 → ユリウス日
  const jdJst = (y, m, d, hour) => jdn(y, m, d) - 0.5 + (hour - 9) / 24;

  // 太陽の視黄経（Meeus の簡易式。誤差0.01度程度＝時刻にして15分程度）
  function sunLongitude(jd) {
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * RAD)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * M * RAD) + 0.000289 * Math.sin(3 * M * RAD);
    const omega = 125.04 - 1934.136 * T;
    return norm(L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD));
  }

  // その日（日本時間 0時・正午・24時）の太陽黄経
  function sunDay({ y, m, d }) {
    return {
      start: sunLongitude(jdJst(y, m, d, 0)),
      noon: sunLongitude(jdJst(y, m, d, 12)),
      end: sunLongitude(jdJst(y, m, d, 24)),
    };
  }

  // 節月の番号：寅月=0（立春＝黄経315度）… 丑月=11（小寒＝285度）
  const setsuIndex = lon => Math.floor(norm(lon - 315) / 30);

  function pillars({ y, m, d }) {
    const sun = sunDay({ y, m, d });
    const k = setsuIndex(sun.noon);
    // 1〜2月で、まだ子月・丑月（立春前）なら前の年扱い
    const sy = m <= 2 && k >= 10 ? y - 1 : y;
    const yStem = ((sy - 4) % 10 + 10) % 10;
    const yBranch = ((sy - 4) % 12 + 12) % 12;
    const mStem = (((yStem % 5) * 2 + 2) + k) % 10;
    const mBranch = (k + 2) % 12;

    const dayIdx = (jdn(y, m, d) + 49) % 60; // 1900/1/1 = 甲戌
    return {
      year: [yStem, yBranch],
      month: [mStem, mBranch],
      day: [dayIdx % 10, dayIdx % 12],
      solarYear: sy,
      // 節入り当日生まれ：生まれた時刻によって月柱（立春なら年柱・九星も）が変わる
      setsuDay: setsuIndex(sun.start) !== setsuIndex(sun.end),
      risshunDay: setsuIndex(sun.start) === 11 && setsuIndex(sun.end) === 0,
    };
  }

  const pillarStr = ([s, b]) => STEMS[s] + BRANCHES[b];

  function gogyoCount(p) {
    const c = [0, 0, 0, 0, 0];
    for (const [s, b] of [p.year, p.month, p.day]) { c[stemEl(s)]++; c[BRANCH_EL[b]]++; }
    return c;
  }

  const DAY_STEM_TEXT = [
    'まっすぐ伸びる大木タイプ。曲がったことが嫌いで、頼られると張り切る。融通はちょっと苦手やな。',
    'しなやかな草花タイプ。人に合わせるのがうまくて、しぶとい。見た目より芯が強い。',
    '太陽タイプ。おるだけで場が明るなる。隠し事が下手で、機嫌がすぐ顔に出る。',
    'ろうそくの灯タイプ。静かやけど内側の情熱は熱い。細かいとこによう気がつく。',
    'どっしり山タイプ。何があっても動じへん安心感がある。そのぶん腰が重いときもある。',
    '畑の土タイプ。面倒見がようて人を育てるのが得意。考えすぎて溜め込みがち。',
    '鋼タイプ。白黒はっきり、行動力は抜群。言い方がキツなりやすいのは要注意。',
    '宝石タイプ。センスがようてプライドも高め。繊細で、実は傷つきやすい。',
    '大河タイプ。おおらかで自由人、スケールがでかい。縛られるのがいちばん苦手。',
    '雨つぶタイプ。やさしくて気配り上手、勘が鋭い。気分の波はちょっと大きめ。',
  ];

  // ---------- 西洋占星術 ----------

  const ELEMENTS = ['火', '地', '風', '水'];
  const SIGNS = [
    ['おひつじ座', '思い立ったら即行動の切り込み隊長', '気持ちの切り替えが早い。怒っても5分で忘れる'],
    ['おうし座', 'マイペースで五感が鋭い味わい上手', '安心できる場所とおいしいもんで機嫌が直る'],
    ['ふたご座', '好奇心のかたまりで、しゃべりながら考えるタイプ', '退屈が苦手。話を聞いてもらえたらスッキリする'],
    ['かに座', '身内を大事にする世話焼き', '家が心の基地。身内に冷たくされるのがいちばん堪える'],
    ['しし座', '主役が似合う、堂々とした目立ちたがり', '認めてほしい気持ちが強め。ほめられたら伸びる'],
    ['おとめ座', '細かいとこまで気がつく几帳面な分析家', '心配性。段取りが見えてたら落ち着く'],
    ['てんびん座', 'バランス感覚抜群の平和主義者', 'ケンカの空気がしんどい。穏やかな場がいちばん'],
    ['さそり座', '一度決めたらとことんの集中型', '気持ちは深いけど顔に出さへん。信頼した人にだけ見せる'],
    ['いて座', '自由で楽観的な冒険家', '束縛されると息が詰まる。外の空気で回復する'],
    ['やぎ座', 'コツコツ積み上げる責任感のかたまり', '弱音を吐くのが苦手。頑張りを見てもらえるとうれしい'],
    ['みずがめ座', '人と違う発想ができる個性派', 'ベタベタより、ほどよい距離感が心地いい'],
    ['うお座', 'やさしくて共感力の高いロマンチスト', '人の気持ちにひっぱられやすい。一人でぼーっとする時間が要る'],
  ].map(([name, sun, moon], i) => ({ i, name, sun, moon, el: i % 4 }));

  // 太陽星座：日本時間の正午の太陽黄経で判定。その日のうちに境目をまたぐなら alt に隣の星座
  function sunSign(y, m, d) {
    const sun = sunDay({ y, m, d });
    const idx = Math.floor(sun.noon / 30);
    const a = Math.floor(sun.start / 30), b2 = Math.floor(sun.end / 30);
    const alt = a !== b2 ? SIGNS[a === idx ? b2 : a] : null;
    return { sign: SIGNS[idx], alt };
  }

  // 月の黄経（Meeus の主要項。誤差0.3度程度）
  function moonLongitudeJd(jd) {
    const t = jd - 2451545.0;
    const L = 218.316 + 13.176396 * t;
    const M = 134.963 + 13.064993 * t;   // 月の平均近点角
    const D = 297.850 + 12.190749 * t;   // 平均離角
    const Ms = 357.529 + 0.98560028 * t; // 太陽の平均近点角
    const F = 93.272 + 13.229350 * t;
    const sn = x => Math.sin(x * RAD);
    const lon = L + 6.289 * sn(M) + 1.274 * sn(2 * D - M) + 0.658 * sn(2 * D) + 0.214 * sn(2 * M)
      - 0.186 * sn(Ms) - 0.059 * sn(2 * D - 2 * M) - 0.057 * sn(2 * D - M - Ms) + 0.053 * sn(2 * D + M)
      + 0.046 * sn(2 * D - Ms) + 0.041 * sn(M - Ms) - 0.035 * sn(D) - 0.031 * sn(M + Ms)
      - 0.015 * sn(2 * F - 2 * D) + 0.011 * sn(M - 4 * D);
    return norm(lon);
  }
  // 日本時間の正午
  const moonLongitude = (y, m, d) => moonLongitudeJd(jdJst(y, m, d, 12));

  // 月は1日で12〜15度動くので、その日の0時と24時で星座が変わるなら alt に入れる
  // （計算誤差のぶん、境目の前後0.5度も「時刻次第」として扱う）
  function moonSign(y, m, d) {
    const lon = moonLongitude(y, m, d);
    const idx = Math.floor(lon / 30);
    const s0 = Math.floor(norm(moonLongitudeJd(jdJst(y, m, d, 0)) - 0.5) / 30);
    const s1 = Math.floor(norm(moonLongitudeJd(jdJst(y, m, d, 24)) + 0.5) / 30);
    let alt = null;
    if (s0 !== idx) alt = SIGNS[s0];
    else if (s1 !== idx) alt = SIGNS[s1];
    return { sign: SIGNS[idx], alt, lon };
  }

  // ---------- 1人ぶんの命式 ----------

  function chart(name, date) {
    const p = pillars(date);
    const g = gogyoCount(p);
    return {
      name, date, p, g,
      dayStem: p.day[0],
      dayBranch: p.day[1],
      sun: sunSign(date.y, date.m, date.d).sign,
      sunAlt: sunSign(date.y, date.m, date.d).alt,
      moon: moonSign(date.y, date.m, date.d),
    };
  }

  // ---------- 2人の相性 ----------

  const KANGO = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]]; // 甲己 乙庚 丙辛 丁壬 戊癸
  const SHIGO = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]; // 子丑 寅亥 卯戌 辰酉 巳申 午未
  const SANGO = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]]; // 申子辰 亥卯未 寅午戌 巳酉丑
  const hasPair = (list, a, b) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  // 火(0)と風(2)、地(1)と水(3)が仲良し
  const westernFriendly = (a, b) => a % 2 === b % 2;

  function compat(A, B) {
    let score = 50;
    const notes = [];
    const tips = [];
    const ea = stemEl(A.dayStem), eb = stemEl(B.dayStem);

    // 日干どうし
    if (hasPair(KANGO, A.dayStem, B.dayStem)) {
      score += 22;
      notes.push(`日干が<b>干合</b>（${STEMS[A.dayStem]}と${STEMS[B.dayStem]}）。四柱推命でいちばん引き合う組み合わせで、理屈抜きで惹かれ合う縁やで。`);
    } else if (ea === eb) {
      score += 10;
      notes.push(`日干がどっちも<b>${GOGYO[ea]}</b>の比和。考え方が似てて話が早い。そのぶん意地の張り合いには気ぃつけて。`);
      tips.push('似た者どうしやから、譲る順番を決めとくとモメへん');
    } else if ((ea + 1) % 5 === eb || (eb + 1) % 5 === ea) {
      const [giver, taker] = (ea + 1) % 5 === eb ? [A, B] : [B, A];
      score += 14;
      notes.push(`<b>相生</b>の関係。${esc(giver.name)}（${GOGYO[stemEl(giver.dayStem)]}）が${esc(taker.name)}（${GOGYO[stemEl(taker.dayStem)]}）を生かす流れで、${esc(giver.name)}が自然と支える側になりやすい。`);
      tips.push(`${esc(taker.name)}から${esc(giver.name)}へ「ありがとう」を言葉にすると、ええ循環が続く`);
    } else {
      const [ctrl, ctrled] = (ea + 2) % 5 === eb ? [A, B] : [B, A];
      score -= 6;
      notes.push(`<b>相剋</b>の関係。${esc(ctrl.name)}の${GOGYO[stemEl(ctrl.dayStem)]}が${esc(ctrled.name)}の${GOGYO[stemEl(ctrled.dayStem)]}を抑える形で、${esc(ctrl.name)}がつい口出ししがち。${esc(ctrled.name)}は窮屈に感じることもあるで。`);
      tips.push(`${esc(ctrl.name)}は言う前に一回飲み込む。それだけでだいぶ変わる`);
    }

    // 日支どうし
    const ba = A.dayBranch, bb = B.dayBranch;
    if (hasPair(SHIGO, ba, bb)) {
      score += 14;
      notes.push(`日支が<b>支合</b>（${BRANCHES[ba]}と${BRANCHES[bb]}）。一緒におるとホッとする、生活リズムが合う組み合わせ。`);
    } else if (ba === bb) {
      score += 6;
      notes.push(`日支がどっちも${BRANCHES[ba]}。根っこの感覚が似てる。`);
    } else if (Math.abs(ba - bb) === 6) {
      score -= 8;
      notes.push(`日支が<b>冲</b>（${BRANCHES[ba]}と${BRANCHES[bb]}、正反対）。ぶつかりやすいけど、お互いに持ってへんもんを持ってる。`);
      tips.push('ぶつかったら一晩おいてから話す。冲は時間をおくと落ち着く');
    } else if (SANGO.some(g => g.includes(ba) && g.includes(bb))) {
      score += 10;
      notes.push(`日支が<b>三合</b>のグループ（${BRANCHES[ba]}と${BRANCHES[bb]}）。何か一緒に取り組むと力を発揮するコンビ。`);
      tips.push('共通の目標（旅行の計画とか）を作ると一気に仲が深まる');
    }

    // 太陽星座のアスペクト
    const dist = Math.min((A.sun.i - B.sun.i + 12) % 12, (B.sun.i - A.sun.i + 12) % 12);
    const ASPECT = {
      0: [8, `太陽星座がどっちも${A.sun.name}（<b>コンジャンクション</b>）。大事にしてるもんが近い。`],
      1: [-2, '太陽が30度。となりの星座どうしで、ちょっとかみ合いにくい角度。説明を一言多めにすると吉。'],
      2: [10, '太陽が60度（<b>セクスタイル</b>）。気軽に協力できる友達感覚。'],
      3: [-6, '太陽が90度（<b>スクエア</b>）。ペースが違うから摩擦も出るけど、そのぶん成長させ合える。'],
      4: [14, `太陽が120度（<b>トライン</b>）。同じ${ELEMENTS[A.sun.el]}のエレメントで、自然体のまま一緒におれる。`],
      5: [-2, '太陽が150度（<b>クインカンクス</b>）。分かり合うのに少しコツがいる。相手のやり方をいったん試してみて。'],
      6: [2, '太陽が180度（<b>オポジション</b>）。真逆やからこそ惹かれ合うシーソー関係。'],
    };
    score += ASPECT[dist][0];
    notes.push(`${A.sun.name}×${B.sun.name}：${ASPECT[dist][1]}`);
    if (dist === 3) tips.push('相手のペースを「遅い」「早い」で責めへん');

    // 月星座のエレメント
    const ma = A.moon.sign.el, mb = B.moon.sign.el;
    if (ma === mb) {
      score += 8;
      notes.push(`月星座のエレメントが同じ${ELEMENTS[ma]}。気持ちのツボが似てて、しんどいときに分かってもらえる。`);
    } else if (westernFriendly(ma, mb)) {
      score += 6;
      notes.push(`月星座が${ELEMENTS[ma]}と${ELEMENTS[mb]}で相性よし。気持ちの面で補い合える。`);
    } else {
      score -= 2;
      notes.push(`月星座は${ELEMENTS[ma]}と${ELEMENTS[mb]}で、気持ちの感じ方がちがうタイプ。「なんでそこで怒るん？」が起きやすい。`);
      tips.push('気持ちは察してもらう前提やなく、言葉にして伝える');
    }

    score = Math.max(20, Math.min(98, score));
    const label = score >= 85 ? 'ベストパートナー' : score >= 70 ? 'ええコンビ' : score >= 55 ? 'ほどよい距離感' : score >= 40 ? '刺激し合う関係' : '修行コンビ';
    if (!tips.length) tips.push('今のままで十分ええ感じ。たまに2人だけの時間を作ると、さらに深まる');
    return { a: A, b: B, score, label, notes, tip: tips[0] };
  }

  // ---------- 家族全体 ----------

  const HOUSE = [
    { title: 'すくすく伸びる森の家', strong: '木が多い家は、伸びしろの家。みんな向上心があって、新しいことに前向きや。', weak: '木が少なめ。新しいことを始める勢いは、家族で意識して作ろ。週末に行ったことない場所へ行くとかな。' },
    { title: '笑い声がやまん太陽の家', strong: '火が多い家は、にぎやかな家。笑い声も口ゲンカも大きめ。', weak: '火が少なめ。気持ちを言葉にするのが照れくさい家かも。「ありがとう」を声に出すだけで空気が変わるで。' },
    { title: '帰りたなる山の家', strong: '土が多い家は、安心の家。帰ってきたらホッとする、どっしり型。', weak: '土が少なめ。みんな忙しくてバラバラになりがち。ごはんの時間だけでも揃えるのが吉。' },
    { title: '筋の通った鋼の家', strong: '金が多い家は、けじめの家。ルールと約束がしっかりしてる。', weak: '金が少なめ。ルールがゆるくなりがち。家のルールを1個だけ決めて、みんなで守ってみて。' },
    { title: '風通しのええ川の家', strong: '水が多い家は、自由な家。それぞれ自分のペースで、干渉しすぎへん。', weak: '水が少なめ。考える余白が足りてへんかも。ぼーっとする時間も大事にしてな。' },
  ];
  const fmtDate = d => `${d.y}/${String(d.m).padStart(2, '0')}/${String(d.d).padStart(2, '0')}`;

  // ---------- 九星気学 ----------

  const KYUSEI = [
    null,
    ['一白水星', 4, '**一白水星は「水」。** 気配りの星で、人の気持ちを先に読んでまう。柔らかいけど、水やから最後は岩でも削ります。'],
    ['二黒土星', 2, '**二黒土星は「大地」。** 目立たん、支える、続ける星。派手さはないかわりに、この星がおる場所は崩れません。'],
    ['三碧木星', 0, '**三碧木星は「雷」、そして音。** 先陣切る、声出す、新しいもんに真っ先に飛びつく。思い立ったらすぐ動く星です。'],
    ['四緑木星', 0, '**四緑木星は「風」。** 人と人をつなぐ星で、才能より人の縁で道が開きます。友達と喋ってる時間も、この星にとっては本業です。'],
    ['五黄土星', 2, '**五黄土星は「中心」。** 九星でいちばんパワーの強い星で、周りを巻き込んでいく親分肌。良くも悪くも影響力が大きい。'],
    ['六白金星', 3, '**六白金星は「天」。** 責任感とプライドの星。人の上に立つと本領が出ます。頼まれたら断れへんとこも。'],
    ['七赤金星', 3, '**七赤金星は「沢」、そして喜び。** 人を楽しませるのが上手で、おしゃべりと食べることが好き。場をなごませる星です。'],
    ['八白土星', 2, '**八白土星は「山」。** コツコツ積み上げて、変わり目に強い星。じっとしてるようで、節目でガラッと向きを変えます。'],
    ['九紫火星', 1, '**九紫火星は「火」、そして光。** 華やかで頭がよく、直感が鋭い。きれいなもんと目立つことが好きな星です。'],
  ];
  // 立春で切り替わる年 → 本命星（その年の年盤の中宮の星と同じ）
  const kyuseiOfYear = sy => { const n = (11 - (sy % 9)) % 9; return n === 0 ? 9 : n; };
  const solarYear = date => pillars(date).solarYear;

  // ---------- 年齢・学年 ----------

  // ある日（{y,m,d}）時点の満年齢
  function ageAt(birth, on) {
    let a = on.y - birth.y;
    if (on.m < birth.m || (on.m === birth.m && on.d < birth.d)) a--;
    return a;
  }
  const toYmd = dt => ({ y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() });
  const ageOn = (birth, now) => ageAt(birth, toYmd(now));
  // 日本の学年（4/2〜翌4/1生まれが同学年）
  const birthSchoolYear = ({ y, m, d }) => (m > 4 || (m === 4 && d >= 2) ? y : y - 1);
  const schoolYearOf = ({ y, m }) => (m >= 4 ? y : y - 1);
  function gradeLabel(g) {
    if (g >= 1 && g <= 6) return `小${g}`;
    if (g >= 7 && g <= 9) return `中${g - 6}`;
    if (g >= 10 && g <= 12) return `高${g - 9}`;
    return null;
  }
  const gradeAt = (birth, on) => gradeLabel(schoolYearOf(on) - birthSchoolYear(birth) - 6);
  function personLabel(birth, now) {
    const on = toYmd(now);
    const g = gradeAt(birth, on);
    return `${ageAt(birth, on)}歳${g ? '・' + g : ''}`;
  }

  // 立春の日（日本時間で、その日のうちに太陽が黄経315度を通る日）
  function risshunDate(y) {
    for (let d = 2; d <= 6; d++) if (pillars({ y, m: 2, d }).risshunDay) return { y, m: 2, d };
    return { y, m: 2, d: 4 };
  }
  const prevDay = ({ y, m, d }) => toYmd(new Date(y, m - 1, d - 1));
  const fmtJa = ({ y, m, d }) => `${y}年${m}月${d}日`;

  // 期間中の年齢と学年を「12〜13歳・中1〜中2」の形で
  function spanLabel(birth, from, to) {
    const a1 = ageAt(birth, from), a2 = ageAt(birth, to);
    const g1 = gradeAt(birth, from), g2 = gradeAt(birth, to);
    const age = a1 === a2 ? `${a1}歳` : `${a1}〜${a2}歳`;
    let grade = '';
    if (g1 && g2) grade = g1 === g2 ? g1 : `${g1}〜${g2}`;
    else if (g1) grade = `${g1}〜卒業後`;
    else if (g2) grade = `入学前〜${g2}`;
    return grade ? `${age}・${grade}` : age;
  }

  // ---------- 語りの素材 ----------

  const STEM_SHORT = ['まっすぐ伸びる大木', 'しなやかなつる草', '家を照らす太陽', '静かに燃える灯', 'どっしりした山', 'なんでも育てる畑', '筋の通った鋼', '磨くほど光る宝石', 'でっかい川', 'しみこむ雨つゆ'];
  const STEM_LONG = [
    '**甲は「一本の大木」です。** 草でもつるでもない、まっすぐ上に伸びる木。曲がったことが嫌いで、頼られると張り切ります。そのかわり、横から押されても簡単には向きを変えへん。育つのに時間はかかるけど、育ちきったら誰にも動かせん種類の木です。',
    '**乙は「つる草・草花」の木です。** 甲が一本で立つ大木やったら、乙は何かに巻きついて伸びる。弱そうに見えて、実はこっちのほうが折れません。台風が来たら大木は倒れることあるけど、つるは揺れてやり過ごす。**しぶとさ**が本体です。',
    '**丙は「太陽」です。** おるだけで場が明るなる。隠しごとができへんし、機嫌がそのまま顔に出る。自分が照らしてることに本人はあんまり気づいてへんけど、この人が沈むと家全体がちょっと暗なります。',
    '**丁は「ろうそくの灯」です。** 太陽ほど派手やないけど、暗いとこでいちばん頼りになる火。静かやのに内側はずっと燃えてて、人の気持ちの小さい変化を見逃しません。',
    '**戊は「山」です。** どっしり構えて、何があっても動じへん。周りはこの人がおるだけで安心します。そのぶん腰は重め。動かすには理由が要ります。',
    '**己は「畑の土」です。** 硬い山の土やのうて、何か育てるための柔らかい土。人を育てる、場を整える、面倒を見る。気がついたら周りの世話を全部しとるタイプです。その反面、考えすぎて溜め込みがち。',
    '**庚は「鋼・刀」です。** 白黒はっきり、決めたら速い。行動力は家族でいちばんかもしれません。言い方がキツなることはあるけど、裏表はない。鍛えられるほど強なる金属です。',
    '**辛は「宝石」です。** センスがよくて、本物がわかる。プライドは高め。そのぶん繊細で、雑に扱われるのがいちばん堪える。磨かれる環境におったら、どんどん光ります。',
    '**壬は「大河」です。** おおらかでスケールがでかい、細かいことは気にせん自由人。縛られると息が詰まるけど、流れる道さえあればどこまでも行きます。',
    '**癸は「雨つゆ」です。** 静かに染みこんで、周りをうるおす水。やさしくて気配り上手、勘がやたら鋭い。気分の波はあるけど、それも雨と一緒で、降ったあとは景色がきれいになります。',
  ];
  const BRANCH_LONG = [
    '**子は真冬の水、そしてネズミ。** 頭の回転が速くて、ちょっとした変化に敏感です。',
    '**丑は冬の湿った土、そして牛。** 歩みはゆっくりやけど、粘り強さは十二支でいちばんです。',
    '**寅は春先の木、そして虎。** 動き出すときの勢いがあって、まっすぐ前に出ます。',
    '**卯は春真っ盛りの草木、そしてウサギ。** 人当たりがやわらかくて、感じがええ。',
    '**辰は春の終わりの湿った土、そして龍。** 器が大きくて、いろんなもんを溜めこめる。',
    '**巳は初夏の火、そしてヘビ。** 頭がよくて、じっと観察してから動きます。',
    '**午は真昼の火、そして馬。** 走り出したら止まらん。',
    '**未は夏の終わりの土、そして羊。** 群れを大事にする、穏やかでしぶとい性質です。',
    '**申は初秋の金、そしてサル。** 器用で要領がよくて、新しいことの飲みこみが早い。',
    '**酉は秋真っ盛りの金、そしてニワトリ。** 細かいとこまで整えたい、美意識の人。',
    '**戌は乾いた秋の土、そしてイヌ。** 守りの動物で、忠実で、いっぺん決めたら動かん。',
    '**亥は初冬の水、そしてイノシシ。** 思い込んだら一直線の行動力。',
  ];
  const GEN_IMG = ['生えとる木', '家を照らす火', '土台の土', '芯になる金', 'みんなを潤す水'];
  const CARE = [
    ['待つ', '外から押しても向きを変えへん木やから。本人が伸びる季節を待つのがいちばんの近道です'],
    ['つながりを見守る', '誰と一緒におるかで伸び方が変わるタイプやから。友達のことは口出しより見守りで'],
    ['ほめて照らす', '太陽は注目されるほど燃えます。ええとこを声に出して言うたってください'],
    ['じっくり聞く', '静かな火は急かすと消えます。話し出すまで待って、最後まで聞く'],
    ['ペースを守る', '山は急かしても動きません。自分で決めさせたほうが結局早い'],
    ['考える時間をあげる', '答えを出すまでに時間がかかるタイプ。結論を急かさんといて'],
    ['理由を言う', '納得したら一直線の子です。頭ごなしやなく「なんでか」を説明する'],
    ['人前で叱らない', '宝石は傷がつくのをいちばん嫌います。注意は2人きりのときに短く'],
    ['枠だけ決めて自由に', '川は堤防さえあれば大丈夫。細かい指示より、守るルールを1つだけ'],
    ['気持ちの波に付き合う', '雨の日もある子です。落ちてるときは理由を聞かんと、そばにおるだけでええ'],
  ];
  // 年運（その年の天干と日干の関係）。label, 通変星, 子ども向け, 大人向け
  const PHASE = {
    hikou: ['自分を固める', '比肩・劫財', '仲間と張り合いながら、自分の軸ができてくる', '人に合わせるより、自分のやり方を通したほうがうまくいく'],
    shokushou: ['持ち味が外に出る', '食神・傷官', '好きなこと・得意なことが表に出てくる。止めたらもったいない', 'アイデアや楽しみが増える。始めるならここ'],
    zai: ['外へ広がる', '偏財・正財', '行動範囲が広がって、外の世界とつながる', '動いたぶんだけ結果が出る'],
    kan: ['責任と向き合う', '偏官・正官', 'ルールや評価と向き合う。しんどいけど、ここで芯が通る', '役割と責任が増える。背負いすぎ注意'],
    in: ['吸収・充電', '偏印・印綬', '学びが入りやすい。静かに見えても中で育ってる', '休むことと学ぶことが、次の伸びになる'],
  };
  // 日干の五行(行) × 年運(列) で、その人にとっての景色
  const PHASE_IMG = {
    hikou: ['木が並んで林になる。仲間が増えて、張り合う相手もできる', '火が重なって勢いが倍になる。そのぶん燃えすぎ注意', '土が盛られて山になる。足場が固まる', '刃が二本になる。競争心に火がつく', '川が合流して流れが太なる'],
    shokushou: ['木が燃えて火を生む。内側に溜めてたもんが表に出る', '火が灰になって土を肥やす。やったことが形に残る', '土の中から金が出る。隠れてた才能が掘り出される', '冷えた金に露がつく。頭が冴えて言葉が鋭くなる', '水が木を育てる。人に教えたり世話したりで、自分も伸びる'],
    zai: ['根が土をつかむ。足場を広げる', '火が金を溶かす。手を動かして形にする', '土が水をせき止めて、ため池ができる。蓄える力がつく', '斧が木を切る。決断して道を切り拓く', '水が火を鎮める。冷静に現実を回す'],
    kan: ['斧が入って剪定される。形が整う', '水をかけられてブレーキがかかる。勢いの使い方を覚える', '根が張って土が締まる', '火で鍛えられて刀が仕上がる', '堤防ができて、流れに向きがつく'],
    in: ['雨が降って、根から水を吸う', '薪がくべられて燃料が満ちる', '日が当たって土が温まる', '土の中で金がじっくり熟す', '岩から湧き水が出て、源泉が満ちる'],
  };
  // 中心星（月干の通変星）
  const TSUHEN = {
    比肩: ['**自立心のかたまり。** 人に言われてやるのがいちばん嫌いで、自分で決めたことはやり抜く', '**独立独歩の人。** 人に頼るより自分でやったほうが早いと思うタイプで、頼られると強い', '自分で決めさせる'],
    劫財: ['**負けず嫌いの勝負師。** 競う相手がおると本気が出る。仲間思いで、身内のためなら無茶もする', '**ここ一番の粘りの人。** 表は柔らかくても中身は負けず嫌い。身内を守る力が強い', '張り合える相手を作ってあげる'],
    食神: ['**好きなことで伸びる子。** 楽しいと思えたらとことん続く。おおらかで、食べることと遊ぶことが大事な栄養', '**楽しむ力の人。** 余裕があるときにいちばんええ仕事をする。人をくつろがせる才能がある', '好きなことを止めへん'],
    傷官: ['**感性が鋭くて言葉が立つ子。** 理不尽にすぐ気づくから大人には手強い。そのぶん表現の才能は抜群', '**鋭い感性と表現力の人。** 細かい違和感を見逃さへん。言い方ひとつで味方も敵も作る', '頭ごなしに否定せえへん'],
    偏財: ['**人懐っこくて世渡り上手な子。** 友達が多くて、場の空気を読んで動ける', '**人とお金を回す人。** 顔が広くて気前がええ。動けば動くほど縁が増える', '友達づきあいを広げさせる'],
    正財: ['**コツコツ型のしっかり者。** 積み上げるのが得意で、約束やルールをちゃんと守る', '**堅実で生活を守る人。** 無駄が嫌いで、段取りや家計を任せたら安心', '続けてることを具体的にほめる'],
    偏官: ['**行動力と度胸の子。** 考えるより先に体が動く。困ってる子を放っとかれへん親分肌', '**行動力と瞬発力の人。** 頼まれたらすぐ動く。プレッシャーがかかるほど強い', '体を動かす場を用意する'],
    正官: ['**まじめで筋を通す子。** ルールを守るし、期待に応えようとがんばる。そのぶん無理をため込みやすい', '**信頼と責任の人。** 筋を通すから周りに頼られる。「ちゃんとせな」が強め', 'がんばりすぎをゆるめたる'],
    偏印: ['**アイデアと独自路線の子。** 人と違うことを思いつく。興味がころころ変わるけど、それが持ち味', '**ひらめきと専門性の人。** 型にはまらん発想ができる。ひとりで考える時間が要る', '興味が移っても責めへん'],
    印綬: ['**学ぶ力の子。** 知りたい気持ちが強くて吸収が早い。じっくり考えてから動く', '**知恵と思慮深さの人。** よう考えてから動くし、人に教えるのがうまい', '考えてる時間を待ったる'],
  };
  function tsuhenOf(dayStem, other) {
    const e = stemEl(dayStem), o = stemEl(other);
    const same = dayStem % 2 === other % 2;
    if (o === e) return same ? '比肩' : '劫財';
    if ((e + 1) % 5 === o) return same ? '食神' : '傷官';
    if ((e + 2) % 5 === o) return same ? '偏財' : '正財';
    if ((o + 2) % 5 === e) return same ? '偏官' : '正官';
    return same ? '偏印' : '印綬';
  }
  const GOGYO_MEAN = ['伸びる力', '表現と情熱', '安定と包容力', '決断とけじめ', '知恵と休む力'];

  function phaseOf(dayEl, yEl) {
    if (yEl === dayEl) return 'hikou';
    if ((dayEl + 1) % 5 === yEl) return 'shokushou';
    if ((dayEl + 2) % 5 === yEl) return 'zai';
    if ((yEl + 2) % 5 === dayEl) return 'kan';
    return 'in';
  }
  const WEST_TO_GOGYO = [1, 2, null, 4]; // 火→火, 地→土, 風→なし, 水→水

  const b = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const nm = c => esc(c.name);

  // ---------- 家族全体の分析 ----------

  function familyReading(people, now = new Date()) {
    const charts = people.map(p => {
      const c = chart(p.name, p.date);
      c.kyusei = kyuseiOfYear(solarYear(p.date));
      c.label = personLabel(p.date, now);
      c.age = ageOn(p.date, now);
      c.el = stemEl(c.dayStem);
      c.chuushin = tsuhenOf(c.dayStem, c.p.month[0]);
      return c;
    });

    // 世代：生年月日順に並べて、15年以上あいたところで区切る
    const byAge = charts.slice().sort((a, b2) => a.date.y * 10000 + a.date.m * 100 + a.date.d - (b2.date.y * 10000 + b2.date.m * 100 + b2.date.d));
    const gens = [[byAge[0]]];
    for (let i = 1; i < byAge.length; i++) {
      if (byAge[i].date.y - byAge[i - 1].date.y >= 15) gens.push([]);
      gens[gens.length - 1].push(byAge[i]);
    }

    const pairs = [];
    for (let i = 0; i < charts.length; i++) {
      for (let j = i + 1; j < charts.length; j++) pairs.push(compat(charts[i], charts[j]));
    }

    const g = [0, 0, 0, 0, 0];
    charts.forEach(c => c.g.forEach((v, k) => { g[k] += v; }));
    const order = g.map((v, k) => k).sort((x, y) => g[y] - g[x] || x - y);
    const w = [0, 0, 0, 0];
    charts.forEach(c => { w[c.sun.el]++; w[c.moon.sign.el]++; });

    const avg = Math.round(pairs.reduce((s, p) => s + p.score, 0) / pairs.length);
    const sorted = pairs.slice().sort((x, y) => y.score - x.score);
    const hubScores = charts.map(c => {
      const mine = pairs.filter(p => p.a === c || p.b === c);
      return mine.reduce((s, p) => s + p.score, 0) / mine.length;
    });

    return {
      now, charts, gens, pairs, gogyo: g, strong: order[0], weak: order[4], west: w, avg,
      best: sorted[0], watch: sorted[sorted.length - 1],
      hub: charts[hubScores.indexOf(Math.max(...hubScores))],
      house: HOUSE[order[0]],
    };
  }

  // 日干の五行で「誰が誰を生かすか」をたどる
  function flowOf(charts) {
    const links = [];
    for (const a of charts) for (const c of charts) if (a !== c && (a.el + 1) % 5 === c.el) links.push([a, c]);
    const present = new Set(charts.map(c => c.el));
    const roots = charts.filter(c => !present.has((c.el + 4) % 5));
    // 日干の五行が相生の順に途切れずつながってるか
    const els = [...present];
    let chain = null;
    if (els.length >= 3 && els.length < 5) {
      const start = els.find(e => !present.has((e + 4) % 5));
      const seq = [];
      for (let e = start; present.has(e) && seq.length < 5; e = (e + 1) % 5) seq.push(e);
      if (seq.length === els.length) chain = seq;
    }
    return { links, roots, present, chain };
  }

  // ---------- レポートの描画 ----------

  const KEY_GROUP = { 比肩: 'hikou', 劫財: 'hikou', 食神: 'shokushou', 傷官: 'shokushou', 偏財: 'zai', 正財: 'zai', 偏官: 'kan', 正官: 'kan', 偏印: 'in', 印綬: 'in' };

  function renderTimeline(c, now) {
    const today = toYmd(now);
    const y0 = pillars(today).solarYear;
    const child = ageAt(c.date, today) <= 18;
    const items = [];
    let y = y0;
    while (y < y0 + 10) {
      const key = phaseOf(c.el, stemEl(((y - 4) % 10 + 10) % 10));
      let y2 = y;
      while (y2 + 1 < y0 + 10 && phaseOf(c.el, stemEl(((y2 + 1 - 4) % 10 + 10) % 10)) === key) y2++;
      const from = y === y0 ? today : risshunDate(y);
      const to = prevDay(risshunDate(y2 + 1));
      items.push({ from, to, key, y });
      y = y2 + 1;
    }
    // 九星：本命星が中宮に入る年（9年に1回）
    let cy = y0;
    while (kyuseiOfYear(cy) !== c.kyusei) cy++;
    const kFrom = cy === y0 ? today : risshunDate(cy);
    items.push({ from: kFrom, to: prevDay(risshunDate(cy + 1)), key: 'kyusei', y: cy });
    items.sort((a, b2) => a.y - b2.y || (a.key === 'kyusei' ? 1 : -1));

    const own = KEY_GROUP[c.chuushin];
    return `<ul class="k-time">${items.map(it => {
      const when = `<span class="k-when">${it.from === today ? 'いま' : fmtJa(it.from)}〜${fmtJa(it.to)}</span><span class="k-age">${spanLabel(c.date, it.from, it.to)}</span>`;
      if (it.key === 'kyusei') {
        return `<li>${when}<b>九星の節目</b>：${KYUSEI[c.kyusei][0]}が年盤の真ん中（中宮）に入る1年。9年にいっぺんの区切りで、環境が変わりやすい。新しく始めたことが根づきやすい年です。<span class="k-src">九星・年盤</span></li>`;
      }
      const ph = PHASE[it.key];
      const match = it.key === own ? `中心星の${c.chuushin}と同じ系統の年回りなんで、${nm(c)}の持ち味がいちばん素直に出る時期です。` : '';
      return `<li>${when}<b>${ph[0]}</b>：${PHASE_IMG[it.key][c.el]}。${child ? ph[2] : ph[3]}。${match}<span class="k-src">${ph[1]}</span></li>`;
    }).join('')}</ul>`;
  }

  function stemBranchLine(c) {
    const se = c.el, be = BRANCH_EL[c.dayBranch];
    const S = GOGYO[se], B = GOGYO[be];
    if ((be + 1) % 5 === se) return `足元の${B}が自分の${S}を育てる並び。<b>自分の中に自分を養うもんを持っとる</b>ので、ひとりでも立て直せる人です。`;
    if (be === se) return `足元も同じ${S}。芯がぶれへん、自分をしっかり持っとる配置です。`;
    if ((se + 1) % 5 === be) return `自分の${S}が足元の${B}を生む並びで、持ってるもんを外に出していくタイプ。表現したり、人に何かしてあげたりするほど調子が上がります。`;
    if ((se + 2) % 5 === be) return `自分の${S}が足元の${B}を抑える並び。現実をうまく回す、手綱を握るのが得意な配置です。`;
    return `足元の${B}が自分の${S}を抑える並び。自分に厳しくて「ちゃんとせな」と思いがち。責任感の裏返しです。`;
  }

  function westLine(c, sameSun, sameMoon) {
    const we = WEST_TO_GOGYO[c.sun.el];
    let rel = '';
    if (we !== null && (we + 1) % 5 === c.el) rel = ` ${STEMS[c.dayStem]}（${GOGYO[c.el]}）は${GOGYO[we]}で育つんで、<b>東洋と西洋の両方で自分を養うもんを持っとる</b>構造。ええ並びです。`;
    else if (we !== null && we === c.el) rel = ` 東洋でも西洋でも同じ${GOGYO[we]}。性格の芯がはっきりしてます。`;
    const moon = c.moon.alt ? `${c.moon.sign.name}※` : c.moon.sign.name;
    const sunPart = sameSun ? `<b>太陽星座は${nm(sameSun)}と同じ${c.sun.name}。</b>` : `<b>${c.sun.name}は${ELEMENTS[c.sun.el]}。</b>${c.sun.sun}。`;
    const moonPart = sameMoon
      ? `月星座も${nm(sameMoon)}と同じ${moon}で、素の気持ちの動き方は似てます。`
      : `月星座は${moon}で、素の気持ちは「${c.moon.sign.moon}」。`;
    return `${sunPart}${rel}${moonPart}`;
  }

  // 生まれた時刻によって変わるもの
  function timeNotes(c) {
    const n = [];
    if (c.p.risshunDay) n.push('立春の当日生まれなので、生まれた時刻によって年柱・月柱・九星が1つ前の年のものになります');
    else if (c.p.setsuDay) n.push('節入りの当日生まれなので、生まれた時刻によって月柱が1つずれます');
    if (c.sunAlt) n.push(`太陽が星座の境目を通る日なので、生まれた時刻によっては${c.sunAlt.name}です`);
    if (c.moon.alt) n.push(`月がその日のうちに星座を移るので、生まれた時刻によっては月星座が${c.moon.alt.name}です`);
    return n;
  }

  // 九星と日干の重なり方（同じ九星の人でも、日干がちがえば読みが変わる）
  function kyuseiOverlap(c) {
    const [star, K] = KYUSEI[c.kyusei];
    const E = c.el;
    const st = STEMS[c.dayStem];
    if (K === E) return `星の${GOGYO[K]}と、本質（${st}）の${GOGYO[E]}が同じ。${star}の性質がそのまま濃く出ます。`;
    if ((K + 1) % 5 === E) return `${star}（${GOGYO[K]}）が本質（${st}）の${GOGYO[E]}を育てる並び。星の性質が本人の追い風になります。`;
    if ((E + 1) % 5 === K) return `本質（${st}）の${GOGYO[E]}から${star}（${GOGYO[K]}）が生まれる並び。${STEM_SHORT[c.dayStem]}の性質が、${star.slice(0, 2)}らしさとして外に出てきます。`;
    if ((E + 2) % 5 === K) return `本質（${st}）の${GOGYO[E]}が${star}（${GOGYO[K]}）を抑える並び。星の勢いを、自分の判断でうまく使いこなすタイプです。`;
    return `${star}（${GOGYO[K]}）が本質（${st}）の${GOGYO[E]}を締める並び。星の性質が、ブレーキにも引き締めにもなります。`;
  }

  // 命式（年・月・日の6文字）そのものの特徴
  function chartShape(c) {
    const parts = [];
    const counts = c.g.map((v, k) => `${GOGYO[k]}${v}`).join('・');
    const max = Math.max(...c.g);
    const tops = c.g.map((v, k) => (v === max ? k : -1)).filter(k => k >= 0);
    const zero = c.g.map((v, k) => (v === 0 ? k : -1)).filter(k => k >= 0);
    parts.push(`${nm(c)}の命式（年・月・日の柱の6文字）の五行は${counts}。いちばん多いのは${tops.map(k => GOGYO[k]).join('と')}で、${tops.map(k => GOGYO_MEAN[k]).join('と')}が強い。`);
    if (zero.length) parts.push(`${zero.map(k => GOGYO[k]).join('と')}はゼロなんで、${zero.map(k => GOGYO_MEAN[k]).join('や')}は家族や周りから借りるとええ配置です。`);
    const br = [c.p.year[1], c.p.month[1], c.p.day[1]];
    const sango = SANGO.find(gp => gp.every(x => br.includes(x)));
    if (sango) {
      parts.push(`<b>しかも、年・月・日の地支に${sango.map(x => BRANCHES[x]).join('・')}が全部そろって「三合${GOGYO[BRANCH_EL[sango[1]]]}局」になってます。</b>命式の中で${GOGYO[BRANCH_EL[sango[1]]]}の力がひとかたまりになる配置で、3つがそろう人は百人に一人ちょっとです。`);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const [x, y] = [br[i], br[j]];
      if (x !== y && Math.abs(x - y) === 6) parts.push(`${['年', '月', '日'][i]}支の${BRANCHES[x]}と${['年', '月', '日'][j]}支の${BRANCHES[y]}が冲（正反対）。内側に正反対の気持ちを両方持ってて、気分の切り替えが大きいタイプです。`);
      else if (x !== y && hasPair(SHIGO, x, y)) parts.push(`${['年', '月', '日'][i]}支の${BRANCHES[x]}と${['年', '月', '日'][j]}支の${BRANCHES[y]}が支合。内側がまとまってて、気持ちが安定しやすい。`);
    }
    return parts.join('');
  }

  function renderPersonLong(c, now, seen) {
    const notes = timeNotes(c);
    const twin = seen.find(o => o.date.y === c.date.y && o.date.m === c.date.m && o.date.d === c.date.d);
    if (twin) {
      return `
      <section class="k-sec">
        <h2>${nm(c)}（${c.label}）<span>${pillarStr(c.p.day)}・${KYUSEI[c.kyusei][0]}・${c.sun.name}</span></h2>
        <p><b>${nm(c)}は${nm(twin)}と生年月日が同じなんで、命式も九星も星座も、生年月日から出せるもんは全部同じです。</b>性格の読みは${nm(twin)}の欄をそのまま見てください。</p>
        <p>四柱推命で2人の違いが出るのは、生まれた時刻から出す「時柱」です。生まれた時刻がわかれば、そこで差が読めます。</p>
        ${notes.length ? `<p class="k-note">※ ${notes.join('。※ ')}。正午生まれとして計算してます。</p>` : ''}
      </section>`;
    }
    const child = ageOn(c.date, now) <= 18;
    const sameBranch = seen.find(o => o.dayBranch === c.dayBranch);
    const sameStar = seen.find(o => o.kyusei === c.kyusei);
    const sameStem = seen.find(o => o.dayStem === c.dayStem);
    const branch = !sameBranch
      ? b(BRANCH_LONG[c.dayBranch])
      : sameBranch.dayStem === c.dayStem
        ? `日柱そのもの（${pillarStr(c.p.day)}）が${nm(sameBranch)}と同じ。性格の土台はかなり似てます。${nm(c)}の違いは、月の柱（中心星）と生まれ年に出ます。`
        : `${nm(c)}の日支は${nm(sameBranch)}と同じ${BRANCHES[c.dayBranch]}。ただ、上に乗ってる日干がちがうんで出方がちゃいます。`;
    const star = sameStar
      ? `<b>九星は${nm(sameStar)}と同じ${KYUSEI[c.kyusei][0]}。</b>けど${nm(c)}の場合は、`
      : `${b(KYUSEI[c.kyusei][2])}`;
    return `
      <section class="k-sec">
        <h2>${nm(c)}（${c.label}）<span>${pillarStr(c.p.day)}・${KYUSEI[c.kyusei][0]}・${c.sun.name}</span></h2>
        <p>${sameStem ? `<b>日干は${nm(sameStem)}と同じ${STEMS[c.dayStem]}、${STEM_SHORT[c.dayStem]}です。</b>同じ木や石でも育つ場所で姿が変わるように、${nm(c)}は足元が${BRANCHES[c.dayBranch]}、中心星が${c.chuushin}。ここから下が${nm(c)}だけの話です。` : b(STEM_LONG[c.dayStem])}</p>
        <p><b>中心星（月の柱の通変星）は「${c.chuushin}」。</b>${b(TSUHEN[c.chuushin][child ? 0 : 1])}。${STEM_SHORT[c.dayStem]}に${c.chuushin}が乗るんが、${nm(c)}の芯です。</p>
        <p>${branch}${stemBranchLine(c)}</p>
        <p>${chartShape(c)}</p>
        <p>${star}${sameStar ? kyuseiOverlap(c) : ' ' + kyuseiOverlap(c)}</p>
        <p>${westLine(c, seen.find(o => o.sun === c.sun), seen.find(o => o.sun === c.sun && o.moon.sign === c.moon.sign))}</p>
        <h3>時期を読むと</h3>
        ${renderTimeline(c, now)}
        ${notes.length ? `<p class="k-note">※ ${notes.join('。※ ')}。正午生まれとして計算してます。</p>` : ''}
      </section>`;
  }

  function pairReason(p) {
    const A = p.a, B = p.b;
    if (A.dayStem === B.dayStem) return { why: `日干がどっちも「${STEMS[A.dayStem]}」の${STEM_SHORT[A.dayStem]}`, reframe: '同じ種類どうしは、近すぎると光の取り合いになります。相性が悪いんちゃいます。<b>似すぎてるだけ</b>です。', medEl: (A.el + 1) % 5, med: m => `2人の${GOGYO[A.el]}の気が${m}に流れ込んで、張り合う力が育てる力に変わるんで。` };
    if (A.el === B.el) return { why: `日干がどっちも${GOGYO[A.el]}`, reframe: '同じ五行どうしは張り合いやすい。相性が悪いんちゃいます。<b>似てるだけ</b>です。', medEl: (A.el + 1) % 5, med: m => `2人の${GOGYO[A.el]}の気が${m}に流れ込んで、張り合う力が育てる力に変わるんで。` };
    if (Math.abs(A.dayBranch - B.dayBranch) === 6) return { why: `日支が冲（${BRANCHES[A.dayBranch]}と${BRANCHES[B.dayBranch]}、正反対）`, reframe: 'ぶつかりやすいけど、お互いに持ってへんもんを持ってる組み合わせです。', medEl: null };
    if ((A.el + 2) % 5 === B.el || (B.el + 2) % 5 === A.el) {
      const [X, Y] = (A.el + 2) % 5 === B.el ? [A, B] : [B, A];
      return { why: `${nm(X)}の${GOGYO[X.el]}が${nm(Y)}の${GOGYO[Y.el]}を抑える相剋`, reframe: `${nm(X)}がつい口出しして、${nm(Y)}が窮屈になりやすい形です。`, medEl: (X.el + 1) % 5, med: m => `${GOGYO[X.el]}→${GOGYO[(X.el + 1) % 5]}→${GOGYO[Y.el]}と、${nm(X)}から${m}を通って${nm(Y)}を育てる流れに変わるんで（通関いいます）。` };
    }
    return { why: `点数がいちばん低い組（${p.score}点）`, reframe: 'とはいえ大きな衝突の形やありません。', medEl: null };
  }

  function renderReport(r) {
    const { charts, gens, now } = r;
    const flow = flowOf(charts);
    const kids = gens.length >= 2 ? gens[gens.length - 1] : [];
    const parents = gens.length >= 2 ? gens[gens.length - 2] : [];
    const verdict = r.avg >= 70 ? 'かなりええ家' : r.avg >= 60 ? 'バランスのええ家' : r.avg >= 50 ? '個性がぶつかり合う、伸びしろのある家' : 'お互いを鍛え合う家';
    const hook = flow.chain ? '五行が一本の流れでつながってまっせ' : flow.present.size === 5 ? '五行が全部そろてまっせ' : 'ちょっとおもろい配置してまっせ';
    const out = [];

    out.push(`<h1>この家、${hook}</h1>
      <p>四柱推命と九星気学と西洋占星術、三つ重ねて見ました。<br>結論から言うと、<b>${verdict}</b>です。理由を順に書きますわ。</p>`);

    // 顔ぶれ
    out.push(`<section class="k-sec"><h2>まず、${charts.length}人の顔ぶれ</h2>
      <div class="k-table-wrap"><table class="k-table">
        <thead><tr><th></th><th>生年月日</th><th>日柱</th><th>九星</th><th>星座</th><th>ひとことで</th></tr></thead>
        <tbody>${charts.map(c => `<tr><th>${nm(c)}<small>${c.label}</small></th><td>${fmtDate(c.date)}</td><td>${pillarStr(c.p.day)}</td><td>${KYUSEI[c.kyusei][0]}${c.p.risshunDay ? '※' : ''}</td><td>${c.sun.name}${c.sunAlt ? '※' : ''}</td><td>${STEM_SHORT[c.dayStem]}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="k-note">日柱は四柱推命でその人自身を表す柱です。最初の字（日干）が本質になります。${charts.some(c => timeNotes(c).length) ? '※は生まれた時刻によって変わる項目です（くわしくは各人の欄）。' : ''}</p></section>`);

    // 家の構造
    const groups = [0, 1, 2, 3, 4].map(e => charts.filter(c => c.el === e)).map((list, e) => list.length ? `${GOGYO[e]}が${list.map(nm).join('・')}` : null).filter(Boolean);
    const struct = [];
    struct.push(`<p><b>日干の五行で並べると、${groups.join('、')}。</b></p>`);
    if (flow.chain) {
      const seq = flow.chain.map(e => charts.filter(c => c.el === e).map(nm).join('・'));
      struct.push(`<p>見た瞬間、ちょっと声出ましたわ。五行は木→火→土→金→水→木の順に「前が次を生かす」んですけど、この家は<b>${seq.join(' → ')}</b>と、<b>一本の流れで途切れずつながってます。</b></p>`);
    }
    if (flow.links.length) {
      struct.push(`<ul>${flow.links.map(([a, c]) => `<li>${nm(a)}（${GOGYO[a.el]}）が${nm(c)}（${GOGYO[c.el]}）を<b>生かす</b>。${GEN_IMG[a.el]}が${GEN_IMG[c.el]}を育てる形</li>`).join('')}</ul>`);
    } else {
      struct.push('<p>日干どうしで直接「生かす」関係はありません。それぞれが自分の場所で立ってる、自立型の家です。</p>');
    }
    // 東西で同じ絵になるか
    if (gens.length >= 2) {
      const genEls = gens.map(gg => new Set(gg.map(c => c.sun.el)));
      const clean = genEls.every(s => s.size === 1) && new Set(genEls.map(s => [...s][0])).size === gens.length;
      if (clean && gens.every(gg => gg.length >= 2)) {
        struct.push(`<p>しかもですよ。西洋占星術で見ても、${gens.map(gg => `<b>${gg.map(nm).join('・')}が${ELEMENTS[gg[0].sun.el]}</b>`).join('、')}と、世代できれいに分かれとる。東洋と西洋、まったく別の体系で世代の区切りがはっきり出るのは、そんなに多くないです。</p>`);
      }
    }
    const lonely = flow.roots.filter(c => flow.links.some(([a]) => a === c));
    if (lonely.length) {
      struct.push(`<blockquote>この家で、日干の五行が<b>誰からも育ててもろてへん</b>のは${lonely.map(nm).join('と')}です。<br>人を生かす側やのに、その人を養う${lonely.map(c => GOGYO[(c.el + 4) % 5]).filter((v, i, a) => a.indexOf(v) === i).join('・')}が家の中におらん。</blockquote>`);
    }
    out.push(`<section class="k-sec"><h2>で、この家の構造なんですけど</h2>${struct.join('')}
      <p>ここまでは日干（本人の1字）で見た話。家族全員の命式を全部（年・月・日の柱の6文字×${charts.length}人）足して数えると、${GOGYO[r.strong]}がいちばん多くて${GOGYO[r.weak]}がいちばん少ない。${r.house.strong}${HOUSE[r.weak].weak}</p></section>`);

    // ひとりずつ（若い世代から）
    const orderPeople = gens.slice().reverse().flat();
    const seen = [];
    orderPeople.forEach(c => { out.push(renderPersonLong(c, now, seen)); seen.push(c); });

    // きょうだい
    if (kids.length >= 2) {
      const diff = new Set(kids.map(c => c.el)).size === kids.length;
      out.push(`<section class="k-sec"><h2>で、${kids.map(nm).join('と')}の関わり方、${diff ? '正反対です' : '似てるようでちゃいます'}</h2>
        <p>ここ、いちばん大事なとこです。</p>
        <ul>${kids.map((c, i) => {
          const twin = kids.slice(0, i).find(o => o.date.y === c.date.y && o.date.m === c.date.m && o.date.d === c.date.d);
          if (twin) return `<li><b>${nm(c)}</b>：${nm(twin)}と生年月日が同じなんで、関わり方も${nm(twin)}と同じでええです。違いが出るのは生まれた時刻のほうです。</li>`;
          const same = kids.slice(0, i).find(o => o.dayStem === c.dayStem && o.chuushin === c.chuushin);
          if (same) return `<li><b>${nm(c)}にも「${CARE[c.dayStem][0]}」</b>：日干も中心星も${nm(same)}と同じなんで、基本は同じ接し方でええです。ただ同じやからこそ、2人をセットで扱わんと一人ずつ声をかけたってください。</li>`;
          return `<li><b>${nm(c)}には「${CARE[c.dayStem][0]}」</b>：${CARE[c.dayStem][1]}。それに中心星が${c.chuushin}やから、<b>${TSUHEN[c.chuushin][2]}</b>のが効きます。</li>`;
        }).join('')}</ul>
        <p>${diff ? `日干の種類がちゃうんで、<b>比べた瞬間に${kids.length === 2 ? '二人とも' : '全員'}損します。</b>そこだけ気ぃつけてもろたら。` : '同じ五行の子がおるんで、張り合いやすい。<b>それぞれの土俵を分けたる</b>のがコツです。'}</p></section>`);
    }

    // 注意
    const w = r.watch;
    if (r.pairs.length > 1) {
      const reason = pairReason(w);
      const med = reason.medEl === null ? null : charts.find(c => c !== w.a && c !== w.b && c.el === reason.medEl);
      out.push(`<section class="k-sec"><h2>一個だけ注意</h2>
        <p><b>${nm(w.a)}と${nm(w.b)}</b>：${reason.why}。</p>
        <p>${reason.reframe}${med ? `そこで<b>${nm(med)}（${GOGYO[med.el]}）が間に入ったら収まります。</b>${reason.med(nm(med))}` : ''}</p>
        <p>コツ：${w.tip}。</p></section>`);
    }

    // 親世代の2人
    if (parents.length === 2) {
      const p = r.pairs.find(x => parents.includes(x.a) && parents.includes(x.b));
      out.push(`<section class="k-sec"><h2>${nm(parents[0])}と${nm(parents[1])}について</h2>
        <ul>${p.notes.map(n => `<li>${n}</li>`).join('')}</ul>
        <p>2人の相性は<b>${p.score}点（${p.label}）</b>。${p.score >= 70 ? 'この家が崩れん理由の一つ、たぶんここです。' : `${p.tip}。それだけで家の空気が変わります。`}</p></section>`);
    }

    // まとめ
    const diagram = gens.map((gg, gi) => gg.map(c => `  ${c.name}（${pillarStr(c.p.day)}・${KYUSEI[c.kyusei][0].slice(0, 2)}）  ← ${STEM_SHORT[c.dayStem]}`).join('\n') + (gi < gens.length - 1 ? '\n        ↓' : '')).join('\n');
    const flowLine = flow.chain ? `\n\n  流れ：${flow.chain.map(e => charts.filter(c => c.el === e).map(c => c.name).join('・')).join(' → ')}` : '';
    out.push(`<section class="k-sec"><h2>まとめますわ</h2>
      <pre class="k-diagram">${esc(diagram + flowLine)}</pre>
      <p><b>${r.house.title}。</b>全${r.pairs.length}組の相性の平均は${r.avg}点、まとめ役は${nm(r.hub)}、いちばんのコンビは${nm(r.best.a)}と${nm(r.best.b)}（${r.best.score}点）。</p>
      <p>${r.avg >= 60 ? '心配することあんまりないと思いますよ。ええ家です、ほんまに。' : 'ぶつかるとこはあるけど、そのぶん鍛えられる家です。上の「注意」だけ意識してもろたら、だいぶ変わりますよ。'}</p></section>`);

    // 相性一覧
    out.push(`<details class="k-sec k-all"><summary>2人ずつの相性を全部見る（${r.pairs.length}組）</summary>
      ${r.pairs.map(p => `<div class="k-pair"><div class="k-pair-h"><b>${nm(p.a)} × ${nm(p.b)}</b><span>${p.score}点・${p.label}</span></div><ul>${p.notes.map(n => `<li>${n}</li>`).join('')}</ul><p class="k-tip">コツ：${p.tip}</p></div>`).join('')}
    </details>`);

    out.push(`<section class="k-sec k-basis"><h2>この占いの根拠</h2><ul>
      <li><b>四柱推命</b>：年柱・月柱・日柱を計算。年と月の切り替わり（立春・節入り）は、太陽の位置を天文計算して日本時間で判定してます。人柄は日干と日支、関係は干合・支合・冲・三合と五行の相生・相剋で見てます。中心星は月干の通変星で見てます（流派によっては月支の蔵干で見ます）。「時期を読むと」は、毎年の天干が日干にとって何にあたるか（通変星）で、立春から次の立春の前日までを1年として区切ってます。年齢と学年はその期間の最初の日と最後の日の満年齢・学年です。</li>
      <li><b>九星気学</b>：立春で区切った生まれ年から本命星を出してます。「節目」は本命星が年盤の中宮に入る年です。</li>
      <li><b>西洋占星術</b>：太陽と月の位置を天文計算して、日本時間の正午で星座を判定してます。その日のうちに境目をまたぐ人には※を付けてます。</li>
      <li>生まれた時刻を使わへんので、時柱・アセンダント・大運は出してません。</li>
      <li>計算は、1900年1月1日〜2026年10月7日の全46,301日で、干支暦ライブラリ（lunar-javascript）と天文計算ライブラリ（PyEphem）の結果と突き合わせて確認済みです。日柱は全日一致。年柱・月柱・九星・星座のちがいは、すべて※を付ける「境目の日」だけでした。</li>
      <li>占いはエンタメです。科学的な根拠はありません。</li>
    </ul></section>`);

    return out.join('\n');
  }

  // ---------- 結果をテキストにする（お客さんのケータイに保存する用） ----------

  function reportText(html, made) {
    let t = html;
    t = t.replace(/<summary>[\s\S]*?<\/summary>/g, '');
    t = t.replace(/<h1>([\s\S]*?)<\/h1>/g, '\n【$1】\n\n');
    t = t.replace(/<h2>([\s\S]*?)<span>([\s\S]*?)<\/span><\/h2>/g, '\n\n■ $1\n　$2\n\n');
    t = t.replace(/<h2>([\s\S]*?)<\/h2>/g, '\n\n■ $1\n\n');
    t = t.replace(/<h3>([\s\S]*?)<\/h3>/g, '\n▼ $1\n');
    // 顔ぶれの表：1人1行
    t = t.replace(/<thead>[\s\S]*?<\/thead>/g, '');
    t = t.replace(/<tr><th>([\s\S]*?)<small>([\s\S]*?)<\/small><\/th>([\s\S]*?)<\/tr>/g,
      (m, name, label, cells) => `・${name}（${label}）` + cells.replace(/<td>([\s\S]*?)<\/td>/g, '　$1') + '\n');
    // 時期の欄
    t = t.replace(/<span class="k-when">([\s\S]*?)<\/span><span class="k-age">([\s\S]*?)<\/span>/g, '$1（$2）\n　');
    t = t.replace(/<span class="k-src">([\s\S]*?)<\/span>/g, '［$1］');
    // 相性一覧の見出し行
    t = t.replace(/<div class="k-pair-h"><b>([\s\S]*?)<\/b><span>([\s\S]*?)<\/span><\/div>/g, '\n◆ $1（$2）\n');
    t = t.replace(/<li>/g, '・').replace(/<\/li>/g, '\n');
    t = t.replace(/<blockquote>/g, '\n「').replace(/<\/blockquote>/g, '」\n');
    t = t.replace(/<br\s*\/?>/g, '\n').replace(/<\/p>/g, '\n\n').replace(/<\/(ul|pre|section|details|table)>/g, '\n');
    t = t.replace(/<[^>]+>/g, '');
    t = t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    t = t.split('\n').map(l => l.replace(/^[ \t]+|[ \t]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const head = `うらないの部屋　家族まとめ占い\n作成日：${made}（年齢・学年・「いま」はこの日の時点です）\n${'='.repeat(24)}\n`;
    const foot = `\n\n${'='.repeat(24)}\n※ 占いはエンタメです。四柱推命・九星気学・西洋占星術の決まりごとから計算してますが、科学的根拠はありません。\n`;
    return head + t + foot;
  }

  // ---------- QRコード用：生年月日と名前をURLの「#」の後ろに入れる ----------
  // 「#」より後ろはサーバーに送られへんので、生年月日はお客さんのケータイの中だけで使われる。
  // 形：[版=1][人数] ＋ 人ごとに [1900/1/1からの日数(2バイト)][名前のバイト数][名前(UTF-8)] を base64url に

  const SITE_URL = 'https://mochiaiochiai-collab.github.io/claude/';
  const DAY0 = jdn(1900, 1, 1);

  function utf8(str, maxBytes) {
    const out = [];
    for (const ch of str) {
      const b = Array.from(unescape(encodeURIComponent(ch)), c => c.charCodeAt(0));
      if (out.length + b.length > maxBytes) break;
      out.push(...b);
    }
    return out;
  }

  function encodeShare(people) {
    const bytes = [1, people.length];
    for (const p of people) {
      const days = jdn(p.date.y, p.date.m, p.date.d) - DAY0;
      const name = utf8(p.name || '', 36);
      bytes.push(days >> 8, days & 255, name.length, ...name);
    }
    const bin = String.fromCharCode(...bytes);
    const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeShare(token) {
    try {
      if (!/^[A-Za-z0-9_-]{8,600}$/.test(token)) return null;
      const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
      const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      const bytes = Array.from(bin, c => c.charCodeAt(0));
      if (bytes[0] !== 1) return null;
      const n = bytes[1];
      if (!(n >= 2 && n <= MAX_PEOPLE)) return null;
      const people = [];
      let i = 2;
      for (let k = 0; k < n; k++) {
        if (i + 3 > bytes.length) return null;
        const days = (bytes[i] << 8) | bytes[i + 1];
        const len = bytes[i + 2];
        i += 3;
        if (len > 36 || i + len > bytes.length) return null;
        const name = decodeURIComponent(escape(String.fromCharCode(...bytes.slice(i, i + len))));
        i += len;
        const dt = new Date(Date.UTC(1900, 0, 1) + days * 86400000);
        const digits = `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
        const date = parseDigits(digits);
        if (!date) return null;
        people.push({ name: name.replace(/[\u0000-\u001f]/g, '').trim() || `${k + 1}人目`, date });
      }
      return i === bytes.length ? people : null;
    } catch {
      return null;
    }
  }

  // QRに入れるURL：GitHub Pages で開いてるならそのURL、それ以外（手元のファイルなど）は公開先のURL
  function shareUrl(token) {
    const here = typeof location !== 'undefined' && /\.github\.io$/.test(location.hostname) ? location.origin + location.pathname : SITE_URL;
    return `${here}#${token}`;
  }

  // QRコードの部品は iPad 側だけで読み込む（お客さんのケータイには読み込ませへん）
  let qrLib = null;
  function loadQr(doc) {
    if (!qrLib) {
      qrLib = new Promise((resolve, reject) => {
        if (typeof qrcode === 'function') return resolve(qrcode);
        const sc = doc.createElement('script');
        sc.src = 'vendor/qrcode.js';
        sc.onload = () => resolve(window.qrcode);
        sc.onerror = () => { qrLib = null; reject(new Error('qr')); };
        doc.head.appendChild(sc);
      });
    }
    return qrLib;
  }

  // ---------- 入力UI（数字ボタンで8桁） ----------

  const STORE = 'uranai.kazoku.v1';
  const MAX_PEOPLE = 10;

  function setupKazoku(doc) {
    const $ = id => doc.getElementById(id);
    if (!$('k-people')) return;

    const shared = typeof location !== 'undefined' && location.hash.length > 1 ? decodeShare(location.hash.slice(1)) : null;
    if (shared) {
      doc.body.classList.add('phone');
      $('k-input').hidden = true;
      $('k-result').hidden = false;
      const now = new Date();
      const made = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
      const text = reportText(renderReport(familyReading(shared, now)), made);
      $('k-dl-names').textContent = shared.map(p => p.name).join('・');
      $('k-dl-size').textContent = `テキストファイル・約${Math.max(1, Math.round(new Blob([text]).size / 1024))}KB`;
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      $('k-dl').addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
        const a = doc.createElement('a');
        a.href = url;
        a.download = `uranai_${stamp}.txt`; // 日本語のファイル名は落とされるブラウザがあるので英数字にする
        doc.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        $('k-dl-done').hidden = false;
      });
      // ダウンロードできへんアプリ内ブラウザ（LINE など）用：全文コピー
      $('k-copy').addEventListener('click', () => {
        const ok = () => { $('k-copy-msg').textContent = 'コピーしました。メモ帳アプリなどに貼りつけて保存してください。'; };
        const fallback = () => {
          const ta = $('k-copy-text');
          ta.hidden = false; ta.value = text; ta.focus(); ta.select();
          $('k-copy-msg').textContent = 'コピーできへんかったので、下の文章を長押しして全部選んでコピーしてください。';
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
        else fallback();
      });
      return;
    }
    if (typeof location !== 'undefined' && location.hash.length > 1) {
      $('k-msg').textContent = 'リンクの中身が読めませんでした。QRコードをもう一回読みとってみてください。';
    }
    // iPad 側：通信が切れても QR が出せるように、開いた時点で QR の部品を読み込んでおく
    loadQr(doc).catch(() => {});

    const blank = () => [0, 1, 2, 3].map(() => ({ name: '', digits: '' }));
    let people;
    try { people = JSON.parse(localStorage.getItem(STORE)); } catch { people = null; }
    if (!Array.isArray(people) || people.length < 2) people = blank();
    // from 番目以降で、まだ生年月日が入ってへない最初の人（なければ -1）
    const firstOpen = from => people.findIndex((q, j) => j >= from && q.digits.length < 8);
    let active = firstOpen(0);
    const save = () => { try { localStorage.setItem(STORE, JSON.stringify(people)); } catch { /* 保存できへん環境でも動く */ } };
    const step = n => { doc.body.dataset.step = String(n); };

    const shown = digits => {
      const s = digits.padEnd(8, '_');
      return `${s.slice(0, 4)} / ${s.slice(4, 6)} / ${s.slice(6, 8)}`;
    };
    const dateOk = p => p.digits.length === 8 && !!parseDigits(p.digits);

    // 人の数が変わったときだけ作り直す（入力中の名前欄を壊さへんため）
    function render() {
      $('k-people').innerHTML = people.map((p, i) => `
        <div class="k-row" data-i="${i}">
          <span class="k-num">${i + 1}人目</span>
          <input id="k-name-${i}" class="k-name" data-i="${i}" type="text" maxlength="12" placeholder="名前（なんでもOK）" value="${esc(p.name)}">
          <button type="button" id="k-date-${i}" class="k-date" data-i="${i}">
            <span class="k-date-l">生年月日</span><span class="k-date-v"></span>
          </button>
          ${people.length > 2 ? `<button type="button" class="k-del" data-i="${i}" aria-label="${i + 1}人目を消す">消す</button>` : ''}
        </div>`).join('');
      $('k-add').disabled = people.length >= MAX_PEOPLE;
      $('k-add').textContent = people.length >= MAX_PEOPLE ? `${MAX_PEOPLE}人までやで` : `＋ 人を足す（${MAX_PEOPLE}人まで）`;
      paint();
    }

    // 行の色・日付・テンキーの表示だけを更新する
    function paint() {
      people.forEach((p, i) => {
        const row = $('k-people').children[i];
        row.classList.toggle('open', i === active);
        row.classList.toggle('done', dateOk(p));
        row.querySelector('.k-date-v').textContent = shown(p.digits);
      });
      const a = people[active];
      const nm = a && a.name.trim();
      $('k-pad-label').textContent = a ? `${active + 1}人目${nm ? `（${nm}）` : ''}の生年月日` : '生年月日を入れる人の行をタップしてください';
      $('k-pad-disp').textContent = shown(a ? a.digits : '');
    }

    function setActive(i) {
      if (i === active) return;
      active = i;
      $('k-pad-msg').textContent = '';
      paint();
    }

    $('k-people').addEventListener('input', e => {
      if (e.target.classList.contains('k-name')) {
        people[Number(e.target.dataset.i)].name = e.target.value;
        save(); paint();
      }
    });
    $('k-people').addEventListener('focusin', e => {
      if (e.target.classList.contains('k-name')) setActive(Number(e.target.dataset.i));
    });

    $('k-people').addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.classList.contains('k-del')) {
        people.splice(Number(t.dataset.i), 1);
        active = firstOpen(0);
        $('k-pad-msg').textContent = '';
        save(); render();
        return;
      }
      if (t.classList.contains('k-date')) setActive(Number(t.dataset.i));
    });

    doc.querySelector('.k-keys').addEventListener('click', e => {
      const t = e.target.closest('.k-key');
      if (!t || active < 0) return;
      const p = people[active];
      const k = t.dataset.k;
      $('k-pad-msg').textContent = '';
      if (k === 'clear') p.digits = '';
      else if (k === 'back') p.digits = p.digits.slice(0, -1);
      else if (p.digits.length < 8) p.digits += k;
      save();

      if (p.digits.length === 8) {
        if (!parseDigits(p.digits)) {
          paint();
          $('k-pad-msg').textContent = 'その日付はないみたいやで。1900年以降の、今日までの日付を入れてな';
          return;
        }
        // 次のまだ入ってへん人へ進む
        const next = firstOpen(active + 1);
        active = next >= 0 ? next : firstOpen(0);
        paint();
        if (active >= 0) $(`k-date-${active}`).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      paint();
    });

    $('k-add').addEventListener('click', () => {
      if (people.length >= MAX_PEOPLE) return;
      people.push({ name: '', digits: '' });
      active = people.length - 1;
      save(); render();
      $(`k-name-${active}`).focus();
    });

    $('k-go').addEventListener('click', () => {
      const msg = $('k-msg');
      const filled = people.map((p, i) => ({ ...p, i })).filter(p => p.digits.length > 0);
      const bad = filled.find(p => !parseDigits(p.digits));
      if (bad) { msg.textContent = `${bad.i + 1}人目の生年月日が途中か、ありえへん日付になってるで`; return; }
      if (filled.length < 2) { msg.textContent = '2人以上の生年月日を入れてな'; return; }
      msg.textContent = '';
      const list = filled.map(p => ({ name: p.name.trim() || `${p.i + 1}人目`, date: parseDigits(p.digits) }));
      showSummary(familyReading(list));
      $('k-input').hidden = true;
      $('k-result').hidden = false;
      step(3);
      window.scrollTo(0, 0);
      showQr(encodeShare(list));
    });

    // 結果のあらまし（くわしい文章はケータイのファイルに入ってる）
    function showSummary(r) {
      $('k-sum-n').textContent = `${r.charts.length}人の家族は`;
      $('k-sum-title').textContent = r.house.title;
      $('k-sum-text').textContent = r.house.strong;
      $('k-sum-list').innerHTML = r.charts.map(c => `
        <div class="k-sum-row"><b>${esc(c.name)}</b><span>${pillarStr(c.p.day)}</span><span>${KYUSEI[c.kyusei][0]}${c.p.risshunDay ? '※' : ''}</span><span>${c.sun.name}${c.sunAlt ? '※' : ''}</span></div>`).join('');
    }

    function showQr(token) {
      const url = shareUrl(token);
      $('k-qr-img').innerHTML = '';
      $('k-qr-msg').textContent = 'QRコードを作ってます…';
      loadQr(doc).then(qr => {
        const q = qr(0, 'M');
        q.addData(url);
        q.make();
        $('k-qr-img').innerHTML = q.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
        $('k-qr-msg').textContent = '';
      }).catch(() => {
        $('k-qr-msg').textContent = 'QRコードの部品が読み込めませんでした。通信がつながってるときにページを開き直してください。';
      });
    }

    const back = () => {
      $('k-result').hidden = true;
      $('k-input').hidden = false;
      step(1);
      window.scrollTo(0, 0);
    };
    $('k-back').addEventListener('click', back);

    // 次のお客さんへ：入力と結果を全部消す（イベントで前の人のデータが見えへんように）
    $('k-next').addEventListener('click', () => { $('k-next-confirm').hidden = false; });
    $('k-next-no').addEventListener('click', () => { $('k-next-confirm').hidden = true; });
    $('k-next-yes').addEventListener('click', () => {
      people = blank();
      active = 0;
      try { localStorage.removeItem(STORE); } catch { /* 保存できへん環境 */ }
      $('k-sum-list').innerHTML = '';
      $('k-next-confirm').hidden = true;
      $('k-qr-img').innerHTML = '';
      $('k-pad-msg').textContent = '';
      render();
      back();
    });

    render();
  }

  const api = { reportText, encodeShare, decodeShare, shareUrl, ageAt, spanLabel, risshunDate, tsuhenOf, jdn, parseDigits, pillars, pillarStr, sunLongitude, sunSign, moonLongitude, moonSign, chart, compat, familyReading, renderReport, flowOf, kyuseiOfYear, personLabel, setupKazoku, STEMS, BRANCHES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => setupKazoku(document));
  root.Kazoku = api;
})(typeof window !== 'undefined' ? window : globalThis);
