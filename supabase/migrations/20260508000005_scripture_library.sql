-- supabase/migrations/20260508000005_scripture_library.sql
CREATE TABLE public.scripture_library (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme       text NOT NULL,
  reference   text NOT NULL,
  text_acf    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed determinística de versículos financeiros (ACF)
INSERT INTO public.scripture_library (theme, reference, text_acf) VALUES
  ('divida', 'Provérbios 22:7', 'O rico domina sobre os pobres, e o que toma emprestado é servo do que empresta.'),
  ('planejamento', 'Lucas 14:28', 'Pois qual de vós, querendo edificar uma torre, não se assenta primeiro a fazer as contas dos gastos, para ver se tem com que a acabar?'),
  ('trabalho', 'Provérbios 13:11', 'A fazenda que procede da vaidade se diminuirá, mas quem a ajunta pelo seu trabalho terá aumento.'),
  ('generosidade', 'Provérbios 11:25', 'A alma generosa prosperará, e aquele que regar também será regado.'),
  ('dizimo', 'Malaquias 3:10', 'Trazei todos os dízimos à casa do tesouro, para que haja mantimento na minha casa, e depois fazei prova de mim nisto, diz o Senhor dos Exércitos, se eu não vos abrir as janelas do céu e não derramar sobre vós uma bênção tal até que não haja lugar suficiente para a recolherdes.');
