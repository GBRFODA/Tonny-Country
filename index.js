require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const config = require('./config.json');
const db = require('./utils/db');
const axios = require('axios');

// URL DA API DO MANAGER (Discloud)
const MANAGER_API_URL = 'https://managergrind.discloud.app/api';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        // [CORREÇÃO] Intents necessários para Logs de Voz e Moderação
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans
    ]
});

// ====================================================
// CARREGAMENTO DE COMANDOS E EVENTOS
// ====================================================
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commandsPayload = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsPayload.push(command.data.toJSON());
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) client.once(event.name, (...args) => event.execute(...args));
    else client.on(event.name, (...args) => event.execute(...args));
}

// ====================================================
// FUNÇÕES AUXILIARES
// ====================================================
async function patchMessageV2(channelId, messageId, body) {
    return axios.patch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
        body,
        { headers: { Authorization: `Bot ${process.env.TOKEN}`, 'Content-Type': 'application/json' } }
    );
}

async function postMessageV2(channelId, body) {
    return axios.post(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        body,
        { headers: { Authorization: `Bot ${process.env.TOKEN}`, 'Content-Type': 'application/json' } }
    );
}

// ====================================================
// COMUNICAÇÃO COM O SITE (IPC)
// ====================================================
process.on('message', async (msg) => {
    // 1. Solicitação de Dados de Usuário
    if (msg.type === 'GET_USER') {
        try {
            const user = await client.users.fetch(msg.userId);
            process.send({
                type: 'USER_DATA',
                requestId: msg.requestId,
                data: {
                    username: user.username,
                    avatarURL: user.displayAvatarURL({ extension: 'png', size: 256 })
                }
            });
        } catch (error) {
            process.send({
                type: 'USER_DATA',
                requestId: msg.requestId,
                data: { username: "Desconhecido", avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png" }
            });
        }
    }

    // 2. Criação de Ação (Vindo do Painel Web)
    if (msg.type === 'CREATE_ACTION') {
        // [MODIFICADO] Recebendo o campo 'mundo'
        const { nome, vagas, horario, criadorId, mundo } = msg.data;
        try {
            const canalId = db.getConfig('channel_acao') || db.getConfig('acao_channel');
            if (!canalId) {
                console.error(`[AÇÃO] Erro: Canal de ações não configurado!`);
                return;
            }

            const card = {
                type: 17, accent_color: 0xF1C40F, 
                components: [
                    { type: 10, content: `# 🚨 AÇÃO AGENDADA: ${nome.toUpperCase()}` },
                    // [MODIFICADO] Exibindo o Mundo no Card
                    { type: 10, content: `🌍 **Mundo:** \`${mundo}\`\n⏰ **Horário:** \`${horario}\`\n👥 **Vagas:** \`0 / ${vagas}\`\n\n**Participantes:**\n*Ninguém ainda.*` },
                    { type: 1, components: [
                            { type: 2, style: 3, label: 'Participar', custom_id: `acao_join_TEMP`, emoji: { name: '✅' } },
                            { type: 2, style: 2, label: 'Sair', custom_id: `acao_leave_TEMP` },
                            { type: 2, style: 4, label: 'Encerrar', custom_id: `acao_delete_TEMP`, emoji: { name: '✖️' } }
                    ]}
                ]
            };

            const response = await postMessageV2(canalId, { components: [card], flags: (1 << 15) });
            const msgData = response.data;

            // [MODIFICADO] Passando o mundo para a função de banco de dados
            const result = db.criarAcao(criadorId, nome, vagas, horario, msgData.id, canalId, mundo);
            const acaoId = result.lastInsertRowid;

            card.components[2].components.forEach(c => { c.custom_id = c.custom_id.replace('TEMP', acaoId); });
            await patchMessageV2(canalId, msgData.id, { components: [card], flags: (1 << 15) });

            const channel = await client.channels.fetch(canalId);
            if(channel) {
                const ping = await channel.send('@everyone');
                setTimeout(() => ping.delete().catch(() => {}), 2000);
            }
            console.log(`[AÇÃO] Ação ${acaoId} criada com sucesso via Web (Mundo: ${mundo}).`);
        } catch (error) { console.error(`[AÇÃO] Erro ao criar ação via site:`, error.response?.data || error); }
    }

    // 3. Banimento de Usuário
    if (msg.type === 'BAN_USER') {
        try {
            const guildId = config.guildId;
            const guild = await client.guilds.fetch(guildId);
            
            if (guild) {
                try {
                    await guild.members.ban(msg.userId, { reason: 'Banido pelo Painel Administrativo Web' });
                    console.log(`[BAN] Usuário ${msg.userId} foi banido.`);
                } catch (banError) {
                    console.error(`[BAN ERROR] Falha ao banir:`, banError.message);
                }
            }
        } catch (error) {}
    }
});

// ====================================================
// FUNÇÃO DE VERIFICAÇÃO DE LICENÇA (BACKGROUND)
// ====================================================
async function verificarLicenca() {
    const guilds = client.guilds.cache;
    for (const [guildId, guild] of guilds) {
        
        // Só verifica quem tem premium no banco local
        if (!db.getPremiumData(guildId)) continue;

        try {
            // [CORREÇÃO] Usa GET e a URL correta
            const response = await axios.get(`${MANAGER_API_URL}/check/${guildId}`, { timeout: 5000 });
            const dados = response.data;

            if (dados.active === false) {
                console.warn(`[LICENÇA] 🚫 BACKGROUND CHECK: ${guild.name} revogado. Bloqueando...`);
                db.definirPremium(guildId, 0); // Remove localmente
            } else if (dados.expiresAt) {
                db.definirPremium(guildId, dados.expiresAt); // Sincroniza data
            }
        } catch (error) {
            console.error(`[CHECK ERROR] Falha ao verificar licença no fundo: ${error.message}`);
        }
    }
}

client.once('ready', () => {
    console.log(`Bot Client online: ${client.user.tag}`);
    
    // Varredura Inicial
    verificarLicenca(); 
    
    // Varredura a cada 1 MINUTO (Background Check)
    setInterval(() => { verificarLicenca(); }, 60 * 1000); 
    
    // Timer de Ações
    setInterval(async () => {
        // Se não tiver premium, nem roda o timer
        if (!db.checkPremium(config.guildId)) return;

        const agora = new Date();
        const options = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false };
        const formatter = new Intl.DateTimeFormat('pt-BR', options);
        const timeString = formatter.format(agora);
        const [hora, minuto] = timeString.includes(':') ? timeString.split(':') : timeString.split(' '); 
        const tempoFormatado = `${hora}:${minuto}`;

        const acoes = db.listarAcoesParaAviso();

        for (const acao of acoes) {
            if (acao.horario === tempoFormatado) {
                try {
                    const painelResultados = {
                        type: 17, accent_color: 0x5865F2,
                        components: [
                            { type: 10, content: `# ⚔️ AÇÃO EM ANDAMENTO: ${acao.nome.toUpperCase()}` },
                            { type: 10, content: `🌍 **Mundo:** \`${acao.mundo || 'Não inf.'}\`\nO horário chegou! Marquem o resultado.` },
                            { type: 1, components: [
                                    { type: 2, style: 3, label: 'Vitória', custom_id: `acao_win_${acao.id}`, emoji: { name: '🏆' } },
                                    { type: 2, style: 4, label: 'Derrota', custom_id: `acao_loss_${acao.id}`, emoji: { name: '💀' } },
                                    { type: 2, style: 2, label: 'Kills', custom_id: `acao_killbtn_${acao.id}`, emoji: { name: '🎯' } }
                            ]}
                        ]
                    };
                    await patchMessageV2(acao.canalId, acao.mensagemId, { components: [painelResultados], flags: (1 << 15) });
                    db.marcarAvisoEnviado(acao.id);
                } catch (error) {
                    if (error.response?.status === 404) db.marcarAvisoEnviado(acao.id);
                }
            }
        }
    }, 60000);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    (async () => {
        try {
            await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commandsPayload });
            console.log('Slash Commands registrados!');
        } catch (error) { console.error(error); }
    })();
});

client.login(process.env.TOKEN);