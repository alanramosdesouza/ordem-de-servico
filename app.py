"""Python API for the Ordem de Serviço project."""

from flask import Flask, jsonify, request

from db import get_connection


app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    # The legacy frontend is served by Apache/XAMPP on a different local port.
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.get("/api/solicitacoes")
def listar_solicitacoes():
    """List requests, optionally filtered by department, priority, status, or text."""
    filtros = {
        "categoria": request.args.get("categoria", "").strip(),
        "prioridade": request.args.get("prioridade", "").strip(),
        "status": request.args.get("status", "").strip(),
        "busca": request.args.get("busca", "").strip(),
    }

    sql = "SELECT * FROM solicitacoes WHERE 1=1"
    parametros = []

    if filtros["categoria"]:
        sql += " AND departamento = %s"
        parametros.append(filtros["categoria"])
    if filtros["prioridade"]:
        sql += " AND prioridade = %s"
        parametros.append(filtros["prioridade"])
    if filtros["status"] and filtros["status"] != "Todos status":
        sql += " AND status = %s"
        parametros.append(filtros["status"])
    if filtros["busca"]:
        sql += " AND (descricao LIKE %s OR tipo LIKE %s)"
        termo = f"%{filtros['busca']}%"
        parametros.extend((termo, termo))

    sql += " ORDER BY data_criacao DESC"

    conexao = None
    cursor = None
    try:
        conexao = get_connection()
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(sql, parametros)
        solicitacoes = cursor.fetchall()
        return jsonify(solicitacoes)
    except Exception:
        app.logger.exception("Falha ao listar solicitações")
        return jsonify({"success": False, "error": "Não foi possível carregar as solicitações."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if conexao is not None and conexao.is_connected():
            conexao.close()




@app.post("/api/solicitacoes")
def criar_solicitacao():
    dados = request.get_json(silent=True) or {}
    departamento = str(dados.get("departamento", "")).strip()
    tipo = str(dados.get("tipo", "")).strip()
    prioridade = str(dados.get("prioridade", "")).strip().lower()
    descricao = str(dados.get("descricao", "")).strip()

    if not all((departamento, tipo, prioridade, descricao)):
        return jsonify({"success": False, "error": "Preencha todos os campos da solicitação."}), 400
    if prioridade not in ("baixa", "media", "alta"):
        return jsonify({"success": False, "error": "Prioridade inválida."}), 400

    conexao = None
    cursor = None
    try:
        conexao = get_connection()
        cursor = conexao.cursor()
        cursor.execute(
            "INSERT INTO solicitacoes (departamento, tipo, prioridade, descricao, status) "
            "VALUES (%s, %s, %s, %s, 'Aberta')",
            (departamento, tipo, prioridade, descricao),
        )
        conexao.commit()
        return jsonify({"success": True, "id": cursor.lastrowid}), 201
    except Exception:
        app.logger.exception("Falha ao criar solicitação")
        return jsonify({"success": False, "error": "Não foi possível salvar a solicitação."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if conexao is not None and conexao.is_connected():
            conexao.close()


@app.put("/api/solicitacoes")
def atualizar_solicitacao():
    dados = request.get_json(silent=True) or {}
    try:
        id_solicitacao = int(dados.get("id"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Identificador inválido."}), 400

    status = str(dados.get("status", "")).strip()
    if status not in ("Aberta", "Em andamento", "Concluída"):
        return jsonify({"success": False, "error": "Status inválido."}), 400

    conexao = None
    cursor = None
    try:
        conexao = get_connection()
        cursor = conexao.cursor()
        cursor.execute("UPDATE solicitacoes SET status = %s WHERE id = %s", (status, id_solicitacao))
        if cursor.rowcount == 0:
            return jsonify({"success": False, "error": "Solicitação não encontrada."}), 404
        conexao.commit()
        return jsonify({"success": True})
    except Exception:
        app.logger.exception("Falha ao atualizar solicitação")
        return jsonify({"success": False, "error": "Não foi possível atualizar a solicitação."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if conexao is not None and conexao.is_connected():
            conexao.close()


@app.delete("/api/solicitacoes")
def excluir_solicitacao():
    dados = request.get_json(silent=True) or {}
    try:
        id_solicitacao = int(dados.get("id"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Identificador inválido."}), 400

    conexao = None
    cursor = None
    try:
        conexao = get_connection()
        cursor = conexao.cursor()
        cursor.execute("DELETE FROM solicitacoes WHERE id = %s", (id_solicitacao,))
        if cursor.rowcount == 0:
            return jsonify({"success": False, "error": "Solicitação não encontrada."}), 404
        conexao.commit()
        return jsonify({"success": True})
    except Exception:
        app.logger.exception("Falha ao excluir solicitação")
        return jsonify({"success": False, "error": "Não foi possível excluir a solicitação."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if conexao is not None and conexao.is_connected():
            conexao.close()

@app.get("/api/dashboard")
def obter_dashboard():
    """Retorna indicadores agregados para o painel da aplicação."""
    consultas = {
        "resumo": """
            SELECT COUNT(*) AS total,
                   SUM(status = 'Aberta') AS abertas,
                   SUM(status = 'Em andamento') AS em_andamento,
                   SUM(status = 'Concluída') AS concluidas
            FROM solicitacoes
        """,
        "departamentos": """
            SELECT departamento AS nome, COUNT(*) AS total
            FROM solicitacoes GROUP BY departamento
            ORDER BY total DESC, nome
        """,
        "prioridades": """
            SELECT prioridade AS nome, COUNT(*) AS total
            FROM solicitacoes GROUP BY prioridade
            ORDER BY FIELD(prioridade, 'alta', 'media', 'baixa')
        """,
        "ultimos_meses": """
            SELECT DATE_FORMAT(data_criacao, '%Y-%m') AS mes, COUNT(*) AS total
            FROM solicitacoes
            WHERE data_criacao >= CAST(DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01') AS DATE)
            GROUP BY DATE_FORMAT(data_criacao, '%Y-%m')
            ORDER BY mes
        """,
    }

    conexao = None
    cursor = None
    try:
        conexao = get_connection()
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(consultas["resumo"])
        resumo = cursor.fetchone() or {}
        dados = {"resumo": {chave: int(valor or 0) for chave, valor in resumo.items()}}

        for chave in ("departamentos", "prioridades", "ultimos_meses"):
            cursor.execute(consultas[chave])
            dados[chave] = [
                {campo: int(valor or 0) if campo == "total" else valor
                 for campo, valor in linha.items()}
                for linha in cursor.fetchall()
            ]

        return jsonify(dados)
    except Exception:
        app.logger.exception("Falha ao carregar o dashboard")
        return jsonify({"success": False, "error": "Não foi possível carregar o dashboard."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if conexao is not None and conexao.is_connected():
            conexao.close()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5002, debug=False)
