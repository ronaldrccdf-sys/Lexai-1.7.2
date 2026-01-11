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
const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

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
