<?php
$host = 'seu-host-aqui'; 
$user = 'seu-usuario-aqui';      
$password = 'sua-senha-aqui';
$dbname = 'seu-banco-de-dados-aqui';

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    exit("Erro Real: " . $e->getMessage());
}
?>