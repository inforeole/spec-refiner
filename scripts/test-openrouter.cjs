const https = require('https');

const apiKey = process.env.VITE_OPENROUTER_API_KEY;
if (!apiKey) {
    console.error('No API key found in environment variables (VITE_OPENROUTER_API_KEY)');
    process.exit(1);
}

const data = JSON.stringify({
    model: 'anthropic/claude-3.5-sonnet',
    messages: [
        { role: 'user', content: 'Hello, are you working?' }
    ]
});

const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Spec Refiner Debug'
    }
};

console.log(`Testing OpenRouter with model: anthropic/claude-3-sonnet`);

const req = https.request(options, (res) => {
    let body = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        body += chunk;
    });

    res.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            console.log('Response:', JSON.stringify(parsed, null, 2));
            if (res.statusCode !== 200) {
                console.log('\n--- Troubleshooting ---');
                if (parsed.error && parsed.error.code === 404) {
                    console.log('Model not found. Trying to list available models...');
                    // Could trigger a model list here if needed, but let's just see this output first.
                }
            }
        } catch (e) {
            console.log('Raw Body:', body);
        }
    });
});

req.on('error', (error) => {
    console.error('Request Error:', error);
});

req.write(data);
req.end();
