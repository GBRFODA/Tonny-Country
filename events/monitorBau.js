const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignora mensagens que não sejam de bots/webhooks
        if (!message.author.bot && !message.webhookId) return;

        // Carrega os 3 canais configurados
        const c1 = db.getConfig('monitor_channel_1');
        const c2 = db.getConfig('monitor_channel_2');
        const c3 = db.getConfig('monitor_channel_3');
        
        // Cria lista de canais válidos (remove null/undefined)
        const monitoredChannels = [c1, c2, c3].filter(Boolean);

        // Verifica se a mensagem veio de algum dos canais monitorados
        if (monitoredChannels.includes(message.channel.id)) {
            
            // Verifica se tem Embeds
            if (message.embeds.length > 0) {
                const embed = message.embeds[0];
                
                // Concatena tudo para busca
                const parts = [
                    embed.title,
                    embed.description,
                    embed.fields ? embed.fields.map(f => `${f.name} ${f.value}`).join('\n') : ''
                ];
                const fullText = parts.filter(Boolean).join('\n');

                // ====================================================
                // 1. Extração de Dados
                // ====================================================
                let passaporte = '???';
                let nome = 'Desconhecido';
                
                // Tenta pegar "Passaporte: 1234 Nome..."
                const idLineMatch = fullText.match(/(?:passaporte|id|user)[:\s]*(\d+)[ \t]+([^\n\r]+)/i);
                if (idLineMatch) {
                    passaporte = idLineMatch[1];
                    nome = idLineMatch[2].trim();
                } else {
                    const idOnlyMatch = fullText.match(/(?:passaporte|id|user)[:\s]*(\d+)/i);
                    if (idOnlyMatch) passaporte = idOnlyMatch[1];
                }

                const actionMatch = fullText.match(/(retirou|guardou|pegou|colocou|depositou|sacou):?\s*(\d+)x\s+([^\n\r]+)/i);
                const bauMatch = fullText.match(/(?:ba[úu]|chest):?\s*([^\n\r]+)/i);

                if (actionMatch) {
                    const acao = actionMatch[1]; // Ex: Guardou
                    const quantidade = parseInt(actionMatch[2]); // Ex: 216
                    const item = actionMatch[3].trim(); // Ex: Pólvora
                    
                    let bau = 'Desconhecido';
                    if (bauMatch) {
                        bau = bauMatch[1].trim();
                    }

                    // 1. Salva no banco (Monitoramento Geral)
                    db.registrarLogBau(passaporte, nome, acao, item, quantidade, bau, message.createdAt.toISOString(), message.channel.id);

                    // 2. Sistema de Avisos (Apenas para Retiradas)
                    const acoesRetirada = ['retirou', 'pegou', 'sacou'];
                    if (acoesRetirada.some(a => acao.toLowerCase().includes(a))) {
                        await verificarRegras(message.guild, passaporte, item, quantidade, bau, message.channel.id, nome);
                    }
                }
            }
        }
    }
};

// ====================================================
// Função Auxiliar de Verificação de Regras
// ====================================================
async function verificarRegras(guild, passaporte, item, quantidade, bau, channelId, nomeIngame) {
    const regras = db.listarRegrasAviso();
    const canalAvisoId = db.getConfig('channel_warning');
    
    // Se não tiver canal configurado ou regras, aborta
    if (!canalAvisoId || regras.length === 0) return;

    const canalAviso = guild.channels.cache.get(canalAvisoId);
    if (!canalAviso) return;

    // Busca usuário do Discord vinculado ao passaporte (se existir no banco)
    const userDb = db.buscarUsuarioPorPassaporte(passaporte);
    let discordMember = null;
    
    if (userDb) {
        try {
            discordMember = await guild.members.fetch(userDb.discordId);
        } catch (e) { /* Usuário pode ter saído do Discord */ }
    }

    for (const regra of regras) {
        // Verifica se o item corresponde (Case insensitive)
        if (regra.item.toLowerCase() === item.toLowerCase()) {
            
            let alerta = null;

            // --- TIPO 1: BLACKLIST ---
            if (regra.type === 'blacklist') {
                alerta = `🚫 **ITEM PROIBIDO RETIRADO**\nO item **${item}** está na Blacklist e foi retirado!`;
            }

            // --- TIPO 2: LIMITE ---
            if (regra.type === 'limit') {
                const limite = parseInt(regra.value);
                if (quantidade > limite) {
                    alerta = `⚠️ **LIMITE DE RETIRADA EXCEDIDO**\nRetiraram **${quantidade}x ${item}** (O máximo permitido é ${limite}).`;
                }
            }

            // --- TIPO 3: CARGO ---
            if (regra.type === 'role') {
                const roleId = regra.value;
                
                if (!discordMember) {
                    // Se o passaporte não está registrado no bot, é suspeito (alguém sem registro mexendo em item restrito)
                    alerta = `🛡️ **ITEM RESTRITO (USUÁRIO DESCONHECIDO)**\nO item **${item}** exige cargo, mas o passaporte **${passaporte}** não está registrado no sistema do Bot.`;
                } else {
                    // Se tem registro, verifica se tem o cargo
                    if (!discordMember.roles.cache.has(roleId)) {
                        alerta = `🛡️ **PERMISSÃO NEGADA (CARGO)**\n<@${discordMember.id}> retirou **${item}** sem ter o cargo necessário (<@&${roleId}>).`;
                    }
                }
            }

            // Se gerou algum alerta, envia no canal
            if (alerta) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 ALERTA DE SEGURANÇA')
                    .setColor(0xFF0000)
                    .setDescription(alerta)
                    .addFields(
                        { name: '👤 Jogador', value: `${userDb ? `<@${userDb.discordId}>` : nomeIngame} (ID: ${passaporte})`, inline: true },
                        { name: '📦 Item', value: `${quantidade}x ${item}`, inline: true },
                        { name: '📍 Origem', value: `Baú: ${bau}\nCanal: <#${channelId}>`, inline: false }
                    )
                    .setFooter({ text: 'Sistema de Monitoramento Grind' })
                    .setTimestamp();

                // Menciona quem fez a ação (se conhecido) ou alerta geral
                const content = userDb ? `<@${userDb.discordId}>` : '@here';
                
                await canalAviso.send({ content, embeds: [embed] });
                
                // Para não enviar múltiplos alertas do mesmo item (ex: limite e blacklist juntos),
                // podemos dar break ou deixar acumular. Aqui dou break para evitar spam de 1 item.
                break; 
            }
        }
    }
}