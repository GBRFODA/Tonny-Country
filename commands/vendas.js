const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vendas')
        .setDescription('Envia o painel de vendas fixo (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // --- PAYLOAD DO PAINEL FIXO ---
        const container = {
            type: 17, // Container
            accent_color: 0x3db9db, // Verde Neon
            components: [
                { 
                    type: 10, 
                    content: '# 🛒 Sistema de Vendas\nPara registrar uma venda, clique no botão abaixo e siga as instruções.' 
                },
                { type: 14 }, // Separator
                { 
                    type: 1, // Action Row
                    components: [{ 
                        type: 2, // Button
                        style: 3, // Success (Verde)
                        label: 'Registrar Venda', 
                        custom_id: 'vendas_btn_painel_iniciar', // ID Inicial
                        emoji: { name: '💲' }
                    }] 
                }
            ]
        };

        // Envia para o canal (Público)
        await interaction.channel.send({ 
            components: [container], 
            flags: (1 << 15) // Flag V2
        });

        // Confirmação para o admin que rodou o comando
        await interaction.reply({ content: 'Painel de vendas enviado com sucesso.', flags: 64 });
    }
};