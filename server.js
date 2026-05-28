const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.static("public"));
app.use(express.json());

// Proxy endpoint — extrae datos de ML desde el servidor
app.get("/api/ml/:itemId", async (req, res) => {
  try {
    const itemId = req.params.itemId.toUpperCase().replace("-","");
    
    // Fetch item data
    const [itemRes, picRes] = await Promise.all([
      fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
      }),
      fetch(`https://api.mercadolibre.com/items/${itemId}/pictures`, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
      })
    ]);

    if (!itemRes.ok) {
      return res.status(404).json({ error: "Propiedad no encontrada ("+itemRes.status+")" });
    }

    const data = await itemRes.json();
    const pics = picRes.ok ? await picRes.json() : [];

    // Extract attributes
    const attrs = {};
    (data.attributes || []).forEach(a => { attrs[a.id] = a.value_name; });

    const m2 = (attrs["COVERED_AREA"] || attrs["TOTAL_AREA"] || attrs["LOT_AREA"] || "").replace(/\D/g,"");
    const dorm = attrs["BEDROOMS"] || "";
    const banos = attrs["BATHROOMS"] || "";

    // Price
    let precio_uf = "", precio_clp = "";
    if (data.currency_id === "CLF") {
      precio_uf = Number(data.price).toLocaleString("es-CL");
    } else if (data.currency_id === "CLP") {
      precio_clp = Number(data.price).toLocaleString("es-CL");
    }

    // Address
    const addr = [
      data.location?.address_line,
      data.location?.neighborhood?.name,
      data.location?.city?.name
    ].filter(Boolean).join(", ");

    // Best photo
    const foto = pics[0]?.url || data.thumbnail || null;

    // Auto tags
    const tags = [];
    if (dorm) tags.push(dorm + "D");
    if (banos) tags.push(banos + "B");
    const titleLower = (data.title || "").toLowerCase();
    if (titleLower.includes("amoblado")) tags.push("Amoblado");
    if (titleLower.includes("remodelado")) tags.push("Remodelado");
    if (titleLower.includes("uss")) tags.push("Cerca USS");
    if (titleLower.includes("studio")) tags.push("Studio");

    res.json({
      titulo: data.title || "",
      direccion: addr,
      m2, dorm, banos,
      precio_uf, precio_clp,
      foto: foto ? foto.replace("http://","https://") : null,
      tags,
      permalink: data.permalink || ""
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kellun app corriendo en puerto ${PORT}`));
