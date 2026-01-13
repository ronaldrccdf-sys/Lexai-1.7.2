
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import * as mammoth from "mammoth";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY não encontrada nos segredos!");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

export interface JurisprudenceItem {
  id: string;
  title: string;
  summary: string;
  uri: string;
}

export interface DoctrineItem {
  id: string;
  title: string;
  summary: string;
  uri: string;
  source?: string;
}

export interface JurisprudenceFilters {
  court?: string;
  startDate?: string;
  endDate?: string;
  caseType?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  data: string; // Base64
  type: string;
  role: 'template' | 'source';
}

const GEMINI_NATIVE_MIMES = [
  'image/png', 
  'image/jpeg', 
  'image/webp', 
  'application/pdf'
];

const base64ToArrayBuffer = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const extractTextFromWord = async (base64: string): Promise<string> => {
  try {
    const arrayBuffer = base64ToArrayBuffer(base64);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (e) {
    console.error("Erro ao processar Word:", e);
    return "[Erro na extração de texto do arquivo Word]";
  }
};

export const convertWordToHtml = async (base64: string): Promise<string> => {
  try {
    const arrayBuffer = base64ToArrayBuffer(base64);
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value;
  } catch (e) {
    console.error("Erro ao converter Word para HTML:", e);
    return "";
  }
};

export const legalAssistantService = {
  async generateDailyBriefing(stats: any, userName: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gere um briefing diário estratégico LexAI para o advogado ${userName} baseado nestes dados: ${JSON.stringify(stats)}. 
      REGRAS OBRIGATÓRIAS:
      1. NÃO utilize caracteres especiais como asteriscos (*), hashtags (#), sublinhados (_) ou qualquer formatação markdown.
      2. Mantenha a organização por tópicos claros.
      3. Utilize apenas hifens (-) e quebras de linha para separar os pontos.
      4. O tom deve ser executivo, direto e motivador.`,
    });
    // Limpeza extra no cliente para garantir remoção de markdown residual
    return response.text?.replace(/[*#_~`>]/g, '') || '';
  },

  async searchJurisprudence(query: string, filters: JurisprudenceFilters): Promise<JurisprudenceItem[]> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Pesquise jurisprudência recente nos tribunais brasileiros via Radar LexAI: ${query}.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    const items: JurisprudenceItem[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    chunks.forEach((chunk: any, i: number) => {
      if (chunk.web) {
        items.push({ 
          id: `j-${i}`, 
          title: chunk.web.title, 
          summary: '', // Resumo removido conforme solicitado
          uri: chunk.web.uri 
        });
      }
    });
    return items;
  },

  async searchDoctrines(query: string): Promise<DoctrineItem[]> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Aja como um pesquisador acadêmico jurídico. Busque no Google Acadêmico (scholar.google.com), Scielo e repositórios acadêmicos teses e artigos científicos sobre: ${query}. FOCO: Retorne os nomes exatos dos artigos e autores.`,
      config: { tools: [{ googleSearch: {} }] }
    });
    const items: DoctrineItem[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    chunks.forEach((chunk: any, i: number) => {
      if (chunk.web) {
        items.push({ 
          id: `doc-${i}`, 
          title: chunk.web.title || 'Artigo Acadêmico Indefinido', 
          summary: '', // Resumo removido para focar no título e link
          uri: chunk.web.uri 
        });
      }
    });
    return items;
  },

  async advancedLegalDrafting(params: { 
    prompt: string, 
    files: UploadedFile[], 
    jurisprudence?: JurisprudenceItem[],
    doctrines?: DoctrineItem[] 
  }) {
    const ai = getAI();
    const parts: any[] = [];
    let contextStr = "";
    
    for (const f of params.files) {
      if (GEMINI_NATIVE_MIMES.includes(f.type)) {
        parts.push({ inlineData: { data: f.data, mimeType: f.type } });
      } else {
        contextStr += `\nCONTEÚDO ARQUIVO ${f.name}: ${await extractTextFromWord(f.data)}`;
      }
    }

    if (params.jurisprudence?.length) {
      contextStr += `\n\nTESES JURISPRUDENCIAIS PARA USAR:\n${params.jurisprudence.map(j => `Julgado: ${j.title}`).join('\n')}`;
    }

    if (params.doctrines?.length) {
      contextStr += `\n\nREFERÊNCIAS DOUTRINÁRIAS/ACADÊMICAS:\n${params.doctrines.map(d => `Artigo: ${d.title}`).join('\n')}`;
    }

    parts.push({ text: `${contextStr}\n\nSOLICITAÇÃO: ${params.prompt}` });

    const res = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: { 
        systemInstruction: "Você é um Redator Jurídico Sênior LexAI. Escreva peças em HTML limpo (p, b, h1, br). IMPORTANTE: Jamais coloque Local, Data ou Assinatura ao final, o sistema fará isso automaticamente.",
        temperature: 0.2
      }
    });
    return { html: res.text?.replace(/```html/gi, '').replace(/```/g, '').trim() };
  },

  async interpretMovement(movement: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Interprete este movimento processual: ${movement}`,
    });
    return response.text;
  },

  async smartTimeEntry(description: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Formalize este timesheet: ${description}`,
    });
    return response.text;
  },

  async extractHearingData(base64: string, mimeType: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: "Extraia dados de audiência em JSON." }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  },

  async extractClientOnboardingData(base64: string, mimeType: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: "Extraia dados do cliente em JSON." }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  },

  async extractProcessDataFromDoc(base64: string, mimeType: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: "Extraia dados do processo em JSON." }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  },

  async extractContractData(base64: string, mimeType: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: "Extraia dados do contrato em JSON." }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  },

  async extractExecutionData(base64: string, mimeType: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: "Extraia dados de execução em JSON." }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  },

  async unifiedActionHandler(query: string, files: UploadedFile[], currentData: any) {
    const ai = getAI();
    
    let fileContext = "";
    if (files && files.length > 0) {
      for (const f of files) {
        if (f.name.toLowerCase().endsWith('.docx') || f.type.includes('word')) {
          const text = await extractTextFromWord(f.data);
          fileContext += `\nCONTEÚDO DO ARQUIVO "${f.name}":\n${text}\n---`;
        } else if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
          fileContext += `\n[PDF ANEXADO PARA ANÁLISE: ${f.name}]`;
        } else {
          fileContext += `\n[Arquivo anexado: ${f.name} (${f.type})]`;
        }
      }
    }

    const systemInstruction = `Você é o Cérebro LexAI, a inteligência central do sistema LexAI Pro.
    Sua função é auxiliar o advogado em qualquer tarefa do sistema através de comandos naturais.
    
    CRITICAL: Você deve basear suas respostas EXCLUSIVAMENTE nos fatos reais contidos nos arquivos anexados e no contexto do sistema. NÃO invente dados.
    
    Capacidades:
    1. Pesquisa Jurídica (Jurisprudência no DataJud e Doutrina no Google Acadêmico).
    2. Redação de Peças (Petições, Contestações, Contratos).
    3. Gestão de Clientes (Cadastrar, Consultar).
    4. Relatórios (Relatórios de processos ou faturamento).
    5. Gestão de Prazos.

    Contexto Atual do Sistema: ${JSON.stringify(currentData)}
    Conteúdo dos Arquivos Anexados: ${fileContext}`;

    const parts: any[] = [];
    for (const f of files) {
      if (GEMINI_NATIVE_MIMES.includes(f.type)) {
        parts.push({ inlineData: { data: f.data, mimeType: f.type } });
      }
    }

    parts.push({ text: `${systemInstruction}\n\nComando do Usuário: ${query || "Analise os arquivos enviados."}` });
    
    const res = await (ai as any).getGenerativeModel({
      model: 'gemini-1.5-pro',
      systemInstruction: "Você é o Cérebro LexAI. Priorize o conteúdo dos arquivos anexados. Se for um PDF ou DOCX, extraia os nomes, datas e valores reais. Jamais invente dados."
    }).generateContent({ contents: [{ role: 'user', parts }] });
    
    const text = (res.response as any).text();
    return { text, toolCalls: [] };
  },

  async generateDailySummaryWhatsApp(events: any[]) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Resumo WhatsApp: ${JSON.stringify(events)}`,
    });
    return response.text;
  },

  async generateBillingActivityReport(clientName: string, period: string, events: any[]) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Relatório de faturamento para ${clientName}: ${JSON.stringify(events)}`,
    });
    return response.text;
  },

  async generateManagementAnalysis(data: any) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Análise gerencial: ${JSON.stringify(data)}`,
    });
    return response.text;
  },

  async answerManagementQuery(query: string, data: any) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Consulta gestor: ${query}. Dados: ${JSON.stringify(data)}`,
    });
    return response.text;
  }
};
