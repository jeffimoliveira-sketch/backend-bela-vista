from flask import Flask, request, jsonify
import psycopg2
import os
from datetime import datetime

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
# 📥 REGISTRAR
# =========================
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

        cur.execute("""
            INSERT INTO doacoes (nome, produto, quantidade, usuario, created_at, updated_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            RETURNING id
        """, (nome, produto, quantidade, usuario))

        new_id = cur.fetchone()[0]

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"id": new_id, "status": "ok"})

    except Exception as e:
        print("ERRO REGISTRAR:", str(e))
        return jsonify({"erro": str(e)}), 500


# =========================
# 📋 LISTAR TODAS (NOVO PADRÃO)
# =========================
@app.route('/doacoes', methods=['GET'])
def listar_doacoes():
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, nome, produto, quantidade, usuario, created_at, updated_at
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
                "nome": r[1],
                "produto": r[2],
                "quantidade": float(r[3]),
                "usuario": r[4],
                "created_at": r[5],
                "updated_at": r[6]
            })

        return jsonify(resultado)

    except Exception as e:
        print("ERRO LISTAR:", str(e))
        return jsonify({"erro": str(e)}), 500


# =========================
# 🔄 SINCRONIZAÇÃO INCREMENTAL (ESSENCIAL)
# =========================
@app.route('/sync', methods=['GET'])
def sync():
    try:
        updated_after = request.args.get('updated_after')

        conn = get_connection()
        cur = conn.cursor()

        if updated_after:
            cur.execute("""
                SELECT id, nome, produto, quantidade, usuario, created_at, updated_at, deleted
                FROM doacoes
                WHERE updated_at > %s
                ORDER BY updated_at ASC
            """, (updated_after,))
        else:
            cur.execute("""
                SELECT id, nome, produto, quantidade, usuario, created_at, updated_at, deleted
                FROM doacoes
                ORDER BY updated_at ASC
            """)

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
                "usuario": r[4],
                "created_at": r[5],
                "updated_at": r[6],
                "deleted": r[7]
            })

        return jsonify(resultado)

    except Exception as e:
        print("ERRO SYNC:", str(e))
        return jsonify({"erro": str(e)}), 500


# =========================
# ✏️ UPDATE
# =========================
@app.route('/atualizar', methods=['POST'])
def atualizar():
    try:
        data = request.json
        id = data.get('id')

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE doacoes
            SET nome=%s, produto=%s, quantidade=%s, usuario=%s, updated_at=NOW()
            WHERE id=%s
        """, (
            data.get('nome'),
            data.get('produto'),
            float(data.get('quantidade')),
            data.get('usuario'),
            id
        ))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "atualizado"})

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


# =========================
# 🗑️ DELETE LÓGICO (CORRIGIDO)
# =========================
@app.route('/deletar', methods=['POST'])
def deletar():
    try:
        data = request.json
        id = data.get('id')

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE doacoes
            SET deleted = TRUE, updated_at = NOW()
            WHERE id = %s
        """, (id,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "deletado (soft)"})

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
