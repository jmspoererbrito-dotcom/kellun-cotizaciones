const express = require("express");
const puppeteer = require("puppeteer");
const app = express();

app.use(express.static("public"));
app.use(express.json());

app.get("/api/tienda", async (req, res) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    await page.goto("https://www.portalinmobiliario.com/tienda/kellun-gestion-inmobiliaria", {
      waitUntil: "networkidle2", timeout: 30000
    });

    const propiedades = await page.evaluate(() => {
      const items = document.querySelectorAll(".andes-card, [class*='property-card'], [class*='listing-item'], .ui-search-result");
      const results = [];
      items.forEach(item => {
        const titulo = item.querySelector("h2, h3, [class*='title']")?.innerText?.trim() || "";
        const precio = item.querySelector("[class*='price'], .price")?.innerText?.trim() || "";
        const foto = item.querySelector("img")?.src || "";
        const link = item.querySelector("a")?.href || "";
        const attrs = [...item.querySelectorAll("[class*='attribute'], [class*='detail']")].map(a => a.innerText.trim()).join(" | ");
        if (titulo || precio) results.push({ titulo, precio, foto, link, attrs });
      });
      return results;
    });

    await browser.close();
    res.json({ ok: true, propiedades });
  } catch(e) {
    if (browser) await browser.close().catch(()=>{});
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/propiedad", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Falta URL" });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const data = await page.evaluate(() => {
      const get = (sel) => document.querySelector(sel)?.innerText?.trim() || "";
      const getAttr = (label) => {
        const els = document.querySelectorAll("[class*='attribute'], [class*='spec'], li");
        for (const el of els) {
          if (el.innerText?.toLowerCase().includes(label.toLowerCase())) {
            return el.innerText.replace(/[^0-9]/g, "");
          }
        }
        return "";
      };

      const titulo = get("h1");
      const precio = get("[class*='price-tag'], [class*='price__fraction']");
      const moneda = get("[class*='price-tag-symbol'], [class*='price__currency']");
      const foto = document.querySelector(".ui-pdp-gallery__figure img, [class*='gallery'] img")?.src || "";
      const fotos = [...document.querySelectorAll(".ui-pdp-gallery__figure img, [class*='gallery'] img")].map(i => i.src).slice(0, 5);
      const dir = get("[class*='location'], [class*='address']");

      return { titulo, precio, moneda, foto, fotos, dir,
        m2: getAttr("m²") || getAttr("superficie") || getAttr("metros"),
        dorm: getAttr("dormitorio") || getAttr("habitacion"),
        banos: getAttr("baño"),
      };
    });

    // Convert first photo to base64
    let fotoBase64 = null;
    if (data.foto) {
      try {
        const fotoUrl = data.foto;
        const imgPage = await browser.newPage();
        const response = await imgPage.goto(fotoUrl);
        const buffer = await response.buffer();
        fotoBase64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;
        await imgPage.close();
      } catch(e) {}
    }

    await browser.close();

    // Parse precio
    let precio_uf = "", precio_clp = "";
    const precioNum = data.precio?.replace(/\./g, "").replace(",", ".");
    if (data.moneda?.includes("UF") || url.includes("uf")) precio_uf = data.precio;
    else precio_clp = data.precio;

    res.json({
      titulo: data.titulo,
      direccion: data.dir,
      m2: data.m2,
      dorm: data.dorm,
      banos: data.banos,
      precio_uf,
      precio_clp,
      foto: fotoBase64,
      tags: []
    });
  } catch(e) {
    if (browser) await browser.close().catch(()=>{});
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kellun corriendo en puerto ${PORT}`));
