const assert = require('assert');

// ---------- 家族まとめ占い ----------
const K = require('./family.js');
const P = d => K.parseDigits(d);

// 日柱：2000/1/1 = 戊午、1984/2/4（立春後）の年柱 = 甲子
assert.strictEqual(K.pillarStr(K.pillars(P('20000101')).day), '戊午');
assert.strictEqual(K.pillarStr(K.pillars(P('19840210')).year), '甲子');
assert.strictEqual(K.pillarStr(K.pillars(P('19741202')).year) + K.pillarStr(K.pillars(P('19741202')).month) + K.pillarStr(K.pillars(P('19741202')).day), '甲寅乙亥丁丑');
assert.strictEqual(K.pillarStr(K.pillars(P('19840115')).year), '癸亥'); // 立春前は前年
// 月柱：甲年の寅月は丙寅、2024/3/10 は甲辰年の卯月 → 丁卯
assert.strictEqual(K.pillarStr(K.pillars(P('19840210')).month), '丙寅');
assert.strictEqual(K.pillarStr(K.pillars(P('20240310')).month), '丁卯');

// 太陽星座の境目
for (const [d, want] of [['20000101', 'やぎ座'], ['20000121', 'みずがめ座'], ['20000321', 'おひつじ座'], ['20001220', 'いて座'], ['20001222', 'やぎ座']]) {
  assert.strictEqual(K.sunSign(P(d).y, P(d).m, P(d).d).sign.name, want, d);
}
// ---------- 参照データとの突き合わせ ----------
// test-fixtures.json：1900〜2026年からランダムに選んだ日＋境目の日。
// [日付, 日柱(lunar-javascript), 太陽黄経(PyEphem, 日本時間正午), 月黄経(同)]
const SIGN_NAMES = ['おひつじ座','おうし座','ふたご座','かに座','しし座','おとめ座','てんびん座','さそり座','いて座','やぎ座','みずがめ座','うお座'];
const norm = x => ((x % 360) + 360) % 360;
for (const [iso, dayRef, sunLon, moonLon] of require('./test-fixtures.json')) {
  const [y, m, d] = iso.split('-').map(Number);
  const p = K.pillars({ y, m, d });
  assert.strictEqual(K.pillarStr(p.day), dayRef, `日柱 ${iso}`);
  const k = Math.floor(norm(sunLon - 315) / 30);
  if (!p.setsuDay) assert.strictEqual((p.month[1] + 10) % 12, k, `月柱 ${iso}`);
  if (!p.risshunDay) assert.strictEqual(p.solarYear, m <= 2 && k >= 10 ? y - 1 : y, `年 ${iso}`);
  const ss = K.sunSign(y, m, d);
  if (!ss.alt) assert.strictEqual(ss.sign.name, SIGN_NAMES[Math.floor(sunLon / 30)], `太陽 ${iso}`);
  const ms = K.moonSign(y, m, d);
  if (!ms.alt) assert.strictEqual(ms.sign.name, SIGN_NAMES[Math.floor(moonLon / 30)], `月 ${iso}`);
  const jd = K.jdn(y, m, d) - 0.375;
  assert.ok(Math.abs(((K.sunLongitude(jd) - sunLon + 540) % 360) - 180) < 0.02, `太陽黄経 ${iso}`);
  assert.ok(Math.abs(((K.moonLongitude(y, m, d) - moonLon + 540) % 360) - 180) < 0.5, `月黄経 ${iso}`);
}

// 日本時間の立春：1984年は2/5 0:04、2017年は2/4 0:23（中国時間やと前日になる年）
assert.strictEqual(K.pillarStr(K.pillars(P('19840204')).year), '癸亥');
assert.strictEqual(K.pillarStr(K.pillars(P('19840205')).year), '甲子');
assert.strictEqual(K.pillars(P('19840205')).risshunDay, true);
assert.strictEqual(K.pillars(P('20170203')).solarYear, 2016);
assert.strictEqual(K.pillars(P('20170204')).risshunDay, true);
assert.strictEqual(K.pillars(P('20170210')).setsuDay, false);

// 不正な日付
assert.strictEqual(P('20130231'), null);
assert.strictEqual(P('18991231'), null);
assert.strictEqual(P('2013041'), null);

