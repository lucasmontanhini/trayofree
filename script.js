/** 
 * TRAYOFREE - SISTEMA DE GESTÃO PROFISSIONAL (VERSÃO PLATINUM)
 * Desenvolvido para Electron + Servidor Local + Mobile
 */

// --- 1. CONFIGURAÇÃO DE CONEXÃO ---
let hostname = window.location.hostname;
if (!hostname || hostname === "" || hostname === "127.0.0.1") hostname = "localhost";
const API_URL = `http://${hostname}:3000/api`;

// --- 2. BANCO DE DADOS (API CENTRAL) ---
const getDB = async (k) => { 
    try { 
        const r = await fetch(`${API_URL}/${k}`, { cache: 'no-store' }); 
        return await r.json(); 
    } catch (e) { return []; } 
};

const saveDB = async (k, d) => { 
    try { 
        await fetch(`${API_URL}/${k}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(d) 
        }); 
    } catch (e) { console.error("Erro ao salvar dados:", e); } 
};

const getConfig = async () => { 
    const cfg = await getDB('configuracoes'); 
    return {
        senha: cfg.senha || "1234",
        nome: cfg.nome || "TrayoFREE System",
        modoCozinha: cfg.modoCozinha || "exclusivo",
        impressoraDesabilitada: cfg.impressoraDesabilitada || false
    }; 
};
// --- 3. MODAL DE SENHA CUSTOMIZADO ---
function exibirModalSenha(titulo) {
    return new Promise((resolve) => {
        const div = document.createElement('div');
        div.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;";
        div.innerHTML = `
            <div style="background:#161616;padding:30px;border-radius:15px;border:1px solid #ff6600;width:350px;text-align:center;">
                <h3 style="color:#ff6600;margin-bottom:20px;font-family:sans-serif;">${titulo}</h3>
                <input type="password" id="passInput" placeholder="PIN" style="width:100%;padding:15px;background:#000;color:#fff;border:1px solid #333;border-radius:10px;text-align:center;font-size:1.5rem;margin-bottom:20px;outline:none;">
                <div style="display:flex;gap:10px;">
                    <button id="passCancel" class="btn" style="background:#444;">CANCELAR</button>
                    <button id="passConfirm" class="btn btn-submit">ENTRAR</button>
                </div>
            </div>`;
        document.body.appendChild(div);
        const inp = document.getElementById('passInput'); 
        inp.focus();
        document.getElementById('passConfirm').onclick = () => { const v = inp.value; document.body.removeChild(div); resolve(v); };
        document.getElementById('passCancel').onclick = () => { document.body.removeChild(div); resolve(null); };
        inp.onkeydown = (e) => { if(e.key === 'Enter') document.getElementById('passConfirm').click(); };
    });
}

// --- 4. GESTÃO DE TURNOS E MENU ---
async function checarTurno() {
    try {
        const status = await getDB('statusTurno');
        const aberto = status && status.aberto === true;
        const config = await getConfig();
        const menu = document.getElementById('menuLateral');
        const path = window.location.pathname;

        if (path.includes('admin.html')) {
            const config = await getConfig();
            const s = await exibirModalSenha("ACESSO ADMIN");
            if (!s || s.trim() !== config.senha.toString().trim()) {
                window.location.href = 'index.html'; return;
            }
        }

         if (menu) {
            let h = `<a href="index.html" class="${path.includes('index.html')?'active':''}">Painel</a>`;
            
            if (aberto) {
                // Link fixo da aba operacional (PC)
                h += `<a href="preparar.html" class="${path.includes('preparar.html')?'active':''}">Monitor</a>`;
                
                // NOVO: Link condicional para a página kitchen.html
                if (config.modoCozinha === 'geral') {
                    h += `<a href="kitchen.html" class="${path.includes('kitchen.html')?'active':''}">TV Cozinha</a>`;
                }

                h += `
                <a href="cadastro.html" class="${path.includes('cadastro.html')?'active':''}">Pedido</a>
                <a href="pagamentos.html" class="${path.includes('pagamentos.html')?'active':''}">Caixa</a>
                <a href="historico.html" class="${path.includes('historico.html')?'active':''}">Histórico</a>
                <a href="disponibilidade.html" class="${path.includes('disponibilidade.html')?'active':''}">Disponibilidade</a>`;
            }
            
            h += `<a href="ajuda.html" class="${path.includes('ajuda.html')?'active':''}">Ajuda</a>`;
            h += `<div class="nav-spacer"></div>`;
            h += `<a href="admin.html" class="${path.includes('admin.html')?'active':''}">Configuração</a>`;
            menu.innerHTML = h;
        }

        const tituloHome = document.querySelector('.welcome-text h1');
        if (tituloHome && (path.includes('index.html') || path.endsWith('/'))) {
            const config = await getConfig();
            tituloHome.innerText = config.nome;
        }

        if (path.includes('index.html') || path.endsWith('/')) {
            renderizarInterfacePainel(aberto);
        }
    } catch (err) { console.error(err); }
}

async function renderizarInterfacePainel(aberto) {
    const area = document.getElementById('areaTurno'); if (!area) return;
    document.getElementById('txtStatusTurno').innerText = aberto ? "Turno em Andamento" : "Turno Fechado";
    area.innerHTML = `<button class="btn ${aberto ? 'btn-red' : 'btn-submit'}" onclick="gerenciarTurno('${aberto ? 'fechar' : 'abrir'}')">${aberto ? 'FINALIZAR TURNO' : 'INICIAR TURNO'}</button>`;
    if (document.getElementById('areaAnalytics')) document.getElementById('areaAnalytics').style.display = aberto ? 'block' : 'none';
    if (aberto) carregarAnalytics();
    renderizarListaTurnos();
}

async function gerenciarTurno(acao) {
    const cfg = await getConfig();
    const s = await exibirModalSenha(acao === 'abrir' ? "ABRIR NOVO TURNO" : "FECHAR TURNO E CAIXA");
    if (!s || s.trim() !== cfg.senha.toString().trim()) return alert("Senha Incorreta!");

    if (acao === 'abrir') {
        const dados = { aberto: true, tipo: new Date().getHours() < 18 ? "DIURNO" : "NOTURNO", abertura: new Date().toLocaleString('pt-BR') };
        await saveDB('statusTurno', dados);
        localStorage.setItem('turnoAberto', 'true');
        localStorage.setItem('dadosTurnoAtual', JSON.stringify(dados));
    } else {
        const peds = await getDB('pedidos');
        const hist = await getDB('historicoTurnos');
        const status = await getDB('statusTurno');
        const dadosI = JSON.parse(localStorage.getItem('dadosTurnoAtual') || '{}');

        // Finaliza automaticamente tudo o que não foi pago
        const pedsFinalizados = peds.map(p => {
            if (p.status !== 'entregue') p.status = 'entregue';
            return p;
        });

        // Calcula totais por meio de pagamento
        const totaisPorMeio = {
            dinheiro: 0,
            credito: 0,
            debito: 0,
            pix: 0
        };

        pedsFinalizados.forEach(p => {
            if (p.meioPagamento && totaisPorMeio.hasOwnProperty(p.meioPagamento)) {
                totaisPorMeio[p.meioPagamento] += parseFloat(p.total) || 0;
            }
        });

        const vendaTotal = pedsFinalizados.reduce((a, p) => a + parseFloat(p.total), 0).toFixed(2);
        const agora = new Date();
        const dataAtual = agora.toLocaleDateString('pt-BR');
        const horaAtual = agora.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

        hist.unshift({ 
            id: Date.now(), 
            nome: `TURNO ${status.tipo || 'GERAL'}`, 
            data: dataAtual, 
            abertura: status.abertura || dadosI.abertura || 'N/A',
            fechamento: `${dataAtual} às ${horaAtual}`,
            vendas: vendaTotal, 
            qtd: pedsFinalizados.length, 
            detalhesPedidos: pedsFinalizados,
            totaisPorMeio: {
                dinheiro: totaisPorMeio.dinheiro.toFixed(2),
                credito: totaisPorMeio.credito.toFixed(2),
                debito: totaisPorMeio.debito.toFixed(2),
                pix: totaisPorMeio.pix.toFixed(2)
            }
        });

        await saveDB('historicoTurnos', hist);
        await saveDB('pedidos', []);
        await saveDB('statusTurno', { aberto: false });
        localStorage.setItem('turnoAberto', 'false');
    }
    location.reload();
}

// --- 5. CADASTRO DE PEDIDOS (PARA PC/DASHBOARD) ---
let itensNoPedidoAtual = [];
let totalGeralPedido = 0;

async function prepararCadastro() {
    const sel = document.getElementById('selectProduto'); 
    if (!sel) return;
    const cat = await getDB('catalogo');
    const disponiveis = cat.filter(p => !p.indisponivel);
    sel.innerHTML = '<option value="">Selecione um produto...</option>' + 
        disponiveis.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
    
    sel.onchange = () => {
        const p = cat.find(x => x.nome === sel.value);
        if(document.getElementById('infoPrecoItem')) 
            document.getElementById('infoPrecoItem').innerText = p ? `R$ ${parseFloat(p.preco).toFixed(2)}` : 'R$ 0,00';
    };
}

const btnAdd = document.getElementById('btnAddItem');
if (btnAdd) {
    btnAdd.onclick = async () => {
        const sel = document.getElementById('selectProduto');
        const cat = await getDB('catalogo');
        const prod = cat.find(x => x.nome === sel.value);
        const qtd = parseInt(document.getElementById('qtd').value) || 1;
        if (!prod) return alert("Selecione um produto primeiro!");
        
        const subtotal = prod.preco * qtd;
        totalGeralPedido += subtotal;
        itensNoPedidoAtual.push({ texto: `${qtd}x ${prod.nome}`, valor: subtotal });
        atualizarListaTemporaria();
    };
}

function atualizarListaTemporaria() {
    const l = document.getElementById('listaTemporaria'); if (!l) return;
    if (itensNoPedidoAtual.length === 0) {
        l.innerHTML = '<p style="color:#444; text-align:center;">Nenhum item adicionado.</p>';
    } else {
        l.innerHTML = itensNoPedidoAtual.map((i, idx) => `
            <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #222;">
                <span>${i.texto}</span>
                <span>R$ ${i.valor.toFixed(2)} <b onclick="removerItemTemp(${idx})" style="color:red; cursor:pointer; margin-left:10px;">[x]</b></span>
            </div>`).join('');
    }
    const totalExibicao = document.getElementById('totalComanda');
    if(totalExibicao) totalExibicao.innerText = `R$ ${totalGeralPedido.toFixed(2)}`;
}

function removerItemTemp(idx) { 
    totalGeralPedido -= itensNoPedidoAtual[idx].valor; 
    itensNoPedidoAtual.splice(idx, 1); 
    atualizarListaTemporaria(); 
}

const fPed = document.getElementById('formPedido');
if (fPed) {
    fPed.onsubmit = async function(e) {
        e.preventDefault();
        if(itensNoPedidoAtual.length === 0) return alert("Adicione itens ao pedido!");
        
        const mesaInformada = document.getElementById('mesa').value.toString().trim();
        const peds = await getDB('pedidos');
        
        // Verifica se a mesa já tem pedido aberto para somar
        const ex = peds.find(p => p.mesa.toString() === mesaInformada && p.status !== 'entregue');

        if (ex) {
            ex.itens += '\n' + itensNoPedidoAtual.map(i => i.texto).join('\n');
            ex.total = parseFloat(ex.total) + totalGeralPedido;
            ex.status = 'preparando';
        } else {
            peds.push({ 
                id: Date.now().toString().slice(-4), 
                mesa: mesaInformada, 
                total: totalGeralPedido, 
                status: 'preparando', 
                itens: itensNoPedidoAtual.map(i => i.texto).join('\n'), 
                obs: document.getElementById('obs').value, 
                garcom: "Admin (PC)",
                hora: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) 
            });
        }
        await saveDB('pedidos', peds);
        window.location.href = 'preparar.html';
    };
}

// --- 6. RENDERIZAÇÃO DE COMANDAS (CAIXA / PREPARAR) ---
async function renderizarPedidos() {
    const grid = document.querySelector('.orders-grid');
    
    // BLOQUEIO DE SEGURANÇA: Não roda se estiver na cozinha, admin ou PAINEL INICIAL
    if (!grid || 
        window.location.pathname.includes('kitchen.html') || 
        window.location.pathname.includes('admin.html') || 
        window.location.pathname.includes('index.html') || 
        window.location.pathname.endsWith('/')) {
        return;
    }
    
    const peds = await getDB('pedidos');
    const path = window.location.pathname;
    const filt = peds.filter(p => {
        if (path.includes('preparar.html')) return p.status === 'preparando' || p.status === 'em_preparacao' || p.status === 'pronto';
        if (path.includes('pagamentos.html')) return p.status === 'pagamento';
        if (path.includes('historico.html')) return p.status === 'entregue';
        return false;
    });

    if (filt.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#444; margin-top:50px;">Nenhum registro encontrado.</p>';
        return;
    }

    grid.innerHTML = filt.map(p => `
        <div class="order-card">
            <div class="order-header">MESA ${p.mesa} - #${p.id}</div>
            <div style="font-size:0.8rem; color:#888;">👤 Garçom: ${p.garcom || 'Admin'} | ⏱️ ${p.hora}</div>
            <div class="order-details" style="white-space:pre-wrap; margin:10px 0; font-weight:500;">${p.itens}</div>
            ${p.obs ? `<div class="obs-box alert">⚠️ ${p.obs}</div>` : ''}
            <div style="text-align:right; font-weight:bold; color:var(--primary-orange); font-size:1.5rem;">Total: R$ ${parseFloat(p.total).toFixed(2)}</div>
            <div style="margin-top:15px; display:flex; flex-direction:column; gap:8px;">${renderizarBotoesAcao(p)}</div>
        </div>`).join('');
}

function renderizarBotoesAcao(p) {
    if (window.location.pathname.includes('historico.html')) return '<b style="color:var(--green-btn); text-align:center;">PAGO ✓</b>';
    
    if (p.status === 'pagamento') {
        return `<button class="btn btn-green" style="height:60px;" onclick="confirmarPagamento('${p.id}')">CONFIRMAR PAGAMENTO</button>
                <button class="btn btn-red" onclick="deletarPedido('${p.id}')">CANCELAR MESA</button>`;
    }

    const isP = p.status === 'pronto';
    return `
        <div style="display:flex; gap:5px;">
            <button class="btn" style="background:${isP?'#444':'var(--red-btn)'}; flex:3;" onclick="mudarStatus('${p.id}', '${isP?'em_preparacao':'pronto'}')">${isP?'REABRIR':'PRONTO'}</button>
            <button class="btn btn-red" style="flex:1;" onclick="deletarPedido('${p.id}')">🗑️</button>
        </div>
        <button class="btn" style="background:#222;" onclick="reimprimirRecibo('${p.id}')">🖨️ REIMPRIMIR</button>
        <button class="btn" style="background:var(--green-btn); opacity:${isP?1:0.3}" onclick="mudarStatus('${p.id}', 'pagamento')">ENVIAR P/ CONTA</button>`;
}

// --- 7. FUNÇÃO DE IMPRESSÃO (API CENTRAL) ---
window.reimprimirRecibo = async function(id) {
    const peds = await getDB('pedidos');
    const p = peds.find(x => x.id.toString() === id.toString());
    if(p) window.imprimirReciboCozinha(p);
};

window.imprimirReciboCozinha = async function(pedido) {
    const htmlRecibo = `
        <html><body style="font-family:monospace;width:280px;padding:10px;color:#000;background:#fff;">
            <center><h2 style="margin:0;">TRAYOFREE</h2><p>MESA: ${pedido.mesa}</p><hr></center>
            <div style="font-size:16px;font-weight:bold;">${pedido.itens.replace(/\n/g, '<br>')}</div>
            <hr>
            ${pedido.obs ? `<div style="background:#eee;padding:5px;"><b>OBS: ${pedido.obs}</b></div><hr>` : ''}
            <p style="text-align:center;">GARÇOM: ${pedido.garcom}</p>
        </body></html>`;

    try {
        await fetch(`${API_URL}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: htmlRecibo })
        });
    } catch (err) { console.error("Erro na impressão física."); }
};

