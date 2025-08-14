import { json } from '@sveltejs/kit';
import { isAuthenticated } from '$lib/utils/auth.js';
import { PUBLIC_DATABASE } from '$env/static/public';
import axios from 'axios';

export async function GET({ url, cookies }) {
	try {
		// Check authentication
		if (!isAuthenticated(cookies)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const date = url.searchParams.get('date'); // Format: YYYY-MM-DD
		const startDate = url.searchParams.get('start_date');
		const endDate = url.searchParams.get('end_date');
		const analytics = url.searchParams.get('analytics'); // 'true' for period analytics

		if (analytics === 'true' || (!date && !startDate && !endDate)) {
			// Get analytics for default period (June 1, 2025 to now)
			const defaultStartDate = startDate || '2025-06-01';
			const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
			return await getPaymentAnalytics(defaultStartDate, defaultEndDate);
		} else if (date) {
			// Get payments for specific date (legacy)
			return await getPaymentsByDate(date);
		} else if (startDate && endDate) {
			// Get payments for date range (legacy)
			return await getPaymentsByDateRange(startDate, endDate);
		} else {
			// Get today's payments by default (legacy)
			const today = new Date().toISOString().split('T')[0];
			return await getPaymentsByDate(today);
		}
	} catch (error) {
		console.error('Payment API error:', error);
		return json({ error: 'Failed to fetch payment data' }, { status: 500 });
	}
}

async function getPaymentsByDate(date) {
	try {
		// This would call your payment provider through Django
		const response = await axios.get(`${PUBLIC_DATABASE}api/payments/by-date/?date=${date}`);
		const payments = response.data;

		// Process payment data for analytics
		const analytics = processPaymentData(payments);
		
		return json({
			date,
			payments,
			analytics
		});
	} catch (error) {
		console.error('Payment by date error:', error);
		return json({ 
			date,
			payments: [],
			analytics: getEmptyAnalytics(),
			error: 'Failed to fetch payment data for date'
		});
	}
}

async function getPaymentsByDateRange(startDate, endDate) {
	try {
		// This would call multiple dates or a range endpoint
		const payments = [];
		const currentDate = new Date(startDate);
		const endDateTime = new Date(endDate);

		while (currentDate <= endDateTime) {
			const dateStr = currentDate.toISOString().split('T')[0];
			try {
				const response = await axios.get(`${PUBLIC_DATABASE}api/payments/by-date/?date=${dateStr}`);
				payments.push(...response.data);
			} catch (error) {
				console.warn(`Failed to fetch payments for ${dateStr}:`, error);
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}

		const analytics = processPaymentData(payments);
		
		return json({
			start_date: startDate,
			end_date: endDate,
			payments,
			analytics
		});
	} catch (error) {
		console.error('Payment by range error:', error);
		return json({ 
			start_date: startDate,
			end_date: endDate,
			payments: [],
			analytics: getEmptyAnalytics(),
			error: 'Failed to fetch payment data for date range'
		});
	}
}

function processPaymentData(payments) {
	const analytics = {
		total_payments: payments.length,
		successful_payments: 0,
		failed_payments: 0,
		pending_payments: 0,
		canceled_payments: 0,
		refunded_payments: 0,
		total_revenue: 0,
		success_rate: 0,
		payment_methods: {},
		hourly_distribution: Array(24).fill(0),
		daily_totals: {}
	};

	payments.forEach(payment => {
		// Count by status
		switch (payment.status) {
			case 'success':
				analytics.successful_payments++;
				analytics.total_revenue += parseFloat(payment.pay_amount || 0);
				break;
			case 'failed':
				analytics.failed_payments++;
				break;
			case 'pending':
				analytics.pending_payments++;
				break;
			case 'canceled':
				analytics.canceled_payments++;
				break;
			case 'refunded':
			case 'partially_refunded':
				analytics.refunded_payments++;
				break;
		}

		// Count by payment method
		const paymentSystem = payment.payment_system_id;
		analytics.payment_methods[paymentSystem] = (analytics.payment_methods[paymentSystem] || 0) + 1;

		// Hourly distribution
		if (payment.success_datetime || payment.obtain_datetime) {
			const datetime = payment.success_datetime || payment.obtain_datetime;
			const hour = new Date(datetime).getHours();
			analytics.hourly_distribution[hour]++;
		}

		// Daily totals
		const date = (payment.success_datetime || payment.obtain_datetime || '').split(' ')[0];
		if (date) {
			if (!analytics.daily_totals[date]) {
				analytics.daily_totals[date] = { count: 0, revenue: 0 };
			}
			analytics.daily_totals[date].count++;
			if (payment.status === 'success') {
				analytics.daily_totals[date].revenue += parseFloat(payment.pay_amount || 0);
			}
		}
	});

	// Calculate success rate
	analytics.success_rate = analytics.total_payments > 0 
		? (analytics.successful_payments / analytics.total_payments * 100).toFixed(2)
		: 0;

	return analytics;
}

async function getPaymentAnalytics(startDate, endDate) {
	try {
		// Call the Django payment provider analytics endpoint  
		// Django REST framework ViewSet action URL pattern: /api/viewset-name/action-name/
		const response = await axios.get(`${PUBLIC_DATABASE}api/payments-analytics/analytics/`, {
			params: {
				start_date: startDate,
				end_date: endDate
			}
		});
		
		return json({
			analytics: response.data,
			period: `${startDate} to ${endDate}`,
			success: true
		});
	} catch (error) {
		console.error('Payment analytics error:', error);
		return json({ 
			analytics: getEmptyAnalytics(),
			period: `${startDate} to ${endDate}`,
			error: 'Failed to fetch payment analytics',
			success: false
		});
	}
}

function getEmptyAnalytics() {
	return {
		total_payments: 0,
		successful_payments: 0,
		failed_payments: 0,
		pending_payments: 0,
		canceled_payments: 0,
		refunded_payments: 0,
		total_revenue: 0,
		success_rate: 0,
		payment_methods: {},
		hourly_distribution: Array(24).fill(0),
		daily_totals: {},
		period: 'No data'
	};
}
