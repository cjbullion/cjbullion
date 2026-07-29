const DEFAULTS = {
  round: 1, sticker: 50,
  bar13: 1, bar113: 1, bar97: 1, bar5lb: 1, bar2lb: 1, bar116: 1, bar12oz: 1, bar33: 1
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let store;
  try {
    const { getStore } = require("@netlify/blobs");
    store = getStore("inventory");
  } catch (e) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ...DEFAULTS, _fallback: true }),
    };
  }

  try {
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      if (params.reset === "1") {
        await store.set("stock", JSON.stringify(DEFAULTS));
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reset: true, stock: DEFAULTS }) };
      }
      const raw = await store.get("stock");
      const stock = raw ? JSON.parse(raw) : { ...DEFAULTS };
      return { statusCode: 200, headers, body: JSON.stringify(stock) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (body.reset === true) {
        await store.set("stock", JSON.stringify(DEFAULTS));
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stock: DEFAULTS }) };
      }
      const item = body.item;
      const qty = Math.max(1, parseInt(body.qty || 1, 10));
      if (!item || !(item in DEFAULTS)) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid item" }) };
      }
      const raw = await store.get("stock");
      const stock = raw ? JSON.parse(raw) : { ...DEFAULTS };
      if ((stock[item] || 0) < qty) {
        return { statusCode: 409, headers, body: JSON.stringify({ ok: false, error: "Sold out", stock }) };
      }
      stock[item] = (stock[item] || 0) - qty;
      await store.set("stock", JSON.stringify(stock));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stock }) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
