# New Training Module Playbook

Use this checklist whenever adding a course to the Fixed Income Academy. It captures the established learner experience, progress tracking, branding, and reporting requirements.

## Required learner experience

Every module must provide the same flow:

1. Learners sign in from the academy homepage with a valid `@lazard.com` email address.
2. After sign-in, they remain on the homepage and choose a course from the unlocked catalog; do not redirect them automatically into a course.
3. The course opens with the Lazard-branded header and a link back to `index.html`.
4. A learner must finish each required video before the related learning section unlocks.
5. Within a module, unlock knowledge checks one at a time: video → Check 1 → Check 2 → remaining checks.
6. Keep the capstone locked until every knowledge check is complete.
7. Save and restore detailed progress through the database, not only browser storage.
8. Display completion by course in the Admin register.

## Naming the module

Choose a stable, lowercase course ID such as `investment-grade-credit`. This ID is used in the page, browser storage, the API, and the database. Do not change it after learners start a course.

Decide the following before implementation:

| Item | Example |
| --- | --- |
| Course ID | `investment-grade-credit` |
| Page | `investment-grade-credit.html` |
| Course title | `Investment Grade Credit` |
| Catalog label | `FI 201.3 · Sector deep dive` |
| Video file(s) | `Investment_Grade_Credit.mp4` |
| Number of checks | `4` |
| Capstone size and pass mark | `10 questions / 8 correct` |

## Files to create or update

| File | Required change |
| --- | --- |
| New course HTML page | Build from the latest FI 201 course page, not an older draft. |
| Video asset(s) | Add the approved MP4 files to the repository using clear filenames. |
| `index.html` | Add a course card to the logged-in catalog and update the learning-path copy if needed. |
| `academy.js` | Add the page filename to `allowedDestinations` if the course can be used as a destination. |
| `api/training.js` | Add the course ID to `COURSES`; this authorizes database progress updates. |
| `admin.html` | Add a visible per-course column and CSV export column. |
| `api/admin.js` | Extend reporting only if its course mapping does not already derive from `course_progress`. |
| `docs/NEW_TRAINING_MODULE.md` | Update this playbook if the architecture or standard changes. |

## Start from the current FI 201 pattern

Copy the current `high-yield.html` or `emerging-market-debt.html` as the baseline. Preserve the following elements:

- the Lazard logo and Academy return link in the header;
- the `data-video` value matching the stable course ID;
- the progressive video/check/capstone gate;
- the `syncAcademyCourse()` and `restoreAcademyProgress()` functions;
- the `lamacademyready` listener, which restores database progress after the shared academy script loads;
- the standard footer below.

Set `REQUIRE_BLOCKS_BEFORE_CAPSTONE: true`. Do not reveal all checks or the capstone as soon as a video ends.

For modules with more than one video block, use the FI 101 pattern: complete a block's video and checks before unlocking the next block. Each video should have a unique `data-video` and be included in the saved `completedVideos` list.

## Video requirements

- Use an HTML5 `<video>` element with `controls`, `preload="metadata"`, and `playsinline`.
- Use the approved source file with a correct `video/mp4` source type.
- Do not rely on clicking Play as completion. Mark the video complete only on its `ended` event.
- If a video is complete, persist its course/video ID and restore that state before rendering the checks.
- Keep learning sections hidden or represented as locked cards until their prerequisite video/check is complete.

## Database progress requirements

Progress is stored in `training_records.course_progress` (JSONB) under the course ID. A new course must use the same shape:

```json
{
  "completedVideos": ["investment-grade-credit"],
  "completedChecks": ["kc1", "kc2"],
  "knowledgeCheckAnswers": {"igc-1": 2},
  "capstoneAnswers": {"c1": 1},
  "capstoneSubmitted": false,
  "capstoneAttempts": 0,
  "capstoneBest": null,
  "capstoneScore": null,
  "completedAt": null,
  "updatedAt": "2026-08-18T00:00:00.000Z"
}
```

Implementation requirements:

