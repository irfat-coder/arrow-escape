// Level generator. Every board it makes can be cleared.
//
// How: arrows are placed one at a time, and each new arrow must have a clear
// path to the edge at the moment it is placed. Removing them in the reverse
// order is then always possible, so at least one solution exists.

export const DIRS = {
  up: { dx: 0, dy: -1, angle: 0 },
  right: { dx: 1, dy: 0, angle: -Math.PI / 2 },
  down: { dx: 0, dy: 1, angle: Math.PI },
  left: { dx: -1, dy: 0, angle: Math.PI / 2 },
};
const DIR_NAMES = Object.keys(DIRS);

// Small seeded random generator so a level number always gives the same board.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function levelSettings(level) {
  const size = Math.min(4 + Math.floor((level - 1) / 2), 8); // 4x4 up to 8x8
  const density = Math.min(0.5 + level * 0.04, 0.85); // fuller boards later
  return { size, target: Math.round(size * size * density) };
}

// Returns the first arrow in the way, or null if the path to the edge is clear.
export function firstBlocker(arrows, arrow, size) {
  const { dx, dy } = DIRS[arrow.dir];
  let x = arrow.x + dx;
  let y = arrow.y + dy;
  while (x >= 0 && y >= 0 && x < size && y < size) {
    const hit = arrows.find((a) => a !== arrow && !a.gone && a.x === x && a.y === y);
    if (hit) return hit;
    x += dx;
    y += dy;
  }
  return null;
}

export function generateLevel(level, salt = 0) {
  const { size, target } = levelSettings(level);
  const rand = mulberry32(level * 7919 + salt * 104729 + 13);
  const arrows = [];
  const occupied = new Set();
  let attempts = 0;

  while (arrows.length < target && attempts < 2000) {
    attempts++;
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    if (occupied.has(`${x},${y}`)) continue;

    // Try the directions in a random order; keep the first one with a clear path.
    const order = [...DIR_NAMES].sort(() => rand() - 0.5);
    for (const dir of order) {
      const candidate = { x, y, dir };
      if (!firstBlocker(arrows, candidate, size)) {
        arrows.push(candidate);
        occupied.add(`${x},${y}`);
        break;
      }
    }
  }

  return { size, arrows: arrows.map((a, i) => ({ ...a, id: i, gone: false })) };
}

// Note: removing an arrow only ever clears paths, never blocks new ones, so a
// board that starts solvable stays solvable whatever order the player taps in.
