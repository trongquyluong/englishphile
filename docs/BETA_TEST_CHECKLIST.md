# Beta Test Checklist — Englishphile

## 1. Deployment / Environment

- [ ] `GET /api/health` returns 200 with no errors
- [ ] Database connected (no Prisma connection errors in Vercel logs)
- [ ] `DATABASE_URL` and `DIRECT_URL` present in Vercel environment variables
- [ ] `npm run build` passes locally
- [ ] No `npm run prisma seed` or `migrate reset` was run on production data
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` set if contact email should appear on About page

---

## 2. Auth

- [ ] Public signup creates a learner account (not an admin account)
- [ ] Signup required fields: email, username, password, full name, school, province/city
- [ ] Login works with correct credentials
- [ ] Wrong password shows friendly error (not raw auth stack trace)
- [ ] Logout clears session
- [ ] No role-selection UI exposed during public signup
- [ ] Admin routes (`/admin`, `/admin/*`) redirect to `/unauthorized` for learner accounts

---

## 3. Diagnostic

### Start flow
- [ ] No previous attempt → hero shows "Làm bài kiểm tra đầu vào" CTA
- [ ] IN_PROGRESS attempt exists → hero shows "Làm tiếp bài đang làm" CTA (links to `/diagnostic/start`)
- [ ] IN_PROGRESS → clicking "Làm tiếp" opens `/diagnostic/start` and renders questions (no redirect back)
- [ ] IN_PROGRESS → "Xem kết quả chi tiết" does NOT appear

### Completion flow
- [ ] COMPLETED/NEEDS_REVIEW attempt → "Xem kết quả chi tiết" appears
- [ ] COMPLETED → retry CTA shows "Làm lại bài kiểm tra"
- [ ] ABANDONED → status label shows "Đã bỏ dở" (not raw enum)
- [ ] Coverage insufficient → friendly message instead of raw error

### Question rendering
- [ ] Word Formation shows "Từ gốc: {rootWord}" label when prompt does not already show it
- [ ] Sentence Transformation: original sentence visible, keyword (if any) shown as "Từ bắt buộc:", instruction in Vietnamese
- [ ] No raw enum values (IN_PROGRESS, COMPLETED, etc.) shown to learner
- [ ] `rootWord` is NOT populated from `correctForm`

### `/diagnostic/start` refresh
- [ ] Reloading `/diagnostic/start` with existing IN_PROGRESS attempt renders the questions
- [ ] Reloading `/diagnostic/start` with no attempt redirects to `/diagnostic`
- [ ] Reloading `/diagnostic/start` with COMPLETED attempt redirects to `/diagnostic/result`

### Result page
- [ ] `/diagnostic/result?attempt=...` shows score, level badge, skill breakdown
- [ ] "Xem kết quả chi tiết" link works

---

## 4. Gym

- [ ] `/gym` loads with recommendation cards or empty state
- [ ] Clicking recommendation card opens problem
- [ ] Skill stat bars render accuracy percentages
- [ ] No diagnostic → prompt to run diagnostic appears
- [ ] "Luyện thích ứng" CTA links to `/practice/adaptive` (or sign-in for guests)

---

## 5. Practice

- [ ] `/practice/adaptive` with no params shows empty config state
- [ ] Selecting config and submitting shows problem list
- [ ] Clicking problem opens `/problems/{slug}`

### Problem detail (`/problems/{slug}`)
- [ ] MCQ renders with radio options
- [ ] Cloze renders with input per blank
- [ ] Word Formation renders with "Từ gốc: {rootWord}" visible
- [ ] Sentence Transformation renders with original sentence, keyword (if any), Vietnamese instruction
- [ ] Submitting answer shows feedback
- [ ] Mobile 375px: inputs at least 44px tall, no horizontal scroll

---

## 6. Sentence Transformation (specific)

- [ ] Prompt shows Vietnamese task label (e.g. "Viết lại câu sao cho nghĩa không đổi.")
- [ ] Original sentence clearly readable
- [ ] If `keyword` field exists: shows "Từ bắt buộc: {keyword}" prominently (not "Keyword: KEYWORD")
- [ ] If `targetSentence` field exists: shows hint about given beginning
- [ ] If no keyword and no targetSentence: generic instruction displayed
- [ ] Input placeholder says "Nhập câu viết lại hoàn chỉnh" (not generic "Nhập câu trả lời")
- [ ] Answer checking works for exact or near-exact match
- [ ] Manual grading entry point exists for NEEDS_REVIEW submissions

---

## 7. Contests

- [ ] `/contests` shows contest list or empty state
- [ ] Clicking contest opens `/contests/{id}` with description
- [ ] "Bắt đầu" creates attempt and redirects to `/contests/{id}/start`
- [ ] Timer counts down (if duration set)
- [ ] Submitting contest redirects to result page
- [ ] Leaderboard shows usernames (not email addresses)
- [ ] Resume: reloading `/contests/{id}/start` with IN_PROGRESS attempt shows questions
- [ ] Submitting with no answers shows error (not silent failure)

---

## 8. Wiki

- [ ] `/wiki` shows article list with category filters
- [ ] Featured article section renders
- [ ] Clicking article opens `/wiki/{slug}` with full content
- [ ] Article sections, bullet items, and tips render correctly
- [ ] Bogus slug (`/wiki/not-a-real-article`) shows 404 / not-found page
- [ ] `/theory` redirects to `/wiki` (or returns 404)

---

## 9. Legal / About / Footer

- [ ] `/privacy` renders privacy policy page
- [ ] `/terms` renders terms page
- [ ] Footer shows: "Englishphile - Engcrease your English" with Privacy and Terms links
- [ ] About page (`/about`) loads with Về Englishphile content
- [ ] Contact section shows email or contact link
- [ ] No corporate/SaaS buzzwords on About page

---

## 10. Mobile 375px

- [ ] No horizontal scroll on any page
- [ ] Navigation bar usable (hamburger or scrollable tabs)
- [ ] Buttons and inputs at least 44px tall
- [ ] Forms usable without zooming
- [ ] No text cut off at edges
- [ ] Touch targets for badges, links, and CTAs are tappable

---

## 11. Accessibility / UX

- [ ] Focus states visible on all interactive elements (keyboard nav)
- [ ] Loading/pending states visible after clicking submit buttons
- [ ] Disabled buttons styled and not clickable
- [ ] Skeleton or loading indicator on data-heavy pages
- [ ] No layout shift after content loads (LCP < 2.5s target)
- [ ] All Vietnamese copy reads naturally, no mixed-language awkwardness
- [ ] No raw enum values, error codes, or stack traces shown to learners

---

## Release Blockers

The following issues **must not** be present in a production release:

- [ ] Cannot start diagnostic (IN_PROGRESS attempt exists but resume route bounces back to `/diagnostic`)
- [ ] Diagnostic loses attempt data on page refresh
- [ ] Word Formation renders without `rootWord` visible and prompt does not already show the root
- [ ] Sentence Transformation lacks keyword hint when `keyword` field is populated in DB
- [ ] Practice submit does not trigger scoring or feedback
- [ ] Signup/login broken (wrong password causes crash, required fields missing)
- [ ] Production database disconnected (health check fails)
- [ ] Raw enum values (IN_PROGRESS, COMPLETED, etc.) visible to learner
- [ ] Admin data exposed to learner accounts via API or UI
- [ ] User email exposed on contest leaderboard
- [ ] `passwordHash` visible in any export, log, or debug output
- [ ] Draft/needs-review/archived content visible to learners through `/problems` or recommendations
