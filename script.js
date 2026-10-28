/* script.js - persistência via localStorage
   Key: solicitacoesHotel_v1
*/


const STORAGE_KEY = 'solicitacoesHotel_v1';
const PYTHON_API_URL = 'http://127.0.0.1:5002';

// Mapeamento de categorias -> tipos (subopções)
const CATEGORIES = {
  recepcao: ["Troca de quarto", "Suporte a hóspede", "Verificação de check-in/out", "Solicitação especial"],
  manutencao: ["Lâmpada queimada", "Manutenção predial", "Conserto de ar-condicionado", "Problema elétrico", "Problema hidráulico"],
  restaurante: ["Reposição de estoque", "Manutenção de equipamentos", "Solicitação de insumos", "Suporte de serviços"],
  governanca: ["Áreas comuns", "Higienização de área", "Reposição de materiais", "Limpeza especializada"]
};

// Estado local temporário
let prioridadeSelecionada = "";

// --- Helper functions de storage ---
function getSolicitacoesFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e){
    console.error("Erro ao ler localStorage:", e);
    return [];
  }
}

async function enviarSolicitacao() {
  console.log("O botão foi clicado e a função iniciou!");
  const dados = {
    departamento: categoriaEl.value,
    tipo: opcaoEl.value.trim(),
    prioridade: prioridadeSelecionada,
    descricao: descricaoEl.value.trim()
  };

  // Validação simples
  if (!dados.departamento || !dados.tipo || !prioridadeSelecionada || !dados.descricao) {
    showMessage("Por favor, preencha todos os campos.", "error");
    return;
  }

  try {
    const response = await fetch(PYTHON_API_URL + '/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const resultado = await response.json();

    if (resultado.success) {
      showMessage("Solicitação gravada no Banco de Dados!", "success");
      resetForm();
      listarSolicitacoes(); // Atualiza a tabela buscando do banco
    } else {
      showMessage("Erro do servidor: " + resultado.error, "error");
    }
  } catch (error) {
    console.error("Erro na conexão:", error);
    showMessage("Erro ao conectar com a API.", "error");
  }
}

// --- DOM refs ---
const categoriaEl = document.getElementById('categoria');
const opcaoEl = document.getElementById('opcao');
const opcoesEl = document.getElementById('opcoes-solicitacao');
const descricaoEl = document.getElementById('descricao');
const formEl = document.getElementById('form-solicitacao');
const mensagemEl = document.getElementById('mensagem');
const tbody = document.getElementById('tbody-solicitacoes');
const filtroCategoria = document.getElementById('filtro-categoria');
const filtroPrioridade = document.getElementById('filtro-prioridade');
const filtroStatus = document.getElementById('filtro-status');
const searchEl = document.getElementById('search');
const ordenarEl = document.getElementById('ordenar');
const exportBtn = document.getElementById('export-json');
const importFile = document.getElementById('import-file');
const limparTudoBtn = document.getElementById('limpar-tudo');
const btnReset = document.getElementById('btn-reset');

const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
  populateCategorySelects();
  attachPriorityButtons();
  carregarDashboard();
  listarSolicitacoes();
  attachFormListeners();
  attachFilters();
});

async function carregarDashboard() {
  const mensagem = document.getElementById('dashboard-mensagem');
  try {
    const response = await fetch(PYTHON_API_URL + '/api/dashboard');
    const dados = await response.json();
    if (!response.ok) throw new Error(dados.error || 'Erro ao carregar indicadores.');
    Object.entries(dados.resumo).forEach(([chave, valor]) => {
      const elemento = document.querySelector('[data-metrica="' + chave + '"]');
      if (elemento) elemento.textContent = Number(valor).toLocaleString('pt-BR');
    });
    renderizarBarras('dashboard-departamentos', dados.departamentos, nomeDashboard);
    renderizarBarras('dashboard-prioridades', dados.prioridades, nomeDashboard, true);
    renderizarBarras('dashboard-meses', completarMeses(dados.ultimos_meses), nomeMesDashboard);
    mensagem.textContent = '';
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    mensagem.textContent = 'Não foi possível carregar os indicadores.';
    ['dashboard-departamentos', 'dashboard-prioridades', 'dashboard-meses'].forEach(id => {
      document.getElementById(id).innerHTML = '<p class="dashboard-vazio">Dados indisponíveis.</p>';
    });
  }
}

