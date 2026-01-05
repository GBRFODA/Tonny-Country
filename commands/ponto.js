const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ponto')
        .setDescription('Envia o painel de ponto')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const container = {
            type: 17, accent_color: 0x5865F2,
            components: [
                { type: 10, content: '# <:pontoazul:1452359793061658908> Ponto\n\n**Em Serviço:**\n*Ninguém.*' },
                { type: 14 },
                { type: 1, components: [{ type: 2, style: 1, label: 'Bater Ponto', emoji: {name:'⏱️'}, custom_id: 'ponto_btn_bater' }] }
            ]
        };
        await interaction.channel.send({ components: [container], flags: (1<<15) });
        await interaction.reply({ content: 'Painel enviado.', flags: 64 });
    }
};