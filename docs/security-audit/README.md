# Auditoria de segurança — Obra 10

Gera de novo o PDF (venv isolado, sem instalar nada no Python global):

```powershell
cd docs/security-audit
# Python 3.13+ com SSL (evite o 3.14 sem _ssl neste Windows)
C:\Users\User\AppData\Local\Programs\Python\Python313\python.exe -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe gerar_relatorio.py
```

Saída: `relatorio-auditoria-seguranca.pdf`