// --- 8. OPERAÇÕES ---
async function mudarStatus(id, novo) {
    const peds = await getDB('pedidos');
    const idx = peds.findIndex(p => p.id.toString() === id.toString());
    if (idx !== -1) {
        peds[idx].status = novo;
        await saveDB('pedidos', peds);
        renderizarPedidos();
    }
}

async function deletarPedido(id) {
    const s = await exibirModalSenha("SENHA ADMIN PARA DELETAR");
    const cfg = await getConfig();
    if (s && s.trim() === cfg.senha.toString().trim()) {
        const peds = await getDB('pedidos');
        await saveDB('pedidos', peds.filter(x => x.id.toString() !== id.toString()));
        location.reload();
    } else if (s !== null) { alert("Senha Incorreta!"); }
}

async function confirmarPagamento(id) {
    // 1. Abre o modal para selecionar Dinheiro, Cartão ou Pix
    const meioPagamento = await exibirModalMeioPagamento(id);
    if (meioPagamento === null) return; // Usuário cancelou no modal

    // 2. Busca os dados do pedido para mostrar o resumo
    const peds = await getDB('pedidos');
    const idx = peds.findIndex(p => p.id.toString() === id.toString());
    if (idx === -1) return;
    const pedido = peds[idx];

    // 3. Abre o modal de confirmação final com o valor e o método escolhido
    const confirmado = await exibirConfirmacaoPagamento(pedido.mesa, pedido.total, meioPagamento);
    if (!confirmado) return; // Usuário cancelou na última tela

    // 4. Salva o meio de pagamento no banco de dados (importante para o relatório de turno)
    peds[idx].meioPagamento = meioPagamento;
    await saveDB('pedidos', peds);

    // 5. Finaliza o pedido (muda status para entregue e remove das telas operacionais)
    await mudarStatus(id, 'entregue');
    
    // Notificação visual (se você tiver a função de notificar)
    if (typeof notificar === 'function') notificar("Pagamento realizado com sucesso!", "sucesso");
}

