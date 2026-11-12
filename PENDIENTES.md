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

## 📡 Paquete de grafismo y control (hecho el 9/11)
- Hecho: control desde el celu, barra Ahora / A continuación, guía navegable con el control, Último momento, zócalos, clima 8/18/22, Mientras tanto, previa de Vélez, efemérides, separadores.
- **Protector de pantalla para la tele**: ⚠️ el usuario quiere hacer él el diseño (recordatorio agendado para el 9/11).
- **TV de aire** (hecho 9/11): El Trece (grilla del día, schema.org) y TV Pública (semana entera) desde sus webs. ESPN, TNT Sports y DSports bloquean la lectura automática; Telefe, América y El Nueve no publican grilla. Sumar más canales si el usuario pide.
- **TeleRed**: el buscador (`layout/resultados-SearchTVspeed.php`) y la grilla (`layout/grillaTVupd.php`) responden vacío desde GitHub aun con la cookie de sesión; probablemente solo contestan a visitantes de Argentina, y desde el navegador no se puede por CORS. Quedó como link en los avisos de TV junto a mi.tv.

## 🧽 Pulido general (hecho el 12/11)
- Menú en 7 grupos (Ahora, Ver, Deportes, Escuchar, Colección, Mi día, Jugar); Colección en 5 grupos con sub-pestañas; Ajustes en 5 secciones con buscador y copia de seguridad.
- Zapping en orden de número, errores en castellano, nombres del TC limpios, carga diferida de PDF del finde / F1 en vivo / mapa.
- **Robot de datos**: se había trabado desde el 11/11 09:15 UTC (cada pasada se cancelaba con la siguiente). Ahora no se cancelan, cada paso tiene tiempo máximo, parte de los datos anteriores y publica igual aunque falle algo. Para revisarlo: Ajustes → Datos → 🩺 Estado de los datos.
- 🏭 **Fábrica de figuritas** (12/11, Colección → Álbumes → Fábrica): foto o gif, marco de rareza, título, bajada y barras de puntaje; baja PNG (en la app del celu va a Descargas/FUNVS, app 1.3) o va directo a los sobres de un álbum.
- 🧭 **Nichos** (12/11, Ver → Nichos): base de links propia + 🎲 por tiempo disponible y rareza.
- 📼 Vivos ya emitidos y videos: con la barra de YouTube para adelantar/atrasar; subtítulos apagados siempre.
- 🎙️ **Fragotime** (12/11, Jugar → Fragotime): modo podcast con Ulises — guion, pizarra, marcas con minuto, preguntas/respuestas, muro, buscar (programas + Wikipedia), 🎲, 🙈 ocultar (H), 📺 mostrar, 🍃 modo 420.
