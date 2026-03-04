import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const categorias = {
    receita: ["Salário","Pró-labore","Investimentos","Dividendos","Outros"],
    despesa: ["Alimentação","Moradia","Transporte","Lazer","Saúde","Educação","Outros"]
};

let idEmEdicao = null;
let transacoes = [];
let grafico;

// 🔥 GARANTE QUE TUDO SÓ RODE APÓS O DOM CARREGAR
window.addEventListener("DOMContentLoaded", () => {

    atualizarCategorias();

    const hoje = new Date().toISOString().slice(0,7);
    document.getElementById("mes-filtro").value = hoje;

    document.getElementById("mes-filtro")
        .addEventListener("change", aplicarFiltro);

    document.getElementById("tipo")
        .addEventListener("change", atualizarCategorias);

    document.getElementById("btn-adicionar")
    .addEventListener("click", adicionarTransacao);

    // AUTH ELEMENTOS
    const authContainer = document.getElementById("auth-container");
    const appContainer = document.getElementById("app-container");
    const emailInput = document.getElementById("email");
    const senhaInput = document.getElementById("senha");

    document.getElementById("btn-cadastro").addEventListener("click", async () => {
        try {
            await createUserWithEmailAndPassword(auth, emailInput.value, senhaInput.value);
            showToast("Conta criada com sucesso!");
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById("btn-login").addEventListener("click", async () => {
        try {
            await signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value);
        } catch (error) {
            showToast("Erro ao entrar", "error");
        }
    });

    document.getElementById("btn-logout").addEventListener("click", async () => {
        await signOut(auth);
    });

    onAuthStateChanged(auth, (user) => {
    const authContainer = document.getElementById("auth-container");
    const appContainer = document.getElementById("app-container");

    if (user) {
        // Mostrar email do usuário
        document.getElementById("usuario-email").textContent = user.email;

        // Esconder login e mostrar app
        authContainer.style.display = "none";
        appContainer.style.display = "block";

        // 🔥 IMPORTANTE: carregar dados do Firestore
        carregarTransacoes();

    } else {
        // Mostrar login e esconder app
        authContainer.style.display = "block";
        appContainer.style.display = "none";
        limparFormulario();
    }
});
});

// ================= FINANÇAS =================

async function adicionarTransacao() {

    const user = auth.currentUser;
    if (!user) return;

    const tipo = document.getElementById("tipo").value;
    const categoria = document.getElementById("categoria").value;
    const descricao = document.getElementById("descricao").value;
    const valor = parseFloat(document.getElementById("valor").value);
    const data = document.getElementById("data").value;

    if (!descricao || isNaN(valor) || !data) {
        showToast("Preencha todos os campos", "error");
        return;
    }

    if (idEmEdicao) {
        await updateDoc(
            doc(db, "users", user.uid, "transacoes", idEmEdicao),
            { tipo, categoria, descricao, valor, data }
        );

        showToast("Transação atualizada!");
        idEmEdicao = null;

        document.getElementById("indicador-edicao").style.display = "none";

        document.querySelectorAll("li").forEach(li => {
        li.classList.remove("linha-editando");
        });

        const btn = document.getElementById("btn-adicionar");
        btn.textContent = "Adicionar";
        btn.classList.remove("modo-edicao");

    } else {
        await addDoc(
            collection(db, "users", user.uid, "transacoes"),
            { tipo, categoria, descricao, valor, data }
        );

        showToast("Transação adicionada!");
    }

    limparFormulario();
    carregarTransacoes();
}

function atualizarCategorias() {
    const tipo = document.getElementById("tipo").value;
    const selectCategoria = document.getElementById("categoria");
    selectCategoria.innerHTML = "";

    categorias[tipo].forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        selectCategoria.appendChild(option);
    });
}

function aplicarFiltro() {
    const mesSelecionado = document.getElementById("mes-filtro").value;
    let filtradas = transacoes;

    if (mesSelecionado) {
        filtradas = transacoes.filter(t =>
            t.data.startsWith(mesSelecionado)
        );
    }

    atualizarTela(filtradas);
    calcularSaldo(filtradas);
    atualizarGrafico(filtradas);
    atualizarComparativo();
}

