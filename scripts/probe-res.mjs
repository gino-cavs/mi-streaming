import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const u = 'https://api.open-meteo.com/v1/forecast?latitude=-34.8157&longitude=-58.4687&timezone=America/Argentina/Buenos_Aires&forecast_days=2&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&models=ecmwf_ifs025,gfs_seamless,icon_seamless';
const j = await (await fetch(u)).json();
await writeFile('out/res.json', JSON.stringify({ err:j.error && j.reason, current:j.current, dailyKeys:Object.keys(j.daily || {}), d:Object.fromEntries(Object.entries(j.daily || {}).map(([k, v]) => [k, v.slice(0, 2)])), hourlyKeys:Object.keys(j.hourly || {}), h:Object.fromEntries(Object.entries(j.hourly || {}).map(([k, v]) => [k, v.slice(0, 3)])) }, null, 1));
