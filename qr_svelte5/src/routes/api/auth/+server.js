import { json } from '@sveltejs/kit';
import { PRIVATE_STATS_LOGIN, PRIVATE_STATS_PASSWORD } from '$env/static/private';

export async function POST({ request, cookies }) {
	try {
		const { username, password } = await request.json();

		// Simple string comparison authentication
		if (username === PRIVATE_STATS_LOGIN && password === PRIVATE_STATS_PASSWORD) {
			// Set a simple session cookie that expires in 24 hours
			const sessionToken = `stats_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			
			cookies.set('stats_session', sessionToken, {
				path: '/',
				maxAge: 60 * 60 * 24, // 24 hours
				httpOnly: true,
				secure: false, // Set to true in production with HTTPS
				sameSite: 'strict'
			});

			return json({ 
				success: true, 
				message: 'Authentication successful' 
			});
		} else {
			return json({ 
				success: false, 
				message: 'Invalid credentials' 
			}, { status: 401 });
		}
	} catch (error) {
		return json({ 
			success: false, 
			message: 'Server error' 
		}, { status: 500 });
	}
}

export async function DELETE({ cookies }) {
	try {
		// Logout endpoint
		if (cookies && typeof cookies.delete === 'function') {
			cookies.delete('stats_session', { path: '/' });
		}
		return json({ success: true, message: 'Logged out successfully' });
	} catch (error) {
		console.error('Logout error:', error);
		return json({ success: true, message: 'Logged out successfully' }); // Still return success
	}
}
