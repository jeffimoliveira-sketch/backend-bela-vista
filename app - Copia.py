from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/consultar', methods=['POST'])
def consultar():
    data = request.json
    nome = data.get('nome')
    return jsonify([])

@app.route('/registrar', methods=['POST'])
def registrar():
    data = request.json
    return jsonify({"msg": "salvo com sucesso"})

if __name__ == '__main__':
    app.run()
