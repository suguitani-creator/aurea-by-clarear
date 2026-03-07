let idEmEdicao = null;

import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  updateDoc,
  orderBy
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

let transacoes = [];
let grafico;

// 🔥 GARANTE QUE TUDO SÓ RODE APÓS O DOM CARREGAR
window.addEventListener("DOMContentLoaded", () => {
const isMobile = window.innerWidth <= 768;  // Verifica se a tela é mobile

    if (isMobile) {
        document.getElementById("auth-container-desktop").style.display = "none";  // Esconde a versão desktop
        document.getElementById("auth-container-mobile").style.display = "block";  // Exibe a versão mobile
    } else {
        document.getElementById("auth-container-desktop").style.display = "block";  // Exibe a versão desktop
        document.getElementById("auth-container-mobile").style.display = "none";  // Esconde a versão mobile
    }
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
    //const authContainer = document.getElementById("auth-container");
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
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        showToast("Login bem-sucedido!");

        // Esconde o login e exibe o app
        document.getElementById("auth-container-desktop").style.display = "none";  // Esconde a versão desktop
        document.getElementById("auth-container-mobile").style.display = "none";  // Esconde a versão mobile
        document.getElementById("app-container").style.display = "block";  // Exibe o app

    } catch (error) {
        console.log("Erro no login: ", error);
        let errorMessage = "Erro ao entrar";

        if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Email inválido";
        }

        showToast(errorMessage, "error");
    }
});

window.addEventListener("resize", () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        document.getElementById("auth-container-desktop").style.display = "none";  // Esconde a versão desktop
        document.getElementById("auth-container-mobile").style.display = "block";  // Exibe a versão mobile
    } else {
        document.getElementById("auth-container-desktop").style.display = "block";  // Exibe a versão desktop
        document.getElementById("auth-container-mobile").style.display = "none";  // Esconde a versão mobile
    }
});

