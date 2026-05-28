const https = require("https");

module.exports = async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: "Falta code" });

  const body = `grant_type=authorization_code&client_id=283175851368664&client_secret=LrmhZgdhuuwlZAxseZcakhBVSTgHvl2i&code=${code}&redirect_uri=https://kellun-cotizaciones.vercel.app`;

  const options = {
    hostname: "api.mercadolibre.com",
    path: "/oauth/token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" }
  };

  const result = await new Promise((resolve, reject) => {
    const req2 = https.request(options, (r) => {
      let data = "";
      r.on("data", c => data += c);
      r.on("end", () => resolve(JSON.parse(data)));
    });
    req2.on("error", reject);
    req2.write(body);
    req2.end();
  });

  res.json(result);
};
