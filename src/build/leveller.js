/* ================= tier leveller =================
   An upper tier can be set to line up with the same tier of another stand (its "Line up with" setting): its front is
   held at least as high as that tier's, even when the tiers below the two differ. It only ever raises a tier, and a tier
   without the setting is left exactly as it was. Works for separate stands and for stands on a lower bowl. */
function levelledTiers(tiers, st, standSet){
  if (!st.cfg || st.key === "C" || !tiers.some(tr => tr && tr.levelWith)) return tiers;
  const from = st.drawFrom || 0;
  return tiers.map((tr, k) => { if (!tr || !tr.levelWith || tr.levelWith === st.key || k < from) return tr; // the lower bowl's own tiers below a stand are left alone
    const h = levelHeight(tr.levelWith, k - from, st, standSet); return h == null ? tr : Object.assign({}, tr, {minHF: h}); });
}
/* The front height of tier k (counting that stand's own tiers from the bottom) of the stand `key`, as it is built. */
function levelHeight(key, k, st, standSet){
  const cfg = S.stands[key]; if (!cfg || !cfg.tiers || !cfg.tiers[k]) return null;
  const onBowl = isHybrid(), all = onBowl ? S.bowl.tiers.concat(cfg.tiers) : cfg.tiers, kk = onBowl ? S.bowl.tiers.length + k : k;
  const p = profile(all, onBowl ? st.set : standSet(cfg))[kk]; return p && p.stacked ? p.hF : null;
}
