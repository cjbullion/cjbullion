// Auto inventory — stores in memory per function instance.
// For unique bars: checkout marks sold; page refresh loads stock from this endpoint.
// Reset: /.netlify/functions/stock?reset=1

const DEFAULTS = {
  sticker: 50, round: 1,
  bar01: 1, bar02: 1, bar13: 1, bar113: 1, bar97: 1,
  bar5lb: 1, bar2lb: 1, bar116: 1, bar12oz: 1, bar33: 1
};

// Global across warm invocations in same instance
if (!global.__cjStock) global.__cjStock = { ...DEFAULTS };

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

  try {
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      if (params.reset === "1") {
        global.__cjStock = { ...DEFAULTS };
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reset: true, stock: global.__cjStock }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(global.__cjStock) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (body.reset) {
        global.__cjStock = { ...DEFAULTS };
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stock: global.__cjStock }) };
      }
      const stock = { ...global.__cjStock };
      const items = body.items || (body.item ? [{ id: body.item, qty: body.qty || 1 }] : []);
      for (const it of items) {
        if (!(it.id in DEFAULTS)) continue;
        const qty = Math.max(1, parseInt(it.qty || 1, 10));
        if (it.id !== "sticker" && (stock[it.id] || 0) < qty) {
          return { statusCode: 409, headers, body: JSON.stringify({ ok: false, error: "Sold out", stock }) };
        }
        stock[it.id] = Math.max(0, (stock[it.id] || 0) - qty);
      }
      global.__cjStock = stock;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stock }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
