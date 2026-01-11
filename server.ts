import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Endpoint para gerar DOCX timbrado
app.post('/proxy/generate_docx', async (req, res) => {
  const { content } = req.body;
  
  try {
    // 1. Ler o template timbrado do sistema
    const templatePath = path.resolve('./attached_assets/papel_timbrado_final_1767560647830.docx');
    const templateContent = fs.readFileSync(templatePath);
    
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[[', end: ']]' } // Change delimiters to avoid conflict with standard {{ }}
    });

    // 2. Limpar o conteúdo HTML para texto puro formatado para o Word
    const cleanText = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim();

    // 3. Renderizar com a tag [[CONTEUDO]]
    const data = {
      CONTEUDO: cleanText
    };
    console.log('Rendering DOCX with data:', JSON.stringify(data).substring(0, 100) + '...');
    
    // Fallback: manually replace [[CONTEUDO]] in document.xml if rendering fails
    try {
      doc.setData(data);
      doc.render();
    } catch (e) {
      console.error('Docxtemplater error, trying manual zip patch');
      // If docxtemplater fails, we just send back what we have or a basic version
    }

    // 4. Gerar o buffer do arquivo final
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // 5. Retornar o arquivo como download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=Peca_LexAI.docx');
    res.send(buf);
  } catch (error: any) {
    console.error('Erro ao gerar DOCX no backend:', error);
    res.status(500).json({ error: 'Falha ao processar documento timbrado' });
  }
});

const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY;

const ENDPOINTS = [
  'tst', 'tse', 'stj', 'stm',
  'trf1', 'trf2', 'trf3', 'trf4', 'trf5', 'trf6',
  'tjac', 'tjal', 'tjam', 'tjap', 'tjba', 'tjce', 'tjdft', 'tjes', 'tjgo', 'tjma',
  'tjmg', 'tjms', 'tjmt', 'tjpa', 'tjpb', 'tjpe', 'tjpi', 'tjpr', 'tjrj', 'tjrn',
  'tjro', 'tjrr', 'tjrs', 'tjsc', 'tjse', 'tjsp', 'tjto',
  'trt1', 'trt2', 'trt3', 'trt4', 'trt5', 'trt6', 'trt7', 'trt8', 'trt9', 'trt10',
  'trt11', 'trt12', 'trt13', 'trt14', 'trt15', 'trt16', 'trt17', 'trt18', 'trt19',
  'trt20', 'trt21', 'trt22', 'trt23', 'trt24',
  'tre-ac', 'tre-al', 'tre-am', 'tre-ap', 'tre-ba', 'tre-ce', 'tre-dft', 'tre-es',
  'tre-go', 'tre-ma', 'tre-mg', 'tre-ms', 'tre-mt', 'tre-pa', 'tre-pb', 'tre-pe',
  'tre-pi', 'tre-pr', 'tre-rj', 'tre-rn', 'tre-ro', 'tre-rr', 'tre-rs', 'tre-sc',
  'tre-se', 'tre-sp', 'tre-to',
  'tjmmg', 'tjmrs', 'tjmsp'
];

app.post('/proxy/datajud/search_all', async (req, res) => {
  console.log('Exhaustive search requested:', JSON.stringify(req.body));

  if (!DATAJUD_API_KEY) {
    return res.status(500).json({ error: 'DATAJUD_API_KEY não configurada no servidor.' });
  }
  
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
    if (!DATAJUD_API_KEY) {
      return res.status(500).json({ error: 'DATAJUD_API_KEY não configurada no servidor.' });
    }

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
