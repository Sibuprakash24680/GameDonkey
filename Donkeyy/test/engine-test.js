/* Engine-level rule conformance.
 * Extracts the pure engine straight out of index.html (between the
 * __ENGINE_START__ / __ENGINE_END__ markers) and runs it with zero DOM.
 *   node test/engine-test.js
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/\/\*__ENGINE_START__\*\/([\s\S]*?)\/\*__ENGINE_END__\*\//);
if (!m) { console.error("engine markers not found"); process.exit(2); }
const MK = vm.runInNewContext(m[1] + "\nMK;", {});

let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.error("  x FAIL:", msg)); };
const C = (rank, s) => ({ id: MK.SUITS[s].k + rank, r: MK.RANKS.indexOf(rank), s: s });
const tbl = (n, seed) => MK.create({ seed: seed || 12345, players: Array.from({ length: n }, (_, i) => ({ name: "P" + i, kind: "human" })) });
const ids = p => p.stack.map(c => MK.RANKS[c.r] + MK.SUITS[c.s].g).join(",");
const ex = (s, prompt) => { s.phase = "exchange"; s.ex = { prompt: prompt, passed: [], gives: 0, windows: s.ex.windows }; };

console.log("1) rank rule: exactly one lower, suit ignored, no 2->A wrap");
{
  const s = tbl(3);
  s.players[0].stack = [C("K", 0)];      // K♠
  s.players[1].stack = [C("Q", 1)];      // Q♥  (other suit)
  s.players[2].stack = [C("9", 2)];      // 9♣
  ok(MK.legalTargets(s, 0).join() === "1", "K♠ may give to Q♥ only (suit ignored)");
  s.players[0].stack = [C("A", 3)];      // A♦
  ok(MK.legalTargets(s, 0).length === 0, "A♦ has no K on the table -> no target");
  s.players[2].stack = [C("K", 2)];      // K♣
  ok(MK.legalTargets(s, 0).join() === "2", "A♦ -> K♣ legal (A is high only)");
  s.players[0].stack = [C("2", 0)];      // 2♠
  ok(MK.legalTargets(s, 0).length === 0, "a 2 can never be given away");
  s.players[0].stack = [C("3", 0)]; s.players[1].stack = [C("2", 1)];
  ok(MK.legalTargets(s, 0).join() === "1", "3♠ -> 2♥ legal (the only way a 2 receives)");
  s.players[0].stack = [C("4", 0)]; s.players[1].stack = [C("2", 1)];
  ok(MK.legalTargets(s, 0).length === 0, "4♠ cannot skip down to 2♥ (gap of 2 is illegal)");
  s.players[0].stack = [C("10", 0)]; s.players[1].stack = [C("9", 1)]; s.players[2].stack = [C("9", 3)];
  ok(MK.legalTargets(s, 0).join() === "1,2", "10♠ may give to either 9 (both seats offered)");
}

console.log("2) transfer is permanent, lands ON TOP, and unlocks chains");
{
  const s = tbl(3);
  s.players[0].stack = [C("5", 0), C("A", 1)];   // bottom 5♠, public A♥
  s.players[1].stack = [C("K", 2)];              // public K♣
  ex(s, 0);
  MK.reduce(s, { t: "GIVE", from: 0, to: 1 });
  ok(ids(s.players[1]) === "K♣,A♥", "received card lands on top: " + ids(s.players[1]));
  ok(ids(s.players[0]) === "5♠", "giver permanently lost it and revealed the card underneath");
  ok(s.players[0].gave === 1 && s.players[1].got === 1 && s.gives === 1, "give counters recorded");

  const s2 = tbl(3);
  s2.players[0].stack = [C("K", 0)]; s2.players[1].stack = [C("Q", 1)]; s2.players[2].stack = [C("A", 2)];
  ex(s2, 0);
  MK.reduce(s2, { t: "GIVE", from: 0, to: 1 });
  ok(MK.top(s2.players[1]).id === "SK", "P1 public top is now K♠");
  ok(MK.legalTargets(s2, 2).indexOf(1) >= 0, "A♣ holder now legally targets P1 -> chain unlocked");
  s2.ex.prompt = 2;
  MK.reduce(s2, { t: "GIVE", from: 2, to: 1 });
  ok(ids(s2.players[1]) === "Q♥,K♠,A♣", "chain completed: " + ids(s2.players[1]));
  ok(MK.longestRun(s2.players[1].stack) === 3, "longest descending run = 3");
  ok(MK.stats(s2)[1].run === 3, "stats().run reports the same");
  ok(MK.longestRun([C("9", 0), C("K", 1)]) === 1, "non-consecutive stack -> run of 1");
  ok(MK.longestRun([]) === 0, "empty stack -> run of 0");
}

console.log("3) turn discipline: only the prompted seat may act");
{
  const s = tbl(3);
  s.players[0].stack = [C("7", 0)]; s.players[1].stack = [C("6", 1)];
  ex(s, 1);
  const snap = JSON.stringify(s.players.map(p => p.stack));
  MK.reduce(s, { t: "GIVE", from: 0, to: 1 });
  ok(JSON.stringify(s.players.map(p => p.stack)) === snap, "out-of-turn give ignored");
  s.ex.prompt = 0;
  MK.reduce(s, { t: "GIVE", from: 0, to: 0 });
  ok(s.players[0].stack.length === 1, "self give ignored");
  s.players[2].stack = [C("2", 3)];
  MK.reduce(s, { t: "GIVE", from: 0, to: 2 });
  ok(s.players[0].stack.length === 1, "give to a 2 ignored");
  MK.reduce(s, { t: "PICK" });
  ok(s.players[0].stack.length === 1, "PICK during an exchange window ignored");
  MK.reduce(s, { t: "PASS", seat: 1 });
  ok(s.ex.passed.length === 0, "pass from a non-prompted seat ignored");
  MK.reduce(s, { t: "NOPE" }); MK.reduce(s, null);
  ok(s.phase === "exchange", "unknown/null actions are inert");
}

console.log("4) the window: rotation, resets and closing");
{
  const s = tbl(3);
  s.players[0].stack = [C("9", 0)]; s.players[1].stack = [C("5", 1)]; s.players[2].stack = [C("3", 2)];
  s.deck = [C("4", 1), C("8", 2)]; s.turn = 0; ex(s, 0);
  MK.reduce(s, { t: "PASS", seat: 0 });
  ok(s.ex.prompt === 1 && s.phase === "exchange", "prompt rotates clockwise, window stays open");
  MK.reduce(s, { t: "PASS", seat: 2 });
  ok(s.ex.passed.length === 1, "out-of-order pass rejected");
  MK.reduce(s, { t: "PASS", seat: 1 });
  ok(s.ex.prompt === 2, "prompt reaches the last holder");
  MK.reduce(s, { t: "PASS", seat: 2 });
  ok(s.phase === "dealing", "window closes once every holder has passed");
  ok(s.turn === 1, "next picker is clockwise after the last picker");
  ok(s.ex.passed.length === 0, "pass list cleared for the next window");

  const s2 = tbl(4);
  s2.players[0].stack = [C("9", 0)]; s2.players[1].stack = [C("8", 1)];
  s2.players[2].stack = [C("7", 2)]; s2.players[3].stack = [C("2", 3)];
  s2.deck = [C("3", 0)]; ex(s2, 0);
  MK.reduce(s2, { t: "PASS", seat: 0 });
  ok(s2.ex.passed.length === 1, "P0 passed");
  MK.reduce(s2, { t: "GIVE", from: 1, to: 2 });
  ok(s2.ex.passed.length === 0, "a give clears all passes -> window re-opened");
  ok(s2.ex.prompt === 2, "prompt continues clockwise from the giver");
  ok(MK.top(s2.players[2]).id === "H8", "receiver now shows 8♥");
  ok(MK.legalTargets(s2, 0).join() === "2", "P0's 9♠ can now give to that new 8♥");

  const s3 = tbl(4);
  s3.players[0].stack = [C("6", 0)];
  s3.deck = [C("9", 0)]; ex(s3, 0);
  ok(MK.eligible(s3).length === 1, "empty-stack players are not eligible");
  MK.reduce(s3, { t: "PASS", seat: 0 });
  ok(s3.phase === "dealing", "a single pass closes the window when only one player holds cards");
}

console.log("5) pile exhaustion ends Step 1 with every card accounted for");
{
  const s = tbl(2, 4242);
  let guard = 0;
  while (!s.done && guard++ < 20000) {
    const a = MK.actor(s); if (!a) break;
    if (a.kind === "pick") MK.reduce(s, { t: "PICK" });
    else {
      const tg = MK.legalTargets(s, a.seat);
      if (tg.length && Math.random() < 0.5) MK.reduce(s, { t: "GIVE", from: a.seat, to: tg[0] });
      else MK.reduce(s, { t: "PASS", seat: a.seat });
    }
  }
  ok(s.done && s.phase === "complete", "game completed");
  ok(s.deck.length === 0, "pile empty");
  ok(s.picks === 52, "exactly 52 picks, got " + s.picks);
  const all = [].concat(...s.players.map(p => p.stack.map(c => c.id)));
  ok(all.length === 52 && new Set(all).size === 52, "52 unique cards, none lost or duplicated");
  ok(s.ex.windows >= 1, "at least one exchange window ran (" + s.ex.windows + ")");
  ok(MK.actor(s) === null, "no actor once complete");
}

console.log("6) determinism: seed + action log == identical table (replay safe)");
{
  const cfg = { seed: 987654, players: Array.from({ length: 5 }, (_, i) => ({ name: "P" + i, kind: "human" })) };
  const a = MK.create(cfg), b = MK.create(cfg);
  ok(JSON.stringify(a.deck) === JSON.stringify(b.deck), "same seed -> same shuffle");
  ok(a.starter === b.starter, "same seed -> same starter");
  const acts = []; let guard = 0;
  while (!a.done && guard++ < 20000) {
    const ac = MK.actor(a); if (!ac) break;
    const tg = MK.legalTargets(a, ac.seat);
    const act = ac.kind === "pick" ? { t: "PICK" }
      : (tg.length && Math.random() < 0.5 ? { t: "GIVE", from: ac.seat, to: tg[0] } : { t: "PASS", seat: ac.seat });
    acts.push(act); MK.reduce(a, act);
  }
  acts.forEach(x => MK.reduce(b, x));
  ok(JSON.stringify(a.players.map(p => p.stack)) === JSON.stringify(b.players.map(p => p.stack)), "replaying the log reproduces every stack exactly");
  ok(JSON.stringify(a.deck) === JSON.stringify(b.deck), "replaying reproduces the pile");
  const c = MK.create({ seed: 987655, players: cfg.players });
  ok(JSON.stringify(c.deck) !== JSON.stringify(a.deck), "a different seed gives a different shuffle");
}

console.log("7) randomised soak: 400 games x 2-10 players");
{
  let bad = 0, maxStack = 0, chains = 0, gives = 0, longest = 0;
  for (let g = 0; g < 400; g++) {
    const n = 2 + Math.floor(Math.random() * 9);
    const s = tbl(n, (Math.random() * 1e9) >>> 0);
    let guard = 0;
    while (!s.done && guard++ < 300000) {
      const a = MK.actor(s); if (!a) break;
      if (a.kind === "pick") MK.reduce(s, { t: "PICK" });
      else {
        const tg = MK.legalTargets(s, a.seat);
        if (tg.length && Math.random() < 0.55) MK.reduce(s, { t: "GIVE", from: a.seat, to: tg[Math.floor(Math.random() * tg.length)] });
        else MK.reduce(s, { t: "PASS", seat: a.seat });
      }
    }
    const tot = s.players.reduce((x, p) => x + p.stack.length, 0) + s.deck.length;
    const uniq = new Set([].concat(...s.players.map(p => p.stack.map(c => c.id)))).size;
    if (!s.done || tot !== 52 || uniq !== s.players.reduce((x, p) => x + p.stack.length, 0)) bad++;
    s.players.forEach(p => { maxStack = Math.max(maxStack, p.stack.length); const r = MK.longestRun(p.stack); longest = Math.max(longest, r); if (r >= 3) chains++; });
    gives += s.gives;
  }
  ok(bad === 0, bad + " games broke conservation/termination");
  console.log("     largest stack seen:", maxStack, "| deepest descending run:", longest, "| stacks with a 3+ run:", chains, "| total gives:", gives);
}

console.log("8) robot brain never cheats");
{
  let bad = 0, decisions = 0, maxActs = 0, illegalGives = 0, nonTerm = 0;
  for (let g = 0; g < 80; g++) {
    const n = 2 + Math.floor(Math.random() * 9);
    const s = MK.create({ seed: (Math.random() * 1e9) >>> 0, players: Array.from({ length: n }, (_, i) => ({ name: "B" + i, kind: "bot" })) });
    let guard = 0;
    while (!s.done && guard++ < 300000) {
      const a = MK.actor(s); if (!a) { bad++; break; }
      const act = MK.botDecide(s, a.seat); decisions++;
      if (!act) { bad++; break; }
      if (act.t === "GIVE") { if (MK.legalTargets(s, act.from).indexOf(act.to) < 0) illegalGives++; if (act.from !== a.seat) bad++; }
      if (act.t === "PASS" && act.seat !== a.seat) bad++;
      if (act.t === "PICK" && a.kind !== "pick") bad++;
      const before = s.gives;
      MK.reduce(s, act);
      if (act.t === "GIVE" && s.gives === before) bad++;     // a legal give must be accepted
    }
    maxActs = Math.max(maxActs, guard);
    if (!s.done) nonTerm++;
    if (s.players.reduce((x, p) => x + p.stack.length, 0) + s.deck.length !== 52) bad++;
  }
  ok(illegalGives === 0, illegalGives + " illegal robot gives");
  ok(nonTerm === 0, nonTerm + " non-terminating robot games");
  ok(bad === 0, bad + " protocol violations");
  console.log("     80 all-robot games ·", decisions, "decisions · longest game", maxActs, "actions");
}

console.log("9) LOOP GUARD: the A<->B ping-pong that used to soft-lock the table");
{
  const s = tbl(2, 7);
  s.deck = [C("3", 0)];
  s.players[0].stack = [C("Q", 1), C("K", 0)];   // A: Q♥ under K♠
  s.players[1].stack = [C("Q", 2)];              // B: Q♣
  s.phase = "exchange"; s.turn = 0;
  s.ex = { prompt: 0, passed: [], gives: 0, windows: 0, seen: [MK.arrangeKey(s)], lastGive: null };
  const snapshot = () => JSON.stringify(s.players.map(p => p.stack.map(c => c.id)));

  MK.reduce(s, { t: "GIVE", from: 0, to: 1 });
  ok(s.last.t === "give" && s.gives === 1, "first give commits (A K♠ -> B Q♣)");
  const afterFirst = snapshot();

  MK.reduce(s, { t: "GIVE", from: 1, to: 0 });
  ok(s.last.t === "reject" && s.last.reason === "takeback", "immediate give-back refused as a take-back");
  ok(snapshot() === afterFirst, "table unchanged by the refused give");
  ok(s.gives === 1 && s.players[0].gave === 1 && s.players[1].got === 1, "counters not touched by a refusal");
  ok(s.phase === "exchange" && s.ex.prompt === 1, "prompt stays put after a refusal");

  for (let i = 0; i < 200; i++) { const a = MK.actor(s); MK.reduce(s, { t: "GIVE", from: a.seat, to: MK.legalTargets(s, a.seat)[0] }); }
  ok(s.gives === 1, "200 further bounce attempts commit nothing (gives still " + s.gives + ")");
  ok(MK.giveTargets(s, s.ex.prompt).length === 0, "the UI/robots see no usable give -> they pass instead");
  MK.reduce(s, { t: "PASS", seat: s.ex.prompt });
  MK.reduce(s, { t: "PASS", seat: s.ex.prompt });
  ok(s.phase === "dealing", "the window closes normally once both pass -> game can proceed");
}

console.log("10) LOOP GUARD: longer cycles blocked, legitimate play untouched");
{
  const s = tbl(3, 9);
  s.deck = [C("3", 0)];
  s.players[0].stack = [C("Q", 1), C("K", 0)]; s.players[1].stack = [C("Q", 2)]; s.players[2].stack = [C("Q", 3)];
  s.phase = "exchange"; s.turn = 0;
  s.ex = { prompt: 0, passed: [], gives: 0, windows: 0, seen: [MK.arrangeKey(s)], lastGive: null };
  MK.reduce(s, { t: "GIVE", from: 0, to: 1 });
  ok(s.last.t === "give", "A -> B allowed");
  s.ex.prompt = 1; MK.reduce(s, { t: "GIVE", from: 1, to: 2 });
  ok(s.last.t === "give", "B -> C allowed (fresh arrangement)");
  s.ex.prompt = 2; MK.reduce(s, { t: "GIVE", from: 2, to: 0 });
  ok(s.last.t === "reject" && s.last.reason === "rewind", "C -> A closes the cycle, so it is refused as a rewind");
  ok(s.gives === 2, "only the two genuine gives committed");

  // chains must survive the guard
  const c = tbl(3, 11);
  c.deck = [C("3", 0)];
  c.players[0].stack = [C("K", 0)]; c.players[1].stack = [C("Q", 1)]; c.players[2].stack = [C("A", 2)];
  c.phase = "exchange"; c.turn = 0;
  c.ex = { prompt: 0, passed: [], gives: 0, windows: 0, seen: [MK.arrangeKey(c)], lastGive: null };
  MK.reduce(c, { t: "GIVE", from: 0, to: 1 });
  c.ex.prompt = 2; MK.reduce(c, { t: "GIVE", from: 2, to: 1 });
  ok(c.last.t === "give" && MK.longestRun(c.players[1].stack) === 3, "stacking A♣ onto a just-received K♠ still works (run of 3)");
  const d = tbl(3, 13);
  d.players[0].stack = [C("9", 0), C("K", 0)]; d.players[1].stack = [C("Q", 1)]; d.players[2].stack = [C("Q", 2)];
  d.phase = "exchange"; d.turn = 0;
  d.ex = { prompt: 0, passed: [], gives: 0, windows: 0, seen: [MK.arrangeKey(d)], lastGive: null };
  MK.reduce(d, { t: "GIVE", from: 0, to: 1 });
  d.ex.prompt = 1; MK.reduce(d, { t: "GIVE", from: 1, to: 2 });
  ok(d.last.t === "give", "passing a received card on to a NEW seat is still allowed");
  ok(MK.wouldRewind(d, 2, 1) === true, "but handing it straight back is flagged as a rewind");
}

console.log("11) LOOP GUARD: bounded games under every strategy");
{
  const run = (giveProb, games) => {
    let worst = 0, bad = 0, maxWin = 0;
    for (let g = 0; g < games; g++) {
      const n = 2 + Math.floor(Math.random() * 9);
      const s = tbl(n, (Math.random() * 1e9) >>> 0);
      let guard = 0;
      while (!s.done && guard++ < 50000) {
        const a = MK.actor(s); if (!a) break;
        if (a.kind === "pick") MK.reduce(s, { t: "PICK" });
        else {
          const tg = MK.giveTargets(s, a.seat);
          if (tg.length && Math.random() < giveProb) MK.reduce(s, { t: "GIVE", from: a.seat, to: tg[Math.floor(Math.random() * tg.length)] });
          else MK.reduce(s, { t: "PASS", seat: a.seat });
        }
        maxWin = Math.max(maxWin, s.ex.gives);
      }
      if (!s.done) bad++;
      if (s.players.reduce((x, p) => x + p.stack.length, 0) + s.deck.length !== 52) bad++;
      worst = Math.max(worst, guard);
    }
    return { worst, bad, maxWin };
  };
  for (const p of [0.25, 0.5, 0.85, 1.0]) {
    const r = run(p, 150);
    ok(r.bad === 0, "give-rate " + p + ": broken games = " + r.bad);
    ok(r.worst < 5000, "give-rate " + p + ": longest game " + r.worst + " actions (was unbounded before the guard)");
    ok(r.maxWin <= MK.MAX_GIVES, "give-rate " + p + ": window give count " + r.maxWin + " stayed within the cap of " + MK.MAX_GIVES);
  }
  console.log("     600 games across 4 give-rates, every one bounded and conserved");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
