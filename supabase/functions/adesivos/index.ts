// Supabase Edge Function: adesivos
//
// Backs /adesivos, the store of the stickers handed out on the night. One
// link for the whole class, entered like the vote and /musica:
//   - nobody yet: whether the store is open, and the models on sale.
//   - `whatsapp`: a formando, recognised by their number. A number not on the
//     list comes back with `voce: null` and the names that still have no
//     number (`livres`); sent again with one of them as `nome`, the number
//     gets tied to that name (identificar_eleitor in votacao.sql).
//     Sees and changes only their own order (`pedir`, with `itens` and an
//     optional `observacao`), while the store is open and the order isn't
//     paid yet. Also gets a link to their own childhood photo
//     (`fotoInfancia`, from the committee's private `fotos-infancia` bucket
//     — infancia.sql), for the childhood sticker; never anyone else's.
//   - `codigo`: COMMITTEE_CODE. Sees every order; marks one paid or not
//     (`pago`, with `formando` and `sim`); changes or deletes one (`pedir`
//     with `formando`, `apagar`); opens/closes the store (`aberta`, with
//     `sim`). Runs the models on sale: `prepararImagem` (with `extensao`)
//     hands back a signed upload URL for a picture, then `salvarModelo`
//     (with `modelo`: id to change one, nome, descricao, preco, ativo,
//     imagem) creates or changes it; `moverModelo` (`id`, `direcao` ±1)
//     reorders; `apagarModelo` (`id`) deletes one no order has. Gets a link
//     to every formando's childhood photo (`fotos`), to download their
//     stickers for printing.
//
// The anon key can't touch these tables (adesivos.sql): this is the only
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

const BUCKET = 'adesivos';
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

type LinhaModelo = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | string;
  imagem: string | null;
  crianca: boolean;
  ativo: boolean;
  ordem: number;
};
type Linha = { formando: string; itens: Record<string, number>; observacao: string | null; pago: boolean; criado_em: string; atualizado_em: string };

