import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert, ScrollView, RefreshControl
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";

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
    await AsyncStorage.setItem("doacoes_cache", JSON.stringify(lista));
    setDados(lista);
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
    };

    const cache = await AsyncStorage.getItem("doacoes_cache");
    let lista = cache ? JSON.parse(cache) : [];
    lista.push(nova);

    await salvarCache(lista);

    await adicionarFila({
      type: "CREATE",
      data: nova,
    });

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
          await fetch(`${API_URL}/registrar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.data),
          });
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

      if (!res.ok) {
        const txt = await res.text();
        console.log("Erro backend:", txt);
        throw new Error("Erro API");
      }

      const servidor = await res.json();

      const cache = JSON.parse(await AsyncStorage.getItem("doacoes_cache") || "[]");

      const mapa = new Map();

      servidor.forEach(item => {
        mapa.set(item.id_local, { ...item, synced: true });
      });

      cache.forEach(item => {
        if (!item.synced) {
          mapa.set(item.id_local, item);
        }
      });

      const final = Array.from(mapa.values());

      await salvarCache(final);

    } catch (e) {
      Alert.alert("Erro", "Falha ao sincronizar");
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.header}>📦 Doações</Text>

      <View style={styles.menu}>
        <TouchableOpacity onPress={() => setTela("form")} style={styles.btn}>
          <Text style={styles.btnText}>Cadastrar</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setTela("lista")} style={styles.btn}>
          <Text style={styles.btnText}>Lista</Text>
        </TouchableOpacity>
      </View>

      {tela === "form" && (
        <View style={styles.card}>
          <TextInput placeholder="Nome" value={nome} onChangeText={setNome} style={styles.input} />
          <TextInput placeholder="Produto" value={produto} onChangeText={setProduto} style={styles.input} />
          <TextInput placeholder="Quantidade" value={quantidade} onChangeText={setQuantidade} style={styles.input} />
          <TextInput placeholder="Usuário" value={usuario} onChangeText={setUsuario} style={styles.input} />

          <TouchableOpacity style={styles.btnPrimary} onPress={registrar}>
            <Text style={styles.btnText}>Registrar</Text>
          </TouchableOpacity>
        </View>
      )}

      {tela === "lista" && (
        <FlatList
          data={dados}
          keyExtractor={(item) => item.id_local}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.nome}>{item.nome}</Text>
              <Text>{item.produto}</Text>
              <Text>Qtd: {item.quantidade}</Text>
              <Text>{item.usuario}</Text>

              <Text style={{ color: item.synced ? "green" : "orange" }}>
                {item.synced ? "✔ Sincronizado" : "⏳ Pendente"}
              </Text>

              <TouchableOpacity onPress={() => deletarItem(item.id_local)} style={styles.btnDelete}>
                <Text style={styles.btnText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f5f6fa" },
  header: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 10 },
  menu: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  btn: { backgroundColor: "#3498db", padding: 12, borderRadius: 8 },
  btnPrimary: { backgroundColor: "#2ecc71", padding: 15, borderRadius: 8 },
  btnDelete: { backgroundColor: "#e74c3c", padding: 8, marginTop: 10, borderRadius: 6 },
  btnText: { color: "#fff", fontWeight: "bold", textAlign: "center" },
  card: { backgroundColor: "#fff", padding: 20, borderRadius: 10 },
  input: { borderWidth: 1, borderColor: "#ddd", marginBottom: 10, padding: 10, borderRadius: 8 },
  item: { backgroundColor: "#fff", padding: 15, marginBottom: 10, borderRadius: 8 },
  nome: { fontWeight: "bold", fontSize: 16 },
});