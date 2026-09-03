import {
  type AuctionCategory,
  type AvailabilityStatus,
  type CappedStatus,
  type FormTrend,
  type Player,
  type Role,
  validatePlayerDataset
} from "@/data/players/types";
import { playerAssets } from "@/data/players/assets";
import { playerSourceCoverage, validatePlayerSourceReferences } from "@/data/sources/playerSources";

export const PLAYER_DATASET_VERSION = "2027.1.0";

type SeedRecord = {
  id: string;
  name: string;
  shortName: string;
  nationality: string;
  age: number;
  role: Role;
  basePrice: number;
  overall: number;
  potential: number;
  matches: number;
  runs: number;
  wickets: number;
  fairValue: number;
  reason: string;
  category?: AuctionCategory;
  cappedStatus?: CappedStatus;
  availability?: AvailabilityStatus;
  battingStyle?: string;
  bowlingStyle?: string;
  specialization?: string;
};

const ROLE_DEFAULTS: Record<Role, { battingStyle: string; bowlingStyle?: string; specialization?: string }> = {
  BAT: { battingStyle: "Right-hand bat", bowlingStyle: "Part-time medium", specialization: "Top-order run scoring" },
  BOWL: { battingStyle: "Right-hand bat", bowlingStyle: "Right-arm fast", specialization: "Wicket-taking bowling" },
  AR: { battingStyle: "Left-hand bat", bowlingStyle: "Right-arm medium", specialization: "Two-skill flexibility" },
  WK: { battingStyle: "Right-hand bat", bowlingStyle: "Part-time medium", specialization: "Wicketkeeper-batter" }
};

function makePlayer(seed: SeedRecord, profile: "CURATED" | "GENERATED" = "CURATED"): Player {
  const cappedStatus = seed.cappedStatus ?? "CAPPED";
  const nationalityStatus = seed.nationality === "Indian" ? "INDIAN" : "OVERSEAS";
  const category = seed.category ?? (cappedStatus === "UNCAPPED" ? "UNCAPPED" : nationalityStatus === "INDIAN" ? "CAPPED_INDIAN" : "CAPPED_OVERSEAS");
  const formTrend: FormTrend = seed.potential - seed.overall >= 9 ? "RISING" : seed.overall >= 84 ? "STABLE" : "RISING";
  const bowlingRole = seed.role === "BOWL" || seed.role === "AR";
  const innings = Math.max(1, Math.round(seed.matches * (seed.role === "BOWL" ? 0.45 : 0.82)));
  const battingAverage = Number((seed.runs / innings).toFixed(1));
  const economy = bowlingRole ? Number(Math.max(6.3, 9.2 - seed.wickets * 0.012).toFixed(2)) : undefined;
  const injuryRisk = seed.availability === "DOUBTFUL" ? 42 : seed.age >= 32 ? 28 : profile === "GENERATED" ? 11 : 18;
  const assets = playerAssets(seed.id, seed.name);
  const sourceRefs = ["projected-player-pack-2027"];
  const dataStatus = "SIMULATION_GENERATED" as const;
  const profileStatus = profile === "GENERATED" ? "PROJECTED" as const : "CURATED" as const;

  return {
    playerId: seed.id,
    identity: { name: seed.name, shortName: seed.shortName, nationality: seed.nationality, age: seed.age, imageSlug: seed.id },
    // The projected 2027 pack ships without licensed player photography.
    // `playerAssets` resolves the versioned manifest and explicit fallback.
    assets,
    role: {
      primary: seed.role,
      battingStyle: seed.battingStyle ?? ROLE_DEFAULTS[seed.role].battingStyle ?? "Right-hand bat",
      bowlingStyle: seed.bowlingStyle ?? ROLE_DEFAULTS[seed.role].bowlingStyle,
      specialization: seed.specialization ?? ROLE_DEFAULTS[seed.role].specialization
    },
    realData: {
      iplMatches: seed.matches,
      runs: seed.runs,
      wickets: seed.wickets,
      battingAverage,
      average: battingAverage,
      strikeRate: Number((118 + (seed.overall - 60) * 1.15).toFixed(1)),
      bowlingAverage: bowlingRole ? Number((Math.max(16, 35 - seed.overall * 0.15)).toFixed(1)) : undefined,
      economy,
      bestBowling: bowlingRole ? (seed.overall >= 85 ? "4/24" : "3/28") : undefined,
      catches: Math.max(0, Math.round(seed.matches * (seed.role === "WK" ? 0.42 : 0.13))),
      stumpings: seed.role === "WK" ? Math.max(0, Math.round(seed.matches * 0.08)) : undefined,
      dataStatus,
      asOf: "2027 projection",
      sourceRefs
    },
    auctionData: {
      basePrice: seed.basePrice,
      cappedStatus,
      nationalityStatus,
      category,
      rtmEligible: cappedStatus === "CAPPED" && nationalityStatus === "INDIAN" && category !== "MARQUEE",
      availability: seed.availability ?? "FULL"
    },
    simulationData: {
      modelVersion: "valuation-v1",
      overall: seed.overall,
      potential: seed.potential,
      consistency: Math.max(55, Math.min(97, seed.overall - (profile === "GENERATED" ? 7 : 3))),
      pressure: Math.max(55, Math.min(98, seed.overall + (seed.role === "WK" ? 2 : 0))),
      injuryRisk,
      formTrend,
      developmentRate: Math.max(35, Math.min(95, seed.potential - seed.overall + 55))
    },
    valuation: {
      fairValue: seed.fairValue,
      confidence: profile === "GENERATED" ? 54 : seed.overall >= 85 ? 86 : 70,
      scarcity: seed.role === "BOWL" ? "CRITICAL" : seed.role === "WK" ? "HIGH" : seed.role === "AR" ? "HIGH" : "MEDIUM",
      reason: seed.reason
    },
    // No source registry is bundled yet, so numerical statistics are always
    // labeled as simulation inputs. Curated identity/role data must never make
    // unsourced match figures appear verified in the product UI.
    provenance: {
      profile,
      stats: dataStatus,
      datasetVersion: PLAYER_DATASET_VERSION,
      sourceRefs,
      fieldSources: {
        identity: "projected-player-pack-2027",
        role: "projected-player-pack-2027",
        stats: "projected-player-pack-2027",
        auction: "projected-player-pack-2027",
        availability: "projected-player-pack-2027",
        portrait: assets.portrait.sourceRef
      }
    },
    dataQuality: {
      identity: profileStatus,
      role: profileStatus,
      historicalStats: dataStatus,
      auctionTerms: "PROJECTED",
      availability: "PROJECTED",
      portrait: assets.portrait.kind === "GENERATED" ? "GENERATED" : "LICENSED",
      asOf: "2027 projection",
      notes: profile === "GENERATED"
        ? ["Academy identity and performance line are generated simulation inputs."]
        : ["Identity and role are curated anchors; historical figures remain simulation inputs until sourced."]
    }
  };
}

