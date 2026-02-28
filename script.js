import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
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
            alert("Conta criada com sucesso!");
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById("btn-login").addEventListener("click", async () => {
        try {
            await signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value);
        } catch (error) {
            alert("Erro ao entrar: " + error.message);
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
        alert("Preencha todos os campos corretamente.");
        return;
    }

    await addDoc(
        collection(db, "users", user.uid, "transacoes"),
        { tipo, categoria, descricao, valor, data }
    );
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

    listaTransacoes.forEach((transacao, index) => {
        const item = document.createElement("li");
        item.classList.add(transacao.tipo);

        item.innerHTML = `
            <div>
                <strong>${transacao.descricao}</strong><br>
                <small>${transacao.categoria}</small>
            </div>
            <div>
                R$ ${transacao.valor.toFixed(2)}
                <button onclick="removerTransacao('${transacao.id}')">❌</button>
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

    await deleteDoc(
        doc(db, "users", user.uid, "transacoes", id)
    );

    carregarTransacoes();
}

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

    querySnapshot.forEach((doc) => {
        transacoes.push({
            id: doc.id,
            ...doc.data()
        });
    });

    aplicarFiltro();
}

function limparFormulario() {
    document.getElementById("descricao").value = "";
    document.getElementById("valor").value = "";
    document.getElementById("data").value = "";
}