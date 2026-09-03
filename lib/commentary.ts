export type CommentaryContext = {
  playerName: string;
  playerRole: string;
  nationality?: string;
  category?: string;
  currentBid?: number;
  fairValue?: number;
  teamName?: string;
  team1Name?: string;
  team2Name?: string;
  remainingBudget?: number;
  maxBudget?: number;
  squadSize?: number;
  maxSquad?: number;
  overseasCount?: number;
  maxOverseas?: number;
  tension?: number;
  bidCount?: number;
  phase: "INTRO" | "BID" | "FINAL_CALL" | "SOLD" | "PASSED" | "SQUAD";
};

const RECENT_LINES: string[] = [];
const MAX_RECENT = 10;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickFresh<T>(arr: T[]): T {
  const available = arr.filter((item) => !RECENT_LINES.includes(item as unknown as string));
  const pool = available.length > 0 ? available : arr;
  const chosen = pick(pool);
  RECENT_LINES.push(chosen as unknown as string);
  if (RECENT_LINES.length > MAX_RECENT) RECENT_LINES.shift();
  return chosen;
}

function formatCr(value: number): string {
  return `${Number(value.toFixed(value % 1 === 0 ? 0 : 2))} crore`;
}

const marqueeIntro: string[] = [
  "The crowd rises! Here comes the big one - {name}, {role} extraordinaire!",
  "Ladies and gentlemen, brace yourselves - {name} is on the block!",
  "The auction room holds its breath... {name}, the {role}, walks in.",
  "This is the moment we've been waiting for! {name} enters the fray!",
  "A blockbuster name! {name}, one of the finest {role}s in the game!",
  "The gavel trembles - {name}, a {role} of rare caliber, takes the stage!",
  "Electric atmosphere! {name} - a match-winner par excellence!",
  "The big fish has arrived! {name} - pure {role} class!",
  "Stand up for greatness! {name}, a {role} who changes everything!",
  "The room goes silent... {name}, the {role}, is here to command!",
];

const cappedIndianIntro: string[] = [
  "Next up, a proven campaigner - {name} walks in.",
  "A familiar face in the IPL cauldron - {name} is up next.",
  "India's very own {name}, a {role} who's been there, done that.",
  "Here comes {name} - battle-tested and ready for another season.",
  "A domestic powerhouse - {name}, the {role}, enters the auction.",
  "Reliable, experienced, effective - {name} is on the block.",
  "The Indian contingent delivers again - {name}, a {role} of substance.",
  "A stalwart of the IPL circuit - {name} looks for a new home.",
  "The tricolor pride - {name}, a {role} who delivers when it matters.",
  "Consistency personified - {name}, the {role}, joins the auction pool.",
];

const overseasIntro: string[] = [
  "International quality on the block! {name} from {nationality}.",
  "A world-class talent - {name}, representing {nationality}!",
  "Global cricket meets IPL - {name} from {nationality} is up!",
  "The overseas star has arrived - {name}, a {role} from {nationality}!",
  "Crossing borders for IPL glory - {name} of {nationality}!",
  "International pedigree on display - {name} from {nationality}!",
  "A {role} who's lit up stadiums worldwide - {name} from {nationality}!",
  "The foreign contingent strikes again - {name}, {nationality}'s finest {role}!",
  "Global appeal, local passion - {name} from {nationality} walks in!",
  "World-class {role} alert - {name}, flying the {nationality} flag!",
];

const uncappedIntro: string[] = [
  "An exciting young talent - {name} looking for a home.",
  "The next big thing? {name}, an uncapped {role}, enters the auction!",
  "Raw talent, unlimited potential - {name} is on the block!",
  "A rising star of Indian cricket - {name}, the {role}, steps up!",
  "Youth meets ambition - {name} is ready for the IPL stage!",
  "The unknown quantity - {name}, a {role} who could be a revelation!",
  "From the domestic circuit to the big league - {name} joins us!",
  "A gamble worth taking? {name}, the {role}, enters the fray!",
  "The uncapped brigade delivers another gem - {name} is here!",
  "Fresh blood in the auction pool - {name}, a {role} with something to prove!",
];

const firstBid: string[] = [
  "{team} opens the bidding at {amount}!",
  "{team} strikes first! {amount} on the table!",
  "The first paddle goes up - {team} at {amount}!",
  "{team} shows early intent! Bidding starts at {amount}!",
  "And we're underway! {team} at {amount}!",
  "{team} wastes no time! {amount} crore to kick things off!",
  "The opening bid is in - {team} at {amount}!",
  "{team} sets the tone! {amount} crore on the board!",
];

