# Manual de Segurança da Infraestrutura e Banco de Dados (Obra 10)

Este documento dita as normas operacionais para escalar a aplicação Obra 10 em ambientes Linux de Produção, assegurando confidencialidade total e princípio do Menor Privilégio (PoLP).

## 1. Isolamento do Banco de Dados (Network Layer)
Nunca, em hipótese alguma, exponha o banco estático `PostgreSQL` (Ex: porta 5432) para a internet externa (`0.0.0.0`).
- **Dev/Staging:** Apenas acessível pelo contêiner do Docker em rede local.
- **Produção (AWS/GCP):** O banco de dados deve pertencer a uma **Sub-Rede Privada**. 
- Apenas a Máquina Hospedeira da API Node/NestJS tem autorização (VPC Peering/Security Groups) para conectar ao banco de dados interno.

## 2. Privilégio Mínimo (Database User)
A String de Conexão inserida no arquivo `.env` da API (`DATABASE_URL`) NÃO DEVE possuir credenciais root (Ex: O usuário Master da AWS RDS).
- Crie um Database User específico para a aplicação web, ex: `obra10_api_worker`.
- Este usuário sofrerá restrições para executar Data Definitions genéricas desnecessárias e será dono estrito das tabelas da arquitetura.
- **Rotação de Credenciais:** Renove a senha desse trabalhador invisível a cada 90 dias através de AWS Secrets Manager ou equivalentes.

## 3. Backups e Criptografia At-Rest
Todos os volumes do SGDB (Seja EBS ou Cloud RDS) precisam ser instanciados com flags rígidas de **Encryption At-Rest**. 
- **Snapshot Automático:** Manter cronjobs na infraestrutura executando Backups Diários incrementais e armazenando snapshots durante uma janela de retenção flexível (35 dias).

## 4. Auditoria Contínua Front-to-Back
Para mitigar a vulnerabilidade estrutural das bibliotecas JavaScript (`npm`), deve-se aplicar varreduras CI/CD em todas as esteiras garantindo a eliminação de exploits antes dos Deploys:
`npm audit --production && npm ci`
Qualquer dependência transitiva contaminada deve barrar a subida de produção. O NestJS agora intercepta, via Logger Global, os picos de tráfego, mitigando tentativas de DDoS e Brute-forcing. O Admin da rede pode drenar o Console STDOut pra ferramentas de leitura DataDog/NewRelic e estabelecer alarmes sobre Picos de Erros **403**.
