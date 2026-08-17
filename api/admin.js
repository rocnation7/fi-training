const crypto = require("crypto");

function response(res, status, body) {
  res.status(status).json(body);
}

function authorized(req) {
  const expected = process.env.ADMIN_PASSWORD;
  const supplied = req.headers && req.headers["x-admin-password"];
  if (!expected || typeof supplied !== "string") return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function supabase(path) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase environment variables are not configured.");
  return fetch(`${base}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=representation"
    }
  });
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return response(res, 405, { error: "Method not allowed." });
  if (!process.env.ADMIN_PASSWORD) return response(res, 503, { error: "Admin access is not configured." });
  if (!authorized(req)) return response(res, 401, { error: "Incorrect password." });

  try {
    const dbResponse = await supabase(
      "training_records?select=full_name,email,completed_at,latest_capstone_score,updated_at&completed_at=not.is.null&order=completed_at.desc"
    );
    if (!dbResponse.ok) throw new Error(await dbResponse.text());
    const completions = await dbResponse.json();
    return response(res, 200, { completions });
  } catch (error) {
    console.error("Admin API error", error);
    return response(res, 500, { error: "Unable to load completions." });
  }
};