const curated = (record: SeedRecord) => makePlayer(record);

/** Named player pool used to anchor the market in recognizable talent. */
const CURATED_PLAYERS: Player[] = [
  curated({ id: "shubman-gill", name: "Shubman Gill", shortName: "S. Gill", nationality: "Indian", age: 27, role: "BAT", basePrice: 2, overall: 92, potential: 95, matches: 118, runs: 3837, wickets: 0, fairValue: 13.4, reason: "Elite anchor with powerplay control and leadership value.", category: "MARQUEE" }),
  curated({ id: "virat-kohli", name: "Virat Kohli", shortName: "V. Kohli", nationality: "Indian", age: 38, role: "BAT", basePrice: 2, overall: 91, potential: 88, matches: 270, runs: 7263, wickets: 4, fairValue: 12.8, reason: "Reliable chase anchor with elite pressure history.", category: "MARQUEE", availability: "FULL" }),
  curated({ id: "rohit-sharma", name: "Rohit Sharma", shortName: "R. Sharma", nationality: "Indian", age: 39, role: "BAT", basePrice: 2, overall: 86, potential: 82, matches: 270, runs: 6900, wickets: 15, fairValue: 9.2, reason: "Powerplay captaincy and high-end big-match experience.", category: "MARQUEE" }),
  curated({ id: "suryakumar-yadav", name: "Suryakumar Yadav", shortName: "S. Yadav", nationality: "Indian", age: 36, role: "BAT", basePrice: 2, overall: 90, potential: 89, matches: 170, runs: 3900, wickets: 0, fairValue: 11.7, reason: "Rare 360-degree middle-order scoring profile.", category: "MARQUEE" }),
  curated({ id: "yashasvi-jaiswal", name: "Yashasvi Jaiswal", shortName: "Y. Jaiswal", nationality: "Indian", age: 24, role: "BAT", basePrice: 2, overall: 89, potential: 96, matches: 65, runs: 2200, wickets: 0, fairValue: 12.4, reason: "Left-hand powerplay upside with a long runway.", category: "MARQUEE" }),
  curated({ id: "tilak-varma", name: "Tilak Varma", shortName: "Tilak", nationality: "Indian", age: 23, role: "BAT", basePrice: 2, overall: 85, potential: 94, matches: 38, runs: 1196, wickets: 0, fairValue: 9.1, reason: "Rare middle-order upside with a high development curve.", category: "MARQUEE" }),
  curated({ id: "shreyas-iyer", name: "Shreyas Iyer", shortName: "S. Iyer", nationality: "Indian", age: 31, role: "BAT", basePrice: 2, overall: 84, potential: 85, matches: 120, runs: 3200, wickets: 0, fairValue: 8.4, reason: "Indian middle-order control and leadership value.", category: "MARQUEE" }),
  curated({ id: "rinku-singh", name: "Rinku Singh", shortName: "Rinku", nationality: "Indian", age: 29, role: "BAT", basePrice: 1.5, overall: 79, potential: 85, matches: 56, runs: 1432, wickets: 0, fairValue: 6.3, reason: "Death-over finishing is a meaningful marginal squad boost.", category: "MARQUEE" }),
  curated({ id: "rajat-patidar", name: "Rajat Patidar", shortName: "R. Patidar", nationality: "Indian", age: 33, role: "BAT", basePrice: 1.5, overall: 81, potential: 84, matches: 62, runs: 1570, wickets: 0, fairValue: 6.1, reason: "High-impact spin hitter for the middle overs.", category: "MARQUEE" }),
  curated({ id: "devdutt-padikkal", name: "Devdutt Padikkal", shortName: "D. Padikkal", nationality: "Indian", age: 26, role: "BAT", basePrice: 1, overall: 75, potential: 84, matches: 70, runs: 1600, wickets: 0, fairValue: 4.2, reason: "Left-hand batting depth with a reset opportunity.", category: "CAPPED_INDIAN" }),
  curated({ id: "jasprit-bumrah", name: "Jasprit Bumrah", shortName: "J. Bumrah", nationality: "Indian", age: 33, role: "BOWL", basePrice: 2, overall: 96, potential: 95, matches: 145, runs: 60, wickets: 170, fairValue: 16.2, reason: "Complete powerplay and death-overs control.", category: "MARQUEE", specialization: "Powerplay and death overs" }),
  curated({ id: "arshdeep-singh", name: "Arshdeep Singh", shortName: "Arshdeep", nationality: "Indian", age: 27, role: "BOWL", basePrice: 2, overall: 86, potential: 90, matches: 65, runs: 52, wickets: 76, fairValue: 8.4, reason: "Elite death bowling, high team fit, limited Indian alternatives.", category: "MARQUEE", specialization: "Left-arm death bowling" }),
  curated({ id: "mohammed-siraj", name: "Mohammed Siraj", shortName: "M. Siraj", nationality: "Indian", age: 32, role: "BOWL", basePrice: 2, overall: 84, potential: 85, matches: 102, runs: 55, wickets: 99, fairValue: 8.1, reason: "New-ball intensity and reliable availability.", category: "MARQUEE" }),
  curated({ id: "mohammed-shami", name: "Mohammed Shami", shortName: "M. Shami", nationality: "Indian", age: 36, role: "BOWL", basePrice: 2, overall: 88, potential: 84, matches: 125, runs: 55, wickets: 145, fairValue: 9.8, reason: "Seam movement and playoff-tested control.", category: "MARQUEE", availability: "PARTIAL" }),
  curated({ id: "kuldeep-yadav", name: "Kuldeep Yadav", shortName: "K. Yadav", nationality: "Indian", age: 32, role: "BOWL", basePrice: 2, overall: 87, potential: 88, matches: 105, runs: 35, wickets: 115, fairValue: 8.7, reason: "Left-arm wrist spin creates middle-over matchup leverage.", category: "MARQUEE", bowlingStyle: "Left-arm wrist spin" }),
  curated({ id: "yuzvendra-chahal", name: "Yuzvendra Chahal", shortName: "Y. Chahal", nationality: "Indian", age: 36, role: "BOWL", basePrice: 2, overall: 83, potential: 83, matches: 160, runs: 37, wickets: 205, fairValue: 6.9, reason: "Proven wicket-taking leg-spin with experience advantage.", category: "CAPPED_INDIAN", bowlingStyle: "Right-arm leg spin" }),
  curated({ id: "varun-chakravarthy", name: "Varun Chakravarthy", shortName: "Varun", nationality: "Indian", age: 35, role: "BOWL", basePrice: 1.5, overall: 82, potential: 84, matches: 87, runs: 0, wickets: 95, fairValue: 6.8, reason: "Mystery spin creates matchup value through the middle overs.", category: "CAPPED_INDIAN", bowlingStyle: "Right-arm mystery spin" }),
  curated({ id: "ravi-bishnoi", name: "Ravi Bishnoi", shortName: "R. Bishnoi", nationality: "Indian", age: 26, role: "BOWL", basePrice: 1.5, overall: 80, potential: 89, matches: 68, runs: 35, wickets: 74, fairValue: 6.2, reason: "Young leg-spin with control and high defensive value.", category: "CAPPED_INDIAN", bowlingStyle: "Right-arm leg spin" }),
  curated({ id: "t-natarajan", name: "T. Natarajan", shortName: "T. Natarajan", nationality: "Indian", age: 35, role: "BOWL", basePrice: 1.5, overall: 78, potential: 79, matches: 55, runs: 12, wickets: 52, fairValue: 4.6, reason: "Left-arm yorker specialist for closing innings.", category: "CAPPED_INDIAN", bowlingStyle: "Left-arm fast" }),
  curated({ id: "prasidh-krishna", name: "Prasidh Krishna", shortName: "P. Krishna", nationality: "Indian", age: 30, role: "BOWL", basePrice: 1.5, overall: 79, potential: 84, matches: 60, runs: 22, wickets: 70, fairValue: 5.5, reason: "Hit-the-deck pace provides a different Indian seam angle.", category: "CAPPED_INDIAN" }),
  curated({ id: "avesh-khan", name: "Avesh Khan", shortName: "A. Khan", nationality: "Indian", age: 30, role: "BOWL", basePrice: 1.5, overall: 78, potential: 82, matches: 68, runs: 45, wickets: 74, fairValue: 5.1, reason: "Hard-length pace covers middle and death overs.", category: "CAPPED_INDIAN" }),
  curated({ id: "mukesh-kumar", name: "Mukesh Kumar", shortName: "M. Kumar", nationality: "Indian", age: 33, role: "BOWL", basePrice: 1, overall: 76, potential: 77, matches: 45, runs: 32, wickets: 49, fairValue: 4.2, reason: "Accurate seam provides dependable domestic pace depth.", category: "CAPPED_INDIAN" }),
  curated({ id: "harshit-rana", name: "Harshit Rana", shortName: "H. Rana", nationality: "Indian", age: 25, role: "BOWL", basePrice: 1, overall: 76, potential: 89, matches: 30, runs: 18, wickets: 34, fairValue: 5.3, reason: "Young high-pace profile with an aggressive growth curve.", category: "CAPPED_INDIAN" }),
  curated({ id: "akasha-madhwal", name: "Akash Madhwal", shortName: "A. Madhwal", nationality: "Indian", age: 32, role: "BOWL", basePrice: 0.75, overall: 74, potential: 78, matches: 22, runs: 12, wickets: 28, fairValue: 3.4, reason: "Yorker execution gives a value death-overs option.", category: "CAPPED_INDIAN" }),
  curated({ id: "hardik-pandya", name: "Hardik Pandya", shortName: "H. Pandya", nationality: "Indian", age: 33, role: "AR", basePrice: 2, overall: 90, potential: 88, matches: 150, runs: 2800, wickets: 70, fairValue: 12.2, reason: "Indian pace all-rounder and leadership multiplier.", category: "MARQUEE", specialization: "Finisher and seam all-rounder" }),
  curated({ id: "ravindra-jadeja", name: "Ravindra Jadeja", shortName: "R. Jadeja", nationality: "Indian", age: 38, role: "AR", basePrice: 2, overall: 89, potential: 84, matches: 240, runs: 2950, wickets: 160, fairValue: 10.7, reason: "Three-phase contribution with elite fielding value.", category: "MARQUEE", specialization: "Spin all-rounder" }),
  curated({ id: "axar-patel", name: "Axar Patel", shortName: "A. Patel", nationality: "Indian", age: 32, role: "AR", basePrice: 2, overall: 86, potential: 86, matches: 150, runs: 1750, wickets: 125, fairValue: 8.8, reason: "Powerplay spin and lower-order batting coverage.", category: "MARQUEE", bowlingStyle: "Left-arm orthodox" }),
  curated({ id: "venkatesh-iyer", name: "Venkatesh Iyer", shortName: "Venkatesh", nationality: "Indian", age: 31, role: "AR", basePrice: 2, overall: 82, potential: 84, matches: 51, runs: 1326, wickets: 3, fairValue: 6.7, reason: "Left-hand power and flexible top-six role.", category: "CAPPED_INDIAN" }),
  curated({ id: "abhishek-sharma", name: "Abhishek Sharma", shortName: "Abhishek", nationality: "Indian", age: 26, role: "AR", basePrice: 1, overall: 80, potential: 91, matches: 63, runs: 1781, wickets: 11, fairValue: 6.1, reason: "Explosive opener with breakout potential.", category: "CAPPED_INDIAN", bowlingStyle: "Left-arm orthodox" }),
  curated({ id: "shardul-thakur", name: "Shardul Thakur", shortName: "Shardul", nationality: "Indian", age: 35, role: "AR", basePrice: 2, overall: 76, potential: 80, matches: 95, runs: 307, wickets: 89, fairValue: 4.7, reason: "Batting depth and wicket-taking variance.", category: "CAPPED_INDIAN" }),
  curated({ id: "nitish-kumar-reddy", name: "Nitish Kumar Reddy", shortName: "N. Reddy", nationality: "Indian", age: 23, role: "AR", basePrice: 1, overall: 78, potential: 92, matches: 25, runs: 410, wickets: 8, fairValue: 5.8, reason: "Young seam all-rounder with middle-order power.", category: "CAPPED_INDIAN" }),
  curated({ id: "washington-sundar", name: "Washington Sundar", shortName: "W. Sundar", nationality: "Indian", age: 27, role: "AR", basePrice: 1.5, overall: 79, potential: 84, matches: 68, runs: 540, wickets: 43, fairValue: 5.4, reason: "Powerplay off-spin and flexible lower-order batting.", category: "CAPPED_INDIAN", bowlingStyle: "Right-arm off spin" }),
  curated({ id: "riyan-parag", name: "Riyan Parag", shortName: "R. Parag", nationality: "Indian", age: 25, role: "AR", basePrice: 1.5, overall: 80, potential: 89, matches: 70, runs: 1400, wickets: 18, fairValue: 6.4, reason: "Middle-order aggression with matchup leg-spin utility.", category: "CAPPED_INDIAN", bowlingStyle: "Right-arm leg spin" }),
  curated({ id: "krunal-pandya", name: "Krunal Pandya", shortName: "K. Pandya", nationality: "Indian", age: 35, role: "AR", basePrice: 1.5, overall: 77, potential: 76, matches: 130, runs: 1650, wickets: 72, fairValue: 4.8, reason: "Left-arm spin and experienced lower-order coverage.", category: "CAPPED_INDIAN", bowlingStyle: "Left-arm orthodox" }),
  curated({ id: "rishabh-pant", name: "Rishabh Pant", shortName: "R. Pant", nationality: "Indian", age: 29, role: "WK", basePrice: 2, overall: 91, potential: 93, matches: 111, runs: 3284, wickets: 0, fairValue: 12.6, reason: "Marquee wicketkeeper-batter who changes the batting ceiling.", category: "MARQUEE", specialization: "Left-hand wicketkeeper-finisher" }),
  curated({ id: "kl-rahul", name: "KL Rahul", shortName: "K. Rahul", nationality: "Indian", age: 34, role: "WK", basePrice: 2, overall: 87, potential: 86, matches: 135, runs: 4500, wickets: 0, fairValue: 9.6, reason: "Top-order keeper with role flexibility and composure.", category: "MARQUEE" }),
  curated({ id: "sanju-samson", name: "Sanju Samson", shortName: "S. Samson", nationality: "Indian", age: 32, role: "WK", basePrice: 2, overall: 86, potential: 88, matches: 175, runs: 4300, wickets: 0, fairValue: 9.2, reason: "Captaincy upside and high-ceiling wicketkeeper batting.", category: "MARQUEE" }),
  curated({ id: "ishan-kishan", name: "Ishan Kishan", shortName: "I. Kishan", nationality: "Indian", age: 28, role: "WK", basePrice: 2, overall: 82, potential: 88, matches: 110, runs: 2700, wickets: 0, fairValue: 7.4, reason: "Left-hand powerplay keeper with aggressive intent.", category: "CAPPED_INDIAN" }),
  curated({ id: "jos-buttler", name: "Jos Buttler", shortName: "J. Buttler", nationality: "England", age: 36, role: "BAT", basePrice: 2, overall: 91, potential: 88, matches: 115, runs: 3800, wickets: 0, fairValue: 11.4, reason: "Elite overseas opener and matchup destroyer.", category: "MARQUEE" }),
  curated({ id: "devon-conway", name: "Devon Conway", shortName: "D. Conway", nationality: "New Zealand", age: 35, role: "BAT", basePrice: 2, overall: 87, potential: 86, matches: 62, runs: 1750, wickets: 0, fairValue: 7.4, reason: "Left-hand control and low-variance powerplay batting.", category: "MARQUEE" }),
  curated({ id: "travis-head", name: "Travis Head", shortName: "T. Head", nationality: "Australia", age: 32, role: "BAT", basePrice: 2, overall: 92, potential: 91, matches: 55, runs: 1900, wickets: 0, fairValue: 11.2, reason: "Explosive left-hand power that changes the opening tempo.", category: "MARQUEE" }),
  curated({ id: "david-warner", name: "David Warner", shortName: "D. Warner", nationality: "Australia", age: 40, role: "BAT", basePrice: 2, overall: 84, potential: 79, matches: 185, runs: 6700, wickets: 0, fairValue: 7.1, reason: "Proven IPL run production with veteran leadership.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "harry-brook", name: "Harry Brook", shortName: "H. Brook", nationality: "England", age: 27, role: "BAT", basePrice: 2, overall: 84, potential: 93, matches: 42, runs: 1160, wickets: 0, fairValue: 7.8, reason: "Middle-order power with a premium growth curve.", category: "MARQUEE" }),
  curated({ id: "faf-du-plessis", name: "Faf du Plessis", shortName: "F. du Plessis", nationality: "South Africa", age: 42, role: "BAT", basePrice: 1.5, overall: 83, potential: 78, matches: 160, runs: 4600, wickets: 0, fairValue: 6.8, reason: "Opening stability and experienced on-field leadership.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "rachin-ravindra", name: "Rachin Ravindra", shortName: "R. Ravindra", nationality: "New Zealand", age: 26, role: "BAT", basePrice: 1.5, overall: 81, potential: 92, matches: 30, runs: 600, wickets: 12, fairValue: 6.3, reason: "Left-hand top-order upside and part-time spin flexibility.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "will-jacks", name: "Will Jacks", shortName: "W. Jacks", nationality: "England", age: 28, role: "BAT", basePrice: 1.5, overall: 82, potential: 90, matches: 32, runs: 800, wickets: 7, fairValue: 6.8, reason: "Powerplay intent with part-time off-spin matchup value.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "glenn-phillips", name: "Glenn Phillips", shortName: "G. Phillips", nationality: "New Zealand", age: 30, role: "BAT", basePrice: 1.5, overall: 81, potential: 85, matches: 35, runs: 760, wickets: 3, fairValue: 5.9, reason: "Explosive fielding and middle-order power across matchups.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "jofra-archer", name: "Jofra Archer", shortName: "J. Archer", nationality: "England", age: 31, role: "BOWL", basePrice: 2, overall: 89, potential: 92, matches: 48, runs: 54, wickets: 48, fairValue: 11.2, reason: "Strike pace and death overs upside, availability is the watch-out.", category: "MARQUEE", availability: "PARTIAL" }),
  curated({ id: "trent-boult", name: "Trent Boult", shortName: "T. Boult", nationality: "New Zealand", age: 37, role: "BOWL", basePrice: 2, overall: 81, potential: 81, matches: 110, runs: 181, wickets: 115, fairValue: 5.9, reason: "Powerplay swing remains premium; age adds workload risk.", category: "CAPPED_OVERSEAS", bowlingStyle: "Left-arm fast" }),
  curated({ id: "kagiso-rabada", name: "Kagiso Rabada", shortName: "K. Rabada", nationality: "South Africa", age: 31, role: "BOWL", basePrice: 2, overall: 88, potential: 89, matches: 90, runs: 120, wickets: 115, fairValue: 9.8, reason: "High-pace wicket-taking with big-game temperament.", category: "MARQUEE" }),
  curated({ id: "mitchell-starc", name: "Mitchell Starc", shortName: "M. Starc", nationality: "Australia", age: 36, role: "BOWL", basePrice: 2, overall: 90, potential: 86, matches: 85, runs: 110, wickets: 105, fairValue: 10.1, reason: "Left-arm pace creates powerplay and tail-end dominance.", category: "MARQUEE", bowlingStyle: "Left-arm fast" }),
  curated({ id: "anrich-nortje", name: "Anrich Nortje", shortName: "A. Nortje", nationality: "South Africa", age: 32, role: "BOWL", basePrice: 1.5, overall: 82, potential: 84, matches: 65, runs: 25, wickets: 70, fairValue: 6.5, reason: "Raw pace gives the attack a hard matchup angle.", category: "CAPPED_OVERSEAS", availability: "PARTIAL" }),
  curated({ id: "shaheen-afridi", name: "Shaheen Afridi", shortName: "S. Afridi", nationality: "Pakistan", age: 26, role: "BOWL", basePrice: 2, overall: 91, potential: 95, matches: 78, runs: 45, wickets: 100, fairValue: 12.5, reason: "Premium left-arm swing and new-ball wicket threat.", category: "MARQUEE" }),
  curated({ id: "rashid-khan", name: "Rashid Khan", shortName: "R. Khan", nationality: "Afghanistan", age: 28, role: "BOWL", basePrice: 2, overall: 93, potential: 94, matches: 125, runs: 450, wickets: 155, fairValue: 13.2, reason: "World-class leg-spin, lower-order hitting and fielding.", category: "MARQUEE", bowlingStyle: "Right-arm leg spin" }),
  curated({ id: "pat-cummins", name: "Pat Cummins", shortName: "P. Cummins", nationality: "Australia", age: 33, role: "BOWL", basePrice: 2, overall: 88, potential: 85, matches: 80, runs: 350, wickets: 95, fairValue: 9.5, reason: "Captaincy, hard lengths and big-game pace value.", category: "MARQUEE" }),
  curated({ id: "lockie-ferguson", name: "Lockie Ferguson", shortName: "L. Ferguson", nationality: "New Zealand", age: 35, role: "BOWL", basePrice: 1.5, overall: 80, potential: 80, matches: 55, runs: 60, wickets: 65, fairValue: 5.8, reason: "High pace creates a tactical wicket-taking option.", category: "CAPPED_OVERSEAS", availability: "PARTIAL" }),
  curated({ id: "wanindu-hasaranga", name: "Wanindu Hasaranga", shortName: "W. Hasaranga", nationality: "Sri Lanka", age: 29, role: "BOWL", basePrice: 1.5, overall: 82, potential: 86, matches: 45, runs: 220, wickets: 60, fairValue: 6.7, reason: "Attacking leg-spin plus lower-order batting flexibility.", category: "CAPPED_OVERSEAS", bowlingStyle: "Right-arm leg spin" }),
  curated({ id: "sam-curran", name: "Sam Curran", shortName: "S. Curran", nationality: "England", age: 28, role: "AR", basePrice: 2, overall: 84, potential: 88, matches: 64, runs: 1042, wickets: 49, fairValue: 8.8, reason: "Two-skill coverage and left-arm death overs utility.", category: "MARQUEE", specialization: "Left-arm seam all-rounder" }),
  curated({ id: "aiden-markram", name: "Aiden Markram", shortName: "A. Markram", nationality: "South Africa", age: 31, role: "AR", basePrice: 2, overall: 81, potential: 84, matches: 49, runs: 1034, wickets: 23, fairValue: 6.2, reason: "Calm leadership with off-spin utility.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "cameron-green", name: "Cameron Green", shortName: "C. Green", nationality: "Australia", age: 27, role: "AR", basePrice: 2, overall: 85, potential: 93, matches: 45, runs: 850, wickets: 35, fairValue: 8.9, reason: "Tall seam-bowling all-rounder with runway for growth.", category: "MARQUEE" }),
  curated({ id: "marcus-stoinis", name: "Marcus Stoinis", shortName: "M. Stoinis", nationality: "Australia", age: 37, role: "AR", basePrice: 2, overall: 83, potential: 80, matches: 100, runs: 2100, wickets: 45, fairValue: 6.6, reason: "Power finisher and matchup seam option.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "andre-russell", name: "Andre Russell", shortName: "A. Russell", nationality: "West Indies", age: 38, role: "AR", basePrice: 2, overall: 86, potential: 80, matches: 115, runs: 2300, wickets: 105, fairValue: 8.4, reason: "Short-burst power and late-innings impact.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "moeen-ali", name: "Moeen Ali", shortName: "M. Ali", nationality: "England", age: 39, role: "AR", basePrice: 1.5, overall: 78, potential: 75, matches: 110, runs: 1900, wickets: 65, fairValue: 4.8, reason: "Left-hand depth and matchup spin experience.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "liam-livingstone", name: "Liam Livingstone", shortName: "L. Livingstone", nationality: "England", age: 33, role: "AR", basePrice: 2, overall: 85, potential: 87, matches: 70, runs: 1600, wickets: 28, fairValue: 7.9, reason: "Boundary power and multiple spin options create high upside.", category: "MARQUEE", bowlingStyle: "Right-arm spin" }),
  curated({ id: "glenn-maxwell", name: "Glenn Maxwell", shortName: "G. Maxwell", nationality: "Australia", age: 37, role: "AR", basePrice: 2, overall: 84, potential: 79, matches: 130, runs: 2800, wickets: 42, fairValue: 7.1, reason: "Game-breaking power with off-spin utility.", category: "CAPPED_OVERSEAS", bowlingStyle: "Right-arm off spin" }),
  curated({ id: "rahmanullah-gurbaz", name: "Rahmanullah Gurbaz", shortName: "R. Gurbaz", nationality: "Afghanistan", age: 25, role: "WK", basePrice: 1, overall: 78, potential: 87, matches: 32, runs: 851, wickets: 0, fairValue: 5.2, reason: "Aggressive keeper-opener with matchup upside.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "heinrich-klaasen", name: "Heinrich Klaasen", shortName: "H. Klaasen", nationality: "South Africa", age: 35, role: "WK", basePrice: 2, overall: 91, potential: 88, matches: 75, runs: 2250, wickets: 0, fairValue: 10.7, reason: "Elite spin-hitting keeper for the middle and death overs.", category: "MARQUEE" }),
  curated({ id: "nicholas-pooran", name: "Nicholas Pooran", shortName: "N. Pooran", nationality: "West Indies", age: 30, role: "WK", basePrice: 2, overall: 89, potential: 91, matches: 95, runs: 2400, wickets: 0, fairValue: 10.1, reason: "Left-hand finishing and high-pressure boundary range.", category: "MARQUEE" }),
  curated({ id: "quinton-de-kock", name: "Quinton de Kock", shortName: "Q. de Kock", nationality: "South Africa", age: 34, role: "WK", basePrice: 2, overall: 86, potential: 82, matches: 105, runs: 3000, wickets: 0, fairValue: 7.5, reason: "Reliable overseas keeper-opener with experience.", category: "CAPPED_OVERSEAS" }),
  curated({ id: "philip-salt", name: "Phil Salt", shortName: "P. Salt", nationality: "England", age: 30, role: "WK", basePrice: 1.5, overall: 84, potential: 88, matches: 46, runs: 1450, wickets: 0, fairValue: 7.6, reason: "Powerplay acceleration and clean keeping fundamentals.", category: "MARQUEE" })
];

const DOMESTIC_ROLES: Role[] = ["BAT", "BOWL", "AR", "WK"];

/**
 * Deterministic prospect pool keeps the market deep while making synthetic
 * identities unmistakable. Stable IDs preserve save/replay compatibility;
 * an authorized roster import can replace these records later.
 */
const GENERATED_DOMESTIC_PLAYERS: Player[] = Array.from({ length: 96 }, (_, index) => {
  const role = DOMESTIC_ROLES[index % DOMESTIC_ROLES.length];
  const overall = 62 + ((index * 7) % 17);
  const potential = Math.min(94, overall + 11 + ((index * 3) % 12));
  const matches = (index * 5) % 34;
  const runs = role === "BOWL" ? (index * 13) % 220 : 80 + ((index * 97) % 1250);
  const wickets = role === "BAT" || role === "WK" ? (index * 2) % 8 : 8 + ((index * 11) % 62);
  const basePrice = Number((0.2 + (index % 6) * 0.1).toFixed(2));
  const fairValue = Number((basePrice + 0.25 + ((index * 13) % 20) / 10).toFixed(2));
  return makePlayer({
    id: `academy-${String(index + 1).padStart(3, "0")}`,
    name: `Academy Prospect ${String(index + 1).padStart(3, "0")}`,
    shortName: `Prospect ${String(index + 1).padStart(3, "0")}`,
    nationality: "Indian",
    age: 19 + (index % 10),
    role,
    basePrice,
    overall,
    potential,
    matches,
    runs,
    wickets,
    fairValue,
    reason: role === "BAT" ? "Simulation prospect with flexible batting range and room to develop." : role === "BOWL" ? "Simulation prospect with a developing wicket-taking skill." : role === "AR" ? "Simulation prospect offering low-cost two-skill coverage." : "Simulation prospect with keeper-batter depth value.",
    category: index < 72 ? "UNCAPPED" : "ACCELERATED",
    cappedStatus: "UNCAPPED",
    specialization: role === "BOWL" ? index % 2 === 0 ? "Powerplay seam" : "Middle-over spin" : role === "BAT" ? index % 2 === 0 ? "Powerplay batting" : "Finishing" : undefined
  }, "GENERATED");
});

export const PLAYERS_2027: Player[] = [...CURATED_PLAYERS, ...GENERATED_DOMESTIC_PLAYERS];
export const PLAYER_DATASET_VALIDATION = validatePlayerDataset(PLAYERS_2027, PLAYER_DATASET_VERSION);
export const PLAYER_SOURCE_REFERENCE_VALIDATION = validatePlayerSourceReferences(PLAYERS_2027);
export const PLAYER_SOURCE_COVERAGE = playerSourceCoverage(PLAYERS_2027);

if (!PLAYER_DATASET_VALIDATION.valid) {
  throw new Error(`Invalid IPL 2027 player dataset: ${PLAYER_DATASET_VALIDATION.errors.join("; ")}`);
}
if (!PLAYER_SOURCE_REFERENCE_VALIDATION.valid) {
  throw new Error(`Invalid IPL 2027 source references: ${PLAYER_SOURCE_REFERENCE_VALIDATION.errors.join("; ")}`);
}

export const PLAYER_BY_ID = Object.fromEntries(PLAYERS_2027.map((player) => [player.playerId, player])) as Record<string, Player>;
export const PLAYERS_BY_CATEGORY = PLAYERS_2027.reduce((groups, player) => {
  groups[player.auctionData.category].push(player);
  return groups;
}, { MARQUEE: [], CAPPED_INDIAN: [], CAPPED_OVERSEAS: [], UNCAPPED: [], ACCELERATED: [] } as Record<AuctionCategory, Player[]>);