function atualizarTela(listaTransacoes) {
    const lista = document.getElementById("lista-despesas");
    lista.innerHTML = "";

    listaTransacoes.forEach((transacao) => {

        const item = document.createElement("li");

        item.classList.add(transacao.tipo);
        item.classList.add("item-novo");

        item.innerHTML = `
            <div class="item-info">
                <strong>${transacao.descricao}</strong>
                <small>${transacao.categoria}</small>
            </div>

            <div class="item-actions">
                <span class="valor">R$ ${transacao.valor.toFixed(2)}</span>

                <button class="btn-edit" onclick="editarTransacao('${transacao.id}')">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor"
                    d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zM20.71 
                    6.04c.39-.39.39-1.02 
                    0-1.41l-1.34-1.34c-.39-.39-1.02-.39-1.41 
                    0l-1.13 1.13 3.75 3.75 1.13-1.13z"/>
                    </svg>
                </button>

                <button class="btn-delete" onclick="confirmarExclusao('${transacao.id}')">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor"
                    d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z"/>
                    </svg>
                </button>
            </div>
        `;

        lista.appendChild(item);
    });
}

function calcularSaldo(listaTransacoes) {
    let totalReceitas = 0;
    let totalDespesas = 0;

    listaTransacoes.forEach(t => {
        if (t.tipo === "receita") {
            totalReceitas += t.valor;
        } else {
            totalDespesas += t.valor;
        }
    });

    const saldo = totalReceitas - totalDespesas;

    document.getElementById("total-receitas").textContent =
        "R$ " + totalReceitas.toFixed(2);

    document.getElementById("total-despesas").textContent =
        "R$ " + totalDespesas.toFixed(2);

    const saldoElemento = document.getElementById("saldo");
    saldoElemento.textContent = "R$ " + saldo.toFixed(2);
    saldoElemento.style.color =
        saldo >= 0 ? "#4A7C59" : "#A94442";
}

async function removerTransacao(id) {
    const user = auth.currentUser;
    if (!user) return;

    const elemento = document.querySelector(`button[onclick*="${id}"]`).closest("li");

    elemento.style.transition = "all 0.3s ease";
    elemento.style.opacity = "0";
    elemento.style.transform = "translateX(10px)";

    setTimeout(async () => {
        await deleteDoc(doc(db, "users", user.uid, "transacoes", id));
        carregarTransacoes();
        showToast("Transação removida", "delete");
    }, 300);
}

window.removerTransacao = removerTransacao;

function atualizarGrafico(listaTransacoes) {
    const despesas = listaTransacoes.filter(t => t.tipo === "despesa");
    const categoriasAgrupadas = {};

    despesas.forEach(t => {
        if (!categoriasAgrupadas[t.categoria]) {
            categoriasAgrupadas[t.categoria] = 0;
        }
        categoriasAgrupadas[t.categoria] += t.valor;
    });

    const labels = Object.keys(categoriasAgrupadas);
    const valores = Object.values(categoriasAgrupadas);
    const ctx = document.getElementById("graficoCategorias");

    if (grafico) grafico.destroy();

    grafico = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: [
                    "#C6A75E","#7A5C42","#A94442",
                    "#4A7C59","#E8DFD4","#8B6F4E"
                ]
            }]
        },
        options: {
            plugins: { legend: { position: "bottom" } }
        }
    });
}

async function carregarTransacoes() {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
        collection(db, "users", user.uid, "transacoes"),
        orderBy("data", "desc")
    );

    const querySnapshot = await getDocs(q);

    transacoes = [];

    querySnapshot.forEach(documento => {
    transacoes.push({
        id: documento.id,
        ...documento.data()
    });
});

    aplicarFiltro();
}

function limparFormulario() {
    document.getElementById("descricao").value = "";
    document.getElementById("valor").value = "";
    document.getElementById("data").value = "";
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.className = "toast show " + type;

    setTimeout(() => {
        toast.className = "toast";
    }, 3000);
}

let idParaExcluir = null;

function confirmarExclusao(id) {
    idParaExcluir = id;
    document.getElementById("modal-confirmacao").classList.add("show");
}

document.getElementById("cancelar-exclusao").addEventListener("click", () => {
    document.getElementById("modal-confirmacao").classList.remove("show");
    idParaExcluir = null;
});

document.getElementById("confirmar-exclusao").addEventListener("click", async () => {
    if (!idParaExcluir) return;

    const user = auth.currentUser;
    if (!user) return;

    await deleteDoc(doc(db, "users", user.uid, "transacoes", idParaExcluir));

    document.getElementById("modal-confirmacao").classList.remove("show");
    showToast("Transação removida", "delete");
    carregarTransacoes();
});

