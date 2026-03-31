from flask import Flask, request, jsonify
import psycopg2
import os

app = Flask(__name__)

# 🔗 conexão (usa variável de ambiente ou fallback)
def get_connection():
    return psycopg2.connect(
        os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres.bafyykeccwmyruvqsmnh:Nossasenhoradapaz@aws-1-us-east-2.pooler.supabase.com:6543/postgres"
        )
    )

# 📥 REGISTRAR
@app.route('/registrar', methods=['POST'])
def registrar():
    try:
        data = request.json

        nome = data.get('nome')
        produto = data.get('produto')
        quantidade = float(data.get('quantidade'))
        usuario = data.get('usuario')

        if not nome or not produto or not usuario:
            return jsonify({"erro": "Preencha todos os campos"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO doacoes (nome, produto, quantidade, usuario) VALUES (%s, %s, %s, %s)",
            (nome, produto, quantidade, usuario)
        )

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "ok"})

    except Exception as e:
        print("ERRO REGISTRAR:", str(e))
        return jsonify({"erro": str(e)}), 500


# 🔍 CONSULTAR POR NOME
@app.route('/consultar', methods=['POST'])
def consultar():
    try:
        data = request.json
        nome = data.get('nome')

        if not nome:
            return jsonify({"erro": "Informe o nome"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT id, nome, produto, quantidade, usuario FROM doacoes WHERE LOWER(nome) = LOWER(%s)",
            (nome,)
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        resultado = []
        for r in rows:
            resultado.append({
                "id": r[0],
                "nome": r[1],
                "produto": r[2],
                "quantidade": float(r[3]),
                "usuario": r[4]
            })

        return jsonify(resultado)

    except Exception as e:
        print("ERRO CONSULTAR:", str(e))
        return jsonify({"erro": str(e)}), 500


# 📋 LISTAR TODOS
@app.route('/listar', methods=['GET'])
def listar():
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT id, nome, produto, quantidade, usuario FROM doacoes ORDER BY id DESC"
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        resultado = []
        for r in rows:
            resultado.append({
                "id": r[0],
                "nome": r[1],
                "produto": r[2],
                "quantidade": float(r[3]),
                "usuario": r[4]
            })

        return jsonify(resultado)

    except Exception as e:
        print("ERRO LISTAR:", str(e))
        return jsonify({"erro": str(e)}), 500


# 🗑️ DELETAR
@app.route('/deletar', methods=['POST'])
def deletar():
    try:
        data = request.json
        id = data.get('id')

        if not id:
            return jsonify({"erro": "Informe o ID"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM doacoes WHERE id = %s", (id,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "deletado"})

    except Exception as e:
        print("ERRO DELETAR:", str(e))
        return jsonify({"erro": str(e)}), 500


# ❤️ HEALTH CHECK
@app.route('/health', methods=['GET'])
def health():
    return "ok", 200


# 🚀 START
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
