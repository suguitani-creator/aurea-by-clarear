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
    receita: ["Salário", "Pró-labore", "Investimentos", "Dividendos", "Outros"],
    despesa: ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Outros"]
};

let idEmEdicao = null;
let transacoes = [];
let grafico;

// 🔥 GARANTE QUE TUDO SÓ RODE APÓS O DOM CARREGAR
window.addEventListener("DOMContentLoaded", () => {
    atualizarCategorias();

    const hoje = new Date().toISOString().slice(0,7);
    document.getElementById("mes-filtro").value = hoje;

    document.getElementById("mes-filtro").addEventListener("change", aplicarFiltro);
    document.getElementById("tipo").addEventListener("change", atualizarCategorias);
    document.getElementById("btn-adicionar").addEventListener("click", adicionarTransacao);

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
            document.getElementById("usuario-email").textContent = user.email;
            authContainer.style.display = "none";
            appContainer.style.display = "block";
            carregarTransacoes();
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

    if (!descricao || isNaN(valor) || !data) {
        showToast("Preencha todos os campos corretamente", "error");
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