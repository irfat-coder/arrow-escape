import * as THREE from 'three';
import { whoIsPlaying, signIn, saveRun, readLeaderboard, FALLBACK_GUEST } from './startng.js';
import { buildCharacter, animateCharacter, react } from './character.js';
import { generateLevel, firstBlocker, DIRS } from './levels.js';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const ui = {
  card: $('player-card'),
  face: $('player-face'),
  name: $('player-name'),
  account: $('player-account'),
  signInBtn: $('player-sign-in'),
  level: $('hud-level'),
  score: $('hud-score'),
  hearts: $('hud-hearts'),
  left: $('hud-left'),
  start: $('start-screen'),
  startSignIn: $('start-sign-in'),
  playBtn: $('play-btn'),
  toast: $('toast'),
  over: $('over-screen'),
  overStats: $('over-stats'),
  overSave: $('over-save'),
  overBoard: $('over-board'),
  againBtn: $('again-btn'),
  restartBtn: $('restart-btn'),
  boardBtn: $('board-btn'),
  boardScreen: $('board-screen'),
  boardList: $('board-list'),
  boardClose: $('board-close'),
};

// ---------- Player (from start.ng) ----------
let who = null;
let styleKey = '';

async function refreshPlayer() {
  who = await whoIsPlaying();
  const p = who.player;
  ui.name.textContent = p.name ?? 'Guest';
  ui.account.textContent = who.signedIn && who.account ? `@${who.account}` : 'Not signed in';
  if (p.face) ui.face.src = p.face;
  ui.face.hidden = !p.face;
  ui.signInBtn.hidden = who.signedIn;
  ui.card.hidden = false;
  const playingAsGuest = new URLSearchParams(location.search).has('guest');
  ui.startSignIn.hidden = who.signedIn || playingAsGuest;

  // The character (and the arrow colour) come from the central start.ng style.
  const key = JSON.stringify(p.style ?? {});
  if (key !== styleKey) {
    styleKey = key;
    setCharacter(p.style);
    paintArrows(p.style);
  }
}

ui.signInBtn.onclick = signIn;
ui.startSignIn.onclick = signIn;
addEventListener('focus', refreshPlayer);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPlayer();
});

// ---------- Three.js scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1f201a');
scene.fog = new THREE.Fog('#1f201a', 18, 40);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight('#fffefa', '#3a3b30', 1.4));
const sun = new THREE.DirectionalLight('#ffffff', 2.2);
sun.position.set(-5, 12, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(30, 48),
  new THREE.MeshStandardMaterial({ color: '#2a2b23', roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.31;
floor.receiveShadow = true;
scene.add(floor);

const boardGroup = new THREE.Group();
scene.add(boardGroup);

let character = null;
function setCharacter(style) {
  if (character) scene.remove(character);
  character = buildCharacter(style);
  placeCharacter();
  scene.add(character);
}

// ---------- Arrow pieces ----------
function arrowShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.34);
  s.lineTo(0.26, 0.05);
  s.lineTo(0.1, 0.05);
  s.lineTo(0.1, -0.3);
  s.lineTo(-0.1, -0.3);
  s.lineTo(-0.1, 0.05);
  s.lineTo(-0.26, 0.05);
  s.closePath();
  return s;
}
const blockGeo = new THREE.BoxGeometry(0.86, 0.36, 0.86);
const glyphGeo = new THREE.ExtrudeGeometry(arrowShape(), { depth: 0.06, bevelEnabled: false });
glyphGeo.rotateX(-Math.PI / 2);
const blockMat = new THREE.MeshStandardMaterial({ color: '#d8fd71', roughness: 0.45 });
const glyphMat = new THREE.MeshStandardMaterial({ color: '#292a23', roughness: 0.6 });
const hoverMat = new THREE.MeshStandardMaterial({ color: '#fffefa', roughness: 0.45, emissive: '#555555' });
const tileMat = new THREE.MeshStandardMaterial({ color: '#3b3d31', roughness: 0.9 });
const tileGeo = new THREE.BoxGeometry(0.96, 0.2, 0.96);

// Arrow blocks wear the player's top colour, with a readable arrow on top.
function paintArrows(style) {
  const c = new THREE.Color(style?.primaryColor && /^#[0-9a-f]{6}$/i.test(style.primaryColor) ? style.primaryColor : '#d8fd71');
  blockMat.color.copy(c);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  glyphMat.color.set(lum > 0.45 ? '#292a23' : '#fffefa');
}

// ---------- Game state ----------
const game = {
  level: 1,
  score: 0,
  hearts: 3,
  size: 4,
  arrows: [],
  playing: false,
  busy: 0,
  salt: 0,
};

const cellPos = (x, y) => {
  const half = (game.size - 1) / 2;
  return new THREE.Vector3(x - half, 0, y - half);
};

function buildBoard() {
  boardGroup.clear();
  const { size, arrows } = generateLevel(game.level, game.salt);
  game.size = size;
  game.arrows = arrows;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = new THREE.Mesh(tileGeo, tileMat);
      tile.position.copy(cellPos(x, y)).setY(-0.2);
      tile.receiveShadow = true;
      boardGroup.add(tile);
    }
  }

  for (const a of arrows) {
    const piece = new THREE.Group();
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.castShadow = true;
    block.receiveShadow = true;
    const glyph = new THREE.Mesh(glyphGeo, glyphMat);
    glyph.position.y = 0.18;
    piece.add(block, glyph);
    piece.position.copy(cellPos(a.x, a.y));
    piece.rotation.y = DIRS[a.dir].angle;
    piece.userData.arrow = a;
    block.userData.arrow = a;
    glyph.userData.arrow = a;
    a.piece = piece;
    a.block = block;
    boardGroup.add(piece);
  }

  placeCharacter();
  fitCamera();
  updateHud();
}

