'use strict';
// ランダムな家族をたくさん作って、結果レポートに矛盾がないかを機械でチェックする。
//   node check.js          … 1万家族
//   node check.js 100000   … 件数を指定
// AIは使わへん。占いのコードをそのまま動かして、出てきた文章を読んで確かめるだけ。

const K = require('./family.js');

function run(N, seed = 1) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const now = new Date(2026, 9, 10);
  const today = { y: 2026, m: 10, d: 10 };
  const T0 = new Date(1900, 0, 1).getTime(), T1 = new Date(2026, 9, 10).getTime();
  // わざと境目の日（立春・節入り・2/29・今日・1900/1/1）も混ぜる
  const EDGE = [[1900, 1, 1], [2026, 10, 10], [2000, 2, 29], [1984, 2, 4], [1984, 2, 5], [2017, 2, 3], [2017, 2, 4], [2014, 4, 1], [2014, 4, 2], [1999, 12, 31]];
  const randDate = () => {
    if (rnd() < 0.05) { const [y, m, d] = EDGE[Math.floor(rnd() * EDGE.length)]; return { y, m, d }; }
    const dt = new Date(T0 + rnd() * (T1 - T0));
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  };
  const NAMES = ['あ', 'Bob', '<b>x</b>', 'ﾀﾝ', '名前が長い人です', 'A&B', '"q"', 'X'];

  const fails = new Map();
  const fail = (kind, msg) => {
    if (!fails.has(kind)) fails.set(kind, { count: 0, examples: [] });
    const f = fails.get(kind);
    f.count++;
    if (f.examples.length < 3) f.examples.push(msg);
  };
  const strip = h => h.replace(/<[^>]+>/g, '');
  const parseJa = t => { const m = t.match(/(\d+)年(\d+)月(\d+)日/); return m && { y: +m[1], m: +m[2], d: +m[3] }; };
  const nextDay = ({ y, m, d }) => { const dt = new Date(y, m - 1, d + 1); return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }; };
  const same = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;

  for (let i = 0; i < N; i++) {
    const n = 2 + Math.floor(rnd() * 6);
    const people = Array.from({ length: n }, (_, j) => ({ name: rnd() < 0.2 ? NAMES[Math.floor(rnd() * NAMES.length)] + j : `人${j + 1}`, date: randDate() }));
    const tag = people.map(p => `${p.date.y}/${p.date.m}/${p.date.d}`).join(',');
    let r, html;
    try {
      r = K.familyReading(people, now);
      html = K.renderReport(r);
    } catch (e) {
      fail('落ちた', `${tag} ${e.message}`);
      continue;
    }
    const text = strip(html);

    // 1. おかしな文字が混ざってない
    if (/undefined|NaN|null|\[object/.test(text)) fail('undefined/NaN が出てる', tag);
    if (/（）|、、|。。/.test(text)) fail('空のカッコや重なった句読点', `${tag} ${text.match(/.{10}(（）|、、|。。).{10}/)?.[0]}`);
    if (/<b>x<\/b>/.test(html)) fail('名前がエスケープされてない', tag);

    // 1b. 保存するHTML（結果ファイル）：落ちない・変な文字がない・名前のエスケープ・全員ぶんの年齢と区切り
    try {
      const out = K.resultHtml(r, now, {});
      const body = strip(out.slice(out.indexOf('<body>')));
      if (/undefined|NaN|null|\[object/.test(body)) fail('結果HTMLに undefined/NaN', tag);
      if (/（）|、、|。。/.test(body)) fail('結果HTMLに空のカッコや重なった句読点', `${tag} ${body.match(/.{10}(（）|、、|。。).{10}/)?.[0]}`);
      if (/<b>x<\/b>/.test(out)) fail('結果HTMLで名前がエスケープされてない', tag);
      const buckets = (out.match(/class="tc/g) || []).length;
      if (buckets < 5 || buckets > 6) fail('結果HTMLの10年の区切りの数', `${tag} ${buckets}`);
      if ((out.match(/class="tr"/g) || []).length !== buckets * people.length) fail('結果HTMLの年表の行数', tag);
      if ((out.match(/class="pc"/g) || []).length !== people.length) fail('結果HTMLのひとりずつの数', tag);
      if (new Set(out.match(/<h2>この家は|<h2>[^<]*<\/h2>/g)).size < 1) fail('結果HTMLに見出しがない', tag);
    } catch (e) {
      fail('結果HTMLで落ちた', `${tag} ${e.message}`);
      continue;
    }

    // 2. 同じ段落が2回出てない
    const paras = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => m[1].trim()).filter(t => t.length > 20);
    // 子どもの関わり方の項目：名前だけちがう同じ文も重複として数える
    const care = html.match(/の関わり方、[\s\S]*?<\/ul>/);
    if (care) paras.push(...[...care[0].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1].replace(/^<b>[^<]*?(には|にも|：)/, '<b>$1')));
    const seenP = new Set();
    for (const p of paras) { if (seenP.has(p)) fail('同じ段落・項目が2回出てる', `${tag} ${strip(p).slice(0, 40)}`); seenP.add(p); }

    for (const c of r.charts) {
      const nm = c.name.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const start = html.indexOf(`<h2>${nm}（`);
      if (start < 0) { fail('個人の欄がない', `${tag} ${c.name}`); continue; }
      const sec = html.slice(start, html.indexOf('</section>', start));
      const age = K.ageAt(c.date, today);

      // 3. 見出しの年齢 = 実際の満年齢
      const headAge = Number(sec.match(/^<h2>[^（]*（(\d+)歳/)?.[1]);
      if (headAge !== age) fail('見出しの年齢がちがう', `${tag} ${c.name} 見出し${headAge} 実際${age}`);

      // 4. 表の年齢・日柱・九星がこの人のもの
      const row = html.match(new RegExp(`<tr><th>${nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<small>([^<]+)</small></th><td>[^<]+</td><td>([^<]+)</td><td>([^<]+)</td>`));
      if (!row) fail('表に行がない', `${tag} ${c.name}`);
      else {
        if (!row[1].startsWith(`${age}歳`)) fail('表の年齢がちがう', `${tag} ${c.name} 表${row[1]} 実際${age}`);
        if (row[2] !== K.pillarStr(c.p.day)) fail('表の日柱がちがう', `${tag} ${c.name}`);
        const star = ['', '一白水星', '二黒土星', '三碧木星', '四緑木星', '五黄土星', '六白金星', '七赤金星', '八白土星', '九紫火星'][K.kyuseiOfYear(c.p.solarYear)];
        if (!row[3].startsWith(star)) fail('表の九星がちがう', `${tag} ${c.name} 表${row[3]} 計算${star}`);
      }

      // 5. 個人の欄の本文が、その人の日干・日柱のことを書いてる
      const twin = r.charts.find(o => o !== c && o.date.y === c.date.y && o.date.m === c.date.m && o.date.d === c.date.d && sec.includes('生年月日が同じ'));
      if (!twin && !sec.includes(`<b>${K.STEMS[c.dayStem]}は「`) && !sec.includes(`と同じ${K.STEMS[c.dayStem]}、`)) fail('日干の説明が別の人のもの', `${tag} ${c.name}`);
      if (twin) continue; // 生年月日が同じ人は、時期の欄も相手の欄を見る形
      if (!sec.includes(K.pillarStr(c.p.day))) fail('見出しに日柱がない', `${tag} ${c.name}`);

      // 6. 時期の欄：「いま」から始まる、すきまなく続く、年齢と学年が正しい
      const items = [...sec.matchAll(/<span class="k-when">([^<]+)<\/span><span class="k-age">([^<]+)<\/span><b>([^<]+)<\/b>/g)];
      if (!items.length) { fail('時期の欄がない', `${tag} ${c.name}`); continue; }
      if (!items[0][1].startsWith('いま〜')) fail('時期が「いま」から始まってない', `${tag} ${c.name}`);
      let prevEnd = null;
      for (const [, when, ageLabel, title] of items) {
        const [a, b] = when.split('〜');
        const from = a === 'いま' ? today : parseJa(a);
        const to = parseJa(b);
        if (!from || !to) { fail('期間の日付が読めへん', `${tag} ${c.name} ${when}`); continue; }
        if (new Date(from.y, from.m - 1, from.d) > new Date(to.y, to.m - 1, to.d)) fail('期間が逆', `${tag} ${c.name} ${when}`);
        if (to.m !== 2 || to.d < 1 || to.d > 5) fail('期間の終わりが立春の前日になってない', `${tag} ${c.name} ${when}`);
        const want = K.spanLabel(c.date, from, to);
        if (ageLabel !== want) fail('期間の年齢・学年がちがう', `${tag} ${c.name} ${when} 表示${ageLabel} 正しくは${want}`);
        const a1 = K.ageAt(c.date, from), a2 = K.ageAt(c.date, to);
        if (!ageLabel.startsWith(a1 === a2 ? `${a1}歳` : `${a1}〜${a2}歳`)) fail('期間の年齢の計算がずれてる', `${tag} ${c.name} ${when}`);
        if (title !== '九星の節目') {
          if (prevEnd && !same(nextDay(prevEnd), from)) fail('期間にすきま・重なりがある', `${tag} ${c.name} ${when}`);
          prevEnd = to;
        }
      }
      if (!items[0][2].startsWith(`${age}`)) fail('最初の期間の年齢が今の年齢とちがう', `${tag} ${c.name}`);
    }

    // 8. ケータイに保存するテキスト：タグや記号の残りがない、全員の名前と根拠まで入ってる
    const txt = K.reportText(html, '2026年10月10日');
    const txtNoNames = r.charts.reduce((t, c) => t.split(c.name).join('〇'), txt); // 名前に記号を入れた人はそのまま出てええ
    if (/<[a-z\/]|&(amp|lt|gt|quot|#39);/.test(txtNoNames)) fail('テキストにHTMLが残ってる', `${tag} ${txtNoNames.match(/.{10}(<[a-z\/]|&\w+;).{10}/)?.[0]}`);
    if (/\n{3,}/.test(txt)) fail('テキストに空行が続いてる', tag);
    for (const c of r.charts) if (!txt.includes(`■ ${c.name}（`)) fail('テキストに個人の欄がない', `${tag} ${c.name}`);
    if (!txt.includes('■ この占いの根拠')) fail('テキストが途中で切れてる', tag);
    if ((txt.match(/^◆ /gm) || []).length !== r.pairs.length) fail('テキストの相性一覧の組数がちがう', tag);

    // 7. 相性の点数：一覧の点数と、平均・いちばん・注意の組がつじつま合ってる
    const listed = [...html.matchAll(/<span>(\d+)点・/g)].map(m => +m[1]);
    if (listed.length !== r.pairs.length) fail('相性一覧の組数がちがう', tag);
    if (listed.some(v => v < 20 || v > 98)) fail('相性の点数が範囲外', tag);
    const avg = Math.round(listed.reduce((x, y) => x + y, 0) / listed.length);
    if (!text.includes(`平均は${avg}点`)) fail('平均点が一覧とあわへん', `${tag} 一覧から${avg}`);
    if (!text.includes(`（${Math.max(...listed)}点）`)) fail('いちばんのコンビの点数が一覧の最高点とちがう', tag);
  }
  return fails;
}

if (require.main === module) {
  const N = Number(process.argv[2]) || 10000;
  const t0 = Date.now();
  const fails = run(N);
  console.log(`${N}家族をチェック（${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
  if (!fails.size) console.log('問題なし');
  for (const [kind, f] of fails) console.log(`✗ ${kind}：${f.count}件\n   例：${f.examples.join('\n       ')}`);
  process.exitCode = fails.size ? 1 : 0;
}
module.exports = { run };