// --- 9. ADMINISTRAÇÃO (CATÁLOGO E GARÇONS) ---
async function configurarFormCatalogo() {
    const f = document.getElementById('formCatalogo'); if(!f) return;
    f.onsubmit = async (e) => {
        e.preventDefault();
        const n = document.getElementById('catNome').value.trim();
        const p = parseFloat(document.getElementById('catPreco').value.replace(',', '.'));
        const d = document.getElementById('catDescricao').value.trim();
        if(!n || isNaN(p)) return alert("Dados inválidos!");
        const cat = await getDB('catalogo');
        cat.push({ id: Date.now(), categoria: document.getElementById('catCategoria').value, nome: n, preco: p, descricao: d, indisponivel: false });
        await saveDB('catalogo', cat);
        f.reset(); renderizarCatalogo();
    };
}

async function renderizarCatalogo() {
    const l = document.getElementById('listaCatalogo'); if (!l) return;
    const cat = await getDB('catalogo');
    l.innerHTML = cat.map(p => `
        <div class="order-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; padding:10px; ${p.indisponivel ? 'opacity:0.5;' : ''}">
            <div><b>${p.nome}</b><br><small>${p.categoria} | R$ ${p.preco.toFixed(2)}${p.descricao ? '<br><i>' + p.descricao + '</i>' : ''}</small>${p.indisponivel ? '<br><span style="color:#ff6600; font-weight:bold;">🚫 Indisponível</span>' : ''}</div>
            <div style="display:flex; gap:5px;">
                <button class="btn" style="background:${p.indisponivel ? '#444' : '#ff6600'}; width:auto; padding:5px 10px;" onclick="toggleIndisponivel('${p.id}')">${p.indisponivel ? '✓ Disponível' : '✗ Marcar Indis.'}</button>
                <button class="btn btn-red" style="width:auto; padding:5px 10px;" onclick="removerCat('${p.id}')">Remover</button>
            </div>
        </div>`).join('');
}

