const https = require("https");

const ACCESS_TOKEN = "APP_USR-283175851368664-052817-542b7ca62d57d644a1f883430297e3a1-1206373225";

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "Authorization": "Bearer " + ACCESS_TOKEN,
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on("error", reject);
  });
}

function fetchImageAsBase64(url) {
  return new Promise((resolve) => {
    const proto = url.startsWith("https") ? https : require("http");
    proto.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.mercadolibre.cl" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchImageAsBase64(res.headers.location).then(resolve).catch(() => resolve(null));
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers["content-type"] || "image/jpeg";
        resolve(`data:${contentType};base64,${buffer.toString("base64")}`);
      });
    }).on("error", () => resolve(null));
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const itemId = (req.query.id || "").replace("-", "").toUpperCase();
  if (!itemId) return res.status(400).json({ error: "Falta el ID" });

  try {
    const [data, pics] = await Promise.all([
      fetchJSON(`https://api.mercadolibre.com/items/${itemId}`),
      fetchJSON(`https://api.mercadolibre.com/items/${itemId}/pictures`).catch(() => [])
    ]);

    if (!data || !data.id) return res.status(404).json({ error: "Item no encontrado", detalle: data });

    const attrs = {};
    (data.attributes || []).forEach(a => attrs[a.id] = a.value_name);

    const m2 = (attrs["COVERED_AREA"] || attrs["TOTAL_AREA"] || attrs["LOT_AREA"] || "").replace(/\D/g, "");
    const dorm = attrs["BEDROOMS"] || "";
    const banos = attrs["BATHROOMS"] || "";

    let precio_uf = "", precio_clp = "";
    if (data.currency_id === "CLF") precio_uf = Number(data.price).toLocaleString("es-CL");
    else if (data.currency_id === "CLP") precio_clp = Number(data.price).toLocaleString("es-CL");

    const addr = [data.location?.address_line, data.location?.neighborhood?.name, data.location?.city?.name].filter(Boolean).join(", ");

    let fotoUrl = (Array.isArray(pics) && pics[0]?.url)
      ? pics[0].url.replace("http://", "https://")
      : (data.thumbnail || "").replace("-I.jpg", "-O.jpg").replace("http://", "https://");

    const foto = fotoUrl ? await fetchImageAsBase64(fotoUrl) : null;

    const tags = [];
    if (dorm) tags.push(dorm + "D");
    if (banos) tags.push(banos + "B");
    const t = (data.title || "").toLowerCase();
    if (t.includes("amoblado")) tags.push("Amoblado");
    if (t.includes("remodelado")) tags.push("Remodelado");
    if (t.includes("uss")) tags.push("Cerca USS");
    if (t.includes("studio")) tags.push("Studio");

    res.json({ titulo: data.title || "", direccion: addr, m2, dorm, banos, precio_uf, precio_clp, foto, tags });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
