from flask import Flask, request, jsonify
import psycopg2

app = Flask(__name__)

# conexão com supabase
conn = psycopg2.connect(
    host="db.bafyykeccwmyruvqsmnh.supabase.co",
    database="postgres",
    user="postgres",
    password="Nossasenhoradapaz",
    port="5432"
)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/registrar', methods=['POST'])
def registrar():
    data = request.json

    nome = data.get('nome')
    produto = data.get('produto')
    quantidade = data.get('quantidade')
    usuario = data.get('usuario')

    cur = conn.cursor()
    cur.execute(
        "INSERT INTO doacoes (nome, produto, quantidade, usuario) VALUES (%s, %s, %s, %s)",
        (nome, produto, quantidade, usuario)
    )
    conn.commit()
    cur.close()

    return jsonify({"msg": "salvo com sucesso"})

@app.route('/consultar', methods=['POST'])
def consultar():
    data = request.json
    nome = data.get('nome')

    cur = conn.cursor()
    cur.execute(
        "SELECT nome, produto, quantidade, usuario, data FROM doacoes WHERE nome = %s",
        (nome,)
    )

    rows = cur.fetchall()
    cur.close()

    resultado = []
    for r in rows:
        resultado.append({
            "nome": r[0],
            "produto": r[1],
            "quantidade": float(r[2]),
            "usuario": r[3],
            "data": str(r[4])
        })

    return jsonify(resultado)

if __name__ == '__main__':
    app.run()
