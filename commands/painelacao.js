const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painelacao')
        .setDescription('Envia o painel de criação de ações (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Payload utilizando Container V2
        const container = {
            type: 17, // Container
            accent_color: 0x3db9db, // Roxo
            components: [
                { 
                    type: 10, 
                    content: '# <:alvoazul:1452359385488822343> Central de Ações\nClique no botão abaixo para agendar uma nova ação e convocar a equipe.' 
                },
                { type: 14 }, // Separador
                { 
                    type: 1, // Action Row
                    components: [{ 
                        type: 2, 
                        style: 1, // Primary (Azul)
                        label: 'Criar Ação', 
                        custom_id: 'acao_btn_criar', 
                        emoji: { name: '📅' }
                    }] 
                }
            ]
        };

        // Envia a mensagem no canal atual
        await interaction.channel.send({ 
            components: [container], 
            flags: (1 << 15) // Habilita visual V2
        });

        await interaction.reply({ content: 'Painel de ações enviado.', flags: 64 });
    }
};