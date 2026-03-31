from flask import Flask, request, jsonify
import psycopg2

app = Flask(__name__)

# conexão com supabase
conn = psycopg2.connect(
    "postgresql://postgres.bafyykeccwmyruvqsmnh:Nossasenhoradapaz@aws-1-us-east-2.pooler.supabase.com:6543/postgres"
)

@app.route('/consultar', methods=['POST'])
def consultar():
    data = request.json
    nome = data.get('nome')

    print("CONSULTANDO:", nome)

    cur = conn.cursor()
    cur.execute(
        "SELECT nome, produto, quantidade, usuario, data FROM doacoes WHERE LOWER(nome) = LOWER(%s)",
        (nome,)
    )

    rows = cur.fetchall()
    print("RESULTADO:", rows)

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

@app.route('/consultar', methods=['POST'])
def consultar():
    data = request.json
    nome = data.get('nome')

    cur = conn.cursor()
    cur.execute(
    "SELECT nome, produto, quantidade, usuario, data FROM doacoes WHERE LOWER(nome) = LOWER(%s)",
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

import os

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
