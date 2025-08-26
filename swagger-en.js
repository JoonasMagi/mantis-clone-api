const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const router = express.Router();

// Force reload of YAML file
const yamlPath = path.resolve(__dirname, 'api-en.yaml');
console.log('Loading English YAML from:', yamlPath);
const swaggerDocument = YAML.load(yamlPath);

// Debug: Check if document is loaded correctly
console.log('English document title:', swaggerDocument.info.title);
console.log('English document description:', swaggerDocument.info.description);

// Debug endpoint to check document content
router.get('/debug', (req, res) => {
    res.json({
        title: swaggerDocument.info.title,
        description: swaggerDocument.info.description,
        firstEndpoint: swaggerDocument.paths['/register']?.post?.summary || 'Not found'
    });
});

// Serve the spec JSON first
router.get('/spec.json', (req, res) => {
    res.json(swaggerDocument);
});

// Serve Swagger UI for English documentation
// Generate custom HTML to ensure correct document is loaded
router.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Mantis Clone API - English</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        .swagger-ui .topbar { display: none }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/en/spec.json?t=' + Date.now(),
            dom_id: '#swagger-ui',
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.standalone
            ]
        });
    </script>
</body>
</html>`;
    res.send(html);
});

// Serve static assets for any other requests
router.use('/', swaggerUi.serve);

module.exports = router;