function renderizarBarras(id, itens, formatarNome, prioridades = false) {
  const container = document.getElementById(id);
  if (!itens.length) { container.innerHTML = '<p class="dashboard-vazio">Nenhuma solicitação registrada.</p>'; return; }
  const maximo = Math.max(...itens.map(item => Number(item.total)), 1);
  container.innerHTML = itens.map(item => {
    const percentual = Math.max(Number(item.total) / maximo * 100, item.total ? 3 : 0);
    const nome = formatarNome(item.nome ?? item.mes);
    const cor = prioridades ? ' barra-prioridade-' + escapeHtml(item.nome) : '';
    return '<div class="barra-item' + cor + '"><span class="barra-nome" title="' + escapeHtml(nome) + '">' + escapeHtml(nome) + '</span><span class="barra-trilho"><span class="barra-preenchimento" style="display:block;width:' + percentual + '%"></span></span><span class="barra-valor">' + Number(item.total) + '</span></div>';
  }).join('');
}

function nomeDashboard(nome) { return nome ? nome[0].toLocaleUpperCase('pt-BR') + nome.slice(1) : 'Não informado'; }
function completarMeses(dados) {
  const porMes = new Map(dados.map(item => [item.mes, Number(item.total)]));
  const hoje = new Date();
  return Array.from({ length: 6 }, (_, indice) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + indice, 1);
    const chave = data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');
    return { mes: chave, total: porMes.get(chave) || 0 };
  });
}

function nomeMesDashboard(mes) { const [ano, numero] = mes.split('-'); return new Date(Number(ano), Number(numero) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }); }

// Preenche selects de categoria (form e filtro)
function populateCategorySelects(){
  for(const key of Object.keys(CATEGORIES)){
    const label = capitalize(key);
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    categoriaEl.appendChild(opt);

    const opt2 = opt.cloneNode(true);
    filtroCategoria.appendChild(opt2);
  }
}

// Quando muda categoria do formulário -> atualiza sub-opções
categoriaEl.addEventListener('change', () => {
  atualizarOpcoes();
});

function atualizarOpcoes(){
  const cat = categoriaEl.value;
  opcoesEl.innerHTML = '';
  (CATEGORIES[cat] || []).forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opcoesEl.appendChild(opt);
  });
}

// Prioridade: clicar seleciona
function attachPriorityButtons(){
  document.querySelectorAll('.prioridade-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.prioridade-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      prioridadeSelecionada = btn.dataset.value;
    });
  });
}

// Form submit
function attachFormListeners(){
  formEl.addEventListener('submit', e => {
    e.preventDefault();
    enviarSolicitacao();
  });

  btnReset.addEventListener('click', resetForm);
}



// Reset do formulário
function resetForm(){
  formEl.reset();
  prioridadeSelecionada = "";
  document.querySelectorAll('.prioridade-option').forEach(b => b.classList.remove('selected'));
  atualizarOpcoes();
}

// Mostrar mensagem temporária
function showMessage(text, type="info"){
  mensagemEl.textContent = text;
  mensagemEl.style.color = (type === 'error') ? '#e74c3c' : (type === 'success' ? '#2ecc71' : '#666');
  setTimeout(() => {
    mensagemEl.textContent = '';
  }, 3000);
}

