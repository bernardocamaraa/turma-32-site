// Supabase Edge Function: adesivos
//
// Backs /adesivos, the store of the stickers handed out on the night. One
// link for the whole class, entered like the vote and /musica:
//   - nobody yet: only whether the store is open.
//   - `whatsapp`: a formando, recognised by their number. A number not on the
//     list comes back with `voce: null` and the names that still have no
//     number (`livres`); sent again with one of them as `nome`, the number
//     gets tied to that name (identificar_eleitor in votacao.sql).
//     Sees and changes only their own order (`pedir`, with `itens` and an
//     optional `observacao`), while the store is open and the order isn't
//     paid yet. Also gets a link to their own childhood photo
//     (`fotoInfancia`, from the committee's private `fotos-infancia` bucket
//     — infancia.sql), for the childhood sticker; never anyone else's.
//   - `codigo`: COMMITTEE_CODE. Sees every order, marks one paid or not
//     (`pago`, with `formando` and `sim`), deletes one (`apagar`, with
//     `formando`) and opens/closes the store (`aberta`, with `sim`). Gets a
//     link to the childhood photo of everyone who ordered the childhood
//     sticker (`fotos`), to download it for printing.
//
// The anon key can't touch pedidos_adesivos (adesivos.sql): this is the only
// way in.
//
// Deploy with:
//   supabase functions deploy adesivos

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// The models on sale — the same ids as MODELOS in src/lib/adesivos.ts. A
// model added there must be added here too, or orders with it are refused.
const MODELOS = ['crianca', 'logo-32', 'terceirao', 'assinaturas'];
const MODELO_CRIANCA = 'crianca';
/** Most of one model a formando can order. */
const MAXIMO = 200;

/** Same slug rule as middleware.ts and the infancia function: each formando's folder of childhood photos. */
function slug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type Linha = { formando: string; itens: Record<string, number>; observacao: string | null; pago: boolean; criado_em: string; atualizado_em: string };

const paraPagina = (l: Linha) => ({
  formando: l.formando,
  itens: l.itens,
  observacao: l.observacao,
  pago: l.pago,
  criadoEm: l.criado_em,
  atualizadoEm: l.atualizado_em,
});

