# FUNVS · Pendientes

Ideas y cosas que quedaron para hacer más adelante.

## ⚽ Fulbito
- **Medios por club**: para cada club, guardar uno o más canales de YouTube donde suban postpartido, opiniones partidarias y reacciones de hinchas. Así, si un equipo gana o pierde, se puede ver "su mundo" (ej.: el mundo Vélez, con sus chistes internos). Ideas: elegir los canales de cada club, que después de cada partido aparezcan sus videos nuevos junto al resultado, y una pestaña "Medios" dentro de Fulbito.

## 📺 General
- **Control remoto desde el celu** (anotado 8/11): el celu le manda órdenes a la tele por un canal con nombre secreto (ntfy.sh): canal, volumen, buscar con el teclado del celu. Va en el próximo paquete.
- ~~Pasar FUNVS al Fire Stick / APK~~ (hecho: Releases → FUNVS.apk).
- **Redes**: accesos directos a X y Reddit, o probar la API de Reddit.
- **Automatizaciones** (radio a cierta hora, abrir el partido de Vélez solo, resumen del día): recordatorio programado para el 20/11.
- **Mundo Vélez**: resumen de lo que se habló en los directos (transcripciones).
- **Boxeo**: conseguir una fuente con la agenda de veladas (día, hora y canal).

## 📡 Próximo paquete de grafismo (elegido el 8/11, se hace todo junto con el control desde el celu)
- **Barra "Ahora / A continuación" al hacer zapping**: número y logo del canal, programa actual con barrita de avance y el que sigue.
- **Arreglar la guía en el Fire Stick**: hoy no se puede recorrer con el control (los bloques de la grilla no se pueden seleccionar). Que se mueva con las flechas y OK ponga el canal.
- **Placa roja de ÚLTIMO MOMENTO**: abajo, en el lugar de FUNVS AL MINUTO; tiene prioridad (si cae en los 10 minutos del minuto a minuto, lo reemplaza) y dura 1 minuto como máximo.
- **Zócalo de TV para avisos**: recordatorios y goles de otros equipos como zócalo, no como cartelito.
- **Clima completo** a las 8, 18 y 22 h: pronóstico de hoy y mañana y alerta si hay tormenta.
- **"Mientras tanto…"**: durante el partido de Vélez, franja con los resultados de los otros partidos de la fecha.
- **Previa de Vélez**: cuenta regresiva desde una hora antes + historial frente a frente y datos del partido.
- **Efemérides fortineras**: "Un día como hoy…" de Vélez, una por día.
- **Protector de pantalla para la tele**: ⚠️ antes de hacerlo, recordarle al usuario que quiere hacer él un diseño.
- **Separadores** (aprobado si no pesa): 2-3 s con el logo de FUNVS y la perrita al prender la app en la tele, al entrar a la Pantalla TV y antes del partido de Vélez ("FUNVS presenta: Vélez vs …"). En modo liviano, versión simple.
- **Grilla de TV de cable desde TeleRed** (en vez de mi.tv, que no deja leerla automáticamente). TeleRed no tiene robots.txt (sin restricciones).
  - Buscador de programas de la semana: `layout/resultados-SearchTVspeed.php` (POST con el formulario `#searchtvform`: searched, desde=0, hasta=6, categorias, medio…).
  - Grilla por horas: `layout/grillaTVupd.php?prti=&prtf=&wn=&pack=D` y por canal `layout/grillaTV.php?wn=&m=`.
  - Desde GitHub respondieron vacío: probablemente piden la cookie de sesión de la página o algún campo más. Investigarlo en el paquete.
  - Uso: avisos de TV buscando el programa por nombre (canal, día y hora automáticos) y "Ahora / A continuación" para canales de cable.
