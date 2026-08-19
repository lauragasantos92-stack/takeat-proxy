// ============================================================
// server.js – Backend Proxy para Takeat
// ============================================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// 🔑 CREDENCIAIS FIXAS (altere aqui para sua conta)
// ============================================================
const DOMAIN = 'https://backend-pdv.takeat.app';
const EMAIL = 'barterapiasalao@gmail.com';   // ← seu e-mail
const PASSWORD = '12345678';          // ← sua senha

let authToken = null;       // token armazenado em memória
let tokenExpiry = null;     // data de expiração estimada

// ============================================================
// Função para autenticar e obter token
// ============================================================
async function authenticate() {
  try {
    const response = await axios.post(`${DOMAIN}/public/api/sessions`, {
      email: EMAIL,
      password: PASSWORD
    });
    authToken = response.data.token;
    // Estima expiração em 14 dias (para renovar antes)
    tokenExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    console.log('✅ Autenticado com sucesso.');
    return authToken;
  } catch (error) {
    console.error('❌ Falha na autenticação:', error.response?.data || error.message);
    throw error;
  }
}

// ============================================================
// Middleware para garantir token válido
// ============================================================
async function ensureToken(req, res, next) {
  if (!authToken || (tokenExpiry && new Date() > tokenExpiry)) {
    await authenticate();
  }
  next();
}

// ============================================================
// Rota principal – retorna os pedidos
// ============================================================
app.get('/api/table-sessions', ensureToken, async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date e end_date são obrigatórios.' });
  }

  try {
    const url = `${DOMAIN}/api/v1/table-sessions?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`;
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expirou – renova e tenta novamente
      console.log('🔄 Token expirado, renovando...');
      await authenticate();
      // Refaz a requisição com o novo token
      const url = `${DOMAIN}/api/v1/table-sessions?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`;
      const retryResponse = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      return res.json(retryResponse.data);
    }
    console.error('Erro ao buscar table-sessions:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Erro ao buscar dados da Takeat.' });
  }
});

// Rota de healthcheck (opcional)
app.get('/health', (req, res) => res.send('OK'));

// ============================================================
// Inicialização do servidor
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Proxy Takeat rodando na porta ${PORT}`);
  // Autentica na inicialização para já ter o token pronto
  try {
    await authenticate();
  } catch (err) {
    console.error('⚠️ Falha na autenticação inicial. Verifique e-mail e senha.');
  }
});