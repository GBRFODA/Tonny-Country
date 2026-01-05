const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kda')
        .setDescription('Vê estatísticas de combate')
        .addUserOption(option => option.setName('usuario').setDescription('Usuário para consultar').setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('usuario') || interaction.user;
        const dados = db.buscarUsuario(target.id);

        if (!dados) return interaction.reply({ content: '❌ Usuário não registrado.', flags: 64 });

        const vitorias = dados.vitorias || 0;
        const derrotas = dados.derrotas || 0;
        const kills = dados.kills || 0;
        const totalAcoes = vitorias + derrotas;
        const winRate = totalAcoes > 0 ? ((vitorias / totalAcoes) * 100).toFixed(1) : "0.0";

        const container = {
            type: 17, // Container principal
            accent_color: 0x2B2D31,
            components: [
                { type: 10, content: `# ⚔️ Estatísticas: ${target.username}` },
                {
                    type: 9, // Grid/Section
                    components: [
                        { 
                            type: 10, 
                            content: `**<:check2:1451307491035054203>VITÓRIAS:** ${vitorias}\n` +
                                     `**<:x_:1451307494432444551>DERROTAS:** ${derrotas}\n` +
                                     `**<:caveira:1451307487801245926>KILLS:** ${kills}\n` +
                                     `**<a:seta:1451307489491685578>TAXA DE VITÓRIA:** ${winRate}%`
                        }
                    ],
                    accessory: { 
                        type: 11, // MediaProxy (Avatar)
                        media: { url: target.displayAvatarURL({ extension: 'png' }) } 
                    }
                }
            ]
        };

        // A flag (1 << 15) é obrigatória para renderizar o Container (Type 17)
        await interaction.reply({ components: [container], flags: (1 << 15) });
    }
};