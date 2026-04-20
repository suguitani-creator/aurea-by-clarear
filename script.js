const MODO_TESTE_FORM = true;
let idEmEdicao = null;
let contaEmEdicao = null;
let cartaoEmEdicao = null;

import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  onSnapshot,
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


let transacoes = [];
let grafico;

// �� GARANTE QUE TUDO SÓ RODE APÓS O DOM CARREGAR
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
    atualizarPlaceholderSaldo();

    const hoje = new Date().toISOString().slice(0,7);
    document.getElementById("mes-filtro").value = hoje;

    document.getElementById("mes-filtro")
        .addEventListener("change", aplicarFiltro);

    document.getElementById("tipo-teste")
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

        carregarTransacoesTempoReal();  // Carregar transações após o login
        carregarContasECartoes();  // Carregar contas e cartões após o login
        escutarContasTempoReal();
        escutarCartoesTempoReal();
        iniciarListenerSaldo();

    } else {
        authContainer.style.display = "block";
        appContainer.style.display = "none";
        limparFormulario();
    }
});
});

// ================= FINANÇAS =================

async function adicionarTransacao() {
    limparErrosFormulario();
    const user = auth.currentUser;
    if (!user) return;

    const tipo = document.getElementById("tipo-teste").value;

    if (!tipo) {
        showToast("Selecione receita ou despesa", "error");
        return;
    }

    let dados = { tipo };

    // ================= RECEITA =================
    if (tipo === "receita") {
        const fonte = document.getElementById("fonte")?.value || "";
        const descricao = document.getElementById("descricao-receita")?.value || "";
        const valor = parseFloat(document.getElementById("valor-receita")?.value);
        const data = document.getElementById("data-receita")?.value || "";
        const conta = document.getElementById("conta-bancaria-depositada")?.value || "";

        if (isNaN(valor)) {
            marcarErro(document.getElementById("valor-receita"));
        }

        if (!data) {
            marcarErro(document.getElementById("data-receita"));
        }

        if (!conta) {
            marcarErro(document.getElementById("conta-bancaria-depositada"));
        }

        if (isNaN(valor) || !data || !conta) {
            showToast("Preencha os campos obrigatórios", "error");
            return;
        }

        dados = { ...dados, fonte, descricao, valor, data, conta };
    }

    // ================= DESPESA =================
    if (tipo === "despesa") {
        const essencial = document.getElementById("essencial")?.value || "";
        const categoria = document.getElementById("categoria-teste")?.value || "";
        const subcategoria = document.getElementById("subcategoria-teste")?.value || "";
        const descricao = document.getElementById("descricao-despesa")?.value || "";
        const valor = parseFloat(document.getElementById("valor-despesa")?.value);
        const data = document.getElementById("data-despesa")?.value || "";
        const formaPagamento = document.getElementById("forma-pagamento-teste")?.value || "";

        let conta = "";
        let cartao = "";
        let parcelas = "";
        let mesFatura = "";

        if (formaPagamento === "pix" || formaPagamento === "debito") {
            conta = document.getElementById("conta-bancaria-debitada")?.value || "";
            if (!conta) {
                marcarErro(document.getElementById("conta-bancaria-debitada"));
                showToast("Selecione a conta", "error");
                return;
            }
        }

        if (formaPagamento === "credito") {
            cartao = document.getElementById("nome-cartao")?.value || "";
            parcelas = document.getElementById("parcelas")?.value || "";
            mesFatura = document.getElementById("mes-fatura")?.value || "";

            if (!cartao) {
                marcarErro(document.getElementById("nome-cartao"));
            }

            if (!parcelas) {
                marcarErro(document.getElementById("parcelas"));
            }

            if (!mesFatura) {
                marcarErro(document.getElementById("mes-fatura"));
            }

            if (!cartao || !parcelas || !mesFatura) {
                showToast("Preencha os dados do cartão", "error");
                return;
            }
        }

        if (isNaN(valor)) {
            marcarErro(document.getElementById("valor-despesa"));
        }

        if (!data) {
            marcarErro(document.getElementById("data-despesa"));
        }

        if (!formaPagamento) {
            marcarErro(document.getElementById("forma-pagamento-teste"));
        }

        if (isNaN(valor) || !data || !formaPagamento) {
            showToast("Preencha os campos obrigatórios", "error");
            return;
        }

        if (essencial !== "investimento") {
            if (!categoria) {
                marcarErro(document.getElementById("categoria-teste"));
            }

            if (!subcategoria) {
                marcarErro(document.getElementById("subcategoria-teste"));
            }

            if (!categoria || !subcategoria) {
                showToast("Preencha categoria e subcategoria", "error");
                return;
            }
        }

        // Ajustando a data da despesa com base no mês da fatura (caso seja parcelada)
        if (formaPagamento === "credito" && parcelas > 0) {
            const [anoFatura, mesFaturaNumero] = mesFatura.split("-"); // "2023-06" => [2023, 06]

            let ano = parseInt(anoFatura);
            let mes = parseInt(mesFaturaNumero) - 1; // JavaScript usa 0 para janeiro, então subtrai 1

            // Para cada parcela, ajusta a data
            for (let i = 0; i < parcelas; i++) {
                let mesParcela = mes + i; // Ajusta o mês de cada parcela

                // Se o mês ultrapassar dezembro (11), ajusta o ano
                if (mesParcela > 11) {
                    mesParcela -= 12; // Volta para janeiro
                    ano += 1; // Avança para o próximo ano
                }

                // Cria a data no primeiro dia do mês
                let dataParcela = `${ano}-${String(mesParcela + 1).padStart(2, "0")}-01`; // Formato: "YYYY-MM-01"

                let transacaoParcela = {
                    ...dados,
                    categoria, // Garantindo que a categoria e subcategoria sejam incluídas
                    subcategoria,
                    valor: valor / parcelas, // Distribuindo o valor igualmente entre as parcelas
                    data: dataParcela, // A data da parcela é ajustada de acordo com o mês da fatura
                    parcelas: i + 1, // Indica o número da parcela
                };

                // Salvar a parcela como uma nova transação
                await addDoc(collection(db, "users", user.uid, "transacoes"), transacaoParcela);
            }

            showToast("Despesas parceladas adicionadas!");
            return;
        }

        // Caso a despesa não seja parcelada, salva normalmente
        dados = {
            ...dados,
            essencial,
            categoria,
            subcategoria,
            valor,
            data,
            formaPagamento,
            conta,
            cartao,
            parcelas,
            mesFatura
        };
    }

    // ================= LIMPEZA DE DADOS (CRÍTICO) =================
    Object.keys(dados).forEach(key => {
    // Não deletar campos importantes como 'cartao', 'parcelas' ou 'mesFatura' mesmo que estejam vazios
    if (["cartao", "parcelas", "mesFatura"].includes(key)) {
        // Se o campo for vazio, podemos deixar com um valor padrão ou mantê-lo vazio
        if (dados[key] === undefined || dados[key] === null) {
            dados[key] = ""; // ou você pode usar algum valor padrão como "Não informado"
        }
    } else if (
        dados[key] === undefined ||
        dados[key] === null ||
        dados[key] === ""
    ) {
        delete dados[key];  // Deleta apenas os campos realmente desnecessários
    }
});

    // ================= EDIÇÃO =================
    if (idEmEdicao !== null) {
        await updateDoc(
            doc(db, "users", user.uid, "transacoes", idEmEdicao),
            dados
        );

        idEmEdicao = null;

        showToast("Transação atualizada!");

        document.getElementById("indicador-edicao").style.display = "none";

        const btn = document.getElementById("btn-adicionar");
        btn.textContent = "Adicionar";
        btn.classList.remove("modo-edicao");

        limparFormulario();

        return;
    }

    // ================= NOVA TRANSAÇÃO =================
    const docRef = await addDoc(
        collection(db, "users", user.uid, "transacoes"),
        dados
    );

    showToast("Transação adicionada!");
    limparFormulario();
}

