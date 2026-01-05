const db = require('../utils/db');

// Função auxiliar para formatar segundos em "1h 30m 15s"
function formatarTempo(totalSegundos) {
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    const partes = [];
    if (horas > 0) partes.push(`${horas}h`);
    if (minutos > 0) partes.push(`${minutos}m`);
    partes.push(`${segundos}s`); // Sempre mostra os segundos

    return partes.join(' ');
}

module.exports = {
    async execute(interaction) {
        if (interaction.isButton() && interaction.customId === 'ponto_btn_bater') {
            const usuario = interaction.user;
            const pontoAtivo = db.checarPonto(usuario.id);
            const dadosUser = db.buscarUsuario(usuario.id);
            const nome = dadosUser ? `${dadosUser.passaporte} | ${dadosUser.nomeRp}` : usuario.username;

            let msg = '';
            
            if (pontoAtivo) {
                // ====================================================
                // SAIR DO PONTO (FECHAR)
                // ====================================================
                const inicio = db.finalizarPonto(usuario.id);
                const agora = Math.floor(Date.now() / 1000);
                const totalSegundos = agora - inicio;
                
                // Formatação Bonita com Segundos
                const tempoTexto = formatarTempo(totalSegundos);
                
                msg = `🔴 **Ponto Finalizado!**\nTempo total de serviço: **${tempoTexto}**`;

                // Envia Log para o Canal Configurado
                const logId = db.getConfig('channel_ponto');
                if (logId) {
                    const chan = interaction.guild.channels.cache.get(logId);
                    if (chan) {
                        const containerLog = {
                            type: 17, // Container
                            accent_color: 0x004D99, // azul
                            components: [
                                { 
                                    type: 10, 
                                    content: `### <a:load:1448770038168555603> FECHAMENTO DE PONTO\n` +
                                             `<:boneco:1450638746671255728> **Usuário:** ${usuario}\n` +
                                             `<:aviso:1450637208540155924> **Identidade:** \`${nome}\`\n` +
                                             `<:ponto:1450636598700937381> **Duração:** \`${tempoTexto}\`\n` +
                                             `<:calendario:1450639639781183681> **Data:** <t:${agora}:f>`
                                }
                            ]
                        };
                        // Envia Log Raw V2
                        chan.send({ components: [containerLog], flags: (1<<15) });
                    }
                }

            } else {
                // ====================================================
                // ENTRAR NO PONTO (ABRIR)
                // ====================================================
                db.iniciarPonto(usuario.id);
                msg = `🟢 **Ponto Iniciado!** Bom trabalho.`;
            }

            // ====================================================
            // ATUALIZA O PAINEL PRINCIPAL
            // ====================================================
            const lista = db.listarPontos();
            
            // Monta a lista visual
            let textoLista = '';
            if (lista.length === 0) {
                textoLista = '*Nenhum membro em serviço no momento.*';
            } else {
                textoLista = lista.map(p => {
                    const d = db.buscarUsuario(p.discordId); // Busca nome se tiver
                    const n = d ? `**${d.passaporte}**` : `<@${p.discordId}>`;
                    // <t:X:R> é o segredo. Ele atualiza sozinho no cliente do usuário.
                    return `> 🟢 ${n} • Em serviço há <t:${p.startTime}:R>`; 
                }).join('\n');
            }
            
            const novoPainel = {
                type: 17, 
                accent_color: 0x5865F2,
                components: [
                    { 
                        type: 10, 
                        content: `# <:pontoazul:1452359793061658908> Controle de Ponto\nUtilize o botão abaixo para registrar sua entrada e saída.\n\n### 👮 Em Serviço (${lista.length})` 
                    },
                    { 
                        type: 10, 
                        content: textoLista 
                    },
                    { type: 14 }, // Separator
                    { 
                        type: 1, 
                        components: [{ 
                            type: 2, 
                            style: 1, // Primary
                            label: 'Bater Ponto', 
                            emoji: { name: '⏱️' }, 
                            custom_id: 'ponto_btn_bater' 
                        }] 
                    }
                ]
            };

            await interaction.update({ components: [novoPainel], flags: (1<<15) });
            await interaction.followUp({ content: msg, flags: 64 });
        }
    }
};