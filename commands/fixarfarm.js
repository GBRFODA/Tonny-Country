const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fixarfarm')
        .setDescription('Envia o painel para abrir salas de farm (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const container = {
            type: 17, // Container
            accent_color: 0x3db9db, // Cobre
            components: [
                { 
                    type: 10, 
                    content: '# <:capaazul:1452359572453851280> Central de Farm\nClique no botão abaixo para iniciar sua meta e criar uma sala segura.' 
                },
                { type: 14 },
                { 
                    type: 1, 
                    components: [{ 
                        type: 2, 
                        style: 1, // Primary
                        label: 'Abrir Sala de Farm', 
                        custom_id: 'farm_btn_open', // Prefixo farm_
                        emoji: { name: '⛏️' }
                    }] 
                }
            ]
        };

        await interaction.channel.send({ 
            components: [container], 
            flags: (1 << 15) // Flag V2
        });

        await interaction.reply({ content: 'Painel de farm fixado.', flags: 64 });
    }
};