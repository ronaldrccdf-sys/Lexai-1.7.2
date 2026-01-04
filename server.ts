import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

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
  
  // Format the query properly for DataJud
  const query = req.body;

  // Prioritize most relevant endpoints for Brazilian Law to speed up and improve hit rate
  const prioritizedEndpoints = [
    'tjsp', 'trf1', 'stj', 'tst', 'tse', 'stm', 'trf2', 'trf3', 'trf4', 'trf5', 'trf6',
    'trt2', 'tjrj', 'tjmg', 'tjrs', 'tjpr'
  ];
  
  const otherEndpoints = ENDPOINTS.filter(e => !prioritizedEndpoints.includes(e));
  const orderedEndpoints = [...prioritizedEndpoints, ...otherEndpoints];

  const searchPromises = orderedEndpoints.map(async (tribunal) => {
    const endpoint = `${DATAJUD_BASE_URL}/api_publica_${tribunal}/_search`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${DATAJUD_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(query),
        timeout: 15000
      });
      
      if (response.ok) {
        const data = await response.json();
        const hits = data.hits?.hits || [];
        return hits.map((hit: any) => ({
          ...hit,
          _tribunal: tribunal.toUpperCase()
        }));
      } else {
        const errText = await response.text();
        console.error(`Tribunal ${tribunal} error (${response.status}):`, errText);
      }
    } catch (e: any) {
      console.error(`Tribunal ${tribunal} exception:`, e.message);
      return [];
    }
    return [];
  });

  try {
    const results = await Promise.all(searchPromises);
    const flatResults = results.flat();
    
    // De-duplicate and sort results
    const seen = new Set();
    const uniqueResults = flatResults.filter(hit => {
      const id = hit._id || (hit._source && hit._source.numeroProcesso);
      if (id && !seen.has(id)) {
        seen.add(id);
        return true;
      }
      return false;
    });

    res.json({ hits: { hits: uniqueResults } });
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

    const text = await response.text();
    console.log(`Response status: ${response.status}`);
    
    try {
      const data = JSON.parse(text);
      res.status(response.status).json(data);
    } catch (parseError) {
      console.error('Failed to parse DataJud response:', text);
      res.status(response.status).send(text);
    }
  } catch (error: any) {
    console.error('Proxy Error Details:', error);
    res.status(500).json({ error: 'Failed to fetch from DataJud', details: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend proxy running on port ${port}`);
});
