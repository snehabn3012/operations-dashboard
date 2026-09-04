# Self-Review

This is not production-ready, and nothing below should be read as a case that it is. This is a scoped prototype built against a specific brief (see `DESIGN.md`), and several of its known limitations are exactly what that brief asked for (no real backend, no database, no auth). Those are documented in `DESIGN.md` section 13 as deliberate, accepted trade-offs — I'm not re-litigating them here.

What follows is different: the three things that, reviewing this as if it were someone else's PR, I would actually block on before treating it as more than a demo — either because they're misleading rather than merely incomplete, or because they undermine a capability the branch itself claims to provide.

---

## 1. "Saved ✓" claims a durability the app doesn't have

**Severity:** High

**Why it matters:** The `/configure` page's save flow shows the exact same success confirmation ("Saved ✓") whether or not the data is actually safe. A user has no way to tell, from the UI, that what just happened is fundamentally different from what "Save" means in almost every other application they've ever used.

**Current limitation:** `data/mockApi.ts`'s `configStore` is a plain in-memory `Map`, and because `fakeBaseQuery` runs the entire mock API client-side, that store lives in one browser tab's JavaScript heap — not even in this app's (nonexistent) backend. Refreshing the page, closing the tab, or the tab crashing loses every saved configuration permanently, silently, with zero warning anywhere in the UI. "Saved ✓" is shown regardless. Someone configuring a dashboard for their team has no signal that their work is one refresh away from gone.

**Recommended improvement:** At minimum, the save confirmation should say something honest about scope — e.g. "Saved to this session" rather than a bare "Saved ✓" — so the UI isn't actively asserting a guarantee it can't back up. The real fix is standing up actual persistence (the seam for this already exists — see `DESIGN.md` section 2's "backend replaces the mock API" row, and section 14 — swapping `fakeBaseQuery` for `fetchBaseQuery` against a real endpoint is the designed path), but even before that, the UI shouldn't claim more than is true.

---

## 2. The optimistic-concurrency conflict check cannot fire in the app as deployed

**Severity:** Medium-High

**Why it matters:** This branch's "no concurrent-edit handling" review finding was directly addressed with a revision-based conflict check (`updateDashboardConfig` in `data/mockApi.ts`, the conflict banner in `ConfigurationPanel.tsx`), and it's genuinely correct — proven with dedicated unit tests (`data/mockApi.test.ts`). The problem is what happens the moment it leaves a test file: it currently protects nobody, because there's no scenario in the running app where it can be triggered. That's a worse state than not having the feature, because the code and its passing tests create the appearance that "two people editing the same dashboard" is a solved problem here, when in the actual product it isn't addressed at all yet.

**Current limitation:** `configStore` is per-browser-tab (see finding 1) — two tabs, two users, two devices all get entirely independent copies of "the server," with nothing (no `localStorage`, no `BroadcastChannel`, no real backend) synchronizing them. Two people can never actually collide, so the conflict check has no path to ever run outside a test. This is documented honestly in `DESIGN.md` section 9 and 13, but documentation isn't a substitute for the feature working — a reviewer who didn't read that section would reasonably believe this risk is mitigated.

**Recommended improvement:** Either back `configStore` with `localStorage` + a `storage` event listener so the conflict flow is at least demonstrable across tabs in one browser (a real fix would need a real backend, which is out of this prototype's brief), or, short of that, this should be labeled in-product or in the PR description as "implemented, not yet reachable" rather than presented as a closed gap.

---

## 3. Role is a self-service dropdown with no access control behind it

**Severity:** High (for anything beyond a demo)

**Why it matters:** Every role-based visibility rule in this app (`ROLE_MODULE_IDS` in `config/dashboardConfig.ts`) is enforced entirely in the client, entirely for presentation. Any user can select "Admin" from the header dropdown and see every module for every role, with nothing checking whether they're entitled to. For a demo of configuration-driven rendering, that's fine — it's explicitly what the brief asked for. But it means "role-based visibility" as it exists in this branch is a UI convenience, not a permissions system, and if this were mistaken for one, that's the kind of gap that matters.

**Current limitation:** There is no authentication, no session, no server-side (or any) check that the "role" a browser tab claims to be viewing as is one that browser is actually authorized for. `Header.tsx`'s `<select>` is the entire access-control model.

**Recommended improvement:** Not something to bolt onto this prototype — it needs a real backend and real auth first (see finding 1), at which point role needs to come from an authenticated session rather than a free-standing dropdown, and every config read/write needs a server-side check that the requesting user is actually permitted to act as the role they're claiming.

---

## Update

A follow-up adversarial review (see the repository's PR review history) went further than this self-review did and found two things it missed: a real, empirically-reproduced silent-data-loss race (editing while a save is in flight could get silently discarded) and a hardcoded `if (role === "customer")` branch in `config/dashboardConfig.ts` that violated this project's own core "no role-specific code" principle. Both have since been fixed — see `DESIGN.md` sections 2 and 9 — and finding 1 above (the "Saved ✓" copy) was also addressed there (honest "Saved to this session ✓" wording), though the underlying lack of durable persistence is unchanged and out of scope for this prototype, as intended. Finding 3 above (no access control) remains unaddressed and out of scope for the same reason. This update is appended rather than edited into the findings above so the original review stays an honest record of what was and wasn't caught at the time.
