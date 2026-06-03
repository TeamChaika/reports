# Деплой iiko-воркера на своё железо

Воркер синкает данные iiko в Supabase:
- **reference sync** (отделы, склады, сотрудники, товары) — каждые 6 часов
- **live sync** (кассовые смены + OLAP-выручка/наценка/скидки) — каждые 5 минут

Это фоновый процесс без портов — только исходящие запросы к iiko и Supabase.
Должен работать 24/7, поэтому Docker с `restart: unless-stopped`.

## Вариант A — Synology (Container Manager)

1. Скопируй папку `apps/worker` на NAS (например в `/volume1/docker/chaika-worker`).
2. Создай `.env` рядом с `docker-compose.yml` (скопируй из `.env.example`, заполни
   `SUPABASE_SERVICE_ROLE_KEY`, `IIKO_LOGIN`, `IIKO_PASSWORD`).
3. **Container Manager → Проект → Создать**: путь к папке, он подхватит
   `docker-compose.yml`. Собрать и запустить.
4. Автозапуск и перезапуск при падении уже заданы (`restart: unless-stopped`).

Через CLI на NAS:
```bash
cd /volume1/docker/chaika-worker
sudo docker compose up -d --build
sudo docker compose logs -f        # смотреть логи
```

## Вариант B — VM на ESXi (Dell Xeon) с Docker

```bash
# в VM с установленным Docker
git clone <repo> && cd apps/worker
cp .env.example .env && nano .env     # заполнить секреты
docker compose up -d --build
docker compose logs -f
```

## Проверка что работает

В логах при старте должно быть:
```
[...] Starting reference sync...
  ✓ departments: N records
[...] Starting live sync...
  ✓ cashshifts: N reports updated
  ✓ iiko sales: ... pay-type, ... hourly, ... summary, ... discount rows
Worker running — reference sync every 6h, live sync every 5m
```

Дальше каждые 5 минут будет строка `live sync`. Если в Supabase
`iiko_summary_cache.fetched_at` обновляется — синк живой.

## Обновление кода

```bash
git pull
docker compose up -d --build   # пересоберёт и перезапустит
```

## Ресурсы

Контейнер лёгкий: ~150–250 МБ RAM, почти нулевой CPU между синками.
На любом из твоих серверов (NUC / Dell Xeon / Synology) — незаметная нагрузка.
