// Builds a low-poly 3D version of the player's start.ng character from `style`.
// Every colour and part comes from start.ng, so the character looks like it does there.
import * as THREE from 'three';

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const colour = (value, fallback) => (HEX.test(value ?? '') ? value : fallback);

// Fills in anything missing or unknown (start.ng may add options later).
export function normaliseStyle(style = {}) {
  const s = style ?? {};
  return {
    body: pick(s.body, ['female', 'male'], 'female'),
    primaryColor: colour(s.primaryColor, '#d8fd71'),
    secondaryColor: colour(s.secondaryColor, '#292a23'),
    skinColor: colour(s.skinColor, '#c68642'),
    hairColor: colour(s.hairColor, '#1b1410'),
    hair: pick(s.hair, ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'], 'short'),
    hat: pick(s.hat, ['none', 'cap', 'beanie', 'tophat', 'crown'], 'none'),
    accessory: pick(s.accessory, ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'], 'none'),
  };
}

const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra });

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function buildCharacter(rawStyle) {
  const s = normaliseStyle(rawStyle);
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that bobs and jumps
  root.add(body);

  const top = mat(s.primaryColor);
  const bottom = mat(s.secondaryColor);
  const skin = mat(s.skinColor);
  const hair = mat(s.hairColor);
  const dark = mat('#1d1d1b');

  // Legs, or a skirt for the female body.
  const legs = new THREE.Group();
  if (s.body === 'female') {
    legs.add(mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.55, 12), bottom, 0, 0.62, 0));
    legs.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8), skin, -0.12, 0.2, 0));
    legs.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8), skin, 0.12, 0.2, 0));
  } else {
    legs.add(mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 8), bottom, -0.13, 0.4, 0));
    legs.add(mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 8), bottom, 0.13, 0.4, 0));
  }
  legs.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24), dark, -0.13, 0.04, 0.04));
  legs.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24), dark, 0.13, 0.04, 0.04));
  body.add(legs);

  // Torso (the top colour).
  const torsoWidth = s.body === 'female' ? 0.26 : 0.3;
  body.add(mesh(new THREE.CapsuleGeometry(torsoWidth, 0.42, 6, 12), top, 0, 1.12, 0));

  // Arms on pivots at the shoulders so they can wave.
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (torsoWidth + 0.1), 1.38, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.08, 0.38, 4, 8), top, 0, -0.26, 0));
    pivot.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), skin, 0, -0.55, 0));
    pivot.rotation.z = side * 0.12;
    body.add(pivot);
    arms.push(pivot);
  }

  // Head.
  const head = new THREE.Group();
  head.position.set(0, 1.85, 0);
  body.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 8), skin, 0, -0.3, 0)); // neck
  head.add(mesh(new THREE.SphereGeometry(0.3, 20, 16), skin));
  head.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), dark, -0.1, 0.03, 0.27));
  head.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), dark, 0.1, 0.03, 0.27));
  const smile = mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), dark, 0, -0.08, 0.27);
  smile.rotation.z = Math.PI;
  head.add(smile);

  addHair(head, s.hair, hair);
  addHat(head, s.hat, top, bottom);
  addAccessory(head, body, s.accessory, { hair, top, bottom, dark });

  root.userData = { body, head, arms, style: s, mood: null, moodTime: 0 };
  return root;
}

function addHair(head, type, hair) {
  const cap = (scale = 1) => {
    const m = mesh(new THREE.SphereGeometry(0.315 * scale, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), hair);
    m.rotation.x = -0.4; // tilted back so the face stays visible
    m.position.y = 0.02;
    return m;
  };
  switch (type) {
    case 'bald':
      break;
    case 'afro':
      head.add(mesh(new THREE.SphereGeometry(0.42, 16, 12), hair, 0, 0.16, -0.19));
      break;
    case 'bun':
      head.add(cap());
      head.add(mesh(new THREE.SphereGeometry(0.15, 12, 10), hair, 0, 0.3, -0.18));
      break;
    case 'ponytail': {
      head.add(cap());
      const tail = mesh(new THREE.CapsuleGeometry(0.08, 0.35, 4, 8), hair, 0, -0.05, -0.33);
      tail.rotation.x = 0.35;
      head.add(tail);
      break;
    }
    case 'braids':
    case 'dreads': {
      head.add(cap());
      const count = type === 'braids' ? 8 : 12;
      const thick = type === 'braids' ? 0.035 : 0.05;
      for (let i = 0; i < count; i++) {
        const a = Math.PI * 0.15 + (i / (count - 1)) * Math.PI * 0.7; // around the back
        const strand = mesh(new THREE.CapsuleGeometry(thick, 0.45, 3, 6), hair, Math.cos(a) * 0.29, -0.15, -Math.sin(a) * 0.29);
        head.add(strand);
      }
      break;
    }
    default: // short
      head.add(cap());
  }
}

