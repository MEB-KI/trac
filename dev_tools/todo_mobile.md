# Mobile screen space — plan and progress

Goal: cut the amount of chrome above the timeline on phones. A Fairphone 5
(≈ 408×900 CSS px) currently spends ~24 % of the screen on the sticky header
before a single timeline pixel is visible, and the secondary timeline used to be
unreachable there.

**Desktop must stay as-is** unless a change is explicitly listed as applying to
both — that was the working rule for every step below.

Progress lives on branch `develop`:

| Commit | What |
| --- | --- |
| `961607d` | CHG: remove duplicate submit day button in footer |
| `0e058a1` | WIP: add timeline switcher on mobile |
| `13b378e` | CHG: also replace previous timeline button with timeline switcher on desktop |

---

## Verified current state (2026-09-30)

Branch `develop`, clean tree at `b19f15e`. Measured live at 408×900
(`default` study, 7 days, 2 timelines, nginx on :3000):

| Element | Measured now | Earlier note |
| --- | --- | --- |
| `.header-section` (sticky) | **235 px** | 212 px |
| ↳ `.controls` | **99 px / 3 rows** | 76 px / 2 rows |
| ↳ `#previousDaysSwitchRow` | 76 px / 2 rows | unchanged |
| ↳ `.timeline-header` | 28 px | unchanged |
| `.instruction-banner` | 124 px (day 1, dismissible, persisted per study+pid) | — |
| `.timeline-canvas` | 602 px | 625 px |

The third toolbar row is the language `<select>` that
`ensureLanguageSelector()` injects plus yesterday's timeline switcher. And
`.header-section` is `position: sticky` at *every* width: the toolbar **and** the
day row never leave the screen while the timeline scrolls.

Nothing is left of the agreed design: §1–§7 are all implemented, verified in the
live page and covered by chromium E2E runs.

---

## Agreed direction (2026-09-30)

Working rule: **desktop stays as-is**, except the label/id renames (decision 4),
which are deliberate and apply everywhere.

### Scope model — one home per scope

The primary action of a scope stays visible; secondary, destructive and
administrative actions move into that scope's own menu. Two things are never
hidden: the study's goal (Submit Study) and the *existence* of a second timeline
(the §2 reachability bug must not come back).

| Scope | Actions | Placement on mobile |
| --- | --- | --- |
| Study | Submit Study, Skip time reporting, Language | Submit **visible**; Skip + Language in the `⋮` menu |
| Day | Switch day, Save Day, Copy this day | Day control (`‹ Monday ▾ · Day 1 of 7 ›`) + Save Day visible; Copy inside the day sheet |
| Timeline | Switch timeline, Clear timeline | Named in the context row; both actions in the timeline sheet |
| Activity | pick, delete, remove last | `+` stays floating; long-press menu; "Remove last" became an Undo toast (§6) |

Target mobile header (~80 px instead of 235 px):

```
‹  Monday ▾ · Day 1 of 7      Primary ▾     context row  ~36px
[ Save Day ] [ Submit Study ] [ ⋮ ]         action row   ~40px
```

Measured progress after §4: 235 → **99 px** sticky header and the timeline
602 → **801 px** (+33 %). The timeline switcher button and the day row are gone
from phones; what is left is the context row (32 px: day picker + timeline
picker) and a one-row toolbar (40 px).

### Decisions

1. Context row = day picker **and** timeline picker in one row (two sheet triggers).
2. Quick day stepping: `‹` `›` arrows next to the day name.
3. Language picker: on mobile into the `⋮` menu. Desktop styling is a later,
   separate discussion.
4. **Done 2026-09-30** — "Clean Row" is renamed everywhere, desktop included. The
   confirmation modal used to say "Clear current timeline row?" and the mobile
   layout is a column, not a row, so the action is now **"Clear timeline"** in
   all 7 locales. The keys went with the labels: `buttons.cleanRow` →
   `buttons.clearTimeline`, `instructions.cleanRowHelp` →
   `instructions.clearTimelineHelp`, `modals.confirmCleanRow.*` →
   `modals.confirmClearTimeline.*`. The two template banners that quoted the
   button name were updated in every locale as well.
5. Order: (a) remove the swipe gesture, (b) long-press → context menu, (c) context
   and action rows + sheets + `⋮`, (d) Undo toast. Both (c)'s menu and (d) depend
   on (b) landing first.

### i18n

- Renames touch all 7 locales (`de, en, es, fi, fr, pl, sv`):
  `locales_consistency.test.js` requires identical key sets.
- `buttons.cleanRow` → `buttons.clearTimeline` (**done**: "Clear timeline",
  "Zeitleiste leeren", "Vaciar línea de tiempo", "Tyhjennä aikajana",
  "Effacer la chronologie", "Wyczyść oś czasu", "Rensa tidslinjen"). The long
  forms are fine on a full-width sheet row, but not in a toolbar chip.
- `buttons.switchTimeline` is only a fallback label: the visible switcher text is
  the *destination timeline name* from the study config (155 px measured for
  "Secondary Activity"). That is why it moves out of the action row.
- New keys for the `⋮` menu and the sheets must be added to all 7 files.

### Instruction banner — done, see §7 and the entry below

`banner.dayOneInstructions` was one string for all widths and told mobile users
about the 1200 ms long-press that decision 5 removes. It needs a **mobile and a
desktop variant** (two keys, or two spans toggled in CSS) — and once split, both
can be much shorter than today's three-sentence block (124 px = 14 % of a 900 px
phone screen on day 1). New keys → all 7 locales. (The keys are
`banner.instructionsMobile` / `...Desktop` since 2026-10-13 — the banner is no
longer day-one-only, so the old names were retired; that entry is at the end of
this file.)

### Id hygiene — done (2026-09-30)

- `#nextBtn` → `#saveDayBtn`, class `.next-btn` → `.save-day-btn`,
  `handleNextButtonAction()` → `handleSaveDayAction()`.
- `#cleanRowBtn` → `#clearTimelineBtn`, class `.clean-row-btn` →
  `.clear-timeline-btn`. The confirm dialog followed: `#clearTimelineConfirmModal`,
  `#clearTimelineConfirmModalTitle`, `#confirmClearTimelineOk` /
  `#confirmClearTimelineCancel`, and `performCleanRow()` →
  `performClearTimeline()`.
- Deleted as dead: the two `.next-btn:has(i.fa-check)` rules — nothing has put an
  `fa-check` icon in that button since it became Save Day.
- Deliberately unchanged: `#currentDayDisplay` (11 test references) stays the day
  picker's trigger id; `#skipReportingBtn`, `#submitStudyBtn` and `#removeLastBtn`
  keep their ids; `#previousDaysSwitchRow` (7 references) only moves together with
  the `e2e_helpers.js` day helpers.
- Tests updated to the new ids: `mobile_layout.spec.js` and
  `e2e_helpers.js` (`saveCurrentDay`). Tests select by id, never by visible label.
- Verified: typecheck, 62/62 unit tests (the locale key-set guard and
  "every requested key exists in every locale" cover the rename), 25/25 E2E on
  chromium, and live in en + de (diary toolbar, instructions page, confirm modal).

---

## 1. Done — duplicate "Save Day" in the footer (`961607d`)

- `#navSubmitBtn` deleted; both it and `#nextBtn` called the same
  `handleNextButtonAction()`, and the toolbar button is the one users reach.
- The footer (`#instructionsFooter`) now starts `hidden` in the markup and
  `ui.js:updateFooterVisibility()` only reveals it while `#skipReportingBtn` is
  visible — so studies with `allow_skip_timeuse: false` (all `adult_pilot_*`)
  lose the whole empty row.
- `autoscroll.js` guards `footer.offsetHeight > 0` before using the footer as a
  scroll limit (a hidden footer reports an all-zero rect ⇒ limit 0 ⇒ downward
  autoscroll silently dead).
- Gotcha found here: `hidden` does **not** hide a `.btn`, because the author
  rule `.btn { display: flex }` outranks the UA `[hidden] { display: none }`.
  Added `.btn[hidden] { display: none !important }`.

## 2. Done — timeline switcher (`0e058a1`, `13b378e`)

