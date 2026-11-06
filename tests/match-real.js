// The matcher against real lookups from Nick's art report (Nov 6). Each case: entry, what the card database returned, the card we want (or null).
global.window = { CTStore: { on() {}, all: () => [] }, CTSession: {}, CardLookup: {}, CardParser: require('../app/js/parser.js') }; global.document = {};
require('../app/js/artfill.js'); const W = window.CTArtFill;
const L = s => s.split('\n').map(x => x.trim()).filter(Boolean).map((x, i) => { const [n, num, set, r] = x.split(' · '); return { id: 'c' + i, n, num, s: set, r, g: /^(S\d|SV\d|M2|SV2a|SV4K|SV5a|SV1a|S11a|S12a|SV8|SV9|SV3)\b|: (Inferno|Pokemon Card 151|VSTAR Universe|Incandescent|Super Electric|Ancient Roar|Ruler of the|Crimson Haze|Battle Partners|Triplet Beat)/.test(set || '') ? 'Pokemon Japan' : 'x' }; });
const cases = [
 ['Ludicolo - 081/080 - M2: Inferno X', 'Ludicolo - 081/080 · 081/080 · M2: Inferno X · Art Rare', 0],
 ['Dragon Ball Super BT29-086 SS Rose Goku Black, Future of Despair SLR CGC 10 Pristine', `Goku Black // SS Rose Goku Black, Future of Despair · BT29-086 · Fearsome Rivals · Uncommon
  Goku Black // SS Rose Goku Black, Future of Despair · BT29-086 · Fearsome Rivals Release Event · Uncommon
  Goku Black // SS Rose Goku Black, Future of Despair (SLR) · BT29-086 · Fearsome Rivals · Special Leader Rare`, 2],
 ['Cooler, Armed Force - Championship Selection Pack 2023 Vol.1', `Cooler, Armed Force (Event Pack 16) · P-455 · Promotion Cards · Promo
  Cooler, Armed Force (Championship 2023 Reward Pack) · P-455 · Tournament Promotion Cards · Promo
  Cooler, Armed Force (Championship Selection Pack 2023 Vol.1) (Silver Foil) · P-455 · Tournament Promotion Cards · Promo
  Meta-Cooler Core, Giant Force · DB3-142 · Draft Box 06 - Giant Force · Giant Force Rare`, 2],
 ['Son Gohan, Self-Taught Truth (SPR) CGC 10 Pristine', `SS Son Gohan, Self-Taught Truth · BT23-011 · Perfect Combination · Super Rare
  SS Son Gohan, Self-Taught Truth (SPR) · BT23-011 · Perfect Combination · Special Rare
  SS Son Gohan, Self-Taught Combo Attack · BT23-013 · Perfect Combination · Common
  Son Gohan, True Self Revealed · BT22-092 · Critical Blow · Super Rare`, 1],
 ['Sword & Shield Promo Cards: Gengar - SWSH052 - SWSH', 'Gengar - SWSH052 · SWSH052 · SWSH: Sword & Shield Promo Cards · Promo', 0],
 ['Mew - 040 - Nintendo Promos', "Mew - 040 (Trainer's Challenge Set) · 040 · Nintendo Promos · Promo", 0],
 ['Lost Origin Trainer Gallery: Charizard - TG03/TG30 - SWSH11', `Octillery · TG03/TG30 · SWSH09: Brilliant Stars Trainer Gallery · Ultra Rare
  Kingdra · TG03/TG30 · SWSH10: Astral Radiance Trainer Gallery · Ultra Rare
  Charizard · TG03/TG30 · SWSH11: Lost Origin Trainer Gallery · Ultra Rare
  Flaaffy · TG03/TG30 · SWSH12: Silver Tempest Trainer Gallery · Ultra Rare`, 2],
 ['Premium Anniversary Box 2023: SS4 Son Goku & SS4 Vegeta, Radiant Fusion - EX23-45 - Expansion Deck Box Set 23', 'SS4 Son Goku & SS4 Vegeta, Radiant Fusion · EX23-45 · Expansion Deck Box Set 23: Premium Anniversary Box 2023 · Expansion Rare', 0],
 ['Realm of the Gods - BT16-018 - Realm of the Gods', `Realm of the Gods - Ultra Instinct (SPR) · BT16-018 · Realm of the Gods · Special Rare
  Realm of the Gods - Ultra Instinct · BT16-018 · Realm of the Gods Pre-Release Cards · Rare
  Realm of the Gods - Ultra Instinct · BT16-018 · Realm of the Gods · Rare`, 2],
 ['$75 TCGplayer/eBay gift card', 'Gift Card · TAEV-EN078 · Tactical Evolution · Common / Short Print', null],
 ['2000 Pokemon Card Team Rocket Dark Vileplume - 13/82 - 1', 'Dark Vileplume (13) · 13/82 · Team Rocket · Holo Rare', 0],
 ['Son Goku, Unwavering Conviction, History of Son Goku BGS 10 Pristine', `Son Goku, Unwavering Conviction · DB3-116 · Draft Box 06 - Giant Force · Rare
  Son Goku, Unwavering Conviction · DB3-116 · Theme Selection: History of Son Goku · Rare
  -History of Son Goku- Theme Selection · N/A · Theme Selection: History of Son Goku · None
  Nuova Shenron, Unwavering Conviction · P-305 · Promotion Cards · Promo`, 1],
 ["Rocket's Scyther - 123 - Japanese Pokemon Gym Heroes/Leaders' Stadium", 'Placide - Voodoo Sentinel · 123 · Welcome to Night City - Retail · Rare', null],
 ['Dragonair - 182/165 - SV2a: Pokemon Card 151', 'Dragonair - 182/165 · 182/165 · SV2a: Pokemon Card 151 · Art Rare', 0],
 ['Umbreon - SV: Prismatic Evolutions', 'Umbreon · 041/147 · Aquapolis · Rare', null],
 ['Jolteon - 169 SV: Scarlet & Violet Promo Cards, Pokemon, 169', 'Jolteon · 45/95 · Call of Legends · Uncommon', null],
 ['Trunks - BT16-071 - Collector\'s Selection Vol. 3', `Trunks // SSB Vegeta & SS Trunks, Father-Son Onslaught · BT16-071 · Collector's Selection Vol. 3 · Uncommon
  Trunks // SSB Vegeta & SS Trunks, Father-Son Onslaught · BT16-071 · Realm of the Gods Pre-Release Cards · Uncommon
  Trunks // SSB Vegeta & SS Trunks, Father-Son Onslaught · BT16-071 · Realm of the Gods · Uncommon`, 0],
 ['Bandai Dragon Ball Super Collectors Selection Vol. 3 Card Game', `Collector's Selection Vol. 3 · N/A · Collector's Selection Vol. 3 · None
  Premium Card Collection -Best Selection Vol. 3- · N/A · One Piece Promotion Cards · None`, 0],
 ['Realm of the Gods - Black Kamehameha', `Realm of the Gods Booster Box · N/A · Realm of the Gods · None
  Realm of the Gods Booster Pack · N/A · Realm of the Gods · None
  Realm of the Gods - Black Kamehameha · BT16-092 · Realm of the Gods Pre-Release Cards · Rare
  Realm of the Gods Pre-Release Pack · N/A · Realm of the Gods Pre-Release Cards · None`, 2],
 ['Evolving Skies: Evolving Skies Sleeved Booster Pack - SWSH07', `Evolving Skies Sleeved Booster Pack · N/A · SWSH07: Evolving Skies
  Evolving Skies Sleeved Booster Pack Bundle [Set of 8] · N/A · SWSH07: Evolving Skies
  Evolving Skies Booster Pack · N/A · SWSH07: Evolving Skies
  Evolving Skies Sleeved Booster Pack Art Bundle [Set of 4] · N/A · SWSH07: Evolving Skies`, 0],
 ["ragon Ball Super CCG - EX13-16 - Collector's Selection Vol. 3: Gotenks, the Grim Reaper of Justice", `Gotenks, the Grim Reaper of Justice · EX13-16 · Collector's Selection Vol. 3 · Expansion Rare
  Gotenks, the Grim Reaper of Justice · EX13-16 · Special Anniversary Set 2020 · Expansion Rare
  Gotenks, the Grim Reaper of Justice (Card Game Fest 2022) · EX13-16 · Tournament Promotion Cards · Promo`, 0],
 ['History of Vegeta: Protector of the People - DB2-159 - Theme Selection', `Protector of the People · DB2-159 · Draft Box 05 - Divine Multiverse · Super Rare
  Protector of the People · DB2-159 · Theme Selection: History of Vegeta · Super Rare`, 1],
 ['Broly - BT1-057 - Collector\'s Selection Vol. 1', `Broly // Broly, The Legendary Super Saiyan · BT1-057 · Collector's Selection Vol. 1 · Rare
  Broly // Broly, The Legendary Super Saiyan · BT1-057 · Galactic Battle · Rare`, 0],
 ['Neo Discovery - 31/75 - Tyranitar', `Manectric · 031/075 · Miracle Crystal · Holo Rare
  Tyranitar (31) · 31/75 · Neo Discovery · Rare`, 1],
 ['Base Set - 014/102 - Raichu', `Raichu · 014/102 · Base Set · Holo Rare
  Raichu · 014/102 · Base Set (Shadowless) · Holo Rare
  Salazzle · 014/102 · SV7: Stellar Miracle · Uncommon
  Banette · 14/102 · Triumphant · Rare`, 0],
 ['Fused Zamasu, Building a Utopia SPR x3, SS Son Gohan Self Taught Truth SPR', `Fused Zamasu, Building a Utopia (SPR) · BT23-136 · Perfect Combination · Special Rare
  Fused Zamasu, Building a Utopia · BT23-136 · Perfect Combination · Super Rare
  SS Son Gohan, Self-Taught Truth (SPR) · BT23-011 · Perfect Combination · Special Rare
  SS Son Gohan, Self-Taught Truth · BT23-011 · Perfect Combination · Super Rare`, null],
 ['SS Son Gohan, Self-Taught Truth (SPR) - Perfect Combination', `SS Son Gohan, Self-Taught Truth · BT23-011 · Perfect Combination · Super Rare
  SS Son Gohan, Self-Taught Truth (SPR) · BT23-011 · Perfect Combination · Special Rare`, 1],
 ['1998 Pokemon Japanese Starter Red Green Gift Holo Scyther #123', 'Placide - Voodoo Sentinel · 123 · Welcome to Night City - Retail · Rare', null],
 ['Raichu - 014/102 - Base Set', `Raichu · 014/102 · Base Set · Holo Rare
  Raichu · 014/102 · Base Set (Shadowless) · Holo Rare`, 0],
 ["Son Goku, Nimbus Master, Collector's Selection Vol. 2, CGC 10 Pristine", `Son Goku, Nimbus Master · DB3-003 · Collector's Selection Vol. 2 · Promo
  Son Goku, Nimbus Master · DB3-003 · Draft Box 06 - Giant Force · Super Rare
  Son Goku, Nimbus Master · DB3-003 · Mythic Booster · Super Rare
  Son Goku, Nimbus Master (Gold Stamped) · DB3-003 · Mythic Booster · Super Rare`, 0],
 ["Gengar SWSH052 - Pokemon Champion's Path Pin Collection", "Gengar - SWSH052 · SWSH052 · SWSH: Sword & Shield Promo Cards · Promo", 0],
 ['Umbreon - SV: Prismatic Evolutions', `Umbreon · 041/147 · Aquapolis · Rare
  Umbreon · 22/95 · Call of Legends · Holo Rare
  Umbreon ex · 060/131 · SV: Prismatic Evolutions · Double Rare
  Umbreon ex - 161/131 · 161/131 · SV: Prismatic Evolutions · Special Illustration Rare`, null],
 ['Umbreon ex - SV: Prismatic Evolutions', `Umbreon · 041/147 · Aquapolis · Rare
  Umbreon ex · 060/131 · SV: Prismatic Evolutions · Double Rare
  Umbreon ex - 161/131 · 161/131 · SV: Prismatic Evolutions · Special Illustration Rare`, null],
 ['Charizard', `Charizard · 4/102 · Base Set · Holo Rare
  Charizard · 006/165 · SV: 151 · Rare`, null],
 ['SS Son Gohan Self Taught Truth (SPR)', `SS Son Gohan, Self-Taught Truth · BT23-011 · Perfect Combination · Super Rare
  SS Son Gohan, Self-Taught Truth (SPR) · BT23-011 · Perfect Combination · Special Rare`, 1],
];
let pass = 0;
for (const [name, list, want] of cases) { const cards = L(list), e = { name }, p = W._parsed(e), got = W._clearMatch(cards, p, e);
  const ok = want === null ? !got : got && got.id === 'c' + want; if (ok) pass++;
  console.log((ok ? 'ok   ' : 'MISS ') + name.slice(0, 70).padEnd(72) + ' -> ' + (got ? got.n + ' · ' + got.s : 'none') + (ok ? '' : '   (wanted ' + (want === null ? 'none' : cards[want].n + ' · ' + cards[want].s) + ')')); }
console.log(pass + ' of ' + cases.length);