// 4人で回して、組の数・点数範囲・HTMLを確認
const fam = K.familyReading([
  { name: 'A', date: P('19750312') }, { name: 'B', date: P('19800707') },
  { name: 'C', date: P('20130401') }, { name: '<b>D</b>', date: P('20150820') },
]);
assert.strictEqual(fam.pairs.length, 6);
fam.pairs.forEach(p => assert.ok(p.score >= 20 && p.score <= 98));
const html = K.renderReport(fam);
assert.ok(!html.includes('<b>D</b>') && html.includes('&lt;b&gt;D&lt;/b&gt;'), '名前はエスケープ');
assert.ok(!/undefined|NaN/.test(html), 'undefined/NaN が出てない');
// 保存する結果HTML：構成・名前のエスケープ・見出しが家ごとにちがう
const out = K.resultHtml(fam, new Date(2026, 9, 18), {});
['この家は・・・', '３つの占いからあぶり出す個性', 'これから10年の流れ', 'これからどう育ってく？？', '円満・開運ポイント', 'viewport'].forEach(k => assert.ok(out.includes(k), k));
assert.ok(!out.includes('<b>D</b>') && out.includes('&lt;b&gt;D&lt;/b&gt;'), 'HTMLでも名前はエスケープ');
assert.ok(!/undefined|NaN/.test(out), 'HTMLに undefined/NaN が出てない');
const titles = new Set();
for (let i = 0; i < 40; i++) {
  const ps = [0, 1, 2].map(j => ({ name: 'p' + j, date: { y: 1950 + ((i * 7 + j * 13) % 60), m: 1 + ((i + j * 5) % 12), d: 1 + ((i * 3 + j) % 28) } }));
  titles.add(K.familyReading(ps, new Date(2026, 9, 18)).house.title);
}
assert.ok(titles.size >= 8, `見出しがいろいろ出る（${titles.size}通り）`);
console.log('family tests passed', fam.house.title, fam.pairs.map(p => p.score).join(','));

// 九星（立春で区切った年）
assert.strictEqual(K.kyuseiOfYear(1974), 8); // 八白土星
assert.strictEqual(K.kyuseiOfYear(1979), 3); // 三碧木星
assert.strictEqual(K.kyuseiOfYear(2014), 4); // 四緑木星
assert.strictEqual(K.kyuseiOfYear(2015), 3);
assert.strictEqual(K.kyuseiOfYear(2026), 1); // 2026年は一白水星の年

// 学年（4/2〜翌4/1が同学年）
const now = new Date(2026, 9, 7);
assert.strictEqual(K.personLabel(P('20140305'), now), '12歳・中1');
assert.strictEqual(K.personLabel(P('20151121'), now), '10歳・小5');
assert.strictEqual(K.personLabel(P('20140401'), now), '12歳・中1'); // 4/1生まれは早生まれ
assert.strictEqual(K.personLabel(P('20140402'), now), '12歳・小6');
assert.strictEqual(K.personLabel(P('19741202'), now), '51歳');

// 世代分けと、レポートに必要な見出しが出るか
const f2 = K.familyReading([
  { name: 'P1', date: P('19741202') }, { name: 'P2', date: P('19790413') },
  { name: 'C1', date: P('20140305') }, { name: 'C2', date: P('20151121') },
], now);
assert.strictEqual(f2.gens.length, 2);
assert.deepStrictEqual(f2.gens.map(g => g.map(c => c.name)), [['P1', 'P2'], ['C1', 'C2']]);
const rep = K.renderReport(f2);
for (const h of ['顔ぶれ', 'この家の構造', '時期を読むと', '関わり方', '一個だけ注意', 'P1とP2について', 'まとめますわ', 'この占いの根拠']) {
  assert.ok(rep.includes(h), `見出し ${h}`);
}
assert.ok(!/undefined|NaN|null/.test(rep.replace(/k-null/g, '')), 'undefined/NaN/null が出てない');

// 1人だけの世代・3世代・2人だけでも落ちへん
for (const set of [['19480229', '19750312', '20130401'], ['20000101', '20010101'], ['19500505', '19520606', '19800101', '20100101', '20120202']]) {
  const r = K.familyReading(set.map((d, i) => ({ name: 'X' + i, date: P(d) })), now);
  const h2 = K.renderReport(r);
  assert.ok(!/undefined|NaN/.test(h2), set.join(','));
}
console.log('report tests passed');

// 立春の日付（PyEphem で求めた日本時間の立春：2028年は2/4 16:28、2029年は2/3 22:19 など）
const RISSHUN = { 2026: 4, 2027: 4, 2028: 4, 2029: 3, 2030: 4, 2031: 4, 2032: 4, 2033: 3, 2034: 4, 2035: 4, 2036: 4, 2037: 3 };
for (const [y, d] of Object.entries(RISSHUN)) assert.strictEqual(K.risshunDate(Number(y)).d, d, `立春 ${y}`);