function atualizarCategorias() {
    const tipo = document.getElementById("tipo-teste").value;
    const selectCategoria = document.getElementById("categoria-teste");

    selectCategoria.innerHTML = "";

    let categoriasLista = [];

    if (tipo === "receita") {
        categoriasLista = CATEGORIAS.receita;
    } else if (tipo === "despesa") {
        categoriasLista = Object.keys(CATEGORIAS.despesa);
    }

    // Placeholder elegante
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Categoria";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    selectCategoria.appendChild(defaultOption);

    // Adiciona categorias
    categoriasLista.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.toLowerCase();

        option.textContent =
            tipo === "receita"
                ? cat
                : cat.charAt(0).toUpperCase() + cat.slice(1);

        selectCategoria.appendChild(option);
    });
}

function aplicarFiltro() {
    const mesSelecionado = document.getElementById("mes-filtro").value;
    let filtradas = transacoes;

    if (mesSelecionado) {
        filtradas = transacoes.filter(t =>
            t.data && t.data.startsWith(mesSelecionado)
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

    listaTransacoes.forEach((t) => {
        const item = document.createElement("li");

        // �� IMPORTANTE (cursor + estilo)
        item.classList.add(t.tipo);
        item.classList.add("item-transacao");

        let principal = "";
        let secundario = "";

        // ================= RECEITA =================
        if (t.tipo === "receita") {
            principal = t.fonte || "Receita";
            secundario = t.data ? formatarData(t.data) : "";}
         else {
        // ================= DESPESA =================
        if (t.tipo === "despesa") {
            principal = t.categoria || "Despesa";
            secundario = t.data ? formatarData(t.data) : "";}
        else {
                principal = t.essencial || "Despesa";
                secundario = t.data ? formatarData(t.data) : "";
            }}
        
        item.innerHTML = `
            <div class="item-info linha-clicavel">
                <div class="linha-titulo">
                    <strong>${principal}</strong>
                    <span class="setinha">▼</span>
                </div>
                <small>${secundario}</small>
            </div>

            <div class="item-actions">
                <span class="valor">R$ ${t.valor?.toFixed(2) || "0.00"}</span>

                <button class="btn-edit" onclick="editarTransacao('${t.id}')">
                    ✏️
                </button>

                <button class="btn-delete" onclick="confirmarExclusao('${t.id}')">
                    🗑️
                </button>
            </div>

            <div class="detalhes-expandido" style="display:none;">
                ${gerarDetalhesClean(t)}
            </div>
        `;

        // �� clique só na parte esquerda (melhor UX)
        const areaClicavel = item.querySelector(".linha-clicavel");

        areaClicavel.addEventListener("click", () => {
            const detalhes = item.querySelector(".detalhes-expandido");
            const seta = item.querySelector(".setinha");

            const aberto = detalhes.style.display === "block";

            detalhes.style.display = aberto ? "none" : "block";

            if (seta) {
                seta.style.transform = aberto ? "rotate(0deg)" : "rotate(180deg)";
            }
        });

        lista.appendChild(item);
    });
}

function gerarDetalhesClean(t) {

    if (t.tipo === "receita") {
        return `
            <div>${t.conta || "-"}</div>
            <div>${t.descricao || "-"}</div>
        `;
    }

    if (t.tipo === "despesa") {

        let detalhes = `
            <div>${t.subcategoria || "-"}</div>
            <div>${t.formaPagamento || "-"}</div>
        `;

        const forma = (t.formaPagamento || "").toLowerCase();

        // Detalhes para transações no cartão de crédito
        if (forma === "credito") {
            detalhes += `
                <div>${t.cartao || "-"}</div>
                <div>${t.parcelas ? t.parcelas + "x" : "-"}</div>
                <div>${t.mesFatura ? formatarMesFatura(t.mesFatura) : "-"}</div>
            `;
        }

        // Detalhes para transações de pix ou débito
        if (["pix", "debito"].includes(forma)) {
            detalhes += `<div>${t.conta || "-"}</div>`;
        }

        return detalhes;
    }

    return "";
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
        carregarTransacoesTempoReal();
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

function carregarTransacoesTempoReal() {
    const user = auth.currentUser;
    if (!user) return;

    const ref = collection(db, "users", user.uid, "transacoes");

    onSnapshot(ref, (snapshot) => {

        transacoes = [];

        snapshot.forEach(doc => {
            transacoes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        aplicarFiltro();
    });
    transacoes.forEach(t => {
    if (!t.data) {
        console.log("SEM DATA:", t);
    }
});
}

function limparFormulario() {
    // Limpar campos de receita
    document.getElementById("tipo-teste").value = ""; // Tipo (Receita/Despesa)
    document.getElementById("fonte").value = ""; // Fonte da receita
    document.getElementById("descricao-receita").value = ""; // Descrição da receita
    document.getElementById("valor-receita").value = ""; // Valor da receita
    document.getElementById("data-receita").value = ""; // Data da receita
    document.getElementById("conta-bancaria-depositada").value = ""; // Conta bancária de depósito

    // Limpar campos de despesa
    document.getElementById("essencial").value = ""; // Essencial / Não Essencial
    document.getElementById("categoria-teste").value = ""; // Categoria da despesa
    document.getElementById("subcategoria-teste").value = ""; // Subcategoria da despesa
    document.getElementById("descricao-despesa").value = ""; // Descrição da despesa
    document.getElementById("valor-despesa").value = ""; // Valor da despesa
    document.getElementById("data-despesa").value = ""; // Data da despesa
    document.getElementById("forma-pagamento-teste").value = ""; // Forma de pagamento
    document.getElementById("conta-bancaria-debitada").value = ""; // Conta bancária debitada
    document.getElementById("nome-cartao").value = ""; // Nome do cartão
    document.getElementById("parcelas").value = ""; // Parcelas do cartão
    document.getElementById("mes-fatura").value = ""; // Mês da fatura

    // Resetando a visibilidade dos campos
    document.getElementById("bloco-receita").style.display = "none"; // Esconde o bloco de receita
    document.getElementById("bloco-despesa").style.display = "none"; // Esconde o bloco de despesa
    document.getElementById("indicador-edicao").style.display = "none"; // Esconde o indicador de edição

    // Limpar outras variáveis de estado
    idEmEdicao = null;
    document.querySelectorAll("li").forEach(li => {
        li.classList.remove("linha-editando"); // Remove a marcação de edição de todas as transações
    });

    const btn = document.getElementById("btn-adicionar");
    btn.textContent = "Adicionar"; // Restaura o texto do botão para "Adicionar"
    btn.classList.remove("modo-edicao"); // Remove a classe de modo de edição
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.className = "toast show " + type;

    setTimeout(() => {
        toast.className = "toast";
    }, 3000);
}

function marcarErro(campo) {
    if (!campo) return;
    campo.classList.add("erro");
}

function limparErrosFormulario() {
    document.querySelectorAll(".input.erro").forEach(el => {
        el.classList.remove("erro");
    });
}

let idParaExcluir = null;
let tipoParaExcluir = null;

window.confirmarExclusao = function(id) {

    idParaExcluir = id;
    tipoParaExcluir = "transacao";

    document.getElementById("texto-confirmacao").textContent =
        "Deseja remover esta transação?";

    document.getElementById("modal-confirmacao").classList.add("show");
}

window.confirmarExclusaoConta = function(id, nome) {

    idParaExcluir = id;
    tipoParaExcluir = "conta";

    document.getElementById("texto-confirmacao").textContent =
        `Deseja remover a conta "${nome}"?`;

    document.getElementById("modal-confirmacao").classList.add("show");

}

window.confirmarExclusaoCartao = function(id, nome) {

    idParaExcluir = id;
    tipoParaExcluir = "cartao";

    document.getElementById("texto-confirmacao").textContent =
        `Deseja remover o cartão "${nome}"?`;

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

    try {

        if (tipoParaExcluir === "conta") {

            await deleteDoc(
                doc(db, "users", user.uid, "contas", idParaExcluir)
            );

            showToast("Conta removida");

        } else if (tipoParaExcluir === "cartao") {

            await deleteDoc(
                doc(db, "users", user.uid, "cartoes", idParaExcluir)
            );

            showToast("Cartão removido");

        } else {

            await deleteDoc(
                doc(db, "users", user.uid, "transacoes", idParaExcluir)
            );

            showToast("Transação removida", "delete");

        }

        document.getElementById("modal-confirmacao").classList.remove("show");

        idParaExcluir = null;
        tipoParaExcluir = null;

        carregarTransacoesTempoReal();
        carregarContasECartoes();

    } catch (error) {
        console.log(error);
        showToast("Erro ao remover", "error");
    }

});

window.confirmarExclusao = confirmarExclusao;

window.editarTransacao = function(id) {
    const user = auth.currentUser;
    if (!user) return;

    const transacao = transacoes.find(t => t.id === id);
    if (!transacao) return;

    // Atualiza o tipo da transação
    const tipo = document.getElementById("tipo-teste");
    tipo.value = transacao.tipo;

    tipo.dispatchEvent(new Event("change"));

    // Atualizar para RECEITA
    if (transacao.tipo === "receita") {
        document.getElementById("fonte").value = transacao.fonte || "";
        document.getElementById("descricao-receita").value = transacao.descricao || "";
        document.getElementById("valor-receita").value = transacao.valor || "";
        document.getElementById("data-receita").value = transacao.data || "";
        document.getElementById("conta-bancaria-depositada").value = transacao.conta || "";
    }

    // Atualizar para DESPESA
    if (transacao.tipo === "despesa") {
        const essencial = document.getElementById("essencial");
        essencial.value = transacao.essencial || "";

        // �� ESSA LINHA RESOLVE TUDO
        essencial.dispatchEvent(new Event("change"));
        atualizarCategorias();

        const categoria = document.getElementById("categoria-teste");
        categoria.value = transacao.categoria || "";
        categoria.dispatchEvent(new Event("change"));

        setTimeout(() => {
            document.getElementById("subcategoria-teste").value = transacao.subcategoria || "";
        }, 0);

        document.getElementById("descricao-despesa").value = transacao.descricao || "";
        document.getElementById("valor-despesa").value = transacao.valor || "";
        document.getElementById("data-despesa").value = transacao.data || "";

        const forma = document.getElementById("forma-pagamento-teste");
        forma.value = transacao.formaPagamento || "";
        forma.dispatchEvent(new Event("change"));

        if (transacao.formaPagamento === "pix" || transacao.formaPagamento === "debito") {
            document.getElementById("conta-bancaria-debitada").value = transacao.conta || "";
        } 
        if (transacao.formaPagamento === "credito") {
            document.getElementById("nome-cartao").value = transacao.cartao || "";
            document.getElementById("parcelas").value = transacao.parcelas || "";
            document.getElementById("mes-fatura").value = transacao.mesFatura || "";
        }   
    }

     // ================= UI (IGUAL AO ORIGINAL) =================
    document.getElementById("indicador-edicao").style.display = "flex";

    idEmEdicao = id;

    document.querySelectorAll("li").forEach(li => {
        li.classList.remove("linha-editando");
    });

    const linha = document
        .querySelector(`button[onclick*="${id}"]`)
        ?.closest("li");

    if (linha) {
        linha.classList.add("linha-editando");
    }

    const btn = document.getElementById("btn-adicionar");
    btn.textContent = "Salvar alteração";
    btn.classList.add("modo-edicao");

    // ================= SCROLL =================
    const form = document.getElementById("form-transacao");
    if (form) {
        setTimeout(() => {
            form.scrollIntoView({
                behavior: "smooth",
                block: "start" // Muda para "start" para garantir que o formulário apareça no topo
            });
        }, 100); // Atraso de 100ms para garantir que a atualização do formulário seja finalizada
    }
};

function converterDataFirestore(data) {

    if (!data || typeof data !== "string") return null;

    const partes = data.split("-");

    if (partes.length !== 3) return null;

    const [ano, mes, dia] = partes;

    return new Date(ano, mes - 1, dia);
}

function formatarData(data) {
    const [ano, mes, dia] = data.split("-");  // Formato esperado: YYYY-MM-DD
    const dataFormatada = new Date(ano, mes - 1, dia);  // Ajuste para meses que começam do 0
    const diaFormatado = dataFormatada.getDate().toString().padStart(2, '0');
    const mesFormatado = (dataFormatada.getMonth() + 1).toString().padStart(2, '0');
    const anoFormatado = dataFormatada.getFullYear();
    return `${diaFormatado}/${mesFormatado}/${anoFormatado}`;  // Retorna a data formatada como DD/MM/YYYY
}

function formatarMesFatura(mes) {
    if (!mes) return "";

    const [ano, mesNumero] = mes.split("-");

    return `${mesNumero}/${ano}`;
}

function calcularTotaisPorMes(mes, ano) {
    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoes.forEach(t => {

        const data = converterDataFirestore(t.data);

        // �� IGNORA registros inválidos
        if (!data) return;

        // �� garante que valor é número
        const valor = Number(t.valor) || 0;

        if (data.getMonth() === mes && data.getFullYear() === ano) {
            if (t.tipo === "receita") {
                totalReceitas += valor;
            } else if (t.tipo === "despesa") {
                totalDespesas += valor;
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

async function salvarEdicao() {
    // Esconde o indicador de edição
    document.getElementById("indicador-edicao").style.display = "none";
    // Lógica de salvar a transação...
}

// Exibir formulário ao clicar no botão
document.getElementById("btn-abrir-form-conta").addEventListener("click", () => {
    const formularioConta = document.getElementById("formulario-conta");

    // Exibe o formulário
    formularioConta.style.display = "block";
    
    // Rola a página até o formulário
    formularioConta.scrollIntoView({
        behavior: "smooth",
        block: "center"  // Alinha o formulário ao centro da tela
    });

    // Adicionalmente, esconde o botão de adicionar
    //document.getElementById("btn-abrir-form-conta").style.display = "none";
});

    document.getElementById("tipo-conta").addEventListener("change", function() {

    const tipo = this.value;

    if (tipo === "cartao") {
        document.getElementById("datas-cartao").style.display = "block";
        document.getElementById("data-saldo-conta").style.display = "none";
    } else {
        document.getElementById("datas-cartao").style.display = "none";
        document.getElementById("data-saldo-conta").style.display = "block";
    }

    atualizarPlaceholderSaldo();

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


document.getElementById("btn-salvar-conta").addEventListener("click", async () => {
    await adicionarConta();  // Chama a função para adicionar a conta
});

async function adicionarConta() {
    console.log('Função de adicionar conta foi chamada'); // Log para verificar se a função está sendo chamada
    
    // Captura os valores dos campos
    const tipo = document.getElementById("tipo-conta").value;
    const nome = document.getElementById("nome-conta").value;
    const saldo = parseFloat(document.getElementById("saldo-conta").value);
    const vencimento = document.getElementById("vencimento-cartao").value;
    const fechamento = document.getElementById("fechamento-cartao").value;
    const dataSaldo = document.getElementById("data-saldo-conta").value;

    console.log("Dados do formulário:", tipo, nome, saldo, vencimento, fechamento, dataSaldo); // Log dos dados capturados

    // Verificando se os campos estão preenchidos corretamente
    // A lógica agora foi corrigida para que a validação aconteça somente após o preenchimento
    if (!nome || isNaN(saldo) || (tipo === "cartao" && (!vencimento || !fechamento)) || (tipo === "conta" && !dataSaldo)) {
        showToast("Preencha todos os campos corretamente.", "error");
        return;
    }

    // Verifica se o usuário está autenticado
    const user = auth.currentUser;
    if (!user) {
        alert("Você precisa estar logado para adicionar uma conta.");
        return;
    }

    if (contaEmEdicao) {

        await updateDoc(
            doc(db, "users", user.uid, "contas", contaEmEdicao),
            {
                nome: nome,
                saldo: saldo,
                dataSaldo: dataSaldo
            }
        );

        showToast("Conta atualizada!");
        limparFormularioConta();
        contaEmEdicao = null;
        document.getElementById("indicador-edicao-conta").style.display = "none";

        const btn = document.getElementById("btn-adicionar-conta");
        btn.textContent = "Adicionar Conta ou Cartão";
        btn.classList.remove("modo-edicao");

        carregarContasECartoes();
        return; 
    }    

    if (cartaoEmEdicao) {

        await updateDoc(
            doc(db, "users", user.uid, "cartoes", cartaoEmEdicao),
            {
                nome: nome,
                limite: saldo,
                vencimento: vencimento,
                fechamento: fechamento
            }
        );

        showToast("Cartão atualizado!");
        limparFormularioConta();
        cartaoEmEdicao = null;
        document.getElementById("indicador-edicao-conta").style.display = "none";

        const btn = document.getElementById("btn-salvar-conta");
        btn.textContent = "Adicionar Conta ou Cartão";
        btn.classList.remove("modo-edicao");

        carregarContasECartoes();
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
                limite: saldo,
                vencimento: vencimento,
                fechamento: fechamento,
                tipo: tipo
            });
        }

        console.log("Conta ou cartão adicionado com sucesso!");
        showToast("Conta ou cartão adicionado com sucesso!");
        limparFormularioConta();
        carregarContasECartoes(); // Atualiza a lista após a adição

    } catch (error) {
        console.log("Erro ao adicionar conta ou cartão: ", error); // Log do erro para depuração
        alert("Erro ao adicionar conta ou cartão: " + error.message);
    }
}

function atualizarPlaceholderSaldo() {

    const tipo = document.getElementById("tipo-conta").value;
    const campoSaldo = document.getElementById("saldo-conta");

    if (tipo === "conta") {
        campoSaldo.placeholder = "Saldo inicial";
    }

    if (tipo === "cartao") {
        campoSaldo.placeholder = "Limite do cartão";
    }

}

// Exibir as contas e cartões cadastrados
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
        const dataSaldo = doc.data().dataSaldo; // Acessando o campo de dataSaldo
        const saldoFormatado = formatarData(dataSaldo); // Usando a função formatarData

        const li = document.createElement("li");
        li.innerHTML = `
            <div class="item-info">
                <strong>Conta Corrente: ${doc.data().nome}</strong><br>
                <small>Saldo Inicial: R$ ${doc.data().saldo.toFixed(2)}</small><br>
                <small>Informado em: ${saldoFormatado}</small>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editarConta('${doc.id}')">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zM20.71 6.04c.39-.39.39-1.02 0-1.41l-1.34-1.34c-.39-.39-1.02-.39-1.41 0l-1.13 1.13 3.75 3.75 1.13-1.13z"/>
                    </svg>
                </button>
                <button class="btn-delete" onclick="confirmarExclusaoConta('${doc.id}','${doc.data().nome}')">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor"
                        d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z"/>
                    </svg>
                </button>
            </div>
        `;
        listaContas.appendChild(li);
    });

    cartoesSnapshot.forEach(doc => {
        const vencimento = doc.data().vencimento; // Acessando a data de vencimento
        const fechamento = doc.data().fechamento; // Acessando a data de fechamento

        const vencimentoDia = vencimento.split("-")[2];
        const fechamentoDia = fechamento.split("-")[2];

        const limiteCartao = doc.data().limite ?? doc.data().saldo;

        const li = document.createElement("li");
        li.innerHTML = `
            <div class="item-info">
                <strong>Cartão: ${doc.data().nome}</strong><br>
                <small>Vence dia ${vencimentoDia}</small><br>
                <small>Fecha dia ${fechamentoDia}</small><br>
                <small>Limite: R$ ${limiteCartao.toFixed(2)}</small>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editarCartao('${doc.id}')">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zM20.71 6.04c.39-.39.39-1.02 0-1.41l-1.34-1.34c-.39-.39-1.02-.39-1.41 0l-1.13 1.13 3.75 3.75 1.13-1.13z"/>
                    </svg>
                </button>
                <button class="btn-delete" onclick="confirmarExclusaoCartao('${doc.id}','${doc.data().nome}')">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor"
                        d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z"/>
                    </svg>
                </button>
            </div>
        `;
        listaCartoes.appendChild(li);
    });
}

document.getElementById("btn-exibir-contas").addEventListener("click", () => {
    const contasCartoesContainer = document.getElementById("contas-cartoes-container");
    const btnExibirContas = document.getElementById("btn-exibir-contas");

    // Verifica se as contas e cartões estão visíveis ou não
    if (contasCartoesContainer.style.display === "none" || contasCartoesContainer.style.display === "") {
        // Exibe as contas e cartões
        contasCartoesContainer.style.display = "block";
        btnExibirContas.textContent = "Ocultar Contas e Cartões";  // Muda o texto do botão
    } else {
        // Oculta as contas e cartões
        contasCartoesContainer.style.display = "none";
        btnExibirContas.textContent = "Exibir Contas e Cartões";  // Restaura o texto original do botão
    }
});

async function removerConta(id) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // Deletar a conta do Firestore
        await deleteDoc(doc(db, "users", user.uid, "contas", id));

        // Exibir confirmação
        showToast("Conta removida!");
        
        // Recarregar as listas
        carregarContasECartoes();
    } catch (error) {
        console.error("Erro ao remover conta:", error);
        showToast("Erro ao remover conta", "error");
    }
}

async function removerCartao(id) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // Deletar o cartão do Firestore
        await deleteDoc(doc(db, "users", user.uid, "cartoes", id));

        // Exibir confirmação
        showToast("Cartão removido!");
        
        // Recarregar as listas
        carregarContasECartoes();
    } catch (error) {
        console.error("Erro ao remover cartão:", error);
        showToast("Erro ao remover cartão", "error");
    }
}

window.editarConta = async function(id) {

    const user = auth.currentUser;
    if (!user) return;

    const docRef = doc(db, "users", user.uid, "contas", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return;

    const conta = docSnap.data();

    document.getElementById("tipo-conta").value = "conta";
    document.getElementById("nome-conta").value = conta.nome;
    document.getElementById("saldo-conta").value = conta.saldo;
    document.getElementById("data-saldo-conta").value = conta.dataSaldo;

    document.getElementById("datas-cartao").style.display = "none";
    document.getElementById("data-saldo-conta").style.display = "block";

    contaEmEdicao = id;
    document.getElementById("indicador-edicao-conta").textContent = "Editando Conta";
    document.getElementById("indicador-edicao-conta").style.display = "block";
    document.getElementById("formulario-conta").style.display = "block";
    document.getElementById("formulario-conta").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
    const btn = document.getElementById("btn-salvar-conta");
    btn.textContent = "Salvar alteração";
    btn.classList.add("modo-edicao");
}

window.editarCartao = async function(id) {

    const user = auth.currentUser;
    if (!user) return;

    const docRef = doc(db, "users", user.uid, "cartoes", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return;

    const cartao = docSnap.data();

    document.getElementById("tipo-conta").value = "cartao";
    document.getElementById("nome-conta").value = cartao.nome;
    document.getElementById("saldo-conta").value = cartao.limite;

    document.getElementById("vencimento-cartao").value = cartao.vencimento;
    document.getElementById("fechamento-cartao").value = cartao.fechamento;

    document.getElementById("datas-cartao").style.display = "block";
    document.getElementById("data-saldo-conta").style.display = "none";

    cartaoEmEdicao = id;
    document.getElementById("indicador-edicao-conta").textContent = "Editando Cartão";
    document.getElementById("indicador-edicao-conta").style.display = "block";
    document.getElementById("formulario-conta").style.display = "block";
    document.getElementById("formulario-conta").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
    const btn = document.getElementById("btn-salvar-conta");
    btn.textContent = "Salvar alteração";
    btn.classList.add("modo-edicao");

}

function limparFormularioConta() {

    document.getElementById("nome-conta").value = "";
    document.getElementById("saldo-conta").value = "";
    document.getElementById("data-saldo-conta").value = "";

    document.getElementById("vencimento-cartao").value = "";
    document.getElementById("fechamento-cartao").value = "";

    document.getElementById("tipo-conta").value = "conta";

    document.getElementById("datas-cartao").style.display = "none";
    document.getElementById("data-saldo-conta").style.display = "block";

    document.getElementById("indicador-edicao-conta").style.display = "none";

    const btn = document.getElementById("btn-salvar-conta");
    btn.textContent = "Adicionar";
    btn.classList.remove("modo-edicao");

    // �� NOVO: fechar o formulário
    document.getElementById("formulario-conta").style.display = "none";

}

function cancelarEdicaoConta() {

    contaEmEdicao = null;
    cartaoEmEdicao = null;

    limparFormularioConta();

}

document
.getElementById("btn-cancelar-edicao-conta")
.addEventListener("click", cancelarEdicaoConta);

document.getElementById("btn-cancelar-edicao-transacao")
    .addEventListener("click", () => {

        // limpa campos
        limparFormulario();

        // �� limpa erros visuais
        limparErrosFormulario();

        // reseta modo edição
        idEmEdicao = null;

        document.getElementById("indicador-edicao").style.display = "none";

        const btn = document.getElementById("btn-adicionar");
        btn.textContent = "Adicionar";
        btn.classList.remove("modo-edicao");
    });


// Alternar entre receita e despesa
document.getElementById("tipo-teste").addEventListener("change", () => {

    const tipo = document.getElementById("tipo-teste").value;

    document.getElementById("bloco-receita").style.display =
        tipo === "receita" ? "block" : "none";

    document.getElementById("bloco-despesa").style.display =
        tipo === "despesa" ? "block" : "none";

});

document.getElementById("forma-pagamento-teste").addEventListener("change", () => {

    const forma = document.getElementById("forma-pagamento-teste").value;

    document.getElementById("bloco-cartao").style.display =
        forma === "credito" ? "block" : "none";

    document.getElementById("bloco-conta-debito").style.display =
        (forma === "pix" || forma === "debito") ? "block" : "none";

});

//document.getElementById("btn-adicionar")
//.addEventListener("click", salvarTransacaoTeste);


function capturarDadosFormularioTeste(){

    const tipo = document.getElementById("tipo-teste").value;

    let dados = { tipo };

    if(tipo === "receita"){

        dados.fonte = document.getElementById("fonte").value;
        dados.descricao = document.getElementById("descricao-receita").value;
        dados.valor = parseFloat(document.getElementById("valor-receita").value);
        dados.data = document.getElementById("data-receita").value;
        dados.conta = document.getElementById("conta-bancaria-depositada").value;

    }

    if(tipo === "despesa"){

        dados.essencial = document.getElementById("essencial").value;
        dados.categoria = document.getElementById("categoria-teste").value;
        dados.subcategoria = document.getElementById("subcategoria-teste").value;
        dados.descricao = document.getElementById("descricao-despesa").value;
        dados.valor = parseFloat(document.getElementById("valor-despesa").value);
        dados.data = document.getElementById("data-despesa").value;

        const forma = document.getElementById("forma-pagamento-teste").value;
        dados.formaPagamento = forma;

        if(forma === "pix" || forma === "debito"){
            dados.contaDebitada =
            document.getElementById("conta-bancaria-debitada").value;
        }

        if(forma === "credito"){
            dados.cartao = document.getElementById("nome-cartao").value;
            dados.parcelas = document.getElementById("parcelas").value;
            dados.mesFatura = document.getElementById("mes-fatura").value;
        }
    }

    return dados;
}

async function carregarContasTeste(){

    const user = auth.currentUser;
    if (!user) return;

    const snapshot = await getDocs(
        collection(db, "users", user.uid, "contas")
    );

    const selectReceita = document.getElementById("conta-bancaria-depositada");
    const selectDespesa = document.getElementById("conta-bancaria-debitada");

    if (selectReceita) {
        selectReceita.innerHTML = `
            <option value="" disabled selected>Conta Depositada</option>
        `;
    }

    if (selectDespesa) {
        selectDespesa.innerHTML = `
            <option value="" disabled selected>Conta Debitada</option>
        `;
    }

    snapshot.forEach(doc => {
        const conta = doc.data();

        const option1 = document.createElement("option");
        option1.value = conta.nome;
        option1.textContent = conta.nome;

        const option2 = option1.cloneNode(true);

        if (selectReceita) selectReceita.appendChild(option1);
        if (selectDespesa) selectDespesa.appendChild(option2);
    });
}

async function carregarCartoesTeste(){

    const user = auth.currentUser;
    if (!user) return;

    const snapshot = await getDocs(
        collection(db, "users", user.uid, "cartoes")
    );

    const select = document.getElementById("nome-cartao");

    if (!select) return;

    select.innerHTML = "";

    snapshot.forEach(doc => {
        const cartao = doc.data();

        const option = document.createElement("option");
        option.value = cartao.nome;
        option.textContent = cartao.nome;

        select.appendChild(option);
    });

}

function escutarContasTempoReal() {
    const user = auth.currentUser;
    if (!user) return;

    const ref = collection(db, "users", user.uid, "contas");

    onSnapshot(ref, (snapshot) => {

        const contas = [];

        snapshot.forEach(doc => {
            contas.push(doc.data());
        });

        atualizarSelectContas(contas);
    });
}

function escutarCartoesTempoReal() {
    const user = auth.currentUser;
    if (!user) return;

    const ref = collection(db, "users", user.uid, "cartoes");

    onSnapshot(ref, (snapshot) => {

        const cartoes = [];

        snapshot.forEach(doc => {
            cartoes.push(doc.data());
        });

        atualizarSelectCartoes(cartoes);
    });
}

function atualizarSelectContas(contas) {

    const selectReceita = document.getElementById("conta-bancaria-depositada");
    const selectDespesa = document.getElementById("conta-bancaria-debitada");

    if (selectReceita) {
        selectReceita.innerHTML = `
            <option value="" disabled selected>Conta Depositada</option>
        `;
    }

    if (selectDespesa) {
        selectDespesa.innerHTML = `
            <option value="" disabled selected>Conta Debitada</option>
        `;
    }

    contas.forEach(conta => {
        const option1 = document.createElement("option");
        option1.value = conta.nome;
        option1.textContent = conta.nome;

        const option2 = option1.cloneNode(true);

        if (selectReceita) selectReceita.appendChild(option1);
        if (selectDespesa) selectDespesa.appendChild(option2);
    });
}
function atualizarSelectCartoes(cartoes) {

    const selectCartao = document.getElementById("nome-cartao");

    if (!selectCartao) return;

    selectCartao.innerHTML = `
        <option value="" disabled selected>Cartão</option>
    `;

    cartoes.forEach(cartao => {
        const option = document.createElement("option");
        option.value = cartao.nome;
        option.textContent = cartao.nome;

        selectCartao.appendChild(option);
    });
}

// ================= CATEGORIAS E SUBCATEGORIAS (TESTE) =================

// Categorias de Receita e Despesa
const CATEGORIAS = {
    receita: ["Salário", "Prólabore", "Investimentos", "Dividendos", "Outros"],
    despesa: {
        alimentacao: ["Supermercado", "Restaurante", "Delivery"],
        moradia: ["Aluguel", "Condomínio", "Energia"],
        transporte: ["Uber", "Combustível", "Ônibus"],
        lazer: ["Cinema", "Viagem", "Streaming"],
        saude: ["Farmácia", "Plano de saúde"],
        educacao: ["Cursos", "Faculdade", "Material Escolar"],
        servicos_financeiros: ["Taxas Bancárias", "IOF", "Anuidade"]
    }
};

function carregarCategoriasTeste() {
    const select = document.getElementById("categoria-teste");

    select.innerHTML = '<option value="" disabled selected>Categoria</option>';

    CATEGORIAS.receita.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.toLowerCase();
        option.textContent = cat;
        select.appendChild(option);
    });

    Object.keys(CATEGORIAS.despesa).forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.toLowerCase();
        option.textContent =
            cat.charAt(0).toUpperCase() + cat.slice(1);
        select.appendChild(option);
    });
}

