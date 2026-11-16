// 運動特性評価エンジン（独自の推定スコア。能力の実測値ではなく、運動で能力を使った度合いの推定）
// ov：項目ごとの手動の修正（基本スコアを置きかえる）
// 運動の特性（0〜10、わからなければ null）→ 共通ルール → 各項目の要求度（0〜10）
const FEATURES = {
  int: "筋収縮の強度", dur: "筋収縮の持続時間", rfd: "力発揮速度", spd: "動作速度", rom: "関節可動域",
  load: "組織への機械的負荷", cmplx: "動作の複雑性", coord: "全身の協調性", post: "姿勢制御の要求度",
  repro: "動作の再現性", ext: "外部刺激への反応", pred: "予測の必要性", unc: "環境の不確実性",
  sens: "感覚情報の利用", cog: "認知的負荷", cardio: "心肺への負荷", psy: "心理的負荷", soc: "社会的交流", nov: "新規性",
  // 感覚の内訳（19の特性だけでは決められない感覚器系のための補助）
  vis: "目からの情報", aud: "音の手がかり", rot: "回転・上下動・逆さま", touch: "手足で触れる・つかむ",
  impact: "着地・衝撃・振動", therm: "暑さ・寒さ・水", track: "動く物を目で追う", dist: "距離・奥行きの判断", inner: "体の内側への注意",
};
// 項目ごとの共通ルール：特性の重み（合計1）。"~x" は (10 − x) を使う。cls は補正の種類。
const RULES = {
  msk: { n: "筋骨格系", items: {
    筋持久力: [{ dur: .6, int: .2, cardio: .2 }, "E"], 筋力: [{ int: .7, load: .3 }, "P"], パワー: [{ rfd: .5, spd: .3, int: .2 }, "P"],
    モビリティ: [{ rom: .85, coord: .15 }, "B"], 組織耐性: [{ load: .6, impact: .25, int: .15 }, "P"] } },
  neuro: { n: "脳神経系", items: {
    運動制御能力: [{ cmplx: .35, post: .25, coord: .2, sens: .2 }, "B"], 運動学習能力: [{ nov: .5, cmplx: .3, cog: .2 }, "L"],
    運動計画能力: [{ cmplx: .5, cog: .3, coord: .2 }, "L"], 協調性: [{ coord: .7, cmplx: .3 }, "B"], 反応能力: [{ ext: .6, spd: .2, unc: .2 }, "L"],
    予測能力: [{ pred: .6, unc: .2, ext: .2 }, "L"], 姿勢制御能力: [{ post: .8, unc: .2 }, "B"], 感覚統合能力: [{ sens: .5, post: .25, unc: .25 }, "B"],
    運動適応能力: [{ unc: .5, nov: .3, ext: .2 }, "L"], 神経筋動員能力: [{ rfd: .4, int: .4, spd: .2 }, "P"], 認知機能: [{ cog: .6, pred: .2, ext: .2 }, "L"],
    運動の自動化: [{ repro: .45, coord: .3, cmplx: .25 }, "A"] } },
  sense: { n: "感覚器系", items: {
    視覚: [{ vis: .8, unc: .2 }, "B"], 聴覚: [{ aud: 1 }, "B"], 前庭覚: [{ rot: .6, post: .25, spd: .15 }, "B"],
    固有受容覚: [{ sens: .4, post: .3, rom: .15, int: .15 }, "B"], 触覚: [{ touch: .8, sens: .2 }, "B"], 圧覚: [{ load: .4, touch: .3, int: .3 }, "B"],
    振動覚: [{ impact: 1 }, "B"], 温度覚: [{ therm: 1 }, "B"], 侵害受容: [null, "self"], 内受容感覚: [{ inner: .6, cardio: .4 }, "B"],
    関節位置覚: [{ sens: .4, rom: .3, post: .3 }, "B"], 運動覚: [{ coord: .4, spd: .3, rom: .3 }, "B"], 力覚: [{ int: .4, touch: .3, sens: .3 }, "P"],
    空間認識能力: [{ rot: .4, dist: .3, unc: .3 }, "B"], 動体視力: [{ track: 1 }, "B"], 深視力: [{ dist: 1 }, "B"], 身体認識能力: [{ inner: .4, sens: .3, coord: .3 }, "B"] } },
  cv: { n: "循環器系", items: { 心肺持久力: [{ cardio: .7, dur: .3 }, "E"], 血流: [{ cardio: .5, dur: .3, int: .2 }, "E"] } },
  endo: { n: "内分泌系", low: true, items: {
    成長ホルモン: [{ int: .5, cardio: .3, dur: .2 }, "P"], "テストステロン・エストロゲン": [{ int: .6, load: .4 }, "P"],
    コルチゾール: [{ dur: .5, psy: .3, cardio: .2 }, "E"], インスリン感受性: [{ dur: .5, cardio: .3, int: .2 }, "E"], カテコールアミン: [{ cardio: .4, psy: .3, spd: .3 }, "B"] } },
  mental: { n: "メンタル", items: {
    集中力: [{ cog: .3, cmplx: .25, pred: .15, psy: .3 }, "B"], 注意切り替え能力: [{ ext: .5, unc: .5 }, "L"], ストレス耐性: [{ psy: .7, cardio: .3 }, "E"],
    忍耐力: [{ dur: .4, cardio: .3, int: .1, psy: .2 }, "E"], チャレンジ精神: [{ psy: .6, nov: .4 }, "L"], マインドフルネス: [{ inner: 1 }, "B"],
    リラクゼーション能力: [{ inner: .6, "~cardio": .2, "~psy": .2 }, "B"], 社会的つながり: [{ soc: 1 }, "S"],
    // 運動の中身からは決めにくい項目：本人の自己評価だけで入る（入れなければ未評価）
    自己効力感: [null, "self"], 自己肯定感: [null, "self"], 感情調整能力: [null, "self"], レジリエンス: [null, "self"],
    モチベーション: [null, "self"], 自己制御能力: [null, "self"], 心理的柔軟性: [null, "self"] } },
};

