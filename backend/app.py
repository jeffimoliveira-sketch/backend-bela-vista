from flask import Flask, request, jsonify
import psycopg2
import os

app = Flask(__name__)

# 🔗 conexão
def get_connection():
    return psycopg2.connect(
        os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres.bafyykeccwmyruvqsmnh:Nossasenhoradapaz@aws-1-us-east-2.pooler.supabase.com:6543/postgres"
        )
    )

# =========================
# 📥 REGISTRAR (COM id_local)
# =========================
@app.route('/registrar', methods=['POST'])
def registrar():
    try:
        data = request.json

        nome = data.get('nome')
        produto = data.get('produto')
        quantidade = float(data.get('quantidade'))
        usuario = data.get('usuario')
        id_local = data.get('id_local')

        if not nome or not produto or not usuario or not id_local:
            return jsonify({"erro": "Campos obrigatórios faltando"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO doacoes (nome, produto, quantidade, usuario, id_local, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id_local) DO NOTHING
            RETURNING id, id_local
        """, (nome, produto, quantidade, usuario, id_local))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "ok"})

    except Exception as e:
        print("ERRO REGISTRAR:", str(e))
        return jsonify({"erro": str(e)}), 500


# =========================
# 📋 LISTAR
# =========================
@app.route('/doacoes', methods=['GET'])
def listar_doacoes():
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, id_local, nome, produto, quantidade, usuario, created_at, updated_at
            FROM doacoes
            WHERE deleted IS NOT TRUE
            ORDER BY created_at DESC
        """)

        rows = cur.fetchall()

        cur.close()
        conn.close()

        resultado = []
        for r in rows:
            resultado.append({
                "id": r[0],
                "id_local": str(r[1]),
                "nome": r[2],
                "produto": r[3],
                "quantidade": int(r[4]),
                "usuario": r[5],
                "created_at": r[6],
                "updated_at": r[7]
            })

        return jsonify(resultado)

    except Exception as e:
        print("ERRO LISTAR:", str(e))
        return jsonify({"erro": str(e)}), 500


# =========================
# 🗑️ DELETE LÓGICO
# =========================
@app.route('/deletar', methods=['POST'])
def deletar():
    try:
        data = request.json
        id_local = data.get('id_local')

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE doacoes
            SET deleted = TRUE, updated_at = NOW()
            WHERE id_local = %s
        """, (id_local,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "ok"})

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


# =========================
# ❤️ HEALTH
# =========================
@app.route('/health', methods=['GET'])
def health():
    return "ok", 200


# =========================
# 🚀 START
# =========================
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
