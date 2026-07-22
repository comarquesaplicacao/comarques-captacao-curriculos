let todosCandidatos = [];
let charts = {};
let senhaSessao = '';
let paginaAtual = 1;
const ITENS_POR_PAGINA = 10;

/* ---------- Login ---------- */
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginMsg = document.getElementById('login-msg');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const senha = document.getElementById('senha').value;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Verificando...';
  loginMsg.textContent = '';

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'listarCandidatos', senha })
    });
    const result = await resp.json();

    if (!result.ok) {
      loginMsg.textContent = result.message || 'Senha incorreta.';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Entrar';
      return;
    }

    todosCandidatos = result.candidatos || [];
    senhaSessao = senha;
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'block';
    montarFiltros();
    aplicarFiltros();
    carregarVagas();
  } catch (err) {
    loginMsg.textContent = 'Erro de conexão. Tente novamente.';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Entrar';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  todosCandidatos = [];
  senhaSessao = '';
  dashboardScreen.style.display = 'none';
  loginScreen.style.display = 'flex';
  loginForm.reset();
  loginBtn.disabled = false;
  loginBtn.textContent = 'Entrar';
});

/* ---------- Filtros ---------- */
function opcoesUnicas(campo) {
  return [...new Set(todosCandidatos.map(c => c[campo]).filter(Boolean))].sort();
}

function montarFiltros() {
  preencherSelect('f-cargo', opcoesUnicas('Cargo Desejado'));
  preencherSelect('f-estado', opcoesUnicas('Estado'));
  preencherSelect('f-escolaridade', opcoesUnicas('Escolaridade'));
  preencherSelect('f-disponibilidade', opcoesUnicas('Disponibilidade'));
}

function preencherSelect(id, opcoes) {
  const select = document.getElementById(id);
  const atual = select.value;
  select.innerHTML = `<option value="">Todos</option>`;
  opcoes.forEach(op => {
    const el = document.createElement('option');
    el.value = op;
    el.textContent = op;
    select.appendChild(el);
  });
  select.value = atual;
}

['f-busca', 'f-cargo', 'f-estado', 'f-escolaridade', 'f-disponibilidade', 'f-de', 'f-ate']
  .forEach(id => document.getElementById(id).addEventListener('input', aplicarFiltros));

document.getElementById('limpar-filtros').addEventListener('click', () => {
  ['f-busca', 'f-de', 'f-ate'].forEach(id => document.getElementById(id).value = '');
  ['f-cargo', 'f-estado', 'f-escolaridade', 'f-disponibilidade'].forEach(id => document.getElementById(id).value = '');
  aplicarFiltros();
});