window.confirmarExclusao = confirmarExclusao;

window.editarTransacao = async function(id) {

    const user = auth.currentUser;
    if (!user) return;

    const transacao = transacoes.find(t => t.id === id);
    if (!transacao) return;

    document.getElementById("tipo").value = transacao.tipo;
    atualizarCategorias();

    document.getElementById("categoria").value = transacao.categoria;
    document.getElementById("descricao").value = transacao.descricao;
    document.getElementById("valor").value = transacao.valor;
    document.getElementById("data").value = transacao.data;

    document.getElementById("indicador-edicao").style.display = "block";

    idEmEdicao = id;

    // Remover destaque anterior
    document.querySelectorAll("li").forEach(li => {
        li.classList.remove("linha-editando");
    });

    // Destacar linha atual
    const linha = document
        .querySelector(`button[onclick*="${id}"]`)
        .closest("li");

    if (linha) {
        linha.classList.add("linha-editando");
    }

    const btn = document.getElementById("btn-adicionar");
    btn.textContent = "Salvar alteração";
    btn.classList.add("modo-edicao");

    // 🔥 NOVO: scroll suave até o formulário
    document.querySelector(".form").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
};

function converterDataFirestore(dataFirestore) {
    const [ano, mes, dia] = dataFirestore.split("-"); // formato YYYY-MM-DD
    return new Date(ano, mes - 1, dia); // meses começam do zero
}

function calcularTotaisPorMes(mes, ano) {
    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoes.forEach(t => {
        const data = converterDataFirestore(t.data); // Usando a função nova para converter a data

        // Verificar se a transação é do mês e ano correto
        if (data.getMonth() === mes && data.getFullYear() === ano) {
            if (t.tipo === "receita") {
                totalReceitas += t.valor;
            } else {
                totalDespesas += t.valor;
            }
        }
    });

    return { totalReceitas, totalDespesas };
}

function atualizarComparativo() {
    const mesFiltro = document.getElementById("mes-filtro").value;
    if (!mesFiltro) return;

    const [anoAtual, mesAtual] = mesFiltro.split("-");
    const mes = parseInt(mesAtual) - 1;
    const ano = parseInt(anoAtual);

    // Mês anterior
    const dataAnterior = new Date(ano, mes - 1, 1);

    const atual = calcularTotaisPorMes(mes, ano);
    const anterior = calcularTotaisPorMes(
        dataAnterior.getMonth(),
        dataAnterior.getFullYear()
    );

    function calcularVariacao(atual, anterior) {
        if (anterior === 0) return 0;
        return ((atual - anterior) / anterior) * 100;
    }

    const variacaoReceita = calcularVariacao(
        atual.totalReceitas,
        anterior.totalReceitas
    );

    const variacaoDespesa = calcularVariacao(
        atual.totalDespesas,
        anterior.totalDespesas
    );

    // Exibe as receitas com valor absoluto e porcentagem
    document.getElementById("comparativo-receita").textContent =
        `${variacaoReceita.toFixed(1)}% (+R$ ${(atual.totalReceitas - anterior.totalReceitas).toFixed(2)})`;

    // Exibe as despesas com valor absoluto e porcentagem
    document.getElementById("comparativo-despesa").textContent =
        `${variacaoDespesa.toFixed(1)}% (-R$ ${(atual.totalDespesas - anterior.totalDespesas).toFixed(2)})`;
}

// Adicionando a interação ao box de comparativo
document.getElementById("comparativo-container").addEventListener("click", function() {
    document.getElementById("comparativo-container").classList.toggle("show");
    
    // Atualiza os valores ao clicar
    atualizarComparativo();
});

document.getElementById("comparativo-container").addEventListener("mouseleave", function() {
    document.getElementById("comparativo-container").classList.remove("show");
    document.getElementById("comparativo-receita").textContent = "—"; // Esconde os valores
    document.getElementById("comparativo-despesa").textContent = "—"; // Esconde os valores
});

console.log("Salvando transação:", tipo, categoria, descricao, valor, data);
await addDoc(collection(db, "users", user.uid, "transacoes"), {
    tipo,
    categoria,
    descricao,
    valor,
    data
});

