const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_ausencia')
        .setDescription('Envia o painel de solicitação de ausência')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('✈️ Solicitação de Ausência / Hiatus')
            .setDescription('Vai precisar se ausentar por um tempo?\n\nClique no botão abaixo para preencher o formulário.\nSua solicitação será enviada para a liderança e você será notificado no privado.')
            .setColor(0x3498DB)
            .setFooter({ text: 'Grind System' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_solicitar_ausencia')
                    .setLabel('Solicitar Ausência')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📅')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Painel enviado com sucesso!', ephemeral: true });
    }
};