// 基本スコア（1回30分ほど・普通の強度を想定）。わからない特性は計算から外し、全部わからなければ未評価(null)
function baseScores(f) {
  const out = {};
  for (const ax of Object.values(RULES)) for (const [item, [w]] of Object.entries(ax.items)) {
    if (!w) { out[item] = null; continue; }
    let s = 0, ws = 0;
    for (const [k, wt] of Object.entries(w)) { const inv = k[0] === "~", v = f[inv ? k.slice(1) : k]; if (v == null) continue; s += wt * (inv ? 10 - v : v); ws += wt; }
    out[item] = ws >= 0.5 ? Math.round((s / ws) * 10) / 10 : null; // 重みの半分以上がわかるときだけ評価
  }
  return out;
}

// その日の実施内容による補正（項目の性質ごとに違うルール）。入力しなかった条件は補正しない。
// s: { min, intensity: "low|mid|high", difficulty: "easy|mid|hard", exp: "new|some|used", env: "regular|irregular", people: "solo|group" }
const sat = (t, tau, cap) => Math.min(cap, (1 - Math.exp(-t / tau)) / (1 - Math.exp(-30 / tau)));
function modifier(cls, s = {}) {
  let m = 1;
  const t = +s.min > 0 ? +s.min : null;
  const I = { low: .8, mid: 1, high: 1.2 }[s.intensity] || 1;
  if (cls === "E") { if (t) m *= sat(t, 30, 1.3); m *= 1 + (I - 1) * .5; }
  if (cls === "P") { if (t) m *= sat(t, 8, 1.05); m *= I; }
  if (cls === "B") { if (t) m *= sat(t, 12, 1.15); m *= { easy: .9, hard: 1.1 }[s.difficulty] || 1; }
  if (cls === "L") {
    if (t) m *= sat(t, 15, 1.15);
    m *= { new: 1.25, used: .85 }[s.exp] || 1; m *= { regular: .9, irregular: 1.2 }[s.env] || 1; m *= { easy: .85, hard: 1.15 }[s.difficulty] || 1;
  }
  if (cls === "A") { if (t) m *= sat(t, 20, 1.2); m *= { new: .6, used: 1.2 }[s.exp] || 1; }
  if (cls === "S") m *= { solo: .2, group: 1.1 }[s.people] || 1;
  return m;
}
// 活動ポイント：基本スコア × 補正（1回10点まで）。自己評価は上書き。
function sessionPoints(f, s = {}, self = {}, ov = {}) {
  const base = { ...baseScores(f), ...ov }, out = {};
  for (const ax of Object.values(RULES)) for (const [item, [, cls]] of Object.entries(ax.items)) {
    if (cls === "self") { out[item] = self[item] != null ? +self[item] : null; continue; }
    out[item] = base[item] == null ? null : Math.min(10, Math.round(base[item] * modifier(cls, s) * 10) / 10);
    if (self[item] != null) out[item] = +self[item];
  }
  return out;
}
if (typeof module !== "undefined") module.exports = { FEATURES, RULES, baseScores, modifier, sessionPoints };
if (typeof window !== "undefined") window.ExEngine = { FEATURES, RULES, baseScores, modifier, sessionPoints };
