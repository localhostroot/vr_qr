# Просмотр VR: фактический автомат запуска

Актуальность: **29 августа 2026**. Основано на production-сверке `control_server/handlers/index.js`, `control_server/services/paidPlayback.js`, `srv/database/api.py` и тестов. «Просмотр» — один `videoId` на одной нормализованной гарнитуре `location/id`.

## 1. Не смешивать четыре состояния

| Состояние | Источник | Что доказывает |
|---|---|---|
| Право | Django `PaymentToken` + `PaidFilm` либо `FREE_VIEWER_IDS` | можно ли этому viewer смотреть конкретный фильм |
| Команда | `queue` / `pendingQueue` в control_server | отправлялся ли `videoChangeRequested` |
| Плеер | `updateState`: `activity`, `details.videoId`, `isPlaying` | что фактически сообщает гарнитура |
| Статистика | `activePlaybackSession` | открыт ли оплаченный статистический сеанс |

Право не равно команде, команда не равна фактическому старту. Исторически часть ошибок возникла из-за использования `queue` сразу как команды и как неявного признака авторизации.

## 2. Состояния гарнитуры

Рабочий контракт текущей интеграции:

- `activity=0` — галерея/готовность;
- `activity=1` — гарнитура сообщает выбранный/текущий фильм;
- `activity=2` — главный экран блокировки/reset;
- `userPresent` — датчик присутствия; сейчас он влияет только на немедленную отправку phone-команды или помещение её в `pendingQueue`;
- `currentVideoId`, `isPlaying`, `playbackPosition` — фактические данные плеера.

В текущем control_server **нет** server-side таймера, который по `userPresent=false` через 10 минут приостанавливает платёжную сессию. Endpoint Django `end_viewer_session` и legacy-поле `headset_session_active` существуют, но control_server их сейчас не вызывает.

## 3. Платный старт с телефона

Успешный путь для каждого фильма:

1. Мобильная страница знает `location`, `clientId`, `videoId` и token.
2. Она отправляет WebSocket-команду `videoForClient`.
3. Control server нормализует номер гарнитуры и вызывает Django `resume_viewer_session`.
4. Django требует:

   - token существует и относится к тому же нормализованному viewer ID;
   - token активен и ещё не истёк;
   - заказ имеет статус `paid` или `checked`;
   - точный `filmId` присутствует в `PaidFilm` этого token.

5. Control server создаёт одноразовую `paidAuthorizations[videoId]`.
6. Если фильм уже current/queue/pending, возвращается `success=true, duplicate=true`; новой команды и перемотки нет.
7. Если `userPresent=false` или `activity=2`, фильм помещается в начало `pendingQueue`.
8. Иначе фильм попадает в `queue`, гарнитуре отправляется `videoChangeRequested`.
9. Отложенный фильм отправится только после `activity=0` и `userPresent=true`.
10. `activePlaybackSession` создаётся только после `activity=1` и `isPlaying=true`.

Покупка нескольких фильмов не создаёт автоплей: для каждого фильма снова требуется кнопка «Смотреть» на телефоне.

## 4. Прямой выбор фильма в гарнитуре

Когда гарнитура сама сообщает новый `videoId`, отсутствующий в `queue`, control_server вызывает защищённый `viewer_film_access`.

### Бесплатные очки

Если нормализованный ID входит в `FREE_VIEWER_IDS` и фильм существует в Django-каталоге:

1. Django возвращает `free_access=true`.
2. Control server добавляет фильм в `queue` и разрешает продолжение.
3. Телефон, order и token не нужны.

Это правило действует до удаления ID из runtime-конфигурации и restart `srv`.

### Платные очки, фильм оплачен

Django сообщает `paid=true`, но прямой запуск намеренно **не авторизуется**. Control server:

1. посылает `videoStopRequested`;
2. ждёт выхода плеера из фильма;
3. показывает: «Нажмите «Смотреть» на телефоне, чтобы запустить фильм.»

Действующий token сам по себе не превращает прямой выбор в гарнитуре в разрешённый старт.

### Платные очки, фильм не оплачен

Control server останавливает фильм и показывает:

```text
Оплатите фильм по QR-коду,
нанесенному на очки,
затем нажмите «Смотреть» на телефоне.
```

### Ошибка Django API

Если control_server подключён к гарнитуре, но не может проверить доступ, он останавливает фильм и показывает: «Не удалось проверить оплату. Проверьте соединение и повторите попытку.»

Если гарнитура полностью не связана с control_server, сервер не участвует и не может enforce-ить эти правила. Offline-плеер может показать локальный каталог — это принятый fail-open режим.

## 5. Показ сообщения после stop

При запрещённом direct-start:

1. В `pendingPaymentBlock` сохраняются `videoId` и текст.
2. Отправляется `videoStopRequested`.
3. Нормально сообщение показывается после следующего `updateState` с `activity != 1`.
4. Если это состояние потеряно, fallback через 3 секунды всё равно отправляет `resetClient`.
5. `resetClient` имеет `allowUnblock: "true"`, поэтому главный экран должен разрешать «Продолжить/Начать просмотр».

Запоздалое состояние остановленного `videoId` игнорируется по `stopRequestedVideoId`, чтобы не вызвать повторную блокировку.

## 6. Нативный reset и повторный старт

`preset.resetTimeout` в шаблоне плеера равен 60 секундам. Это автомат самого Quest Video Player:

- возвращает плеер на главный экран;
- не отзывает Django token;
- не запускает оплаченный фильм снова;
- после разблокировки действующий фильм можно снова запустить с телефона, пока token не истёк.

Прежние `+30 секунд` unlock grace и 10-минутный server-side presence timeout удалены и не должны возвращаться скрыто.

## 7. Завершение и reconnect

