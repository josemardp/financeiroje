-- Evolução Estrutural T10.4 (Biblioteca ACF)
-- 1. Adicionar novas colunas (sem DEFAULT para book)
ALTER TABLE public.scripture_library 
  ADD COLUMN book text,
  ADD COLUMN chapter int,
  ADD COLUMN verse int,
  ADD COLUMN themes text[] NOT NULL DEFAULT '{}';

-- 2. Correção MANUAL dos 5 registros existentes da T10.2
UPDATE public.scripture_library SET book = 'Provérbios', chapter = 22, verse = 7,  themes = ARRAY['divida'] WHERE reference = 'Provérbios 22:7';
UPDATE public.scripture_library SET book = 'Lucas',      chapter = 14, verse = 28, themes = ARRAY['planejamento'] WHERE reference = 'Lucas 14:28';
UPDATE public.scripture_library SET book = 'Provérbios', chapter = 13, verse = 11, themes = ARRAY['trabalho'] WHERE reference = 'Provérbios 13:11';
UPDATE public.scripture_library SET book = 'Provérbios', chapter = 11, verse = 25, themes = ARRAY['generosidade'] WHERE reference = 'Provérbios 11:25';
UPDATE public.scripture_library SET book = 'Malaquias',  chapter = 3,  verse = 10, themes = ARRAY['dizimo'] WHERE reference = 'Malaquias 3:10';

-- 3. Enforce de restrições após limpeza manual
ALTER TABLE public.scripture_library ALTER COLUMN book SET NOT NULL;
ALTER TABLE public.scripture_library DROP COLUMN IF EXISTS theme;
ALTER TABLE public.scripture_library DROP COLUMN IF EXISTS reference;

ALTER TABLE public.scripture_library ADD CONSTRAINT scripture_library_unique_verse UNIQUE (book, chapter, verse);
CREATE INDEX idx_scripture_library_themes ON public.scripture_library USING GIN (themes);