// Para a versão mobile
document.getElementById("btn-login-mobile").addEventListener("click", async () => {
    const email = document.getElementById("email-mobile").value;
    const senha = document.getElementById("senha-mobile").value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        showToast("Login bem-sucedido!");

        // Esconde o login mobile e exibe o app
        document.getElementById("auth-container-mobile").style.display = "none";  // Esconde o login mobile
        document.getElementById("app-container").style.display = "block";  // Exibe o app

    } catch (error) {
        console.log("Erro no login: ", error);
        let errorMessage = "Erro ao entrar";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Email inválido";
        }

        showToast(errorMessage, "error");
    }
});


    document.getElementById("btn-logout").addEventListener("click", async () => {
    try {
        await signOut(auth);
        showToast("Logout bem-sucedido!");

        // Mostrar login e esconder app após logout
        document.getElementById("auth-container-desktop").style.display = "block";
        document.getElementById("app-container").style.display = "none";

    } catch (error) {
        console.log("Erro ao fazer logout: ", error); // Exibe o erro no console para depuração
        showToast("Erro ao fazer logout", "error");
    }
});

    onAuthStateChanged(auth, (user) => {
    const authContainer = document.getElementById("auth-container-desktop");
    const appContainer = document.getElementById("app-container");

    // Esconde o box de "editando transação" quando o app é carregado (sem edição)
    document.getElementById("indicador-edicao").style.display = "none";  // Esconde o indicador no login

    if (user) {
        document.getElementById("usuario-email").textContent = user.email;

        authContainer.style.display = "none";
        appContainer.style.display = "block";

        carregarTransacoes();  // Carregar transações após o login
    } else {
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
    const formaPagamento = document.getElementById("forma-pagamento").value;  // Captura a forma de pagamento

    if (!descricao || isNaN(valor) || !data) {
        showToast("Preencha todos os campos corretamente", "error");
        return;
    }

    if (idEmEdicao) {
        await updateDoc(
            doc(db, "users", user.uid, "transacoes", idEmEdicao),
            { tipo, categoria, descricao, valor, data, formaPagamento }  // Inclui forma de pagamento
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
            { tipo, categoria, descricao, valor, data, formaPagamento }  // Inclui forma de pagamento
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
    lista.innerHTML = ""; // Limpa a lista antes de preencher

    listaTransacoes.forEach((transacao) => {
        const item = document.createElement("li");
        item.classList.add(transacao.tipo);
        item.classList.add("item-novo");

        // Verifica se é uma despesa e adiciona o ícone da forma de pagamento antes do valor
        let formaPagamentoDisplay = "";
        if (transacao.tipo === "despesa") {
            formaPagamentoDisplay = `<span class="forma-pagamento">${getIconeFormaPagamento(transacao.formaPagamento)}</span>`;
        }

        // Alteração para colocar ícone antes do valor
        item.innerHTML = `
            <div class="item-info">
                <strong>${transacao.descricao}</strong>
                <small>${transacao.categoria}</small>
            </div>

            <div class="item-actions">
                ${formaPagamentoDisplay} <!-- Exibe o ícone da forma de pagamento antes do valor -->

                <span class="valor">R$ ${transacao.valor.toFixed(2)}</span>

                <button class="btn-edit" onclick="editarTransacao('${transacao.id}')">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zM20.71 6.04c.39-.39.39-1.02 0-1.41l-1.34-1.34c-.39-.39-1.02-.39-1.41 0l-1.13 1.13 3.75 3.75 1.13-1.13z"/>
                    </svg>
                </button>

                <button class="btn-delete" onclick="confirmarExclusao('${transacao.id}')">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z"/>
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

    const querySnapshot = await getDocs(
        collection(db, "users", user.uid, "transacoes")
    );

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

    // Mostrar o indicador de edição apenas quando o usuário clicar em editar
    document.getElementById("indicador-edicao").style.display = "flex";  // Mostrar indicador de edição

    idEmEdicao = id;

    document.querySelectorAll("li").forEach(li => {
        li.classList.remove("linha-editando");
    });

    const linha = document
        .querySelector(`button[onclick*="${id}"]`)
        .closest("li");

    if (linha) {
        linha.classList.add("linha-editando");
    }

    const btn = document.getElementById("btn-adicionar");
    btn.textContent = "Salvar alteração";
    btn.classList.add("modo-edicao");

    // Desliza suavemente até o formulário de edição
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

function getIconeFormaPagamento(formaPagamento) {
    switch (formaPagamento) {
        case "pix":
            return "📱";  // ícone mais discreto para Pix
        case "debito":
            return "🛒";  // ícone mais refinado para Débito
        case "credito":
            return "💳";  // ícone sutil para Crédito
        default:
            return "💳";  // ícone padrão caso não tenha sido configurado
    }
}

async function salvarEdicao() {
    // Esconde o indicador de edição
    document.getElementById("indicador-edicao").style.display = "none";
    // Lógica de salvar a transação...
}

// Exibir formulário ao clicar no botão
document.getElementById("btn-adicionar-conta").addEventListener("click", () => {
    const formulario = document.getElementById("formulario-conta");
    formulario.style.display = formulario.style.display === "none" ? "block" : "none";  // Alterna a visibilidade
});

// Adiciona a função que mostra ou esconde os campos de data dependendo do tipo de conta
document.getElementById("tipo-conta").addEventListener("change", function() {
    const tipo = this.value;
    if (tipo === "cartao") {
        document.getElementById("datas-cartao").style.display = "block"; // Exibe os campos para cartão
        document.getElementById("data-saldo-conta").style.display = "none"; // Esconde o campo de data para conta corrente
    } else {
        document.getElementById("datas-cartao").style.display = "none"; // Esconde os campos para cartão
        document.getElementById("data-saldo-conta").style.display = "block"; // Exibe o campo de data para conta corrente
    }
});

// Chama a função para garantir que o campo certo seja exibido ao carregar o formulário
document.addEventListener("DOMContentLoaded", function() {
    const tipoConta = document.getElementById("tipo-conta").value;
    if (tipoConta === "cartao") {
        document.getElementById("datas-cartao").style.display = "block"; // Exibe os campos para cartão
        document.getElementById("data-saldo-conta").style.display = "none"; // Esconde o campo de data para conta corrente
    } else {
        document.getElementById("datas-cartao").style.display = "none"; // Esconde os campos para cartão
        document.getElementById("data-saldo-conta").style.display = "block"; // Exibe o campo de data para conta corrente
    }
});

// Função para carregar contas e cartões (simulação)
//function carregarContasECartoes() {
    // Simulando as contas e cartões cadastrados
//    const listaContas = document.getElementById("lista-contas");
//    const listaCartoes = document.getElementById("lista-cartoes");

//    listaContas.innerHTML = "<li>Conta Corrente - Banco XYZ - R$ 1.500,00</li>";
//    listaCartoes.innerHTML = "<li>Cartão de Crédito - Banco ABC - Limite: R$ 2.000,00</li>";

    // Exibe o container com as listas
//    document.getElementById("lista-contas-cartoes").style.display = "block";
//}

// Carregar as contas e cartões após login
//onAuthStateChanged(auth, (user) => {
//    if (user) {
//        carregarContasECartoes(); // Carregar dados após login
//    }
//});

async function adicionarConta() {
    console.log('Função de adicionar conta foi chamada'); // Log para verificar se a função está sendo chamada
    
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

    console.log("Adicionando uma conta/cartão no Firestore...");
    
    try {
        // Adicionar Conta Corrente
        if (tipo === "conta") {
            console.log("Salvando conta corrente:", nome, saldo, dataSaldo); // Log para depuração
            await addDoc(collection(db, "users", user.uid, "contas"), {
                nome: nome,
                saldo: saldo,
                tipo: tipo,
                dataSaldo: dataSaldo
            });
        } 
        // Adicionar Cartão de Crédito
        else if (tipo === "cartao") {
            console.log("Salvando cartão de crédito:", nome, saldo, vencimento, fechamento); // Log para depuração
            await addDoc(collection(db, "users", user.uid, "cartoes"), {
                nome: nome,
                saldo: saldo,
                vencimento: vencimento,
                fechamento: fechamento,
                tipo: tipo
            });
        }

        console.log("Conta ou cartão adicionado com sucesso!");
        showToast("Conta ou cartão adicionado com sucesso!");
        carregarContasECartoes(); // Atualiza a lista após a adição

    } catch (error) {
        console.log("Erro ao adicionar conta ou cartão: ", error); // Log do erro para depuração
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

