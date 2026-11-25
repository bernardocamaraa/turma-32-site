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
//     — infancia.sql), for the childhood sticker; never anyone else's — and
//     how it's framed (`enquadramento`), which they can change
//     (`enquadrar`, with `enquadramento`: { x, y, zoom } or null for the default).
//     Designs stickers of their own in the site's editor ("Crie seu
//     adesivo"): `prepararCriacao` hands back a signed upload URL for the
//     finished picture, `salvarCriacao` (`id` to change one, `nome`,
//     `imagem`, `design`) keeps it as a model only they (and the committee)
//     see, `apagarCriacao` (`id`) deletes it (and takes it out of their order).
//   - `codigo`: COMMITTEE_CODE. Sees every order; marks one paid or not
//     (`pago`, with `formando` and `sim`); changes or deletes one (`pedir`
//     with `formando`, `apagar`); opens/closes the store (`aberta`, with
//     `sim`); sets the price, the same for every sticker (`preco`, with
//     `valor`: reais, or null for no price yet — then none shows). Runs the models on sale: `prepararImagem` (with `extensao`)
//     hands back a signed upload URL for a picture, then `salvarModelo`
//     (with `modelo`: id to change one, nome, descricao, ativo,
//     imagem) creates or changes it; `moverModelo` (`id`, `direcao` ±1)
//     reorders; `apagarModelo` (`id`) deletes one no order has. A model
//     with `camadas` (parts of the picture, found by the site) lets the
//     formando pick a colour for each: the order then has one key per
//     combination, "<model id>@#rrggbb+#rrggbb". Gets a link
//     to every formando's childhood photo (`fotos`) and how each is framed
//     (`enquadramentos`), to download their stickers for printing; frames
//     anyone's (`enquadrar` with `formando`).
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
/** A picture that ships with the site itself ("/assets/logo-32.png"), not one uploaded to the bucket. */
const doSite = (caminho: string) => caminho.startsWith('/');
/** Most of one model a formando can order. */
const MAXIMO = 200;
/** How many stickers a formando takes in all (the committee can set any number). Same as PACOTES in src/lib/adesivos.ts. */
const PACOTES = [10, 20];

/** Same slug rule as middleware.ts and the infancia function: each formando's folder of childhood photos. */
function slug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type LinhaModelo = {
  id: string;
  nome: string;
  descricao: string | null;
  imagem: string | null;
  crianca: boolean;
  ativo: boolean;
  camadas: Camada[];
  ordem: number;
  /** A formando's own design ("Crie seu adesivo"): only they and the committee see it. */
  dono: string | null;
  design: unknown;
};

/** Most stickers of their own a formando can keep. */
const MAXIMO_CRIACOES = 10;

type Camada = { tipo: 'matiz' | 'escuro' | 'claro' | 'fundo'; nome: string; cor: string; h0?: number; h1?: number };

/** The parts as sent by the committee, checked; or why they're refused. */
function lerCamadas(valor: unknown): Camada[] | string {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor) || valor.length > 4) return 'Partes de cor inválidas.';
  const saida: Camada[] = [];
  for (const c of valor as Record<string, unknown>[]) {
    if (!c || !['matiz', 'escuro', 'claro', 'fundo'].includes(c.tipo as string)) return 'Partes de cor inválidas.';
    const nome = typeof c.nome === 'string' ? c.nome.trim().slice(0, 30) : '';
    if (!nome) return 'Dê um nome a cada parte que muda de cor.';
    if (typeof c.cor !== 'string' || !/^#[0-9a-f]{6}$/i.test(c.cor)) return 'Partes de cor inválidas.';
    const camada: Camada = { tipo: c.tipo as Camada['tipo'], nome, cor: c.cor.toLowerCase() };
    if (c.tipo === 'matiz') {
      if (typeof c.h0 !== 'number' || typeof c.h1 !== 'number' || c.h0 < 0 || c.h0 > 360 || c.h1 < 0 || c.h1 > 360) return 'Partes de cor inválidas.';
      camada.h0 = c.h0;
      camada.h1 = c.h1;
    }
    saida.push(camada);
  }
  return saida;
}

/**
 * "abc" or "abc@#ff0000+#111111" → the model and its colours (lowercase), or
 * null if malformed. A colour can also be "arcoiris" (the LGBT pride flag's
 * stripes across that part) or, for a background, a pattern's id ("muro" —
 * src/lib/fundos.ts).
 */
