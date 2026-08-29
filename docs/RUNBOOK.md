# Runbook: VR QR Cinema

## 1. Перед началом

1. Прочитать [CURRENT_STATE.md](CURRENT_STATE.md) и последние записи [DEPLOYMENT_LOG.md](DEPLOYMENT_LOG.md).
2. Уточнить тип задачи: диагностика, подготовка patch или разрешённый deploy.
3. Проверить `git status --short --branch`; не трогать чужие изменения.
4. Для production сначала получить read-only снимок. Чаты и commit message не заменяют снимок.

## 2. Доступ

Обычный вход:

```powershell
ssh vr-cinema-prod
```

Алиас находится в `%USERPROFILE%\.ssh\config`, выделенный ключ — `%USERPROFILE%\.ssh\vr_cinema_prod_ed25519`. Connection metadata и аварийный пароль находятся в `D:\vr_qr\.local-secrets\production.secrets.json` и исключены из Git.

На 29 августа public key установлен на VM, но ключ пока защищён passphrase и полностью unattended-вход не настроен. Интерактивный `ssh vr-cinema-prod` может запросить passphrase. На текущей Windows-машине есть проверенный локальный password-helper в gitignored `.codex-temp`; это средство восстановления конкретной машины, а не часть репозитория. Не предполагать его наличие на другом компьютере.

Никогда не вставлять секрет в shell-команду, документ, commit, issue или ответ. Проверять только наличие и права.

## 3. Быстрый read-only снимок

На VM:

```bash
date --iso-8601=seconds
systemctl is-active srv.service stats.service control_server.service qr2.service nginx.service
systemctl list-timers qr-access-maintenance.timer --all --no-pager
systemctl show srv.service control_server.service qr2.service -p MainPID -p ActiveEnterTimestamp --no-pager
```

Внешние проверки:

```powershell
Invoke-WebRequest https://cinema.local.vr360.pro/ -UseBasicParsing
Invoke-RestMethod https://cinema.local.vr360.pro/api/admin/session/
```

Ожидание без cookie: admin session существует, но `authenticated=false`.

## 4. Логи

```bash
journalctl -u srv.service --since '30 minutes ago' --no-pager
journalctl -u control_server.service --since '30 minutes ago' --no-pager
journalctl -u qr2.service --since '30 minutes ago' --no-pager
journalctl -u qr-access-maintenance.service --since today --no-pager
```

Для конкретных очков искать обе формы номера из-за старых записей, например `VDNH/2` и `VDNH/02`. Не публиковать целые payment tokens или request headers.

Structured access log `control_server` содержит `event=access_decision`, `viewer_id`, `film_id`, `channel`, `decision`, `reason`. Это основной источник ответа «почему запуск разрешён/запрещён».

## 5. Проверка runtime-режима

Без вывода остальных environment-значений:

```bash
sudo grep -E '^(FREE_VIEWER_IDS|FREE_ACCESS_DURATION_HOURS|PAID_ACCESS_DURATION_HOURS)=' /etc/qr_app/srv.env
```

Если `PAID_ACCESS_DURATION_HOURS` отсутствует, код использует default 1 час.

Проверка цен:

```bash
sqlite3 -header -column /opt/qr_app/srv/db.sqlite3 \
  'select cat_id,name,price from database_category order by cat_id;'
sqlite3 -header -column /opt/qr_app/srv/db.sqlite3 \
  'select film_id,name,price from database_movie order by film_id;'
```

## 6. Тесты локально

Минимум для логики просмотра/оплаты:

```powershell
Set-Location D:\vr_qr\control_server
& 'C:\Users\dk\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test

Set-Location D:\vr_qr\srv
..\.venv\Scripts\python.exe manage.py test database

Set-Location D:\vr_qr\qr_svelte5
& 'C:\Users\dk\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' `
  'node_modules\@sveltejs\kit\svelte-kit.js' sync
& 'C:\Users\dk\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' `
  'node_modules\svelte-check\bin\svelte-check' --tsconfig .\jsconfig.json
```

Использовать фактический интерпретатор/окружение проекта; не устанавливать зависимости глобально без необходимости.

Текущий baseline не полностью зелёный: Django backup-test удерживает файл на Windows, а Svelte имеет накопленный набор ошибок типизации. Актуальные числа и смысл см. в [CURRENT_STATE.md](CURRENT_STATE.md). Не скрывать эти результаты и не приписывать их текущему patch без сравнения с baseline.

## 7. Безопасный deploy

1. Read-only снимок production и локальный `git diff`.
2. Определить allow-list изменяемых файлов.
3. Выбрать узкий `system_stuff/deploy-*.sh`; не копировать весь репозиторий.
4. Зафиксировать имя backup-каталога и команду rollback до изменения.
5. Для БД сделать SQLite backup до миграции/UPDATE.
6. Прогнать локальные тесты.
7. Разместить одной задачей; не допускать параллельного deploy.
8. Проверить systemd, локальный порт, внешний HTTPS, затем пользовательские сценарии.
9. Сравнить critical files production с подготовленным patch по содержимому/хэшу.
10. Обновить `CURRENT_STATE.md` и `DEPLOYMENT_LOG.md`.

Push в Git выполняется после успешных тестов и сверки, но push не заменяет deploy.

## 8. Обязательные сценарии после изменения просмотра

### Платные очки

- неоплаченный фильм из гарнитуры → stop + QR-инструкция;
- оплаченный фильм из гарнитуры → stop + просьба нажать «Смотреть»;
- тот же фильм с телефона → старт;
- два купленных фильма → каждый стартует только своей кнопкой;
- задержка до старта меньше срока token → старт;
- повтор того же фильма во время current/queue → duplicate без перезапуска;
- отключение/reconnect до и после 30 секунд → проверить очередь и статистику;
- нативный reset 60 секунд → кнопка главного экрана разблокируется, затем телефон может снова запустить действующий фильм.

### Бесплатные очки

- прямой выбор любого существующего фильма → старт без телефона;
- отсутствие бесплатного token после cleanup → direct-start всё равно работает;
- перевод ID из free в paid → после restart `srv` прямой старт требует оплаты/телефона.

### Offline

- API оплаты недоступен при живом control_server → stop + ошибка проверки;
- гарнитура полностью без control_server → документировать fail-open, не выдавать это за проверенную оплату.

## 9. Откат

- Сначала остановить только затронутые службы.
- Восстановить ровно файлы/БД из заранее названного backup.
- Запустить службы и повторить те же health checks.
- Не использовать `git reset --hard`, массовое копирование или удаление `backups/quarantine`.
- Записать откат отдельной строкой в `DEPLOYMENT_LOG.md`, включая причину.

## 10. Инцидент банка/PayKeeper

Разделять четыре этапа:

1. cinema создаёт invoice;
2. PayKeeper создаёт платёж/QR у банка;
3. PayKeeper сообщает callback/status;
4. cinema выдаёт token и запускает фильм.

Ошибка банковского API-доступа на этапе 2 не исправляется изменением callback или URL возврата. Не записывать банковские/API-реквизиты в Git.