function addHat(head, type, top, bottom) {
  const gold = mat('#f5c542', { metalness: 0.6, roughness: 0.3 });
  switch (type) {
    case 'cap': {
      head.add(mesh(new THREE.SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), top, 0, 0.08, 0));
      const brim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16, 1, false, 0, Math.PI), top, 0, 0.1, 0.2);
      brim.rotation.y = -Math.PI / 2;
      head.add(brim);
      break;
    }
    case 'beanie':
      head.add(mesh(new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), bottom, 0, 0.06, 0));
      {
        const band = mesh(new THREE.TorusGeometry(0.31, 0.05, 8, 20), top, 0, 0.08, 0);
        band.rotation.x = Math.PI / 2;
        head.add(band);
      }
      head.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), top, 0, 0.42, 0));
      break;
    case 'tophat':
      head.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 20), mat('#1d1d1b'), 0, 0.22, 0));
      head.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.4, 20), mat('#1d1d1b'), 0, 0.43, 0));
      head.add(mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.07, 20), top, 0, 0.27, 0));
      break;
    case 'crown': {
      head.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16, 1, true), gold, 0, 0.3, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        head.add(mesh(new THREE.ConeGeometry(0.06, 0.14, 6), gold, Math.sin(a) * 0.22, 0.42, Math.cos(a) * 0.22));
      }
      break;
    }
    default:
      break;
  }
}

function addAccessory(head, body, type, m) {
  switch (type) {
    case 'glasses': {
      const frame = mat('#111111', { metalness: 0.3 });
      for (const x of [-0.1, 0.1]) {
        head.add(mesh(new THREE.TorusGeometry(0.065, 0.014, 6, 16), frame, x, 0.03, 0.29));
      }
      head.add(mesh(new THREE.BoxGeometry(0.07, 0.015, 0.015), frame, 0, 0.04, 0.3));
      break;
    }
    case 'earrings': {
      const gold = mat('#f5c542', { metalness: 0.6, roughness: 0.3 });
      head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), gold, -0.3, -0.08, 0));
      head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), gold, 0.3, -0.08, 0));
      break;
    }
    case 'beard': {
      const beard = mesh(new THREE.SphereGeometry(0.25, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), m.hair, 0, -0.02, 0.06);
      head.add(beard);
      break;
    }
    case 'scarf': {
      const scarf = mesh(new THREE.TorusGeometry(0.17, 0.07, 8, 18), m.bottom, 0, 1.55, 0);
      scarf.rotation.x = Math.PI / 2;
      body.add(scarf);
      body.add(mesh(new THREE.BoxGeometry(0.12, 0.3, 0.05), m.bottom, 0.1, 1.38, 0.22));
      break;
    }
    case 'backpack':
      body.add(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.2), m.bottom, 0, 1.15, -0.32));
      break;
    default:
      break;
  }
}

// Plays a short reaction: 'cheer' (board cleared), 'happy' (arrow out), 'oops' (blocked).
export function react(character, mood) {
  character.userData.mood = mood;
  character.userData.moodTime = 0;
}

export function animateCharacter(character, dt, t) {
  const d = character.userData;
  d.moodTime += dt;
  const k = d.moodTime;
  d.body.position.y = Math.sin(t * 2) * 0.03;
  d.head.rotation.set(0, Math.sin(t * 0.7) * 0.15, 0);
  d.arms[0].rotation.x = 0;
  d.arms[1].rotation.x = 0;
  d.arms[0].rotation.z = -0.12;
  d.arms[1].rotation.z = 0.12;

  if (d.mood === 'cheer' && k < 1.6) {
    d.body.position.y = Math.abs(Math.sin(k * 6)) * 0.45;
    d.arms[0].rotation.z = -2.6 + Math.sin(k * 12) * 0.2;
    d.arms[1].rotation.z = 2.6 - Math.sin(k * 12) * 0.2;
  } else if (d.mood === 'happy' && k < 0.5) {
    d.body.position.y = Math.sin((k / 0.5) * Math.PI) * 0.18;
    d.arms[1].rotation.z = 0.12 + Math.sin((k / 0.5) * Math.PI) * 1.6;
  } else if (d.mood === 'oops' && k < 0.7) {
    d.head.rotation.y = Math.sin(k * 25) * 0.4 * (1 - k / 0.7);
    d.arms[0].rotation.x = -0.6;
    d.arms[1].rotation.x = -0.6;
  } else {
    d.mood = null;
  }
}
