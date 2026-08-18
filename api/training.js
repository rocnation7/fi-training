const ANSWER_KEY = [1, 2, 1, 1, 1, 1, 2, 1, 2, 0, 1, 1, 1, 1, 2];
const COURSES = ["fi101", "high-yield", "emerging-market-debt"];

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

async function learnerProgress(record) {
  const attemptsResponse = await supabase(
    `training_attempts?training_record_id=eq.${encodeURIComponent(record.id)}&select=score`,
    { method: "GET" }
  );
  if (!attemptsResponse.ok) throw new Error(await attemptsResponse.text());
  const attempts = await attemptsResponse.json();
  const scores = attempts.map((attempt) => attempt.score);

  return {
    completedChecks: Array.isArray(record.completed_checks) ? record.completed_checks : [],
    completedVideos: Array.isArray(record.completed_videos) ? record.completed_videos : [],
    knowledgeCheckAnswers: record.knowledge_check_answers || {},
    capstoneAnswers: record.capstone_answers || {},
    capstoneSubmitted: record.latest_capstone_score !== null,
    capstoneAttempts: scores.length,
    capstoneBest: scores.length ? Math.max(...scores) : null
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "PATCH") return response(res, 405, { error: "Method not allowed." });

  try {
    if (req.method === "POST") {
      const fullName = String(req.body && req.body.fullName || "").trim();
      const email = String(req.body && req.body.email || "").trim().toLowerCase();
      if (!fullName || !/^[^@\s]+@lazard\.com$/i.test(email)) return response(res, 400, { error: "Use your @lazard.com work email to access the academy." });

      const dbResponse = await supabase("training_records?on_conflict=email", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ full_name: fullName, email })
      });
      if (!dbResponse.ok) throw new Error(await dbResponse.text());
      const [record] = await dbResponse.json();
      return response(res, 200, {
        id: record.id,
        fullName: record.full_name,
        email: record.email,
        progress: await learnerProgress(record),
        courseProgress: record.course_progress && typeof record.course_progress === "object" ? record.course_progress : {}
      });
    }

    const learnerId = String(req.body && req.body.learnerId || "");
    if (!learnerId) return response(res, 400, { error: "Learner ID is required." });
    const course = String(req.body && req.body.course || "");
    if (course) {
      if (!COURSES.includes(course)) return response(res, 400, { error: "Unknown course." });
      const recordResponse = await supabase(`training_records?id=eq.${encodeURIComponent(learnerId)}&select=id,course_progress`, { method: "GET" });
      if (!recordResponse.ok) throw new Error(await recordResponse.text());
      const [record] = await recordResponse.json();
      if (!record) return response(res, 404, { error: "Learner record not found." });
      const current = record.course_progress && typeof record.course_progress === "object" ? record.course_progress : {};
      const prior = current[course] || {};
      const completedVideos = Array.isArray(req.body.completedVideos) ? req.body.completedVideos : (prior.completedVideos || []);
      const completedChecks = Array.isArray(req.body.completedChecks) ? req.body.completedChecks : (prior.completedChecks || []);
      const hasCapstoneScore = req.body.capstoneScore !== null && req.body.capstoneScore !== undefined && Number.isFinite(Number(req.body.capstoneScore));
      const capstoneScore = hasCapstoneScore ? Number(req.body.capstoneScore) : (prior.capstoneScore ?? null);
      const knowledgeCheckAnswers = req.body.knowledgeCheckAnswers && typeof req.body.knowledgeCheckAnswers === "object" ? req.body.knowledgeCheckAnswers : (prior.knowledgeCheckAnswers || {});
      const capstoneAnswers = req.body.capstoneAnswers && typeof req.body.capstoneAnswers === "object" ? req.body.capstoneAnswers : (prior.capstoneAnswers || {});
      const capstoneSubmitted = typeof req.body.capstoneSubmitted === "boolean" ? req.body.capstoneSubmitted : !!prior.capstoneSubmitted;
      const capstoneAttempts = Number.isFinite(Number(req.body.capstoneAttempts)) ? Number(req.body.capstoneAttempts) : (Number(prior.capstoneAttempts) || 0);
      const capstoneBest = req.body.capstoneBest === null || req.body.capstoneBest === undefined || !Number.isFinite(Number(req.body.capstoneBest)) ? (prior.capstoneBest ?? null) : Number(req.body.capstoneBest);
      current[course] = {
        completedVideos,
        completedChecks,
        capstoneScore,
        knowledgeCheckAnswers,
        capstoneAnswers,
        capstoneSubmitted,
        capstoneAttempts,
        capstoneBest,
        completedAt: req.body.completed ? (prior.completedAt || new Date().toISOString()) : (prior.completedAt || null),
        updatedAt: new Date().toISOString()
      };
      const dbResponse = await supabase(`training_records?id=eq.${encodeURIComponent(learnerId)}`, {
        method: "PATCH",
        body: JSON.stringify({ course_progress: current, updated_at: new Date().toISOString() })
      });
      if (!dbResponse.ok) throw new Error(await dbResponse.text());
      return response(res, 200, { courseProgress: current });
    }
    const completedChecks = Array.isArray(req.body.completedChecks) ? req.body.completedChecks : [];
    const completedVideos = Array.isArray(req.body.completedVideos) ? req.body.completedVideos : [];
    const knowledgeCheckAnswers = req.body.knowledgeCheckAnswers && typeof req.body.knowledgeCheckAnswers === "object"
      ? req.body.knowledgeCheckAnswers
      : {};
    const answers = req.body.capstoneAnswers;
    const score = scoreAnswers(answers);
    const update = {
      completed_checks: completedChecks,
      completed_videos: completedVideos,
      knowledge_check_answers: knowledgeCheckAnswers,
      updated_at: new Date().toISOString()
    };
    if (score !== null) {
      update.latest_capstone_score = score;
      update.capstone_answers = answers;
      if (score >= 12) update.completed_at = new Date().toISOString();
    }
    const priorResponse = await supabase(`training_records?id=eq.${encodeURIComponent(learnerId)}&select=course_progress`, { method: "GET" });
    if (!priorResponse.ok) throw new Error(await priorResponse.text());
    const [priorRecord] = await priorResponse.json();
    const courseProgress = priorRecord && priorRecord.course_progress && typeof priorRecord.course_progress === "object" ? priorRecord.course_progress : {};
    courseProgress.fi101 = { completedVideos, completedChecks, capstoneScore: score, completedAt: score !== null && score >= 12 ? new Date().toISOString() : (courseProgress.fi101 && courseProgress.fi101.completedAt) || null, updatedAt: new Date().toISOString() };
    update.course_progress = courseProgress;
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
