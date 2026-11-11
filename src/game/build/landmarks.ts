// Build the Mall: the stars won in missions pay for rebuilding six Washington landmarks, one
// piece at a time. Each landmark is a chapter of its own, with a fixed order of jobs (the ground
// and the foundation before the walls, the walls before the roof), star costs that grow from the
// first landmark to the last, and big centerpieces (the Capitol's dome, Lincoln's statue) paid
// for in stages. Every job comes with one true thing about the building, which Uncle Sam says as
// it goes up. Accomplishments (medals and budget-desk badges) unlock each landmark's decoration.
// Stars never run out or expire: the balance is the stars won, less the stars spent.
//
// Facts are from the National Park Service, the Architect of the Capitol, the White House
// Historical Association, and the Treasury; each landmark lists its sources.

export type LandmarkId = 'monument' | 'lincoln' | 'jefferson' | 'treasury' | 'whitehouse' | 'capitol';

/** How a piece goes up: rises in courses, is lowered by the crane, pops up column by column,
 *  fills like water, is painted on in a sweep, or blooms. */
export type BuildKind = 'rise' | 'drop' | 'stagger' | 'fill' | 'paint' | 'bloom';

export interface Task {
  id: string; // `${landmark}:${part}`; the part is the piece of the drawing it builds
  part: string;
  label: string; // the job, as a button: "Lay the foundation"
  cost: number; // stars
  kind: BuildKind;
  /** What Uncle Sam says as it goes up: one true thing about this piece. */
  fact: string;
}

export interface Decor { id: string; label: string; need: number; kind: BuildKind; fact: string }

export interface Landmark {
  id: LandmarkId;
  name: string;
  short: string;
  /** Where it stands, and why it belongs in a game about the budget. */
  blurb: string;
  tasks: Task[];
  decor: Decor;
  /** The postcard when it's finished: three facts. */
  postcard: string[];
  sources: { label: string; url: string }[];
}

const T = (landmark: LandmarkId, part: string, label: string, cost: number, kind: BuildKind, fact: string): Task => ({ id: `${landmark}:${part}`, part, label, cost, kind, fact });