async function removerCat(id) {
    if(confirm("Remover do catálogo?")) {
        const cat = await getDB('catalogo');
        await saveDB('catalogo', cat.filter(p => p.id.toString() !== id.toString()));
        renderizarCatalogo();
    }
}

async function toggleIndisponivel(id) {
    const cat = await getDB('catalogo');
    const prod = cat.find(p => p.id.toString() === id.toString());
    if(prod) {
        prod.indisponivel = !prod.indisponivel;
        await saveDB('catalogo', cat);
        renderizarCatalogo();
    }
}

async function renderizarGarcons() {
    const l = document.getElementById('listaGarçons'); if(!l) return;
    const g = await getDB('colaboradores');
    l.innerHTML = g.map(x => `
        <div class="order-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; padding:10px;">
            <span>👤 <b>${x.nome}</b> (PIN: ****)</span>
            <button class="btn btn-red" style="width:auto; padding:5px 10px;" onclick="removerGarcom('${x.nome}')">Remover</button>
        </div>`).join('');
}

const fGarcom = document.getElementById('formGarcom');
if (fGarcom) {
    fGarcom.onsubmit = async (e) => {
        e.preventDefault();
        const g = await getDB('colaboradores');
        g.push({ nome: document.getElementById('nomeGarcom').value, pin: document.getElementById('pinGarcom').value });
        await saveDB('colaboradores', g);
        fGarcom.reset(); renderizarGarcons();
    };
}

