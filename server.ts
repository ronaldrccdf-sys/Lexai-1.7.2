import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const ENDPOINTS = [
  'tjsp', 'trf1', 'trt2', 'stj', 'tst', 'tse', 'stm',
  'tjac', 'tjal', 'tjap', 'tjam', 'tjba', 'tjce', 'tjdf', 'tjes', 'tjgo', 'tjma',
  'tjmt', 'tjms', 'tjmg', 'tjpa', 'tjpb', 'tjpr', 'tjpe', 'tjpi', 'tjrj', 'tjrn',
  'tjrs', 'tjro', 'tjrr', 'tjsc', 'tjse', 'tjt0',
  'trf2', 'trf3', 'trf4', 'trf5', 'trf6',
  'trt1', 'trt3', 'trt4', 'trt5', 'trt6', 'trt7', 'trt8', 'trt9', 'trt10', 'trt11',
  'trt12', 'trt13', 'trt14', 'trt15', 'trt16', 'trt17', 'trt18', 'trt19', 'trt20', 'trt21', 'trt22', 'trt23', 'trt24'
];

app.post('/proxy/datajud/search_all', async (req, res) => {
  console.log('Exhaustive search requested:', JSON.stringify(req.body));
  
  const searchPromises = ENDPOINTS.map(async (tribunal) => {
    const endpoint = `${DATAJUD_BASE_URL}/api_publica_${tribunal}/_search`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${DATAJUD_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LexAI-Pro/1.0'
        },
        body: JSON.stringify(req.body),
        timeout: 5000
      });
      if (response.ok) {
        const data = await response.json();
        return data.hits?.hits || [];
      }
    } catch (e) {
      return [];
    }
    return [];
  });

  try {
    const results = await Promise.all(searchPromises);
    const flatResults = results.flat();
    res.json({ hits: { hits: flatResults } });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed exhaustive search', details: error.message });
  }
});

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
