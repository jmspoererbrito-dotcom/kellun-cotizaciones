const https = require("https");

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error("JSON parse error")); }
      });
    }).on("error", reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const itemId = req.query.id;
  if (!itemId) return res.status(400).json({ error: "Falta el ID" });

  try {
    const [data, pics] = await Promise.all([
      fetchJSON(`https://api.mercadolibre.com/items/${itemId}`),
      fetchJSON(`https://api.mercadolibre.com/items/${itemId}/pictures`).catch(() => [])
    ]);

    const attrs = {};
    (data.attributes || []).forEach(a => attrs[a.id] = a.value_name);

    const m2 = (attrs["COVERED_AREA"] || attrs["TOTAL_AREA"] || attrs["LOT_AREA"] || "").replace(/\D/g, "");
    const dorm = attrs["BEDROOMS"] || "";
    const banos = attrs["BATHROOMS"] || "";

    let precio_uf = "", precio_clp = "";
    if (data.currency_id === "CLF") precio_uf = Number(data.price).toLocaleString("es-CL");
    else if (data.currency_id === "CLP") precio_clp = Number(data.price).toLocaleString("es-CL");

    const addr = [data.location?.address_line, data.location?.neighborhood?.name, data.location?.city?.name].filter(Boolean).join(", ");
    const foto = (Array.isArray(pics) && pics[0]?.url) ? pics[0].url.replace("http://", "https://") : (data.thumbnail || "").replace("http://", "https://");

    const tags = [];
    if (dorm) tags.push(dorm + "D");
    if (banos) tags.push(banos + "B");
    const t = (data.title || "").toLowerCase();
    if (t.includes("amoblado")) tags.push("Amoblado");
    if (t.includes("remodelado")) tags.push("Remodelado");
    if (t.includes("uss")) tags.push("Cerca USS");
    if (t.includes("studio")) tags.push("Studio");

    res.json({ titulo: data.title || "", direccion: addr, m2, dorm, banos, precio_uf, precio_clp, foto, tags, permalink: data.permalink || "" });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