const counterBid: string[] = [
  "{team} won't let go! They're in at {amount}!",
  "Counter bid! {team} raises to {amount}!",
  "{team} refuses to back down! {amount} crore now!",
  "A challenger emerges! {team} at {amount}!",
  "{team} jumps back in! The price rises to {amount}!",
  "Not so fast! {team} counters at {amount}!",
  "{team} throws their hat back in! {amount} crore!",
  "The battle continues - {team} at {amount}!",
];

const priceEscalation: string[] = [
  "The price is climbing! {amount} now!",
  "We're heading up! {amount} crore on the board!",
  "The numbers keep rising! {amount}!",
  "Escalation! {amount} crore and counting!",
  "The price tag grows - {amount} now!",
  "Climbing the ladder! {amount} crore!",
  "The figure swells to {amount}!",
  "Rising fast - {amount} crore!",
];

const nearFairValue: string[] = [
  "We're approaching fair value territory at {amount}.",
  "Right around the model price now - {amount} crore.",
  "Getting into the valuation zone at {amount}!",
  "The market aligns with fair value at {amount} crore.",
  "We're near the sweet spot - {amount} crore.",
  "Fair value is in sight at {amount}!",
  "The numbers are converging - {amount} crore now.",
  "Right on the money at {amount} crore.",
];

const aboveFairValue: string[] = [
  "Overpaying now! {amount} - is it worth it?",
  "Above the model price! {amount} crore - premium territory!",
  "The market is running hot! {amount} crore above fair value!",
  "Is this too much? {amount} crore and rising!",
  "Paying a premium now - {amount} crore!",
  "The bids are outpacing the model! {amount}!",
  "Overvaluation alert! {amount} crore on the table!",
  "This is getting expensive! {amount} crore!",
];

const biddingWar: string[] = [
  "A fierce battle between {team1} and {team2}!",
  "Two heavyweights slug it out - {team1} versus {team2}!",
  "It's a duel! {team1} and {team2} locked in combat!",
  "Neither side blinks! {team1} and {team2} trade blows!",
  "An epic tussle - {team1} and {team2} refuse to yield!",
  "The rivalry intensifies! {team1} against {team2}!",
  "A two-horse race! {team1} and {team2} slug it out!",
  "The tension rises as {team1} and {team2} battle for supremacy!",
];

const goingOnce: string[] = [
  "Going once... The room holds its breath...",
  "Going once... Silence falls over the auction hall...",
  "Going once... Every eye is on the gavel...",
  "Going once... The tension is palpable...",
  "Going once... Will anyone counter at this price?",
  "Going once... The clock ticks loudly...",
  "Going once... The room waits with bated breath...",
  "Going once... One last chance to strike...",
];

const goingTwice: string[] = [
  "Going twice... Will anyone counter?",
  "Going twice... This could be the final moment!",
  "Going twice... The gavel is raised!",
  "Going twice... Last opportunity!",
  "Going twice... Is there one more bid in someone?",
  "Going twice... The room is electric!",
  "Going twice... One final chance to change the outcome!",
  "Going twice... The hammer hangs in the balance!",
];

const sold: string[] = [
  "SOLD! {team} gets their man at {amount}!",
  "And that's a wrap! {team} secures {name} for {amount}!",
  "SOLD TO {team}! {amount} crore seals the deal!",
  "The hammer falls! {team} buys {name} at {amount}!",
  "Done deal! {team} lands {name} for {amount} crore!",
  "SOLD! {team} adds {name} to their arsenal at {amount}!",
  "That's it! {team} walks away with {name} for {amount}!",
  "The gavel strikes! {team} claims {name} at {amount}!",
];

const passed: string[] = [
  "PASSED! No takers for {name}. The market moves on.",
  "And {name} goes unsold. The auction continues.",
  "No bids at that price. {name} walks away.",
  "PASSED! {name} doesn't find a buyer today.",
  "The market says no to {name} at this price point.",
  "No takers! {name} remains unsold.",
  "PASSED! The gavel falls without a sale.",
  "Tough luck for {name} - no franchise bites.",
];

const squadImpact: string[] = [
  "{team} fills their {role} gap. Smart buy.",
  "A tactical acquisition! {team} shores up their {role} department.",
  "{team} adds depth in the {role} slot. Well played.",
  "Strategic move! {team} bolsters their {role} options.",
  "{team} gets exactly what they needed - a quality {role}.",
  "Perfect fit! {team} addresses their {role} need.",
  "{team} locks in a {role} for their squad. Clinical.",
  "That fills a void! {team} now has {role} covered.",
];

