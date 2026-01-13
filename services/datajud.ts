// Unificação Nacional - DATAJUD Only
export interface DatajudProcess {
  id: string;
  number: string;
  numero_cnj: string;
  classe: string;
  tribunal: string;
  orgao_julgador: string;
  data_ajuizamento: string;
  client?: string;
  opposingParty?: string;
  currentSituation?: string;
  notificationDate?: string;
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

export const datajudService = {
  async getProcessByCNJ(cnj: string): Promise<DatajudProcess | null> {
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
      const response = await fetch('/proxy/datajud/search_all', {
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
      const tribunal = hits[0]._tribunal || 'DATAJUD';
      
      // Encontrar partes (Autor/Réu)
      const autor = source.partes?.find((p: any) => p.tipoPersonagem === 'ATIVO')?.nome || 'Não localizado';
      const reu = source.partes?.find((p: any) => p.tipoPersonagem === 'PASSIVO')?.nome || 'Não localizado';
      
      // Encontrar última movimentação
      const movimentacoes = (source.movimentos || source.movimentacoes || []);
      const ultimaMov = movimentacoes[0];
      const teorMov = ultimaMov?.nome || ultimaMov?.movimento?.nome || 'Aguardando atualização';
      const dataMov = ultimaMov?.dataHora ? new Date(ultimaMov.dataHora).toLocaleDateString('pt-BR') : '';

      return {
        id: source.id || (source.numeroProcesso + (source.grau || '')),
        number: source.numeroProcesso,
        numero_cnj: source.numeroProcesso,
        classe: source.classe?.nome || 'Classe não informada',
        tribunal: tribunal,
        orgao_julgador: source.orgaoJulgador?.nome || 'Vara Indefinida',
        data_ajuizamento: source.dataAjuizamento,
        client: autor,
        opposingParty: reu,
        currentSituation: teorMov,
        notificationDate: dataMov,
        movimentacoes: movimentacoes.map((m: any, i: number) => ({
          id: i,
          data: m.dataHora,
          conteudo: m.complementosTabelados?.[0]?.descricao || m.nome || m.movimento?.nome || 'Movimentação sem descrição',
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
  },

  async searchByFilters(filter: string): Promise<any[]> {
    const body = {
      query: {
        match: {
          numeroProcesso: filter.replace(/[^0-9]/g, '')
        }
      }
    };
    try {
      const response = await fetch('/proxy/datajud/search_all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.hits?.hits || [];
    } catch (e) {
      return [];
    }
  }
};