require('dotenv').config();
const { fork } = require('child_process');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const axios = require('axios'); 
const databaseModule = require('./utils/db');
const db = databaseModule.db;
const config = require('./config.json');

const botProcess = fork(path.join(__dirname, 'index.js'));
const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'web/views'));
app.use(express.static(path.join(__dirname, 'web/public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'client-dashboard-secret-discloud',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 * 60 * 24 }
}));

app.use(passport.initialize());
app.use(passport.session());

function getDiscordUser(userId) {
    return new Promise((resolve) => {
        const requestId = Date.now() + Math.random();
        botProcess.send({ type: 'GET_USER', userId, requestId });
        const handler = (msg) => {
            if (msg.type === 'USER_DATA' && msg.requestId === requestId) {
                botProcess.off('message', handler);
                resolve(msg.data);
            }
        };
        botProcess.on('message', handler);
        setTimeout(() => { 
            botProcess.off('message', handler); 
            resolve({ username: "Usuário", avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png" }); 
        }, 2000);
    });
}

passport.use(new DiscordStrategy({
    clientID: config.clientId,
    clientSecret: process.env.CLIENT_SECRET,
    // [IMPORTANTE] URL CONFIGURADA PARA DISCLOUD
    callbackURL: `https://grindargentina.discloud.app/auth/discord/callback`,
    scope: ['identify', 'guilds', 'guilds.members.read'] 
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const adminRoleId = databaseModule.getConfig('role_web_admin');
        const managerRoleId = databaseModule.getConfig('role_web_manager');
        const guildId = config.guildId; 

        let isAdmin = false;
        let isManager = false;

        if (profile.id === config.ownerId) {
            isAdmin = true; isManager = true;
        } else if (guildId) {
            try {
                const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${profile.id}`, {
                    headers: { Authorization: `Bot ${process.env.TOKEN}` }
                });
                const memberRoles = response.data.roles || [];
                if (adminRoleId && memberRoles.includes(adminRoleId)) isAdmin = true;
                if (managerRoleId && memberRoles.includes(managerRoleId)) isManager = true;
                if (isAdmin) isManager = true;
            } catch (error) { console.error(`[AUTH ERRO] ${error.message}`); }
        }

        let gameUser = databaseModule.buscarUsuario(profile.id);
        if (!gameUser) gameUser = { nomeRp: profile.username, passaporte: 'Visitante' };

        const sessionUser = {
            discordId: profile.id, username: profile.username,
            avatar: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
            isAdmin: isAdmin, isManager: isManager, gameData: gameUser
        };
        return done(null, sessionUser);
    } catch (err) { return done(err, null); }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use((req, res, next) => { res.locals.user = req.user || null; next(); });

function checkAuth(req, res, next) { if (req.isAuthenticated()) return next(); res.redirect('/'); }
function checkManager(req, res, next) { if (req.isAuthenticated() && (req.user.isAdmin || req.user.isManager)) return next(); res.status(403).send("Acesso Negado"); }
function checkAdmin(req, res, next) { if (req.isAuthenticated() && req.user.isAdmin) return next(); res.status(403).send("Acesso Negado"); }

app.get('/', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.send(`<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login</title><script src="https://cdn.tailwindcss.com"></script><style>body{background-color:#09090b;color:#fff;font-family:sans-serif;}</style></head><body class="flex items-center justify-center h-screen"><div class="text-center space-y-6 p-8 bg-zinc-900/50 rounded-2xl border border-zinc-800 shadow-2xl"><h1 class="text-3xl font-bold">Painel Administrativo</h1><a href="/auth/discord" class="inline-flex px-8 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-medium shadow-lg">Entrar com Discord</a></div></body></html>`);
    }

    try {
        const premiumData = databaseModule.getPremiumData(config.guildId);
        let textoLicenca = "Não Ativa"; let classeCor = "text-danger";

        if (premiumData && premiumData.expiresAt) {
            const diff = premiumData.expiresAt - Date.now();
            if (diff > 0) {
                const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
                textoLicenca = dias > 0 ? `${dias} dia(s)` : "Menos de 24h";
                classeCor = "text-success";
            } else textoLicenca = "Expirada";
        }

        const rankingRaw = databaseModule.listarRankingKills(); 
        const users = databaseModule.listarTodosUsuarios();

        // Dados base
        const top1Raw = rankingRaw[0] || null;
        const top2Raw = rankingRaw[1] || null;
        const top3Raw = rankingRaw[2] || null;

        const top1 = top1Raw ? { ...top1Raw, ...(await getDiscordUser(top1Raw.discordId)) } : null;
        const top2 = top2Raw ? { ...top2Raw, ...(await getDiscordUser(top2Raw.discordId)) } : null;
        const top3 = top3Raw ? { ...top3Raw, ...(await getDiscordUser(top3Raw.discordId)) } : null;

        res.render('index', { user: req.user, licenca: textoLicenca, corLicenca: classeCor, ranking: rankingRaw, top1, top2, top3, totalMembers: users.length });
    } catch (error) { console.error(error); res.status(500).send("Erro"); }
});

app.get('/ranking', checkAuth, (req, res) => res.render('ranking', { user: req.user }));

// [MODIFICADO] Rota de logs enviando activeChannels
app.get('/logs', checkManager, (req, res) => {
    // Busca configs e filtra nulos/strings vazias
    const activeChannels = [
        databaseModule.getConfig('monitor_channel_1'),
        databaseModule.getConfig('monitor_channel_2'),
        databaseModule.getConfig('monitor_channel_3')
    ].filter(id => id && id !== "Não definido");

    res.render('logs', { user: req.user, activeChannels });
});

app.get('/admin', checkAdmin, (req, res) => { const users = databaseModule.listarTodosUsuarios(); res.render('admin', { users, user: req.user }); });
app.post('/admin/update-role', checkAdmin, (req, res) => { databaseModule.atualizarPermissao(req.body.discordId, parseInt(req.body.newLevel)); res.redirect('/admin'); });
app.post('/admin/ban', checkAdmin, (req, res) => { databaseModule.deletarUsuario(req.body.discordId); botProcess.send({ type: 'BAN_USER', userId: req.body.discordId }); res.redirect('/admin'); });

// Criação de Ação (Mantido com a feature de Mundo)
app.post('/acoes/criar', checkManager, (req, res) => { 
    botProcess.send({ 
        type: 'CREATE_ACTION', 
        data: { 
            nome: req.body.nome, 
            vagas: parseInt(req.body.vagas), 
            horario: req.body.horario, 
            mundo: req.body.mundo, 
            criadorId: req.user.discordId 
        } 
    }); 
    res.redirect('/'); 
});

app.get('/api/live-data', checkAuth, async (req, res) => {
    try {
        const pontosRaw = databaseModule.listarPontos() || [];
        const vendasRaw = db.prepare('SELECT * FROM sales ORDER BY id DESC LIMIT 10').all() || [];
        
        const metricsRaw = {
            totalVendas: db.prepare('SELECT SUM(totalValue) as total FROM sales').get()?.total || 0,
            qtdVendas: db.prepare('SELECT COUNT(*) as total FROM sales').get()?.total || 0,
            totalKills: db.prepare('SELECT SUM(kills) as total FROM users').get()?.total || 0,
            acoesGanhas: db.prepare('SELECT COUNT(*) as total FROM acoes WHERE finalizada = 1').get()?.total || 0,
        };

        const pontosAtivos = await Promise.all(pontosRaw.map(async (p) => { const d = await getDiscordUser(p.discordId); return { ...p, username: d.username, avatarURL: d.avatarURL }; }));
        const ultimasVendas = await Promise.all(vendasRaw.map(async (v) => { const d = await getDiscordUser(v.discordId); return { ...v, username: d.username, avatarURL: d.avatarURL }; }));

        res.json({ pontosAtivos, ultimasVendas, metrics: metricsRaw });
    } catch (error) { res.status(500).json({ error: "Erro" }); }
});

app.get('/api/ranking', checkAuth, async (req, res) => { try { const r = databaseModule.listarRankingKills(); const rc = await Promise.all(r.map(async (u) => { const d = await getDiscordUser(u.discordId); return { ...u, username: d.username, avatarURL: d.avatarURL }; })); res.json(rc); } catch { res.json([]); } });
app.get('/api/chest-logs', checkManager, (req, res) => { try { res.json(databaseModule.listarLogsBau(100)); } catch { res.json([]); } });

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/'));
app.get('/logout', (req, res) => { req.logout(() => res.redirect('/')); });

app.listen(port, () => { console.log(`[CLIENT WEB] Rodando em http://localhost:${port}`); });