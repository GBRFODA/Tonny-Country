const { Events, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    name: Events.InteractionCreate, // Ouve todas as interações
    async execute(interaction) {

        // Verifica se é botão ou menu e se começa com "aus_"
        if (!interaction.customId || !interaction.customId.startsWith('aus_')) return;

        // ====================================================
        // 1. BOTÃO ATUALIZAR (Recria o Painel V2)
        // ====================================================
        if (interaction.isButton() && interaction.customId === 'aus_btn_refresh') {
            try {
                const ausencias = db.listarTodasAusencias();

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
                if (conteudoLista.length > 3000) conteudoLista = conteudoLista.substring(0, 3000) + "...";

                // JSON V2
                const container = {
                    type: 17,
                    accent_color: 0x3498DB,
                    components: [
                        { type: 10, content: '# ✈️ Painel de Ausências (Atualizado)' },
                        { type: 14 },
                        { type: 10, content: `**Total Ativos:** ${ausencias.length} | Atualizado às ${new Date().toLocaleTimeString()}` },
                        { type: 14 },
                        { type: 10, content: conteudoLista },
                        { type: 14 },
                        { 
                            type: 1, 
                            components: [
                                { type: 2, style: 1, label: 'Atualizar Lista', custom_id: 'aus_btn_refresh', emoji: { name: '🔄' } },
                                { type: 2, style: 4, label: 'Remover Ausência', custom_id: 'aus_btn_delete', emoji: { name: '🗑️' }, disabled: ausencias.length === 0 }
                            ] 
                        }
                    ]
                };

                await interaction.update({ components: [container], flags: (1 << 15) });
            } catch (error) {
                console.error("Erro ao atualizar painel:", error);
                if (!interaction.replied) await interaction.reply({ content: "❌ Erro ao atualizar.", ephemeral: true });
            }
        }

        // ====================================================
        // 2. BOTÃO REMOVER (Abre Menu Suspenso Efêmero)
        // ====================================================
        if (interaction.isButton() && interaction.customId === 'aus_btn_delete') {
            const ausencias = db.listarTodasAusencias();
            
            if (ausencias.length === 0) {
                return interaction.reply({ content: '❌ Lista vazia.', ephemeral: true });
            }

            const options = ausencias.slice(0, 25).map(a => ({
                label: `ID: ${a.id} - ${a.nomeRp ? a.nomeRp.substring(0, 15) : 'User'}`,
                description: `Volta: ${a.dataVolta}`,
                value: a.id.toString(),
                emoji: '🗑️'
            }));

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('aus_sel_delete_exec')
                    .setPlaceholder('Selecione para remover...')
                    .addOptions(options)
            );

            // Responde apenas para quem clicou (Ephemeral) com componentes V1 Padrão
            // Isso é necessário porque V2 não suporta Dropdown dentro dele ainda
            await interaction.reply({ 
                content: '🗑️ **Selecione qual ausência deseja apagar:**', 
                components: [row], 
                ephemeral: true 
            });
        }

        // ====================================================
        // 3. EXECUTAR REMOÇÃO (Dropdown)
        // ====================================================
        if (interaction.isStringSelectMenu() && interaction.customId === 'aus_sel_delete_exec') {
            const id = interaction.values[0];
            db.deletarAusencia(id);

            await interaction.update({ 
                content: `✅ Ausência **#${id}** removida com sucesso.\nClique em **Atualizar Lista** no painel principal para ver a mudança.`, 
                components: [] 
            });
        }
    }
};