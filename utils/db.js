const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database.sqlite'));

// ====================================================
// CONFIGURAÇÃO: MODO WAL (Performance/Anti-Travamento)
// ====================================================
db.pragma('journal_mode = WAL');

// ====================================================
// 1. ESTRUTURA E MIGRAÇÃO DAS TABELAS
// ====================================================

// Tabelas de Premium e Configurações
try { db.exec(`CREATE TABLE IF NOT EXISTS server_premium (guildId TEXT PRIMARY KEY, expiresAt INTEGER);`); } catch (err) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`); } catch (err) {}

// Tabela de Usuários (com atualizações de colunas)
try { 
    db.exec(`CREATE TABLE IF NOT EXISTS users (
        discordId TEXT PRIMARY KEY, 
        nomeRp TEXT, 
        passaporte TEXT, 
        indicado TEXT, 
        status TEXT, 
        dataRegistro TEXT,
        vitorias INTEGER DEFAULT 0,
        derrotas INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        perm_level INTEGER DEFAULT 1
    );`);
} catch (err) {}
try { db.exec(`ALTER TABLE users ADD COLUMN perm_level INTEGER DEFAULT 1`); } catch (err) {}

// Tabela de Ações (PVP)
try { 
    db.exec(`CREATE TABLE IF NOT EXISTS acoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        criadorId TEXT, 
        nome TEXT, 
        vagas INTEGER, 
        horario TEXT, 
        participantes TEXT DEFAULT '[]', 
        avisoEnviado INTEGER DEFAULT 0, 
        timestamp INTEGER, 
        finalizada INTEGER DEFAULT 0, 
        mensagemId TEXT, 
        canalId TEXT, 
        mundo TEXT
    );`);
} catch (err) {}
try { db.exec(`ALTER TABLE acoes ADD COLUMN mundo TEXT`); } catch (err) {}

// Tabela de Logs de Baú
try { 
    db.exec(`CREATE TABLE IF NOT EXISTS chest_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        passaporte TEXT, 
        nome TEXT, 
        acao TEXT, 
        item TEXT, 
        quantidade INTEGER, 
        bau TEXT, 
        dataOriginal TEXT, 
        timestamp INTEGER, 
        originChannelId TEXT
    );`); 
} catch (err) {}
try { db.exec(`ALTER TABLE chest_logs ADD COLUMN originChannelId TEXT`); } catch (err) {}

// Tabela de Regras de Aviso (Monitoramento)
try { db.exec(`CREATE TABLE IF NOT EXISTS warning_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT, type TEXT, value TEXT, extra TEXT);`); } catch (err) {}

// Tabela de Ausências
try { 
    db.exec(`CREATE TABLE IF NOT EXISTS ausencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        discordId TEXT, 
        nomeRp TEXT, 
        dataVolta TEXT, 
        motivo TEXT, 
        status TEXT DEFAULT 'pendente',
        msgAprovacaoId TEXT,
        timestamp INTEGER
    );`); 
} catch (err) {}

// Outras Tabelas (Ponto, Vendas, Farm)
db.exec(`CREATE TABLE IF NOT EXISTS ponto_ativo (discordId TEXT PRIMARY KEY, startTime INTEGER);`);
db.exec(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price_normal TEXT, price_partner TEXT);`);
db.exec(`CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, discordId TEXT, productName TEXT, quantity INTEGER, totalValue REAL, sellerValue REAL, isPartner INTEGER, date TEXT);`);
db.exec(`CREATE TABLE IF NOT EXISTS farm_channels (channelId TEXT PRIMARY KEY, userId TEXT, metaPeriod TEXT, metaDesc TEXT, metaQty TEXT, metaType TEXT, createdAt TEXT);`);
db.exec(`CREATE TABLE IF NOT EXISTS farm_metas (id INTEGER PRIMARY KEY AUTOINCREMENT, metaDesc TEXT, metaQty TEXT, metaType TEXT);`);


// ====================================================
// 2. FUNÇÕES DE SISTEMA
// ====================================================

// --- Configuração e Premium ---
function definirPremium(guildId, expiresAt) {
    db.prepare('INSERT OR REPLACE INTO server_premium (guildId, expiresAt) VALUES (?, ?)').run(guildId, expiresAt);
}

function checkPremium(guildId) {
    const dados = db.prepare('SELECT * FROM server_premium WHERE guildId = ?').get(guildId);
    if (!dados) return false;
    if (Date.now() > dados.expiresAt) {
        db.prepare('DELETE FROM server_premium WHERE guildId = ?').run(guildId);
        return false;
    }
    return true;
}

function getPremiumData(guildId) {
    return db.prepare('SELECT * FROM server_premium WHERE guildId = ?').get(guildId);
}

function setConfig(key, value) { db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value); }
function getConfig(key) { const d = db.prepare('SELECT value FROM settings WHERE key = ?').get(key); return d ? d.value : null; }