function atualizarSubcategoriasTeste() {
    const categoria = document.getElementById("categoria-teste");
    const subcategoria = document.getElementById("subcategoria-teste");

    if (!categoria || !subcategoria) return;

    const selecionada = categoria.value;

    subcategoria.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Subcategoria";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    subcategoria.appendChild(defaultOption);

    if (!selecionada) return;

    const subcategorias = CATEGORIAS.despesa[selecionada];

    if (subcategorias) {
        subcategorias.forEach(sub => {
            const option = document.createElement("option");
            option.value = sub.toLowerCase();
            option.textContent = sub;
            subcategoria.appendChild(option);
        });
    }
}

// Inicialização correta
document.addEventListener("DOMContentLoaded", () => {

    carregarCategoriasTeste();
    atualizarSubcategoriasTeste();

    const categoria = document.getElementById("categoria-teste");

    if (categoria) {
        categoria.addEventListener("change", atualizarSubcategoriasTeste);
    }

});

function validarFormularioTeste(dados){

    // VALOR E DATA
    if (!dados.valor || dados.valor <= 0) {
        return "Informe um valor válido";
    }

    if (!dados.data) {
        return "Informe a data";
    }

    // RECEITA
    if (dados.tipo === "receita") {

        if (!dados.fonte) {
            return "Selecione a fonte da receita";
        }

        if (!dados.conta) {
            return "Selecione a conta de destino";
        }

        return null;
    }

    // DESPESA
    if (dados.tipo === "despesa") {

        if (!dados.essencial) {
            return "Selecione o tipo da despesa";
        }

        // INVESTIMENTO / FINANCEIRO
        if (
    dados.essencial === "investimento" ||
    dados.essencial === "financeiro"
) {

    if (!dados.formaPagamento) {
        return "Selecione a forma de pagamento";
    }

    // PIX ou DÉBITO → precisa conta
    if (
        (dados.formaPagamento === "pix" || dados.formaPagamento === "debito") &&
        !dados.contaDebitada
    ) {
        return "Selecione a conta para débito";
    }

    // CRÉDITO → precisa cartão
    if (dados.formaPagamento === "credito") {

        if (!dados.cartao) {
            return "Selecione o cartão";
        }

        if (!dados.parcelas) {
            return "Informe as parcelas";
        }
    }

    return null;
}

        // ESSENCIAL / NÃO ESSENCIAL
        if (!dados.categoria) {
            return "Selecione a categoria";
        }

        if (!dados.subcategoria) {
            return "Selecione a subcategoria";
        }

        if (!dados.formaPagamento) {
            return "Selecione a forma de pagamento";
        }

        // PIX / DÉBITO
        if (
            (dados.formaPagamento === "pix" || dados.formaPagamento === "debito") &&
            !dados.contaDebitada
        ) {
            return "Selecione a conta";
        }

        // CARTÃO
        if (dados.formaPagamento === "credito") {

            if (!dados.cartao) {
                return "Selecione o cartão";
            }

            if (!dados.parcelas) {
                return "Informe as parcelas";
            }

        }
    }

    return null;
}

