#!/usr/bin/env tsx
/**
 * Seed dos compromissos do Manual 30 Dias — Esdra Cosméticos.
 *
 * Uso:
 *   SEED_START_DATE=2026-06-22 npx tsx scripts/seed-manual-esdra.ts
 *
 * Variáveis necessárias em .env.local:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (Supabase Dashboard → Settings → API → service_role)
 *
 * Variáveis opcionais:
 *   SEED_START_DATE    (default: 2026-06-22)
 *   SEED_USER_EMAIL    (default: conta-pessoal@exemplo.com)
 *
 * É idempotente: apaga o ciclo existente no intervalo de datas antes de reinserir.
 */
import { createClient } from "@supabase/supabase-js"
import * as path from "node:path"
import * as dotenv from "dotenv"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ""
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
const START_DATE = process.env.SEED_START_DATE ?? "2026-06-22"
const USER_EMAIL = process.env.SEED_USER_EMAIL ?? "conta-pessoal@exemplo.com"

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltam variáveis: VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function toDate(startDateStr: string, dayNum: number): string {
  const d = new Date(startDateStr + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + (dayNum - 1))
  return d.toISOString().split("T")[0]
}

type Nivel = "minimo_viavel" | "ideal"
type Operador = "josemar" | "esdra"

interface CompromissoInput {
  dia: number
  operador: Operador
  bloco: string
  descricao: string
  nivel: Nivel
  tempo_estimado_min: number
  ordem: number
}