// --- Usuários ---
function salvarUsuario(d) { 
    const existe = db.prepare('SELECT perm_level FROM users WHERE discordId = ?').get(d.discordId);
    if (!existe) d.perm_level = 1;
    if(!d.dataRegistro) d.dataRegistro = new Date().toISOString();
    
    const sql = `INSERT OR REPLACE INTO users (discordId, nomeRp, passaporte, indicado, status, dataRegistro, vitorias, derrotas, kills, perm_level) 
                 VALUES (@discordId, @nomeRp, @passaporte, @indicado, @status, @dataRegistro, 
                 COALESCE((SELECT vitorias FROM users WHERE discordId=@discordId), 0),
                 COALESCE((SELECT derrotas FROM users WHERE discordId=@discordId), 0),
                 COALESCE((SELECT kills FROM users WHERE discordId=@discordId), 0),
                 COALESCE((SELECT perm_level FROM users WHERE discordId=@discordId), 1))`;
    db.prepare(sql).run(d); 
}

function buscarUsuario(id) { return db.prepare('SELECT * FROM users WHERE discordId = ?').get(id); }
function buscarUsuarioPorPassaporte(passaporte) { return db.prepare('SELECT * FROM users WHERE passaporte = ?').get(passaporte); }

function listarTodosUsuarios() { 
    return db.prepare('SELECT * FROM users ORDER BY perm_level DESC, nomeRp ASC').all(); 
}

function atualizarPermissao(discordId, novoNivel) { db.prepare('UPDATE users SET perm_level = ? WHERE discordId = ?').run(novoNivel, discordId); }

function deletarUsuario(discordId) {
    db.prepare('DELETE FROM users WHERE discordId = ?').run(discordId);
    db.prepare('DELETE FROM ponto_ativo WHERE discordId = ?').run(discordId);
    db.prepare('DELETE FROM farm_channels WHERE userId = ?').run(discordId);
}

// --- Ponto ---
function iniciarPonto(id) { db.prepare('INSERT OR REPLACE INTO ponto_ativo (discordId, startTime) VALUES (?, ?)').run(id, Math.floor(Date.now()/1000)); }
function finalizarPonto(id) { const p = db.prepare('SELECT * FROM ponto_ativo WHERE discordId = ?').get(id); if(p) db.prepare('DELETE FROM ponto_ativo WHERE discordId = ?').run(id); return p ? p.startTime : null; }
function checarPonto(id) { return db.prepare('SELECT * FROM ponto_ativo WHERE discordId = ?').get(id); }
function listarPontos() { return db.prepare('SELECT * FROM ponto_ativo ORDER BY startTime ASC').all(); }