document.getElementById("essencial").addEventListener("change", () => {

    const tipo = document.getElementById("essencial").value;

    const categoria = document.getElementById("categoria-teste");
    const subcategoria = document.getElementById("subcategoria-teste");

    if (!categoria || !subcategoria) return;

    if (tipo === "investimento" || tipo === "financeiro") {

        categoria.value = "";

        subcategoria.innerHTML = `
            <option value="" disabled selected>Subcategoria</option>
        `;

        categoria.disabled = true;
        subcategoria.disabled = true;

    } else {

        categoria.disabled = false;
        subcategoria.disabled = false;

        atualizarSubcategoriasTeste();

    }

});

async function salvarTransacaoTeste(){

    const user = auth.currentUser;
    if (!user) {
        showToast("Usuário não autenticado", "error");
        return;
    }

    const dados = capturarDadosFormularioTeste();

    const erro = validarFormularioTeste(dados);

    if (erro) {
        showToast(erro, "error");
        return;
    }

    try {

        await addDoc(
            collection(db, "users", user.uid, "transacoes"),
            dados
        );

        showToast("Transação salva com sucesso!", "success");

        console.log("SALVO NO FIRESTORE:", dados);

        console.log("UID:", user.uid);

        console.log("SALVANDO EM:", `users/${user.uid}/transacoes`);

    } catch (error) {
        console.error(error);
        showToast("Erro ao salvar transação", "error");
    }
    await testarLeituraTransacoes();
}