| Причина | Действие |
|---|---|
| Плеер вышел из `activity=1` | фильм удаляется из queue; статистика `playback_ended` |
| Команда stop + подтверждение state | queue/pending очищаются для фильма; статистика `stopped` |
| Стартовал другой `videoId` | предыдущая статистика `video_changed`; новый фильм становится current |
| WebSocket разорван | снимок playback удерживается 30 секунд |
| Reconnect того же нормализованного ID ≤30 секунд | in-memory playback/queue восстанавливаются |
| Reconnect не произошёл >30 секунд | статистика завершается `disconnect_timeout`; Django token не отзывается |
| Перезапуск control_server | живые очереди/authorizations теряются; Django-права и заказы остаются |

## 8. Повтор и конкурирующие телефоны

Текущий `resume_viewer_session` не проверяет эксклюзивный headset lease. Следствия:

- два браузера выглядят как разные клиентские сессии, но каждый может использовать собственный действующий token для одной гарнитуры;
- тот же `videoId`, уже current/queue/pending, будет признан duplicate и не перезапустится с начала;
- другой `videoId` может отправить новую команду и завершить предыдущую статистику как `video_changed`;
- сообщение «очки используются другим зрителем» не является гарантией текущей реализации.

Если требуется строгая эксклюзивность зрителя, это отдельное продуктовое решение. Нельзя возвращать старый lease частично: понадобится явный owner, takeover-policy, UI и сценарные тесты.

## 9. Полный список штатных блокеров phone-start

| Условие | Результат |
|---|---|
| Нет подключённой пары `location/id` | «Клиент не найден» |
| Пустой `videoId` | запрос отклоняется |
| Нет token | оплата не подтверждена |
| Token другого viewer | оплата не подтверждена |
| Token неактивен/истёк | оплата не подтверждена |
| Заказ не `paid/checked` | оплата не подтверждена |
| Фильм отсутствует в `PaidFilm` token | оплата не подтверждена |
| Django API недоступен | проверка не проходит; команда не отправляется |
| Тот же фильм current/queue/pending | успешный duplicate без новой команды |
| Гарнитура blocked/без присутствия | успешная постановка в pending, не немедленный старт |
| После pending нет `activity=0 + userPresent=true` | команда остаётся отложенной |
| После команды нет `isPlaying=true` | статистический start не создаётся |

## 10. Известные обходы и риски

### P0 — `addToQueue`

Команда принимает `videoId` без token и кладёт его в `pendingQueue`. При продвижении фильм попадает в `queue`, после чего `handleStartVideo` не вызывает `viewer_film_access`. Поэтому старый API может запустить неоплаченный фильм. Кнопка этого пути в `ContentCardPaid.svelte` скрыта, но handler доступен.

Решение: удалить публичную регистрацию команды либо направить её через ту же обязательную авторизацию, что `videoForClient`. Проверка должна повторяться перед отправкой pending-команды.

### P0 — `fillQueue`

Команда целиком заменяет `queue` без проверки. Наличие фильма в queue затем пропускает access-check.

Решение: удалить handler/API. Штатному продукту он не нужен.

### P1 — queue используется как признак авторизации

`queueHasVideo` фактически означает «не проверять доступ повторно», хотя queue должна означать только состояние доставки команды.

Решение: хранить объект `{videoId, authorization, requestedAt, source}` и проверять authorization перед каждым `videoChangeRequested`.

### P1 — `get_token_by_order` как capability

Token можно получить по случайному `order_id`. UUID сложно перебрать, но утечка URL/localStorage/log превращается в утечку доступа.

Решение: подписанная короткоживущая browser proof/cookie и минимизация token в логах.

### P1 — no restart для того же фильма

Duplicate-защита полезна против повторных кликов, но новый зритель не может гарантированно запустить тот же current-фильм с начала, пока старое состояние не очищено.

Решение: отдельная явная команда `restart=true` с подтверждённым token и контролируемым сбросом current/queue, а не удаление duplicate-защиты целиком.

### P1 — offline fail-open

При полном disconnect гарнитуры сервер не способен блокировать локальный контент.

Решение возможно только на стороне плеера: локально подписанное право/deny-by-default. Пользователь пока выбрал сохранить fail-open.

### P2 — мониторинг считает WebSocket, а не Wi-Fi

Сон/остановка приложения выглядит как disconnect, даже если Wi-Fi интерфейс Quest остаётся подключён.

Решение: воспринимать метрики как «связь плеера с control_server». Для физического Wi-Fi нужен отдельный агент/ADB/MDM, не связанный с оплатой.

## 11. Целевая модель будущего рефакторинга

```text
Право:      absent → valid → expired
Команда:    none → authorized → pending/sent → acknowledged → cleared
Плеер:      idle/blocked → starting → playing → stopping → idle/blocked
Статистика: none → opened → finalized
```

Право не хранится в queue. У каждой команды есть source (`phone`/`free-headset`), конкретная authorization и срок. Прямой paid-start всегда сообщает phone-required; direct free-start выдаёт server authorization по `FREE_VIEWER_IDS`.

## 12. Файлы и тесты

- `control_server/handlers/index.js` — очередь, сообщения, state-machine гарнитуры.
- `control_server/services/paidPlayback.js` — phone/free access, статистика, reconnect.
- `srv/database/api.py` — token/film validation и direct free classification.
- `srv/database/management/commands/cleanup_access_state.py` — утренняя очистка.
- `control_server/test/queue.test.js`, `paidPlayback.test.js` — регрессии запуска.
- `srv/database/tests.py` — API, token, free mode, cleanup.

При изменении любого перехода обновлять этот документ и тестировать сценарии из [docs/RUNBOOK.md](docs/RUNBOOK.md).
