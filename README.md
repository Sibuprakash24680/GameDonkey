# Donkeyyy — Step 1: The Dealing

A card-table web game for **2–10 players**, built as a single self-contained file.
The mark of the table is a **hand-built SVG donkey** — sage badge, gold-gradient coat, cream muzzle, ink mane —
used as the favicon, the lobby brand, the topbar chip and the emblem on every card back. It was designed
geometry-first: the shapes were drawn and visually verified as PNGs (`branding/badge512.png`,
`branding/sizes.png` down to 22 px), then emitted to SVG from the *same numbers*, so the shipped markup and
the verified render cannot drift apart. Regenerate with `python3 branding/emit.py && python3 branding/favgen.py`.
**Step 1 (the dealing phase) is fully playable.** Step 2 plugs into the same table.

```
maut-ka-nanga-naach/
├── index.html      ← the whole game: markup, styling, engine, UI (no build step, no CDN, no deps)
├── server.js       ← zero-dependency static server (`npm start`) — also the future WebSocket host
├── branding/       ← the donkey: geometry-first generator (donkey.py), verified renders (badge512.png,
│                     sizes.png), emitted SVG sprite + favicon (emit.py, favgen.py)
├── test/dom-test.js← headless integration tests (jsdom)
└── package.json
```

## Run it

**Option A — double-click `index.html`.** That's it. No server, no install, works offline.

**Option B — serve it** (needed later for online play):

```bash
npm start          # → http://localhost:3000
```

**Tests:**

```bash
npm i --no-save jsdom
npm test             # 105 assertions across 10 scenarios (DOM + full games + a 2-window online game)
npm run test:engine  # 78 assertions, pure engine, no DOM
```

---

## The rules this build enforces

| # | Rule |
|---|---|
| 1 | **52 cards**, no jokers, shuffled **face-down in the middle** of the table. |
| 2 | **Random starter**, then **clockwise**. Each player picks the **top card** and puts it **on top of their own stack**. |
| 3 | Only the **top card of each stack is public**. Everything underneath is hidden. The middle pile stays hidden. |
| 4 | After every pick an **exchange window** opens. |
| 5 | In the window you may give your **top card** to a player whose **top card is exactly one rank lower**. **Suit is ignored.** No wrap (so `A→K` is legal, `2→A` is not, a `2` can never be given away and nothing can be given to a `2`). |
| 6 | A give is a **permanent transfer** and lands **on top** of the receiver's stack — their public card changes, so **chains** happen (`Q♥` holder receives `K♠`, then an `A♣` can be given to that new `K♠`). |
| 7 | Giving is **voluntary and unlimited** inside the window. |
| 8 | The window closes **only when every player still holding cards has passed**. A give clears all passes and re-opens the round. Then the next player picks. |
| 9 | The dealing ends when the **middle pile is empty** and the final window closes. Everyone keeps their stack → **Step 2**. |
| 10 | **Loop guard:** a give that would return the table to a position this window has *already seen* is refused ("no take-backs"). Without it, `K♠` can bounce A→B→A→B forever — every give clears the pass list, so the window never closes and the game soft-locks. Chains, stacking onto a received card and passing it on to a **new** seat are all still legal, because they create fresh positions. A 60-give-per-window ceiling is the insurance net behind that. |

Rank order used: `2 3 4 5 6 7 8 9 10 J Q K A` (A high).

### The loop you will hit without rule 10

```
Asha [Q♥, K♠]   Bilal [Q♣]          Asha gives K♠ -> Bilal
Asha [Q♥]       Bilal [Q♣, K♠]      Bilal gives K♠ -> Asha   (Asha's revealed top is Q♥, so it is legal!)
Asha [Q♥, K♠]   Bilal [Q♣]          ...identical to the start. Forever.
```

Every give clears the pass list, so the window can never close: 100,000 gives later the table is still
in the same exchange window with the same single card bouncing. The guard refuses the second give
(`reason: takeback`), the seat simply stops being offered as a target, the log records the refusal,
and two passes close the window normally. Verified by engine sections 9–11 and DOM TEST 9:
longest game went from **unbounded** to **~2,300 actions** even when every player gives 100% of the time.

