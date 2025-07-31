async function testAPI(orderId = null) {

    if (!orderId) return;

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
        const response = await fetch(`https://${server}/info/payments/byid/?id=${orderId}`, {
            method: 'GET',
            headers: headers
        });
        
        // Parse JSON response
        const result = await response.text();
        
        // Loop through results and log
        console.log(result);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Call the function
await testAPI(656);