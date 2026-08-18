(function () {
  "use strict";
  var SESSION_KEY = "lam-fi-academy-session:v1";
  var allowedDestinations = ["fi101.html", "high-yield.html", "emerging-market-debt.html"];
  function session() { try { var value = window.localStorage.getItem(SESSION_KEY); return value ? JSON.parse(value) : null; } catch (error) { return null; } }
  function saveSession(learner) { var value = { id: learner.id, fullName: learner.fullName, email: learner.email }; window.localStorage.setItem(SESSION_KEY, JSON.stringify(value)); return value; }
  function destination(value) { return allowedDestinations.indexOf(value) !== -1 ? value : "fi101.html"; }
  function videoKey(course) { return "lam-fi-video-complete:" + course + ":v1"; }
  function videoComplete(course) { return window.localStorage.getItem(videoKey(course)) === "true"; }
  function updateCourse(course, progress) {
    var learner = session();
    if (!learner || !learner.id) return Promise.resolve(null);
    progress = progress || {};
    return fetch("/api/training", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learnerId: learner.id,
        course: course,
        completedVideos: progress.completedVideos || (videoComplete(course) ? [course] : []),
        completedChecks: progress.completedChecks || [],
        capstoneScore: progress.capstoneScore,
        completed: !!progress.completed
      })
    }).catch(function () { return null; });
  }
  function applyVideoGate(course) {
    var video = document.querySelector("video[data-video]");
    var checks = Array.prototype.slice.call(document.querySelectorAll(".checks, .capstone"));
    if (!video || !checks.length) return;
    var note = document.createElement("p");
    note.className = "video-gate-message";
    note.setAttribute("role", "status");
    video.closest(".video").after(note);
    function render() {
      var complete = videoComplete(course);
      checks.forEach(function (section) { section.hidden = !complete; });
      note.textContent = complete ? "Video complete. Your knowledge checks and final assessment are now unlocked." : "Finish the video to unlock the knowledge checks and final assessment.";
    }
    video.addEventListener("ended", function () { window.localStorage.setItem(videoKey(course), "true"); updateCourse(course); render(); });
    render();
  }
  window.LamAcademy = { session: session, saveSession: saveSession, destination: destination, updateCourse: updateCourse };
  var current = document.currentScript;
  var course = current && current.dataset.course;
  if (course && !session()) { window.location.replace("index.html"); return; }
  if (course) document.addEventListener("DOMContentLoaded", function () { applyVideoGate(course); });
})();