const isPortrait = () => innerWidth / innerHeight < 0.85;

function placeCharacter() {
  if (!character) return;
  const half = game.size / 2;
  character.scale.setScalar(isPortrait() ? 1 : 1.25);
  if (isPortrait()) {
    // Phones: stand in front of the board, facing the player.
    character.position.set(0, -0.3, half + 2.1);
    character.rotation.y = 0;
  } else {
    character.position.set(half + 1.3, -0.3, half - 0.8);
    character.rotation.y = -0.45;
  }
}

function fitCamera() {
  const aspect = innerWidth / innerHeight;
  const portrait = isPortrait();
  const width = game.size + (portrait ? 1.2 : 4); // board plus room for the character
  const depth = game.size + (portrait ? 5.5 : 1.5);
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const dist = Math.max(width / 2 / Math.tan(hfov / 2), depth / 2 / Math.tan(vfov / 2)) * 1.15 + 1.5;
  const cx = portrait ? 0 : 1;
  const cz = portrait ? 1.6 : 0.2;
  camera.position.set(cx, dist * 0.72, cz + dist * 0.7);
  camera.lookAt(cx, 0.3, cz);
}

function updateHud() {
  ui.level.textContent = game.level;
  ui.score.textContent = game.score;
  ui.hearts.textContent = '♥'.repeat(game.hearts) + '♡'.repeat(Math.max(0, 3 - game.hearts));
  ui.left.textContent = game.arrows.filter((a) => !a.gone).length;
}

function toast(text, ms = 1400) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

// ---------- Tweens ----------
const tweens = [];
function tween(duration, onUpdate, onDone) {
  tweens.push({ t: 0, duration, onUpdate, onDone });
}
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// ---------- Moves ----------
function tapArrow(a) {
  if (!game.playing || a.gone || a.bumping) return;
  const blocker = firstBlocker(game.arrows, a, game.size);
  const { dx, dy } = DIRS[a.dir];
  const start = a.piece.position.clone();

  if (!blocker) {
    a.gone = true;
    game.score += 10;
    react(character, 'happy');
    const end = start.clone().add(new THREE.Vector3(dx, 0, dy).multiplyScalar(game.size + 2));
    game.busy++;
    tween(
      0.45,
      (k) => {
        a.piece.position.lerpVectors(start, end, easeInOut(k));
        a.piece.position.y = Math.sin(k * Math.PI) * 0.4;
        const s = 1 - Math.max(0, k - 0.6) * 2.4;
        a.piece.scale.setScalar(Math.max(s, 0.01));
      },
      () => {
        boardGroup.remove(a.piece);
        game.busy--;
        checkCleared();
      }
    );
  } else {
    // Bump into the blocker and come back; lose a heart.
    game.hearts--;
    react(character, 'oops');
    const gap = Math.abs(blocker.x - a.x) + Math.abs(blocker.y - a.y) - 1;
    const bump = new THREE.Vector3(dx, 0, dy).multiplyScalar(gap + 0.18);
    a.bumping = true;
    a.block.material = new THREE.MeshStandardMaterial({ color: '#ff5d5d', roughness: 0.45 });
    game.busy++;
    tween(
      0.35,
      (k) => a.piece.position.copy(start).addScaledVector(bump, Math.sin(k * Math.PI)),
      () => {
        a.piece.position.copy(start);
        a.block.material = blockMat;
        a.bumping = false;
        game.busy--;
        if (game.hearts <= 0) gameOver();
      }
    );
    const bStart = blocker.piece.position.clone();
    tween(0.3, (k) => {
      blocker.piece.position.copy(bStart).addScaledVector(new THREE.Vector3(dx, 0, dy), Math.sin(k * Math.PI * 3) * 0.06 * (1 - k));
    });
    toast(game.hearts > 0 ? 'Blocked! −1 ♥' : 'Out of hearts');
  }
  updateHud();
}