async function testarLeituraTransacoes() {

    const user = auth.currentUser;
    if (!user) return;

    const snapshot = await getDocs(
        collection(db, "users", user.uid, "transacoes")
    );

    console.log("QUANTIDADE:", snapshot.size);

    snapshot.forEach(doc => {
        console.log("DOC:", doc.id, doc.data());
    });

}


function renderizarSaldoContasComDados(saldos) {
    const container = document.getElementById("saldo-contas-detalhe");

    container.innerHTML = "";

    let total = 0;

    Object.entries(saldos).forEach(([nome, saldo]) => {
        total += saldo;

        const div = document.createElement("div");
        div.className = "saldo-item";
        div.innerHTML = `
            <span>${nome}</span>
            <span class="valor ${saldo >= 0 ? 'receita' : 'despesa'}">
                R$ ${saldo.toFixed(2)}
            </span>
        `;
        container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "saldo-total";
    totalDiv.innerHTML = `
        <span>Total</span>
        <span>R$ ${total.toFixed(2)}</span>
    `;

    container.appendChild(totalDiv);
}

document
    .getElementById("saldo-contas-container")
    .addEventListener("click", async function () {

        this.classList.toggle("show");

        if (this.classList.contains("show")) {
            await iniciarListenerSaldo();
        }
    });

    async function calcularFaturasCartoes() {
    const user = auth.currentUser;
    if (!user) return;

    const transacoesRef = collection(db, "users", user.uid, "transacoes");
    const snapshot = await getDocs(transacoesRef);

    const faturas = {};

    snapshot.forEach(doc => {
        const t = doc.data();

        if (
            t.tipo === "despesa" &&
            t.formaPagamento === "credito" &&
            t.cartao
        ) {
            const valorParcela = t.valor / (parseInt(t.parcelas) || 1);

            // �� chave: cartão + mês da fatura
            const chave = `${t.cartao}__${t.mesFatura}`;

            faturas[chave] = (faturas[chave] || 0) + valorParcela;
        }
    });

    return faturas;
}

async function renderizarFaturas() {
    const container = document.getElementById("faturas-detalhe");

    const faturas = await calcularFaturasCartoes();

    container.innerHTML = "";

    let total = 0;

    Object.entries(faturas).forEach(([chave, valor]) => {
        total += valor;

        const [cartao, mes] = chave.split("__");

        const div = document.createElement("div");
        div.className = "saldo-item";
        div.innerHTML = `
            <span>${cartao} (${mes})</span>
            <span class="valor despesa">
                R$ ${valor.toFixed(2)}
            </span>
        `;

        container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "saldo-total";
    totalDiv.innerHTML = `
        <span>Total</span>
        <span>R$ ${total.toFixed(2)}</span>
    `;

    container.appendChild(totalDiv);
}

document
    .getElementById("faturas-container")
    .addEventListener("click", async function () {

        this.classList.toggle("show");

        if (this.classList.contains("show")) {
            await renderizarFaturas();
        }
    });

let saldoVisivel = true;
let saldoAtual = 0;
let saldoAnterior = 0;

// �� Atualiza saldo
function atualizarSaldoTopoComDados(saldos) {
    let total = 0;

    Object.values(saldos).forEach(saldo => {
        if (typeof saldo === "number") {
            total += saldo;
        }
    });

    saldoAtual = total;
    renderSaldo();
}

// �� Render correto
function renderSaldo() {
    const el = document.getElementById("saldo-valor");

    el.classList.remove("animar");
    void el.offsetWidth;

    if (!saldoVisivel) {
        // �� Modo oculto
        el.textContent = "••••••";
        el.classList.add("saldo-oculto");
    } else {
        // ��️ Modo visível
        el.classList.remove("saldo-oculto");

        // �� Se estava oculto antes, reinicia do zero
        if (el.textContent === "••••••") {
            animarContagem(el, 0, saldoAtual);
        } else {
            // �� Atualização normal (valor mudou)
            if (saldoAnterior !== saldoAtual) {
                animarContagem(el, saldoAnterior, saldoAtual);
            }
        }

        saldoAnterior = saldoAtual;

        if (saldoAtual < 0) {
            el.classList.add("saldo-negativo");
        } else {
            el.classList.remove("saldo-negativo");
        }
    }

    el.classList.add("animar");
}

// �� Botão
document.getElementById("toggle-saldo").addEventListener("click", () => {
    saldoVisivel = !saldoVisivel;

    const icone = document.getElementById("icone-olho");
    icone.textContent = saldoVisivel ? "��" : "��";

    renderSaldo();
});

// �� Animação confiável
function animarContagem(elemento, inicio, fim, duracao = 800) {
    const start = performance.now();

    function atualizar(tempoAtual) {
        const progresso = Math.min((tempoAtual - start) / duracao, 1);

        // Easing suave (ease-out)
        const ease = 1 - Math.pow(1 - progresso, 3);

        const valorAtual = inicio + (fim - inicio) * ease;

        elemento.textContent = valorAtual.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        if (progresso < 1) {
            requestAnimationFrame(atualizar);
        }
    }

    requestAnimationFrame(atualizar);
}

function iniciarListenerSaldo() {
    const user = auth.currentUser;
    if (!user) return;

    const contasRef = collection(db, "users", user.uid, "contas");
    const transacoesRef = collection(db, "users", user.uid, "transacoes");

    let contas = [];
    let transacoes = [];

    function recalcular() {
        const saldos = {};

        // Contas
        contas.forEach(doc => {
            const data = doc.data();
            if (data.nome && data.saldo !== undefined) {
                saldos[data.nome] = Number(data.saldo) || 0;
            }
        });

        // Transações
        transacoes.forEach(doc => {
            const t = doc.data();
            const valor = Number(t.valor);

            if (!t.conta || isNaN(valor)) return;

            if (t.tipo === "receita") {
                saldos[t.conta] = (saldos[t.conta] || 0) + valor;
            }

            if (t.tipo === "despesa") {
                saldos[t.conta] = (saldos[t.conta] || 0) - valor;
            }
        });

        atualizarSaldoTopoComDados(saldos);
        renderizarSaldoContasComDados(saldos);
    }

    onSnapshot(contasRef, (snapshot) => {
        console.log("�� Contas atualizadas");
        contas = snapshot.docs;
        recalcular();
    });

    onSnapshot(transacoesRef, (snapshot) => {
        console.log("�� Transações atualizadas");
        transacoes = snapshot.docs;
        recalcular();
    });
}