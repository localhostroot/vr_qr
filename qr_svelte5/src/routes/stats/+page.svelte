<script>
// @ts-nocheck

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { login, logout } from '$lib/utils/auth.js';
  import { Chart, registerables } from 'chart.js';
  import 'chartjs-adapter-date-fns';
  
  if (browser) {
    Chart.register(...registerables);
  }

  // Authentication state
  let isAuthenticated = $state(false);
  let isCheckingAuth = $state(true);
  let showLoginModal = $state(false);
  
  // Login form state
  let username = $state('');
  let password = $state('');
  let loginError = $state('');
  let isLoggingIn = $state(false);
  
  // Stats state
  let overviewStats = $state(null);
  let locationStats = $state(null);
  let videoStats = $state(null);
  let deviceStats = $state(null);
  let paymentStats = $state(null);
  let selectedLocation = $state(null);
  let isLoadingStats = $state(false);
  let statsError = $state('');
  
  // Navigation state
  let currentSection = $state('overview');
  let selectedLocationName = $state('CDH');
  
  // Chart references
  let overviewChart = null;
  let locationChart = null;
  let videoChart = null;
  let deviceChart = null;

  onMount(async () => {
    await checkAuthentication();
  });

  async function checkAuthentication() {

    if (!browser) return;
    
    try {
      // Try to fetch stats to check if authenticated
      const response = await fetch('/api/stats?type=overview');
      if (response.ok) {
        isAuthenticated = true;
        await loadAllStats();
      } else {
        isAuthenticated = false;
        showLoginModal = true;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      isAuthenticated = false;
      showLoginModal = true;
    } finally {
      isCheckingAuth = false;
    }
  }

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      loginError = 'Please enter both username and password';
      return;
    }
    
    isLoggingIn = true;
    loginError = '';

    console.log('/api/stats?type=overview');
    
    try {
      const result = await login(username, password);
      
      if (result.success) {
        isAuthenticated = true;
        showLoginModal = false;
        username = '';
        password = '';
        await loadAllStats();
      } else {
        loginError = result.message || 'Login failed';
      }
    } catch (error) {
      loginError = 'Network error occurred';
    } finally {
      isLoggingIn = false;
    }
  }

  async function handleLogout() {
    try {
      await logout();
      isAuthenticated = false;
      showLoginModal = true;
      clearAllData();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  function clearAllData() {
    overviewStats = null;
    locationStats = null;
    videoStats = null;
    deviceStats = null;
    paymentStats = null;
    selectedLocation = null;
    currentSection = 'overview';
    selectedLocationName = 'CDH';
    destroyAllCharts();
  }

  function destroyAllCharts() {
    if (overviewChart) {
      overviewChart.destroy();
      overviewChart = null;
    }
    if (locationChart) {
      locationChart.destroy();
      locationChart = null;
    }
    if (videoChart) {
      videoChart.destroy();
      videoChart = null;
    }
    if (deviceChart) {
      deviceChart.destroy();
      deviceChart = null;
    }
  }

  async function loadAllStats() {
    isLoadingStats = true;
    statsError = '';
    
    try {
      await Promise.all([
        loadOverviewStats(),
        loadLocationStats(),
        loadVideoStats(),
        loadPaymentStats()
      ]);
    } catch (error) {
      console.error('Error loading stats:', error);
      statsError = 'Failed to load some statistics';
    } finally {
      isLoadingStats = false;
    }
  }

  async function loadOverviewStats() {
    try {
      const response = await fetch('/api/stats?type=overview');
      if (response.ok) {
        overviewStats = await response.json();
      }
    } catch (error) {
      console.error('Overview stats error:', error);
    }
  }

  async function loadLocationStats() {
    try {
      const response = await fetch('/api/stats?type=locations');
      if (response.ok) {
        locationStats = await response.json();
      }
    } catch (error) {
      console.error('Location stats error:', error);
    }
  }

  async function loadVideoStats() {
    try {
      const response = await fetch('/api/stats?type=videos');
      if (response.ok) {
        videoStats = await response.json();
      }
    } catch (error) {
      console.error('Video stats error:', error);
    }
  }

  async function loadDeviceStats(locationId) {
    try {
      const response = await fetch(`/api/stats?type=devices&location=${locationId}`);
      if (response.ok) {
        deviceStats = await response.json();
        selectedLocation = locationId;
      }
    } catch (error) {
      console.error('Device stats error:', error);
    }
  }

  async function loadPaymentStats() {
    try {
      const response = await fetch('/api/payments');
      if (response.ok) {
        paymentStats = await response.json();
      }
    } catch (error) {
      console.error('Payment stats error:', error);
    }
  }

  function navigateToSection(section) {
    currentSection = section;
    if (section === 'locations' && locationStats && locationStats.length > 0) {
      // Find CDH location or default to first
      const cdhLocation = locationStats.find(loc => loc.name === 'CDH');
      if (cdhLocation) {
        selectedLocationName = 'CDH';
        loadDeviceStats(cdhLocation.id);
      } else {
        selectedLocationName = locationStats[0].name;
        loadDeviceStats(locationStats[0].id);
      }
    }
  }

  function selectLocation(location) {
    selectedLocationName = location.name;
    loadDeviceStats(location.id);
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && showLoginModal) {
      handleLogin();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="stats-container">
  {#if isCheckingAuth}
    <div class="loading-screen">
      <div class="loader"></div>
      <p>Checking authentication...</p>
    </div>
  {:else if !isAuthenticated && showLoginModal}
    <!-- Login Modal -->
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Statistics Dashboard</h2>
          <p>Please login to access statistics</p>
        </div>
        
        <form on:submit|preventDefault={handleLogin} class="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              type="text"
              bind:value={username}
              placeholder="Enter username"
              disabled={isLoggingIn}
              required
            />
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              bind:value={password}
              placeholder="Enter password"
              disabled={isLoggingIn}
              required
            />
          </div>
          
          {#if loginError}
            <div class="error-message">{loginError}</div>
          {/if}
          
          <button type="submit" disabled={isLoggingIn} class="login-button">
            {#if isLoggingIn}
              <span class="spinner"></span>
              Logging in...
            {:else}
              Login
            {/if}
          </button>
        </form>
      </div>
    </div>
  {:else if isAuthenticated}
    <!-- Statistics Dashboard -->
    <div class="dashboard">
      <!-- Left Navigation -->
      <nav class="dashboard-nav">
        <div class="nav-header">
          <h2>Dashboard</h2>
        </div>
        <ul class="nav-menu">
          <li class="nav-item" class:active={currentSection === 'overview'}>
            <button on:click={() => navigateToSection('overview')} class="nav-button">
              📊 Overview
            </button>
          </li>
          <li class="nav-item" class:active={currentSection === 'locations'}>
            <button on:click={() => navigateToSection('locations')} class="nav-button">
              📍 Locations
            </button>
          </li>
        </ul>
        <div class="nav-footer">
          <button on:click={handleLogout} class="logout-button">Logout</button>
        </div>
      </nav>
      
      <!-- Main Content -->
      <main class="dashboard-main">
        <div class="dashboard-header">
          <h1>{currentSection === 'overview' ? 'Analytics Overview' : `Location: ${selectedLocationName}`}</h1>
        </div>
        
        {#if isLoadingStats}
          <div class="loading-stats">
            <div class="loader"></div>
            <p>Loading statistics...</p>
          </div>
        {:else if currentSection === 'overview'}
          <!-- Overview Section -->
          <div class="overview-section">
            <!-- Key Metrics -->
            <div class="metrics-row">
              {#if overviewStats}
                <div class="metric-card">
                  <div class="metric-value">{overviewStats.total_views || 0}</div>
                  <div class="metric-label">Total Views</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">{overviewStats.todays_views || 0}</div>
                  <div class="metric-label">Today's Views</div>
                </div>
              {/if}
              {#if paymentStats}
                <div class="metric-card">
                  <div class="metric-value">{paymentStats.analytics?.total_revenue || 0}₽</div>
                  <div class="metric-label">Total Revenue</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">{paymentStats.analytics?.success_rate || 0}%</div>
                  <div class="metric-label">Success Rate</div>
                </div>
              {/if}
            </div>
            
            <!-- Charts Row -->
            <div class="charts-row">
              {#if paymentStats}
                <div class="chart-card">
                  <h3>Payment Analytics</h3>
                  <div class="payment-analytics">
                    <div class="payment-stats">
                      <div class="payment-stat">
                        <span class="stat-label">Successful:</span>
                        <span class="stat-value successful">{paymentStats.analytics?.successful_payments || 0}</span>
                      </div>
                      <div class="payment-stat">
                        <span class="stat-label">Failed:</span>
                        <span class="stat-value failed">{paymentStats.analytics?.failed_payments || 0}</span>
                      </div>
                      <div class="payment-stat">
                        <span class="stat-label">Pending:</span>
                        <span class="stat-value pending">{paymentStats.analytics?.pending_payments || 0}</span>
                      </div>
                      <div class="payment-stat">
                        <span class="stat-label">Canceled:</span>
                        <span class="stat-value canceled">{paymentStats.analytics?.canceled_payments || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
              
              <div class="chart-card">
                <h3>Top Locations by Views</h3>
                <div class="location-chart">
                  {#if locationStats}
                    {#each locationStats.slice(0, 5) as location}
                      <div class="location-bar">
                        <div class="location-name">{location.name}</div>
                        <div class="location-bar-container">
                          <div class="location-bar-fill" style="width: {Math.max(10, (location.views || 0) / Math.max(...locationStats.map(l => l.views || 0)) * 100)}%"></div>
                          <div class="location-bar-value">{location.views || 0}</div>
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            </div>
            
            <!-- Video Stats Table -->
            <div class="stats-table-card">
              <h3>Top Videos</h3>
              <div class="stats-table">
                <div class="table-header">
                  <div>Video Title</div>
                  <div>Views</div>
                </div>
                {#if videoStats}
                  {#each videoStats.slice(0, 10) as video}
                    <div class="table-row">
                      <div class="video-title">{video.title || 'Untitled'}</div>
                      <div class="video-views">{video.views || 0}</div>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        {:else if currentSection === 'locations'}
          <!-- Locations Section -->
          <div class="locations-section">
            <!-- Location Selector -->
            <div class="location-selector">
              <h3>Select Location:</h3>
              <div class="location-buttons">
                {#if locationStats}
                  {#each locationStats as location}
                    <button 
                      class="location-button" 
                      class:active={selectedLocationName === location.name}
                      on:click={() => selectLocation(location)}
                    >
                      {location.name}
                      <span class="location-views-badge">{location.views || 0}</span>
                    </button>
                  {/each}
                {/if}
              </div>
            </div>
            
            <!-- Location Details -->
            {#if deviceStats}
              <div class="location-details">
                <div class="location-metrics">
                  <div class="metric-card">
                    <div class="metric-value">{deviceStats.length || 0}</div>
                    <div class="metric-label">Active Devices</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-value">{deviceStats.reduce((sum, device) => sum + (device.views || 0), 0)}</div>
                    <div class="metric-label">Total Views</div>
                  </div>
                </div>
                
                <!-- Device List -->
                <div class="device-list-card">
                  <h3>Devices in {selectedLocationName}</h3>
                  <div class="device-list">
                    {#each deviceStats as device}
                      <div class="device-item">
                        <div class="device-name">Client {device.client_id}</div>
                        <div class="device-views">{device.views || 0} views</div>
                      </div>
                    {/each}
                  </div>
                </div>
                
                <!-- Video Views for Location -->
                <div class="location-videos-card">
                  <h3>Video Performance in {selectedLocationName}</h3>
                  <div class="location-videos">
                    {#if videoStats}
                      {#each videoStats.slice(0, 8) as video}
                        <div class="video-item">
                          <div class="video-name">{video.title || 'Untitled'}</div>
                          <div class="video-views">{video.views || 0} views</div>
                        </div>
                      {/each}
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
        
        {#if statsError}
          <div class="error-banner">{statsError}</div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<style>
  .stats-container {
    min-height: 100vh;
    background: var(--color-dark-primary, #0f0f0f);
    color: var(--color-white-90, #e5e5e5);
    font-family: 'Montserrat', sans-serif;
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
  }

  .loader {
    width: 40px;
    height: 40px;
    border: 4px solid var(--color-white-20, #333);
    border-top: 4px solid var(--color-primary, #007bff);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff40;
    border-top: 2px solid #ffffff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
    margin-right: 0.5rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--color-dark-secondary, #1e1e1e);
    border-radius: 12px;
    padding: 2rem;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .modal-header h2 {
    margin: 0 0 0.5rem;
    color: var(--color-white-90, #e5e5e5);
  }

  .modal-header p {
    margin: 0;
    color: var(--color-white-70, #b3b3b3);
    font-size: 0.9rem;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    color: var(--color-white-90, #e5e5e5);
    font-weight: 500;
  }

  .form-group input {
    padding: 0.75rem;
    border: 1px solid var(--color-white-20, #333);
    border-radius: 6px;
    background: var(--color-dark-primary, #0f0f0f);
    color: var(--color-white-90, #e5e5e5);
    font-family: inherit;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--color-primary, #007bff);
  }

  .form-group input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    color: #ff4444;
    font-size: 0.9rem;
    text-align: center;
    padding: 0.5rem;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 4px;
  }

  .login-button {
    background: var(--color-primary, #007bff);
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: 6px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-button:hover:not(:disabled) {
    background: var(--color-primary-dark, #0056b3);
  }

  .login-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .dashboard {
    display: flex;
    min-height: 100vh;
    background: var(--color-dark-primary, #0f0f0f);
  }

  .dashboard-nav {
    width: 250px;
    background: var(--color-dark-secondary, #1e1e1e);
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--color-white-20, #333);
  }

  .nav-header {
    padding: 2rem 1.5rem 1rem;
    border-bottom: 1px solid var(--color-white-20, #333);
  }

  .nav-header h2 {
    margin: 0;
    color: var(--color-white-90, #e5e5e5);
    font-size: 1.5rem;
  }

  .nav-menu {
    list-style: none;
    padding: 0;
    margin: 0;
    flex: 1;
  }

  .nav-item {
    margin: 0;
  }

  .nav-item.active .nav-button {
    background: var(--color-primary, #007bff);
    color: white;
  }

  .nav-button {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--color-white-70, #b3b3b3);
    padding: 1rem 1.5rem;
    text-align: left;
    font-family: inherit;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .nav-button:hover {
    background: var(--color-white-10, #2a2a2a);
    color: var(--color-white-90, #e5e5e5);
  }

  .nav-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-white-20, #333);
  }

  .dashboard-main {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
  }

  .dashboard-header {
    margin-bottom: 2rem;
  }

  .dashboard-header h1 {
    margin: 0;
    color: var(--color-white-90, #e5e5e5);
  }

  .logout-button {
    background: #ff4444;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
    width: 100%;
  }

  .logout-button:hover {
    background: #cc3333;
  }

  .loading-stats {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .stats-card {
    background: var(--color-dark-secondary, #1e1e1e);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  }

  .stats-card h3 {
    margin: 0 0 1rem;
    color: var(--color-white-90, #e5e5e5);
    border-bottom: 1px solid var(--color-white-20, #333);
    padding-bottom: 0.5rem;
  }

  .overview-stats {
    display: flex;
    justify-content: space-around;
    gap: 1rem;
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--color-primary, #007bff);
    margin-bottom: 0.5rem;
  }

  .stat-label {
    color: var(--color-white-70, #b3b3b3);
    font-size: 0.9rem;
  }

  .location-list, .video-list, .device-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .location-item, .video-item, .device-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: var(--color-dark-primary, #0f0f0f);
    border-radius: 6px;
    transition: background-color 0.2s;
  }

  .location-item {
    cursor: pointer;
  }

  .location-item:hover {
    background: var(--color-white-10, #1a1a1a);
  }

  .location-name, .video-name, .device-name {
    font-weight: 500;
    color: var(--color-white-90, #e5e5e5);
  }

  .location-views, .video-views {
    color: var(--color-primary, #007bff);
    font-size: 0.9rem;
  }

  .device-views {
    color: var(--color-primary, #007bff);
    font-size: 0.9rem;
  }

  .error-banner {
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid #ff4444;
    color: #ff4444;
    padding: 1rem;
    border-radius: 6px;
    margin-top: 1rem;
    text-align: center;
  }

  /* New Layout Styles */
  .overview-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .metric-card {
    background: var(--color-dark-secondary, #1e1e1e);
    padding: 1.5rem;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .metric-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--color-primary, #007bff);
    margin-bottom: 0.5rem;
  }

  .metric-label {
    color: var(--color-white-70, #b3b3b3);
    font-size: 0.9rem;
  }

  .charts-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 2rem;
  }

  .chart-card {
    background: var(--color-dark-secondary, #1e1e1e);
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .chart-card h3 {
    margin: 0 0 1rem;
    color: var(--color-white-90, #e5e5e5);
    border-bottom: 1px solid var(--color-white-20, #333);
    padding-bottom: 0.5rem;
  }

  .payment-analytics {
    padding: 1rem 0;
  }

  .payment-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .payment-stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--color-dark-primary, #0f0f0f);
    border-radius: 4px;
  }

  .payment-stat .stat-label {
    color: var(--color-white-70, #b3b3b3);
  }

  .payment-stat .stat-value {
    font-weight: bold;
  }

  .payment-stat .stat-value.successful {
    color: #28a745;
  }

  .payment-stat .stat-value.failed {
    color: #dc3545;
  }

  .payment-stat .stat-value.pending {
    color: #ffc107;
  }

  .payment-stat .stat-value.canceled {
    color: #6c757d;
  }

  .location-chart {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .location-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .location-bar .location-name {
    min-width: 60px;
    font-size: 0.9rem;
    color: var(--color-white-90, #e5e5e5);
  }

  .location-bar-container {
    flex: 1;
    position: relative;
    height: 24px;
    background: var(--color-dark-primary, #0f0f0f);
    border-radius: 4px;
    overflow: hidden;
  }

  .location-bar-fill {
    height: 100%;
    background: var(--color-primary, #007bff);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .location-bar-value {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.8rem;
    color: var(--color-white-90, #e5e5e5);
    z-index: 1;
  }

  .stats-table-card {
    background: var(--color-dark-secondary, #1e1e1e);
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .stats-table-card h3 {
    margin: 0 0 1rem;
    color: var(--color-white-90, #e5e5e5);
    border-bottom: 1px solid var(--color-white-20, #333);
    padding-bottom: 0.5rem;
  }

  .stats-table {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .table-header {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--color-dark-primary, #0f0f0f);
    border-radius: 4px;
    font-weight: bold;
    color: var(--color-white-90, #e5e5e5);
  }

  .table-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--color-white-05, #1a1a1a);
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .table-row:hover {
    background: var(--color-white-10, #2a2a2a);
  }

  .video-title {
    color: var(--color-white-90, #e5e5e5);
  }

  .video-views {
    color: var(--color-primary, #007bff);
    font-weight: 500;
  }

  /* Locations Section */
  .locations-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .location-selector h3 {
    margin: 0 0 1rem;
    color: var(--color-white-90, #e5e5e5);
  }

  .location-buttons {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .location-button {
    background: var(--color-dark-secondary, #1e1e1e);
    border: 2px solid var(--color-white-20, #333);
    color: var(--color-white-90, #e5e5e5);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: inherit;
  }

  .location-button:hover {
    border-color: var(--color-primary, #007bff);
    background: var(--color-white-10, #2a2a2a);
  }

  .location-button.active {
    background: var(--color-primary, #007bff);
    border-color: var(--color-primary, #007bff);
    color: white;
  }

  .location-views-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.8rem;
  }

  .location-details {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .location-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .device-list-card, .location-videos-card {
    background: var(--color-dark-secondary, #1e1e1e);
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .device-list-card h3, .location-videos-card h3 {
    margin: 0 0 1rem;
    color: var(--color-white-90, #e5e5e5);
    border-bottom: 1px solid var(--color-white-20, #333);
    padding-bottom: 0.5rem;
  }

  .location-videos {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  @media (max-width: 768px) {
    .dashboard {
      flex-direction: column;
    }

    .dashboard-nav {
      width: 100%;
      height: auto;
    }

    .nav-menu {
      display: flex;
      flex-direction: row;
      overflow-x: auto;
    }

    .nav-item {
      flex-shrink: 0;
    }

    .dashboard-main {
      padding: 1rem;
    }

    .metrics-row {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .charts-row {
      grid-template-columns: 1fr;
    }

    .location-buttons {
      flex-direction: column;
    }

    .modal-content {
      margin: 1rem;
      width: calc(100% - 2rem);
    }
  }
</style>