// ─────────────────────────────────────────────────────────────
// SEED DATA — extraído do MANUAL_30_DIAS_ESDRA.md v1.0
// Domingos (dias 3, 10, 17, 24) = descanso, sem compromissos.
// ─────────────────────────────────────────────────────────────
const COMPROMISSOS: CompromissoInput[] = [
  // ── DIA 1 ──
  { dia:1, operador:"josemar", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:45, ordem:1,
    descricao:"Criar planilha ESDRA_OPERACAO_2026 com 4 abas: Estoque, Clientes, Vendas_Semanais, Decisoes. Compartilhar com Esdra. Configurar colunas de Decisões Semanais (Semanas 1–4)." },
  { dia:1, operador:"josemar", bloco:"planejamento", nivel:"ideal", tempo_estimado_min:75, ordem:2,
    descricao:"Estruturar abas Estoque e Clientes com todas as colunas. Criar pasta Google Drive 'Esdra_Cosmeticos_2026' e salvar a planilha lá." },
  { dia:1, operador:"esdra", bloco:"atendimento", nivel:"minimo_viavel", tempo_estimado_min:180, ordem:3,
    descricao:"Atendimento normal do dia. Listar mentalmente as 10 clientes que mais compram: anotar nome e telefone." },
  { dia:1, operador:"esdra", bloco:"crm", nivel:"ideal", tempo_estimado_min:180, ordem:4,
    descricao:"Começar CRM: transferir agenda mental para aba Clientes. Meta: 30 nomes com nome, telefone, cidade e marca favorita." },

  // ── DIA 2 ──
  { dia:2, operador:"josemar", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:30, ordem:1,
    descricao:"Conferir se a planilha está acessível no celular da Esdra. Anotar dúvidas do Dia 1 para resolver na segunda." },
  { dia:2, operador:"esdra", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:120, ordem:2,
    descricao:"Atendimento de pedidos. Continuar lista de clientes na planilha — meta acumulada: 50 nomes." },
  { dia:2, operador:"esdra", bloco:"estoque", nivel:"ideal", tempo_estimado_min:120, ordem:3,
    descricao:"Identificar nas prateleiras/caixas os 10 produtos sem venda há 3+ meses. Anotar nome e quantidade." },

  // DIA 3 = DESCANSO

  // ── DIA 4 ──
  { dia:4, operador:"josemar", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Revisar aba Clientes preenchida pela Esdra. Categorizar: VIP (2x+/mês), Ativa (1x/mês), Inativa (90+ dias sem compra)." },
  { dia:4, operador:"josemar", bloco:"crm", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Filtrar Inativas e criar lista para campanha de reativação (Dia 11). Identificar VIPs com aniversário em maio/junho." },
  { dia:4, operador:"esdra", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento normal. Preencher mais 30 clientes — meta acumulada: 80 nomes." },
  { dia:4, operador:"esdra", bloco:"estoque", nivel:"ideal", tempo_estimado_min:240, ordem:4,
    descricao:"Auditoria de estoque: 1 caixa/prateleira por vez. Meta hoje: 30 SKUs cadastradas." },

  // ── DIA 5 ──
  { dia:5, operador:"josemar", bloco:"estoque", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Trabalhar com Esdra no estoque: calcular margem real de cada produto. Identificar candidatos a liquidar (margem >30%, parado 60+d ou próximo da validade)." },
  { dia:5, operador:"josemar", bloco:"estoque", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Configurar fórmulas Curva_ABC e Dias_Parado na planilha. Criar aba Dashboard com 5 indicadores: Total_Estoque_R$, SKUs, SKUs_Parados, Margem_Média, Capital_Liquidável." },
  { dia:5, operador:"esdra", bloco:"estoque", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento normal. Continuar cadastro de estoque — meta acumulada: 80 SKUs." },
  { dia:5, operador:"esdra", bloco:"crm", nivel:"ideal", tempo_estimado_min:240, ordem:4,
    descricao:"Completar cadastro de clientes — meta: 100 clientes ativas mapeadas." },

  // ── DIA 6 ──
  { dia:6, operador:"josemar", bloco:"tecnologia", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Configurar GA4 (G-NV2Q60QZR1): eventos de clique em produto e 'Comprar via WhatsApp'. Criar 3 links UTM (Instagram, catálogo WhatsApp, grupo VIP). Documentar na planilha." },
  { dia:6, operador:"josemar", bloco:"tecnologia", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Listar as 20 SKUs prioritárias para o site (alta margem + alta rotatividade + estoque saudável). Se sobrar: melhorar seção incompleta no site." },
  { dia:6, operador:"esdra", bloco:"marketing", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento normal. Tirar fotos das 10 primeiras SKUs prioritárias (luz natural, fundo neutro). Salvar no Drive." },
  { dia:6, operador:"esdra", bloco:"marketing", nivel:"ideal", tempo_estimado_min:240, ordem:4,
    descricao:"Tirar foto das outras 10 SKUs (total: 20). Escrever 1 frase de descrição para cada. Salvar em planilha auxiliar." },

  // ── DIA 7 ──
  { dia:7, operador:"josemar", bloco:"tecnologia", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Subir as 20 SKUs no site: foto + título + descrição + preço + link WhatsApp com mensagem pré-definida para cada produto." },
  { dia:7, operador:"josemar", bloco:"tecnologia", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Testar fluxo completo: cliente → site → produto → WhatsApp → mensagem na Esdra. Redigir rascunho de mensagem de reativação para Dia 11." },
  { dia:7, operador:"esdra", bloco:"tecnologia", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento normal. Validar no celular que as 20 SKUs estão visíveis no site. Anotar erros (foto ruim, preço errado)." },
  { dia:7, operador:"esdra", bloco:"marketing", nivel:"ideal", tempo_estimado_min:240, ordem:4,
    descricao:"Divulgar o site entre clientes ativas com mensagem padrão + link esdracosmeticos.com.br." },

  // ── DIA 8 ──
  { dia:8, operador:"josemar", bloco:"financeiro", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Fechamento Semana 1: preencher os 7 KPIs (Faturamento, Pedidos, Ticket Médio, Clientes Ativas, Reativadas, Capital Liquidado, Visitas GA4)." },
  { dia:8, operador:"josemar", bloco:"decisao", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Registrar Decisão Semana 1: % do estoque a comprometer na liquidação (critério: preservar caixa 60d + liberar ≥R$15k)." },
  { dia:8, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento normal + Lançar Campanha de Liquidação: mensagem para 30 clientes ativas com 3 produtos em desconto (15–25%). Enviar à tarde para gerar venda no fim de semana." },

  // ── DIA 9 ──
  { dia:9, operador:"josemar", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:30, ordem:1,
    descricao:"Conferir como a Campanha de Liquidação está performando: respostas recebidas, conversões. Anotar aprendizados na planilha." },
  { dia:9, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:2,
    descricao:"Atendimento ativo das respostas da campanha. Entregas pontuais." },

  // DIA 10 = DESCANSO

  // ── DIA 11 ──
  { dia:11, operador:"josemar", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Revisar resultado da Campanha de Liquidação: quanto foi liquidado em R$, margem obtida. Atualizar dashboard." },
  { dia:11, operador:"josemar", bloco:"crm", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Preparar Campanha de Reativação: lista de 30 inativas + mensagem personalizada por categoria de cliente." },
  { dia:11, operador:"esdra", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento normal. Enviar mensagens de reativação para 10 clientes inativas (não mais que 10/dia — sobrecarga reduz resposta)." },
  { dia:11, operador:"esdra", bloco:"marketing", nivel:"ideal", tempo_estimado_min:240, ordem:4,
    descricao:"Gravar 1 vídeo curto (60s) por dia apresentando 1 produto: celular, vertical, sem edição. Salvar no Drive." },

  // ── DIA 12 ──
  { dia:12, operador:"josemar", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Acompanhar respostas da reativação: quantas responderam e converteram. Mover de 'Inativa' para 'Ativa' na planilha quem retornou." },
  { dia:12, operador:"josemar", bloco:"tecnologia", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Configurar InfinitePay ou Mercado Pago no site (pix + cartão). Testar fluxo de pagamento: comprar R$1, validar, estornar." },
  { dia:12, operador:"esdra", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento normal. Mais 10 mensagens de reativação — cumulativo: 20 inativas contactadas." },
  { dia:12, operador:"esdra", bloco:"marketing", nivel:"ideal", tempo_estimado_min:240, ordem:4,
    descricao:"Gravar 1 vídeo novo. Começar a postar no Instagram da Esdra Cosméticos: 1 reel + 1 post por dia." },

  // ── DIA 13 ──
  { dia:13, operador:"josemar", bloco:"marketing", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Revisar GA4: visitas dos últimos 7 dias e cliques no botão WhatsApp. Documentar primeira venda real pelo site (se já ocorreu)." },
  { dia:13, operador:"josemar", bloco:"tecnologia", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Subir mais 10 SKUs no site (cumulativo: 30). Reorganizar homepage para destacar as 5 SKUs com maior margem." },
  { dia:13, operador:"esdra", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento. Mais 10 reativações (cumulativo: 30 — encerra o ciclo desta rodada). Continuar conteúdo diário no Instagram." },

  // ── DIA 14 ──
  { dia:14, operador:"josemar", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Identificar clientes VIP/ativas com aniversário nos próximos 7 dias. Preparar mensagem personalizada de parabéns + brinde (amostra grátis no próximo pedido)." },
  { dia:14, operador:"josemar", bloco:"planejamento", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Estudar 1h: Mercado Livre Vendedor (vídeo oficial YouTube). Não para abrir conta agora — para conhecer o terreno antes da Fase 2." },
  { dia:14, operador:"esdra", bloco:"crm", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento. Enviar mensagens de aniversário para a lista da semana. Conteúdo diário no Instagram." },

  // ── DIA 15 ──
  { dia:15, operador:"josemar", bloco:"financeiro", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Fechamento Semana 2: 7 KPIs. Comparar com Semana 1 — o que cresceu, o que estagnou." },
  { dia:15, operador:"josemar", bloco:"decisao", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Registrar Decisão Semana 2: reativação vs fortalecer VIPs — onde focar energia com base no ticket médio e LTV real das clientes." },
  { dia:15, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Segunda Campanha de Liquidação: 3 SKUs diferentes da Semana 1, mensagem para 40 clientes ativas, foco em produtos parados >90 dias." },

  // ── DIA 16 ──
  { dia:16, operador:"josemar", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:30, ordem:1,
    descricao:"Conferir resultados da campanha de liquidação da semana. Anotar dúvidas." },
  { dia:16, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:2,
    descricao:"Atendimento ativo das respostas da campanha. Entregas." },

  // DIA 17 = DESCANSO

  // ── DIA 18 ──
  { dia:18, operador:"josemar", bloco:"operacional", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Identificar 2–3 motoboys parceiros em Valparaíso/Guararapes (R$8–12/entrega). Listar candidatos na planilha: nome, contato, área, custo." },
  { dia:18, operador:"josemar", bloco:"operacional", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Calcular horas semanais da Esdra em entregas × R$25/hora vs custo do motoboy. Diferença = ganho real do destrave operacional." },
  { dia:18, operador:"esdra", bloco:"operacional", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento normal. Começar a delegar 30% das entregas (as mais distantes ou demoradas)." },
  { dia:18, operador:"esdra", bloco:"operacional", nivel:"ideal", tempo_estimado_min:240, ordem:4,
    descricao:"Pesquisar identidade visual de embalagem: sacola kraft + adesivo da marca (custo R$1–2/pedido). Solicitar orçamento em 2 gráficas locais." },

  // ── DIA 19 ──
  { dia:19, operador:"josemar", bloco:"marketing", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Configurar Google Meu Negócio para Esdra Cosméticos: endereço (CEP residencial), foto virtual, descrição. Presença no Maps é grátis e gera tráfego orgânico." },
  { dia:19, operador:"josemar", bloco:"tecnologia", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Configurar fluxos no WhatsApp Business: saudação fora do horário + aviso de pedido recebido. Manter atendimento humano como diferencial." },
  { dia:19, operador:"esdra", bloco:"operacional", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento. Validar motoboy com 2–3 entregas teste. Conteúdo no Instagram." },

  // ── DIA 20 ──
  { dia:20, operador:"josemar", bloco:"tecnologia", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Subir mais 10 SKUs no site (cumulativo: 40). Adicionar seções 'Mais Vendidas' e 'Promoção da Semana' na homepage." },
  { dia:20, operador:"josemar", bloco:"marketing", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Configurar pixel da Meta no site (sem fazer anúncio agora — coletar audiência para quando chegar o momento)." },
  { dia:20, operador:"esdra", bloco:"atendimento", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento. Conteúdo. Avaliar motoboy: tempo de entrega, satisfação da cliente, deu certo?" },

  // ── DIA 21 ──
  { dia:21, operador:"josemar", bloco:"estoque", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Análise de margem por marca na planilha de estoque: calcular margem média de cada marca. Identificar as 3 mais rentáveis e as 3 menos." },
  { dia:21, operador:"josemar", bloco:"planejamento", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Estudar política de revenda de Boticário, Eudora e Natura (termos, grupos de revendedores). Documentar restrições para decisão futura." },
  { dia:21, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento. Conteúdo. Lançar Programa de Indicação: R$20 de crédito para cliente que indicar amiga que comprar." },

  // ── DIA 22 ──
  { dia:22, operador:"josemar", bloco:"financeiro", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Fechamento Semana 3: 7 KPIs. Comparativo: capital liquidado acumulado em 22 dias vs meta R$15k–20k. Quanto falta?" },
  { dia:22, operador:"josemar", bloco:"decisao", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Registrar Decisão Semana 3: avaliar 3 marcas menos rentáveis — continuar ou descontinuar em favor de marcas com maior margem e demanda real." },
  { dia:22, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Terceira Campanha de Liquidação: focar em produtos próximos da validade e itens C da curva ABC." },

  // ── DIA 23 ──
  { dia:23, operador:"josemar", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:30, ordem:1,
    descricao:"Acompanhamento da campanha de liquidação da semana." },
  { dia:23, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:2,
    descricao:"Atendimento + entregas." },

  // DIA 24 = DESCANSO

  // ── DIA 25 ──
  { dia:25, operador:"josemar", bloco:"financeiro", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Compilar dados das 3 semanas em dashboard mensal: faturamento total, margem média, capital liquidado, novas clientes, reativadas." },
  { dia:25, operador:"josemar", bloco:"planejamento", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Comparar com baseline de R$10k/mês: crescimento real, composição diferente da receita, onde veio a diferença." },
  { dia:25, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento. Conteúdo. Continuar liquidação se ainda não atingiu meta de R$15k–20k." },

  // ── DIA 26 ──
  { dia:26, operador:"josemar", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Auditoria do que NÃO funcionou: 3 coisas do plano que falharam ou foram abandonadas. Não para se culpar — para ajustar o próximo ciclo." },
  { dia:26, operador:"josemar", bloco:"planejamento", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Auditoria do que funcionou: 3 ações que mais geraram resultado (vendas, margem ou tempo liberado)." },
  { dia:26, operador:"esdra", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento. Conteúdo. Conversa estratégica com Josemar: o que está pesado, o que está leve, o que quer mudar." },

  // ── DIA 27 ──
  { dia:27, operador:"josemar", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Avaliação de contratação com os números do mês: cabe contratar 1 pessoa part-time (R$800–1.200/mês)? Quando? Quem?" },
  { dia:27, operador:"josemar", bloco:"tecnologia", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Revisar o site: quantidade de SKUs, funcionalidade, listar melhorias para o próximo mês." },
  { dia:27, operador:"esdra", bloco:"atendimento", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento + Conteúdo." },

  // ── DIA 28 ──
  { dia:28, operador:"josemar", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Esboçar Plano dos próximos 30 dias: 3 prioridades máximas com base no aprendizado do ciclo atual." },
  { dia:28, operador:"josemar", bloco:"decisao", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Decidir com critério escrito: marketplaces no próximo ciclo? Tráfego pago? Contratação? Cada decisão precisa de justificativa escrita." },
  { dia:28, operador:"esdra", bloco:"vendas", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento + Conteúdo + última campanha do mês se necessário." },

  // ── DIA 29 ──
  { dia:29, operador:"josemar", bloco:"financeiro", nivel:"minimo_viavel", tempo_estimado_min:60, ordem:1,
    descricao:"Fechamento Semana 4 + Fechamento do Mês: KPIs finais consolidados. Registrar Decisão Semana 4: onde alocar os próximos R$5.000 (tráfego pago, marketplaces, contratação ou estoque de marcas rentáveis)." },
  { dia:29, operador:"josemar", bloco:"planejamento", nivel:"ideal", tempo_estimado_min:60, ordem:2,
    descricao:"Reunião de 1h com Esdra: revisar o mês, celebrar conquistas, alinhar o próximo ciclo." },
  { dia:29, operador:"esdra", bloco:"atendimento", nivel:"minimo_viavel", tempo_estimado_min:240, ordem:3,
    descricao:"Atendimento + fechamento do mês da Esdra." },

  // ── DIA 30 ──
  { dia:30, operador:"josemar", bloco:"planejamento", nivel:"minimo_viavel", tempo_estimado_min:30, ordem:1,
    descricao:"Escrever relatório mensal pessoal: 'O que aprendi sobre empreendedorismo neste mês.' Registro do seu crescimento — não é relatório de empresa." },
  { dia:30, operador:"josemar", bloco:"planejamento", nivel:"ideal", tempo_estimado_min:30, ordem:2,
    descricao:"Decidir formalmente as 3 prioridades do próximo mês. Escrever na planilha." },
  { dia:30, operador:"esdra", bloco:"atendimento", nivel:"minimo_viavel", tempo_estimado_min:120, ordem:3,
    descricao:"Atendimento de manhã. À tarde: descanso merecido — o mês foi pesado." },
]

async function main() {
  console.log(`\nSeed — ciclo inicia em ${START_DATE} (Dia 1 = ${START_DATE})`)

  // Buscar user_id via admin API
  const { data: { users: authUsers }, error: authErr } =
    await supabase.auth.admin.listUsers({ perPage: 50 })
  if (authErr) { console.error("Erro ao buscar usuários:", authErr); process.exit(1) }

  const user = authUsers.find((u) => u.email === USER_EMAIL)
  if (!user) { console.error(`Usuário não encontrado: ${USER_EMAIL}`); process.exit(1) }

  const userId = user.id
  const startDate = START_DATE
  const endDate = toDate(START_DATE, 30)
  console.log(`User: ${USER_EMAIL} (${userId})`)
  console.log(`Intervalo: ${startDate} → ${endDate}`)

  // Deletar ciclo existente (idempotência)
  const { error: delErr } = await supabase
    .from("esdra_compromissos_diarios")
    .delete()
    .eq("user_id", userId)
    .gte("data", startDate)
    .lte("data", endDate)
  if (delErr) { console.error("Erro ao deletar:", delErr); process.exit(1) }

  // Inserir
  const rows = COMPROMISSOS.map((c) => ({
    user_id: userId,
    data: toDate(START_DATE, c.dia),
    operador: c.operador,
    bloco: c.bloco,
    descricao: c.descricao,
    nivel: c.nivel,
    tempo_estimado_min: c.tempo_estimado_min,
    status: "pendente" as const,
    ordem: c.ordem,
  }))

  const { error: insErr } = await supabase.from("esdra_compromissos_diarios").insert(rows)
  if (insErr) { console.error("Erro ao inserir:", insErr); process.exit(1) }

  // Validação
  const { count } = await supabase
    .from("esdra_compromissos_diarios")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("data", startDate)
    .lte("data", endDate)

  console.log(`\n✅ ${rows.length} compromissos inseridos`)
  console.log(`   Banco confirmou: ${count} linhas`)
  console.log(`   Dias de descanso: 3, 10, 17, 24 (sem compromissos)\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
