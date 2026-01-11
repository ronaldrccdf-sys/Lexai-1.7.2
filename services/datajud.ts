// Unificação Nacional - DATAJUD Only
export interface DatajudProcess {
  id: string;
  number: string;
  numero_cnj: string;
  classe: string;
  tribunal: string;
  tribunalAlias: string;
  orgao_julgador: string;
  data_ajuizamento: string;
  movimentacoes: {
    id: number;
    data: string;
    conteudo: string;
    nome: string;
  }[];
  partes: {
    nome: string;
    tipo: string;
  }[];
}

export const DATAJUD_TRIBUNAL_ALIASES = [
  'tjac', 'tjal', 'tjap', 'tjam', 'tjba', 'tjce', 'tjdf', 'tjes', 'tjgo', 'tjma',
  'tjmt', 'tjms', 'tjmg', 'tjpa', 'tjpb', 'tjpr', 'tjpe', 'tjpi', 'tjrj', 'tjrn',
  'tjrs', 'tjro', 'tjrr', 'tjsc', 'tjse', 'tjsp', 'tjto',
  'trf1', 'trf2', 'trf3', 'trf4', 'trf5', 'trf6',
  'trt1', 'trt2', 'trt3', 'trt4', 'trt5', 'trt6', 'trt7', 'trt8', 'trt9', 'trt10',
  'trt11', 'trt12', 'trt13', 'trt14', 'trt15', 'trt16', 'trt17', 'trt18', 'trt19',
  'trt20', 'trt21', 'trt22', 'trt23', 'trt24',
  'stj', 'tst', 'tse', 'stm'
];

export const datajudService = {
  async getProcessByCNJ(cnj: string, tribunalAlias: string): Promise<DatajudProcess | null> {
    const cleanCNJ = cnj.replace(/[^0-9]/g, '');
    if (cleanCNJ.length !== 20) {
      console.warn("Número de processo inválido (deve ter 20 dígitos):", cleanCNJ);
    }
    
    const body = {
      query: {
        match: {
          numeroProcesso: cleanCNJ
        }
      }
    };

    try {
      const response = await fetch(`/proxy/datajud/${tribunalAlias}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error("Status " + response.status);

      const result = await response.json();
      const hits = result.hits?.hits;

      if (!hits || hits.length === 0) return null;

      const source = hits[0]._source;
      const tribunal = hits[0]._tribunal || tribunalAlias.toUpperCase();
      
      return {
        id: source.id || (source.numeroProcesso + (source.grau || '')),
        number: source.numeroProcesso,
        numero_cnj: source.numeroProcesso,
        classe: source.classe?.nome || 'Classe não informada',
        tribunal: tribunal,
        tribunalAlias,
        orgao_julgador: source.orgaoJulgador?.nome || 'Vara Indefinida',
        data_ajuizamento: source.dataAjuizamento,
        movimentacoes: (source.movimentos || source.movimentacoes || []).map((m: any, i: number) => ({
          id: i,
          data: m.dataHora,
          conteudo: m.nome || m.movimento?.nome || 'Movimentação sem descrição',
          nome: m.nome || m.movimento?.nome
        })),
        partes: (source.partes || []).map((p: any) => ({
          nome: p.nome,
          tipo: p.tipoPersonagem
        }))
      };
    } catch (error: any) {
      console.warn("Aviso DATAJUD: Erro de conexão.", error.message);
      return null;
    }
  }
};
