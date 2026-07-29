
const DEFAULTS = {
  sticker: 50,
  round: 1,
  bar01: 1, bar02: 1,
  bar13: 1, bar113: 1, bar97: 1, bar5lb: 1,
  bar2lb: 1, bar116: 1, bar12oz: 1, bar33: 1
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

  let store = null;
  try {
    const { getStore } = require("@netlify/blobs");
    store = getStore({ name: "inventory", consistency: "strong" });
  } catch (e) {
    // Fallback without persistence — still returns defaults
  }

  async function readStock() {
    if (!store) return { ...DEFAULTS };
    try {
      const raw = await store.get("stock");
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }
  async function writeStock(stock) {
    if (!store) return false;
    await store.setJSON("stock", stock);
    return true;
  }

  try {
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      if (params.reset === "1") {
        await writeStock({ ...DEFAULTS });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reset: true, stock: DEFAULTS }) };
      }
      const stock = await readStock();
      return { statusCode: 200, headers, body: JSON.stringify(stock) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (body.reset === true) {
        await writeStock({ ...DEFAULTS });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stock: DEFAULTS }) };
      }
      // body.items = [{ id, qty }] or body.item + body.qty
      const stock = await readStock();
      const items = body.items || (body.item ? [{ id: body.item, qty: body.qty || 1 }] : []);
      for (const it of items) {
        const id = it.id;
        const qty = Math.max(1, parseInt(it.qty || 1, 10));
        if (!(id in DEFAULTS)) {
          return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid item: " + id }) };
        }
        if (id !== "sticker" && (stock[id] || 0) < qty) {
          return { statusCode: 409, headers, body: JSON.stringify({ ok: false, error: "Sold out", stock }) };
        }
        if (id === "sticker") {
          stock.sticker = Math.max(0, (stock.sticker || 0) - qty);
        } else {
          stock[id] = Math.max(0, (stock[id] || 0) - qty);
        }
      }
      await writeStock(stock);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stock }) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
