# Журнал production-размещений

Этот журнал фиксирует только подтверждённые действия. План, patch или commit без фактического размещения сюда не записывается как deploy.

## 2026-08-29 — удаление платёжной аналитики из `/stats`

- Тип: frontend-only.
- Backup: `/opt/qr_app/backups/stats-frontend-20260829-223506`.
- Изменение: удалены карточки Total Revenue и Success Rate, а также весь блок Payment Analytics; загрузка `/stats` больше не выполняет запрос `/api/payments`.
- Не затронуто: платёжный API, банковская интеграция, Django, control server и конфиги плееров.
- Проверка: production build Svelte прошёл; `qr2.service` active; локальный health-check и внешний `https://cinema.local.vr360.pro/stats` вернули HTTP 200; в production build отсутствуют удалённые подписи.

## 2026-08-29 — канонизация статистики фильмов и очистка площадок

- Тип: statistics Django + frontend + SQLite data migration.
- Backup: `/opt/qr_app/backups/statistics-canonicalization-20260829-222041`.
- Изменение: объединены `volga_2` → `volga` и шесть пар `geo_01_*` → `geo_02_*`; playback-сессии перенесены, три счётчика пересчитаны из сессий, legacy `views` сохранены суммированием.
- Очистка: из статистической БД удалены пустые CDH, ARS, AP, YANA и DIMA (18 устройств, 0 сессий); осталась одна площадка VDNH.
- Интерфейс: список очков переведён в карточки с тремя строками показателей и легендой классификации; ограничения первых 8/10 фильмов удалены.
- Проверка: 12/12 Django-тестов; production build Svelte; миграции `0005`/`0006` применены; `PRAGMA quick_check=ok`; API возвращает 14 использованных фильмов, 6 уроков географии, 23 устройства и 1 площадку; counters/session mismatches = 0; `stats.service` и `qr2.service` active; внешний `/stats` HTTP 200.
- Примечание: полный `svelte-check` остаётся красным из-за существующего baseline старых файлов; изменённая stats-страница новых errors не добавила.

## 2026-08-29 — runtime free range VDNH/8–VDNH/50

- Тип: production environment change.
- Изменение: `FREE_VIEWER_IDS` установлен ровно в диапазон `VDNH/8`–`VDNH/50`; `VDNH/1`–`VDNH/7` остаются платными.
- Backup: `/opt/qr_app/backups/free-viewer-config/srv.env.before-free-08-50-20260829-114346`.
- Действие: перезапущен `srv.service`.
- Проверка: service active; public status подтвердил false для 1/2/7, true для 8/10/50, false для 51; повторная privileged сверка environment выполнена 29 августа.

## 2026-08-29 — мониторинг стабильности WebSocket

- Тип: control_server + frontend.
- Локальный commit: `e474f31` (`feat: monitor headset connection stability`).
- Backup: `/opt/qr_app/backups/connection-monitoring-e474f31`.
- Изменение: `presenceHistory` считает непрерывность и разрывы WebSocket в рабочем окне; `getVrOverview` возвращает `connectionHealth`; на `/` добавлен четвёртый блок мониторинга.
- Проверка 29 августа: production-файлы содержательно совпадают с локальными; `control_server.service` и `qr2.service` active.
- Примечание: это мониторинг WebSocket приложения, не физического Wi-Fi. Сон плеера может считаться отключением.

## 2026-08-29 — нормализация ID гарнитур

- Тип: Django + control_server + frontend/supporting code.
- Локальный commit: `1e0b9a9`.
- Изменение: ведущие нули числового номера не создают отдельную сущность (`VDNH/02 == VDNH/2`).
- Проверка: critical Django/control files совпадают с production по содержанию.

## 2026-08-29 — phone-only paid start и удаление unlock grace

- Тип: control_server.
- Связанные commits: `a1c6753`, `5cb33fe`, `f844a2f` и предшествующие узкие deploy.
- Изменение: платный direct-start из гарнитуры блокируется сообщением о запуске с телефона; неоплаченный — QR-инструкцией; прежний grace после unlock удалён.
- Backups на сервере: `phone-only-before-20260828-2336`, `remove-unblock-grace-20260829-013900`, `payment-message-5cb33fe`, `block-screen-blue-word-f844a2f`.
- Проверка 29 августа: production `handlers/index.js` содержательно совпадает с локальным.

## 2026-08-29 — admin auth и утренняя maintenance

- Тип: Django/frontend/systemd.
- Изменение: `/` и `/site-admin` используют password-backed Django session; maintenance в 06:00 делает backup с retention 14 и cleanup access state.
- Проверка: `SITE_ADMIN_PASSWORD_CONFIGURED=yes`; timer active, последний запуск 29 августа 06:00 MSK.

## 2026-08-28 — временные цены 1 ₽

- Тип: production database data change.
- Изменение: цены всех `Category` и `Movie` установлены в 1 ₽.
- Backups: `/opt/qr_app/backups/catalog-prices-one-ruble-20260828-082208` и связанный профиль восстановления цен.
- Проверка 29 августа: все пять категорий/комплектов и четырнадцать проигрываемых записей имеют цену 1.

## 2026-08-29 — документационная сверка и локальный SSH-доступ

- Тип: local operations; production application code не менялся.
- Изменение: создан выделенный SSH-ключ/алиас, аварийные реквизиты помещены в gitignored `.local-secrets`; документация перестроена вокруг production-first; историческая спецификация [Video Player Overview — RU](https://docs.google.com/document/d/1ruewxD7oWqcJFfMnKQ8WIWZuVA4_RxI5Z22Hk3Vxg6E/edit) сопоставлена с текущей серверной интеграцией.
- Проверка: password login и установка public key успешны; пять основных production services active. Ключ защищён passphrase, окончательная настройка unattended key login ожидает отдельного решения.
- Production application code этим документированием не изменялся.
