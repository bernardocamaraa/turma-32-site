// The browser's own notifications (Web Push), for the committee: a phone
// that turns them on is told the moment every formando has voted. The
// server side is the `votacao` Edge Function; public/sw.js shows them.

export type SituacaoAvisos =
  /** Can turn them on (or already did). */
  | 'pronto'
  /** iPhone/iPad outside the home screen: Safari only notifies from there (iOS 16.4+). */
  | 'iphone-tela-inicio'
  /** This browser can't. */
  | 'sem-suporte'
  /** Someone said no on this device; only the browser's settings undo that. */
  | 'bloqueado';

const ehIphone = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function situacaoAvisos(): SituacaoAvisos {
  const suporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!suporta) return ehIphone() ? 'iphone-tela-inicio' : 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  return 'pronto';
}

/** This device's subscription, if the notification is on here. */
export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (situacaoAvisos() !== 'pronto' || Notification.permission !== 'granted') return null;
  const registro = await navigator.serviceWorker.getRegistration();
  return (await registro?.pushManager.getSubscription()) ?? null;
}

function bytesDaChave(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Asks for permission and subscribes this device with the site's public key
 * (`chavePush`, from the votacao function). Must run straight from a tap:
 * iPhone only shows the permission question then.
 */
export async function ligarAvisos(chavePush: string): Promise<PushSubscriptionJSON> {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    throw new Error(
      permissao === 'denied'
        ? 'As notificações ficaram bloqueadas neste aparelho. Libere nas configurações do navegador para este site.'
        : 'Sem a permissão o aviso não chega. Tente de novo e toque em "Permitir".',
    );
  }
  await navigator.serviceWorker.register('/sw.js');
  const registro = await navigator.serviceWorker.ready;
  const chave = bytesDaChave(chavePush);
  const atual = await registro.pushManager.getSubscription();
  // A subscription made with another key can't receive these: replace it.
  const mesmaChave =
    atual?.options.applicationServerKey &&
    new Uint8Array(atual.options.applicationServerKey).every((b, i, a) => a.length === chave.length && b === chave[i]);
  if (atual && mesmaChave) return atual.toJSON();
  if (atual) await atual.unsubscribe();
  const nova = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
  return nova.toJSON();
}

/** Turns the notification off on this device. Returns its endpoint, for the server to forget it too. */
export async function desligarAvisos(): Promise<string | null> {
  const inscricao = await inscricaoAtual();
  if (!inscricao) return null;
  await inscricao.unsubscribe();
  return inscricao.endpoint;
}