-- 4. Seed Massiva (~40 versículos literais ACF)
INSERT INTO public.scripture_library (book, chapter, verse, text_acf, themes) VALUES
  ('Provérbios', 3, 9, 'Honra ao Senhor com a tua fazenda, e com as primícias de toda a tua renda;', ARRAY['dizimo','primicias','honra']),
  ('Provérbios', 3, 10, 'E se encherão os teus celeiros abundantemente, e transbordarão de mosto os teus lagares.', ARRAY['dizimo','primicias','provisao']),
  ('Mateus', 6, 33, 'Mas buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.', ARRAY['provisao','prioridades','fe']),
  ('Filipenses', 4, 19, 'O meu Deus, segundo as suas riquezas, suprirá todas as vossas necessidades em glória, por Cristo Jesus.', ARRAY['provisao','confianca']),
  ('Provérbios', 21, 5, 'Os pensamentos do diligente tendem à abundância, mas todo o apressado, à pobreza.', ARRAY['planejamento','diligencia','paciencia']),
  ('Romanos', 13, 8, 'A ninguém devais coisa alguma, a não ser o amor com que vos ameis uns aos outros;', ARRAY['divida','disciplina']),
  ('1 Timóteo', 6, 10, 'Porque o amor do dinheiro é a raiz de toda a espécie de males; e nessa cobiça alguns se desviaram da fé e se traspassaram a si mesmos com muitas dores.', ARRAY['riqueza','coracao','alerta']),
  ('Mateus', 6, 21, 'Porque onde estiver o vosso tesouro, aí estará também o vosso coração.', ARRAY['riqueza','coracao','prioridades']),
  ('Hebreus', 13, 5, 'Sejam vossos costumes sem avareza, contentando-vos com o que tendes; porque ele disse: Não te deixarei, nem te desampararei.', ARRAY['contentamento','avareza','provisao']),
  ('Lucas', 16, 10, 'Quem é fiel no pouco, também é fiel no muito; quem é injusto no pouco, também é injusto no muito.', ARRAY['fidelidade','integridade','disciplina']),
  ('Provérbios', 27, 23, 'Procura conhecer o estado das tuas ovelhas; põe o teu coração sobre o gado.', ARRAY['sabedoria','administracao','diligencia']),
  ('Provérbios', 21, 20, 'Tesouro desejável e azeite há na casa do sábio, mas o homem insensato os devora.', ARRAY['sabedoria','reserva','disciplina']),
  ('Provérbios', 24, 27, 'Prepara de fora a tua obra, e apronta-a no campo, e depois edifica a tua casa.', ARRAY['planejamento','ordem']),
  ('Eclesiastes', 11, 2, 'Reparte com sete, e ainda até com oito, porque não sabes que mal haverá sobre a terra.', ARRAY['sabedoria','planejamento','diversificacao']),
  ('Provérbios', 6, 6, 'Vai-te à formiga, ó preguiçoso; olha para os seus caminhos, e sê sábio.', ARRAY['trabalho','sabedoria','preparacao']),
  ('Salmos', 37, 21, 'O ímpio toma emprestado, e não paga; mas o justo se compadece, e dá.', ARRAY['divida','justica','generosidade']),
  ('Provérbios', 10, 4, 'O que trabalha com mão enganosa empobrece, mas a mão dos diligentes enriquece.', ARRAY['trabalho','diligencia','integridade']),
  ('Provérbios', 15, 16, 'Melhor é o pouco com o temor do Senhor do que um grande tesouro onde há inquietação.', ARRAY['temor_senhor','paz']),
  ('Provérbios', 15, 22, 'Onde não há conselho os projetos saem vãos, mas, com a multidão de conselheiros, se confirmam.', ARRAY['sabedoria','conselho']),
  ('Provérbios', 20, 21, 'A herança que no princípio é apressada, no fim não será abençoada.', ARRAY['riqueza','paciencia']),
  ('Provérbios', 28, 20, 'O homem fiel terá muitas bênçãos, mas o que se apressa a enriquecer não ficará inocente.', ARRAY['fidelidade','integridade']),
  ('Provérbios', 28, 22, 'Aquele que tem um olho mau corre atrás das riquezas, mas não sabe que há de vir sobre ele a pobreza.', ARRAY['avareza','alerta']),
  ('Mateus', 6, 24, 'Ninguém pode servir a dois senhores; porque ou há de odiar um e amar o outro, ou se dedicará a um e desprezará o outro. Não podeis servir a Deus e a Mamom.', ARRAY['prioridades','coracao']),
  ('Lucas', 12, 15, 'E disse-lhes: Acautelai-vos e guardai-vos da avareza; porque a vida de qualquer não consiste na abundância do que possui.', ARRAY['avareza','contentamento']),
  ('2 Coríntios', 9, 7, 'Cada um contribua segundo propôs no seu coração; não com tristeza, ou por necessidade; porque Deus ama ao que dá com alegria.', ARRAY['generosidade','dizimo']),
  ('Eclesiastes', 5, 10, 'O que amar o dinheiro nunca se fartará do dinheiro; e quem amar a abundância nunca se fartará da renda; também isto é vaidade.', ARRAY['riqueza','vaidade']),
  ('Salmos', 37, 25, 'Fui moço, e agora sou velho; mas nunca vi desamparado o justo, nem a sua semente a mendigar o pão.', ARRAY['provisao','justica']),
  ('Filipenses', 4, 11, 'Não digo isto como por necessidade, porque já aprendi a contentar-me com o que tenho.', ARRAY['contentamento']),
  ('Provérbios', 12, 11, 'O que lavra a sua terra se fartará de pão; mas o que segue os ociosos é falto de juízo.', ARRAY['trabalho','diligencia']),
  ('Provérbios', 12, 24, 'A mão dos diligentes dominará, mas os remissos serão tributários.', ARRAY['trabalho','diligencia']),
  ('Provérbios', 19, 17, 'Ao Senhor empresta o que se compadece do pobre, e ele lhe pagará o seu benefício.', ARRAY['generosidade','justica']),
  ('Provérbios', 23, 4, 'Não te fatigues para enriquecer; e desiste da tua própria sabedoria.', ARRAY['riqueza','prioridades']),
  ('Provérbios', 23, 5, 'Porventura fixarás os teus olhos naquilo que não é nada? Porque certamente criarão asas e voarão ao céu como a águia.', ARRAY['riqueza','alerta']),
  ('Lucas', 14, 29, 'Para que não aconteça que, depois de haver posto os alicerces, e não a podendo acabar, todos os que a virem comecem a escarnecer dele,', ARRAY['planejamento','sabedoria']),
  ('1 Timóteo', 6, 7, 'Porque nada trouxemos para este mundo, e manifesto é que nada podemos levar dele.', ARRAY['contentamento','vaidade']),
  ('1 Timóteo', 6, 8, 'Tendo, porém, sustento, e com que nos cobrirmos, estejamos com isso contentes.', ARRAY['contentamento','essencial']),
  ('Provérbios', 14, 23, 'Em todo trabalho há proveito, mas ficar só em palavras leva à pobreza.', ARRAY['trabalho','diligencia']),
  ('Salmos', 112, 5, 'O homem bom se compadece, e empresta; disporá as suas coisas com juízo.', ARRAY['generosidade','justica','prudencia'])
ON CONFLICT (book, chapter, verse) DO NOTHING;
