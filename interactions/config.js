const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    async execute(interaction) {

        // ====================================================
        // 1. COMANDOS DE ATALHO (Slash)
        // ====================================================
        if (interaction.isChatInputCommand()) {
            const subcommand = interaction.options.getSubcommand(false);
            if (subcommand === 'web_access') {
                const roleAdmin = interaction.options.getRole('cargo_admin');
                const roleGerente = interaction.options.getRole('cargo_gerente');
                db.setConfig('role_web_admin', roleAdmin.id);
                db.setConfig('role_web_manager', roleGerente.id);
                return interaction.reply({ content: `✅ Permissões configuradas!`, ephemeral: true });
            }
        }
        
        // ====================================================
        // 2. FUNÇÕES DE RENDERIZAÇÃO (EMBEDS)
        // ====================================================

        // MENU PRINCIPAL (DROPDOWN)
        const renderMainMenu = () => {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Painel de Configuração | Grind System')
                .setDescription('Selecione uma categoria no menu abaixo para gerenciar as configurações do servidor.')
                .setColor(0x2B2D31)
                .addFields({ name: '📋 Categorias', value: 'Navegue pelos sistemas usando o menu de seleção abaixo.' })
                .setFooter({ text: 'Sistema Integrado' });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('cfg_main_menu_selector')
                    .setPlaceholder('📂 Selecione uma categoria...')
                    .addOptions([
                        { label: 'Sistema de Registro', value: 'cfg_cat_registro', emoji: '📝', description: 'Canais de aprovação e cargos.' },
                        { label: 'Sistema de Ponto', value: 'cfg_cat_ponto', emoji: '⏰', description: 'Logs de entrada e saída.' },
                        { label: 'Sistema de Vendas', value: 'cfg_cat_vendas', emoji: '💰', description: 'Produtos, porcentagens e logs.' },
                        { label: 'Sistema de Ações', value: 'cfg_cat_acoes', emoji: '⚔️', description: 'Anúncios de PVP e resultados.' },
                        { label: 'Sistema de Farm', value: 'cfg_cat_farm', emoji: '🌾', description: 'Metas de farm, Logs e Validação.' },
                        { label: 'Monitoramento (Baús)', value: 'cfg_cat_monitor', emoji: '📦', description: 'Canais de logs de baú.' },
                        { label: 'Avisos de Baú', value: 'cfg_cat_avisos', emoji: '🚨', description: 'Blacklist, limites e alertas.' },
                        { label: 'Logs Gerais', value: 'cfg_cat_logs', emoji: '📜', description: 'Msg, Voz, Membros e Moderação.' },
                        { label: 'Ausências (Hiatus)', value: 'cfg_cat_ausencia', emoji: '✈️', description: 'Aprovações de ausência.' },
                        { label: 'Acesso ao Site', value: 'cfg_cat_web', emoji: '🌐', description: 'Permissões do painel web.' },
                    ])
            );

            return { embeds: [embed], components: [row] };
        };

        const renderMenuWeb = () => {
            const adminRoleId = db.getConfig('role_web_admin');
            const managerRoleId = db.getConfig('role_web_manager');
            
            const embed = new EmbedBuilder().setTitle('🌐 Acesso ao Site').setColor('White')
                .addFields(
                    { name: '1. Cargo Admin (Total)', value: adminRoleId ? `<@&${adminRoleId}>` : "`Não definido`", inline: true },
                    { name: '2. Cargo Gerente (Logs)', value: managerRoleId ? `<@&${managerRoleId}>` : "`Não definido`", inline: true }
                );

            const row1 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('cfg_select_web_admin').setPlaceholder('Selecionar Cargo Admin'));
            const row2 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('cfg_select_web_manager').setPlaceholder('Selecionar Cargo Gerente'));
            const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️'));

            return { embeds: [embed], components: [row1, row2, row3] };
        };

        const renderMenuRegistro = () => {
            const canalAprovacao = db.getConfig('channel_aprovacao');
            const cargoAprovacao = db.getConfig('role_aprovacao');
            const msgPv = db.getConfig('msg_aprovacao_pv') || "Padrão do sistema";

            const embed = new EmbedBuilder().setTitle('📝 Sistema de Registro').setColor(0x5865F2)
                .addFields(
                    { name: 'Canal Aprovação', value: canalAprovacao ? `<#${canalAprovacao}>` : "`Off`", inline: true },
                    { name: 'Cargo Membro', value: cargoAprovacao ? `<@&${cargoAprovacao}>` : "`Off`", inline: true },
                    { name: 'Mensagem PV', value: `\`${msgPv}\``, inline: false }
                );

            const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_canal_reg').setPlaceholder('Canal de Aprovação').setChannelTypes(ChannelType.GuildText));
            const row2 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('cfg_select_role_reg').setPlaceholder('Cargo de Membro'));
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cfg_btn_reg_msg').setLabel('Editar Msg PV').setStyle(ButtonStyle.Primary).setEmoji('💬'),
                new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️')
            );

            return { embeds: [embed], components: [row1, row2, row3] };
        };

        const renderMenuPonto = () => {
            const logsPonto = db.getConfig('channel_ponto');
            const embed = new EmbedBuilder().setTitle('⏰ Sistema de Ponto').setColor(0x5865F2)
                .setDescription(`**Canal de Logs:** ${logsPonto ? `<#${logsPonto}>` : "`Não definido`"}`);

            const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_logs_ponto').setPlaceholder('Selecionar Canal de Logs').setChannelTypes(ChannelType.GuildText));
            const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️'));

            return { embeds: [embed], components: [row1, row2] };
        };

        const renderMenuVendas = () => {
            const logsCanal = db.getConfig('channel_logs_vendas');
            const porcentagem = db.getConfig('vendas_porcentagem') || "100";
            const produtos = db.listarProdutos();
            
            let listaTexto = produtos.length > 0 
                ? produtos.slice(0, 10).map(p => `• **${p.name}** (R$ ${p.price_normal})`).join('\n') 
                : "Nenhum produto cadastrado.";
            if (produtos.length > 10) listaTexto += `\n...e mais ${produtos.length - 10} itens.`;

            const embed = new EmbedBuilder().setTitle('💰 Sistema de Vendas').setColor(0x00FF00)
                .addFields(
                    { name: 'Canal Logs', value: logsCanal ? `<#${logsCanal}>` : "`Off`", inline: true },
                    { name: '% Vendedor', value: `${porcentagem}%`, inline: true },
                    { name: 'Produtos', value: listaTexto, inline: false }
                );

            const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_logs_vendas').setPlaceholder('Canal de Logs').setChannelTypes(ChannelType.GuildText));
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cfg_btn_porcentagem').setLabel('% Vendedor').setStyle(ButtonStyle.Primary).setEmoji('🏷️'),
                new ButtonBuilder().setCustomId('cfg_btn_criar_item').setLabel('Criar Produto').setStyle(ButtonStyle.Success).setEmoji('➕'),
                new ButtonBuilder().setCustomId('cfg_btn_excluir_item').setLabel('Excluir Produto').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(produtos.length === 0)
            );
            const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️'));

            return { embeds: [embed], components: [row1, row2, row3] };
        };

        const renderMenuFarm = () => {
            const roleId = db.getConfig('farm_role_approver');
            const logChannel = db.getConfig('channel_logs_farm'); // [NOVO] Canal de logs
            const metaPeriod = db.getConfig('farm_meta_period') || "Não definido";
            const metas = db.listarMetasFarm();
            
            let metasTexto = metas.length > 0 
                ? metas.map(m => `• **${m.metaQty}x ${m.metaType}** (${m.metaDesc})`).join('\n') 
                : "*Nenhuma meta.*";

            const embed = new EmbedBuilder().setTitle('🌾 Sistema de Farm').setColor(0xB87333)
                .addFields(
                    { name: 'Cargo Aprovador', value: roleId ? `<@&${roleId}>` : "`Off`", inline: true },
                    { name: 'Canal Logs', value: logChannel ? `<#${logChannel}>` : "`Off`", inline: true }, // [NOVO]
                    { name: 'Período', value: metaPeriod, inline: true },
                    { name: 'Metas', value: metasTexto, inline: false }
                );

            const row1 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('cfg_select_farm_role').setPlaceholder('Cargo Aprovador'));
            // [NOVO] Adicionado seletor de canal de logs
            const rowLogs = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_set_farm_channel').setPlaceholder('Canal de Logs de Farm').setChannelTypes(ChannelType.GuildText));
            
            const row2 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cfg_select_farm_period').setPlaceholder('Período da Meta').addOptions([
                { label: 'Meta Diária', value: 'Meta Diária', emoji: '📅' }, { label: 'Meta Semanal', value: 'Meta Semanal', emoji: '🗓️' }, { label: 'Meta Mensal', value: 'Meta Mensal', emoji: '📆' }
            ]));
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cfg_btn_farm_add').setLabel('Add Meta').setStyle(ButtonStyle.Success).setEmoji('➕'),
                new ButtonBuilder().setCustomId('cfg_btn_farm_rem').setLabel('Remover Meta').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(metas.length === 0),
                new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️')
            );

            return { embeds: [embed], components: [row1, rowLogs, row2, row3] };
        };

        const renderMenuAcoes = () => {
            const msgDm = db.getConfig('acao_msg_dm') || "Ação começando!";
            const tempoAviso = db.getConfig('acao_tempo_aviso') || "15";
            const canalAcoes = db.getConfig('acao_channel');

            const embed = new EmbedBuilder().setTitle('⚔️ Sistema de Ações').setColor(0xF1C40F)
                .addFields(
                    { name: 'Canal Anúncios', value: canalAcoes ? `<#${canalAcoes}>` : "`Off`", inline: false },
                    { name: 'DM Aviso', value: `\`${msgDm}\``, inline: true },
                    { name: 'Tempo (min)', value: `${tempoAviso}`, inline: true }
                );

            const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_acao_channel').setPlaceholder('Canal de Ações').setChannelTypes(ChannelType.GuildText));
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cfg_btn_acao_dm').setLabel('Editar DM').setStyle(ButtonStyle.Primary).setEmoji('💬'),
                new ButtonBuilder().setCustomId('cfg_btn_acao_tempo').setLabel('Definir Tempo').setStyle(ButtonStyle.Primary).setEmoji('⏱️'),
                new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️')
            );

            return { embeds: [embed], components: [row1, row2] };
        };

        const renderMenuMonitor = () => {
            const c1 = db.getConfig('monitor_channel_1');
            const c2 = db.getConfig('monitor_channel_2');
            const c3 = db.getConfig('monitor_channel_3');

            const embed = new EmbedBuilder().setTitle('📦 Monitoramento (Logs de Baú)').setColor(0xE91E63)
                .setDescription('Selecione os canais de onde o bot deve ler os logs de baú (Webhooks).')
                .addFields(
                    { name: 'Canal 1', value: c1 ? `<#${c1}>` : "`Off`", inline: true },
                    { name: 'Canal 2', value: c2 ? `<#${c2}>` : "`Off`", inline: true },
                    { name: 'Canal 3', value: c3 ? `<#${c3}>` : "`Off`", inline: true }
                );

            const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_mon_1').setPlaceholder('Canal 1').setChannelTypes(ChannelType.GuildText));
            const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_mon_2').setPlaceholder('Canal 2').setChannelTypes(ChannelType.GuildText));
            const row3 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_mon_3').setPlaceholder('Canal 3').setChannelTypes(ChannelType.GuildText));
            const row4 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️'));

            return { embeds: [embed], components: [row1, row2, row3, row4] };
        };

        const renderMenuAvisos = () => {
            const canalAvisos = db.getConfig('channel_warning');
            const regras = db.listarRegrasAviso();
            
            let listaRegras = "*Nenhuma regra.*";
            if (regras.length > 0) {
                listaRegras = regras.slice(0, 10).map(r => `${r.type === 'blacklist' ? '🚫' : r.type === 'limit' ? '⚠️' : '🛡️'} ${r.item}`).join('\n');
                if(regras.length > 10) listaRegras += `\n...e mais ${regras.length - 10}.`;
            }

            const embed = new EmbedBuilder().setTitle('🚨 Avisos de Baú').setColor(0xFF5555)
                .setDescription('Configure alertas automáticos para retiradas suspeitas.')
                .addFields(
                    { name: 'Canal Alertas', value: canalAvisos ? `<#${canalAvisos}>` : "`Off`", inline: false },
                    { name: 'Regras Ativas', value: listaRegras, inline: false }
                );

            const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_warning_channel').setPlaceholder('Canal de Alertas').setChannelTypes(ChannelType.GuildText));
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cfg_btn_warning_add').setLabel('Add Regra').setStyle(ButtonStyle.Success).setEmoji('➕'),
                new ButtonBuilder().setCustomId('cfg_btn_warning_rem').setLabel('Remover Regra').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(regras.length === 0),
                new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️')
            );

            return { embeds: [embed], components: [row1, row2] };
        };

        const renderMenuLogs = () => {
            const cMsg = db.getConfig('channel_log_messages');
            const cVoice = db.getConfig('channel_log_voice');
            const cMembers = db.getConfig('channel_log_members');
            const cMod = db.getConfig('channel_log_mod');

            const embed = new EmbedBuilder().setTitle('📜 Logs Gerais').setColor(0x95A5A6)
                .setDescription('Defina onde cada tipo de evento será registrado.')
                .addFields(
                    { name: '💬 Mensagens', value: cMsg ? `<#${cMsg}>` : "`Off`", inline: true },
                    { name: '🔊 Voz', value: cVoice ? `<#${cVoice}>` : "`Off`", inline: true },
                    { name: '👥 Membros', value: cMembers ? `<#${cMembers}>` : "`Off`", inline: true },
                    { name: '🛡️ Moderação', value: cMod ? `<#${cMod}>` : "`Off`", inline: true }
                );

            const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_log_messages').setPlaceholder('Canal Mensagens').setChannelTypes(ChannelType.GuildText));
            const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_log_voice').setPlaceholder('Canal Voz').setChannelTypes(ChannelType.GuildText));
            const row3 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_log_members').setPlaceholder('Canal Membros').setChannelTypes(ChannelType.GuildText));
            const row4 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_log_mod').setPlaceholder('Canal Moderação').setChannelTypes(ChannelType.GuildText));
            const row5 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️'));

            return { embeds: [embed], components: [row1, row2, row3, row4, row5] };
        };

        const renderMenuAusencia = () => {
            const canalApprov = db.getConfig('channel_ausencia_admin');
            const embed = new EmbedBuilder().setTitle('✈️ Sistema de Ausências').setColor(0x3498DB)
                .setDescription('Onde as solicitações de ausência (hiatus) serão enviadas para aprovação.')
                .addFields({ name: 'Canal Aprovação', value: canalApprov ? `<#${canalApprov}>` : "`Off`" });

            const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('cfg_select_ausencia_admin').setPlaceholder('Canal de Aprovação').setChannelTypes(ChannelType.GuildText));
            const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cfg_home').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️'));

            return { embeds: [embed], components: [row1, row2] };
        };

        // ====================================================
        // 3. TRATAMENTO DE INTERAÇÕES
        // ====================================================
        
        // --- SELEÇÃO DO MENU PRINCIPAL (NOVO) ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_main_menu_selector') {
            const choice = interaction.values[0];
            if (choice === 'cfg_cat_registro') return await interaction.update(renderMenuRegistro());
            if (choice === 'cfg_cat_ponto') return await interaction.update(renderMenuPonto());
            if (choice === 'cfg_cat_vendas') return await interaction.update(renderMenuVendas());
            if (choice === 'cfg_cat_acoes') return await interaction.update(renderMenuAcoes());
            if (choice === 'cfg_cat_farm') return await interaction.update(renderMenuFarm());
            if (choice === 'cfg_cat_monitor') return await interaction.update(renderMenuMonitor());
            if (choice === 'cfg_cat_avisos') return await interaction.update(renderMenuAvisos());
            if (choice === 'cfg_cat_logs') return await interaction.update(renderMenuLogs());
            if (choice === 'cfg_cat_ausencia') return await interaction.update(renderMenuAusencia());
            if (choice === 'cfg_cat_web') return await interaction.update(renderMenuWeb());
        }

        // --- BOTÕES ---
        if (interaction.isButton()) {
            // Voltar para Home
            if (interaction.customId === 'cfg_home') {
                return await interaction.update(renderMainMenu());
            }

            // Avisos
            if (interaction.customId === 'cfg_btn_warning_add') {
                return await interaction.reply({
                    content: '🛠️ **Qual tipo de regra deseja criar?**',
                    components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cfg_sel_warn_type').setPlaceholder('Selecione o tipo...').addOptions([
                        { label: 'Blacklist (Proibido)', value: 'blacklist', emoji: '🚫' },
                        { label: 'Limite de Quantidade', value: 'limit', emoji: '⚠️' },
                        { label: 'Permissão por Cargo', value: 'role', emoji: '🛡️' }
                    ]))],
                    ephemeral: true
                });
            }
            if (interaction.customId === 'cfg_btn_warning_rem') {
                const regras = db.listarRegrasAviso();
                if (regras.length === 0) return interaction.reply({ content: 'Nenhuma regra para remover.', ephemeral: true });
                const options = regras.slice(0, 25).map(r => ({ label: `${r.item} (${r.type})`, value: r.id.toString(), description: `Valor: ${r.value || 'N/A'}` }));
                return await interaction.reply({ content: '🗑️ **Selecione para remover:**', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cfg_select_warning_rem_exec').setPlaceholder('Escolha a regra...').addOptions(options))], ephemeral: true });
            }

            // Vendas
            if (interaction.customId === 'cfg_btn_porcentagem') { const modal = new ModalBuilder().setCustomId('cfg_modal_vendas_pct').setTitle('Porcentagem do Vendedor'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_vendas_pct').setLabel("% (0-100)").setStyle(TextInputStyle.Short).setRequired(true))); return await interaction.showModal(modal); }
            if (interaction.customId === 'cfg_btn_criar_item') { const modal = new ModalBuilder().setCustomId('cfg_modal_vendas_add').setTitle('Novo Produto'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_prod_name').setLabel("Nome").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_prod_price_n').setLabel("Preço Normal").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_prod_price_p').setLabel("Preço Parceiro").setStyle(TextInputStyle.Short).setRequired(true))); return await interaction.showModal(modal); }
            if (interaction.customId === 'cfg_btn_excluir_item') { const produtos = db.listarProdutos(); if (produtos.length === 0) return await interaction.reply({ content: '❌ Nenhum produto.', ephemeral: true }); const options = produtos.slice(0, 25).map(p => ({ label: p.name, description: `R$ ${p.price_normal}`, value: p.id.toString() })); return await interaction.update({ components: [{ type: 1, components: [{ type: 3, custom_id: 'cfg_select_vendas_rem_exec', placeholder: 'Escolha...', options }] }, { type: 1, components: [{ type: 2, style: 2, label: 'Cancelar', custom_id: 'cfg_cat_vendas' }] }] }); }

            // Ações / Farm
            if (interaction.customId === 'cfg_btn_acao_dm') { const modal = new ModalBuilder().setCustomId('cfg_modal_acao_dm').setTitle('Mensagem Aviso'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_acao_dm').setLabel("Texto").setStyle(TextInputStyle.Paragraph).setRequired(true))); return await interaction.showModal(modal); }
            if (interaction.customId === 'cfg_btn_acao_tempo') { const modal = new ModalBuilder().setCustomId('cfg_modal_acao_tempo').setTitle('Tempo Aviso'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_acao_tempo').setLabel("Minutos").setStyle(TextInputStyle.Short).setRequired(true))); return await interaction.showModal(modal); }
            if (interaction.customId === 'cfg_btn_farm_add') { const modal = new ModalBuilder().setCustomId('cfg_modal_farm_add').setTitle('Adicionar Meta'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_farm_desc').setLabel("Descrição").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_farm_qty').setLabel("Qtd").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_farm_type').setLabel("Item").setStyle(TextInputStyle.Short).setRequired(true))); return await interaction.showModal(modal); }
            if (interaction.customId === 'cfg_btn_farm_rem') { const metas = db.listarMetasFarm(); const options = metas.map(m => ({ label: `${m.metaQty}x ${m.metaType}`, value: m.id.toString() })); return await interaction.update({ components: [{ type: 1, components: [{ type: 3, custom_id: 'cfg_select_farm_rem_exec', placeholder: 'Escolha...', options }] }, { type: 1, components: [{ type: 2, style: 2, label: 'Cancelar', custom_id: 'cfg_cat_farm' }] }] }); }
            
            // Registro
            if (interaction.customId === 'cfg_btn_reg_msg') { const modal = new ModalBuilder().setCustomId('cfg_modal_reg_msg').setTitle('Mensagem Aprovado'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_reg_msg').setLabel("Mensagem PV").setStyle(TextInputStyle.Paragraph).setRequired(true))); return await interaction.showModal(modal); }
        }

        // --- MODAIS ---
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'cfg_mod_warn_black') { db.adicionarRegraAviso(interaction.fields.getTextInputValue('in_warn_item'), 'blacklist', null); await interaction.reply({ content: '✅ Regra salva!', ephemeral: true }); }
            if (interaction.customId === 'cfg_mod_warn_limit') { db.adicionarRegraAviso(interaction.fields.getTextInputValue('in_warn_item'), 'limit', interaction.fields.getTextInputValue('in_warn_value')); await interaction.reply({ content: '✅ Regra salva!', ephemeral: true }); }
            if (interaction.customId === 'cfg_mod_warn_role') { db.adicionarRegraAviso(interaction.fields.getTextInputValue('in_warn_item'), 'role', interaction.fields.getTextInputValue('in_warn_value')); await interaction.reply({ content: '✅ Regra salva!', ephemeral: true }); }
            
            if (interaction.customId === 'cfg_modal_vendas_pct') { db.setConfig('vendas_porcentagem', interaction.fields.getTextInputValue('in_vendas_pct')); return await interaction.update(renderMenuVendas()); }
            if (interaction.customId === 'cfg_modal_vendas_add') { db.criarProduto(interaction.fields.getTextInputValue('in_prod_name'), interaction.fields.getTextInputValue('in_prod_price_n'), interaction.fields.getTextInputValue('in_prod_price_p')); return await interaction.update(renderMenuVendas()); }
            
            if (interaction.customId === 'cfg_modal_acao_dm') { db.setConfig('acao_msg_dm', interaction.fields.getTextInputValue('in_acao_dm')); return await interaction.update(renderMenuAcoes()); }
            if (interaction.customId === 'cfg_modal_acao_tempo') { db.setConfig('acao_tempo_aviso', interaction.fields.getTextInputValue('in_acao_tempo')); return await interaction.update(renderMenuAcoes()); }
            if (interaction.customId === 'cfg_modal_farm_add') { db.adicionarMetaFarm(interaction.fields.getTextInputValue('in_farm_desc'), interaction.fields.getTextInputValue('in_farm_qty'), interaction.fields.getTextInputValue('in_farm_type')); return await interaction.update(renderMenuFarm()); }
            if (interaction.customId === 'cfg_modal_reg_msg') { db.setConfig('msg_aprovacao_pv', interaction.fields.getTextInputValue('in_reg_msg')); return await interaction.update(renderMenuRegistro()); }
        }

        // --- SELECTS (MENUS ESPECÍFICOS) ---
        if (interaction.isAnySelectMenu()) {
            if (interaction.customId === 'cfg_select_ausencia_admin') { db.setConfig('channel_ausencia_admin', interaction.values[0]); return await interaction.update(renderMenuAusencia()); }
            
            if (interaction.customId === 'cfg_select_log_messages') { db.setConfig('channel_log_messages', interaction.values[0]); return await interaction.update(renderMenuLogs()); }
            if (interaction.customId === 'cfg_select_log_voice') { db.setConfig('channel_log_voice', interaction.values[0]); return await interaction.update(renderMenuLogs()); }
            if (interaction.customId === 'cfg_select_log_members') { db.setConfig('channel_log_members', interaction.values[0]); return await interaction.update(renderMenuLogs()); }
            if (interaction.customId === 'cfg_select_log_mod') { db.setConfig('channel_log_mod', interaction.values[0]); return await interaction.update(renderMenuLogs()); }

            if (interaction.customId === 'cfg_sel_warn_type') {
                const type = interaction.values[0];
                let modal;
                if (type === 'blacklist') modal = new ModalBuilder().setCustomId('cfg_mod_warn_black').setTitle('Blacklist').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_warn_item').setLabel("Item").setStyle(TextInputStyle.Short).setRequired(true)));
                if (type === 'limit') modal = new ModalBuilder().setCustomId('cfg_mod_warn_limit').setTitle('Limite').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_warn_item').setLabel("Item").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_warn_value').setLabel("Max Qtd").setStyle(TextInputStyle.Short).setRequired(true)));
                if (type === 'role') modal = new ModalBuilder().setCustomId('cfg_mod_warn_role').setTitle('Cargo').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_warn_item').setLabel("Item").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_warn_value').setLabel("ID Cargo").setStyle(TextInputStyle.Short).setRequired(true)));
                return await interaction.showModal(modal);
            }
            if (interaction.customId === 'cfg_select_warning_channel') { db.setConfig('channel_warning', interaction.values[0]); return await interaction.update(renderMenuAvisos()); }
            if (interaction.customId === 'cfg_select_warning_rem_exec') { db.removerRegraAviso(parseInt(interaction.values[0])); return await interaction.update({ content: '✅ Regra removida.', components: [] }); }

            if (interaction.customId === 'cfg_select_mon_1') { db.setConfig('monitor_channel_1', interaction.values[0]); return await interaction.update(renderMenuMonitor()); }
            if (interaction.customId === 'cfg_select_mon_2') { db.setConfig('monitor_channel_2', interaction.values[0]); return await interaction.update(renderMenuMonitor()); }
            if (interaction.customId === 'cfg_select_mon_3') { db.setConfig('monitor_channel_3', interaction.values[0]); return await interaction.update(renderMenuMonitor()); }

            if (interaction.customId === 'cfg_select_vendas_rem_exec') { db.deletarProduto(parseInt(interaction.values[0])); return await interaction.update(renderMenuVendas()); }
            if (interaction.customId === 'cfg_select_logs_vendas') { db.setConfig('channel_logs_vendas', interaction.values[0]); return await interaction.update(renderMenuVendas()); }
            if (interaction.customId === 'cfg_select_web_admin') { db.setConfig('role_web_admin', interaction.values[0]); return await interaction.update(renderMenuWeb()); }
            if (interaction.customId === 'cfg_select_web_manager') { db.setConfig('role_web_manager', interaction.values[0]); return await interaction.update(renderMenuWeb()); }
            if (interaction.customId === 'cfg_select_acao_channel') { db.setConfig('acao_channel', interaction.values[0]); return await interaction.update(renderMenuAcoes()); }
            if (interaction.customId === 'cfg_select_canal_reg') { db.setConfig('channel_aprovacao', interaction.values[0]); return await interaction.update(renderMenuRegistro()); }
            if (interaction.customId === 'cfg_select_role_reg') { db.setConfig('role_aprovacao', interaction.values[0]); return await interaction.update(renderMenuRegistro()); }
            if (interaction.customId === 'cfg_select_logs_ponto') { db.setConfig('channel_ponto', interaction.values[0]); return await interaction.update(renderMenuPonto()); }
            
            // --- MODIFICAÇÕES DE FARM (INTEGRADAS) ---
            if (interaction.customId === 'cfg_select_farm_role') { db.setConfig('farm_role_approver', interaction.values[0]); return await interaction.update(renderMenuFarm()); }
            if (interaction.customId === 'cfg_set_farm_channel') { db.setConfig('channel_logs_farm', interaction.values[0]); return await interaction.update(renderMenuFarm()); } // [NOVO] Salva canal
            if (interaction.customId === 'cfg_select_farm_rem_exec') { db.removerMetaFarm(parseInt(interaction.values[0])); return await interaction.update(renderMenuFarm()); }
            if (interaction.customId === 'cfg_select_farm_period') { db.setConfig('farm_meta_period', interaction.values[0]); return await interaction.update(renderMenuFarm()); }
        }
    }
};