const budgetWarning: string[] = [
  "{team} running low on purse - {amount} remaining.",
  "Purse alert! {team} has just {amount} left to spend.",
  "Budget tightens for {team} - {amount} crore in the tank.",
  "{team} is down to {amount} crore. Every bid counts now.",
  "Money is scarce! {team} has {amount} crore remaining.",
  "The war chest is thinning - {team} with {amount} crore left.",
  "{team} must be careful - only {amount} crore in reserve.",
  "Budget squeeze! {team} has {amount} crore to play with.",
];

const squadCompletion: string[] = [
  "{team} nearing a full squad of {max}.",
  "{team} is building towards a complete squad - {size} of {max} filled.",
  "The puzzle is almost complete for {team} - {size}/{max}.",
  "{team} is just {remaining} short of a full-strength squad.",
  "Squad assembly nears the finish line for {team}.",
  "{team} is on the home stretch! {size} of {max} players acquired.",
  "The blueprint is almost done - {team} with {size}/{max}.",
  "One step closer! {team} is nearly at a full complement.",
];

const overseasLimit: string[] = [
  "That's {count} overseas players for {team}. Watch the cap.",
  "Overseas count rises to {count} for {team}. Room for {remaining} more.",
  "{team} now has {count} overseas players. The limit is {max}.",
  "International quota alert! {team} at {count}/{max} overseas.",
  "That takes {team} to {count} overseas players. Mind the cap!",
  "{team} locks in overseas number {count}. {remaining} spots remain.",
  "The overseas ledger shows {count} for {team}. Tread carefully.",
  "Watch the foreign player count! {team} at {count}/{max}.",
];

const tensionLow: string[] = [
  "Business as usual at the table.",
  "The auction proceeds at a steady pace.",
  "Calm before the storm? The room is quiet.",
  "Routine proceedings for now.",
  "No surprises here. The room stays composed.",
  "A measured approach from all tables.",
  "The auction hums along peacefully.",
  "Everything is under control at this stage.",
];

const tensionMedium: string[] = [
  "The room is heating up!",
  "You can feel the energy building in here!",
  "The temperature is rising in the auction hall!",
  "Things are getting interesting now!",
  "The intensity is building at the tables!",
  "A buzz fills the auction room!",
  "The excitement is palpable!",
  "The crowd senses something big coming!",
];

const tensionHigh: string[] = [
  "You could cut the tension with a knife!",
  "The room is on edge! Every bid echoes!",
  "Nervous glances across the table!",
  "The pressure is immense! Everyone knows it!",
  "The auction room is a pressure cooker!",
  "Every franchise is feeling the heat!",
  "The stakes have never been higher!",
  "The room is vibrating with anticipation!",
];

const tensionMax: string[] = [
  "Absolute drama in the auction room!",
  "We are witnessing auction theater at its finest!",
  "Total chaos! The room is in uproar!",
  "This is why we love IPL auctions! Pure drama!",
  "The auction room is a cauldron of intensity!",
  "Unbelievable scenes! The tension is off the charts!",
  "This is historic! The room will never forget this moment!",
  "Maximum overload! The auction has reached fever pitch!",
];

