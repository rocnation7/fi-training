const ANSWER_KEY = [1, 2, 1, 1, 1, 1, 2, 1, 2, 0, 1, 1, 1, 1, 2];

function response(res, status, body) {
  res.status(status).json(body);
}

function supabase(path, options) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase environment variables are not configured.");
  return fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
}

function scoreAnswers(answers) {
  if (!answers || Object.keys(answers).length !== ANSWER_KEY.length) return null;
  return ANSWER_KEY.reduce((score, answer, index) => score + (Number(answers[`c${index + 1}`]) === answer ? 1 : 0), 0);
}

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "PATCH") return response(res, 405, { error: "Method not allowed." });

  try {
    if (req.method === "POST") {
      const fullName = String(req.body && req.body.fullName || "").trim();
      const email = String(req.body && req.body.email || "").trim().toLowerCase();
      if (!fullName || !/^\S+@\S+\.\S+$/.test(email)) return response(res, 400, { error: "A full name and valid email are required." });

      const dbResponse = await supabase("training_records?on_conflict=email", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ full_name: fullName, email })
      });
      if (!dbResponse.ok) throw new Error(await dbResponse.text());
      const [record] = await dbResponse.json();
      return response(res, 200, { id: record.id, fullName: record.full_name, email: record.email });
    }

    const learnerId = String(req.body && req.body.learnerId || "");
    if (!learnerId) return response(res, 400, { error: "Learner ID is required." });
    const completedChecks = Array.isArray(req.body.completedChecks) ? req.body.completedChecks : [];
    const completedVideos = Array.isArray(req.body.completedVideos) ? req.body.completedVideos : [];
    const answers = req.body.capstoneAnswers;
    const score = scoreAnswers(answers);
    const update = { completed_checks: completedChecks, completed_videos: completedVideos, updated_at: new Date().toISOString() };
    if (score !== null) {
      update.latest_capstone_score = score;
      update.capstone_answers = answers;
      if (score >= 12) update.completed_at = new Date().toISOString();
    }
    const dbResponse = await supabase(`training_records?id=eq.${encodeURIComponent(learnerId)}`, { method: "PATCH", body: JSON.stringify(update) });
    if (!dbResponse.ok) throw new Error(await dbResponse.text());
    const [record] = await dbResponse.json();
    if (!record) return response(res, 404, { error: "Learner record not found." });

    if (score !== null) {
      await supabase("training_attempts", {
        method: "POST",
        body: JSON.stringify({ training_record_id: learnerId, score, passed: score >= 12, answers })
      });
    }
    return response(res, 200, { completed: !!record.completed_at, score });
  } catch (error) {
    console.error("Training API error", error);
    return response(res, 500, { error: "Unable to save training data." });
  }
};