export const LANDMARKS: Landmark[] = [
  {
    id: 'monument', name: 'The Washington Monument', short: 'Washington Monument',
    blurb: 'The tall marble obelisk in the middle of the Mall, for the first president.',
    tasks: [
      T('monument', 'grounds', 'Clear the grounds', 1, 'rise', 'The monument stands a little south and east of the spot first planned for it: the ground there was swampy and unstable.'),
      T('monument', 'foundation', 'Lay the foundation', 1, 'rise', 'The cornerstone was laid on July 4, 1848.'),
      T('monument', 'shaft1', 'Raise the shaft to 152 feet', 1, 'rise', 'Work stopped in 1854 at about 152 feet, when the Washington National Monument Society ran out of money. It stood unfinished through the Civil War.'),
      T('monument', 'shaft2', 'Finish the shaft', 1, 'rise', 'In 1878 the Army Corps of Engineers took over, and first made the foundation stronger. The new marble came from a different quarry, so you can still see the color change about 150 feet up.'),
      T('monument', 'pyramidion', 'Set the pyramid on top', 1, 'drop', 'The pointed top is a marble pyramid 55 feet tall, set on a shaft 500 feet tall.'),
      T('monument', 'apex', 'Cap it with aluminum', 1, 'drop', 'On December 6, 1884, workers set the capstone, tipped with a small pyramid of solid aluminum weighing 100 ounces.'),
    ],
    decor: { id: 'monument:flags', label: 'Raise the ring of 50 flags', need: 1, kind: 'bloom', fact: 'Fifty U.S. flags fly in a circle around the base, for the fifty states.' },
    postcard: [
      'Finished in 1884 and just over 555 feet tall, it was the tallest structure in the world until the Eiffel Tower, in 1889.',
      'Its construction stopped for more than twenty years; the color change in the marble shows where.',
      'It opened to the public in 1888.',
    ],
    sources: [
      { label: 'National Park Service: building the Washington Monument', url: 'https://www.nps.gov/wamo/learn/historyculture/monumentconstruction.htm' },
      { label: 'National Park Service: the aluminum capstone', url: 'https://www.nps.gov/articles/000/wamocap.htm' },
      { label: 'National Park Service: Washington Monument FAQ', url: 'https://www.nps.gov/wamo/faqs.htm' },
    ],
  },
  {
    id: 'lincoln', name: 'The Lincoln Memorial', short: 'Lincoln Memorial',
    blurb: 'The Greek temple at the west end of the Mall, with the Reflecting Pool in front.',
    tasks: [
      T('lincoln', 'terrace', 'Build the terrace and the steps', 1, 'rise', 'The memorial stands on land the Army Corps of Engineers built up from Potomac River mud flats. Its foundations reach bedrock 44 to 65 feet down.'),
      T('lincoln', 'hall', 'Raise the walls of the hall', 1, 'rise', 'Architect Henry Bacon designed the memorial. Ground was broken on February 12, 1914, Lincoln’s birthday.'),
      T('lincoln', 'colsA', 'Raise the first 18 columns', 1, 'stagger', 'There are 36 columns, one for each state in the Union when Lincoln died.'),
      T('lincoln', 'colsB', 'Raise the last 18 columns', 1, 'stagger', 'All 36 columns are up. The frieze above them carries the names of those 36 states.'),
      T('lincoln', 'attic', 'Carve the names of the 48 states', 1, 'rise', 'Higher up, the attic carries the names of the 48 states of 1922, the year the memorial was dedicated.'),
      T('lincoln', 'statue', 'Seat the statue of Lincoln', 2, 'drop', 'Daniel Chester French designed the statue, and the Piccirilli brothers carved it from 28 blocks of white Georgia marble. It is 19 feet tall.'),
      T('lincoln', 'pool', 'Fill the Reflecting Pool', 2, 'fill', 'The Reflecting Pool, finished in 1924, stretches about 2,000 feet east toward the Washington Monument.'),
    ],
    decor: { id: 'lincoln:lights', label: 'Light it at night', need: 3, kind: 'bloom', fact: 'At night the memorial is lit up at the end of the pool.' },
    postcard: [
      'The memorial was dedicated on May 30, 1922.',
      'The words of the Gettysburg Address and Lincoln’s Second Inaugural Address are carved on its inside walls.',
      'Alaska and Hawaii, which became states later, are named on a plaque on the plaza below the steps.',
    ],
    sources: [
      { label: 'National Park Service: the Lincoln Memorial’s exterior', url: 'https://www.nps.gov/linc/learn/historyculture/exterior-features.htm' },
      { label: 'National Park Service: making the Lincoln Memorial', url: 'https://www.nps.gov/linc/learn/historyculture/the-making-of-the-lincoln-memorial.htm' },
      { label: 'National Park Service: the Reflecting Pool', url: 'https://www.nps.gov/places/000/lincoln-memorial-reflecting-pool.htm' },
    ],
  },
  {
    id: 'jefferson', name: 'The Jefferson Memorial', short: 'Jefferson Memorial',
    blurb: 'The round, domed memorial on the Tidal Basin, south of the Washington Monument.',
    tasks: [
      T('jefferson', 'platform', 'Build the platform on the Tidal Basin', 1, 'rise', 'The memorial stands on the south bank of the Tidal Basin, in a straight line with the White House to the north. Part of the basin was filled in to line it up.'),
      T('jefferson', 'colonnade', 'Raise the ring of columns', 2, 'stagger', 'Its ring has 26 columns. John Russell Pope’s design follows the Pantheon in Rome, which also shaped Jefferson’s own Monticello and the University of Virginia Rotunda.'),
      T('jefferson', 'portico', 'Build the portico', 1, 'rise', 'President Franklin Roosevelt laid the cornerstone on November 15, 1939.'),
      T('jefferson', 'dome', 'Close the dome', 2, 'rise', 'The memorial was dedicated on April 13, 1943, Jefferson’s 200th birthday.'),
      T('jefferson', 'statue', 'Set the bronze statue', 1, 'drop', 'During the war, metal was scarce, so a plaster statue painted the color of bronze stood here first. The 19-foot bronze went in in 1947.'),
    ],
    decor: { id: 'jefferson:blossoms', label: 'Plant the cherry trees', need: 5, kind: 'bloom', fact: 'The cherry trees around the Tidal Basin were a gift of about 3,000 trees from the city of Tokyo. The first two were planted in 1912.' },
    postcard: [
      'Words from the Declaration of Independence are carved on its inside walls.',
      'It faces north, toward the White House.',
      'Each spring the cherry trees around it bloom.',
    ],
    sources: [
      { label: 'National Park Service: building the Jefferson Memorial', url: 'https://www.nps.gov/thje/learn/historyculture/memorialconstruction.htm' },
      { label: 'National Park Service: the memorial’s features', url: 'https://www.nps.gov/thje/learn/historyculture/memorialfeatures.htm' },
      { label: 'National Park Service: history of the cherry trees', url: 'https://www.nps.gov/subjects/cherryblossom/history-of-the-cherry-trees.htm' },
    ],
  },
  {
    id: 'treasury', name: 'The Treasury Building', short: 'Treasury Building',
    blurb: 'Next door to the White House: the home of the Department of the Treasury, which collects and pays the government’s money.',
    tasks: [
      T('treasury', 'east', 'Build the east wing', 1, 'rise', 'The building went up in stages, starting in 1836 with the east and center wings, designed by Robert Mills.'),
      T('treasury', 'colonnade', 'Raise the long colonnade', 2, 'stagger', 'The east front, on 15th Street, has 30 granite columns, each 36 feet tall and cut from a single block.'),
      T('treasury', 'south', 'Add the south wing', 1, 'rise', 'The south, west and north wings followed, one after another.'),
      T('treasury', 'north', 'Add the west and north wings', 1, 'rise', 'The north wing, the last, was finished in 1869, more than thirty years after the first stone.'),
      T('treasury', 'roof', 'Top it with the balustrade', 1, 'rise', 'This is where the money of the federal government is managed: taxes coming in, bills going out, and the debt.'),
    ],
    decor: { id: 'treasury:hamilton', label: 'Set up the statue of Hamilton', need: 7, kind: 'drop', fact: 'A statue of Alexander Hamilton, the first Secretary of the Treasury, stands on the south plaza. It was dedicated in 1923.' },
    postcard: [
      'It is the oldest departmental building in Washington, built in stages from 1836 to 1869.',
      'Its Cash Room, finished in 1869, hosted President Grant’s inaugural celebration that March.',
      'The Treasury collects the government’s taxes, pays its bills, and borrows when the two don’t match.',
    ],
    sources: [
      { label: 'U.S. Treasury: history of the Treasury', url: 'https://home.treasury.gov/about/history/history-overview/history-of-the-treasury' },
      { label: 'U.S. Treasury: the east wing and colonnade', url: 'https://home.treasury.gov/east-wing-architecture-and-colonnade' },
      { label: 'U.S. Treasury: the Hamilton statue', url: 'https://home.treasury.gov/south-plaza-hamilton-statue' },
    ],
  },
  {
    id: 'whitehouse', name: 'The White House', short: 'White House',
    blurb: 'The president’s house, north of the Washington Monument, where each year’s budget request begins.',
    tasks: [
      T('whitehouse', 'walls', 'Raise the sandstone walls', 1, 'rise', 'James Hoban designed the house. The cornerstone was laid on October 13, 1792.'),
      T('whitehouse', 'paint', 'Paint it white', 1, 'paint', 'In 1798 the sandstone walls got a coat of lime whitewash, to protect them. The name White House stuck, and in 1901 Theodore Roosevelt made it official.'),
      T('whitehouse', 'roof', 'Put on the roof', 1, 'rise', 'John Adams was the first president to live here, starting on November 1, 1800.'),
      T('whitehouse', 'rebuild', 'Rebuild after the fire', 1, 'rise', 'British troops burned the house in August 1814, during the War of 1812. James Hoban rebuilt it in a little less than three years.'),
      T('whitehouse', 'portico', 'Add the South Portico', 2, 'stagger', 'The round South Portico, with its columns, was added in 1824.'),
      T('whitehouse', 'flag', 'Raise the flag', 1, 'drop', 'Each year the president sends Congress a budget request: the first step toward a federal budget.'),
    ],
    decor: { id: 'whitehouse:fountain', label: 'Turn on the South Lawn fountain', need: 9, kind: 'bloom', fact: 'A fountain plays on the South Lawn, in front of the portico.' },
    postcard: [
      'Every president since John Adams has lived here.',
      'It was burned in 1814 and rebuilt.',
      'The president’s budget request starts here and goes to Congress, which writes the budget into law.',
    ],
    sources: [
      { label: 'White House Historical Association: building the White House', url: 'https://www.whitehousehistory.org/building-the-white-house' },
      { label: 'White House Historical Association: why is the White House white?', url: 'https://www.whitehousehistory.org/questions/why-is-the-white-house-white' },
      { label: 'White House Historical Association: architecture, 1790s–1840s', url: 'https://www.whitehousehistory.org/architecture-1790s-1840s' },
    ],
  },
  {
    id: 'capitol', name: 'The U.S. Capitol', short: 'Capitol',
    blurb: 'Congress’s home, at the east end of the Mall, where every federal dollar is approved.',
    tasks: [
      T('capitol', 'base', 'Lay the cornerstone and the terrace', 1, 'rise', 'George Washington laid the cornerstone on September 18, 1793. The design was by William Thornton.'),
      T('capitol', 'north', 'Build the north wing, for the Senate', 1, 'rise', 'Congress first met here on November 17, 1800, in the north wing, then the only part finished. It held the Senate, the House, the Supreme Court and the Library of Congress.'),
      T('capitol', 'south', 'Build the south wing, for the House', 1, 'rise', 'The House moved into its new chamber in the south wing in 1807.'),
      T('capitol', 'center', 'Join them with a center and a low dome', 2, 'rise', 'British troops burned the Capitol in 1814. Charles Bulfinch finished the rebuilt center in 1826, under a low wooden dome covered in copper.'),
      T('capitol', 'wings', 'Extend it with new chambers', 2, 'rise', 'Congress grew with the country and outgrew its rooms. Thomas U. Walter’s new wings opened for the House in 1857 and the Senate in 1859.'),
      T('capitol', 'drum', 'Raise the dome’s ring of columns', 2, 'stagger', 'The old dome came down, and a new one of cast iron went up in its place, starting in 1855.'),
      T('capitol', 'dome', 'Close the cast-iron dome', 3, 'rise', 'The new dome holds almost 9 million pounds of iron. Work went on through the Civil War; Lincoln called it a sign that the Union would go on.'),
      T('capitol', 'freedom', 'Crown it with the Statue of Freedom', 2, 'drop', 'The Statue of Freedom, by Thomas Crawford, was set on top of the dome on December 2, 1863. Philip Reid, an enslaved worker at the foundry, worked out how to take apart its plaster model so it could be cast in bronze.'),
    ],
    decor: { id: 'capitol:fireworks', label: 'Celebrate the Fourth of July', need: 12, kind: 'bloom', fact: 'Every Fourth of July, fireworks light up the sky over the Mall.' },
    postcard: [
      'Every federal dollar spent, and every tax collected, starts as a bill passed here.',
      'The Senate meets in the north wing and the House in the south.',
      'Its dome is made of cast iron, painted white.',
    ],
    sources: [
      { label: 'Architect of the Capitol: history of the Capitol', url: 'https://www.aoc.gov/explore-capitol-campus/buildings-grounds/capitol-building/history' },
      { label: 'Architect of the Capitol: the dome', url: 'https://www.aoc.gov/explore-capitol-campus/buildings-grounds/capitol-building/capitol-dome' },
      { label: 'Architect of the Capitol: Philip Reid and the Statue of Freedom', url: 'https://www.aoc.gov/explore-capitol-campus/blog/philip-reid-and-statue-freedom' },
      { label: 'U.S. Senate: the dome as a national symbol', url: 'https://www.senate.gov/about/historic-buildings-spaces/capitol/dome-national-symbol.htm' },
    ],
  },
];

