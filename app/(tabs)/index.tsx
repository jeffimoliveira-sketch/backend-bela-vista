import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
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

  // =========================
  // 📦 CACHE LOCAL
  // =========================
  const carregarCache = async () => {
    try {
      const cache = await AsyncStorage.getItem("doacoes_cache");
      if (cache) setDados(JSON.parse(cache));
    } catch {}
  };

  const salvarCache = async (lista) => {
    await AsyncStorage.setItem("doacoes_cache", JSON.stringify(lista));
    setDados(lista);
  };

  // =========================
  // 📨 FILA
  // =========================
  const adicionarFila = async (item) => {
    const fila = await AsyncStorage.getItem("queue");
    let lista = fila ? JSON.parse(fila) : [];

    lista.push(item);

    await AsyncStorage.setItem("queue", JSON.stringify(lista));
  };

  // =========================
  // ➕ REGISTRAR (OFFLINE FIRST)
  // =========================
  const registrar = async () => {
    if (!nome || !produto || !quantidade || !usuario) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }

    const novaDoacao = {
      id_local: uuid.v4(),
      nome,
      produto,
      quantidade,
      usuario,
      synced: false,
    };

    // salva local
    const cache = await AsyncStorage.getItem("doacoes_cache");
    let lista = cache ? JSON.parse(cache) : [];

    lista.push(novaDoacao);
    await salvarCache(lista);

    // adiciona na fila
    await adicionarFila({
      type: "CREATE",
      data: novaDoacao,
    });

    Alert.alert("Salvo", "Doação salva offline!");

    setNome("");
    setProduto("");
    setQuantidade("");
    setUsuario("");
  };

  // =========================
  // 🔄 SINCRONIZAÇÃO
  // =========================
  const sincronizar = async () => {
    try {
      const fila = await AsyncStorage.getItem("queue");
      let lista = fila ? JSON.parse(fila) : [];

      if (lista.length === 0) return;

      let novaFila = [];

      for (let item of lista) {
        try {
          if (item.type === "CREATE") {
            await fetch(`${API_URL}/registrar`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.data),
            });
          }
        } catch {
          novaFila.push(item);
        }
      }

      await AsyncStorage.setItem("queue", JSON.stringify(novaFila));

      atualizarSyncLocal();
    } catch {}
  };

  // =========================
  // ✅ MARCAR COMO SINCRONIZADO
  // =========================
  const atualizarSyncLocal = async () => {
    const cache = await AsyncStorage.getItem("doacoes_cache");
    let lista = cache ? JSON.parse(cache) : [];

    lista = lista.map((item) => ({
      ...item,
      synced: true,
    }));

    await salvarCache(lista);
  };

  // =========================
  // 🗑️ DELETAR LOCAL
  // =========================
  const deletarItem = async (id_local) => {
    const cache = await AsyncStorage.getItem("doacoes_cache");
    let lista = cache ? JSON.parse(cache) : [];

    lista = lista.filter((item) => item.id_local !== id_local);

    await salvarCache(lista);

    await adicionarFila({
      type: "DELETE",
      id_local,
    });
  };

  // =========================
  // 🚀 INIT
  // =========================
  useEffect(() => {
    carregarCache();

    const interval = setInterval(() => {
      sincronizar();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // =========================
  // 🎨 UI
  // =========================
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>📦 Controle de Doações</Text>

      {/* MENU */}
      <View style={styles.menu}>
        <TouchableOpacity onPress={() => setTela("form")} style={styles.btn}>
          <Text style={styles.btnText}>Cadastrar</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setTela("lista")} style={styles.btn}>
          <Text style={styles.btnText}>Lista</Text>
        </TouchableOpacity>
      </View>

      {/* FORM */}
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

      {/* LISTA */}
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

              <TouchableOpacity
                style={styles.btnDelete}
                onPress={() => deletarItem(item.id_local)}
              >
                <Text style={styles.btnText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </ScrollView>
  );
}

// =========================
// 🎨 ESTILO
// =========================
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f5f6fa" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },

  menu: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },

  btn: {
    backgroundColor: "#3498db",
    padding: 10,
    borderRadius: 8,
    width: "48%",
    alignItems: "center",
  },

  btnPrimary: {
    backgroundColor: "#2ecc71",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  btnDelete: {
    backgroundColor: "#e74c3c",
    padding: 8,
    marginTop: 5,
    borderRadius: 6,
    alignItems: "center",
  },

  btnText: { color: "#fff", fontWeight: "bold" },

  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },

  item: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },

  nome: { fontWeight: "bold", fontSize: 16 },
});