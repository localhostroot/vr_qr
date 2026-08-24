/**
 * Check if user is authenticated by verifying session cookie
 * @param {Object} cookies - SvelteKit cookies object
 * @returns {boolean} - Whether user is authenticated
 */
export function isAuthenticated(cookies) {
	if (!cookies || typeof cookies.get !== 'function') {
		console.warn('Cookies object is not available or invalid');
		return false;
	}
	
	try {
		const sessionCookie = cookies.get('stats_session');
		return !!sessionCookie;
	} catch (error) {
		console.error('Error checking authentication:', error);
		return false;
	}
}

/**
 * Login function for client-side
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function login(username, password) {
	try {
		const response = await fetch('/api/auth', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ username, password })
		});

		const result = await response.json();
		return result;
	} catch (error) {
		return {
			success: false,
			message: 'Network error occurred'
		};
	}
}

/**
 * Logout function for client-side
 * @returns {Promise<void>}
 */
export async function logout() {
	try {
		await fetch('/api/auth', {
			method: 'DELETE'
		});
		// Force page reload to clear any cached data
		window.location.reload();
	} catch (error) {
		console.error('Logout error:', error);
		// Even if logout fails, clear local state
		window.location.reload();
	}
}