// Renderiza tabela aplicando filtros e ordenação
async function listarSolicitacoes() {
  try {
    // Captura os valores dos filtros da tela
    const cat = filtroCategoria.value;
    const prio = filtroPrioridade.value;
    const stat = filtroStatus.value;
    const busca = searchEl.value;

    // Monta a URL com os parâmetros de busca (Query String)
    const params = new URLSearchParams({
      categoria: cat,
      prioridade: prio,
      status: stat,
      busca
    });
    const url = `${PYTHON_API_URL}/api/solicitacoes?${params}`;
    
    const response = await fetch(url);
    const lista = await response.json();
    if (!response.ok) {
      throw new Error(lista.error || 'Erro ao carregar solicitações.');
    }
   

    // 2. Limpa a tabela antes de renderizar
    tbody.innerHTML = '';

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#888">Nenhuma solicitação no banco de dados.</td></tr>`;
      return;
    }

    // 3. Renderiza cada linha vinda do MySQL
    lista.forEach(s => {
    // Normaliza as chaves para lowercase e pega campos por possíveis variantes
  const rowLower = Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k.toLowerCase(), v])
  );

  function pick(...names){
    for(const n of names){
      const key = n.toLowerCase();
      if (rowLower[key] !== undefined && rowLower[key] !== null) return rowLower[key];
    }
    return '';
  }

  const id = pick('id','request_id');
  const dataCriacao = pick('data_criacao','created_at','date');
  const departamento = pick('departamento','depto','department','setor');
  const tipoVal = pick('tipo','tipo_solicitacao','assunto','subject');
  const prioridadeVal = pick('prioridade','prio','priority');
  const statusVal = pick('status','estado');
  const descricaoVal = pick('descricao','description','detalhes','details');

  const tr = document.createElement('tr');

  // Formata a data para exibição
  let dataExibicao = formatDate(dataCriacao);

  tr.innerHTML = `
    <td>${escapeHtml(id || '')}</td>
    <td>${escapeHtml(dataExibicao)}</td>
    <td>${escapeHtml(departamento || 'Não informado')}</td>
    <td>${escapeHtml(tipoVal || 'Não informado')}</td>
    <td><span class="badge prioridade-${escapeHtml(prioridadeVal || '')}">${capitalize(prioridadeVal)}</span></td>
    <td class="col-descricao" title="${escapeHtml(descricaoVal)}">${truncate(descricaoVal, 60)}</td>
    <td>
      <select class="status-select" data-id="${escapeHtml(id)}">
        <option value="Aberta">Aberta</option>
        <option value="Em andamento">Em andamento</option>
        <option value="Concluída">Concluída</option>
      </select>
    </td>
    <td class="actions">
      <button class="btn-ver" 
        data-id="${escapeHtml(id)}" 
        data-data-criacao="${escapeHtml(dataCriacao)}" 
        data-departamento="${escapeHtml(departamento)}" 
        data-tipo="${escapeHtml(tipoVal)}" 
        data-prio="${escapeHtml(prioridadeVal)}" 
        data-status="${escapeHtml(statusVal)}" 
        data-desc="${escapeHtml(descricaoVal)}">Ver</button>
      <button class="btn-excluir">Excluir</button>
    </td>
  `;

  // --- AQUI ESTÁ O QUE FALTAVA PARA OS BOTÕES ---
  // Ação do botão Ver
    tr.querySelector('.btn-ver').addEventListener('click', (e) => {
          // use e.currentTarget para garantir que pegamos o botão, mesmo se o click for em um filho
          const btn = e.currentTarget || e.target;
          // usar getAttribute com fallbacks para evitar problemas de mapeamento do dataset
          const dadosDoBotao = {
            id: btn.getAttribute('data-id') || btn.dataset.id || '',
            data_criacao: btn.getAttribute('data-data-criacao') || btn.getAttribute('data-criacao') || btn.dataset.dataCriacao || btn.dataset.data || '',
            departamento: btn.getAttribute('data-departamento') || btn.getAttribute('data-depto') || btn.dataset.departamento || btn.dataset.depto || '',
            tipo: btn.getAttribute('data-tipo') || btn.dataset.tipo || '',
            prioridade: btn.getAttribute('data-prio') || btn.dataset.prio || '',
            status: btn.getAttribute('data-status') || btn.dataset.status || '',
            descricao: btn.getAttribute('data-desc') || btn.dataset.desc || ''
          };
          console.log('btn dadosDoBotao:', dadosDoBotao);

          abrirModal(dadosDoBotao);
        });
  // Ação do botão Excluir
  tr.querySelector('.btn-excluir').addEventListener('click', () => {
    if(confirm(`Deseja excluir a solicitação #${id}?`)) {
      excluirSolicitacao(id);
    }
  });
  // ----------------------------------------------

  tbody.appendChild(tr);

  const select = tr.querySelector('.status-select');
  select.value = statusVal || '';
  atualizarCorStatus(select);
  
  select.addEventListener('change', (e) => {
    atualizarStatusNoBanco(id, e.target.value);
    atualizarCorStatus(e.target);
  });
});

  } catch (error) {
    console.error("Erro ao listar:", error);
    tbody.innerHTML = `<tr><td colspan="8" style="color:red">Erro ao carregar dados do banco.</td></tr>`;
  }
}

// Atualiza status e salva
async function atualizarStatusNoBanco(id, novoStatus) {
  try {
    const response = await fetch(PYTHON_API_URL + '/api/solicitacoes', {
      method: 'PUT', // Usamos PUT para atualizações
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: novoStatus })
    });

    const resultado = await response.json();
    if (resultado.success) {
      showMessage('Status atualizado no banco!', 'success');
    } else {
      showMessage('Erro ao atualizar status: ' + resultado.error, 'error');
    }
  } catch (error) {
    console.error("Erro na conexão:", error);
    showMessage("Erro ao conectar com a API.", "error");
  }
}

