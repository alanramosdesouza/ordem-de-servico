<?php
// api.php - Versão com debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

try {
    // Teste se o arquivo de conexão existe
    if (!file_exists('db_conexao.php')) {
        throw new Exception("Arquivo db_conexao.php não encontrado!");
    }
    
    require_once 'db_conexao.php';
    
    // Teste se a variável $conn existe
    if (!isset($conn)) {
        throw new Exception("Variável \$conn não definida no db_conexao.php");
    }
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch($method) {
        case 'GET':
            // Pega os filtros da URL (se não existirem, ficam vazios)
            $categoria = $_GET['categoria'] ?? '';
            $prioridade = $_GET['prioridade'] ?? '';
            $status = $_GET['status'] ?? '';
            $busca = $_GET['busca'] ?? '';

            // Base da consulta
            $sql = "SELECT * FROM solicitacoes WHERE 1=1";
            $params = [];

            // Adiciona filtros apenas se o usuário selecionou algo
            if ($categoria) {
                $sql .= " AND departamento = :cat";
                $params[':cat'] = $categoria;
            }
            if ($prioridade) {
                $sql .= " AND prioridade = :prio";
                $params[':prio'] = $prioridade;
            }
            if ($status && $status !== "Todos status") {
                $sql .= " AND status = :stat";
                $params[':stat'] = $status;
            }
            if ($busca) {
                $sql .= " AND (descricao LIKE :busca OR tipo LIKE :busca)";
                $params[':busca'] = "%$busca%";
            }

            $sql .= " ORDER BY data_criacao DESC";

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            // No api.php, dentro do case 'GET':
            $resultados = $stmt->fetchAll(PDO::FETCH_ASSOC);
            error_log(print_r($resultados, true)); // Isso envia para o log do servidor
            echo json_encode($resultados);
            exit; // Adicione este exit aqui para garantir que nada mais seja impresso
            break;
            
        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!$data) {
                throw new Exception("Dados JSON inválidos");
            }
            
            $sql = "INSERT INTO solicitacoes (departamento, tipo, prioridade, descricao, status) 
                    VALUES (:departamento, :tipo, :prioridade, :descricao, 'Aberta')";
            
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':departamento' => $data['departamento'],
                ':tipo' => $data['tipo'],
                ':prioridade' => $data['prioridade'],
                ':descricao' => $data['descricao']
            ]);
            
            echo json_encode([
                'success' => true, 
                'id' => $conn->lastInsertId(),
                'message' => 'Inserido com sucesso'
            ]);
            break;

        case 'PUT':
            $data = json_decode(file_get_contents('php://input'), true);
            $sql = "UPDATE solicitacoes SET status = :status WHERE id = :id";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':status' => $data['status'],
                ':id'     => $data['id']
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            $data = json_decode(file_get_contents('php://input'), true);
            $sql = "DELETE FROM solicitacoes WHERE id = :id";
            $stmt = $conn->prepare($sql);
            $stmt->execute([':id' => $data['id']]);
            echo json_encode(['success' => true]);
            break;
            
        default:
            echo json_encode(['error' => 'Método não suportado']);
            break;
    }
    
} catch(Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
?>