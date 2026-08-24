import { json } from '@sveltejs/kit';
import { isAuthenticated } from '$lib/utils/auth.js';
import { PRIVATE_STATISTICS_SERVER_URL, PRIVATE_STATS_TOKEN } from '$env/static/private';
import axios from 'axios';

export async function GET({ url, cookies }) {
	try {
		// Check authentication
		if (!isAuthenticated(cookies)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const type = url.searchParams.get('type') || 'overview';

		switch (type) {
			case 'overview':
				return await getOverviewStats();
			case 'locations':
				return await getLocationStats();
			case 'videos':
				return await getVideoStats();
			case 'devices':
				const locationId = url.searchParams.get('location');
				return await getDeviceStats(locationId);
			default:
				return json({ error: 'Invalid stats type' }, { status: 400 });
		}
	} catch (error) {
		console.error('Stats API error:', error);
		return json({ error: 'Failed to fetch statistics' }, { status: 500 });
	}
}

async function getOverviewStats() {

	try {
		const response = await axios.get(`${PRIVATE_STATISTICS_SERVER_URL}/api/total_stats/`, {
			headers: {
				'Authorization': `Token ${PRIVATE_STATS_TOKEN}`
			}
		});
		return json(response.data);
	} catch (error) {
		console.error('Overview stats error:', error);
		return json({ 
			total_launches: 0,
			total_abandoned: 0,
			total_viewed: 0,
			todays_launches: 0,
			todays_abandoned: 0,
			todays_viewed: 0,
			error: 'Failed to fetch overview stats'
		});
	}
}

async function getLocationStats() {
	try {
		const response = await axios.get(`${PRIVATE_STATISTICS_SERVER_URL}/api/locations/`, {
			headers: {
				'Authorization': `Token ${PRIVATE_STATS_TOKEN}`
			}
		});
		return json(response.data);
	} catch (error) {
		console.error('Location stats error:', error);
		return json({ error: 'Failed to fetch location stats' }, { status: 500 });
	}
}

async function getVideoStats() {
	try {
		const response = await axios.get(`${PRIVATE_STATISTICS_SERVER_URL}/api/videos/`, {
			headers: {
				'Authorization': `Token ${PRIVATE_STATS_TOKEN}`
			}
		});
		return json(response.data);
	} catch (error) {
		console.error('Video stats error:', error);
		return json({ error: 'Failed to fetch video stats' }, { status: 500 });
	}
}

async function getDeviceStats(locationId) {
	if (!locationId) {
		return json({ error: 'Location ID required' }, { status: 400 });
	}

	try {
		const response = await axios.get(`${PRIVATE_STATISTICS_SERVER_URL}/api/devices/?location=${locationId}`, {
			headers: {
				'Authorization': `Token ${PRIVATE_STATS_TOKEN}`
			}
		});
		return json(response.data);
	} catch (error) {
		console.error('Device stats error:', error);
		return json({ error: 'Failed to fetch device stats' }, { status: 500 });
	}
}
