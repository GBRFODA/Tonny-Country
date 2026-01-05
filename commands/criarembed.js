const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('criarembed')
        .setDescription('Abre o criador de Embeds profissional (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // 1. Cria o Embed Rascunho Inicial
        const draftEmbed = new EmbedBuilder()
            .setTitle('Título do Embed')
            .setDescription('Este é um texto de exemplo. Use os botões abaixo para editar tudo.')
            .setColor(0x2B2D31) // Cinza escuro padrão
            .setFooter({ text: 'Edite este rodapé nos botões' });

        // 2. Botões de Controle (Linha 1: Textos Principais)
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('emb_edit_main').setLabel('Título & Descrição').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('emb_edit_author').setLabel('Autor & Rodapé').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
            new ButtonBuilder().setCustomId('emb_edit_visual').setLabel('Cor & Imagens').setStyle(ButtonStyle.Secondary).setEmoji('🎨')
        );

        // 3. Botões de Controle (Linha 2: Fields)
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('emb_add_field').setLabel('Adicionar Campo').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('emb_rem_field').setLabel('Remover Último Campo').setStyle(ButtonStyle.Danger).setEmoji('➖'),
            new ButtonBuilder().setCustomId('emb_clear_fields').setLabel('Limpar Campos').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        // 4. Seleção de Canal (Linha 3)
        const row3 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('emb_sel_channel')
                .setPlaceholder('📢 Selecione o canal de destino...')
                .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        );

        // 5. Botão de Envio (Linha 4)
        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('emb_btn_send').setLabel('ENVIAR MENSAGEM').setStyle(ButtonStyle.Success).setEmoji('🚀')
        );

        // Envia o painel (Ephemeral para ninguém ver você editando)
        await interaction.reply({
            content: '**🛠️ Estúdio de Criação de Embeds**\nConfigure abaixo e selecione o canal para enviar.',
            embeds: [draftEmbed],
            components: [row1, row2, row3, row4],
            ephemeral: true
        });
    }
};