const DEFAULTS = {
  sticker: 50, round: 1,
  bar01: 1, bar02: 1, bar13: 1, bar113: 1, bar97: 1,
  bar5lb: 1, bar2lb: 1, bar116: 1, bar12oz: 1, bar33: 1
};

// Simple in-memory + try blobs
let memory = { ...DEFAULTS };

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
    const blobs = require("@netlify/blobs");
    store = blobs.getStore({ name: "inventory", consistency: "strong" });
  } catch (e) {
    store = null;
  }

  async function read() {
    if (store) {
      try {
        const raw = await store.get("stock");
        if (raw) {
          memory = { ...DEFAULTS, ...JSON.parse(raw) };
          return memory;
        }
      } catch (e) {}
    }
    return { ...memory };
  }

  async function write(stock) {
    memory = { ...stock };
    if (store) {
      try {
        await store.setJSON("stock", stock);
      } catch (e) {}
    }
  }

  try {
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      if (params.reset === "1") {
        await write({ ...DEFAULTS });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reset: true, stock: DEFAULTS }) };
      }
      const stock = await read();
      return { statusCode: 200, headers, body: JSON.stringify(stock) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (body.reset) {
        await write({ ...DEFAULTS });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stock: DEFAULTS }) };
      }
      const stock = await read();
      const items = body.items || (body.item ? [{ id: body.item, qty: body.qty || 1 }] : []);
      for (const it of items) {
        if (!(it.id in DEFAULTS)) continue;
        const qty = Math.max(1, parseInt(it.qty || 1, 10));
        if (it.id !== "sticker" && (stock[it.id] || 0) < qty) {
          return { statusCode: 409, headers, body: JSON.stringify({ ok: false, error: "Sold out", stock }) };
        }
        stock[it.id] = Math.max(0, (stock[it.id] || 0) - qty);
      }
      await write(stock);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stock }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
