import { redirect } from 'next/navigation';

// El dashboard vive como HTML estático en /public/app.html (toda la lógica de
// lectura de Excel, tablas, gráficas y modal es JavaScript de navegador, sin
// dependencias de React) para no reescribir ni arriesgar esa lógica ya probada.
// Esta página solo redirige la raíz del sitio hacia ese archivo.
export default function Home() {
  redirect('/app.html');
}