const paraPagina = (l: Linha) => ({
  formando: l.formando,
  itens: l.itens,
  observacao: l.observacao,
  pago: l.pago,
  criadoEm: l.criado_em,
  atualizadoEm: l.atualizado_em,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { codigo, whatsapp, nome, acao, itens, observacao, formando, sim, modelo, id, direcao, extensao } = await req.json();

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

    async function lerModelos(): Promise<LinhaModelo[]> {
      const { data, error } = await supabase
        .from('modelos_adesivos')
        .select('id, nome, descricao, preco, imagem, crianca, ativo, ordem')
        .order('ordem')
        .order('criado_em');
      if (error) throw error;
      return data as LinhaModelo[];
    }
    let modelos = await lerModelos();

    // ---- Changes ----------------------------------------------------------
    if (acao === 'pedir' && (voce || comissao)) {
      const dono = comissao ? formando : voce;
      if (typeof dono !== 'string') return recusar('De quem é o pedido?');
      if (!comissao && !aberta) return recusar('A loja já fechou. Para mudar o seu pedido, fale com a comissão.');
      if (!itens || typeof itens !== 'object' || Array.isArray(itens)) return recusar('Pedido inválido.');
      const { data: atual, error: erroAtual } = await supabase.from('pedidos_adesivos').select('itens, pago').eq('formando', dono).maybeSingle();
      if (erroAtual) throw erroAtual;
      if (!comissao && atual?.pago) return recusar('Esse pedido já foi pago. Para mudar, fale com a comissão.');
      const antes = (atual?.itens ?? {}) as Record<string, number>;
      const lidos: Record<string, number> = {};
      for (const [modeloId, quantidade] of Object.entries(itens as Record<string, unknown>)) {
        if (typeof quantidade !== 'number' || !Number.isInteger(quantidade) || quantidade < 0 || quantidade > MAXIMO) {
          return recusar(`A quantidade de cada adesivo vai de 0 a ${MAXIMO}.`);
        }
        if (quantidade === 0) continue;
        const m = modelos.find((x) => x.id === modeloId);
        // A hidden model stays in an order that already had it, at most as many.
        if (!m || (!m.ativo && !comissao && quantidade > (antes[modeloId] ?? 0))) {
          return recusar('Um dos adesivos do pedido não está mais à venda. Recarregue a página.');
        }
        lidos[modeloId] = quantidade;
      }
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
    } else if (acao === 'prepararImagem') {
      const ext = typeof extensao === 'string' && /^[a-z0-9]{1,5}$/.test(extensao) ? extensao : 'png';
      const caminho = `${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(caminho);
      if (error) throw error;
      // Only this, not the whole state: the picture goes up next, then salvarModelo.
      return json({ caminho, token: data.token });
    } else if (acao === 'salvarModelo') {
      if (!modelo || typeof modelo !== 'object') return recusar('Adesivo inválido.');
      const m = modelo as Record<string, unknown>;
      const nomeM = typeof m.nome === 'string' ? m.nome.trim() : '';
      if (!nomeM || nomeM.length > 80) return recusar('Dê um nome ao adesivo (até 80 letras).');
      const preco = typeof m.preco === 'number' ? Math.round(m.preco * 100) / 100 : NaN;
      if (!Number.isFinite(preco) || preco < 0 || preco >= 10000) return recusar('O preço não parece certo.');
      const descricao = typeof m.descricao === 'string' && m.descricao.trim() ? m.descricao.trim().slice(0, 300) : null;
      const ativo = m.ativo !== false;
      const imagem = typeof m.imagem === 'string' && /^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(m.imagem) ? m.imagem : undefined;
      if (typeof m.id === 'string') {
        const existente = modelos.find((x) => x.id === m.id);
        if (!existente) return recusar('Esse adesivo não existe mais. Recarregue a página.');
        const mudanca: Record<string, unknown> = { nome: nomeM, descricao, preco, ativo };
        if (imagem && !existente.crianca) mudanca.imagem = imagem;
        const { error } = await supabase.from('modelos_adesivos').update(mudanca).eq('id', m.id);
        if (error) throw error;
        // The picture it had is no longer used.
        if (mudanca.imagem && existente.imagem) await supabase.storage.from(BUCKET).remove([existente.imagem]);
      } else {
        if (!imagem) return recusar('Escolha a imagem do adesivo.');
        const ordem = modelos.reduce((max, x) => Math.max(max, x.ordem), 0) + 1;
        const { error } = await supabase.from('modelos_adesivos').insert({ nome: nomeM, descricao, preco, ativo, imagem, ordem });
        if (error) throw error;
      }
    } else if (acao === 'moverModelo') {
      const i = modelos.findIndex((x) => x.id === id);
      const j = i + (direcao === -1 ? -1 : 1);
      if (i < 0 || j < 0 || j >= modelos.length) return recusar('Não dá para mover esse adesivo.');
      const nova = [...modelos];
      [nova[i], nova[j]] = [nova[j], nova[i]];
      for (const [k, x] of nova.entries()) {
        if (x.ordem === k) continue;
        const { error } = await supabase.from('modelos_adesivos').update({ ordem: k }).eq('id', x.id);
        if (error) throw error;
      }
    } else if (acao === 'apagarModelo') {
      const existente = modelos.find((x) => x.id === id);
      if (!existente) return recusar('Esse adesivo não existe mais.');
      if (existente.crianca) return recusar('O adesivo de criança não pode ser apagado. Para tirá-lo da loja, esconda.');
      const { data: comEle, error: erroCom } = await supabase.from('pedidos_adesivos').select('formando').not(`itens->${existente.id}`, 'is', null);
      if (erroCom) throw erroCom;
      if (comEle.length > 0) return recusar(`${comEle.length === 1 ? 'Um pedido tem' : `${comEle.length} pedidos têm`} esse adesivo. Para tirá-lo da loja, esconda em vez de apagar.`);
      const { error } = await supabase.from('modelos_adesivos').delete().eq('id', existente.id);
      if (error) throw error;
      if (existente.imagem) await supabase.storage.from(BUCKET).remove([existente.imagem]);
    } else if (acao) {
      return recusar('Ação desconhecida.');
    }

    if (acao && comissao && acao.endsWith('Modelo')) modelos = await lerModelos();

    // ---- What the page sees -----------------------------------------------
    const urlImagem = (caminho: string | null) => (caminho ? supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl : null);
    const modelosPagina = modelos
      .filter((m) => comissao || m.ativo)
      .map((m) => ({ id: m.id, nome: m.nome, descricao: m.descricao, preco: Number(m.preco), imagem: urlImagem(m.imagem), crianca: m.crianca, ativo: m.ativo }));

    if (!comissao && !voce) {
      // A number not on the list picks among the names that have none yet.
      let livres: string[] | null = null;
      if (typeof whatsapp === 'string') {
        const { data, error } = await supabase.from('convidados_formando').select('formando').is('whatsapp', null).order('formando');
        if (error) throw error;
        livres = data.map((f) => f.formando as string);
      }
      return json({ comissao, voce, livres, aberta, modelos: modelosPagina, meu: null, fotoInfancia: null, pedidos: null, formandos: null, fotos: null });
    }

    if (comissao) {
      const [pedidos, formandos, arquivos] = await Promise.all([
        supabase.from('pedidos_adesivos').select('formando, itens, observacao, pago, criado_em, atualizado_em').order('formando'),
        supabase.from('convidados_formando').select('formando').order('formando'),
        supabase.rpc('fotos_infancia_arquivos'),
      ]);
      if (pedidos.error) throw pedidos.error;
      if (formandos.error) throw formandos.error;
      const nomes = formandos.data.map((f) => f.formando as string);

      // Every formando's first childhood photo, for their sticker. Never breaks the page.
      let fotos: Record<string, string> = {};
      try {
        if (arquivos.error) throw arquivos.error;
        const primeiro = new Map<string, string>();
        for (const a of (arquivos.data ?? []) as { caminho: string }[]) {
          const pasta = a.caminho.split('/')[0];
          if (!primeiro.has(pasta)) primeiro.set(pasta, a.caminho);
        }
        const caminhos = nomes.map((n) => primeiro.get(slug(n))).filter((c): c is string => !!c);
        if (caminhos.length > 0) {
          const { data, error } = await supabase.storage.from('fotos-infancia').createSignedUrls(caminhos, 60 * 60 * 24);
          if (error) throw error;
          const porCaminho = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
          fotos = Object.fromEntries(
            nomes.flatMap((n) => {
              const url = porCaminho.get(primeiro.get(slug(n)) ?? '');
              return url ? [[n, url]] : [];
            }),
          );
        }
      } catch (e) {
        console.error(e);
      }

      return json({
        comissao,
        voce: null,
        livres: null,
        aberta,
        modelos: modelosPagina,
        meu: null,
        fotoInfancia: null,
        pedidos: (pedidos.data as Linha[]).map(paraPagina),
        formandos: nomes,
        fotos,
      });
    }

    /** A link (valid a day) to the formando's first childhood photo, or null. Never breaks the page. */
    async function minhaFoto(): Promise<string | null> {
      try {
        const { data: arquivos } = await supabase.storage
          .from('fotos-infancia')
          .list(slug(voce!), { limit: 1, sortBy: { column: 'created_at', order: 'asc' } });
        const arquivo = (arquivos ?? []).find((a) => a.id);
        if (!arquivo) return null;
        const { data } = await supabase.storage.from('fotos-infancia').createSignedUrl(`${slug(voce!)}/${arquivo.name}`, 60 * 60 * 24);
        return data?.signedUrl ?? null;
      } catch (e) {
        console.error(e);
        return null;
      }
    }

    const [{ data: meu, error: erroMeu }, fotoInfancia] = await Promise.all([
      supabase.from('pedidos_adesivos').select('formando, itens, observacao, pago, criado_em, atualizado_em').eq('formando', voce!).maybeSingle(),
      minhaFoto(),
    ]);
    if (erroMeu) throw erroMeu;

    // A hidden model still in their order still shows, so it can be taken out.
    const noPedido = new Set(Object.keys((meu?.itens ?? {}) as Record<string, number>));
    const modelosFormando = modelos
      .filter((m) => m.ativo || noPedido.has(m.id))
      .map((m) => ({ id: m.id, nome: m.nome, descricao: m.descricao, preco: Number(m.preco), imagem: urlImagem(m.imagem), crianca: m.crianca, ativo: m.ativo }));

    return json({
      comissao,
      voce,
      livres: null,
      aberta,
      modelos: modelosFormando,
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
