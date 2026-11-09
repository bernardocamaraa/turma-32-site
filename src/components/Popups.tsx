import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info, Music, TriangleAlert, Users } from 'lucide-react';

/**
 * Full-screen notifications: one at a time, over the blurred page, with a
 * big animated icon. Quick confirmations of your own action ('ok', 'info':
 * "Música salva!") close by themselves after a moment; news from someone
 * else ('grupo', 'festa', 'aviso': an invitation, the group complete) wait
 * for a tap, since they're worth reading. More than one in a row queue up.
 *
 * It's a modal dialog for assistive tech: focus goes to its button, Esc or
 * a tap outside closes it, and focus goes back where it was. Errors that
 * belong to a field stay next to the field; these are for news.
 */
export type TipoPopup = 'ok' | 'info' | 'grupo' | 'festa' | 'aviso';

export type Popup = {
  tipo: TipoPopup;
  titulo: string;
  texto?: string;
  acao?: { rotulo: string; onClick: () => void };
};

type PopupNaFila = Popup & { id: number };

const Contexto = createContext<(p: Popup) => void>(() => {});

/** Shows a notification from anywhere inside <Popups>. */
export function usePopup() {
  return useContext(Contexto);
}

/** How long a quick confirmation stays before closing itself. */
const DURACAO_RAPIDA = 2600;
const RAPIDOS: TipoPopup[] = ['ok', 'info'];

const ICONES: Record<TipoPopup, ReactNode> = {
  ok: <Check size={42} strokeWidth={3} />,
  info: <Info size={40} strokeWidth={2.4} />,
  grupo: <Users size={40} strokeWidth={2.4} />,
  festa: <Music size={40} strokeWidth={2.4} />,
  aviso: <TriangleAlert size={38} strokeWidth={2.4} />,
};

const CORES: Record<TipoPopup, string> = {
  ok: '#7fb98a',
  info: '#a9d3e8',
  grupo: '#dcc48c',
  festa: '#dcc48c',
  aviso: '#dcc48c',
};

export function Popups({ children }: { children: ReactNode }) {
  const [fila, setFila] = useState<PopupNaFila[]>([]);
  const proximo = useRef(1);

  const mostrar = useCallback((p: Popup) => {
    const id = proximo.current++;
    // The same news twice in a row (two reads in a row) shows once.
    setFila((f) => (f.some((x) => x.titulo === p.titulo) ? f : [...f, { ...p, id }]));
  }, []);

  const tirar = useCallback((id: number) => setFila((f) => f.filter((x) => x.id !== id)), []);

  const atual = fila[0];
  return (
    <Contexto.Provider value={mostrar}>
      {children}
      {atual && typeof document !== 'undefined' ? createPortal(<TelaCheia key={atual.id} popup={atual} restantes={fila.length - 1} onFechar={() => tirar(atual.id)} />, document.body) : null}
    </Contexto.Provider>
  );
}

function TelaCheia({ popup, restantes, onFechar }: { popup: PopupNaFila; restantes: number; onFechar: () => void }) {
  const [saindo, setSaindo] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const rapido = RAPIDOS.includes(popup.tipo) && !popup.acao;

  function fechar(depois?: () => void) {
    if (saindo) return;
    setSaindo(true);
    setTimeout(() => {
      onFechar();
      depois?.();
    }, 200);
  }

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    botao.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('keydown', tecla);
    const t = rapido ? setTimeout(() => fechar(), DURACAO_RAPIDA) : undefined;
    return () => {
      document.removeEventListener('keydown', tecla);
      clearTimeout(t);
      antes?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className={`popup-fundo${saindo ? ' sai' : ''}`}
      style={{ ['--popup-cor' as string]: CORES[popup.tipo] }}
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div className="popup-cartao" role="dialog" aria-modal="true" aria-labelledby={`popup-${popup.id}`}>
        <span className="popup-icone" aria-hidden>
          {ICONES[popup.tipo]}
        </span>
        <h2 id={`popup-${popup.id}`} className="popup-titulo">
          {popup.titulo}
        </h2>
        {popup.texto ? <p className="popup-texto">{popup.texto}</p> : null}
        <div className="popup-botoes">
          {popup.acao ? (
            <>
              <button ref={botao} type="button" className="popup-botao" onClick={() => fechar(popup.acao!.onClick)}>
                {popup.acao.rotulo}
              </button>
              <button type="button" className="popup-botao secundario" onClick={() => fechar()}>
                {restantes > 0 ? 'Próximo aviso' : 'Agora não'}
              </button>
            </>
          ) : (
            <button ref={botao} type="button" className="popup-botao" onClick={() => fechar()}>
              {restantes > 0 ? 'Próximo aviso' : 'OK'}
            </button>
          )}
        </div>
        {rapido ? <span className="popup-tempo" aria-hidden style={{ animationDuration: `${DURACAO_RAPIDA}ms` }} /> : null}
      </div>
    </div>
  );
}
