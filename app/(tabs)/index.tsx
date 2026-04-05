import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl, // Importa o RefreshControl
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
  const [refreshing, setRefreshing] = useState(false); // Estado para o "Pull-to-Refresh"

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
      id_local: uuid.v4(), // ID único local
      nome,
      produto,
      quantidade,
      usuario,
      synced: false, // Começa como não sincronizado
    };

    const cache = await AsyncStorage.getItem("doacoes_cache");
    let lista = cache ? JSON.parse(cache) : [];
    lista.push(novaDoacao);
    await salvarCache(lista);

    await adicionarFila({
      type: "CREATE",
      data: novaDoacao,
    });

    Alert.alert("Salvo", "Doação salva offline!");
    setNome("");
    setProduto("");
    setQuantidade("");
    setUsuario("");
    sincronizar(); // Tenta sincronizar imediatamente após salvar
  };

   // =========================
  // 🔄 SINCRONIZAÇÃO (VERSÃO CORRIGIDA)
  // =========================
  const sincronizar = async () => {
    console.log("Iniciando sincronização...");
    
    // Passo 1: Enviar itens pendentes da fila (Upload)
    try {
      const fila = await AsyncStorage.getItem("queue");
      let listaFila = fila ? JSON.parse(fila) : [];

      if (listaFila.length > 0) {
        console.log(`Enviando ${listaFila.length} itens da fila...`);
        let novaFila = [];
        for (const item of listaFila) {
          try {
            if (item.type === "CREATE") {
              const response = await fetch(`${API_URL}/registrar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item.data),
              });
              if (!response.ok) throw new Error("Falha no servidor ao registrar");
            }
            // Adicionar lógica para "DELETE" se necessário
          } catch (e) {
            console.error("Falha ao enviar item da fila, mantendo para próxima tentativa.", e);
            novaFila.push(item);
          }
        }
        await AsyncStorage.setItem("queue", JSON.stringify(novaFila));
      } else {
        console.log("Fila de envio vazia.");
      }
    } catch (e) {
      console.error("Erro no processo de upload:", e);
    }

    // Passo 2: Baixar todos os dados do servidor e mesclar (Download)
    // Isso acontece independentemente de a fila estar cheia ou vazia.
    await baixarDadosDoServidor();
    console.log("Sincronização concluída.");
  };

  // =========================
  // ☁️ BAIXAR E MESCLAR DADOS (LÓGICA FUNDAMENTAL)
  // =========================
  const baixarDadosDoServidor = async () => {
    try {
      console.log("Baixando dados do servidor...");
      const response = await fetch(`${API_URL}/doacoes`); // Rota GET que retorna todas as doações
      if (!response.ok) throw new Error("Não foi possível buscar dados do servidor.");

      const dadosDoServidor = await response.json();
      console.log(`Encontrados ${dadosDoServidor.length} registros no servidor.`);

      const cache = await AsyncStorage.getItem("doacoes_cache");
      const dadosLocais = cache ? JSON.parse(cache) : [];

      // Itens que foram criados offline e ainda não foram enviados
      const itensPendentes = dadosLocais.filter(item => !item.synced);
      console.log(`Encontrados ${itensPendentes.length} itens pendentes localmente.`);

      // Cria um mapa para mesclagem eficiente, priorizando dados do servidor
      const dadosMapeados = new Map();

      // Adiciona primeiro os dados do servidor, garantindo que estão marcados como synced
      dadosDoServidor.forEach(item => {
        // Usa o 'id_local' se ele vier do servidor, senão cria um novo.
        // O ideal é que o servidor retorne o id_local que foi enviado.
        const idLocal = item.id_local || item.id; // Adapte para o ID que seu servidor retorna
        dadosMapeados.set(idLocal, { ...item, id_local: idLocal, synced: true });
      });

      // Adiciona/sobrescreve com os itens pendentes locais (eles têm prioridade sobre a versão do servidor
      // até que sejam enviados com sucesso)
      itensPendentes.forEach(item => {
        dadosMapeados.set(item.id_local, item);
      });

      const listaFinal = Array.from(dadosMapeados.values());
      console.log(`Lista final mesclada com ${listaFinal.length} itens.`);

      // Salva a lista final e atualizada no cache, o que vai atualizar a UI
      await salvarCache(listaFinal);

    } catch (e) {
      console.error("Erro ao baixar/mesclar dados:", e);
      Alert.alert("Offline", "Não foi possível buscar os dados mais recentes. Verifique sua conexão.");
    }
  };

  // =========================
  // 🗑️ DELETAR LOCAL (Simplificado por enquanto)
  // =========================
  const deletarItem = async (id_local) => {
    const cache = await AsyncStorage.getItem("doacoes_cache");
    let lista = cache ? JSON.parse(cache) : [];
    lista = lista.filter((item) => item.id_local !== id_local);
    await salvarCache(lista);
    // Lógica para adicionar à fila de DELETE pode ser adicionada aqui
  };

  // =========================
  // 🚀 PULL TO REFRESH
  // =========================
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    sincronizar().then(() => {
      setRefreshing(false);
      Alert.alert("Sincronizado", "Lista atualizada!");
    });
  }, []);

  // =========================
  // 🚀 INIT
  // =========================
  useEffect(() => {
    carregarCache();
    sincronizar(); // Sincroniza uma vez ao iniciar o app

    const interval = setInterval(() => {
      sincronizar();
    }, 30000); // Aumentei o intervalo para 30 segundos para economizar bateria/dados

    return () => clearInterval(interval);
  }, []);

  // =========================
  // 🎨 UI
  // =========================
  return (
    <ScrollView 
      style={styles.container}
      // Adicionando o Pull-to-Refresh ao ScrollView principal
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.header}>📦 Controle de Doações</Text>

      {/* ... O resto do seu código da UI permanece o mesmo ... */}
      
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
          // FlatList não usa RefreshControl diretamente no ScrollView principal
        />
      )}
    </ScrollView>
  );
}
//... (seus estilos)
// =========================
// 🎨 ESTILO
// =========================
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f5f6fa" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 10, textAlign: 'center' },

  menu: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },

  btn: {
    backgroundColor: "#3498db",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },

  btnPrimary: {
    backgroundColor: "#2ecc71",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },

  btnDelete: {
    backgroundColor: "#e74c3c",
    padding: 8,
    marginTop: 10,
    borderRadius: 6,
    alignItems: "center",
    width: 80,
    alignSelf: 'flex-end',
  },

  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
  },

  item: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },

  nome: { fontWeight: "bold", fontSize: 18, marginBottom: 5 },
});