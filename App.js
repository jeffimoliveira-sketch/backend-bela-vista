import { useState } from 'react';
import { Text, TextInput, Button, View, Alert } from 'react-native';

const API_URL = "https://backend-bela-vista.onrender.com";

export default function App() {
  const [nome, setNome] = useState('');
  const [produto, setProduto] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [usuario, setUsuario] = useState('');

  const consultar = async () => {
    try {
      const res = await fetch(`${API_URL}/consultar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });

      const data = await res.json();

      if (data.length > 0) {
        Alert.alert("Atenção", "Doador já registrado!");
      } else {
        Alert.alert("OK", "Sem registro");
      }

    } catch {
      Alert.alert("Erro", "Sem conexão");
    }
  };

  const registrar = async () => {
    try {
      await fetch(`${API_URL}/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          produto,
          quantidade: parseFloat(quantidade),
          usuario
        })
      });

      Alert.alert("Sucesso", "Registrado!");
    } catch {
      Alert.alert("Erro", "Falha ao registrar");
    }
  };

  return (
    <View style={{ padding: 30 }}>
      <Text>Usuário</Text>
      <TextInput onChangeText={setUsuario} style={{ borderWidth: 1, marginBottom: 10 }} />

      <Text>Nome</Text>
      <TextInput onChangeText={setNome} style={{ borderWidth: 1, marginBottom: 10 }} />

      <Text>Produto</Text>
      <TextInput onChangeText={setProduto} style={{ borderWidth: 1, marginBottom: 10 }} />

      <Text>Quantidade</Text>
      <TextInput onChangeText={setQuantidade} keyboardType="numeric" style={{ borderWidth: 1, marginBottom: 10 }} />

      <Button title="Consultar" onPress={() => alert("clicou")} />
      <Button title="Registrar" onPress={registrar} />
    </View>
  );
}