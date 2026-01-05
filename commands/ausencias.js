const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ausencias')
        .setDescription('Painel V2 de Ausências (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const ausencias = db.listarTodasAusencias();

        // Monta o texto da lista
        let conteudoLista = "";
        if (ausencias.length === 0) {
            conteudoLista = "✅ *Nenhuma ausência ativa no momento.*";
        } else {
            conteudoLista = ausencias.map(a => {
                let statusIcon = a.status === 'aprovado' ? '✅' : '⏳';
                if (a.status === 'aguardando_retorno') statusIcon = '⏰';
                return `**#${a.id}** ${statusIcon} <@${a.discordId}> | Retorno: \`${a.dataVolta}\`\nMotivo: ${a.motivo}`;
            }).join('\n\n');
        }

        // Limite de segurança
        if (conteudoLista.length > 3000) conteudoLista = conteudoLista.substring(0, 3000) + "...";

        // --- PAYLOAD V2 (JSON RAW) ---
        const container = {
            type: 17, // Container
            accent_color: 0x3498DB,
            components: [
                { type: 10, content: '# ✈️ Painel de Ausências' },
                { type: 14 }, // Separator
                { type: 10, content: `**Total Ativos:** ${ausencias.length}` },
                { type: 14 }, // Separator
                { type: 10, content: conteudoLista }, // Lista
                { type: 14 }, // Separator
                { 
                    type: 1, // Action Row com Botões
                    components: [
                        { 
                            type: 2, // Button
                            style: 1, // Primary
                            label: 'Atualizar Lista', 
                            custom_id: 'aus_btn_refresh', 
                            emoji: { name: '🔄' }
                        },
                        { 
                            type: 2, // Button
                            style: 4, // Danger
                            label: 'Remover Ausência', 
                            custom_id: 'aus_btn_delete', 
                            emoji: { name: '🗑️' },
                            disabled: ausencias.length === 0 
                        }
                    ] 
                }
            ]
        };

        // Envia com a flag V2
        await interaction.reply({ 
            components: [container], 
            flags: (1 << 15)
        });
    }
};