async function removerGarcom(n) {
    if(confirm("Remover colaborador?")) {
        const g = await getDB('colaboradores');
        await saveDB('colaboradores', g.filter(x => x.nome !== n));
        renderizarGarcons();
    }
}

async function salvarConfiguracoes() {
    const n = document.getElementById('cfgNomeRestaurante').value;
    const s = document.getElementById('cfgNovaSenha').value;
    const m = document.getElementById('cfgModoCozinha').value; // Pega o novo valor
    const i = document.getElementById('cfgImpressoraDesabilitada').checked;
    const cfg = await getConfig();
    
    await saveDB('configuracoes', { 
        senha: s || cfg.senha, 
        nome: n || cfg.nome,
        modoCozinha: m,
        impressoraDesabilitada: i
    });
    alert("Configurações salvas com sucesso!"); 
    location.reload();
}

// --- 10. ANALYTICS E HISTÓRICO ---
async function carregarAnalytics() {
    const peds = await getDB('pedidos');
    const concluidos = peds.filter(p => p.status === 'entregue');
    const total = concluidos.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);
    if(document.getElementById('vendaTotalDia')) document.getElementById('vendaTotalDia').innerText = `R$ ${total.toFixed(2)}`;
    if(document.getElementById('qtdPedidosDia')) document.getElementById('qtdPedidosDia').innerText = concluidos.length;
}

