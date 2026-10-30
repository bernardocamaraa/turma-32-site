// The sounds of the Brazilian electronic ballot box, for the one in the vote
// confirmation (UrnaVoto): its confirmation, and a beep for each key.

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

// A key's beep: one of the confirmation's notes (it alternates two, a tenth
// of a second each).
const TECLA = { de: 0.05, segundos: 0.09 };

/**
 * Plays the whole confirmation, or a key's short beep, if prepararSomDaUrna
 * got the sound going and it has loaded.
 */
export async function tocarSomDaUrna(tipo: 'confirma' | 'tecla') {
  const c = contexto;
  const buffer = await audio;
  if (!c || !buffer || c.state !== 'running') return;
  const som = c.createBufferSource();
  som.buffer = buffer;
  if (tipo === 'confirma') {
    som.connect(c.destination);
    som.start();
    return;
  }
  // Faded in and out, so the cut doesn't click.
  const volume = c.createGain();
  const agora = c.currentTime;
  volume.gain.setValueAtTime(0, agora);
  volume.gain.linearRampToValueAtTime(1, agora + 0.005);
  volume.gain.setValueAtTime(1, agora + TECLA.segundos - 0.01);
  volume.gain.linearRampToValueAtTime(0, agora + TECLA.segundos);
  som.connect(volume).connect(c.destination);
  som.start(agora, TECLA.de, TECLA.segundos);
}