**The bug this fixed:** below 1440 px the diary renders only the *active*
timeline — a later `@media (max-width: 1439.98px)` block ("Mobile vertical
layout") overrides the earlier horizontally-scrollable rules with
`.past-initialized-timelines-wrapper { display: none !important }` and
`.timeline-container[data-active='false'] { display: none !important }`, and the
wrapper is `overflow-x: hidden`. The old one-way `#backBtn` was `disabled`
whenever `currentIndex <= 0`, and `init()` deliberately parks on index 0 — so
phone/tablet/small-window users could never reach the secondary timeline. It
failed *silently*: `secondary` has `min_coverage: 0`, so there is no submit
error, just permanently missing data.

Now: `#switchTimelineBtn` cycles `keys[(currentIndex + 1) % keys.length]` via
the existing `navigateToTimelineByKey()` (now exported from `script.js`; reuses
the proven forward `addNextTimeline()`/`restoreNextTimeline()` and backward
`goToPreviousTimeline()` paths). It is **never disabled**, and its label is the
*destination* timeline's name ("Secondary Activity"), so the button itself is
the hint that a second timeline exists.

Desktop question, decided as option "B": use the same switcher at both
breakpoints and delete `#backBtn`. Measured on desktop 1600×900: both timeline
containers are visible in a 298 px pane that does not scroll (horizontal 80 px
bars 138 px apart), so the old button was redundant *and* dead on arrival
(`disabled` at index 0 on every page load) *and* asymmetric. Removing it also
deleted `handleBackButtonAction()`, its debounce state, four
`backButton.disabled` blocks in `script.js`, `.back-btn` CSS, the mobile
`#backBtn` hide rule and `buttons.previousTimeline` from 7 locales (net −86
lines).

---

## 3. Done — swipe removed, long-press opens the context menu (2026-09-30)

Not yet committed; working tree on `develop`. Net −46 lines in `script.js`.

- `initMobileSwipeNavigation()` **deleted** (not guarded). It was the only
  control that could silently save a day: a left swipe clicked `#nextBtn`
  (= Save Day) and then reloaded the page 1.5 s later, and it never checked
  whether an activity was being dragged — a fast horizontal drag looks exactly
  like a swipe. A right swipe clicked the timeline switcher.
- `initMobileDelete()` → **`initMobileLongPressMenu()`**: now gated on
  `getIsMobile()` (before, its document-level `pointerdown` listener armed on
  desktop too, so a motionless 1.2 s mouse press deleted an activity), hold
  shortened **1200 ms → 500 ms**, and it opens the shared context menu instead
  of deleting. Deletion is now one explicit choice inside the menu.
- `initDesktopActivityContextMenu()` → **`initActivityContextMenu()`**; the
  `if (getIsMobile()) { hideMenu(); return; }` early-return is gone, so
  Android's native long-press `contextmenu` opens the same menu. `showMenu` is
  exposed as `window.showActivityContextMenu` for the mobile timer (iOS does not
  emit `contextmenu` for arbitrary elements, hence the own timer).
- CSS: `.long-press-delete-armed` / `.long-press-delete-indicator` →
  `.long-press-armed` / `.long-press-indicator`, red `--danger-color` →
  `--primary-color` — the ring no longer means "about to delete".
- Banner text: only **`en`** needed fixing. `de/es/fi/fr/pl/sv` already said
  "hold it on mobile or use the right-click menu on desktop"; the "long-press for
  2 seconds" and the explicit `d`/DEL hint existed in English only. Dropped
  "2 seconds", added "then choose Delete", kept the `d`/DEL hint.
  (`pages/instructions.html` step 2 was already correct.)
- New spec `frontend/tests/e2e/mobile_activity_gestures.spec.js` (3 tests):
  a plain tap stays inert, a long press opens the menu **without** deleting,
  menu Delete removes the activity, and a horizontal drag neither saves
  (no POST to `/activities`) nor navigates (marker survives ⇒ no reload).
- Verified live at 408×900 and on chromium: 18/18 in the
  context-menu/mobile/drag/keyboard subset, plus `frequency_activity_flows_mobile`
  and `ensure_switching_desktop_mobile_keeps_activities_issue42`.
- Both leftovers were handled: ownership of `#clearTimelineBtn` moved to the
  timeline menu in this slice, and `#removeLastBtn` was removed in §6.
## 4. Done — phone context row: day picker + timeline picker (2026-09-30)

Not yet committed. What shipped:

- `#contextBar` (`.context-bar`) is inserted *before* `.controls`, so a phone
  reads context first, actions second. It is `display: none` from 1440 px up and
  below that the navigation it replaces is hidden: `#previousDaysSwitchRow` (no
  longer rendered on phones at all) and the cycling `#switchTimelineBtn`.
- Left: `‹  Wednesday (3/7)  ›` - two step buttons plus the day picker. The
  arrows name the day they lead to, the full "Wednesday (Day 3 of 7)" sentence
  stays the button's accessible name and tooltip, and only the compact counter is
  visible. `#currentDayDisplay` still exists - inside the context bar now, which
  is what the 11 specs waiting for it check.
- Right: `Main Activity ▾`, the current timeline (hidden when a study has only
  one).
- **Day menu** (`#dayMenu`): every day, with a `✓` when it meets min_coverage
  (same signal and palette as the desktop day buttons), the current day marked
  `aria-current` and disabled, plus "Copy this day" opening the existing copy
  picker. Selecting a day calls `window.saveAndSwitchToDay(index)`, which still
  auto-saves first.
- **Timeline menu** (`#timelineMenu`): one row per timeline with its coverage on
  a second line (reusing `messages.timelineCoverageMet/Missing`) and **Clear this
  timeline**, which moved here out of the ⋮ menu because it is per-timeline, not
  per-day.
- The four popups (copy picker, ⋮ menu, day menu, timeline menu) now share one
  look and one open/close path: `.context-menu` / `.context-menu-item` /
  `.context-menu-header` in CSS, `openContextMenu()` / `closeContextMenu()` /
  `addMenuItem()` in `ui.js`. The old `.copy-day-context-menu*` style rules are
  gone; the class names stay on the elements because specs locate them.
- Bug caught on the way: `updateCurrentDayDisplay()` still wrote the
  `?custom_page_title=` label through the *old* variable name after the container
  rename - a `ReferenceError` waiting for any study that passes that param, and
  invisible to `tsc` because `ui.js` is not `@ts-check`ed. Fixed; on phones that
  label now gets its own line in the context bar instead of vanishing with the
  title row.

Measured at 408×900 (`default` study):

| | Original | After §5 | After §4 |
| --- | --- | --- | --- |
| sticky `.header-section` | 235 px | 212 px | **99 px** |
| `.timeline-canvas` | 602 px | 688 px | **801 px** |

Desktop 1600×900 re-verified: context bar hidden, day row with 7 buttons,
switcher labelled "Secondary Activity", title row with "Copy this day", one-row
toolbar with all four extra buttons and no ⋮.

### Test changes for §4

- `e2e_helpers.js`: `switchToDay()` now works with either layout (day row or day
  menu), and the phone placement helper moved in as `placeActivityMobile()`
  (it was private to `mobile_activity_gestures.spec.js`).
- New `mobile_context_bar.spec.js`: the context bar replaces the day row and the
  timeline button; the day menu lists days/✓/current/copy; the timeline menu
  lists every timeline with coverage; and - closing the gap this whole bug class
  came from - **both timelines of a phone day can be filled and survive a save**.
- Three specs clicked `#skipReportingBtn` directly and therefore broke at the
  default 1280 px viewport, which is the *phone* layout: `instructions_skip_to_thankyou`,
  `return_url_continue_link`, `return_url_default_thankyou`. All three now use
  `openSkipConfirmation()`.
- Full suite 72/72 on chromium (`accessibility.spec.js` still cannot run locally:
  `@axe-core/playwright` is not installed).

### Original plan for §4 (kept for the reasoning)

Today: `#previousDaysSwitchRow` = "Switch to day:" label + one button per day.
7 days ⇒ 76 px ⇒ 2 rows, always visible; a 14-day study would be 3–4 rows. The
day is also printed twice on screen (the row and the `Monday (Day 1 of 7)`
title).

- Hide `#previousDaysSwitchRow` below 1440 px; desktop keeps it untouched.
- Make the day title itself the switcher: `#currentDayDisplay` lives inside
  `.timeline-title` (`ui.js:updateCurrentDayDisplay()`), next to the
  "Copy this day" link. Tapping it opens a picker.
- Style/behave the picker like the existing `showCopyTargetPicker()`
  (`.copy-day-context-menu`) so there is one consistent "pick a day" UI, and
  keep the per-day completion state (green/gray, as
  `.previous-day-btn.day-complete` shows it today).
- Selecting a day calls `saveAndSwitchToDay(dayIndex)` — it already auto-saves
  the current day first.
- i18n: reuse `messages.goBackToEditPreviousDays` ("Switch to day:") as the
  heading; no new keys were needed in the end (the arrows name their target day,
  the day menu uses a ✓ glyph, and the timeline menu reuses the coverage keys).

Expected win: one whole row + its label (~76 px on a 408 px screen) — delivered
as 133 px total, together with the timeline switcher row.

## 5. Done — mobile overflow menu (`⋮`) (2026-09-30)

Not yet committed. `#moreMenuBtn` (icon-only, 36×32) sits at the end of the
`.controls` row, `display: none` from 1440 px up so desktop keeps every button.
Below 1440 px it appears and `#removeLastBtn`, `#clearTimelineBtn`,
`.language-select-wrapper` and `#skipReportingBtn` are hidden instead.

- Items: Clear timeline, Remove Last, Skip time reporting (only when the study
  allows it), then a **Language** group built from the options of
  `#languageSelectMain`. Each item **proxies `.click()`** to the real control and
  mirrors its `disabled` state (`refreshMoreMenuItems()`, called from
  `updateButtonStates()`), so every action keeps one implementation - including
  its confirmation dialog. The language items set the `<select>` and dispatch
  `change`, which is the same path the picker itself uses.
- Reuses the Copy Days popup look: the `.copy-day-context-menu*` rules were
  extended to also match `.more-menu*`, so both stay one bottom sheet on phones
  (48 px tall, full-width items).
- Behaviour: `aria-expanded` on the trigger, focus moves to the first *enabled*
  item, Escape / outside click / resize / scroll-away close it, and focus returns
  to the trigger. Scrolling *inside* the sheet does not close it.
- `updateFooterVisibility()` now checks `getComputedStyle(...).display` instead of
  the inline style, otherwise the CSS-hidden skip button would have kept the
  empty footer row alive. Hiding skip also collapses the footer as designed.
- `ensureLanguageSelector()` no longer writes inline styles on its wrapper (they
  would have beaten any stylesheet rule); the wrapper has a class now.

Measured at 408×900 (`default` study):

| | Before | After |
| --- | --- | --- |
| `.controls` | 99 px / 3 rows | **76 px / 2 rows** |
| `.header-section` | 235 px | **212 px** |
| `#instructionsFooter` | 63 px | **0** (skip moved into the menu) |
| `.timeline-canvas` | 602 px | **688 px** (+14 %) |

Desktop 1600×900 verified unchanged: `.controls` 48 px / 1 row, day row 40 px,
footer 81 px, and Remove Last / Clear timeline / Skip / Language all still
visible with `#moreMenuBtn` hidden.

**Two specs had to be adapted** - and they revealed something worth knowing:
Playwright's default project viewport is `devices['Desktop Chrome']` = 1280×720,
which is *below* this app's 1440 px breakpoint. Specs without an explicit
`test.use({ viewport })` therefore exercise the **mobile** layout.
`instructions_skip_to_thankyou` and `return_url_continue_link` clicked
`#skipReportingBtn` directly, so both now use the new shared helper
`openSkipConfirmation(page)` (e2e_helpers) that finds the action wherever it is
and retries until its handler is wired.

`mobile_layout.spec.js` gained "the secondary controls move into the ⋮ menu on a
phone" and its tap-target list now measures `#moreMenuBtn` instead of the hidden
skip button.

## 6. Done — Remove Last replaced by a delete undo toast (2026-09-30)

Not yet committed. `#removeLastBtn` is gone from the diary, from the ⋮ menu, from
"Helpful tools" on the instructions page and from all 7 locales
(`buttons.removeLast` → `buttons.undo`, `instructions.removeLastHelp` deleted,
`messages.activityRemoved` added).

- Deleting is one tap inside the activity menu, so the way back is a toast:
  `deleteActivityBlock()` remembers the removed row and its index and offers
  **"Activity removed — Undo"** for 6 s. `showToast(message, type, duration,
  action)` gained the optional action button (`.toast-action`; the toast itself
  is `pointer-events: none`, the button re-enables them).
- The inline re-render block in `deleteActivityBlock()` was extracted into
  `rerenderActivitiesInTimeline(timeline, timelineKey)`, so the undo path renders
  identically (and several hundred lines of debug logging went with it).
- Guarded by `mobile_activity_gestures.spec.js` ("deleting through the long-press
  menu offers a working undo"); `copy_days_flow.spec.js` now deletes through the
  right-click menu instead of the removed button.

For the record: the button was once *called* an undo, but it deleted the last
**placed** activity - not the same thing, and not what a toast undoes either. The
toast is a real undo of the deletion.

## 7. Done — instruction banner split by layout (2026-09-30)

Not yet committed. The day-one banner and the template-loaded banner each mixed
both platforms into one string ("...on mobile ... or on desktop ..."), which also
meant a phone was told to "click".

- **Day-one banner** (renamed `banner.instructions*` on 2026-10-13, see the entry
  at the end of this file): two keys, `banner.dayOneInstructionsMobile` /
  `...Desktop`, rendered as two `<span>`s in `index.html` and toggled purely by
  the 1439.98 px breakpoint in CSS (`.banner-text-mobile` / `.banner-text-desktop`)
  — no JS, and `applyTranslations()` covers both.
- **Template banner** (days 2–7, the one participants see most):
  `messages.templateLoadedBannerMobile` / `...Desktop`, chosen in
  `showTemplateBanner()` by `getIsMobile()` at render time (crossing the
  breakpoint reloads the page anyway).
- Wording decisions: full sentences instead of the old telegraphic style (that is
  what made translations drift); **no colour** ("the + button in the bottom right
  corner", matching `instructions.vertical`); "tap" on phones and "click" on
  desktop; "drag its edges" instead of "drag borders"; deletion is always "then
  choose Delete", since it opens a menu (§3).
- **No keyboard-shortcut mentions in any banner** — deliberately dropped; the
  `d`/DEL hint predates the context menu and serves a minority.
- The undo toast is not advertised in the banner either; it announces itself.
- Measured: mobile 124 px (en) / 164 px (de) — the same as the old mixed string,
  so no day-1 regression — and 54 px (one line) on desktop.
- `locales_consistency.test.js`'s required-keys list now names the four new keys.
- Guarded by `mobile_layout.spec.js` ("the day-one banner explains the layout the
  participant is in").

Still platform-mixed by design, because they are study/admin content rather than
UI chrome: `messages.instructionsDefault` and `messages.templateCopiedBanner`.

## 8. Bug fix — the activity menu was invisible below 1440 px (2026-09-30)

Reported by the user: "I long-press with the mouse, the blue circle animation
plays after a delay, but in the end nothing happens (no menu)".

Root cause: the whole `.activity-context-menu` / `.activity-context-menu-item`
rule set lived **inside `@media (min-width: 1440px)`**. Below 1440 px the menu
therefore had **no** styling — in particular no `position: fixed` — so the
`left`/`top` that `showMenu()` sets resolved to nothing and the element laid out
as a plain block in normal flow at the end of `<body>`: measured
`rect {x: 0, y: 824, w: 1265, h: 22}` at a 720 px-tall viewport, i.e. **below the
fold**, with `display: block` and all three items present in the DOM.

Why it appeared only now: before §3 the `contextmenu` handler bailed out with
`if (getIsMobile()) return`, so the menu could only ever open at ≥ 1440 px, where
the media query applies. §3 removed that guard (deliberately — it is the phone
long-press entry point), which exposed the width gate. So it was broken on
**every phone**, not just in a narrow desktop window.

Fix: the base look (position/background/border/shadow/z-index/padding and the
items) moved out of the media query to top level, so it applies at all widths;
the 1440 px block keeps only its width-specific extras, which is what makes the
desktop rendering unchanged. Added a `max-width: 1439.98px` tweak giving the
items a 44 px thumb target and the sheet-like `min-width: 200px` (desktop items
stay 32 px tall / 214 px wide). Verified live with a real long-press at three
widths — 1280×720, 408×900, 1600×900 — all `position: fixed`, on screen, and
opening at the pressed block.

**Testing lesson (the reason §3's tests passed while the feature was broken):**
`expect(locator).toBeVisible()` only checks display/visibility/non-zero size — an
element rendered at `y: 824` in a 720 px viewport is "visible", and Playwright
clicks auto-scroll a target into view, so *clicking* the menu items proves
nothing about position. The long-press test now asserts `boundingBox()` is
inside the viewport and near the pressed block. Confirmed effective by
re-injecting `position: static`: the test fails with
"Expected ≤ 844, Received 1149.84". Use geometry assertions for every popup, not
visibility.

## 9. Done — the copy-day action made unmissable in the day menu (2026-09-30)

The user could not find copy-by-day on a phone even though it worked. Root
cause: it was the **eighth row of a seven-day list**, styled exactly like the day
rows, labelled "Copy this day" - in a menu where every other row means "go to
that day", while the action actually refers to the day the participant is
already on.

- Moved to the **first row, above the day list** and above the "Switch to day:"
  header, with a `fa-copy` glyph (new optional `icon` argument in
  `addMenuItem`), the primary colour, a tinted background and a rule under it -
  so it cannot be read as a day.
- Relabelled with the direction and the day: `messages.copyDayToAnother` =
  "Copy {{day}} to another day" → "Copy Monday to another day" (the first key
  with the `{{day}}` placeholder in a *menu*; `moreMenuLabel` now forwards
  params, and the fallback passed to it is already interpolated so the
  not-yet-loaded-i18n path stays readable).
- Added to all 7 locales and to `locales_consistency.test.js`'s required keys.
- Guarded by `mobile_context_bar.spec.js`: first row is the copy row, it names
  the current day, it carries the glyph, and it sits above the day list.
- Desktop is untouched: `#dayPickerBtn` does not exist ≥ 1440 px, and the
  timeline-title `.copy-day-link` button is unchanged (verified 1600×900).

Known rough edge, fixed in §11: on a day with no activities the row used to be
fully active and only toast `copyEmptySource`.

### Long-term idea (user, 2026-09-30)

Once saving happens on every action (see "Deferred - autosave"), **Save Day can
go away**, and its toolbar slot is a good home for copy-day: one prominent
button in the main controls instead of a row inside the day menu. Not now - it
depends on autosave, and until then the day menu is where the copy target is
picked anyway.

## 10. Page titles and participant-facing naming (2026-09-30)

Not mobile work, but found while testing the mobile layout.

### The bug: the tab sat on "Loading..." forever

The diary's `<title>` was wired to the **loading** key:
`<title data-i18n="common.loading">Loading...</title>`. `i18n.applyTranslations()`
rewrites the text of every `[data-i18n]` element - `<title>` included - so this
happened, measured with a MutationObserver on the title:

```
  71ms  static markup   "Loading..."
 106ms  script.js       "KI Time Use Diary - Adults"   <- document.title = configData.general.app_name
 108ms  i18n pass       "Loading..."                   <- clobbered 2ms later
```

Reproduce on demand: set the title to anything and call
`window.i18n.applyTranslations()` once - it comes back as the loading string (in
German: "Wird geladen ..."). Nothing to do with the backend or caching, and it
re-broke on every re-order of the init sequence, which is why it kept coming back.

Two further late i18n passes made any `data-i18n` title unusable for the study
name: `ui.js` (activities modal) and `maintenance.js` both call
`applyTranslations()` **after** the diary is built.

### Pre-existing bug found on the way

`footer.js renderFooter()` did `targetFooter.innerHTML = ''` on `#footer`, which
deleted `#footer_app_title`, `#footer_app_version` and `#footer_backend_status` on
every page with footer links. So the version and the backend status the diary sets
were never visible; the footer showed the links row only. It now replaces just its
own `.trac-legal-footer-links` row.

(`#footer_backend_status` was removed outright on 2026-10-13 - it told
participants "Connected to backend", which they had no use for; `#footer` now
holds `#footer_app_title` and `#footer_app_version` only.)

### The rule that now holds

**Chrome that JS fills must not carry `data-i18n`**, because any i18n pass (init,
language change, activities modal, maintenance banner) rewrites those elements:

| element | owner | markup |
| --- | --- | --- |
| diary `<title>`, `#footer_app_title` | `applyPageTitle()` (`script.js`) | no `data-i18n`, English fallback |
| consent / tasks `<title>` | `setStudyPageTitle()` (`footer.js`) | no `data-i18n`, page-name fallback |
| instructions / open studies / thank-you / timeout `<title>` | i18n pass | `data-i18n` = the page name |

`applyPageTitle()` runs after `applyTranslations()` for the same reason;
`setStudyPageTitle()` (in `footer.js`, loaded on every page) is the shared helper
for study pages and is called after the i18n pass on consent and tasks.

### Naming decision: who sees which name

Approved 2026-09-30: **participants see the study, not the software.** A
participant knows the study their invitation named; "TRAC" is an unexplained
acronym in their tab, and the study config already carries a better identifier
(`general.app_name`: "KI Time Use Diary - Adults" in EN, "KI Zeitverwendungstagebuch
- Erwachsene" in DE for the same study - it is even localized per study).

- Diary tab + footer: `general.app_name`, fallback the localized `common.pageTitle`.
- Study pages: `common.pageTitleWithStudy` = "{{study}} - {{page}}" (one shared
  pattern; `consent.pageTitleWithStudy` was dropped).
- Brand-free page names everywhere participant-facing: `Consent`, `Instructions`,
  `Open Studies`, `Tasks`, `Thank You`, `Session Timed Out` (the SV/FR/ES/FI/PL
  values kept "TRAC"/"O-ELIDDI", EN/ES instructions mixed "Time Use Diary").
- The fatal-error tab title is no longer "TRAC -- ERROR": study name (or the
  generic name) + localized "Error".
- **TRAC stays** for operator/developer surfaces: admin portal, `dev.html`, repo
  docs, logs, service names. Only participant chrome changed.
- Deliberate deviation from the plan: **instructions.html keeps a plain
  "Instructions" title** (no study prefix). That page does not load the study
  config, and adding a config fetch purely for the tab title is not worth it.

### Guards

- `tests/unit/page_titles.test.js` - the diary title carries no `data-i18n`, the
  JS-owned pages have brand-free fallbacks equal to their English locale value,
  i18n-managed titles match their key, no `TRAC`/`O-ELIDDI` in any participant-facing
  title/heading across all 7 locales, `common.pageTitleWithStudy` interpolates both
  placeholders. **When you add a participant page, add it to `I18N_TITLED_PAGES` or
  `JS_TITLED_PAGES` and to `PARTICIPANT_FACING_KEYS`.**
- `tests/e2e/page_titles.spec.js` - the diary tab equals `general.app_name` and is
  never the loading string (en + de), and consent/open-studies identify the study
  without the brand. Run with `--repeat-each=2` when touching the init order.

## 11. Copy day: push-only, disabled when it cannot run, jump-to-target toast (2026-09-30)

### Push-only is the design, not a limitation

An earlier version had both directions ("Copy this day" and "Copy from..."). The
user removed the pull direction as irritating, and argued the case better than the
plan did: **the participant must see what they are copying, so they have to be on
the source day.** Two more reasons it stays gone:

- The pull direction is the *risky* one: overwriting a day from a source that is
  not on screen. Push only ever overwrites a target the participant picked from a
  list that labels each one `(empty)` / `(has data)`.
- One row, one direction keeps the day sheet small - the reason pull was dropped.

So: **do not re-add a reverse picker.** The dormant code was deleted rather than
left behind a flag (`agents.md`: no backwards-compatibility bloat):
`showCopySourcePicker()` and its `window` export, the `copy-from-link` branch in
`addCopyDayLink()`, `SHOW_COPY_FROM_BUTTON` (main settings + the 4 dev settings
templates), and `messages.copyFromDay` in all 7 locales. No test referenced any of
it. The historical docs under `dev_tools/copy_days_plan/` stay as records.

### The row is disabled with the reason on it - not hidden, not silent

The row is now **always present** in the day sheet (only a single-day study, where
copying cannot exist, omits it) and:

- **day has activities** → active: accent blue, copy glyph, wraps to a second
  line if needed;
- **day is empty** → `disabled` + greyed, with `messages.copyEmptySource` shown as
  a `.context-menu-item-detail` line: "Source day has no activities to copy."

The user's rule: a greyed-out control teaches that the feature exists, a missing
one hides it. So it is never hidden, and the reason is **on the row** rather than
behind a tap - the same "greyed out, but tell them why" shape Save/Submit use.

The first attempt used `aria-disabled="true"` + a click that toasted the reason.
That was wrong twice over: Playwright's actionability check treats `aria-disabled`
as disabled (so the click never even ran in the test - it timed out), and it made
assistive tech announce a control as unavailable while it still acted. A real
`disabled` property plus a visible reason is honest and needs no interaction.
Layout note: the shared `.context-menu-item:has(.context-menu-item-detail)` rule
stacks rows as a column, which put the copy glyph on its own line, so the copy row
uses `display: grid` (`auto 1fr`) with the icon spanning both rows.

### After a copy, offer the jump

Copying persists the source day and **stays on it** (it never advances
`day_label_index`), so the participant still has to walk to the day that was just
filled. The success toast now carries an action: `messages.goToCopiedDay` =
"Go to {{day}}" → `saveAndSwitchToDay(target)`. The toast gets 6 s instead of 4 s
when it carries an action (a second line has to be read and chosen). No action
when the target *is* the day being viewed - that case reloads after 3 s anyway.

Guarded by `mobile_context_bar.spec.js`: the row is disabled with the reason on an
empty day (and enabled, with the tooltip line gone, once the day has an activity),
and the copy flow's toast action lands on the copied day with its activities.

## 12. Copy overwrite asked in the browser's bare prompt (2026-09-30)

Reported from testing: confirming an overwrite showed a completely unstyled
browser dialog. Cause: `copyDayTo()` asked with `window.confirm()` - the only
native prompt left in the app; every other confirmation is a styled
`.modal-overlay` dialog.

**The dialog was already specced and never built.** `dev_tools/copy_days_plan/
implementation_plan.md` names a confirmation dialog with `copyOverwriteTitle`,
`copyOverwriteConfirm`, `copyOverwriteYes`, `copyOverwriteNo`, and the E2E helper
was written against `#copyOverwriteConfirm` / `#copyOverwriteYes` - but only the
*message* key ever landed, so the implementation fell back to `window.confirm()`
and the helper's branch was dead code. The dialog is now built with exactly those
ids.

- New generic `showConfirmDialog({ overlayId, confirmId, cancelId, title,
  message, confirmLabel, cancelLabel })` in `ui.js` → `Promise<boolean>`. It
  lazily creates the overlay from the shared modal markup (`.modal-overlay >
  .modal > .modal-content` + `.button-container`), reuses it on later calls, and
  resolves `false` on Cancel, Escape or a backdrop click.
- The cancel button carries `data-modal-cancel`, which was added to
  `MODAL_CLOSE_SELECTOR` so the existing focus manager closes the dialog on
  Escape and restores focus - no new focus code.
- Keys: `messages.copyOverwriteTitle` ("Overwrite day?") and
  `messages.copyOverwriteYes` ("Overwrite") added to all 7 locales; the cancel
  label reuses `buttons.cancel`, so the plan's `copyOverwriteNo` was unnecessary.
- **Latent bug fixed:** `e2e_helpers.copyDayTo` / `rightClickCopyDay` clicked
  `.nth(targetDayIndex)`, but the picker excludes the source day, so the item for
  target N sits at N-1 (the neighbouring spec had the correct maths inline). Dead
  code until this test started using it.
- Guarded by `copy_days_flow.spec.js`: the dialog is a styled `modal-overlay` with
  the expected title, message and button labels; **Cancel leaves the target day's
  own activity in place** (2 activities stay 2) while Overwrite replaces them
  (2 -> 1); and a `page.on('dialog')` trap fails the test if a native prompt ever
  returns.

Optional follow-up (not done): the skip-confirmation and clear-timeline modals
still hand-roll the same markup in `createModal()`. They could call
`showConfirmDialog` with their own ids and lose ~60 lines of duplication - worth
it only if we touch them anyway.

## 13. Autosave prerequisite work: slices 0 + 1 (2026-09-30)

Approved direction for autosave: save on every **committed** edit, debounced, then
drop Save Day last. The full assessment (backend, frontend, performance) is in the
session report; the two slices below are the ones that pay off even if we stop
before building the engine.

### Slice 0 — backend: the write path is now cheap

`submit_activities` used to do one `session.delete()` **per existing row**, then
insert one by one, then `session.refresh()` **per new row** after the commit (N
SELECTs) - and the response only reports counts. Now:

- existence check is a `SELECT count(*)` (no N ORM objects materialised to be
  deleted),
- the delete is **one** `delete(Activity).where(...)` statement,
- the refresh loop is gone (nothing downstream uses the generated ids; rows are
  re-created on every save anyway).

Measured on the dev stack (localhost, 2 timelines, one transaction per save):

| day size | before | after |
| --- | --- | --- |
| 20 activities | mean 26 ms | mean 25 ms |
| 60 activities | mean 53 ms | mean 43 ms |
| empty payload (fixed overhead only) | - | **13 ms** |

The gain is modest at small sizes because **half the per-save cost is fixed**
(config validation, study/participant/day-label/timeline lookups, HTTP) - which is
the number that matters for autosave: *request count*, not row count, is what to
budget for. The next lever, if autosave volume ever hurts, is caching the
per-request activity-config validation (it re-reads/re-parses the study's config
on every save).

**Do not make this an incremental write** (only changed rows) without revisiting
`diary_completed_at`: it is `MAX(MIN(created_at) per day_label)` (api.py:758), and
because every save re-creates the day's rows, a day's MIN is "last save". With
incremental writes that becomes "when the first activity was added" and the
completion timestamp silently shifts hours earlier. Snapshot semantics preserve it.

### Slice 1 — frontend: Save Day no longer reloads the page

`handleSaveDayAction()` used to toast and then `window.location.reload()` after
1.5 s. That reload (i) re-fetched the day the participant was already looking at,
(ii) re-ran the whole init (config fetch, banner, timers), and (iii) was the only
reason a save took ~2 s. Removed; `refreshDayStatusAfterSave()` (ui.js) now does
in place what the reload actually updated:

- `dayIndicesWithData` / `dayIndicesMeetMinCoverage` for the current day, both
directions - using `getCurrentDayMeetsMinCoverage()`, which already mirrors the
backend rule including the "no min_coverage -> any activity counts" fallback, so a
**cleared-then-saved day greys out immediately** instead of only after a reload;
- `renderPreviousDaysSwitchRow()` + `updateButtonStates()` (day row, submit gate,
  coverage indicators, context bar, menu items).

**Two couplings the reload was hiding** (both fixed):

1. **The inactivity timer.** `sendData()` stops it before submitting and nothing
   restarted it - the post-save reload did. Without that, the timer stayed dead
   for the rest of the session and a participant could leave the diary open
   forever. `sendData()` now restarts it from the study settings
   (`restartIdleTimerForStudy()`), verified live with `tudIdleTimeout.isActive()`.
2. **The dead redirect path.** Every `sendData()` call passed
   `shouldRedirect: false`, so `handleDayNavigation()` (whose whole body was
   `window.location.reload()`) was unreachable. Deleted, and the four call sites
   now just call `sendData()`.

Also verified live (desktop 1600×900, no reload): the day flags update, the day
button turns green, the Save button re-enables, the toast shows, the activity stays
rendered, and the row is really in Postgres afterwards (checked with psql).

Test impact: `e2e_helpers.saveCurrentDay()` now waits for the **2xx POST** instead
of a reload (a save no longer navigates), and
`mobile_context_bar`'s "both timelines survive a save" reloads explicitly, since
that is what the test is actually about. Full chromium suite: **78/78, 4.0m ->
3.0m**; individual saves went 7.5 s -> 2.0 s, 17.2 s -> 6.2 s in the specs.

### What is left of autosave

All four slices are done: §13 (cheap write path, no reload after save), §14 (the
engine), §15 (the visible state) and §16 (Save Day removed, Clear timeline undo).
What is *not* covered anywhere yet, if the topic comes back:

- **Undo for other day-wide actions.** Copy day can overwrite a target day; it
  asks in a styled dialog first, but there is no undo afterwards either.
- **Two tabs on the same day** are still last-write-wins with no merge; the draft
  in local storage is per browser, not per tab.

## 14. Done — autosave engine, slice 2 (2026-09-30)

Edits reach the backend on their own now. `frontend/src/js/autosave.js` is the
whole engine: no DOM, no network, `save` and `serialize` are injected, so every
timing rule is unit-testable without a browser.

### The rules it enforces

1. **First observation only seeds the reference point.** The day the backend just
   loaded is not written back.
2. **Snapshot diff.** No request when the serialised day equals the last stored
   one. This is what makes `notePossibleChange()` safe to over-call from a
   re-render - and it matters beyond efficiency: every save re-creates the day's
   rows, so a pointless write also moves `created_at`, i.e. the participant's
   `diary_completed_at` (`api.py:758`).
3. **Debounce with a ceiling.** Burst -> one request (`debounceMs` 2 s), but
   continuous editing still saves at least every `maxWaitMs` 10 s, so the work at
   risk stays bounded.
4. **Single-flight.** One save at a time per day; changes made while a request is
   in flight are queued, never overlapped. This is the corruption guard.
5. **Retry with backoff and a state.** `[2 s, 5 s, 15 s]`, then `error`, with the
   latest content always sent (never the snapshot that failed).

API: `notePossibleChange()`, `flush()`, `markSaved()`, `resetBaseline()`,
`dispose()`, `state()` (`idle|pending|saving|saved|error`), `isSaving()`,
`hasPendingChanges()`, `lastSavedAt()`.

### Wiring (all 11 points, `script.js` + `ui.js` + `idle_timeout.js`)

- Created in `init()` right after `startIdleTimer()`:
  `save: () => sendData()`, `serialize: () => createTimelineJSON(true)`,
  `onSaved: () => { refreshDayStatusAfterSave(); markDaySavedForCurrentDay(); }`.
  **Answers the day-completion question**: the day row, the submit gate and the
  coverage indicators are refreshed after *every* autosave, not only after an
  explicit save.
- `notePossibleChange()` is called at the tail of `updateButtonStates()` - the one
  chokepoint every mutation and re-render already goes through.
- Flush points: `saveAndSwitchToDay()` (aborts the navigation if the write fails),
  Submit Study, `visibilitychange`, `pagehide`, and the idle timeout
  (`_onTimeout()` caps the flush at 4 s before redirecting).
- `sendData()` takes **no options** any more; `copyDayTo()` calls `markSaved()`
  after the source day was stored, so the copy's own save is not duplicated.

### Three traps found while verifying this

1. **`createTimelineJSON` was missing from `script.js`'s `./utils.js` import
   list.** The `serialize` closure threw, from `updateButtonStates()`, so *app
   init* failed with "Failed to initialize application" and the activity picker
   never opened. `tsc` cannot see it: `script.js` is deliberately not `@ts-check`ed.
   Lesson: a new cross-module call inside `script.js` is only checked at runtime -
   run one edit-touching E2E spec right after wiring it.
2. **`sendData()` already retries 5xx itself** (`fetchWithSmartRetry`,
   `maxRetries: 2`, 2 s apart). A single mocked 500 therefore *succeeds* after the
   internal retry and never surfaces as an autosave failure; the E2E retry test has
   to fail the whole first attempt (3 requests) to reach the engine's own retry.
3. **Specs written around "unsaved" semantics.** `mobile_activity_gestures`'
   swipe test counted POSTs from before the placement; it now waits for the
   placement's autosave to settle first. The no-op test needs a *filled* day (an
   empty one makes `sendData()` short-circuit, so the write it guards would not
   show up as a request) and the phone breakpoint, because the day/timeline sheets
   only exist in the context bar.

### Guard quality

- 13 unit tests (`tests/unit/autosave.test.js`) cover the timing rules with an
  injected clock; 5 E2E tests (`tests/e2e/autosave.spec.js`) cover what only a
  browser can show: the edit reaches the backend and survives a reload, a burst is
  one request, a day switch flushes first, a re-render writes nothing, and a
  failed save is retried.
- Fault injection: removing the two `snapshot === baseline` guards makes the
  autosave spec fail (the day never settles - each save's `onSaved` ->
  `updateButtonStates()` -> `notePossibleChange()` -> another save, i.e. a write
  loop at the debounce interval). That is the regression the diff prevents.

## 15. Done — visible sync state, slice 3 (2026-09-30)

Autosave is silent by design, so it must not be *invisible*: a participant who
never presses a button needs another way to see that their day is stored, and
above all to notice when it is not.

| engine state | chip |
| --- | --- |
| `idle` | hidden |
| `pending` / `saving` | "Saving..." + spinner |
| `saved` | "Saved" + check, fades after 2.5 s |
| `error` | "Not saved" + **Retry**, stays until the day is stored |

The mapping is `sync_status.js` (state -> kind / label key / icon / retry?), which
keeps it unit-testable; `renderSyncStatus()` in `ui.js` owns the DOM and is called
from the engine's `onStateChange`. Three properties worth keeping:

- the chip is built lazily and **appended to the toolbar** (`.header-section .controls`, see the trap in §16 - `insertAdjacentElement('afterend')` on the toolbar itself puts it *outside* it);
- the retry calls `flush()`, which clears the scheduled backoff - it is *the*
retry, not a second one racing the engine's own timer;
- the text carries `data-i18n`, so a language switch re-translates it like any
other label. `role="status"` + `aria-live="polite"` announce it; the retry is a
real button (24x24, WCAG 2.2 SC 2.5.8); `prefers-reduced-motion` drops the
spinner.

### The placement decision (the only interesting part)

Inline in the toolbar costs nothing on desktop - measured `.header-section`
**132 px with and without** the chip. On a phone the same inline chip pushed the
buttons onto a second toolbar row: **99 -> 137 px**, on every save, right while
the participant is dragging blocks. It was unacceptable for the reason this whole
plan exists, so below 1440 px the chip is `position: fixed` at the bottom left,
mirroring the `+` button on the right: header stays **99 px**, and the chip is
visible even when the timeline is scrolled. Guarded by
`autosave.spec.js > the toolbar stays quiet while the day is being stored` and, for
desktop, by the toolbar-height check in the same spec.

**Changed 2026-10-13: the chip is failure-only.** "Saving..." and "Saved" are
gone (from the mapping, the CSS and all 7 locales) after participant feedback that
the constant saving chatter read as lag - so the guards above now assert that
*storing a day puts nothing on screen*, and that only the failure state appears.
The chip is still built with the toolbar, because an `aria-live` region has to
exist in the DOM before the failure it announces is written into it.

### i18n

4 new keys x 7 locales: `messages.syncSaving`, `messages.syncSaved`,
`messages.syncNotSaved`, `messages.syncRetry`, plus the four in the required-keys
list of `locales_consistency`. (Chosen over a `buttons.retry` key because it keeps
one insertion point per locale file - the anchor is the identical `✓` line.)
`syncSaving` and `syncSaved` were dropped again on 2026-10-13 (see above), so the
chip now owns two keys.

### Guards

- 8 unit tests (`tests/unit/sync_status.test.js`): every engine state has a
presentation, `idle`/unknown hide the chip, only the progress states spin, only
the failure offers a retry, a failure never shares its label with a success, and
the confirmation outlasts the debounce it follows.
- 3 E2E: the chip is hidden until the first edit, shows Saving... then Saved and
then fades; a failed save shows "Not saved" with a retry that stores the day
(within 1.5 s of the click, i.e. before the engine's own 2 s backoff, so the click
is provably what caused the request); and the phone layout guard above.
- Fault injection: making `onStateChange` a no-op fails the chip test
(`#syncStatus` never appears), and removing the retry's click handler fails the
retry test (`attempts` stays at 3 inside the poll window).

## 16. Done — Save Day removed, Clear timeline gets an undo, slice 4 (2026-09-30)

The button is gone: a day is stored by autosave, so a control that only duplicates
that is a second thing to explain and to get wrong. Everything that surrounded it
went with it:

- `#saveDayBtn` and `.save-day-btn` (index + instructions page + both stylesheets);
- `buttons.saveDay` and `messages.daySavedStayOnPage` x 7 locales;
- `handleSaveDayAction()` and its debounce vars, the button's click handler, the
  `saveDayBtn` branch in `updateButtonStates()` (with it the dead `canProceed`,
  `isLastTimeline`/`totalTimelines`, `isLastStudyDay`/`totalStudyDays` locals);
- **the whole disabled-button overlay mechanism** (`createDisabledButtonOverlay`,
  `updateDisabledButtonOverlays`, `initializeOverlays`, its MutationObserver and
  the 2 s `setInterval` fallback). It existed only to make the *disabled* Save Day
  button explain itself with `messages.timelineMissing` - so it was also a
  permanent 2 s timer. The coverage row ("0 of 10 required minutes covered", "Please
  cover the entire timeline.") already tells the participant what is missing.

Step 4 of the instructions page no longer shows a Save Day demo button; its text
now says the day saves itself while you edit, that you can still edit it later, and
that Submit Study ends the study (`instructions.step4.title` kept, `.description`
rewritten in all 7 locales - and shortened again in §19: the status-chip/Retry
sentence was dropped as too much detail for a page nobody re-reads).

### Clear timeline needed an undo (the one thing Save Day was still protecting)

The old flow was forgiving by accident: nothing was in the database until Save Day
was pressed, so a mis-clicked Clear timeline could be undone by reloading. With
autosave the empty timeline is stored within a second, so the deletion is
permanent - and the confirm dialog guards against a slip, not against regret. It
now offers the same undo the single-activity delete does (`showUndoClearTimelineToast`
-> `undoClearTimeline` in `script.js`, `performClearTimeline` snapshots before
clearing): `messages.timelineCleared` + `buttons.undo`, 8 s instead of 6 s, and
the restore goes through `updateButtonStates()` so the day is written again.

### The trap: a chip *beside* the toolbar instead of in it

With Save Day gone the chip's anchor became the toolbar, and
`insertAdjacentElement('afterend', chip)` on `.controls` inserts as a *sibling* -
so the chip got a line of its own inside `.header-section`. That moved the
timeline up and down again at every save state change, and
`autosave.spec.js > a burst of edits becomes a single request` (three placements
in ~1 s, each reading its own `boundingBox()`) failed **deterministically** with
two of three clicks missing. Fixed by appending *into* the toolbar, and pinned by
two new assertions in `the toolbar reports what happened to the day`: the chip must
be a descendant of `.controls`, and toggling its `hidden` must not change the
toolbar's height. Verified live: toolbar 48 px and `.header-section` 132 px with
and without the chip on desktop, header 99 px on a phone.

### Test impact

`e2e_helpers.saveCurrentDay()` no longer clicks anything: it flushes the engine and
waits until it is neither sending nor pending. `mobile_context_bar` (which asserted
the button was visible and clicked it) and `mobile_layout` (which measured it as a
tap target, now `#clearTimelineBtn` is hidden on phones so it measures
`#submitStudyBtn`) were adapted; the new clear-undo case lives in `autosave.spec.js`.

## 17. Desktop clean-up: toolbar, language control, menu, footer (2026-09-30)

Four things the user spotted on a large screen. All four are about the toolbar
having accumulated controls that do not belong to the day:

### 1 + 4. The language picker and "Skip time reporting" move into ⋮ at every width

The ⋮ trigger was phone-only (`display: none` from 1440 px up) because desktop
had the individual controls. Now it is the home of exactly the two actions that
should not compete with the day's own buttons:

- **Skip time reporting** - a last resort, not something to offer all day. It was
  the sole occupant of its own footer row (`#instructionsFooter`), which is now
  collapsed at every width (`updateFooterVisibility` keys off the button's computed
  display, so CSS-hiding it is all it takes). The row's markup stays: it is what the
  page's `--footer-height` bookkeeping and `autoscroll.js` measure, and removing it
  would touch that plumbing for no user-visible gain.
- **Language** - touched about once per participant. `#languageSelectMain` stays in
  the DOM (hidden) and the menu enumerates its options, so nothing else changed.

Desktop toolbar now: `Switch timeline | Clear timeline | Submit Study | ⋮` (pinned
by the new `mobile_layout.spec.js > on desktop > the toolbar holds only the day
actions`). The remaining `#footer` (study name, version, backend status, Imprint /
Privacy / Study Info / Contact) stays - the user confirmed removing it is a policy
call, and the legal links are usually required.

### 1b. One compact language control on the pages that need it visible

Consent and instructions must offer the language *before* the diary, so they keep a
visible control - now the same pill everywhere (`styles/language-pill.css`, linked by
both pages): a globe, the code, a caret, one rounded border, native `<select>`
underneath (`appearance: none`, so no platform chrome), and the word "Language"
kept in the DOM for screen readers only. A globe is also the one label that works
for someone who cannot read the page's current language - which is exactly who
needs the control.

### 2. The status chip no longer shuffles the toolbar

The toolbar row is centred, so an in-flow chip re-centred everything beside it -
measured: **Submit Study moved 86 px** every time the chip appeared or faded. Now
the buttons live in `.controls-group` and the chip is absolutely positioned against
that group (desktop) / fixed (phones), i.e. out of the flow in both layouts.
Verified live at 1600 px and 1440 px: Submit Study stays at the same x with the chip
shown and hidden, and the chip never overlaps the controls or leaves the viewport.
Guarded in `autosave.spec.js > the toolbar reports what happened to the day`.

### 3. "Copy this day" sits level with the day text

Baseline alignment hung the inline-flex button ~5 px below the 24 px title text and
below the title's own box, so it ate into the gap above the timeline. The title is a
flex row now (`align-items: center`), which puts the button level with the day name
and restores the space underneath; the 2 px of extra air the user asked for comes
from `margin: 4px 0 6px 0` on the title. Measured: button top 153 -> 149 against the
day text at 148, and 30 px of clearance to the timeline canvas. Guarded in
`copy_days_flow.spec.js` (button centre within 2 px of the day text, >= 8 px above
the timeline).

## 18. Instructions page: step badges out, heading levels answered (2026-09-30)

### The numbered circles are gone

Participants complained the blue badges 1-4 are "not referenced in text". They are
right, and there was nothing to fix by referencing them: the headings already name
each step, the order is the page order, and the badge was the reason
`applyCopyDayStepVisibility()` had to renumber the visible steps whenever it hid
"Copy a Day". Removed (`instructions.html` x4, `.step-number` + the row-layout
media query in `instructions.css`, the renumbering loop in `instructions.js`).

Measured what it saves: **48 px per step on a phone** (the badge stacked above the
content below 768 px: 492 -> 444 px, i.e. ~190 px over four steps), nothing in
height on desktop where it sat beside the content, and ~32-40 px of width back to
the text/GIF column there. Content now starts at the card's padding only (24 px
desktop / 16 px phone), no sideways scroll at either width.

### What heading level equals the illustrated steps' headings: `##`

Question from the study side: headings in their own `study_text_*` markdown are not
the same size as the headings above the instruction images. Answer, measured by
injecting one heading per level into the study-text container and reading the
computed style back (identical at every width, both sides use the same `clamp`):

| markdown | element | laptop | phone | weight | colour |
| --- | --- | --- | --- | --- | --- |
| `#` | `h1` | 32 px | 24 px | 700 | primary blue, centred |
| `##` | `h2` | **24 px** | **20 px** | **600** | `--text-color` |
| `###` | `h3` | 22 px | 18 px | 600 | `--secondary-color` (grey) |
| `####` | `h4` | 16 px | 15 px | 700 | browser default, 1.33em margin |
| `#####` / `######` | `h5`/`h6` | 13.3 / 10.7 px | 12.5 / 10.1 px | 700 | browser default |

The illustrated steps, "Helpful tools" and the "Visual Illustrations…" section
title are all `h2`, so **`##` is the level that matches exactly** - size, weight,
colour and spacing. `###` is one step down and grey (it is what the page's own
"General Information on the Study" uses). `####` and deeper are the complaint:
these pages only style `h1`-`h3`, so deeper levels fall back to browser defaults -
bold, smaller, and off-palette.

Written up for study authors in `README_CREATE_STUDY.md` ("Which heading level to
use on the instructions page"), including the reasoning, so the answer we give is
a rule rather than "fix your file".

**Our own default had the same bug**: `instructions.instructionsDefault` started with
`####` in all 7 locales, so every study that did not write its own second text block
showed the 16 px browser-default heading directly under the 24 px step heading.
Changed to `##` in all 7; verified live (level 2, 24 px desktop / 20 px phone, i.e.
identical to the step headings).

## Known landmine — done in §3 (the gesture was removed)

`initMobileSwipeNavigation()` (mobile only): a **left** swipe clicks `#nextBtn`,
which since Copy Days is **Save Day** — so an accidental horizontal swipe saves
the day and triggers a 1.5 s `location.reload()`. It does not check whether an
activity is being dragged, and a fast horizontal drag looks exactly like a
swipe. A right swipe now clicks the switcher.

Decided 2026-09-30: **not just guarded — the gesture goes.** With the timeline
switcher, the day control and the day sheet there is nothing left for it to do,
and it is the only control that can silently save a day mid-drag. **Removed in
§3.**

---

## Deferred — autosave instead of "Save Day" (decided 2026-09-30)

**All four slices are done — see §13** (cheap write path, no reload after save),
**§14** (the autosave engine), **§15** (the visible sync state) **and §16** (Save
Day removed, Clear timeline undo). What follows is the original assessment, kept
because it is where the non-negotiables (single-flight, visible failure state,
undo for Clear timeline, no new reloads) were worked out.

Question: save after every action, so the reloads and the Save button disappear?
Answer: **not now, and not as a prerequisite for the mobile work.**

- It needs **no order tracking**: `createTimelineJSON()` serialises every
  timeline of the current day, and the endpoint deletes all rows for
  (study, participant, day_label) before re-inserting — every save is an
  idempotent full-day snapshot, so last-write-wins is already correct.
- There is **no audit trail to preserve**: `Activity` has `created_at` only (no
  `updated_at`, no version), and delete+insert means `created_at` already reads
  as "when this day was last saved".
- **Half of it already exists locally**: `draft_storage.js` keeps the in-progress
  day in sessionStorage + localStorage, and `sendData()` clears it on success.

What it would really need, by risk: a save queue (never two in-flight saves for
one day — overlapping delete/insert can duplicate or blank rows); a visible sync
state (`Saving… / Saved / Not saved — retry`), because silent autosave failure is
worse than a failed explicit save; day-completion flags from the save response
instead of the reload; `markDaySaved()` fed by autosave instead of the button;
and a **policy decision** on whether every glance writes real DB rows (draft vs.
final day) — the only genuinely expensive part.

**Contained subset, worth its own step:** drop the `location.reload()` in
`handleNextButtonAction()` (Save Day saves *and* reloads while staying on the same
day) and refresh the local flags through `updateButtonStates()`. Removes one of
the two reloads per day with no backend change; `e2e_helpers.saveCurrentDay()` is
written around that reload and gets faster once adjusted.

**Coupling rule for the UI work:** the day sheet reuses `saveAndSwitchToDay()`, so
if autosave lands later the sheet just loses its save step. Add no new reloads.

---

## Facts worth not re-deriving

- Breakpoint: `globals.js getIsMobile()` is `innerWidth < 1440`, which matches
  the CSS `max-width: 1439.98px` exactly; desktop is `min-width: 1440px`.
  Crossing it reloads the page.
- Measured at 408×900 (`default` study, 7 days, 2 timelines) — re-measured
  2026-09-30, see "Verified current state" above: `.header-section` 235 px
  (`.controls` 99 px / 3 rows, `#previousDaysSwitchRow` 76 px / 2 rows,
  `.timeline-header` 28 px), `.timeline-canvas` 602 px. The earlier numbers
  (212 / 76 / 2 rows / 625) predate the timeline switcher.
- `styles.css` has **two** `@media (max-width: 1439.98px)` blocks; the second
  one ("Mobile vertical layout", ~line 700) is the one that decides timeline
  visibility and wins over the first.
- On mobile the activity picker is the floating `+` button → `#activitiesModal`;
  the inline `.activities-container` is 0×0 there. In tests use
  `findTimelinePoint()` for tap coordinates and `hasTouch: true` for `.tap()`.
- `updateButtonStates()` (ui.js) is the single chokepoint called on every
  activity mutation — the right place to refresh any new control's state.

## Test status / debt

Green 2026-09-30 after §17: `sh test_frontend_typecheck.sh`,
`sh test_frontend_unit.sh` (90/90, incl. `locales_consistency` key-set +
untranslated-value guards, the `page_titles` guards, the 13 `autosave` and the 8
`sync_status` tests), the backend suites (`test_backend_unit.sh` 156/156,
`uv run pytest tests/integration` 126/126 against the running dev server), and on
chromium **88/88** in **4.1 min**.
New specs added during this work: `mobile_activity_gestures` (§3),
`mobile_context_bar` (§4, day/timeline sheets + the copy row),
`page_titles` (§10), `autosave` (§14 engine, §15 status chip, §16 clear undo).

Everything that had to be adapted for steps 4–6 has been adapted:

- `e2e_helpers.js` — `switchToDay` (layout-aware: `#dayPickerBtn` / `#dayMenu`
  below the breakpoint), `placeActivityMobile`, `openSkipConfirmation` (skip lives
  in the ⋮ menu on phones, so specs must not click `#skipReportingBtn` directly).
- `copy_days_flow.spec.js` runs at 1600×900 and is unaffected by mobile-only
  hiding; it is the only spec using `switchToDay` / `isDayButtonGreen` /
  `getDayButtonCount`.
- The old "no mobile test fills both timelines" gap (the one that let the §2
  reachability bug live) is **closed**: `mobile_context_bar.spec.js` fills both
  timelines of a phone day and saves.

## Done — the block surface scrolls on phones (2026-10-12)

Reported as "Handy-Scrollen defekt" and confirmed by measurement at 408×900 with
real touch input (CDP `Input.dispatchTouchEvent`): a swipe starting on an activity
block moved `.timelines-wrapper` by **0 px**, the identical swipe 30 px to the left
(the free gutter) scrolled it by ~244 px. Cause: `.activity-block` carried
`touch-action: none` at every width - it was there for the desktop drag - while
blocks cover 75 % of the timeline width (`MOBILE_BLOCK_WIDTH = 75`), so most of
the surface could not scroll. The vendored `interact.min.js` does not manage
`touch-action` (0 occurrences), so it was purely our CSS.

Fix (`styles.css`, `script.js`): below 1440 px the block body is
`touch-action: pan-y pinch-zoom`, and each block gets two hit-testable
`activity-block-edge-zone` spans (`touch-action: none`) reserving the top/bottom
bands for the resize. Measured trade-off, tuned in one place: interact starts a
resize 4–20 px from an end, so the band is `min(16px, 40%)` - ~80 % of the old
resize target kept, and a 30-minute block (~51 px) still has a scrollable middle.
`.timeline-canvas` additionally allows `pan-y` so engines that intersect
touch-action strictly (Safari) do not veto the scroll - Chrome scrolled either
way, and this is not verified on a real iPhone.

Guarded by `mobile_block_scroll.spec.js`: computed touch-action + the reachable
end band on every engine, and real-touch behaviour (swipe scrolls, end drag
resizes without scrolling, still touch opens the menu) on Chromium. Note the
other mobile specs drive the phone layout with a *mouse*, which browsers never
subject to `touch-action` - that is why this class of bug was invisible to them.

## Done — the second timeline says what it is (2026-10-12)

Two findings from the same probe, in a study with two timelines where the second
one is optional (`min_coverage: 0`):

1. **The second timeline claimed to be done while it was empty.** `min_coverage: 0`
   is satisfied by an empty timeline, so `updateTimelineCoverageIndicators()` took
   the "met" branch and rendered `✓` next to a timeline nobody had touched - the
   probe read the label as `Nebenaktivität✓`. For a track a participant is meant
   to *notice and use*, a green ✓ means "skip it". The timeline menu
   (`buildTimelineMenu`) had the same vacuous ✓ in its detail line.
2. **Nothing on a phone said the second timeline existed.** Only the active
   timeline is laid out below the breakpoint (every other container measures 0×0),
   so the page showed one timeline, and a participant who never opened the context
   bar's timeline picker never learned about the other one.

Fix, from one rule - a ✓ is earned by a met requirement, never by the absence of
one:

- `getTimelineCoverageText(timelineKey)` in `ui.js` is the single formatter: met
  requirement → `✓` (green, `is-met`); required and short → the red "N von M …"
  (`is-missing`); no requirement and no entries → "nothing entered yet"
  (`is-empty`, grey, no verdict). Used by the title indicator *and* the timeline
  menu, so the two cannot drift apart.
- `updateEmptyTimelineHints()` renders one row per other timeline that is empty on
  the current day, inside the active timeline's label block below the description,
  phone-only: `Nebenaktivität · noch nichts eingetragen ›`. Tapping it calls
  `navigateToTimelineByKey()` - the same path the picker uses. ~44 px tap target
  with a dashed outline (an offer, not another toolbar control), and it is gone as
  soon as that timeline has an entry for the day. Called from
  `updateButtonStates()`, the same chokepoint as the indicator, because the same
  events change both.

Deliberately not built (discussed; the cheaper options won): no vertical lane for
the second timeline, no horizontal swipe, no side-by-side stacked columns - each
costs day height or competes with editing - and no second full copy of the
timeline. The "(1/2)" counter that came out of the same discussion is in as well:
`getTimelineLabel()` (script.js) is used by the container title, the phone context
bar, the timeline menu and the desktop switch button, mirroring the phone day
counter's `(3/7)` - and single-timeline studies keep the bare name.

Guarded by `mobile_timeline_visibility.spec.js`: the neutral state of an empty
optional timeline and the ✓ once it has an entry, the row appearing, vanishing and
switching on a *real touch* tap, the position counter on both widths, and the
desktop case (two indicators and two titles, no rows).
`mobile_context_bar.spec.js` had encoded the old ✓ for the timeline menu and the
bare timeline names.

## Done — a short entry, and help in reach (2026-10-12)

Participant/reviewer feedback asked for the entry to be reduced ("Es wird vieles
erklärt, was selbsterklärend sein sollte") and for the basics to be offered as an
optional help button instead. Measuring the page first turned the claim into a
different, harder problem:

| (iPhone 13, German, default study) | before | after |
| --- | --- | --- |
| page height | 4779 px = **7.2 screens** | 1524 px = **2.3 screens** |
| generic walk-through | y 1063–4393 = **5 screens** | one 48 px summary row |
| Start button | y **4623**, last element (`.navigation` is `static`) | y 605, **inside the first screen** |

The walk-through was not merely verbose, it was an entry *gate*: the only way
into the study was to scroll past it. The study's own text (`study_text_intro`,
`study_text_instructions`) sits above it and was never the problem - that text is
the study's protocol, so it stays where it is.

Therefore: don't delete, don't hide behind a page switch.

- The walk-through is a closed `<details class="how-to">` (`.instruction-card`)
  with a 48 px summary row; the steps and their GIFs load on demand. The page
  keeps every word it had, so nothing about what participants *can* read
  changed.
- The Start nav is `position: fixed` **on phones only** (`max-width: 1439.98px`,
  with matching `body` padding): with the walk-through expanded the page is long
  again, and Start used to be 4000 px away. On desktop the collapsed page is
  ~1 screen, so a full-width bar would be noise (`instructions_entry.spec.js`
  asserts both).
- Not a per-study switch. A flag would change *what participants were told*,
  which is a study condition (and a protocol decision mid-pilot), not styling.
  If it should become one, `study_show_visual_guide` is the place.

Help while working is the other half of the request, and it is a **modal, not a
navigation**: the ⋮ menu entry "How to use the diary" loads the instructions page
in `?embed=1` mode into an iframe (`.help-modal-frame`) - same steps, GIFs and
translations, no study text, no language pill, no Start button. One source of
truth instead of a second copy of four animated GIFs. In embed mode the page also
skips its study-config redirects and the language pill (a dead config must not
navigate the iframe), and opens the `<details>`. `openHelpModal()` arms the shared
modal focus manager by itself, because Escape/focus-trap used to depend on the
activity picker having been opened once (`createModal()` armed it).

Guarded by `instructions_entry.spec.js` (short entry, steps restored, pinned nav,
desktop unchanged) and `help_modal.spec.js` (embed contract, modal opening,
day still intact afterwards, Escape, desktop).

Desktop bottom, fixed after a look at the rendered page (nothing failed): the
Start row was a 101 px opaque-white slab with an upward shadow, sitting 69 px
below the last line of text and above the footer links, with the button hugging
the far right of the 1100 px column - it read as a stray toolbar bolted onto the
page. The "please click the blue Start button" line above it (`instructions.
startPrompt`, removed from all 7 locales) explained a button that sits directly
below the sentence. Desktop now gets a hairline across the content column with
the primary action on the right; the phone keeps the pinned bar, where it earns
its place.

Same pass, from a second look at a big window: the Start button rendered as a
**square**. The page body is a grid with `grid-auto-rows: auto`, whose default
`align-content` is `stretch` - so on a window taller than the page the rows grew
to fill it (measured: 163 px and 196 px for the Start row at 1920x1200 and
1600x1300, footer row 140 px) and the button, a flex item with the default
`align-items: stretch`, grew with the row (140x131 at 1600x1300, 140x98 at
1920x1200). Fixed with `align-content: start` on `body` plus `align-items:
center` on `.navigation`; measured after: 140x56 at every size (900/1200/1300 px
tall windows, and the phone's fixed bar unchanged). Guarded by the "on a tall
window" case in `instructions_entry.spec.js`. Note this was pre-existing CSS -
the white slab just hid it.

## Done — the day scrolls back, and to its very end (2026-10-12)

Reported from a Pixel 10 Pro: "on timeline data entry page, when I do nothing but
scroll down (to 4 am at end of timeline) I cannot scroll up again. Swiping with
finger does nothing anymore. I'm stuck! Also the line for 4 am is offscreen, I
can only view till ~3:55."

Both were real, and neither was visible to the suite, because **the mobile
specs drive the phone layout with the mouse** - and a mouse never goes through
`touch-action`, touch listeners or the browser's gesture arbitration.

Finding the first one needed real touch input (`Input.dispatchTouchEvent` over
CDP, Chromium only; `mobile_block_scroll.spec.js` had the only precedent).
Reproduced at 412x915: the day reached `scrollTop 1684` (= its end) and every
further swipe moved it 0 px - in *both* directions. Patching `scrollTop`'s
setter, `scrollTo`/`scrollBy` and `scrollIntoView` recorded **zero** programmatic
writes, and `Input.dispatchMouseEvent` with `deltaY: -600` scrolled fine (1684 →
1084), so the scroller was healthy and the *gesture* was being eaten. Patching
`Event.prototype.preventDefault` named the culprit in one run:

```
at document.addEventListener.passive (report/js/ui.js:2636)
```

`preventPullToRefresh()`'s fallback:

```js
document.addEventListener('touchmove', (e) => {
  if (window.pageYOffset === 0 && touchYDelta > 0) e.preventDefault();
}, { passive: false });
```

On the diary the **window never scrolls** - the day scrolls inside
`.timelines-wrapper` - so `pageYOffset === 0` is permanently true and *every
downward finger drag* is cancelled. Finger-up drags were never touched, which is
why the day could be swiped forward to its end and not back: the bug only shows
up at the far end, where the way out is a downward drag. Pre-existing, not from
this session's work.

Fix: the document-level fallback is gone entirely; pull-to-refresh is stopped by
`overscroll-behavior: none`, which every engine we support honours, now set on
the root element *and* the body (Safari reads the body's). That also removes a
non-passive `touchmove` listener that ran on every gesture pixel.

The second symptom is geometry. The day's markers are 25 hour lines at 100 px
spacing (`default` study: 04:00 → 04:00 next day, labels only up to 03:00), and
the content ended exactly at the scroller's edge - measured at max scroll:

| | before | after |
| --- | --- | --- |
| `scrollHeight` | 2500 | 2520 |
| day's last hour line vs. the scroller's bottom edge | **0 px** (on the edge) | **-20 px** (inside) |

so the final line could not be brought into view at all, and the day looked like
it stopped "~3:55". `.last-initialized-timeline-wrapper` now keeps `padding: 0 0
20px`; content-box, so the timeline keeps its 2500 px and the hour spacing is
untouched (verified: marker gaps stay 99–100 px).

`mobile_day_scroll.spec.js` pins down: with real touch (Chromium/CDP) the day
walks to its end **and back**, repeatably; the last hour line and label come
fully into view at maximum scroll; `overscroll-behavior` is `none` on root and
body. The touch case fails on the old code with "a downward swipe has to bring
the day back, not be cancelled" - checked by temporarily restoring the handler,
not just by reasoning.

### Correction (2026-10-13): the 20 px tail was there but off screen

Reported from a Pixel right after the above: "still ends flush with the 4am
time. 0 pixels of whitespace... looks a bit cut off." The tail was in place -
and invisible, because the whole scroller sat 20 px too low:

| measured at 412x915 | before | after |
| --- | --- | --- |
| `.timelines-wrapper` bottom vs. the viewport | **935 px in a 915 px viewport** | 915 px |
| day's last hour line vs. the bottom of the screen | **915.4 px = flush/cut** | 895 px = 20 px clear |
| `lastMarkerVisible` | `false` | `true` |

Cause: `.timeline-canvas` had `margin: 20px 0` on top of a height already
computed as `100vh` minus header and footer - so the box, and the scroller in it,
started 20 px lower and ended 20 px past the screen, and the tail was exactly the
part hanging off. Fixed by removing that margin on phones (the breathing room
under the header is `padding-top` *inside* the canvas now, where it costs
nothing), letting the scroller fill the canvas (`height: 100%`), and sizing the
canvas with `100svh` (falling back to `100vh`): `vh` is the viewport with the
browser chrome hidden, and since the page itself never scrolls the URL bar stays
visible on Android - the day's end could hide behind it.

Lesson, twice in one week: measuring the element's *internal* geometry ("the
padding is there, 20 px") says nothing about whether that geometry is *on
screen*. Measure against the viewport and the surrounding chrome too - the first
version of this section reported success with a number that was true and
irrelevant. `mobile_day_scroll.spec.js` now also asserts that the day's scroller
ends within the viewport, not only that the line is inside the scroller.

### Ripple: the guard was holding a block bug together

Removing the guard broke `mobile_block_scroll.spec.js` (deterministically, 3 of
3 runs), so the old handler was doing a second job nobody had noticed: its
`preventDefault()` on downward drags was what kept a resize alive. A drag on a
block's end makes the browser start a scroll and fire `pointercancel`, which
kills interact.js' resize - unless the element under the finger refuses to be
scrolled, which is exactly what `touch-action: none` on
`.activity-block-edge-zone` is for. Bisect: reverting the CSS alone still failed,
reverting the `touchmove` guard alone passed - so the guard was the protection
and the CSS was decoration.

Cause, measured live on a phone viewport with a 10-minute block (17 px tall):

| | before | after |
| --- | --- | --- |
| `.activity-block-edge-zone` computed `display` | **`none`**, height **0** | `block`, height 5 px |
| share of a 17 px block left scrollable | 100 % (of nothing) | 40 % |
| resize drag from the bottom band | works only via the touchmove guard | works via `touch-action: none` |

The base rule `.activity-block-edge-zone { display: none }` sits *after* the
mobile override and has the same specificity, so it won. Same bug class as the
width-gated popup rule (§ "Facts worth not re-deriving"): base styling must come
before the width-specific override, never after. The old spec could not see it -
`getComputedStyle(hiddenEl).touchAction` is `'none'` and `zoneHeight` was only
used in a `>` guard, so two vacuous assertions passed for a year's worth of runs.

Second half of the same ripple: with the bands live, `min(16px, 40%)` covered all
but 3 px of a 17 px block, so the block stopped scrolling - the participant
complaint from the earlier slice, back for a second round. Capped at
`min(16px, 30%)` the middle is never smaller than 40 % of the block. The spec now
asserts `zoneHeight > 0` and that the resize drag lands on a band, so "declared
but not rendered" and "rendered too large to scroll past" both fail loudly.

## Done — phone blocks keep their distance from the edge (2026-10-13)

Reported: "activities on mobile are aligned on right with screen border, which at
first impression looks almost cut off." Two things, measured at 390 px width:

| | before | after |
| --- | --- | --- |
| block (`.activity-block`, mobile) | 75 % wide from left 25 % -> its right edge = the timeline's right edge | 70 % wide, ends 5 % (19 px) short of it |
| time chip (`.time-label`, mobile) | `right: -50px`: a 48 px box starting *at* the block's right edge | `right: 4px`: inside the block, 6 px from its right edge |
| chip pixels on screen | **~1 px** | all 48 px |

The chip was the bigger half of the impression: a black chip clipped to a sliver
at the screen edge reads as "cut off" far more than a block ending flush. The
numbers live in `createActivityBlock` (`MOBILE_BLOCK_WIDTH`, `MOBILE_OFFSET`) and
in the mobile `@media` block for `.time-label`; desktop is untouched, where time
is the horizontal axis and a block's width is its duration. Guarded by
`mobile_layout.spec.js > an activity block and its time chip keep clear of the
screen edge` (gap share, chip inside the block, chip on screen).

Edge case deliberately left alone: an activity name long enough to fill the text
container (90 % of the block) can run under the chip's left third. It is already
ellipsised there, and moving the text left instead would de-centre every short
name.

## Done — the instruction banner lasts until it is closed (2026-10-13)

Reported: "that blue instruction banner, it only shows on first day of study,
which is irritating. we should show it on all days, UNTIL user first closes it."

One early return caused it, in `initInstructionBanner()`:

```js
if (getCurrentDayIndex() !== 0) { banner.remove(); return; }
```

The gate was checked **once, while the page initialised**, and the day it asks
about is the day the page was opened on (`getCurrentDayIndex()` reads
`day_label_index` from the URL, which every day switch rewrites). It therefore
did the opposite of what it looked like: a participant sitting on day 1 was
never affected, while the one who came back on day 3 - the one who needs the
reminder - got the page without any instructions. Removed; the banner is now
shown on every day until it is closed.

What deliberately stays: the dismissal, per participant and study, stored under
the **unchanged** key `instructionBannerClosed:<study>:<pid>:day1`. The `:day1`
suffix is history (the flag was never per-day - it is per participant), and
renaming it would resurrect the banner for everyone who had already closed it on
a running pilot. The key string therefore gets a comment instead of a rename.

The two i18n keys do get renamed, because they had started to lie: the text
never mentioned a day, only the key name did.

- `banner.dayOneInstructionsMobile` / `...Desktop` → `banner.instructionsMobile`
  / `banner.instructionsDesktop` (both `<span>`s in `index.html`, all 7 locales,
  and the required-keys list in `locales_consistency.test.js`; the earlier §7
  entry and the i18n memory note quote the old names).
- `mobile_layout.spec.js`: the existing banner test drops "day-one" from its name,
  and a new one pins the contract - `the instruction banner stays on every day
  until it is closed`. It **loads straight into the second day**
  (`day_label_index=1`) rather than switching there, because a switch inside a
  running page never hits the init path; the premise is asserted too (the URL
  still says day 1), so the test cannot pass while the entry flow rewrote the day
  back to the first. Then: switch to another day (still there), close it (gone),
  switch to a third day (still gone), reload (gone from the DOM, not just hidden).

The banner is inserted while the page settles, so specs that measure geometry
must still dismiss it first (see the gotcha in the touch-action notes above).

## Done — the phone switcher shows both timelines (2026-10-13)

Reported: testers "missed the existence of the 2nd timeline entirely", and the
mitigation (the timeline name plus its `(1/2)` position in the switcher label,
the empty-timeline hint row) did not settle it.

The mechanism, once stated: a button labelled with **the timeline you are already
in** reads as a status readout. The only question it appears to ask is "which
timeline am I on?", and its own label answers that - so there is no reason to
press it, and the second timeline stays a parenthetical inside a control nobody
opens. (Desktop does not have this problem: its `#switchTimelineBtn` is labelled
with the *destination* timeline.) A segmented control asks the other question -
"which of these two tracks is this day's?" - and answers "there is another one"
before any interaction.

Shape was decided by the row budget, measured at 390 px in the `default` study:

| | px |
| --- | --- |
| context row (total) | 382 (32 px high) |
| day control (`‹ Mittwoch (3/7) ▾ ›` incl. both arrows) | ~190 |
| timeline picker button (`Hauptaktivität (1/2)`) | 158 |
| two segments, plain names (de) | ~300 |
| caret for the sheet | ~30 |

Day control + tabs would be ~490 px in a 382 px row, so the strip takes a row of
its own (`flex: 1 1 100%` on `.timeline-switcher.has-tabs`): header 99 → ~135 px,
still far below the 235 px §4 replaced. This is the row the user accepted paying
for ("maybe a bit vertical for the bar where you switch").

What shipped (`ui.js`, `styles.css`):

- `#timelineSwitcher` > `#timelineTabs` (`role="tablist"`, `aria-label` =
  `buttons.switchTimeline`, no new keys) + the existing picker button.
- Tabs are rendered **only when the study has exactly two timelines**, named with
  the plain timeline names - `getTimelineLabel()`'s "(1/2)" has nothing left to
  say once both names are on screen (it stays in the canvas title and the sheet).
  One timeline has nothing to switch to (the control hides, as before); three or
  more would run off the row, so those keep the picker. The rule is
  `shouldShowTimelineTabs()` in `constants.js`, pinned by
  `tests/unit/timeline_tabs.test.js`: no study here has anything but two
  timelines, and a stubbed activities config **cannot** stand in for it - a
  timeline set that disagrees with the study config does not bring the diary up
  at all (tried with one and with three; `activeTimeline` never arrives).
  Trap found on the way: a route glob is matched against the full URL including
  the query, so the activities-config stub needs `**/activities-config*` (the
  real request carries `?participant_id=…&lang=…`).
- Switching is `navigateToTimelineByKey(key)` - the same call the sheet's rows
  make - so no new code path. Roving tabindex, `aria-selected`, Left/Right
  arrows; the strip is rebuilt only when the key set changes, so focus survives.
- The picker loses the name (it would only repeat a tab), keeps its caret and
  stays the way into the timeline sheet, which still carries the per-timeline
  coverage and "Clear timeline" - that is why it is not simply deleted.
- `hidden` needs an author rule on anything with a `display` of its own
  (`.timeline-tabs[hidden] { display: none !important }`), the same trap
  documented for `.btn[hidden]`.

Guards, `mobile_context_bar.spec.js`: the two names and `aria-selected`, the
rendered geometry (`boundingBox`, because a hidden element still passes
computed-style checks), the strip sitting below the day control, the switch
reaching `timelineManager.keys`/`activeTimeline`, and the German names rendering
in full (`scrollWidth - clientWidth`, since a clipped tab is still "visible").
The other branches of the rule are unit-tested (above). The generic
no-sideways-scrolling sweep covers the German diary page as well.

Deliberately **not** fixed here, both for the scientists:

- The rule for *when* the second timeline applies ("Zeitfenster, in denen Sie
  gleichzeitig eine andere Aktivität … ausgeführt haben") is each timeline's own
  `description`, rendered inside that timeline's canvas - so it is unreadable
  until you have already switched. Making the names visible does not surface it.
- The adult studies' `study_text_*` never mention a second timeline at all (only
  the 15-year-olds study does). With `min_coverage: 0` on the secondary, whether
  participants are *expected* to use it is a study-framing decision, not a UI
  one - and a permanently visible empty second tab does create the opposite
  pressure, so the study text has to say what the tab means.

The empty-timeline hint row is kept (it is now largely redundant). Removing it
would be a separate, deliberate change.

## Deferred — phone affordances from participant feedback (2026-10-12)

The feedback asked for (a) a visible marker that a block's edges can be dragged,
and (b) a way to move a whole block. Desktop got (a) in this slice:
`.activity-block-grip` spans in `createActivityBlock()`, shown on hover,
keyboard focus and while resizing (`desktop_resize_affordance.spec.js`). Open for
phones:

- (a) phone: **done 2026-10-13** - the grips are shown on the block's top and
  bottom edge (the ends that can be dragged in the vertical layout), as thin
  horizontal bars flush in the resize band. No markup change: the two spans
  desktop uses are re-used, and the mobile rules live AFTER the base
  `display: none` (same specificity - putting them before would hide them again,
  the trap that once hid the resize bands). No hover on touch, so they are
  visible at 0.7 opacity and full while focused/resizing. Asserted in
  `mobile_block_scroll.spec.js`.
- (b) phone: **done 2026-10-13** - "Move earlier" / "Move later" in the
  long-press menu, 10-minute steps, duration preserved, clamped to the day and
  refused (block flash, like the arrow keys) when another activity is in the
  way. This note said "long-press already opens the context menu, so
  long-press-then-drag has to be designed against that gesture" - the answer is
  that there is no drag at all: the menu owns the gesture, so the move became an
  action. Menu is mobile-only; desktop drags. Covered by
  `mobile_activity_gestures.spec.js` (step, duration, `timelineManager` state,
  04:00 as the boundary) and by the desktop menu staying move-free in
  `activity_context_menu_desktop.spec.js`.
- (b) desktop: it already works (`drag_move_activity_block.spec.js`) but is never
  mentioned in the instructions or the day-one banner ("Drag its edges to extend
  it"), which is why it was reported as missing. Deliberately left unchanged.

## Known gaps, deliberately not asserted

- Footer/legal links and the two language `<select>`s are 16–19 px high on a
  phone, below the 24×24 WCAG 2.2 SC 2.5.8 minimum. Reachable, but small for a
  thumb; `mobile_layout.spec.js` documents this rather than failing on it.
- `accessibility.spec.js` cannot run locally without `@axe-core/playwright` (CI
  does run it).

## Running things locally

```sh
./run_dev_nginx_both.bash            # nginx :3000 + backend :8000 (keep it running)
# diary: http://localhost:3000/report/index.html?study_name=default&lang=en

sh test_frontend_typecheck.sh
sh test_frontend_unit.sh
cd frontend && npx playwright test --project=chromium tests/e2e/<spec>.spec.js
```