// Excluir
async function excluirSolicitacao(id) {
  try {
    const response = await fetch(PYTHON_API_URL + '/api/solicitacoes', {
      method: 'DELETE', // Usamos DELETE para remover
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    const resultado = await response.json();
    if (resultado.success) {
      showMessage('Solicitação removida do MySQL!', 'success');
      listarSolicitacoes(); // Recarrega a tabela para sumir a linha
    } else {
      showMessage('Erro ao excluir: ' + resultado.error, 'error');
    }
  } catch (error) {
    console.error("Erro na conexão:", error);
    showMessage("Erro ao conectar com a API.", "error");
  }
}

// Modal
function abrirModal(s){
  modalBody.innerHTML = `
    <h3>Solicitação #${s.id}</h3>
    <p><strong>Data:</strong> ${formatDate(s.data_criacao)}</p>
    <p><strong>Departamento:</strong> ${escapeHtml(s.departamento)}</p>
    <p><strong>Tipo:</strong> ${escapeHtml(s.tipo)}</p>
    <p><strong>Prioridade:</strong> ${capitalize(s.prioridade)}</p>
    <p><strong>Status:</strong> ${escapeHtml(s.status)}</p>
    <p><strong>Descrição:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(s.descricao)}</p>
  `;
  modal.classList.remove('hidden');
}

modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('hidden'); });

// filtros e controles
function attachFilters(){
  [filtroCategoria, filtroPrioridade, filtroStatus, searchEl, ordenarEl].forEach(el => {
    el.addEventListener('input', listarSolicitacoes);
    el.addEventListener('change', listarSolicitacoes);
  });

  if (exportBtn) exportBtn.addEventListener('click', exportToJson);
  if (importFile) importFile.addEventListener('change', handleImport);
  if (limparTudoBtn) limparTudoBtn.addEventListener('click', () => {
    if(confirm('Limpar todas as solicitações salvas localmente? Essa ação é irreversível.')) {
      localStorage.removeItem(STORAGE_KEY);
      listarSolicitacoes();
      showMessage('Todos os registros foram removidos.', 'success');
    }
  });
}

// Export JSON
function exportToJson(){
  const lista = getSolicitacoesFromStorage();
  const blob = new Blob([JSON.stringify(lista, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solicitacoes_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Import JSON (merge evitando duplicados)
function handleImport(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(evt){
    try{
      const imported = JSON.parse(evt.target.result);
      if(!Array.isArray(imported)) throw new Error('Arquivo inválido');
      let existent = getSolicitacoesFromStorage();
      const idsExist = new Set(existent.map(x => x.id));
      const toAdd = imported.map(item => {
        if(!item.id || idsExist.has(item.id)) {
          return { ...item, id: Date.now().toString() + Math.random().toString(36).slice(2,6) };
        }
        return item;
      });
      const merged = existent.concat(toAdd);
      listarSolicitacoes();
      showMessage('Importação concluída!', 'success');
    } catch(err){
      alert('Erro ao importar: ' + err.message);
    } finally {
      importFile.value = '';
    }
  };
  reader.readAsText(file);
}

// Utilitários
function formatDate(iso){
  if (!iso) return 'Sem data';
  // se for string, tenta extrair YYYY-MM-DD via regex (cobre vários formatos)
  if (typeof iso === 'string'){
    const lowered = iso.trim().toLowerCase();
    if (lowered.includes('invalid')) return 'Sem data';
    const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  // fallback para objetos Date ou strings ISO não padronizadas
  try{
    const d = new Date(iso);
    if (!isNaN(d)){
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch(e){}
  return 'Sem data';
}

function truncate(text, max){
  if(text.length <= max) return escapeHtml(text);
  return escapeHtml(text.slice(0, max)) + '…';
}
function capitalize(s){
  if(!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}
function slugify(text){
  return text.toString().toLowerCase().replace(/\s+/g,'_').replace(/[^\w\-]+/g,'');
}
function escapeHtml(unsafe){
  return (unsafe+'').replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]; });
}


// Função para atualizar a cor do fundo do select de status
function atualizarCorStatus(selectElement) {
    if (!selectElement) return;
    
    selectElement.classList.remove('status-aberta', 'status-andamento', 'status-concluida');
    
    const status = selectElement.value;
    if (status === "" || status === "Todos status") return;

    if (status === "Aberta") selectElement.classList.add('status-aberta');
    else if (status === "Em andamento") selectElement.classList.add('status-andamento');
    else if (status === "Concluída") selectElement.classList.add('status-concluida');
}

// Aplica a cor inicial assim que a página carrega
document.querySelectorAll('tbody .status-select').forEach(select => {
    atualizarCorStatus(select);
    select.addEventListener('change', () => atualizarCorStatus(select));
});