### Controls

| Key / gesture | Action |
|---|---|
| `Space` | Smart primary action (pick, reveal the curtain, give to the only legal target, or pass) |
| `G` | Arm a give, then click a glowing seat |
| `P` | Pass the exchange window |
| **Drag** your top card onto a glowing seat | Give it |
| Click the middle pile | Pick (when it's your pick) |
| `L` / `H` / `M` | Table log / rules / mute |

### Table settings

- **Privacy curtain** — between turns the screen asks “pass the device to …” and keeps hidden cards covered. On by default; this is what makes hot-seat honest.
- **Auto-pass dead seats** — if your top card has no legal receiver you have no decision to make, so the table passes for you (logged as *“passed · nothing to give”*). Without this, a 10-player table needs ~10 taps per pick.
- **Table speed** — Chill / Normal / Fast: robot thinking time and card-flight duration.
- **Sound** — a tiny WebAudio synth (card snaps, give chimes). No audio files.
- **Table seed** — shown as a short code; the same seed + the same moves reproduce the identical table.

---

## Architecture (why online play is a drop-in)

The engine is **pure and event-sourced**, entirely separate from the DOM:

```js
state = MK.create({ seed, players, settings })   // deterministic: seeded shuffle + random starter
state = MK.reduce(state, action)                 // action = PICK | GIVE | PASS
MK.actor(state)                                  // whose move, and what kind
MK.legalTargets(state, seat)                     // rule enforcement lives here, once
```

- **Bounded by construction.** The loop guard + give ceiling mean a table can never soft-lock; see rule 10.
- **No RNG after the deal.** Only `create()` uses the seeded PRNG, so a state is fully rebuilt from `{seed + action log}`. Verified by TEST 3, which replays a finished game move-by-move and byte-compares the stacks.
- **`index.html` never trusts the client.** Every give is re-validated against `legalTargets`; out-of-turn, self, illegal-rank and out-of-range moves are silently rejected (TEST 6).
- **The in-game “Watch the replay”** is the same code path an online server would use to resync a reconnecting player.

### Wiring online multiplayer (the agreed next step after Step 2)

`server.js` is already the host. Adding `ws` gives:

1. `create room → 5-letter code`, host seeds the table, `seed` + roster broadcast to clients.
2. Clients send **actions only**; the server runs `MK.reduce` on the authoritative state and broadcasts the new state (or the action + a hash).
3. Reconnect = re-send `{seed, actionLog}` → client rebuilds the exact table.
4. **Per-client visibility** becomes real: the server sends each client their own full stack plus everyone else's *public top card only* — the exact split the local curtain currently simulates.
5. `MK.botDecide` runs server-side to fill empty seats with robots.

No engine line changes for any of it.

---

## Design system

Palette, used throughout (everything else is a derived tint/shade of these four):

| Token | Hex | Use |
|---|---|---|
| `--sage` | `#8FA28A` | felt, primary surfaces |
| `--pale` | `#C7D3C0` | secondary surfaces, highlights |
| `--cream` | `#F7F4ED` | page + panel background |
| `--gold` | `#C8A96B` | accent: active turn, legal targets, CTAs |

Ink (`#2E382C`) is the dark end of the sage; card faces are `#FFFDF7`; **♥/♦ are rendered in deep gold** (`#A5813C`) instead of red so the whole table stays inside the palette. Cards, the card-back lattice, the table felt grain and the logo are all pure CSS/inline SVG — nothing is fetched at runtime.

Interactions: card flight from the pile to a seat (Web Animations API), gold pulse on legal receivers, sparkle burst on a completed give, shake + explanatory toast on an illegal give, live table log, stack-depth layering behind each public card, and a full animated replay of the deal.

---

## Test coverage

`npm test` — 10 scenarios, 105 assertions (jsdom drives the real DOM, real clicks, real timers):

1. **Boot & lobby** — globals, 4 default seats, seeded label, demo cards, grows to 10, blocked below 2.
2. **Full game** (1 human + 3 robots, curtain off) — 52 picks, pile empty, all 52 cards in stacks, results modal, trophy, counters, log.
3. **Replay** — re-dealing from the seed reproduces the final table exactly, then restores it on exit.
4. **Deal again / leave table** — roster preserved.
5. **2 humans, curtain on, auto-pass off** — every pass manual, curtain used repeatedly, 52 cards conserved.
6. **Hostile input** — self-give, seat 99, seat −3, unknown actions, pass during a pick phase: all refused, table intact.
7. **Peek chips** — present with the curtain off, absent with it on.
8. **The default table** (2 humans + 2 robots, curtain on, auto-pass on) — full 52-pick game to the results screen.
9. **The ping-pong loop** — rebuilds the exact soft-lock position through the real UI, asserts the rewind target is never offered, a forced give-back is refused with a toast + log entry + unchanged table, and the window still closes.
10. **Online P2P** — two real browser windows wired together through an in-memory WebRTC broker: room create/join by code, seat assignment + naming, hands stripped to public tops on the wire (verified mid-game), a full game played across the connection with host and client agreeing card-for-card, out-of-turn/impersonation cheats dropped by the host, results + action log on both, re-deal sync, and mid-game disconnect → robot takeover.

`npm run test:engine` — 78 assertions on the pure engine (sections 9–11 are the loop guard): rank legality, permanence, on-top landing, chains, turn discipline, window reset/closing, pile exhaustion, seed determinism, a 400-game randomised soak (2–10 players) and an 80-game all-robot soak (~90k decisions, zero illegal moves).

## Deploy & play with friends (GitHub Pages, zero servers)

**Deploy**

1. Make a GitHub repo and push this folder (only `index.html` is required to run).
2. Repo → **Settings → Pages** → *Build and deployment* → Source: **Deploy from a branch** → branch `main`, folder **/(root)** → Save.
3. Open `https://<your-user>.github.io/<repo>/` — that URL is the thing you share.

**Play together**

1. One player is the **host**: *Play mode → Online → Create a room*. A 5-letter code and an invite link appear.
2. **Copy invite link** and send it (WhatsApp, Discord, wherever). The link carries `?room=CODE`, so friends land on the join screen with the code already filled in — they type a name and hit **Join**.
3. The host watches the seat list fill up. Any *open human seat* nobody claimed becomes a **robot** when the deal starts (or flip seats to Robot in the lobby beforehand).
4. Host presses **Deal to the room**. Everyone's phone becomes their own private screen: your hidden cards never leave the host's process except as *your* view; other players only ever receive your public top card and your card count.
5. Play normally — glowing seats, drag-to-give, passes, the loop guard, results, replay (the host ships the action log with the final state so every phone can replay the deal).

**How the online layer works**

- **Peer-to-peer WebRTC** through the free public PeerJS broker. Signalling only — the cards themselves travel directly between browsers. Nothing of yours to host or pay for.
- **Host-authoritative.** The host runs this exact `MK` reducer for the whole room; clients send *actions*, never state. Every action is re-validated (turn, prompt, rank rule, loop guard), so a patched client cannot cheat — TEST 10 sends impersonation/out-of-turn/garbage messages and asserts the table ignores them.
- **Privacy is enforced by the engine**, not the UI: `MK.view(state, seat)` strips every foreign stack to its public top card (true counts preserved) before it goes on the wire; the full reveal only happens at `phase: complete`.
- **Resilience:** a dropped player's seat is taken over by a robot mid-game so the table survives; a returning player reclaims their seat via the `?room=` link + a session token; the host re-dealing pulls every client back to the table automatically.

**Known limits (by design of P2P)**

- The **host's tab must stay open** — it is the referee. If the host leaves, the room ends.
- Signalling needs internet; a handful of strict-NAT / corporate networks block peer connections (the join screen says so plainly). If your group hits that often, the next step is the `server.js` WebSocket route.
- In the offline sandboxed preview the Online button explains that the WebRTC library can't load; **Local play always works with no network at all**.

## Next

**Step 2 — Donkeyyy.** Send the rules and the play phase drops onto these stacks (they're already ranked, counted and analysed in the results screen: cards held, public top card, longest descending run, picked/gave/got).