/** What Uncle Sam says on the Mall's page. */
export const BUILD_LINES = {
  fresh: 'Every star you win in a mission pays for one piece of a landmark. Let’s rebuild the National Mall, starting with the Washington Monument.',
  done: 'You rebuilt the whole Mall, from the Lincoln Memorial to the Capitol. Every piece was paid for with stars you earned.',
  next: (name: string) => `Here’s your Mall so far. Next up: the ${name}.`,
};

export const LANDMARK_BY_ID = Object.fromEntries(LANDMARKS.map((l) => [l.id, l])) as Record<LandmarkId, Landmark>;
export const ALL_TASKS = LANDMARKS.flatMap((l) => l.tasks);
export const TOTAL_COST = ALL_TASKS.reduce((a, t) => a + t.cost, 0);

// ---------- the ledger ----------

export interface BuildState { built: string[]; decor: string[] }

/** Stars won (the best on every mission), less the stars spent on building. */
export function starsWon(stars: Record<string, number>) { return Object.values(stars).reduce((a, n) => a + n, 0); }
export function starsSpent(built: string[]) { return ALL_TASKS.filter((t) => built.includes(t.id)).reduce((a, t) => a + t.cost, 0); }
export const balanceOf = (stars: Record<string, number>, built: string[]) => Math.max(0, starsWon(stars) - starsSpent(built));

