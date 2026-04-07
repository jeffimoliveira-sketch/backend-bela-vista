import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert, ScrollView, RefreshControl
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import * as Print from 'expo-print';     // <-- ADICIONADO
import * as Sharing from 'expo-sharing'; // <-- ADICIONADO

const API_URL = "https://backend-bela-vista.onrender.com";

export default function App() {
  const [tela, setTela] = useState("form");
  const [nome, setNome] = useState("");
  const [produto, setProduto] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [usuario, setUsuario] = useState("");
  const [dados, setDados] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // =========================
  // CACHE
  // =========================
  const salvarCache = async (lista) => {
    // Ordena a lista por data de criação (se houver) antes de salvar
    const listaOrdenada = lista.sort((a, b) => 
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
    await AsyncStorage.setItem("doacoes_cache", JSON.stringify(listaOrdenada));
    setDados(listaOrdenada);
  };

  const carregarCache = async () => {
    const cache = await AsyncStorage.getItem("doacoes_cache");
    if (cache) setDados(JSON.parse(cache));
  };

  // =========================
  // FILA
  // =========================
  const adicionarFila = async (item) => {
    const fila = await AsyncStorage.getItem("queue");
    let lista = fila ? JSON.parse(fila) : [];
    lista.push(item);
    await AsyncStorage.setItem("queue", JSON.stringify(lista));
  };

  // =========================
  // REGISTRAR
  // =========================
  const registrar = async () => {
    if (!nome || !produto || !quantidade || !usuario) {
      Alert.alert("Erro", "Preencha todos os campos");
      return;
    }

    const nova = {
      id_local: uuid.v4(),
      nome,
      produto,
      quantidade: Number(quantidade),
      usuario,
      synced: false,
      created_at: new Date().toISOString(), // Adiciona data de criação local
    };

    const cache = await AsyncStorage.getItem("doacoes_cache");
    let lista = cache ? JSON.parse(cache) : [];
    lista.push(nova);

    await salvarCache(lista);
    await adicionarFila({ type: "CREATE", data: nova });

    setNome(""); setProduto(""); setQuantidade(""); setUsuario("");
    sincronizar();
  };

  // =========================
  // SINCRONIZAR
  // =========================
  const sincronizar = async () => {
    try {
      const fila = JSON.parse(await AsyncStorage.getItem("queue") || "[]");
      let novaFila = [];

      for (const item of fila) {
        try {
          const response = await fetch(`${API_URL}/registrar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.data),
          });
          if (!response.ok) throw new Error("Server error");
        } catch {
          novaFila.push(item);
        }
      }

      await AsyncStorage.setItem("queue", JSON.stringify(novaFila));
      await baixarDados();
    } catch (e) {
      console.log("Erro sync:", e);
    }
  };

  // =========================
  // BAIXAR DADOS
  // =========================
  const baixarDados = async () => {
    try {
      const res = await fetch(`${API_URL}/doacoes`);
      if (!res.ok) throw new Error("Erro API");

      const servidor = await res.json();
      const cache = JSON.parse(await AsyncStorage.getItem("doacoes_cache") || "[]");

      const mapa = new Map();

      // Dados do servidor são a base, sempre sincronizados
      servidor.forEach(item => {
        const id = item.id_local || item.id; // Garante que temos uma chave
        mapa.set(id, { ...item, id_local: id, synced: true });
      });

      // Itens locais não sincronizados têm prioridade sobre os do servidor
      cache.forEach(item => {
        if (!item.synced) {
          mapa.set(item.id_local, item);
        }
      });

      const final = Array.from(mapa.values());
      await salvarCache(final);
    } catch (e) {
      Alert.alert("Falha na Rede", "Não foi possível buscar os dados mais recentes.");
    }
  };

  // =========================
  // GERAR PDF (NOVA FUNÇÃO)
  // =========================
  const gerarPDF = async () => {
    if (dados.length === 0) {
      Alert.alert("Atenção", "Não há dados para gerar o relatório.");
      return;
    }

    const linhasTabela = dados.map(item => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.nome}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.produto}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantidade}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.usuario}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: sans-serif; }
            h1 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>📦 Relatório de Doações</h1>
          <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Produto</th>
                <th>Quantidade</th>
                <th>Usuário</th>
              </tr>
            </thead>
            <tbody>
              ${linhasTabela}
            </tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Compartilhar Relatório' });
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    }
  };

  // =========================
  // DELETE LOCAL
  // =========================
  const deletarItem = async (id_local) => {
    let lista = JSON.parse(await AsyncStorage.getItem("doacoes_cache") || "[]");
    lista = lista.filter(i => i.id_local !== id_local);
    await salvarCache(lista);
  };

  // =========================
  // REFRESH
  // =========================
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    sincronizar().then(() => setRefreshing(false));
  }, []);

  // =========================
  // INIT
  // =========================
  useEffect(() => {
    carregarCache();
    sincronizar();
  }, []);

  // =========================
  // UI
  // =========================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 50 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.header}>📦 Doações</Text>

      <View style={styles.menu}>
        <TouchableOpacity onPress={() => setTela("form")} style={styles.btn}>
          <Text style={styles.btnText}>Cadastrar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setTela("lista"); sincronizar(); }} style={styles.btn}>
          <Text style={styles.btnText}>Lista</Text>
        </TouchableOpacity>
      </View>

      {tela === "form" && (
        <View style={styles.card}>
          <TextInput placeholder="Nome" value={nome} onChangeText={setNome} style={styles.input} />
          <TextInput placeholder="Produto" value={produto} onChangeText={setProduto} style={styles.input} />
          <TextInput placeholder="Quantidade" value={quantidade} onChangeText={setQuantidade} keyboardType="numeric" style={styles.input} />
          <TextInput placeholder="Usuário" value={usuario} onChangeText={setUsuario} style={styles.input} />
          <TouchableOpacity style={styles.btnPrimary} onPress={registrar}>
            <Text style={styles.btnText}>Registrar</Text>
          </TouchableOpacity>
        </View>
      )}

      {tela === "lista" && (
        <>
          <TouchableOpacity style={styles.btnExport} onPress={gerarPDF}>
            <Text style={styles.btnText}>📄 Exportar para PDF</Text>
          </TouchableOpacity>
        
          <FlatList
            data={dados}
            keyExtractor={(item) => String(item.id_local)}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text>Produto: {item.produto}</Text>
                <Text>Qtd: {item.quantidade}</Text>
                <Text>Usuário: {item.usuario}</Text>
                <Text style={{ color: item.synced ? "green" : "orange", fontStyle: 'italic', marginTop: 5 }}>
                  {item.synced ? "✔ Sincronizado" : "⏳ Pendente de envio"}
                </Text>
                <TouchableOpacity onPress={() => deletarItem(item.id_local)} style={styles.btnDelete}>
                  <Text style={styles.btnText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f5f6fa" },
  header: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 10 },
  menu: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  btn: { backgroundColor: "#3498db", padding: 12, borderRadius: 8, flex: 1, marginHorizontal: 5 },
  btnPrimary: { backgroundColor: "#2ecc71", padding: 15, borderRadius: 8, alignItems: 'center' },
  btnDelete: { backgroundColor: "#e74c3c", padding: 8, marginTop: 10, borderRadius: 6, width: 80, alignSelf: 'flex-end' },
  btnText: { color: "#fff", fontWeight: "bold", textAlign: "center" },
  btnExport: { backgroundColor: "#9b59b6", padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  card: { backgroundColor: "#fff", padding: 20, borderRadius: 10, elevation: 3 },
  input: { borderWidth: 1, borderColor: "#ddd", marginBottom: 10, padding: 10, borderRadius: 8 },
  item: { backgroundColor: "#fff", padding: 15, marginBottom: 10, borderRadius: 8, elevation: 2 },
  nome: { fontWeight: "bold", fontSize: 16 },
});