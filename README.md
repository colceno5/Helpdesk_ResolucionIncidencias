# Resolución de incidencias — Grupo Valora

Dashboard de cumplimiento SLA, tareas y tendencias del Service Desk, con una base
de datos que va acumulando los tickets y tareas de cada reporte de Aranda que subas
(no se pierde nada entre sesiones, y volver a subir un periodo ya cargado antes
actualiza esos registros en vez de duplicarlos).

## Qué hay en este proyecto

- `public/app.html` — el dashboard en sí (tablas, gráficas, filtros, modal de
  tareas por caso). Es el mismo aplicativo que ya conocías, con tres cambios:
  título "Resolución de incidencias", tema de color y banner de ValorA, y la
  conexión a la base de datos.
- `app/api/tickets/route.js`, `app/api/tasks/route.js` — reciben lo que se sube
  desde el navegador y lo guardan (o lo actualizan si el ticket/tarea ya existía).
- `lib/db.js` — crea las tablas la primera vez que hace falta.
- `app/page.js` — la raíz del sitio (`/`) simplemente te manda a `/app.html`.

## Cómo se guarda la información

Cada vez que subes un archivo, el navegador lo procesa exactamente igual que
antes y, además, manda esa información a `/api/tickets` o `/api/tasks`, que la
guarda en una base de datos Postgres. La clave de cada registro es el **Numero
de Ticket** o el **número de Tarea** — si ese ticket ya existía, se actualiza;
si es nuevo, se agrega. Así el histórico crece solo, sin importar en qué orden
subas los archivos ni cuántas veces repitas uno.

Al abrir la página, se trae automáticamente todo lo guardado hasta ese momento
y se muestra igual que si acabaras de subir un archivo con todo ese histórico.

**Una limitación a tener en cuenta:** por ahora solo se guardan los tickets
evaluables (no Cancelado, con progreso legible) y las tareas — que es lo que
alimenta todo el análisis de SLA, ranking y tendencias. El aviso de "ráfaga de
tickets duplicados" y el conteo de "Cancelados" son diagnósticos pensados para
revisar justo después de subir un archivo, y solo reflejan la última sábana que
subiste en tu sesión actual, no el histórico completo guardado en la base de
datos. Si más adelante quieres que también quede guardado, es un cambio
sencillo de pedir.

## Desplegar en Vercel

No puedo hacer clic por ti en vercel.com (no tengo acceso a tu cuenta ni a un
navegador), pero el proyecto ya está listo — probé que compila (`next build`)
y que el servidor arranca sin errores. Estos son los pasos, tal cual:

### 1. Sube este proyecto a GitHub

```bash
cd resolucion-incidencias
git init
git add .
git commit -m "Resolución de incidencias"
```

Crea un repositorio vacío en GitHub y sigue las instrucciones para subir lo que
acabas de commitear (`git remote add origin ...` y `git push`).

### 2. Importa el repositorio en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Elige el repositorio que acabas de subir.
3. Vercel detecta que es un proyecto Next.js automáticamente — no hace falta
   tocar nada en "Build settings". Dale a **Deploy**.

En este punto el sitio ya queda publicado, pero la base de datos todavía no
está conectada (verás un error si intentas subir un archivo).

### 3. Conecta una base de datos Postgres

1. Dentro de tu proyecto en Vercel, ve a la pestaña **Storage**.
2. Elige **Create Database → Postgres** (Vercel usa Neon por debajo; el plan
   gratuito alcanza de sobra para esto).
3. Cuando termine de crearse, Vercel te va a ofrecer **conectarla al proyecto**
   — acéptalo. Esto agrega automáticamente la variable de entorno `POSTGRES_URL`
   (y las relacionadas) que `lib/db.js` necesita, sin que tengas que copiar
   ninguna clave a mano.
4. Vercel te va a pedir **volver a desplegar** (Redeploy) para que la nueva
   variable de entorno tome efecto. Acéptalo.

Las tablas (`tickets` y `tasks`) se crean solas la primera vez que alguien sube
un archivo o abre el dashboard — no hay que correr ningún script de base de
datos a mano.

### 4. Probarlo

Abre la URL que te dio Vercel, sube tu sábana de tickets como siempre, y
recarga la página — deberías ver el mismo histórico sin haber vuelto a subir
nada. Si algo falla, revisa la pestaña **Logs** de tu proyecto en Vercel; los
errores de conexión a la base de datos salen ahí con un mensaje claro.

## Desarrollo local (opcional)

```bash
npm install
npm run dev
```

Sin una base de datos conectada, el dashboard funciona igual que la versión de
un solo archivo de siempre (subes un archivo, lo analizas), solo que no guarda
nada entre sesiones — es una degradación intencional, no un error, para que
puedas probar la interfaz sin depender de Postgres.

Para probar la persistencia en local, crea una base de datos Postgres (por
ejemplo con Neon, Supabase, o Postgres en Docker) y agrega un archivo
`.env.local` con:

```
POSTGRES_URL="postgres://usuario:clave@host:5432/basededatos"
```
