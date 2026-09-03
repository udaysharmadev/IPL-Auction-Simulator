export type FranchiseProfile = {
  id: string;
  philosophy: string;
  difficulty: string;
  aura: string;
  description: string;
  strengths: string[];
  needs: string[];
  retainedCore: string[];
};

export const FRANCHISE_PROFILES: Record<string, FranchiseProfile> = {
  KKR: { id: "KKR", philosophy: "Calculated aggression", difficulty: "Balanced", aura: "#8d5ca8", description: "A bold franchise built around matchup intelligence, spin control and fearless finishing.", strengths: ["Middle-overs control", "Flexible finishers"], needs: ["Death bowler", "Backup wicketkeeper"], retainedCore: ["Rinku Singh", "Varun C.", "A. Russell"] },
  MI: { id: "MI", philosophy: "Star systems", difficulty: "Demanding", aura: "#3d8bd4", description: "Elite expectations, strong Indian core and a relentless preference for match-winning ceilings.", strengths: ["Indian core", "Powerplay batting"], needs: ["Lead spinner", "Pace depth"], retainedCore: ["R. Sharma", "S. Yadav", "J. Bumrah"] },
  RCB: { id: "RCB", philosophy: "High-voltage attack", difficulty: "Challenging", aura: "#d05b62", description: "A pressure franchise where marquee ambition must finally become a balanced championship squad.", strengths: ["Top-order power", "Commercial pull"], needs: ["Death bowling", "Spin control"], retainedCore: ["V. Kohli", "R. Patidar", "Y. Dayal"] },
  CSK: { id: "CSK", philosophy: "Role clarity", difficulty: "Strategic", aura: "#d3ab42", description: "Experience, defined roles and tactical fit matter more here than winning every headline.", strengths: ["Role stability", "Spin matchups"], needs: ["Future captain", "Young quick"], retainedCore: ["R. Gaikwad", "R. Jadeja", "M. Pathirana"] },
  SRH: { id: "SRH", philosophy: "Maximum pressure", difficulty: "Aggressive", aura: "#ec7a33", description: "Explosive batting and high-risk pace make this a thrilling but budget-sensitive build.", strengths: ["Power hitting", "Strike pace"], needs: ["Anchor batter", "Domestic spinner"], retainedCore: ["H. Klaasen", "P. Cummins", "A. Sharma"] },
  RR: { id: "RR", philosophy: "Youth & value", difficulty: "Technical", aura: "#6793d4", description: "Scouting, development and value capture define a franchise designed to win ahead of the market.", strengths: ["Young batting", "Scouting network"], needs: ["Finisher", "Seam all-rounder"], retainedCore: ["Y. Jaiswal", "S. Samson", "R. Parag"] },
  DC: { id: "DC", philosophy: "Rebuild with intent", difficulty: "Hard", aura: "#56a0bd", description: "An open canvas with high upside—if you can solve leadership, balance and consistency together.", strengths: ["Young talent", "Auction flexibility"], needs: ["Captain", "Middle-order power"], retainedCore: ["A. Patel", "K. Yadav", "T. Stubbs"] },
  PBKS: { id: "PBKS", philosophy: "Market disruption", difficulty: "Expert", aura: "#d75c6d", description: "Purse power creates freedom, but disciplined squad construction is the real challenge.", strengths: ["Purse flexibility", "Pace options"], needs: ["Stable top order", "Lead keeper"], retainedCore: ["S. Iyer", "A. Singh", "S. Singh"] },
  LSG: { id: "LSG", philosophy: "Modern balance", difficulty: "Balanced", aura: "#52b8c6", description: "Multi-skilled players and adaptable matchups reward a GM who plans several moves ahead.", strengths: ["All-round depth", "Venue flexibility"], needs: ["Elite opener", "Left-arm pace"], retainedCore: ["N. Pooran", "R. Bishnoi", "M. Yadav"] },
  GT: { id: "GT", philosophy: "Calm efficiency", difficulty: "Strategic", aura: "#758e9d", description: "Low-noise, high-efficiency building with leadership, bowling control and clear role discipline.", strengths: ["Leadership", "Bowling structure"], needs: ["Finisher", "Wicketkeeper depth"], retainedCore: ["S. Gill", "R. Khan", "S. Sudharsan"] }
};