function aplicarFiltros(resetarPagina = true) {
  if (resetarPagina) paginaAtual = 1;
  const busca = document.getElementById('f-busca').value.trim().toLowerCase();
  const cargo = document.getElementById('f-cargo').value;
  const estado = document.getElementById('f-estado').value;
  const escolaridade = document.getElementById('f-escolaridade').value;
  const disponibilidade = document.getElementById('f-disponibilidade').value;
  const de = document.getElementById('f-de').value;
  const ate = document.getElementById('f-ate').value;

  const filtrados = todosCandidatos.filter(c => {
    if (busca) {
      const alvo = `${c['Nome Completo'] || ''} ${c['Email'] || ''}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    if (cargo && c['Cargo Desejado'] !== cargo) return false;
    if (estado && c['Estado'] !== estado) return false;
    if (escolaridade && c['Escolaridade'] !== escolaridade) return false;
    if (disponibilidade && c['Disponibilidade'] !== disponibilidade) return false;
    if (de && new Date(c['Data Envio']) < new Date(de)) return false;
    if (ate && new Date(c['Data Envio']) > new Date(ate + 'T23:59:59')) return false;
    return true;
  });

  renderResumo(filtrados);
  renderTabela(filtrados);
  renderGraficos(filtrados);
}

/* ---------- Resumo ---------- */
function renderResumo(lista) {
  const total = lista.length;
  const salarios = lista.map(c => Number(c['Pretensão Salarial'])).filter(v => !isNaN(v) && v > 0);
  const mediaSalarial = salarios.length ? (salarios.reduce((a, b) => a + b, 0) / salarios.length) : 0;

  const contagemCargo = {};
  lista.forEach(c => {
    const cargo = c['Cargo Desejado'];
    if (cargo) contagemCargo[cargo] = (contagemCargo[cargo] || 0) + 1;
  });
  const cargoTop = Object.entries(contagemCargo).sort((a, b) => b[1] - a[1])[0];

  const idades = lista.map(c => Number(c['Idade'])).filter(v => !isNaN(v) && v > 0);
  const mediaIdade = idades.length ? (idades.reduce((a, b) => a + b, 0) / idades.length) : 0;

  document.getElementById('summary-row').innerHTML = `
    <div class="summary-item"><span class="value">${total}</span><span class="label">Candidatos (filtro atual)</span></div>
    <div class="summary-item"><span class="value">${mediaSalarial ? 'R$ ' + mediaSalarial.toFixed(0) : '—'}</span><span class="label">Pretensão salarial média</span></div>
    <div class="summary-item"><span class="value">${mediaIdade ? mediaIdade.toFixed(0) + ' anos' : '—'}</span><span class="label">Idade média</span></div>
    <div class="summary-item"><span class="value">${cargoTop ? cargoTop[0] : '—'}</span><span class="label">Cargo mais buscado</span></div>
  `;
}

/* ---------- Tabela ---------- */
function renderTabela(lista) {
  const corpo = document.getElementById('tabela-corpo');
  const vazio = document.getElementById('empty-state');
  document.getElementById('contador-resultado').textContent = lista.length;

  if (!lista.length) {
    corpo.innerHTML = '';
    vazio.hidden = false;
    renderPaginacao(0);
    return;
  }
  vazio.hidden = true;

  const ordenada = lista.slice().sort((a, b) => new Date(b['Data Envio']) - new Date(a['Data Envio']));
  const totalPaginas = Math.max(1, Math.ceil(ordenada.length / ITENS_POR_PAGINA));
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const paginaItens = ordenada.slice(inicio, inicio + ITENS_POR_PAGINA);

  corpo.innerHTML = paginaItens.map(c => `
      <tr>
        <td>${formatarData(c['Data Envio'])}</td>
        <td>${c['Nome Completo'] || ''}</td>
        <td>${c['Email'] || ''}<br><small>${c['Telefone'] || ''}</small></td>
        <td>${c['Cidade'] || ''} / ${c['Estado'] || ''}</td>
        <td>${c['Bairro'] || ''}</td>
        <td>${c['Cargo Desejado'] || ''}</td>
        <td>${c['Idade'] || ''}</td>
        <td>${c['Pretensão Salarial'] ? 'R$ ' + c['Pretensão Salarial'] : ''}</td>
        <td>${c['Escolaridade'] || ''}</td>
        <td>${c['Disponibilidade'] || ''}</td>
        <td>${c['Veículo Próprio'] || ''}</td>
        <td>${c['Link Currículo'] ? `<a href="${c['Link Currículo']}" target="_blank" class="cv-link">Abrir ↗</a>` : '—'}</td>
        <td><button type="button" class="btn-editar" data-linha="${c._linha}">Editar</button></td>
      </tr>
    `).join('');

  corpo.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => {
      const candidato = ordenada.find(c => String(c._linha) === btn.dataset.linha);
      if (candidato) abrirModalEdicao(candidato);
    });
  });

  renderPaginacao(ordenada.length, totalPaginas);
}

function renderPaginacao(totalItens, totalPaginas) {
  const info = document.getElementById('pag-info');
  const btnAnterior = document.getElementById('pag-anterior');
  const btnProxima = document.getElementById('pag-proxima');

  if (!totalItens) {
    info.textContent = '';
    btnAnterior.disabled = true;
    btnProxima.disabled = true;
    return;
  }

  info.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
  btnAnterior.disabled = paginaAtual <= 1;
  btnProxima.disabled = paginaAtual >= totalPaginas;
}

document.getElementById('pag-anterior').addEventListener('click', () => {
  if (paginaAtual > 1) {
    paginaAtual--;
    aplicarFiltros(false);
  }
});

document.getElementById('pag-proxima').addEventListener('click', () => {
  paginaAtual++;
  aplicarFiltros(false);
});

function formatarData(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('pt-BR');
}

/* ---------- Gráficos ---------- */
const paletaRoxa = ['#6C4FD1', '#8B72DE', '#4B32A6', '#B4A2EA', '#3A2680', '#D6CDF0'];

function destruir(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderGraficos(lista) {
  renderGraficoCargo(lista);
  renderGraficoIdade(lista);
  renderGraficoSalario(lista);
  renderGraficoPeriodo(lista);
}

function renderGraficoCargo(lista) {
  const contagem = {};
  lista.forEach(c => {
    const cargo = c['Cargo Desejado'];
    if (cargo) contagem[cargo] = (contagem[cargo] || 0) + 1;
  });
  const entradas = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 8);

  destruir('cargo');
  charts.cargo = new Chart(document.getElementById('chart-cargo'), {
    type: 'bar',
    data: {
      labels: entradas.map(e => e[0]),
      datasets: [{ data: entradas.map(e => e[1]), backgroundColor: '#6C4FD1', borderRadius: 6 }]
    },
    options: baseOptions(true)
  });
}

function renderGraficoIdade(lista) {
  const faixas = { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0 };
  lista.forEach(c => {
    const idade = Number(c['Idade']);
    if (!idade) return;
    if (idade <= 24) faixas['18-24']++;
    else if (idade <= 34) faixas['25-34']++;
    else if (idade <= 44) faixas['35-44']++;
    else if (idade <= 54) faixas['45-54']++;
    else faixas['55+']++;
  });

  destruir('idade');
  charts.idade = new Chart(document.getElementById('chart-idade'), {
    type: 'bar',
    data: {
      labels: Object.keys(faixas),
      datasets: [{ data: Object.values(faixas), backgroundColor: '#8B72DE', borderRadius: 6 }]
    },
    options: baseOptions(false)
  });
}

function renderGraficoSalario(lista) {
  const faixas = { 'até 1.5k': 0, '1.5k–2.5k': 0, '2.5k–4k': 0, '4k–6k': 0, '6k+': 0 };
  lista.forEach(c => {
    const v = Number(c['Pretensão Salarial']);
    if (!v) return;
    if (v <= 1500) faixas['até 1.5k']++;
    else if (v <= 2500) faixas['1.5k–2.5k']++;
    else if (v <= 4000) faixas['2.5k–4k']++;
    else if (v <= 6000) faixas['4k–6k']++;
    else faixas['6k+']++;
  });

  destruir('salario');
  charts.salario = new Chart(document.getElementById('chart-salario'), {
    type: 'bar',
    data: {
      labels: Object.keys(faixas),
      datasets: [{ data: Object.values(faixas), backgroundColor: '#4B32A6', borderRadius: 6 }]
    },
    options: baseOptions(false)
  });
}

function renderGraficoPeriodo(lista) {
  const contagem = {};
  lista.forEach(c => {
    const d = new Date(c['Data Envio']);
    if (isNaN(d.getTime())) return;
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    contagem[chave] = (contagem[chave] || 0) + 1;
  });
  const meses = Object.keys(contagem).sort();

  destruir('periodo');
  charts.periodo = new Chart(document.getElementById('chart-periodo'), {
    type: 'line',
    data: {
      labels: meses,
      datasets: [{
        data: meses.map(m => contagem[m]),
        borderColor: '#6C4FD1',
        backgroundColor: 'rgba(108, 79, 209, 0.12)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#4B32A6'
      }]
    },
    options: baseOptions(false)
  });
}

function baseOptions(horizontal) {
  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } },
      y: { grid: { color: '#F1EDFC' }, ticks: { font: { family: 'Inter', size: 11 }, precision: 0 } }
    }
  };
}

/* ---------- Gerenciamento de vagas ---------- */

async function chamarApi(payload) {
  const resp = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return resp.json();
}

async function carregarVagas() {
  try {
    const result = await chamarApi({ acao: 'listarVagas', senha: senhaSessao });
    if (result.ok) renderVagas(result.vagas || []);
  } catch (err) {
    console.error('Erro ao carregar vagas', err);
  }
}

function renderVagas(vagas) {
  const corpo = document.getElementById('tabela-vagas-corpo');
  const vazio = document.getElementById('vagas-empty-state');

  if (!vagas.length) {
    corpo.innerHTML = '';
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  corpo.innerHTML = vagas
    .slice()
    .sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao))
    .map(v => `
      <tr>
        <td>${v.titulo}</td>
        <td>
          <select class="status-select status-${v.status}" data-id="${v.id}">
            <option value="Ativa" ${v.status === 'Ativa' ? 'selected' : ''}>Ativa</option>
            <option value="Inativa" ${v.status === 'Inativa' ? 'selected' : ''}>Inativa</option>
            <option value="Fechada" ${v.status === 'Fechada' ? 'selected' : ''}>Fechada</option>
            <option value="Cancelada" ${v.status === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
          </select>
        </td>
        <td>${formatarData(v.dataCriacao)}</td>
        <td><button type="button" class="btn-excluir-vaga" data-id="${v.id}">Excluir</button></td>
      </tr>
    `).join('');

  corpo.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async () => {
      const id = select.dataset.id;
      const novoStatus = select.value;
      select.className = `status-select status-${novoStatus}`;
      try {
        await chamarApi({ acao: 'atualizarStatusVaga', senha: senhaSessao, id, status: novoStatus });
      } catch (err) {
        alert('Erro ao atualizar status. Tente novamente.');
      }
    });
  });

  corpo.querySelectorAll('.btn-excluir-vaga').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Tem certeza que deseja excluir esta vaga?')) return;
      try {
        await chamarApi({ acao: 'excluirVaga', senha: senhaSessao, id: btn.dataset.id });
        carregarVagas();
      } catch (err) {
        alert('Erro ao excluir vaga. Tente novamente.');
      }
    });
  });
}

document.getElementById('form-nova-vaga').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('nova-vaga-titulo');
  const vagaMsg = document.getElementById('vaga-msg');
  const titulo = input.value.trim();
  if (!titulo) return;

  try {
    const result = await chamarApi({ acao: 'criarVaga', senha: senhaSessao, titulo });
    if (result.ok) {
      input.value = '';
      vagaMsg.className = 'form-msg is-visible is-success';
      vagaMsg.textContent = 'Vaga adicionada!';
      carregarVagas();
    } else {
      vagaMsg.className = 'form-msg is-visible is-error';
      vagaMsg.textContent = result.message || 'Erro ao criar vaga.';
    }
  } catch (err) {
    vagaMsg.className = 'form-msg is-visible is-error';
    vagaMsg.textContent = 'Erro de conexão. Tente novamente.';
  }
});

/* ---------- Modal de edição de candidato ---------- */
const modalOverlay = document.getElementById('modal-overlay');
const formEditar = document.getElementById('form-editar-candidato');
const editarMsg = document.getElementById('editar-msg');
let linhaEmEdicao = null;

function abrirModalEdicao(c) {
  linhaEmEdicao = c._linha;
  document.getElementById('ed-nome').value = c['Nome Completo'] || '';
  document.getElementById('ed-email').value = c['Email'] || '';
  document.getElementById('ed-telefone').value = c['Telefone'] || '';
  document.getElementById('ed-nascimento').value = (c['Data Nascimento'] || '').toString().slice(0, 10);
  document.getElementById('ed-estado').value = c['Estado'] || '';
  document.getElementById('ed-cidade').value = c['Cidade'] || '';
  document.getElementById('ed-bairro').value = c['Bairro'] || '';
  document.getElementById('ed-cargo').value = c['Cargo Desejado'] || '';
  document.getElementById('ed-escolaridade').value = c['Escolaridade'] || 'Médio completo';
  document.getElementById('ed-pretensao').value = c['Pretensão Salarial'] || '';
  document.getElementById('ed-disponibilidade').value = c['Disponibilidade'] || 'Imediata';
  document.getElementById('ed-veiculo').value = c['Veículo Próprio'] || 'Sim';
  editarMsg.className = 'form-msg';
  editarMsg.textContent = '';
  modalOverlay.hidden = false;
}

function fecharModalEdicao() {
  modalOverlay.hidden = true;
  linhaEmEdicao = null;
}

document.getElementById('modal-fechar').addEventListener('click', fecharModalEdicao);
document.getElementById('modal-cancelar').addEventListener('click', fecharModalEdicao);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) fecharModalEdicao();
});

formEditar.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!linhaEmEdicao) return;

  const campos = {
    'Nome Completo': document.getElementById('ed-nome').value.trim(),
    'Email': document.getElementById('ed-email').value.trim(),
    'Telefone': document.getElementById('ed-telefone').value.trim(),
    'Data Nascimento': document.getElementById('ed-nascimento').value,
    'Estado': document.getElementById('ed-estado').value.trim().toUpperCase(),
    'Cidade': document.getElementById('ed-cidade').value.trim(),
    'Bairro': document.getElementById('ed-bairro').value.trim(),
    'Cargo Desejado': document.getElementById('ed-cargo').value.trim(),
    'Escolaridade': document.getElementById('ed-escolaridade').value,
    'Pretensão Salarial': document.getElementById('ed-pretensao').value,
    'Disponibilidade': document.getElementById('ed-disponibilidade').value,
    'Veículo Próprio': document.getElementById('ed-veiculo').value
  };

  try {
    const result = await chamarApi({ acao: 'atualizarCandidato', senha: senhaSessao, linha: linhaEmEdicao, campos });
    if (result.ok) {
      fecharModalEdicao();
      const relogin = await chamarApi({ acao: 'listarCandidatos', senha: senhaSessao });
      if (relogin.ok) {
        todosCandidatos = relogin.candidatos || [];
        montarFiltros();
        aplicarFiltros(false);
      }
    } else {
      editarMsg.className = 'form-msg is-visible is-error';
      editarMsg.textContent = result.message || 'Erro ao salvar alterações.';
    }
  } catch (err) {
    editarMsg.className = 'form-msg is-visible is-error';
    editarMsg.textContent = 'Erro de conexão. Tente novamente.';
  }
});

/* ---------- Export CSV ---------- */
document.getElementById('exportar-csv').addEventListener('click', () => {
  if (!todosCandidatos.length) return;
  const colunas = Object.keys(todosCandidatos[0]).filter(c => c !== '_linha');
  const linhas = [colunas.join(';')];
  todosCandidatos.forEach(c => {
    linhas.push(colunas.map(col => `"${String(c[col] ?? '').replace(/"/g, "'")}"`).join(';'));
  });
  const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `candidatos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