/** The order as sent, cleaned: known models only, whole quantities above zero. Or why it's refused. */
function lerItens(itens: unknown): Record<string, number> | string {
  if (!itens || typeof itens !== 'object' || Array.isArray(itens)) return 'Pedido inválido.';
  const saida: Record<string, number> = {};
  for (const [modelo, quantidade] of Object.entries(itens as Record<string, unknown>)) {
    if (!MODELOS.includes(modelo)) return 'Um dos adesivos do pedido não existe mais. Recarregue a página.';
    if (typeof quantidade !== 'number' || !Number.isInteger(quantidade) || quantidade < 0 || quantidade > MAXIMO) {
      return `A quantidade de cada adesivo vai de 0 a ${MAXIMO}.`;
    }
    if (quantidade > 0) saida[modelo] = quantidade;
  }
  return saida;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { codigo, whatsapp, nome, acao, itens, observacao, formando, sim } = await req.json();

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const recusar = (mensagem: string) => json({ error: mensagem }, 400);

    // Who is calling: the committee, a formando (by number), or nobody yet —
    // exactly as in the vote (supabase/functions/votacao).
    let comissao = false;
    let voce: string | null = null;
    if (typeof codigo === 'string') {
      const codigoComissao = Deno.env.get('COMMITTEE_CODE') ?? '';
      if (!codigoComissao || codigo.trim() !== codigoComissao) {
        return json({ error: 'Código incorreto.' }, 401);
      }
      comissao = true;
    } else if (typeof whatsapp === 'string') {
      const { data: dono, error } = await supabase.from('convidados_formando').select('formando').eq('whatsapp', whatsapp).maybeSingle();
      if (error) throw error;
      if (dono) {
        voce = dono.formando as string;
      } else if (typeof nome === 'string') {
        const { error } = await supabase.rpc('identificar_eleitor', { p_formando: nome, p_whatsapp: whatsapp });
        if (error) {
          // Messages raised on purpose in identificar_eleitor() are for the formando.
          if (error.code === 'P0001') return json({ error: error.message }, 401);
          throw error;
        }
        voce = nome;
      }
    }

    const { data: config, error: erroConfig } = await supabase.from('configuracoes').select('valor').eq('chave', 'loja_aberta').maybeSingle();
    if (erroConfig) throw erroConfig;
    let aberta: boolean = config?.valor ?? true;

    // ---- Changes ----------------------------------------------------------
    if (acao === 'pedir' && (voce || comissao)) {
      const dono = comissao ? formando : voce;
      if (typeof dono !== 'string') return recusar('De quem é o pedido?');
      if (!comissao && !aberta) return recusar('A loja já fechou. Para mudar o seu pedido, fale com a comissão.');
      const lidos = lerItens(itens);
      if (typeof lidos === 'string') return recusar(lidos);
      const { data: atual, error: erroAtual } = await supabase.from('pedidos_adesivos').select('pago').eq('formando', dono).maybeSingle();
      if (erroAtual) throw erroAtual;
      if (!comissao && atual?.pago) return recusar('Esse pedido já foi pago. Para mudar, fale com a comissão.');
      const nota = typeof observacao === 'string' && observacao.trim() ? observacao.trim().slice(0, 500) : null;
      if (Object.keys(lidos).length === 0) {
        const { error } = await supabase.from('pedidos_adesivos').delete().eq('formando', dono);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pedidos_adesivos')
          .upsert({ formando: dono, itens: lidos, observacao: nota, atualizado_em: new Date().toISOString() }, { onConflict: 'formando' });
        if (error) throw error;
      }
    } else if (acao && !comissao) {
      return recusar('Entre de novo com o seu WhatsApp.');
    } else if (acao === 'pago') {
      if (typeof formando !== 'string') return recusar('De quem é o pedido?');
      const { error } = await supabase.from('pedidos_adesivos').update({ pago: sim === true }).eq('formando', formando);
      if (error) throw error;
    } else if (acao === 'apagar') {
      if (typeof formando !== 'string') return recusar('De quem é o pedido?');
      const { error } = await supabase.from('pedidos_adesivos').delete().eq('formando', formando);
      if (error) throw error;
    } else if (acao === 'aberta') {
      aberta = sim === true;
      const { error } = await supabase.from('configuracoes').upsert({ chave: 'loja_aberta', valor: aberta }, { onConflict: 'chave' });
      if (error) throw error;
    } else if (acao) {
      return recusar('Ação desconhecida.');
    }

    // ---- What the page sees -----------------------------------------------
    if (!comissao && !voce) {
      // A number not on the list picks among the names that have none yet.
      let livres: string[] | null = null;
      if (typeof whatsapp === 'string') {
        const { data, error } = await supabase.from('convidados_formando').select('formando').is('whatsapp', null).order('formando');
        if (error) throw error;
        livres = data.map((f) => f.formando as string);
      }
      return json({ comissao, voce, livres, aberta, meu: null, fotoInfancia: null, pedidos: null, formandos: null, fotos: null });
    }

    /** A link (valid a day) to a formando's first childhood photo, or null. Never breaks the page. */
    async function fotoDe(quem: string): Promise<string | null> {
      try {
        const { data: arquivos } = await supabase.storage
          .from('fotos-infancia')
          .list(slug(quem), { limit: 1, sortBy: { column: 'created_at', order: 'asc' } });
        const arquivo = (arquivos ?? []).find((a) => a.id);
        if (!arquivo) return null;
        const { data } = await supabase.storage.from('fotos-infancia').createSignedUrl(`${slug(quem)}/${arquivo.name}`, 60 * 60 * 24);
        return data?.signedUrl ?? null;
      } catch (e) {
        console.error(e);
        return null;
      }
    }

    if (comissao) {
      const [pedidos, formandos] = await Promise.all([
        supabase.from('pedidos_adesivos').select('formando, itens, observacao, pago, criado_em, atualizado_em').order('formando'),
        supabase.from('convidados_formando').select('formando').order('formando'),
      ]);
      if (pedidos.error) throw pedidos.error;
      if (formandos.error) throw formandos.error;
      const linhas = pedidos.data as Linha[];
      const comCrianca = linhas.filter((l) => (l.itens[MODELO_CRIANCA] ?? 0) > 0).map((l) => l.formando);
      const fotos = Object.fromEntries(await Promise.all(comCrianca.map(async (f) => [f, await fotoDe(f)] as const)));
      return json({
        comissao,
        voce: null,
        livres: null,
        aberta,
        meu: null,
        fotoInfancia: null,
        pedidos: linhas.map(paraPagina),
        formandos: formandos.data.map((f) => f.formando as string),
        fotos,
      });
    }

    const [{ data: meu, error: erroMeu }, fotoInfancia] = await Promise.all([
      supabase.from('pedidos_adesivos').select('formando, itens, observacao, pago, criado_em, atualizado_em').eq('formando', voce!).maybeSingle(),
      fotoDe(voce!),
    ]);
    if (erroMeu) throw erroMeu;

    return json({
      comissao,
      voce,
      livres: null,
      aberta,
      meu: meu ? paraPagina(meu as Linha) : null,
      fotoInfancia,
      pedidos: null,
      formandos: null,
      fotos: null,
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