- Call `window.LamAcademy.updateCourse(COURSE_ID, progress)` after video completion, an answer change, a completed/retried check, a submitted/retaken capstone, and a reset when applicable.
- Send the full detailed state: completed videos/checks, knowledge-check answers, capstone answers, submitted status, attempts, best score, score, and completion status.
- On page load, first restore local browser state as a resilience fallback, then restore the database state from `LamAcademy.session().courseProgress[COURSE_ID]` as the source of truth.
- When restoring completed video state, also restore the video-complete browser flag so the progressive gate renders correctly.
- Keep `academy.js` session storage in sync with the API response so navigating back to the homepage and into another course retains the latest record.
- Never expose Supabase service-role credentials to the browser. Browser pages call `/api/training`; that server endpoint communicates with Supabase.

If the database schema does not already include `course_progress jsonb`, add it through the approved Supabase workflow before release. The current production schema already has this column.

## Admin reporting

The Admin register must show both total completed courses and the new course's individual state.

Use the standard status rules:

- **Complete**: `completedAt` is present.
- **In progress**: the learner has any saved video, check, or capstone activity but no `completedAt`.
- **Not started**: no record exists for the course.

Update both the visible table and the CSV export. Keep the display name concise and consistent with the homepage catalog.

## Homepage and authentication

- The course catalog stays hidden until sign-in succeeds.
- The email field may use `name@lazard.com` as its placeholder; do not add unnecessary instructional copy beside it.
- The client and server validators must both accept normal Lazard addresses with `^[^@\s]+@lazard\.com$` (case-insensitive).
- A direct visit to a protected course while logged out must send the learner to `index.html`, where they sign in and select a course. Do not preserve a `next` redirect that bypasses the catalog.
- Keep the Admin link in the homepage footer.

## Branding, navigation, and footer

Use `LazardLogoBlack.svg` wherever the Lazard logo appears; on blue headers it is displayed with the existing inverted treatment. Avoid placeholder logos.

Every course page must include a visible Academy/Home link to `index.html` in its header. Preserve the Lazard palette, typography variables, and header layout used by FI 101 and the current FI 201 pages.

Use this exact footer content on every course page:

```html
<footer class="wrap">
  <p><b>Educational purposes only.</b> This training is intended solely for internal education and is not investment advice, an offer, or a solicitation. Market data and illustrative examples must be verified against current approved materials before use in client conversations.</p>
  <p>This training platform collects your name and work email to track completion of internal training. Your data is processed by Lazard Asset Management LLC, with hosting provided by Vercel, Inc., and may be retained in accordance with Lazard&rsquo;s policies. For full details, including your rights under applicable data protection law, see Lazard&rsquo;s <a href="https://www.lazard.com/privacy-notice/">Privacy Notice</a> or contact lam.ny.legal@lazard.com.</p>
  <p><a href="admin.html">Admin</a></p>
</footer>
```

Do not substitute an older “Internal use only” footer or omit the Privacy Notice.

## Content and assessment quality

- Use approved training copy and approved video assets only.
- Confirm every knowledge-check answer key and capstone answer key against the supplied training materials.
- Shuffle answer options only when the answer key is stored by original option index, as in the current modules.
- Explain answers after a learner submits a check.
- Set a clear capstone pass mark and mark a course complete only when the learner meets it.
- Retakes should retain the learner's best score while allowing new answers.

## Test before release

Run this learner journey for each new module:

1. Use a fresh browser session and confirm the course card is hidden before sign-in.
2. Sign in with a valid `@lazard.com` address and confirm the catalog expands without redirecting into FI 101.
3. Open the new course and confirm the header Home link works.
4. Confirm every check is locked before the required video finishes.
5. Finish the video; confirm only Check 1 unlocks.
6. Complete each check; confirm the next check unlocks and the capstone remains locked until all checks are complete.
7. Submit a passing capstone; confirm the course is marked complete in Admin.
8. Refresh, sign out/in, and open the course in another browser session; confirm the video/check/capstone state restores from the database.
9. Confirm the course has the standard footer, Privacy Notice, and Admin link.
10. Validate source syntax and whitespace: `node --check academy.js`, `node --check api/training.js`, and `git diff --check`.

## Release checklist

- [ ] Approved videos are present and play in the deployed course.
- [ ] Homepage card, course ID, API allowlist, and Admin report all use the same course ID.
- [ ] Progressive gates match FI 101.
- [ ] Detailed database save and restore work across browser sessions.
- [ ] Lazard logo, Home link, and standard footer are present.
- [ ] Preview deployment is ready and manually checked.
- [ ] Pull request is merged and the Vercel production deployment is `READY`.
