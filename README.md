# Sistema de Requisições Internas

Aplicação do Projeto Integrador para registrar e acompanhar solicitações internas do hotel. O frontend usa HTML, CSS e JavaScript; listagem, cadastro, atualização, exclusão e dashboard usam a API Python/Flask.

## Executar localmente

1. Inicie o MySQL pelo XAMPP. Neste ambiente local, o banco usado pelo projeto é `hotel_univesp`, com a tabela `solicitacoes`.
2. Instale as dependências Python:

   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. A API prefere `.env.local` se existir; caso contrário, usa `.env`. Cada integrante pode manter sua própria configuração local. Os arquivos com credenciais são ignorados pelo Git.
4. Inicie a API com `python app.py` e sirva o frontend pelo Apache do XAMPP ou com:

   ```powershell
   python -m http.server 8001 --bind 127.0.0.1
   ```

5. Abra `http://127.0.0.1:8001/index.html`. A API local usa a porta 5002.

## Dashboard

O painel apresenta totais por status, departamento e prioridade, além da evolução mensal das solicitações nos últimos seis meses. Os indicadores vêm de `GET /api/dashboard`.
