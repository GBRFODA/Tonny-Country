const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // Filtro: Só processa interações que começam com "emb_"
        if ((!interaction.customId || !interaction.customId.startsWith('emb_')) && !interaction.isChannelSelectMenu()) return;
        if (interaction.isChannelSelectMenu() && interaction.customId !== 'emb_sel_channel') return;

        // Recupera o embed atual da mensagem (para editar em cima dele)
        // Se for modal submit, o embed está em interaction.message
        let currentEmbed;
        if (interaction.message && interaction.message.embeds.length > 0) {
            currentEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
        } else {
            // Fallback caso algo dê errado
            currentEmbed = new EmbedBuilder().setDescription('Rascunho reiniciado.');
        }

        // ====================================================
        // 1. ABRIR MODAIS (Formulários de Edição)
        // ====================================================
        
        if (interaction.isButton()) {
            
            // --- Editar Título e Descrição ---
            if (interaction.customId === 'emb_edit_main') {
                const modal = new ModalBuilder().setCustomId('emb_modal_main').setTitle('Editar Conteúdo Principal');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_title').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.data.title || "")),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_desc').setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(currentEmbed.data.description || "")),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_url').setLabel("URL do Título (Link)").setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.data.url || ""))
                );
                return await interaction.showModal(modal);
            }

            // --- Editar Autor e Rodapé ---
            if (interaction.customId === 'emb_edit_author') {
                const modal = new ModalBuilder().setCustomId('emb_modal_author').setTitle('Editar Autor e Rodapé');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_author_name').setLabel("Nome do Autor").setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.data.author?.name || "")),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_author_icon').setLabel("Ícone do Autor (URL)").setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.data.author?.icon_url || "")),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_footer_text').setLabel("Texto do Rodapé").setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.data.footer?.text || "")),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_footer_icon').setLabel("Ícone do Rodapé (URL)").setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.data.footer?.icon_url || ""))
                );
                return await interaction.showModal(modal);
            }

            // --- Editar Visual (Cor e Imagens) ---
            if (interaction.customId === 'emb_edit_visual') {
                const modal = new ModalBuilder().setCustomId('emb_modal_visual').setTitle('Editar Visual');
                // Hex color precisa converter de int para hex string
                const hexColor = currentEmbed.data.color ? '#' + currentEmbed.data.color.toString(16) : "";
                
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_color').setLabel("Cor (Hex ou Nome)").setPlaceholder("Ex: #FF0000 ou Red").setStyle(TextInputStyle.Short).setRequired(false).setValue(hexColor)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_image').setLabel("Imagem Grande (URL)").setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.data.image?.url || "")),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_thumb').setLabel("Thumbnail (Miniatura URL)").setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.data.thumbnail?.url || ""))
                );
                return await interaction.showModal(modal);
            }

            // --- Adicionar Campo (Field) ---
            if (interaction.customId === 'emb_add_field') {
                const modal = new ModalBuilder().setCustomId('emb_modal_field').setTitle('Adicionar Campo');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_field_name').setLabel("Título do Campo").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_field_val').setLabel("Conteúdo do Campo").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_field_inline').setLabel("Inline? (Mesma linha)").setPlaceholder("Digite 'sim' ou 'nao'").setStyle(TextInputStyle.Short).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // --- Remover/Limpar Campos (Ação Direta) ---
            if (interaction.customId === 'emb_rem_field') {
                const fields = currentEmbed.data.fields || [];
                if (fields.length > 0) fields.pop(); // Remove o último
                currentEmbed.setFields(fields);
                return await interaction.update({ embeds: [currentEmbed] });
            }

            if (interaction.customId === 'emb_clear_fields') {
                currentEmbed.setFields([]); // Zera tudo
                return await interaction.update({ embeds: [currentEmbed] });
            }
            
            // --- ENVIAR (Ação Final) ---
            if (interaction.customId === 'emb_btn_send') {
                // Pega o ID do canal que salvamos no conteúdo da mensagem
                const content = interaction.message.content;
                const match = content.match(/<#(\d+)>/);
                
                if (!match) {
                    return await interaction.reply({ content: '❌ **Selecione um canal** no menu de seleção antes de enviar!', ephemeral: true });
                }

                const channelId = match[1];
                const channel = interaction.guild.channels.cache.get(channelId);

                if (!channel) return await interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });

                try {
                    await channel.send({ embeds: [currentEmbed] });
                    return await interaction.reply({ content: `✅ **Sucesso!** Embed enviado para ${channel}.`, ephemeral: true });
                } catch (err) {
                    return await interaction.reply({ content: '❌ Erro ao enviar. Verifique minhas permissões no canal destino.', ephemeral: true });
                }
            }
        }

        // ====================================================
        // 2. SELEÇÃO DE CANAL (Salvar Estado)
        // ====================================================
        if (interaction.isChannelSelectMenu() && interaction.customId === 'emb_sel_channel') {
            const selectedChannelId = interaction.values[0];
            // Atualiza o texto da mensagem para guardar visualmente qual canal foi escolhido
            await interaction.update({ 
                content: `**🛠️ Estúdio de Criação de Embeds**\n✅ Destino definido: <#${selectedChannelId}>` 
            });
        }

        // ====================================================
        // 3. PROCESSAR MODAIS (Aplicar Edições)
        // ====================================================
        if (interaction.isModalSubmit()) {
            
            // MAIN
            if (interaction.customId === 'emb_modal_main') {
                const t = interaction.fields.getTextInputValue('in_title');
                const d = interaction.fields.getTextInputValue('in_desc');
                const u = interaction.fields.getTextInputValue('in_url');

                if (t) currentEmbed.setTitle(t); else currentEmbed.setTitle(null);
                currentEmbed.setDescription(d);
                if (u && u.startsWith('http')) currentEmbed.setURL(u); else currentEmbed.setURL(null);
            }

            // AUTHOR
            if (interaction.customId === 'emb_modal_author') {
                const name = interaction.fields.getTextInputValue('in_author_name');
                const icon = interaction.fields.getTextInputValue('in_author_icon');
                const fText = interaction.fields.getTextInputValue('in_footer_text');
                const fIcon = interaction.fields.getTextInputValue('in_footer_icon');

                if (name) currentEmbed.setAuthor({ name: name, iconURL: icon.startsWith('http') ? icon : null });
                else currentEmbed.setAuthor(null);

                if (fText) currentEmbed.setFooter({ text: fText, iconURL: fIcon.startsWith('http') ? fIcon : null });
                else currentEmbed.setFooter(null);
            }

            // VISUAL
            if (interaction.customId === 'emb_modal_visual') {
                const color = interaction.fields.getTextInputValue('in_color');
                const img = interaction.fields.getTextInputValue('in_image');
                const thumb = interaction.fields.getTextInputValue('in_thumb');

                if (color) {
                    try { currentEmbed.setColor(color); } catch (e) {}
                }
                if (img && img.startsWith('http')) currentEmbed.setImage(img); else currentEmbed.setImage(null);
                if (thumb && thumb.startsWith('http')) currentEmbed.setThumbnail(thumb); else currentEmbed.setThumbnail(null);
            }

            // FIELD
            if (interaction.customId === 'emb_modal_field') {
                const name = interaction.fields.getTextInputValue('in_field_name');
                const val = interaction.fields.getTextInputValue('in_field_val');
                const inlineRaw = interaction.fields.getTextInputValue('in_field_inline').toLowerCase();
                const isInline = inlineRaw === 'sim' || inlineRaw === 's' || inlineRaw === 'true' || inlineRaw === 'yes';

                currentEmbed.addFields({ name: name, value: val, inline: isInline });
            }

            // Atualiza o painel com o novo visual do embed
            await interaction.update({ embeds: [currentEmbed] });
        }
    }
};