export const doneCount = (l: Landmark, built: string[]) => l.tasks.filter((t) => built.includes(t.id)).length;
export const isComplete = (l: Landmark, built: string[]) => doneCount(l, built) === l.tasks.length;
/** The next job on a landmark: the first one not built yet (they go in order). */
export const nextTask = (l: Landmark, built: string[]) => l.tasks.find((t) => !built.includes(t.id)) ?? null;
/** A landmark opens when the one before it is finished. */
export function isOpen(l: Landmark, built: string[]) {
  const i = LANDMARKS.indexOf(l);
  return i === 0 || isComplete(LANDMARKS[i - 1], built);
}
/** The landmark being worked on: the first open one that isn't finished. */
export const currentLandmark = (built: string[]) => LANDMARKS.find((l) => !isComplete(l, built)) ?? null;
export const mallComplete = (built: string[]) => LANDMARKS.every((l) => isComplete(l, built));

/** Each part of a landmark's drawing: built, the next to build, or still only on the plans. */
export type PartState = 'built' | 'next' | 'plan';
export function partStates(l: Landmark, built: string[]): Record<string, PartState> {
  const nx = nextTask(l, built);
  const out: Record<string, PartState> = {};
  for (const t of l.tasks) out[t.part] = built.includes(t.id) ? 'built' : nx?.id === t.id && isOpen(l, built) ? 'next' : 'plan';
  return out;
}