async function renderizarListaTurnos() {
    const lista = document.getElementById('listaTurnos'); if (!lista) return;
    const hist = await getDB('historicoTurnos');
    lista.innerHTML = hist.map(t => {
        const temMeios = t.totaisPorMeio && (parseFloat(t.totaisPorMeio.dinheiro) > 0 || parseFloat(t.totaisPorMeio.credito) > 0 || parseFloat(t.totaisPorMeio.debito) > 0 || parseFloat(t.totaisPorMeio.pix) > 0);
        return `
        <div class="order-card" onclick="toggleTurno(${t.id})" style="cursor:pointer; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between"><b>${t.nome} - ${t.data}</b> <span>▼</span></div>
            <div id="detalhe-${t.id}" style="display:none; margin-top:10px; border-top:1px dashed #444; padding-top:10px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:10px;">
                    <div>
                        <p style="font-size:0.8rem; color:#666;">Abertura</p>
                        <p style="font-weight:bold; color:#fff;">${t.abertura}</p>
                    </div>
                    <div>
                        <p style="font-size:0.8rem; color:#666;">Fechamento</p>
                        <p style="font-weight:bold; color:#fff;">${t.fechamento}</p>
                    </div>
                </div>
                <p style="margin:10px 0;"><b>Vendas Totais: R$ ${t.vendas}</b></p>
                <p style="font-size:0.9rem; color:#ccc;">Total de comandas: ${t.qtd}</p>
                ${temMeios ? `
                <div style="margin-top:10px; padding:10px; background:#000; border-radius:5px; border-left:3px solid #ff6600;">
                    <p style="font-weight:bold; margin-bottom:8px; color:#ff6600;">Resumo por Meio de Pagamento:</p>
                    <p style="font-size:0.9rem;"><b>💵 Dinheiro:</b> R$ ${parseFloat(t.totaisPorMeio.dinheiro).toFixed(2)}</p>
                    <p style="font-size:0.9rem;"><b>💳 Crédito:</b> R$ ${parseFloat(t.totaisPorMeio.credito).toFixed(2)}</p>
                    <p style="font-size:0.9rem;"><b>🔳 Débito:</b> R$ ${parseFloat(t.totaisPorMeio.debito).toFixed(2)}</p>
                    <p style="font-size:0.9rem;"><b>📲 PIX:</b> R$ ${parseFloat(t.totaisPorMeio.pix).toFixed(2)}</p>
                </div>
                ` : ''}
                <button class="btn" style="background:#444; font-size:0.7rem; width:auto; padding:5px 15px; margin-top:10px;" onclick="baixarTxtTurno('${t.id}', event)">📥 Baixar .txt</button>
            </div>
        </div>`
    }).join('');
}
function toggleTurno(id) { const el = document.getElementById(`detalhe-${id}`); if(el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

async function baixarTxtTurno(id, ev) {
    if (ev) ev.stopPropagation();
    const config = await getConfig();
    const hist = await getDB('historicoTurnos');
    const t = hist.find(i => i.id.toString() === id.toString());
    if (!t) return;

    let c = `\n==========================================\n       RELATORIO: ${config.nome.toUpperCase()}\n==========================================\nDATA: ${t.data}\n`;
    c += `ABERTURA: ${t.abertura || 'N/A'}\n`;
    c += `FECHAMENTO: ${t.fechamento || 'N/A'}\n`;
    c += `------------------------------------------\n`;
    if(t.detalhesPedidos) {
        t.detalhesPedidos.forEach((p, i) => {
            c += `${i+1}. MESA ${p.mesa} | R$ ${parseFloat(p.total).toFixed(2)} | Garçom: ${p.garcom}\n   ITENS: ${p.itens.replace(/\n/g, ', ')}\n- - - - - - - - - - - - - - - - - - - - - \n`;
        });
    }
    c += `\nTOTAL VENDIDO NO TURNO: R$ ${t.vendas}\n`;
    
    // Adiciona totais por meio de pagamento se disponíveis
    if(t.totaisPorMeio && (parseFloat(t.totaisPorMeio.dinheiro) > 0 || parseFloat(t.totaisPorMeio.credito) > 0 || parseFloat(t.totaisPorMeio.debito) > 0 || parseFloat(t.totaisPorMeio.pix) > 0)) {
        c += `------------------------------------------\nRESUMO POR MEIO DE PAGAMENTO:\n`;
        c += `Dinheiro: R$ ${parseFloat(t.totaisPorMeio.dinheiro).toFixed(2)}\n`;
        c += `Cartão Crédito: R$ ${parseFloat(t.totaisPorMeio.credito).toFixed(2)}\n`;
        c += `Cartão Débito: R$ ${parseFloat(t.totaisPorMeio.debito).toFixed(2)}\n`;
        c += `PIX: R$ ${parseFloat(t.totaisPorMeio.pix).toFixed(2)}\n`;
    }
    
    c += `==========================================\n`;
    
    const blob = new Blob([c], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Resumo_${t.nome}_${t.data.replace(/\//g, '-')}.txt`;
    a.click();
}

// --- 11. BOOTSTRAP (INICIALIZAÇÃO) ---
window.onload = async () => {
    try {
        await checarTurno();
        const path = window.location.pathname;

        // Se for Admin
        if (path.includes('admin.html')) {
            const config = await getConfig();
            await renderizarCatalogo();
            await renderizarGarcons();
            await configurarFormCatalogo();
            
            // Carrega as configurações atuais
            document.getElementById('cfgNomeRestaurante').value = config.nome;
            document.getElementById('cfgModoCozinha').value = config.modoCozinha;
            document.getElementById('cfgImpressoraDesabilitada').checked = config.impressoraDesabilitada || false;
        }
                    
        // Se for Novo Pedido
        if (path.includes('cadastro.html')) {
            await prepararCadastro();
        }

        // Se for o Painel Principal (Index)
        if (path.includes('index.html') || path.endsWith('/')) {
            await carregarAnalytics(); // Força o carregamento dos números
            // Atualiza os números a cada 10 segundos
            setInterval(carregarAnalytics, 10000);
        }

        // Se for as abas operacionais (Cozinha/Caixa)
        if (!path.includes('kitchen.html') && !path.includes('admin.html') && !path.includes('index.html')) {
            await renderizarPedidos();
            if (path.includes('preparar.html') || path.includes('pagamentos.html')) {
                setInterval(renderizarPedidos, 4000);
            }
        }
    } catch (e) { console.error("Erro na carga do sistema:", e); }
};

// --- EXPORTAR FUNÇÕES GLOBAIS PARA O HTML ---
window.removerCat = removerCat;
window.toggleIndisponivel = toggleIndisponivel;
window.removerGarcom = removerGarcom;
window.exportarCatalogo = async () => { const cat = await getDB('catalogo'); const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cat)); const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", "catalogo.json"); dl.click(); };
window.importarCatalogo = async (ev) => { const file = ev.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = async (e) => { try { await saveDB('catalogo', JSON.parse(e.target.result)); alert("Catálogo Importado!"); location.reload(); } catch(err) { alert("Erro no arquivo JSON"); } }; reader.readAsText(file); };
window.resetarHistoricoTurnos = async () => { if(confirm("Zerar Histórico?")) { await saveDB('historicoTurnos', []); location.reload(); } };
window.resetarCatalogoInteiro = async () => { if(confirm("Zerar Catálogo?")) { await saveDB('catalogo', []); location.reload(); } };

// --- MODAL DE SELEÇÃO DE MÉTODO (PC) ---
function exibirModalMeioPagamento(idPedido) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;";
        
        const modal = document.createElement('div');
        modal.style = "background:#161616;padding:30px;border-radius:15px;border:2px solid #ff6600;width:400px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.5);";
        
        modal.innerHTML = `
            <h3 style="color:#ff6600;margin-bottom:10px;font-family:sans-serif;">MÉTODO DE PAGAMENTO</h3>
            <p style="color:#888;margin-bottom:25px;font-size:0.95rem;">Como o cliente pagou esta conta?</p>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <button class="btn" style="background:#1a1a1a;border:1px solid #333;color:#fff;padding:15px;cursor:pointer;" onclick="fecharModalPag('dinheiro')">💵 DINHEIRO</button>
                <button class="btn" style="background:#1a1a1a;border:1px solid #333;color:#fff;padding:15px;cursor:pointer;" onclick="fecharModalPag('credito')">💳 CARTÃO DE CRÉDITO</button>
                <button class="btn" style="background:#1a1a1a;border:1px solid #333;color:#fff;padding:15px;cursor:pointer;" onclick="fecharModalPag('debito')">🔳 CARTÃO DE DÉBITO</button>
                <button class="btn" style="background:#1a1a1a;border:1px solid #333;color:#fff;padding:15px;cursor:pointer;" onclick="fecharModalPag('pix')">📲 PIX</button>
                <button class="btn" style="background:#444;padding:10px;margin-top:10px;" onclick="fecharModalPag(null)">CANCELAR</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        window.fecharModalPag = (valor) => {
            document.body.removeChild(overlay);
            resolve(valor);
        };
    });
}

// --- MODAL DE RESUMO/CONFIRMAÇÃO (PC) ---
function exibirConfirmacaoPagamento(mesa, valor, meio) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:10000;";
        
        const modal = document.createElement('div');
        modal.style = "background:#161616;padding:30px;border-radius:15px;border:2px solid #28a745;width:350px;text-align:center;";
        
        const nomes = { 'dinheiro': 'Dinheiro', 'credito': 'Crédito', 'debito': 'Débito', 'pix': 'PIX' };

        modal.innerHTML = `
            <h3 style="color:#28a745;margin-bottom:20px;">CONFIRMAR RECEBIMENTO</h3>
            <div style="background:#000;padding:20px;border-radius:10px;margin-bottom:20px;text-align:left;border:1px solid #222;">
                <p style="color:#666;font-size:0.8rem;">MESA</p>
                <p style="font-size:1.2rem;font-weight:bold;margin-bottom:10px;">Mesa ${mesa}</p>
                <p style="color:#666;font-size:0.8rem;">FORMA</p>
                <p style="font-size:1.2rem;font-weight:bold;margin-bottom:10px;color:var(--primary-orange);">${nomes[meio]}</p>
                <p style="color:#666;font-size:0.8rem;">VALOR TOTAL</p>
                <p style="font-size:1.5rem;font-weight:bold;color:#28a745;">R$ ${parseFloat(valor).toFixed(2)}</p>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="fecharConf(false)" class="btn" style="background:#444;">VOLTAR</button>
                <button onclick="fecharConf(true)" class="btn btn-green">CONCLUÍDO</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        window.fecharConf = (confirmado) => {
            document.body.removeChild(overlay);
            resolve(confirmado);
        };
    });
}