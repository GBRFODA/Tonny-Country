const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar')
        .setDescription('Envia o painel de registro (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Embed Bonita do Painel
        const embed = new EmbedBuilder()
            .setTitle('📑 Sistema de Registro')
            .setDescription('Seja bem-vindo à Argentina! 🇦🇷\n\nPara liberar seu acesso, é necessário realizar o registro. Clique no botão abaixo e preencha seus dados corretamente.\n\n**Requisitos:**\n> 👤 Nome e Sobrenome (RP)\n> 🆔 Passaporte (ID)\n> 🤝 Quem indicou (Opcional)')
            .setColor(0x5865F2)
            .setFooter({ text: 'Grind System • Registro Automático' });

        // O Botão que aciona o Interaction acima
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('reg_btn_iniciar') // IMPORTANTE: Esse ID chama o código que você mandou
                    .setLabel('Realizar Registro')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📝')
            );

        await interaction.reply({ content: '✅ Painel enviado!', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    },
};