const COR = '(?:#[0-9a-fA-F]{6}|arcoiris|muro|concreto|estrelas|xadrez|listras|bolinhas|respingos)';
const CHAVE = new RegExp(`^([A-Za-z0-9_-]{1,64})(?:@(${COR}(?:\\+${COR}){0,3}))?$`, 'i');
function lerChave(chave: string): { id: string; cores: string[] | null } | null {
  const m = CHAVE.exec(chave);
  return m ? { id: m[1], cores: m[2] ? m[2].toLowerCase().split('+') : null } : null;
}
type Enquadramento = { x: number; y: number; zoom: number };

/** A framing as sent: checked, or null for the default; undefined if invalid. */
function lerEnquadramento(valor: unknown): Enquadramento | null | undefined {
  if (valor === null) return null;
  if (!valor || typeof valor !== 'object') return undefined;
  const { x, y, zoom } = valor as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  return num(x, 0, 1) && num(y, 0, 1) && num(zoom, 1, 4) ? { x: x as number, y: y as number, zoom: zoom as number } : undefined;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const {
      codigo, whatsapp, nome, acao, itens, observacao, formando, sim, modelo, id, direcao, extensao, valor, enquadramento, design,
      nomeCriacao: nome_criacao, imagemCriacao: imagem_criacao,
    } = await req.json();

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

    const { data: loja, error: erroLoja } = await supabase.from('loja_adesivos').select('preco').maybeSingle();
    if (erroLoja) throw erroLoja;
    let preco: number | null = loja?.preco == null ? null : Number(loja.preco);

    async function lerModelos(): Promise<LinhaModelo[]> {
      const { data, error } = await supabase
        .from('modelos_adesivos')
        .select('id, nome, descricao, imagem, crianca, ativo, camadas, ordem, dono, design')
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
      for (const [chaveBruta, quantidade] of Object.entries(itens as Record<string, unknown>)) {
        if (typeof quantidade !== 'number' || !Number.isInteger(quantidade) || quantidade < 0 || quantidade > MAXIMO) {
          return recusar(`A quantidade de cada adesivo vai de 0 a ${MAXIMO}.`);
        }
        if (quantidade === 0) continue;
        const lida = lerChave(chaveBruta);
        if (!lida) return recusar('Pedido inválido.');
        const chave = lida.cores ? `${lida.id}@${lida.cores.join('+')}` : lida.id;
        const m = modelos.find((x) => x.id === lida.id && (comissao || !x.dono || x.dono === dono));
        // A hidden model stays in an order that already had it, at most as many.
        if (!m || (!m.ativo && !comissao && quantidade > (antes[chave] ?? 0))) {
          return recusar('Um dos adesivos do pedido não está mais à venda. Recarregue a página.');
        }
        // One colour per part of a custom-colour model (none for the others).
        if ((lida.cores?.length ?? 0) !== m.camadas.length && !(antes[chave] && quantidade <= antes[chave])) {
          return recusar(m.camadas.length ? `Escolha as cores do adesivo "${m.nome}". Recarregue a página.` : `O adesivo "${m.nome}" não tem cor para escolher. Recarregue a página.`);
        }
        lidos[chave] = (lidos[chave] ?? 0) + quantidade;
        if (lidos[chave] > MAXIMO) return recusar(`A quantidade de cada adesivo vai de 0 a ${MAXIMO}.`);
      }
      const total = Object.values(lidos).reduce((soma, q) => soma + q, 0);
      if (!comissao && total > 0 && !PACOTES.includes(total)) {
        return recusar(`Cada formando leva ${PACOTES.join(' ou ')} adesivos no total. O seu pedido tem ${total}.`);
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
    } else if (acao === 'enquadrar' && (voce || comissao)) {
      const dono = comissao ? formando : voce;
      if (typeof dono !== 'string') return recusar('De quem é a foto?');
      const e = lerEnquadramento(enquadramento);
      if (e === undefined) return recusar('Enquadramento inválido.');
      const { error } = e
        ? await supabase.from('enquadramentos_infancia').upsert({ formando: dono, ...e, atualizado_em: new Date().toISOString() }, { onConflict: 'formando' })
        : await supabase.from('enquadramentos_infancia').delete().eq('formando', dono);
      if (error) throw error;
    } else if (acao === 'prepararCriacao' && voce) {
      const caminho = `${crypto.randomUUID()}.png`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(caminho);
      if (error) throw error;
      return json({ caminho, token: data.token });
    } else if (acao === 'salvarCriacao' && voce) {
      const nomeC = typeof nome_criacao === 'string' ? nome_criacao.trim().slice(0, 40) : '';
      if (!nomeC) return recusar('Dê um nome ao seu adesivo.');
      if (!design || typeof design !== 'object' || JSON.stringify(design).length > 80000) return recusar('Esse adesivo não deu para salvar. Tente de novo.');
      const imagem = typeof imagem_criacao === 'string' && /^[0-9a-f-]{36}\.png$/.test(imagem_criacao) ? imagem_criacao : undefined;
      if (typeof id === 'string') {
        const minha = modelos.find((x) => x.id === id && x.dono === voce);
        if (!minha) return recusar('Esse adesivo não existe mais. Recarregue a página.');
        const mudanca: Record<string, unknown> = { nome: nomeC, design };
        if (imagem) mudanca.imagem = imagem;
        const { error } = await supabase.from('modelos_adesivos').update(mudanca).eq('id', id);
        if (error) throw error;
        if (imagem && minha.imagem && !doSite(minha.imagem)) await supabase.storage.from(BUCKET).remove([minha.imagem]);
      } else {
        if (!imagem) return recusar('Esse adesivo não deu para salvar. Tente de novo.');
        if (modelos.filter((x) => x.dono === voce).length >= MAXIMO_CRIACOES) {
          return recusar(`Você já tem ${MAXIMO_CRIACOES} adesivos seus. Apague um para criar outro.`);
        }
        const { error } = await supabase.from('modelos_adesivos').insert({ nome: nomeC, imagem, design, dono: voce, camadas: [], ordem: 1000 });
        if (error) throw error;
      }
      modelos = await lerModelos();
    } else if (acao === 'apagarCriacao' && voce) {
      const minha = modelos.find((x) => x.id === id && x.dono === voce);
      if (!minha) return recusar('Esse adesivo não existe mais. Recarregue a página.');
      const { data: pedido, error: erroPedido } = await supabase.from('pedidos_adesivos').select('itens, pago').eq('formando', voce).maybeSingle();
      if (erroPedido) throw erroPedido;
      const itensDele = (pedido?.itens ?? {}) as Record<string, number>;
      const noPedido = Object.keys(itensDele).filter((k) => lerChave(k)?.id === minha.id);
      if (noPedido.length) {
        if (pedido?.pago) return recusar('Esse adesivo está num pedido já pago. Para mudar, fale com a comissão.');
        const resto = Object.fromEntries(Object.entries(itensDele).filter(([k]) => !noPedido.includes(k)));
        const { error } = Object.keys(resto).length
          ? await supabase.from('pedidos_adesivos').update({ itens: resto, atualizado_em: new Date().toISOString() }).eq('formando', voce)
          : await supabase.from('pedidos_adesivos').delete().eq('formando', voce);
        if (error) throw error;
      }
      const { error } = await supabase.from('modelos_adesivos').delete().eq('id', minha.id);
      if (error) throw error;
      if (minha.imagem && !doSite(minha.imagem)) await supabase.storage.from(BUCKET).remove([minha.imagem]);
      modelos = await lerModelos();
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
    } else if (acao === 'preco') {
      if (valor === null) preco = null;
      else if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor < 10000) preco = Math.round(valor * 100) / 100;
      else return recusar('O preço não parece certo.');
      const { error } = await supabase.from('loja_adesivos').upsert({ id: true, preco }, { onConflict: 'id' });
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
      const descricao = typeof m.descricao === 'string' && m.descricao.trim() ? m.descricao.trim().slice(0, 300) : null;
      const ativo = m.ativo !== false;
      const camadas = lerCamadas(m.camadas);
      if (typeof camadas === 'string') return recusar(camadas);
      const imagem = typeof m.imagem === 'string' && /^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(m.imagem) ? m.imagem : undefined;
      if (typeof m.id === 'string') {
        const existente = modelos.find((x) => x.id === m.id);
        if (!existente) return recusar('Esse adesivo não existe mais. Recarregue a página.');
        const mudanca: Record<string, unknown> = { nome: nomeM, descricao, ativo, camadas: existente.crianca ? [] : camadas };
        if (imagem && !existente.crianca) mudanca.imagem = imagem;
        const { error } = await supabase.from('modelos_adesivos').update(mudanca).eq('id', m.id);
        if (error) throw error;
        // The picture it had is no longer used.
        if (mudanca.imagem && existente.imagem && !doSite(existente.imagem)) await supabase.storage.from(BUCKET).remove([existente.imagem]);
      } else {
        if (!imagem) return recusar('Escolha a imagem do adesivo.');
        const ordem = modelos.reduce((max, x) => Math.max(max, x.ordem), 0) + 1;
        const { error } = await supabase.from('modelos_adesivos').insert({ nome: nomeM, descricao, ativo, camadas, imagem, ordem });
        if (error) throw error;
      }
    } else if (acao === 'moverModelo') {
      // Only the models on sale have an order in the store (a formando's own stickers don't).
      const aVenda = modelos.filter((x) => !x.dono);
      const i = aVenda.findIndex((x) => x.id === id);
      const j = i + (direcao === -1 ? -1 : 1);
      if (i < 0 || j < 0 || j >= aVenda.length) return recusar('Não dá para mover esse adesivo.');
      const nova = [...aVenda];
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
      const { data: todos, error: erroCom } = await supabase.from('pedidos_adesivos').select('formando, itens');
      if (erroCom) throw erroCom;
      const comEle = (todos as { itens: Record<string, number> }[]).filter((p) => Object.keys(p.itens).some((k) => lerChave(k)?.id === existente.id));
      if (comEle.length > 0) return recusar(`${comEle.length === 1 ? 'Um pedido tem' : `${comEle.length} pedidos têm`} esse adesivo. Para tirá-lo da loja, esconda em vez de apagar.`);
      const { error } = await supabase.from('modelos_adesivos').delete().eq('id', existente.id);
      if (error) throw error;
      if (existente.imagem && !doSite(existente.imagem)) await supabase.storage.from(BUCKET).remove([existente.imagem]);
    } else if (acao) {
      return recusar('Ação desconhecida.');
    }

    if (acao && comissao && acao.endsWith('Modelo')) modelos = await lerModelos();

    // ---- What the page sees -----------------------------------------------
    const urlImagem = (caminho: string | null) =>
      !caminho ? null : doSite(caminho) ? caminho : supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
    const paraModelo = (m: LinhaModelo) => ({
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      imagem: urlImagem(m.imagem),
      crianca: m.crianca,
      ativo: m.ativo,
      camadas: m.camadas ?? [],
      dono: m.dono,
      // Only its owner opens it in the editor again.
      design: m.dono && m.dono === voce ? m.design : null,
    });
    // The committee sees everything; anyone else only the public models.
    const modelosPagina = modelos.filter((m) => comissao || (m.ativo && !m.dono)).map(paraModelo);

    if (!comissao && !voce) {
      // A number not on the list picks among the names that have none yet.
      let livres: string[] | null = null;
      if (typeof whatsapp === 'string') {
        const { data, error } = await supabase.from('convidados_formando').select('formando').is('whatsapp', null).order('formando');
        if (error) throw error;
        livres = data.map((f) => f.formando as string);
      }
      return json({ comissao, voce, livres, aberta, preco, modelos: modelosPagina, meu: null, fotoInfancia: null, enquadramento: null, pedidos: null, formandos: null, fotos: null, enquadramentos: null });
    }

    if (comissao) {
      const [pedidos, formandos, arquivos, quadros] = await Promise.all([
        supabase.from('pedidos_adesivos').select('formando, itens, observacao, pago, criado_em, atualizado_em').order('formando'),
        supabase.from('convidados_formando').select('formando').order('formando'),
        supabase.rpc('fotos_infancia_arquivos'),
        supabase.from('enquadramentos_infancia').select('formando, x, y, zoom'),
      ]);
      if (pedidos.error) throw pedidos.error;
      if (formandos.error) throw formandos.error;
      if (quadros.error) throw quadros.error;
      const enquadramentos = Object.fromEntries(quadros.data.map((q) => [q.formando, { x: q.x, y: q.y, zoom: q.zoom }]));
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
        preco,
        modelos: modelosPagina,
        meu: null,
        fotoInfancia: null,
        enquadramento: null,
        pedidos: (pedidos.data as Linha[]).map(paraPagina),
        formandos: nomes,
        fotos,
        enquadramentos,
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

    const [{ data: meu, error: erroMeu }, fotoInfancia, { data: quadro, error: erroQuadro }] = await Promise.all([
      supabase.from('pedidos_adesivos').select('formando, itens, observacao, pago, criado_em, atualizado_em').eq('formando', voce!).maybeSingle(),
      minhaFoto(),
      supabase.from('enquadramentos_infancia').select('x, y, zoom').eq('formando', voce!).maybeSingle(),
    ]);
    if (erroMeu) throw erroMeu;
    if (erroQuadro) throw erroQuadro;

    // A hidden model still in their order still shows, so it can be taken out.
    const noPedido = new Set(Object.keys((meu?.itens ?? {}) as Record<string, number>).map((k) => lerChave(k)?.id));
    const modelosFormando = modelos
      .filter((m) => (!m.dono || m.dono === voce) && (m.ativo || noPedido.has(m.id)))
      .map(paraModelo);

    return json({
      comissao,
      voce,
      livres: null,
      aberta,
      preco,
      modelos: modelosFormando,
      meu: meu ? paraPagina(meu as Linha) : null,
      fotoInfancia,
      enquadramento: quadro ? { x: quadro.x, y: quadro.y, zoom: quadro.zoom } : null,
      pedidos: null,
      formandos: null,
      fotos: null,
      enquadramentos: null,
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
