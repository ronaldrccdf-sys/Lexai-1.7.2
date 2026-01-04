import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

app.post('/proxy/datajud/:tribunal', async (req, res) => {
  const { tribunal } = req.params;
  const endpoint = `${DATAJUD_BASE_URL}/api_publica_${tribunal}/_search`;

  console.log(`Proxying request to: ${endpoint}`);
  console.log('Request body:', JSON.stringify(req.body));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'LexAI-Pro/1.0'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    console.log(`Response status: ${response.status}`);
    res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Proxy Error Details:', error);
    res.status(500).json({ error: 'Failed to fetch from DataJud', details: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend proxy running on port ${port}`);
});
