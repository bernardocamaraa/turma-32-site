// The sound of the Brazilian electronic ballot box confirming a vote, played
// as the paper drops into the box (UrnaVoto).

const SOM = '/assets/confirma-urna.mp3';

let contexto: AudioContext | null = null;
let audio: Promise<AudioBuffer | null> | null = null;

function oContexto(): AudioContext | null {
  try {
    contexto ??= new AudioContext();
  } catch {
    // No sound on this browser: the animation goes on all the same.
  }
  return contexto;
}

/** Downloads and decodes the sound ahead, so it plays on time. Call it while the ballot is being filled in. */
export function precarregarSomDaUrna() {
  const c = oContexto();
  if (!c || audio) return;
  audio = fetch(SOM)
    .then((r) => r.arrayBuffer())
    .then((dados) => c.decodeAudioData(dados))
    .catch(() => {
      // Tried again next time.
      audio = null;
      return null;
    });
}

/**
 * Wakes the sound up. Call it in the tap that sends the ballot: a browser only
 * lets a page play sound that starts from a tap, and the ballot box shows only
 * later, once the server took the vote in.
 */
export function prepararSomDaUrna() {
  const c = oContexto();
  if (c?.state === 'suspended') void c.resume();
  precarregarSomDaUrna();
}

/** Plays it, if prepararSomDaUrna got the sound going and it has loaded. */
export async function tocarSomDaUrna() {
  const c = contexto;
  const buffer = await audio;
  if (!c || !buffer || c.state !== 'running') return;
  const som = c.createBufferSource();
  som.buffer = buffer;
  som.connect(c.destination);
  som.start();
}
