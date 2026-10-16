// Talks to start.ng through its hidden connect page (see https://start.ng/docs.md).
// Only answers when the game is served from a *.start.ng address.
const START_NG = 'https://start.ng';
let frame;

function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return frame;
}

// Sends a message and resolves to start.ng's reply, or null if it didn't answer.
export async function askStartNg(message, replyType, timeoutMs = 5000) {
  let el;
  try {
    el = await connectFrame();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      resolve(reply);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return; // only trust start.ng
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

// Used when start.ng doesn't answer (opened as a local file, or offline).
export const FALLBACK_GUEST = {
  name: 'Guest',
  style: {
    body: 'female',
    primaryColor: '#d8fd71',
    secondaryColor: '#292a23',
    skinColor: '#c68642',
    hairColor: '#1b1410',
    hair: 'bun',
    hat: 'none',
    accessory: 'none',
  },
  face: null,
};

// Resolves to { player, signedIn, account, id }.
export async function whoIsPlaying() {
  const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
  if (reply?.user) {
    return { player: reply.user, signedIn: true, account: reply.user.account, id: reply.user.id };
  }
  return { player: reply?.guest ?? FALLBACK_GUEST, signedIn: false, account: null, id: null };
}

export function signIn() {
  location.href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
}

export function saveRun(stats) {
  return askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved');
}

export function readLeaderboard(limit = 10) {
  return askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData');
}