export function generateCommentary(ctx: CommentaryContext): string {
  const name = ctx.playerName;
  const role = ctx.playerRole;
  const team = ctx.teamName ?? "the table";
  const amount = ctx.currentBid !== undefined ? formatCr(ctx.currentBid) : "0 crore";

  switch (ctx.phase) {
    case "INTRO": {
      if (ctx.category === "MARQUEE") {
        return pickFresh(marqueeIntro)
          .replace("{name}", name)
          .replace("{role}", role);
      }
      if (ctx.category === "CAPPED_INDIAN") {
        return pickFresh(cappedIndianIntro)
          .replace("{name}", name)
          .replace("{role}", role);
      }
      if (ctx.category === "CAPPED_OVERSEAS") {
        return pickFresh(overseasIntro)
          .replace("{name}", name)
          .replace("{role}", role)
          .replace("{nationality}", ctx.nationality ?? "overseas");
      }
      return pickFresh(uncappedIntro)
        .replace("{name}", name)
        .replace("{role}", role);
    }

    case "BID": {
      const bidCount = ctx.bidCount ?? 1;
      if (bidCount === 1) {
        return pickFresh(firstBid)
          .replace("{team}", team)
          .replace("{amount}", amount);
      }

      if (ctx.team1Name && ctx.team2Name && Math.random() < 0.3) {
        return pickFresh(biddingWar)
          .replace("{team1}", ctx.team1Name)
          .replace("{team2}", ctx.team2Name);
      }

      if (ctx.fairValue && ctx.currentBid) {
        const ratio = ctx.currentBid / ctx.fairValue;
        if (ratio >= 1.05) {
          return pickFresh(aboveFairValue).replace("{amount}", amount);
        }
        if (ratio >= 0.85) {
          return pickFresh(nearFairValue).replace("{amount}", amount);
        }
      }

      if (bidCount > 3) {
        return pickFresh(priceEscalation).replace("{amount}", amount);
      }

      return pickFresh(counterBid)
        .replace("{team}", team)
        .replace("{amount}", amount);
    }

    case "FINAL_CALL": {
      const pickGoing = ctx.bidCount && ctx.bidCount % 2 === 0 ? goingTwice : goingOnce;
      return pickFresh(pickGoing);
    }

    case "SOLD": {
      return pickFresh(sold)
        .replace("{team}", team)
        .replace("{name}", name)
        .replace("{amount}", amount);
    }

    case "PASSED": {
      return pickFresh(passed).replace("{name}", name);
    }

    case "SQUAD": {
      if (ctx.remainingBudget !== undefined && ctx.maxBudget !== undefined) {
        const pctRemaining = ctx.remainingBudget / ctx.maxBudget;
        if (pctRemaining < 0.2) {
          return pickFresh(budgetWarning)
            .replace("{team}", team)
            .replace("{amount}", formatCr(ctx.remainingBudget));
        }
      }

      if (ctx.overseasCount !== undefined && ctx.maxOverseas !== undefined) {
        if (ctx.overseasCount >= ctx.maxOverseas - 1) {
          return pickFresh(overseasLimit)
            .replace("{team}", team)
            .replace("{count}", String(ctx.overseasCount))
            .replace("{max}", String(ctx.maxOverseas))
            .replace("{remaining}", String(ctx.maxOverseas - ctx.overseasCount));
        }
      }

      if (ctx.squadSize !== undefined && ctx.maxSquad !== undefined) {
        const remaining = ctx.maxSquad - ctx.squadSize;
        if (remaining <= 3) {
          return pickFresh(squadCompletion)
            .replace("{team}", team)
            .replace("{size}", String(ctx.squadSize))
            .replace("{max}", String(ctx.maxSquad))
            .replace("{remaining}", String(remaining));
        }
      }

      return pickFresh(squadImpact)
        .replace("{team}", team)
        .replace("{role}", role);
    }
  }
}

export function generateAuctioneerLine(ctx: CommentaryContext): string {
  const tension = ctx.tension ?? 50;

  if (ctx.phase === "INTRO") {
    return generateCommentary(ctx);
  }

  if (ctx.phase === "FINAL_CALL") {
    return pickFresh([
      "Going once, going twice... The hammer is raised!",
      "Is there any final bid? The clock is ticking!",
      "Last call! Will anyone make a move?",
      "Going once... Going twice... Any advance?",
      "The final moments! Speak now or forever hold your peace!",
      "This is it! One last chance before the hammer falls!",
      "The auctioneer's eye scans the room... Any final bid?",
      "Going, going... Will the gavel fall?",
    ]);
  }

  if (ctx.phase === "SOLD") {
    return pickFresh([
      "A hard-fought battle comes to an end!",
      "What a contest! The market has spoken!",
      "That was a riveting exchange! Well bought!",
      "The crowd erupts! What a signing!",
      "A valiant effort from the underbidders!",
      "The winner celebrates! A fantastic acquisition!",
      "The room exhales! What a ride that was!",
      "The gavel has spoken! A worthy buy!",
    ]);
  }

  if (ctx.phase === "PASSED") {
    return pickFresh([
      "A tough pill to swallow for the player's camp.",
      "The market waits for no one. On to the next lot!",
      "Shake it off! The auction moves forward.",
      "That's the nature of the beast! Next up!",
      "No deal today! The auction continues!",
      "A disappointing outcome, but the show goes on!",
      "The next player awaits! The auction never stops!",
      "Tough market conditions! Let's see what's next!",
    ]);
  }

  if (tension <= 30) {
    return pickFresh(tensionLow);
  }
  if (tension <= 60) {
    return pickFresh(tensionMedium);
  }
  if (tension <= 85) {
    return pickFresh(tensionHigh);
  }
  return pickFresh(tensionMax);
}