// --- Vendas ---
function criarProduto(n, pn, pp) { db.prepare('INSERT INTO products (name, price_normal, price_partner) VALUES (?, ?, ?)').run(n, pn, pp); }
function deletarProduto(id) { db.prepare('DELETE FROM products WHERE id = ?').run(id); }
function listarProdutos() { return db.prepare('SELECT * FROM products').all(); }
function buscarProduto(id) { return db.prepare('SELECT * FROM products WHERE id = ?').get(id); }
function registrarVenda(discordId, productName, quantity, totalValue, sellerValue, isPartner) { db.prepare(`INSERT INTO sales (discordId, productName, quantity, totalValue, sellerValue, isPartner, date) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(discordId, productName, quantity, totalValue, sellerValue, isPartner ? 1 : 0, new Date().toISOString()); }

// --- Farm ---
function registrarSalaFarm(channelId, userId, metaPeriod, metaDesc, metaQty, metaType) { db.prepare(`INSERT INTO farm_channels (channelId, userId, metaPeriod, metaDesc, metaQty, metaType, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(channelId, userId, metaPeriod, metaDesc, metaQty, metaType, new Date().toISOString()); }
function buscarSalaFarm(channelId) { return db.prepare('SELECT * FROM farm_channels WHERE channelId = ?').get(channelId); }
function fecharSalaFarm(channelId) { const sala = db.prepare('SELECT * FROM farm_channels WHERE channelId = ?').get(channelId); if (sala) db.prepare('DELETE FROM farm_channels WHERE channelId = ?').run(channelId); return sala; }
function buscarSalaFarmPorUsuario(userId) { return db.prepare('SELECT * FROM farm_channels WHERE userId = ?').get(userId); }
function limparFarmUsuario(userId) { db.prepare('DELETE FROM farm_channels WHERE userId = ?').run(userId); }

function adicionarMetaFarm(desc, qty, type) { return db.prepare('INSERT INTO farm_metas (metaDesc, metaQty, metaType) VALUES (?, ?, ?)').run(desc, qty, type); }
function removerMetaFarm(id) { return db.prepare('DELETE FROM farm_metas WHERE id = ?').run(id); }
function listarMetasFarm() { return db.prepare('SELECT * FROM farm_metas').all(); }

// --- Ações ---
function criarAcao(criadorId, nome, vagas, horario, mensagemId, canalId, mundo) { 
    return db.prepare('INSERT INTO acoes (criadorId, nome, vagas, horario, mensagemId, canalId, timestamp, mundo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(criadorId, nome, vagas, horario, mensagemId, canalId, Date.now(), mundo); 
}
function buscarAcao(id) { return db.prepare('SELECT * FROM acoes WHERE id = ?').get(id); }
function atualizarParticipantes(id, lista) { db.prepare('UPDATE acoes SET participantes = ? WHERE id = ?').run(JSON.stringify(lista), id); }
function deletarAcao(id) { db.prepare('DELETE FROM acoes WHERE id = ?').run(id); }
function finalizarAcaoDb(id) { db.prepare('UPDATE acoes SET finalizada = 1 WHERE id = ?').run(id); }
function listarAcoesParaAviso() { return db.prepare('SELECT * FROM acoes WHERE avisoEnviado = 0 AND finalizada = 0').all(); }
function marcarAvisoEnviado(id) { db.prepare('UPDATE acoes SET avisoEnviado = 1 WHERE id = ?').run(id); }

function adicionarKills(userId, quantidade) { db.prepare('UPDATE users SET kills = kills + ? WHERE discordId = ?').run(quantidade, userId); }
function adicionarResultado(userId, tipo) { if (tipo === 'vitoria') db.prepare('UPDATE users SET vitorias = vitorias + 1 WHERE discordId = ?').run(userId); if (tipo === 'derrota') db.prepare('UPDATE users SET derrotas = derrotas + 1 WHERE discordId = ?').run(userId); }
function listarRankingKills() { return db.prepare('SELECT discordId, nomeRp, kills, vitorias, derrotas FROM users WHERE kills > 0 ORDER BY kills DESC LIMIT 50').all(); }

// --- Logs & Monitoramento ---
function registrarLogBau(passaporte, nome, acao, item, quantidade, bau, dataOriginal, originChannelId) { 
    db.prepare(`INSERT INTO chest_logs (passaporte, nome, acao, item, quantidade, bau, dataOriginal, timestamp, originChannelId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(passaporte, nome, acao, item, quantidade, bau, dataOriginal, Date.now(), originChannelId); 
}
function listarLogsBau(limite = 100) { return db.prepare('SELECT * FROM chest_logs ORDER BY id DESC LIMIT ?').all(limite); }

function adicionarRegraAviso(item, type, value) { return db.prepare('INSERT INTO warning_rules (item, type, value) VALUES (?, ?, ?)').run(item, type, value); }
function removerRegraAviso(id) { return db.prepare('DELETE FROM warning_rules WHERE id = ?').run(id); }
function listarRegrasAviso() { return db.prepare('SELECT * FROM warning_rules').all(); }

// --- Ausências (Hiatus) ---
function criarAusencia(discordId, nomeRp, dataVolta, motivo) {
    return db.prepare('INSERT INTO ausencias (discordId, nomeRp, dataVolta, motivo, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(discordId, nomeRp, dataVolta, motivo, 'pendente', Date.now());
}

function atualizarAusencia(id, status, msgId = null) {
    if (msgId) {
        db.prepare('UPDATE ausencias SET status = ?, msgAprovacaoId = ? WHERE id = ?').run(status, msgId, id);
    } else {
        db.prepare('UPDATE ausencias SET status = ? WHERE id = ?').run(status, id);
    }
}

function buscarAusenciaPorId(id) {
    return db.prepare('SELECT * FROM ausencias WHERE id = ?').get(id);
}

function buscarAusenciaAtiva(discordId) {
    return db.prepare("SELECT * FROM ausencias WHERE discordId = ? AND status IN ('pendente', 'aprovado')").get(discordId);
}

function listarAusenciasVencidas() {
    return db.prepare("SELECT * FROM ausencias WHERE status = 'aprovado'").all();
}

function listarTodasAusencias() {
    return db.prepare("SELECT * FROM ausencias WHERE status IN ('pendente', 'aprovado') ORDER BY id DESC").all();
}

function deletarAusencia(id) {
    db.prepare("DELETE FROM ausencias WHERE id = ?").run(id);
}

module.exports = { 
    db, 
    setConfig, getConfig, 
    salvarUsuario, buscarUsuario, buscarUsuarioPorPassaporte, listarTodosUsuarios, atualizarPermissao, deletarUsuario,
    iniciarPonto, finalizarPonto, checarPonto, listarPontos,
    criarProduto, deletarProduto, listarProdutos, buscarProduto, registrarVenda,
    registrarSalaFarm, buscarSalaFarm, fecharSalaFarm, buscarSalaFarmPorUsuario, limparFarmUsuario,
    adicionarMetaFarm, removerMetaFarm, listarMetasFarm,
    criarAcao, buscarAcao, atualizarParticipantes, deletarAcao, finalizarAcaoDb, listarAcoesParaAviso, marcarAvisoEnviado, 
    adicionarKills, adicionarResultado, listarRankingKills,
    registrarLogBau, listarLogsBau,
    definirPremium, checkPremium, getPremiumData,
    adicionarRegraAviso, removerRegraAviso, listarRegrasAviso,
    criarAusencia, atualizarAusencia, buscarAusenciaPorId, buscarAusenciaAtiva, listarAusenciasVencidas, listarTodasAusencias, deletarAusencia
};