// 満年齢：誕生日の前日まではひとつ下
assert.strictEqual(K.ageAt({ y: 2014, m: 3, d: 5 }, { y: 2026, m: 3, d: 4 }), 11);
assert.strictEqual(K.ageAt({ y: 2014, m: 3, d: 5 }, { y: 2026, m: 3, d: 5 }), 12);
// 期間ラベル：年齢と学年をその期間の最初と最後の日で出す
assert.strictEqual(K.spanLabel({ y: 2015, m: 11, d: 21 }, { y: 2028, m: 2, d: 4 }, { y: 2030, m: 2, d: 3 }), '12〜14歳・小6〜中2');
assert.strictEqual(K.spanLabel({ y: 2014, m: 3, d: 5 }, { y: 2032, m: 2, d: 4 }, { y: 2033, m: 2, d: 2 }), '17〜18歳・高3〜卒業後');
assert.strictEqual(K.spanLabel({ y: 1974, m: 12, d: 2 }, { y: 2026, m: 10, d: 10 }, { y: 2028, m: 2, d: 3 }), '51〜53歳');

// 中心星（月干の通変星）
assert.strictEqual(K.tsuhenOf(0, 2), '食神');  // 甲→丙
assert.strictEqual(K.tsuhenOf(6, 3), '正官');  // 庚→丁
assert.strictEqual(K.tsuhenOf(2, 1), '印綬');  // 丙→乙
assert.strictEqual(K.tsuhenOf(5, 4), '劫財');  // 己→戊

// 時期の欄：表の年齢と、「いま」から始まる最初の期間の年齢がそろってる。期間はすきまなく続く
{
  const now2 = new Date(2026, 9, 10);
  const fam3 = K.familyReading([
    { name: 'P1', date: P('19741202') }, { name: 'P2', date: P('19790413') },
    { name: 'C1', date: P('20140305') }, { name: 'C2', date: P('20151121') },
  ], now2);
  const html3 = K.renderReport(fam3);
  for (const c of fam3.charts) {
    const sec = html3.slice(html3.indexOf(`<h2>${c.name}（`));
    const firstAge = sec.match(/<span class="k-age">(\d+)/)[1];
    assert.strictEqual(Number(firstAge), K.ageAt(c.date, { y: 2026, m: 10, d: 10 }), `${c.name} 最初の期間の年齢`);
    assert.ok(sec.startsWith(`<h2>${c.name}（${firstAge}歳`), `${c.name} 見出しの年齢`);
  }
  // 同じ九星の2人（P2 と C2 は三碧木星）は、同じ段落をくり返さへん
  const star3 = '先陣切る、声出す';
  assert.strictEqual(html3.split(star3).length - 1, 1, '同じ九星の説明は1回だけ');
}
console.log('timeline tests passed');

// ランダムな家族でレポートの矛盾をチェック（くわしくは node check.js）
{
  const fails = require('./check.js').run(500, 42);
  assert.strictEqual(fails.size, 0, [...fails].map(([k, v]) => `${k}: ${v.examples[0]}`).join('\n'));
  console.log('random family check passed');
}

// QRコード用の符号化：元に戻せる・壊れたリンクは受け付けへん
{
  const list = [
    { name: 'お父さん', date: P('19741202') }, { name: 'B&<x>', date: P('19790413') },
    { name: '', date: P('20140305') }, { name: '名前がとても長い人の名前です', date: P('19000101') },
  ];
  const tok = K.encodeShare(list);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(tok), 'URLに使える文字だけ');
  const back = K.decodeShare(tok);
  assert.deepStrictEqual(back.map(p => p.date), list.map(p => p.date));
  assert.strictEqual(back[0].name, 'お父さん');
  assert.strictEqual(back[1].name, 'B&<x>');
  assert.strictEqual(back[2].name, '3人目');
  assert.ok(back[3].name.length <= 12 && '名前がとても長い人の名前です'.startsWith(back[3].name), '長い名前は36バイトで切る');
  for (const badTok of ['', 'abc', tok.slice(0, -3), tok + 'AAAA', '!!!!!!!!!!', 'AQAAAAAAAAAA']) assert.strictEqual(K.decodeShare(badTok), null, `壊れたリンク ${badTok}`);
  const url = K.shareUrl(tok);
  assert.ok(url.startsWith('https://mochiaiochiai-collab.github.io/claude/#'));
  console.log('share tests passed', `URL ${url.length}文字`);
}
