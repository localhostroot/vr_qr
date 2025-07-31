async function testAPI() {

    const user = "admin";
    const password = "Provr4neba!";
    const server = "4-neba.server.paykeeper.ru";
    
    // Create base64 encoded auth string
    const authString = btoa(`${user}:${password}`);
    
    // Set up headers
    const headers = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    try {
        // Make the GET request
        const response = await fetch(`https://${server}/info/payments/bydate/?start=2025-07-30&end=2025-07-31&payment_system_id[]=30&payment_system_id[]=99&status[]=success&status[]=canceled&status[]=refunded&status[]=failed&status[]=obtained&status[]=refunding&status[]=partially_refunded&status[]=stuck&status[]=pending&limit=10&from=0`, {
            method: 'GET',
            headers: headers
        });
        
        // Parse JSON response
        const result = await response.json();
        
        // Loop through results and log
        console.log(result);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Call the function
await testAPI();