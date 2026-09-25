// Configurações do fluxo inteiro (PRD 19.1): ficam em `settings`, no nível
// raiz do JSON do workflow, nunca dentro de um nó
// (`n8n/referencia/README.md`, armadilha 12).

export function aplicarConfiguracoesFluxo(config) {
  const padrao = {
    executionOrder: 'v1',
    callerPolicy: 'workflowsFromSameOwner',
    timezone: 'America/Sao_Paulo',
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'all',
  };
  return { ...padrao, ...(config?.fluxo?.settings ?? {}) };
}