// Evento de click para o comparativo
document.getElementById("comparativo-container").addEventListener("click", function() {
    const comparativoContainer = document.getElementById("comparativo-container");

    // Alternar a classe 'show' para mostrar/esconder os valores
    comparativoContainer.classList.toggle("show");

    // Verifica se a classe 'show' está ativa
    if (comparativoContainer.classList.contains("show")) {
        atualizarComparativo(); // Atualiza os valores quando o comparativo é exibido
    } else {
        // Limpa os valores quando o comparativo é ocultado
        document.getElementById("comparativo-receita").textContent = "—";
        document.getElementById("comparativo-despesa").textContent = "—";
    }
});

async function adicionarConta() {
    const tipo = document.getElementById("tipo-conta").value;
    const nome = document.getElementById("nome-conta").value;
    const saldo = parseFloat(document.getElementById("saldo-conta").value);
    const vencimento = document.getElementById("vencimento-cartao").value;
    const fechamento = document.getElementById("fechamento-cartao").value;
    const dataSaldo = document.getElementById("data-saldo-conta").value;

    // Verificando se todos os campos foram preenchidos corretamente
    if (!nome || isNaN(saldo) || (tipo === "cartao" && (!vencimento || !fechamento)) || (tipo === "conta" && !dataSaldo)) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert("Você precisa estar logado para adicionar uma conta.");
        return;
    }

    try {
        // Se for uma conta corrente
        if (tipo === "conta") {
            await addDoc(collection(db, "users", user.uid, "contas"), {
                nome: nome,
                saldo: saldo,
                tipo: tipo,
                dataSaldo: dataSaldo
            });
        } 
        // Se for um cartão de crédito
        else if (tipo === "cartao") {
            await addDoc(collection(db, "users", user.uid, "cartoes"), {
                nome: nome,
                saldo: saldo,
                vencimento: vencimento,
                fechamento: fechamento,
                tipo: tipo
            });
        }

        alert("Conta ou cartão adicionado com sucesso!");
        carregarContasECartoes(); // Atualiza a lista após a adição
    } catch (error) {
        alert("Erro ao adicionar conta ou cartão: " + error.message);
    }
}

async function carregarContasECartoes() {
    const user = auth.currentUser;
    if (!user) return;

    const contasRef = collection(db, "users", user.uid, "contas");
    const cartoesRef = collection(db, "users", user.uid, "cartoes");

    const contasSnapshot = await getDocs(contasRef);
    const cartoesSnapshot = await getDocs(cartoesRef);

    const listaContas = document.getElementById("lista-contas");
    const listaCartoes = document.getElementById("lista-cartoes");

    listaContas.innerHTML = "";
    listaCartoes.innerHTML = "";

    contasSnapshot.forEach(doc => {
        const li = document.createElement("li");
        li.textContent = `Conta: ${doc.data().nome} - Saldo: R$ ${doc.data().saldo.toFixed(2)}`;
        listaContas.appendChild(li);
    });

    cartoesSnapshot.forEach(doc => {
        const li = document.createElement("li");
        li.textContent = `Cartão: ${doc.data().nome} - Limite: R$ ${doc.data().saldo.toFixed(2)} - Vencimento: ${doc.data().vencimento} - Fechamento: ${doc.data().fechamento}`;
        listaCartoes.appendChild(li);
    });
}

onAuthStateChanged(auth, (user) => {
    const authContainer = document.getElementById("auth-container");
    const appContainer = document.getElementById("app-container");

    if (user) {
        // Mostrar email do usuário
        document.getElementById("usuario-email").textContent = user.email;

        // Esconder login e mostrar app
        authContainer.style.display = "none";
        appContainer.style.display = "block";

        carregarContasECartoes(); // Carregar as contas após o login
    } else {
        // Mostrar login e esconder app
        authContainer.style.display = "block";
        appContainer.style.display = "none";
        limparFormulario();
    }
});

// Exibir ou esconder os campos de data dependendo do tipo de conta
document.getElementById("tipo-conta").addEventListener("change", function() {
    const tipo = this.value;
    if (tipo === "cartao") {
        document.getElementById("datas-cartao").style.display = "block";
        document.getElementById("data-saldo-conta").style.display = "none"; // Esconde o campo de data para conta corrente
    } else {
        document.getElementById("datas-cartao").style.display = "none";
        document.getElementById("data-saldo-conta").style.display = "block"; // Exibe o campo de data para conta corrente
    }
});