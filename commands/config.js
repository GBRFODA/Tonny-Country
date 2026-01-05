const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Painel de Configuração Geral (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        
        // Criação do Embed Principal
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Painel de Configuração | Grind System')
            .setDescription('Selecione uma categoria no menu abaixo para gerenciar as configurações do servidor.')
            .setColor(0x2B2D31)
            .addFields(
                { name: '📋 Categorias Disponíveis', value: 'Use o menu abaixo para navegar entre:\n• Registro\n• Ponto\n• Vendas\n• Ações\n• Farm\n• Monitoramento (Baús)\n• Avisos Automáticos\n• Logs Gerais\n• Acesso Web' }
            )
            .setFooter({ text: 'Sistema de Gerenciamento Integrado' });

        // Criação do Menu de Seleção (Dropdown)
        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('cfg_main_menu_selector')
                    .setPlaceholder('📂 Selecione uma categoria...')
                    .addOptions([
                        { label: 'Sistema de Registro', value: 'cfg_cat_registro', emoji: '📝', description: 'Canais de aprovação e cargos.' },
                        { label: 'Sistema de Ponto', value: 'cfg_cat_ponto', emoji: '⏰', description: 'Logs de entrada e saída.' },
                        { label: 'Sistema de Vendas', value: 'cfg_cat_vendas', emoji: '💰', description: 'Produtos, porcentagens e logs.' },
                        { label: 'Sistema de Ações', value: 'cfg_cat_acoes', emoji: '⚔️', description: 'Anúncios de PVP e resultados.' },
                        { label: 'Sistema de Farm', value: 'cfg_cat_farm', emoji: '🌾', description: 'Metas de farm e validação.' },
                        { label: 'Monitoramento (Baús)', value: 'cfg_cat_monitor', emoji: '📦', description: 'Canais de logs de baú.' },
                        { label: 'Avisos de Baú', value: 'cfg_cat_avisos', emoji: '🚨', description: 'Blacklist, limites e alertas.' },
                        { label: 'Logs Gerais', value: 'cfg_cat_logs', emoji: '📜', description: 'Msg, Voz, Membros e Moderação.' },
                        { label: 'Ausências (Hiatus)', value: 'cfg_cat_ausencia', emoji: '✈️', description: 'Aprovações de ausência.' },
                        { label: 'Acesso ao Site', value: 'cfg_cat_web', emoji: '🌐', description: 'Permissões do painel web.' },
                    ])
            );

        await interaction.reply({ 
            embeds: [embed], 
            components: [row], 
            flags: (1 << 6) // Ephemeral
        });
    }
};