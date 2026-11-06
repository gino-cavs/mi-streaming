# Mi Centro de Streaming

Centro de entretenimiento personal: canales de YouTube, Twitch y Kick, radios, resultados de fútbol con avisos de gol, noticias y Mundo Vélez.

- `index.html`, `css/`, `js/`: la página (GitHub Pages).
- `news-config.json`: temas de noticias que se juntan cada 30 minutos.
- `scripts/fetch-news.mjs` + `.github/workflows/noticias.yml`: junta las noticias y las publica en la rama `datos`.
