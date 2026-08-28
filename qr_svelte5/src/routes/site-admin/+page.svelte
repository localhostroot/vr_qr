<!-- Admin Page for Order Management and Token Issuance -->
<script>
// @ts-nocheck

	import { onMount } from 'svelte';
	import { PUBLIC_DATABASE } from '$env/static/public';

	let searchQuery = $state('');
	let orders = $state([]);
	let loading = $state(false);
	let totalFound = $state(0);
	let statusMessage = $state('');
	let tokenStatusText = $state('');
	let authState = $state('checking');
	let adminPassword = $state('');
	let authMessage = $state('');
	let authLoading = $state(false);
	let activeSearchQuery = '';
	let latestRequestId = 0;
	let foregroundRequestId = 0;

	const AUTO_REFRESH_INTERVAL_MS = 5000;

	function handleUnauthorized(response) {
		if (response.status !== 401 && response.status !== 403) return false;
		authState = 'signedOut';
		orders = [];
		totalFound = 0;
		return true;
	}

	async function checkAdminSession() {
		try {
			const response = await fetch(`${PUBLIC_DATABASE}api/admin/session/`, {
				cache: 'no-store',
				credentials: 'include'
			});
			const data = await response.json();
			authState = response.ok && data.authenticated ? 'signedIn' : 'signedOut';
		} catch (error) {
			authState = 'signedOut';
			authMessage = `Ошибка подключения: ${error.message}`;
		}
		return authState === 'signedIn';
	}

	async function login() {
		if (!adminPassword || authLoading) return;
		authLoading = true;
		authMessage = '';
		try {
			const response = await fetch(`${PUBLIC_DATABASE}api/admin/login/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ password: adminPassword })
			});
			const data = await response.json();
			if (!response.ok || !data.authenticated) {
				authMessage = data.error || 'Не удалось войти.';
				return;
			}
			adminPassword = '';
			authState = 'signedIn';
			await searchOrders();
		} catch (error) {
			authMessage = `Ошибка подключения: ${error.message}`;
		} finally {
			authLoading = false;
		}
	}

	async function logout() {
		try {
			await fetch(`${PUBLIC_DATABASE}api/admin/logout/`, {
				method: 'POST',
				credentials: 'include'
			});
		} finally {
			authState = 'signedOut';
			orders = [];
			totalFound = 0;
		}
	}

	// Search orders function
	async function searchOrders({ background = false, keepActiveQuery = false } = {}) {
		const query = keepActiveQuery ? activeSearchQuery : searchQuery.trim();
		if (!keepActiveQuery) {
			activeSearchQuery = query;
		}

		const requestId = ++latestRequestId;
		if (!background) {
			foregroundRequestId = requestId;
			loading = true;
			statusMessage = '';
		}
		
		try {
			const params = new URLSearchParams();
			if (query) {
				params.append('q', query);
			}
			
			const response = await fetch(`${PUBLIC_DATABASE}api/admin/search_orders/?${params}`, {
				cache: 'no-store',
				credentials: 'include'
			});
			const data = await response.json();
			if (requestId !== latestRequestId) return;
			if (handleUnauthorized(response)) return;
			
			if (response.ok) {
				orders = data.orders;
				totalFound = data.total_found;
				statusMessage = '';
			} else {
				statusMessage = `Ошибка поиска: ${data.error || 'Неизвестная ошибка'}`;
				if (!background) {
					orders = [];
					totalFound = 0;
				}
			}
		} catch (error) {
			if (requestId !== latestRequestId) return;
			statusMessage = `Ошибка подключения: ${error.message}`;
			if (!background) {
				orders = [];
				totalFound = 0;
			}
		} finally {
			if (requestId === foregroundRequestId) {
				loading = false;
			}
		}
	}

	function refreshOrders() {
		if (authState === 'signedIn' && !document.hidden) {
			searchOrders({ background: true, keepActiveQuery: true });
		}
	}

	// Issue token for already paid order
	async function issueToken(orderId) {
		const orderCard = document.querySelector(`[data-order="${orderId}"]`);
		const statusEl = orderCard?.querySelector('.token-status');
		
		if (statusEl) {
			tokenStatusText = 'Создаю токен...';
			statusEl.className = 'token-status loading';
		}

		try {
			const response = await fetch(`${PUBLIC_DATABASE}api/admin/issue_token/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ order_id: orderId })
			});

			const data = await response.json();
			if (handleUnauthorized(response)) return;

			if (data.success) {
				if (statusEl) {
					tokenStatusText = `✅ ${data.message}. Токен: ${data.token_info.token.slice(0, 8)}... (${data.token_info.films_count} фильмов)`;
					statusEl.className = 'token-status success';
				}
				// Refresh the order in the list
				await searchOrders({ background: true, keepActiveQuery: true });
			} else {
				if (statusEl) {
					tokenStatusText = `❌ ${data.error}`;
					statusEl.className = 'token-status error';
				}
			}
		} catch (error) {
			if (statusEl) {
				tokenStatusText = `❌ Ошибка: ${error.message}`;
				statusEl.className = 'token-status error';
			}
		}
	}

	// Confirm payment and issue token (for cases when payment callback failed)
	async function confirmPaymentAndIssueToken(orderId) {
		const orderCard = document.querySelector(`[data-order="${orderId}"]`);
		const statusEl = orderCard?.querySelector('.token-status');
		
		if (statusEl) {
			tokenStatusText = 'Подтверждаю платеж и создаю токен...';
			statusEl.className = 'token-status loading';
		}

		try {
			const response = await fetch(`${PUBLIC_DATABASE}api/admin/confirm_payment_and_issue_token/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ order_id: orderId })
			});

			const data = await response.json();
			if (handleUnauthorized(response)) return;

			if (data.success) {
				if (statusEl) {
					tokenStatusText = `✅ ${data.message}. Токен: ${data.token_info.token.slice(0, 8)}... (${data.token_info.films_count} фильмов)`;
					statusEl.className = 'token-status success';
				}
				// Refresh the order in the list
				await searchOrders({ background: true, keepActiveQuery: true });
			} else {
				if (statusEl) {
					tokenStatusText = `❌ ${data.error}`;
					statusEl.className = 'token-status error';
				}
			}
		} catch (error) {
			if (statusEl) {
				tokenStatusText = `❌ Ошибка: ${error.message}`;
				statusEl.className = 'token-status error';
			}
		}
	}

	// Handle search input
	function handleSearch(event) {
		if (event.key === 'Enter') {
			searchOrders();
		}
	}

	// Load recent orders on mount
	onMount(() => {
		checkAdminSession().then((authenticated) => {
			if (authenticated) searchOrders();
		});

		const intervalId = window.setInterval(refreshOrders, AUTO_REFRESH_INTERVAL_MS);
		window.addEventListener('focus', refreshOrders);
		window.addEventListener('online', refreshOrders);
		document.addEventListener('visibilitychange', refreshOrders);

		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener('focus', refreshOrders);
			window.removeEventListener('online', refreshOrders);
			document.removeEventListener('visibilitychange', refreshOrders);
		};
	});
</script>

<svelte:head>
	<title>Подтверждение покупок</title>
</svelte:head>

{#if authState === 'checking'}
	<div class="auth-status">Проверка доступа...</div>
{:else if authState === 'signedOut'}
	<div class="login-card">
		<h1>Подтверждение покупок</h1>
		<p>Введите пароль административного раздела.</p>
		<form onsubmit={(event) => { event.preventDefault(); login(); }}>
			<input
				type="password"
				bind:value={adminPassword}
				autocomplete="current-password"
				placeholder="Пароль"
			/>
			<button type="submit" disabled={authLoading || !adminPassword}>
				{authLoading ? 'Вход...' : 'Войти'}
			</button>
		</form>
		{#if authMessage}<div class="auth-error">{authMessage}</div>{/if}
	</div>
{:else}
<div class="admin-container">
	<div class="admin-toolbar">
		<h1>Подтверждение покупок</h1>
		<button onclick={logout} class="logout-button">Выйти</button>
	</div>
	
	<div class="search-section">
		<div class="search-input-group">
			<input 
				type="text" 
				bind:value={searchQuery} 
				onkeydown={handleSearch}
				placeholder="Поиск по ID заказа (или оставьте пустым для последних заказов)"
				class="search-input"
			/>
			<button onclick={() => searchOrders()} class="search-button" disabled={loading}>
				{loading ? '🔍 Поиск...' : '🔍 Поиск'}
			</button>
		</div>
		
		{#if statusMessage}
			<div class="status-message error">{statusMessage}</div>
		{/if}
		
		{#if totalFound > 0}
			<div class="results-info">Последние заказы: {totalFound}</div>
		{/if}
	</div>

	<div class="orders-section">
		{#if loading}
			<div class="loading">Загрузка заказов...</div>
		{:else if orders.length === 0}
			<div class="no-results">
				{searchQuery ? 'Заказы не найдены' : 'Нет заказов'}
			</div>
		{:else}
			<div class="orders-grid">
				{#each orders as order}
					<div class="order-card" data-order={order.order_id}>
						<div class="order-header">
							<div class="order-heading">
								<h3>Пользователь <span class="viewer-id">{order.user_id}</span></h3>
								<div class="order-identifiers">
									<span title={order.order_id}>
										<strong>ID заказа:</strong> <code>{order.order_id}</code>
									</span>
									{#if order.payment_id}
										<span title={order.payment_id}>
											<strong>ID платежа:</strong> <code>{order.payment_id}</code>
										</span>
									{/if}
								</div>
							</div>
							<span class="order-status status-{order.status}">{order.status}</span>
						</div>
						
						<div class="order-details">
							<span><strong>Сумма:</strong> {order.amount} ₽</span>
							<span><strong>Создан:</strong> {new Date(order.created_at).toLocaleString('ru-RU')}</span>
						</div>

						<div class="order-films">
							<strong>Фильмы ({order.items.length}):</strong>
							<ul class="films-list">
								{#each order.items as item}
									<li>
										{item.name} 
										{#if item.is_series}(сериал){/if}
										- {item.price} ₽
									</li>
								{/each}
							</ul>
						</div>

						<div class="token-section">
							{#if order.token_info.exists}
								<div class="token-info">
									<strong>Токен:</strong> 
									<span class="token-value">{order.token_info.token.slice(0, 16)}...</span>
									<br/>
									<small>
										Истекает: {new Date(order.token_info.expires_at).toLocaleString('ru-RU')}
										{#if order.token_info.is_valid}
											<span class="token-valid">✅ Действителен</span>
										{:else}
											<span class="token-invalid">❌ Истек</span>
										{/if}
									</small>
								</div>
							{:else}
								<div class="no-token">
									<strong>Токен:</strong> Не создан
									
									<div class="token-actions">
										{#if order.status === 'paid'}
											<button 
												onclick={() => issueToken(order.order_id)}
												class="issue-token-button paid"
											>
												🎫 Выдать токен
											</button>
										{:else}
											<button 
												onclick={() => confirmPaymentAndIssueToken(order.order_id)}
												class="issue-token-button confirm"
												title="Подтвердить что платеж прошел (для случаев сбоя callback от банка) и выдать токен"
											>
												✅ Подтвердить и выдать токен
											</button>
											<small class="payment-note">
												Для заказов со статусом "{order.status}" - используйте эту кнопку если платеж действительно прошел, но банк не отправил callback
											</small>
										{/if}
									</div>
								</div>
							{/if}
							{#if tokenStatusText}
								<div class="token-status">{tokenStatusText}</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
{/if}

<style>
	.auth-status,
	.login-card {
		max-width: 480px;
		margin: 12vh auto 0;
		padding: 28px;
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.16);
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	.login-card h1,
	.admin-toolbar h1 {
		margin: 0;
	}

	.login-card p {
		color: #555;
	}

	.login-card form {
		display: flex;
		gap: 10px;
	}

	.login-card input {
		flex: 1;
		min-width: 0;
		padding: 12px;
		border: 2px solid #ddd;
		border-radius: 8px;
		font-size: 16px;
	}

	.login-card button,
	.logout-button {
		padding: 12px 20px;
		border: 0;
		border-radius: 8px;
		background: #111827;
		color: white;
		cursor: pointer;
	}

	.login-card button:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.auth-error {
		margin-top: 14px;
		padding: 10px;
		border-radius: 6px;
		background: #ffe6e6;
		color: #a61b1b;
	}

	.admin-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 24px;
	}
	
	.admin-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		font-size: 0.875em;
	}

	.search-section {
		margin-bottom: 30px;
	}

	.search-input-group {
		display: flex;
		gap: 10px;
		margin-bottom: 15px;
	}

	.search-input {
		flex: 1;
		padding: 12px;
		border: 2px solid #ddd;
		border-radius: 8px;
		font-size: 16px;
	}

	.search-input:focus {
		border-color: #007bff;
		outline: none;
	}

	.search-button {
		padding: 12px 20px;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		transition: background 0.3s;
	}

	.search-button:hover:not(:disabled) {
		background: #0056b3;
	}

	.search-button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.status-message {
		padding: 10px;
		border-radius: 5px;
		margin-bottom: 15px;
	}

	.status-message.error {
		background: #ffe6e6;
		color: #d63384;
		border: 1px solid #d63384;
	}

	.results-info {
		color: #666;
		font-weight: bold;
	}

	.loading, .no-results {
		text-align: center;
		padding: 40px;
		color: #666;
		font-size: 18px;
	}

	.orders-grid {
		display: flex;
		gap: 20px;
		flex-direction: column;
		grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
	}

	.order-card {
		border: 1px solid #ddd;
		border-radius: 10px;
		padding: 20px;
		background: white;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		transition: box-shadow 0.3s;
		box-sizing: border-box;
	}

	.order-card:hover {
		box-shadow: 0 4px 8px rgba(0,0,0,0.15);
	}

	.order-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 15px;
		border-bottom: 2px solid #f0f0f0;
		padding-bottom: 10px;
	}

	.order-heading {
		min-width: 0;
		flex: 1;
	}

	.order-header h3 {
		margin: 0;
		color: #333;
		font-size: 18px;
	}

	.viewer-id {
		font-weight: 800;
		color: #111;
	}

	.order-identifiers {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin-top: 5px;
		color: #666;
		font-size: 11px;
		line-height: 1.35;
	}

	.order-identifiers span {
		min-width: 0;
	}

	.order-identifiers code {
		color: #444;
		font-family: monospace;
		overflow-wrap: anywhere;
	}

	.order-status {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: bold;
		text-transform: uppercase;
	}

	.status-created {
		background: #fff3cd;
		color: #856404;
	}

	.status-paid {
		background: #d1edff;
		color: #0c5460;
	}

	.status-checked {
		background: #d4edda;
		color: #155724;
	}

	.order-details {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 28px;
		margin-bottom: 15px;
	}

	.order-films {
		margin-bottom: 15px;
	}

	.films-list {
		margin: 8px 0 0 0;
		padding-left: 20px;
	}

	.films-list li {
		margin-bottom: 4px;
		font-size: 14px;
	}

	.token-section {
		border-top: 2px solid #f0f0f0;
		padding-top: 15px;
	}

	.token-info {
		background: #f8f9fa;
		padding: 10px;
		border-radius: 5px;
	}

	.token-value {
		font-family: monospace;
		background: white;
		padding: 2px 4px;
		border-radius: 3px;
		font-size: 12px;
	}

	.token-valid {
		color: #28a745;
		font-weight: bold;
	}

	.token-invalid {
		color: #dc3545;
		font-weight: bold;
	}

	.no-token {
		background: #fff3cd;
		padding: 10px;
		border-radius: 5px;
	}

	.token-actions {
		margin-top: 10px;
	}

	.issue-token-button {
		display: block;
		margin-top: 10px;
		padding: 8px 16px;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		transition: background 0.3s;
		width: 100%;
	}

	.issue-token-button.paid {
		background: #28a745;
	}

	.issue-token-button.paid:hover {
		background: #218838;
	}

	.issue-token-button.confirm {
		background: #ffc107;
		color: #212529;
		font-weight: bold;
	}

	.issue-token-button.confirm:hover {
		background: #e0a800;
	}

	.payment-note {
		display: block;
		margin-top: 8px;
		color: #666;
		font-style: italic;
		font-size: 12px;
		line-height: 1.3;
	}

	.token-status {
		margin-top: 10px;
		padding: 8px;
		border-radius: 5px;
		font-size: 14px;
		font-weight: bold;
	}

	.token-status.loading {
		background: #cce5ff;
		color: #004085;
	}

	.token-status.success {
		background: #d4edda;
		color: #155724;
	}

	.token-status.error {
		background: #f8d7da;
		color: #721c24;
	}

	@media (max-width: 768px) {
		.orders-grid {
			grid-template-columns: 1fr;
		}
		
		.search-input-group {
			flex-direction: column;
		}
		
		.order-header {
			gap: 8px;
		}

		.order-identifiers {
			flex-direction: column;
		}
	}
</style>