function checkCleared() {
  if (!game.playing) return;
  if (game.arrows.every((a) => a.gone) && game.busy === 0) {
    const bonus = game.level * 25 + game.hearts * 20;
    game.score += bonus;
    react(character, 'cheer');
    toast(`Level ${game.level} cleared! +${bonus}`, 1800);
    game.level++;
    game.hearts = 3;
    game.salt = 0;
    game.playing = false;
    updateHud();
    setTimeout(() => {
      buildBoard();
      game.playing = true;
    }, 1700);
  }
}

async function gameOver() {
  game.playing = false;
  const cleared = game.level - 1;
  ui.overStats.textContent = `Levels cleared: ${cleared} · Score: ${game.score}`;
  ui.overSave.textContent = '';
  ui.overBoard.replaceChildren();
  ui.over.hidden = false;

  if (who?.signedIn) {
    ui.overSave.textContent = 'Saving your run…';
    const saved = await saveRun({ level: cleared, score: game.score });
    if (saved?.ok) {
      ui.overSave.textContent = saved.result.improved
        ? `New best! You're #${saved.result.rank}`
        : `Not your best this time (you're #${saved.result.rank})`;
    } else {
      ui.overSave.textContent = saved?.error ?? 'Could not save your run right now.';
    }
  } else {
    ui.overSave.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'link';
    btn.textContent = 'Sign in with start.ng to save your score';
    btn.onclick = signIn;
    ui.overSave.append(btn);
  }
  fillBoard(ui.overBoard, 5);
}

async function fillBoard(listEl, limit) {
  listEl.replaceChildren();
  const data = await readLeaderboard(limit);
  if (!data?.ok || !data.entries?.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = data?.ok ? 'No scores yet. Be the first!' : 'Leaderboard shows up once the game is live on start.ng.';
    listEl.append(li);
    return;
  }
  for (const e of data.entries) {
    const li = document.createElement('li');
    if (who?.id && e.player_id === who.id) li.className = 'me';
    const dot = document.createElement('i');
    dot.style.background = e.color ?? '#d8fd71';
    const level = e.stats?.level ?? e.score;
    const score = e.stats?.score ?? '';
    li.append(`#${e.rank} `, dot, ` ${e.name} — level ${level}${score !== '' ? `, ${score} pts` : ''}`);
    listEl.append(li);
  }
}

function newRun() {
  game.level = 1;
  game.score = 0;
  game.hearts = 3;
  game.salt = Math.floor(Math.random() * 1000);
  buildBoard();
  game.playing = true;
}

ui.playBtn.onclick = () => {
  ui.start.hidden = true;
  newRun();
};
ui.againBtn.onclick = () => {
  ui.over.hidden = true;
  newRun();
};
ui.restartBtn.onclick = () => {
  if (!game.playing || game.busy) return;
  game.hearts = 3;
  game.salt++;
  buildBoard();
  toast('New board, same level');
};
ui.boardBtn.onclick = () => {
  ui.boardScreen.hidden = false;
  fillBoard(ui.boardList, 10);
};
ui.boardClose.onclick = () => (ui.boardScreen.hidden = true);

// ---------- Input ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

function pickArrow(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(boardGroup.children, true);
  const hit = hits.find((h) => h.object.userData.arrow && !h.object.userData.arrow.gone);
  return hit?.object.userData.arrow ?? null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  const a = pickArrow(e);
  if (a) tapArrow(a);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const a = pickArrow(e);
  if (hovered && hovered !== a && hovered.block.material === hoverMat) hovered.block.material = blockMat;
  hovered = a;
  if (a && a.block.material === blockMat) {
    hoverMat.color.copy(blockMat.color).offsetHSL(0, 0, 0.12);
    a.block.material = hoverMat;
  }
  renderer.domElement.style.cursor = a ? 'pointer' : 'default';
});

// ---------- Loop ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  placeCharacter();
  fitCamera();
}
addEventListener('resize', resize);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(tw.t / tw.duration, 1);
    tw.onUpdate(k);
    if (k >= 1) {
      tweens.splice(i, 1);
      tw.onDone?.();
    }
  }
  if (character) animateCharacter(character, dt, t);
  renderer.render(scene, camera);
});

// ---------- Start ----------
// Show the default look straight away; refreshPlayer() swaps in the real one.
setCharacter(FALLBACK_GUEST.style);
paintArrows(FALLBACK_GUEST.style);
styleKey = JSON.stringify(FALLBACK_GUEST.style);
buildBoard(); // a preview board behind the start screen
resize();
refreshPlayer();
