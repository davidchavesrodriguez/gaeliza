![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Versión](https://img.shields.io/badge/Versión-1.0.0-blueviolet?style=flat-square)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)

Gaeliza é unha aplicación web deseñada para mellorar o aspecto dixital do **análise de partidos de fútbol gaélico galego**. Este é o deporte rei en Irlanda mais a súa expansión mundial non é tan esaxerada coma a de outros deportes, polo que ao ser un deporte minoritario non conta con tantas alternativas dixitais coma o resto. Podes encontrar máis información sobre este deporte en páxinas como:
- [A web oficial da GAA (Gaelic Athletic Association)](https://www.gaa.ie/)
- [A web oficial da asociación galega](https://gaelicogalego.gal/)
- [A conta de instagram do meu equipo :)](https://www.instagram.com/gb.lorchos/)

Por eso, o seu principal obxectivo é o eliminar o uso de anticuadas follas de cálculo ou mesmo papel e boli cara unha ferramenta dixital e máis intuitiva.

A aplicación permite a calquera (sexa adestrador, xogador, árbitro ou totalmente alleo ao deporte) crear partidos, xestionar convocatorias e, o máis importante, rexistrar en tempo real ou en diferido todo o sucedido no campo: goles, puntos, faltas, penaltis, sancións...
Este análise realizarase cun sistema de botóns plenamente intuitivo, incluso para xente allea ou nova no deporte. O sistema permite ademais compartir un análise mediante a descarga dun pdf onde se amosarán os detalles do partido.

## Uso

### Usuarios  

Pódese acceder á aplicación mediante a seguinte URL: https://gaeliza.dchaves.gal/

### Desenvolvedores

Neste apartado vou definir os pasos necesarios para que calquera poida descargar o proxecto e continuar co desenvolvemento da aplicación. O seu sistema divídese en dous compoñentes principais: 
- Base de datos e Backend (BaaS): Supabase
- Frontend: React

#### 1- Requisitos previos  

Para executar o proxecto localmente é necesario ter instalado o seguinte software:
- Node.js e npm para o frontend.
- Unha conta activa en Supabase para o backend e os datos.
- Git para o control de versións.

#### 2- Clonado de repositorio

Primero débese obter unha copia do código fonte do proxecto co seguinte comando:

```bash
git clone https://github.com/davidchavesrodriguez/gaeliza
```

#### 3- Configuración de backend e base de datos

Como xa se dixo, o proxecto utiliza Supabase como BaaS para a autenticación e a persistencia dos datos. O xeito para utilizarlo é o seguinte:
1. Crear un novo proxecto no panel de control de Supabase.
2. Executar o seguinte SQL:
```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.actions (
  id integer NOT NULL DEFAULT nextval('actions_id_seq'::regclass),
  match_id integer NOT NULL,
  player_id integer,
  type text NOT NULL,
  minute integer NOT NULL,
  second integer DEFAULT 0,
  x_position numeric,
  y_position numeric,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  team_id bigint NOT NULL,
  subtype text,
  CONSTRAINT actions_pkey PRIMARY KEY (id),
  CONSTRAINT actions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT actions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT actions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.match_participants (
  id integer NOT NULL DEFAULT nextval('match_participants_id_seq'::regclass),
  match_id integer NOT NULL,
  player_id integer NOT NULL,
  team_id integer NOT NULL,
  position text,
  minutes_played integer DEFAULT 0,
  CONSTRAINT match_participants_pkey PRIMARY KEY (id),
  CONSTRAINT match_participants_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT match_participants_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT match_participants_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.matches (
  id integer NOT NULL DEFAULT nextval('matches_id_seq'::regclass),
  home_team_id integer NOT NULL,
  away_team_id integer NOT NULL,
  match_date timestamp with time zone NOT NULL,
  location text,
  competition text,
  video_url text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id),
  CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id),
  CONSTRAINT matches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT fk_matches_profiles FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.players (
  id integer NOT NULL DEFAULT nextval('players_id_seq'::regclass),
  first_name text NOT NULL,
  last_name text NOT NULL,
  number integer,
  team_id integer,
  created_at timestamp with time zone DEFAULT now(),
  type USER-DEFINED,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.subscriptions (
  id integer NOT NULL DEFAULT nextval('subscriptions_id_seq'::regclass),
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'unpaid'::text, 'trialing'::text])),
  plan_type text NOT NULL CHECK (plan_type = ANY (ARRAY['free'::text, 'premium'::text])),
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.teams (
  id integer NOT NULL DEFAULT nextval('teams_id_seq'::regclass),
  name text NOT NULL,
  shield_url text,
  type text DEFAULT 'temporal'::text CHECK (type = ANY (ARRAY['oficial'::text, 'temporal'::text])),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  gender USER-DEFINED,
  parent_team_id bigint,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT teams_parent_team_id_fkey FOREIGN KEY (parent_team_id) REFERENCES public.teams(id)
);
```

#### 4- Configuración do frontend  

O frontend é unha SPA contruída con React e Vite. Os pasos para configuralo son os seguintes:
1. Navegar ao directorio axeitado:
```bash
cd gaeliza-frontend
```
2. Instalar as dependencias:
```bash
npm install
```
3. Crear un ficheiro .env coas variables de conexión a Supabase:
```bash
SUPABASE_URL=https://<proxecto>.supabase.co
SUPABASE_ANON_KEY=<anon_key>
```
4. Iniciar o servidor de desenvolvemento:
```bash
npm run dev
```
A aplicación web abrirase en http://localhost:5173

## Sobre a persoa autora

Son David Chaves Rodríguez, desenvolvedor web e apaixonado do fútbol gaélico. Durante a miña formación, tanto no IES San Clemente como autodidacta, deime conta do poderosa que é a programación e o desenvolvemente de aplicacións: podes crear calquer cousa que imaxines!
Con este pensamento e vendo como compañeiros do meu deporte analizaban o partido (follas de cálculo, a aplicación de notas do mobil, papeis emborronados...) decanteime por acabar con estas prácticas e codificar algo que poida ser usado por todos nós para mellorar e dixitalizar este deporte en auxe en Galicia.
Podes contactar conmigo a través de:
- Email: 19.dchaves@gmail.com
- Linkedin: https://www.linkedin.com/in/chaves19/

## Licencia

Este proxecto distribúese baixo a licenza MIT. Isto significa que es libre de usar, copiar, modificar, fusionar, publicar, distribuír, sublicenciar e/ou vender copias do software, sempre que se inclúa o aviso de copyright e a licenza orixinais.

Para máis detalles, consulta o ficheiro LICENSE na raíz deste repositorio.

## Guía de contribución

Gaeliza é un proxecto de software libre e toda contribución é benvida. Existen varias formas de axudar:
- **Probar a app e reportar erros**: Os fallos encontrados poden ser escritos nos *issues* do repositorio ou directamente a min, o autor, mediante os contactos previamente descritos
- **Novas funcionalidades**: Cres que podes mellorar ou añadir funcións á web? Podes facer un *fork* do repositorio, implementar a mellora nunha nova rama e facer unha *pull request*. Estarei atento a elas!
